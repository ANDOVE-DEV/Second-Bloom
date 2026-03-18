import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { IcebreakerTemplate } from './entities/icebreaker-template.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly convRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(IcebreakerTemplate)
    private readonly icebreakerRepository: Repository<IcebreakerTemplate>,
  ) {}

  /**
   * Create a conversation for a given match. Called automatically when a match is created.
   */
  async createConversationForMatch(matchId: string): Promise<Conversation> {
    const existing = await this.convRepository.findOne({ where: { matchId } });
    if (existing) return existing;

    const conv = this.convRepository.create({ matchId });
    return this.convRepository.save(conv);
  }

  /**
   * Checks whether a user is a participant in a conversation (via match).
   */
  async canAccessConversation(userId: string, conversationId: string): Promise<boolean> {
    const conv = await this.convRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.match', 'match')
      .where('c.id = :conversationId', { conversationId })
      .getOne();

    if (!conv) return false;

    return conv.match.userAId === userId || conv.match.userBId === userId;
  }

  /**
   * Persist a message and return it.
   */
  async saveMessage(
    senderId: string,
    conversationId: string,
    content: string,
    type: 'text' | 'icebreaker' | 'system' = 'text',
  ): Promise<Message> {
    const message = this.messageRepository.create({
      senderId,
      conversationId,
      content,
      type,
    });
    return this.messageRepository.save(message);
  }

  /**
   * Mark a message as read (only the receiver can do this).
   */
  async markAsRead(userId: string, messageId: string): Promise<Message | null> {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message || message.senderId === userId) return null;

    message.isRead = true;
    return this.messageRepository.save(message);
  }

  /**
   * Retrieve paginated messages for a conversation.
   */
  async getMessages(conversationId: string, limit = 50, before?: string): Promise<Message[]> {
    const qb = this.messageRepository
      .createQueryBuilder('m')
      .where('m.conversation_id = :conversationId', { conversationId })
      .orderBy('m.created_at', 'DESC')
      .limit(limit);

    if (before) {
      qb.andWhere('m.created_at < (SELECT created_at FROM messages WHERE id = :before)', { before });
    }

    const messages = await qb.getMany();
    return messages.reverse(); // return oldest-first
  }

  /**
   * Get icebreaker templates, with optional category filter.
   */
  async getIcebreakers(category?: string): Promise<IcebreakerTemplate[]> {
    if (category) {
      return this.icebreakerRepository.find({ where: { category } });
    }
    return this.icebreakerRepository.find();
  }
}
