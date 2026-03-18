import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

type QueueItem = { userId: string; score: number };

@Injectable()
export class MatchingCacheService implements OnModuleDestroy {
  private readonly redis: Redis | null;
  private readonly queueMemory = new Map<string, QueueItem[]>();
  private readonly seenMemory = new Map<string, Set<string>>();
  private readonly undoMemory = new Map<string, string>();
  private readonly dailyYesMemory = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.redis = redisUrl ? new Redis(redisUrl, { lazyConnect: true }) : null;
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async setUndo(userId: string, swipeId: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.set(this.undoKey(userId), swipeId, 'EX', 600);
        return;
      } catch {
        // Fallback to in-memory when Redis is not reachable.
      }
    }

    this.undoMemory.set(userId, swipeId);
  }

  async getUndo(userId: string): Promise<string | null> {
    if (this.redis) {
      try {
        return await this.redis.get(this.undoKey(userId));
      } catch {
        // Fallback to in-memory when Redis is not reachable.
      }
    }

    return this.undoMemory.get(userId) ?? null;
  }

  async clearUndo(userId: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(this.undoKey(userId));
      } catch {
        // Fallback to in-memory when Redis is not reachable.
      }
    }

    this.undoMemory.delete(userId);
  }

  async markSeen(userId: string, targetId: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.sadd(this.seenKey(userId), targetId);
        await this.redis.expire(this.seenKey(userId), 30 * 24 * 60 * 60);
        return;
      } catch {
        // Fallback to in-memory when Redis is not reachable.
      }
    }

    if (!this.seenMemory.has(userId)) {
      this.seenMemory.set(userId, new Set());
    }
    this.seenMemory.get(userId)?.add(targetId);
  }

  async isSeen(userId: string, targetId: string): Promise<boolean> {
    if (this.redis) {
      try {
        const value = await this.redis.sismember(this.seenKey(userId), targetId);
        return value === 1;
      } catch {
        // Fallback to in-memory when Redis is not reachable.
      }
    }

    return this.seenMemory.get(userId)?.has(targetId) ?? false;
  }

  async setQueue(userId: string, items: QueueItem[]): Promise<void> {
    if (this.redis) {
      try {
        const key = this.queueKey(userId);
        await this.redis.del(key);

        if (items.length > 0) {
          const payload: Array<string | number> = [];
          for (const item of items) {
            payload.push(item.score, item.userId);
          }
          await this.redis.zadd(key, ...payload);
          await this.redis.expire(key, 24 * 60 * 60);
        }

        return;
      } catch {
        // Fallback to in-memory when Redis is not reachable.
      }
    }

    this.queueMemory.set(
      userId,
      [...items].sort((a, b) => b.score - a.score),
    );
  }

  async popTopQueue(userId: string): Promise<string | null> {
    if (this.redis) {
      try {
        const key = this.queueKey(userId);
        const values = await this.redis.zrevrange(key, 0, 0);

        if (!values.length) {
          return null;
        }

        await this.redis.zrem(key, values[0]);
        return values[0];
      } catch {
        // Fallback to in-memory when Redis is not reachable.
      }
    }

    const queue = this.queueMemory.get(userId) ?? [];
    const item = queue.shift();
    this.queueMemory.set(userId, queue);

    return item?.userId ?? null;
  }

  async incrementDailyYes(userId: string): Promise<number> {
    if (this.redis) {
      try {
        const key = this.dailyYesKey(userId);
        const count = await this.redis.incr(key);

        if (count === 1) {
          await this.redis.expireat(key, this.nextMidnightEpoch());
        }

        return count;
      } catch {
        // Fallback to in-memory when Redis is not reachable.
      }
    }

    const key = this.memoryCounterKey(userId);
    const value = (this.dailyYesMemory.get(key) ?? 0) + 1;
    this.dailyYesMemory.set(key, value);
    return value;
  }

  async decrementDailyYes(userId: string): Promise<void> {
    if (this.redis) {
      try {
        const key = this.dailyYesKey(userId);
        const current = Number((await this.redis.get(key)) ?? '0');

        if (current <= 1) {
          await this.redis.del(key);
        } else {
          await this.redis.decr(key);
        }

        return;
      } catch {
        // Fallback to in-memory when Redis is not reachable.
      }
    }

    const key = this.memoryCounterKey(userId);
    const current = this.dailyYesMemory.get(key) ?? 0;
    if (current <= 1) {
      this.dailyYesMemory.delete(key);
    } else {
      this.dailyYesMemory.set(key, current - 1);
    }
  }

  private queueKey(userId: string) {
    return `match:queue:${userId}`;
  }

  private seenKey(userId: string) {
    return `match:seen:${userId}`;
  }

  private undoKey(userId: string) {
    return `undo:${userId}`;
  }

  private dailyYesKey(userId: string) {
    return `swipes_today:${userId}`;
  }

  private nextMidnightEpoch(): number {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    return Math.floor(midnight.getTime() / 1000);
  }

  private memoryCounterKey(userId: string): string {
    const date = new Date().toISOString().slice(0, 10);
    return `${userId}:${date}`;
  }
}
