import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { OnboardingStep } from './entities/onboarding-step.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /**
   * Ordered list of onboarding steps that define a complete profile.
   */
  static readonly ONBOARDING_STEPS = [
    'profile_photo',
    'display_name',
    'bio',
    'birth_date',
    'gender',
    'seeking',
    'intent',
    'interests',
    'location',
  ] as const;

  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
    @InjectRepository(OnboardingStep)
    private readonly onboardingStepRepository: Repository<OnboardingStep>,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────────
  // Device tokens
  // ──────────────────────────────────────────────────────────────────────────────

  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<void> {
    const existing = await this.deviceTokenRepository.findOne({
      where: { userId, token },
    });

    if (!existing) {
      const dt = this.deviceTokenRepository.create({ userId, token, platform });
      await this.deviceTokenRepository.save(dt);
    }
  }

  async removeDeviceToken(userId: string, token: string): Promise<void> {
    await this.deviceTokenRepository.delete({ userId, token });
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // FCM Push notifications
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Send a push notification to all of a user's registered devices.
   * In production, use firebase-admin's messaging API.
   */
  async sendPush(userId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
    const tokens = await this.deviceTokenRepository.find({ where: { userId } });

    if (!tokens.length) return;

    this.logger.log(`Sending push to ${tokens.length} device(s) for user ${userId}: "${title}"`);

    // TODO: Integrate firebase-admin
    // import * as admin from 'firebase-admin';
    // const messages = tokens.map(t => ({
    //   token: t.token,
    //   notification: { title, body },
    //   data: data ?? {},
    // }));
    // await admin.messaging().sendEach(messages);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Onboarding step tracking
  // ──────────────────────────────────────────────────────────────────────────────

  async getOnboardingProgress(userId: string): Promise<{
    completed: string[];
    remaining: string[];
    percentage: number;
  }> {
    const steps = await this.onboardingStepRepository.find({ where: { userId } });
    const completedKeys = steps.filter(s => !!s.completedAt).map(s => s.stepKey);
    const all = NotificationsService.ONBOARDING_STEPS as unknown as string[];
    const remaining = all.filter(k => !completedKeys.includes(k));

    return {
      completed: completedKeys,
      remaining,
      percentage: Math.round((completedKeys.length / all.length) * 100),
    };
  }

  async completeStep(userId: string, stepKey: string): Promise<OnboardingStep> {
    let step = await this.onboardingStepRepository.findOne({ where: { userId, stepKey } });

    if (!step) {
      step = this.onboardingStepRepository.create({ userId, stepKey, completedAt: new Date() });
    } else {
      step.completedAt = new Date();
    }

    return this.onboardingStepRepository.save(step);
  }
}
