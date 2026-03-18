import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Boost } from './entities/boost.entity';
import { Profile } from '../users/entities/profile.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  /**
   * Duration of one boost in milliseconds: 30 minutes.
   */
  private readonly BOOST_DURATION_MS = 30 * 60 * 1000;

  constructor(
    @InjectRepository(Boost)
    private readonly boostRepository: Repository<Boost>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
  ) {}

  /**
   * Handle inbound Stripe webhook events.
   * NOTE: In production, validate stripe-signature header before processing.
   */
  async handleStripeWebhook(payload: { type: string; data: Record<string, any> }): Promise<void> {
    this.logger.log(`Stripe webhook received: ${payload.type}`);

    switch (payload.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionChange(payload.data);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancelled(payload.data);
        break;

      case 'checkout.session.completed':
        await this.handleBoostPurchase(payload.data);
        break;

      default:
        this.logger.debug(`Unhandled Stripe event: ${payload.type}`);
    }
  }

  private async handleSubscriptionChange(data: Record<string, any>): Promise<void> {
    // TODO: extract userId from data.object.metadata.userId or from customer object
    const userId: string = data.object?.metadata?.userId;
    const status: string = data.object?.status;

    if (!userId) return;

    const tier = status === 'active' ? 'gold' : 'free';
    await this.profileRepository.update({ userId }, { subscriptionTier: tier as any });
    this.logger.log(`User ${userId} subscription updated to ${tier}`);
  }

  private async handleSubscriptionCancelled(data: Record<string, any>): Promise<void> {
    const userId: string = data.object?.metadata?.userId;
    if (!userId) return;
    await this.profileRepository.update({ userId }, { subscriptionTier: 'free' as any });
    this.logger.log(`User ${userId} subscription cancelled → downgraded to free`);
  }

  private async handleBoostPurchase(data: Record<string, any>): Promise<void> {
    const userId: string = data.object?.metadata?.userId;
    const paymentRef: string = data.object?.id;
    if (!userId) return;

    const now = new Date();
    const boost = this.boostRepository.create({
      userId,
      startedAt: now,
      expiresAt: new Date(now.getTime() + this.BOOST_DURATION_MS),
      paymentRef,
    });
    await this.boostRepository.save(boost);
    this.logger.log(`Boost created for user ${userId} until ${boost.expiresAt}`);
  }

  /**
   * Check if a user has an active boost (used by Matching engine to apply multiplier).
   */
  async hasActiveBoost(userId: string): Promise<boolean> {
    const count = await this.boostRepository.count({
      where: { userId, expiresAt: MoreThan(new Date()) },
    });
    return count > 0;
  }
}
