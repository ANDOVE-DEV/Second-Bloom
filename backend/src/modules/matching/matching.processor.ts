import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '../users/entities/profile.entity';
import { User } from '../users/entities/user.entity';
import { Swipe } from './entities/swipe.entity';
import { AffinityService } from './affinity.service';
import { MatchingCacheService } from './matching-cache.service';

@Processor('matching')
@Injectable()
export class MatchingProcessor {
  private readonly logger = new Logger(MatchingProcessor.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(Swipe)
    private readonly swipeRepository: Repository<Swipe>,
    private readonly affinityService: AffinityService,
    private readonly cacheService: MatchingCacheService,
  ) {}

  @Process('rebuild-all-queues')
  async handleRebuildAllQueues(job: Job) {
    this.logger.debug('Starting nightly queue rebuild for all active users...');
    
    // Find active users who have completed onboarding
    // Assuming onboardingCompleted is on Profile, and isActive is on User
    const users = await this.usersRepository.find({
      where: { isActive: true },
    });

    for (const user of users) {
      try {
        const profile = await this.profileRepository.findOne({ where: { userId: user.id } });
        // Only process users whose profile is complete/onboarding_completed
        if (!profile || !profile.onboardingCompleted) {
          continue;
        }
        await this.rebuildQueueForUser(user.id, profile);
      } catch (error) {
        this.logger.error(`Failed to rebuild queue for user ${user.id}`, error);
      }
    }

    this.logger.debug('Nightly queue rebuild completed.');
  }

  @Process('rebuild-single-queue')
  async handleRebuildSingleQueue(job: Job<{ userId: string }>) {
    const { userId } = job.data;
    this.logger.debug(`Rebuilding queue for user ${userId}...`);
    
    const profile = await this.profileRepository.findOne({ where: { userId } });
    if (profile) {
      await this.rebuildQueueForUser(userId, profile);
    }
  }

  private async rebuildQueueForUser(userId: string, myProfile: Profile): Promise<void> {
    const swiped = await this.swipeRepository.find({
      where: { actorId: userId },
      select: ['targetId'],
    });

    const excluded = new Set(swiped.map((item) => item.targetId));

    // Limit to 200 candidates as per spec
    const candidates = await this.profileRepository
      .createQueryBuilder('p')
      .where('p.user_id != :userId', { userId })
      .limit(200)
      .getMany();

    const ranked = candidates
      .filter((candidate) => !excluded.has(candidate.userId))
      .map((candidate) => {
        let score = this.affinityService.calculateScore(myProfile, candidate);
        // Penalty for incomplete profile
        if (!candidate.onboardingCompleted) {
           score *= 0.7;
        }
        // TODO: Apply boost multiplier if candidate has active boost (Redis check)
        return {
          userId: candidate.userId,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);

    await this.cacheService.setQueue(userId, ranked);
  }
}
