import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Verification, VerificationStatus } from './entities/verification.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Initiate a KYC session for a user. Returns a session URL to redirect the user.
   * In production this would call Jumio/Onfido API to create a session.
   */
  async initiateKyc(userId: string, provider: 'jumio' | 'onfido'): Promise<{ sessionUrl: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let verification = await this.verificationRepository.findOne({ where: { userId } });

    if (!verification) {
      verification = this.verificationRepository.create({
        userId,
        provider,
        status: 'pending',
        sessionId: null,
      });
    } else {
      // allow re-initiating if previously rejected
      verification.provider = provider;
      verification.status = 'pending';
    }

    // TODO: call Jumio/Onfido API here to create a real session
    // const session = await this.jumioClient.createSession(user.email);
    // verification.sessionId = session.id;
    verification.sessionId = `mock-session-${Date.now()}`;
    await this.verificationRepository.save(verification);

    this.logger.log(`KYC initiated for user ${userId} via ${provider}`);

    // TODO: return real redirect URL from provider
    return { sessionUrl: `https://kyc.example.com/session/${verification.sessionId}` };
  }

  /**
   * Handle inbound KYC webhook from Jumio / Onfido.
   * Updates the verification status and marks the user as verified if approved.
   */
  async handleKycWebhook(payload: {
    sessionId: string;
    status: VerificationStatus;
    provider: string;
  }): Promise<void> {
    const verification = await this.verificationRepository.findOne({
      where: { sessionId: payload.sessionId },
    });

    if (!verification) {
      this.logger.warn(`Webhook received for unknown session: ${payload.sessionId}`);
      return;
    }

    verification.status = payload.status;
    if (payload.status === 'approved') {
      verification.completedAt = new Date();
    }
    await this.verificationRepository.save(verification);

    // If approved, mark the user as verified
    if (payload.status === 'approved') {
      await this.userRepository.update(verification.userId, { isVerified: true });
      this.logger.log(`User ${verification.userId} KYC approved.`);
    }
  }

  /**
   * Get the verification status for a user.
   */
  async getVerificationStatus(userId: string): Promise<{ status: VerificationStatus | 'not_started' }> {
    const verification = await this.verificationRepository.findOne({ where: { userId } });
    return { status: verification?.status ?? 'not_started' };
  }

  /**
   * Stub: Moderate a profile photo via AWS Rekognition.
   * In production, this is called after an S3 upload event (Lambda / SQS trigger).
   * Returns true if the image is safe, false if flagged.
   */
  async moderatePhoto(s3Key: string, userId: string): Promise<boolean> {
    this.logger.log(`Moderating photo for user ${userId}, key: ${s3Key}`);
    // TODO: Call AWS Rekognition DetectModerationLabels
    // const result = await rekognitionClient.send(new DetectModerationLabelsCommand({ Image: { S3Object: { Bucket, Name: s3Key } } }));
    // const flagged = result.ModerationLabels?.some(l => l.Confidence && l.Confidence > 75);
    // if (flagged) { /* soft-delete image, notify user */ }
    return true; // placeholder: all images pass
  }
}
