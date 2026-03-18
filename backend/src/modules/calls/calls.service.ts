import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallLog } from './entities/call-log.entity';
import { Match } from '../matching/entities/match.entity';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    @InjectRepository(CallLog)
    private readonly callLogRepository: Repository<CallLog>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
  ) {}

  /**
   * Generate a Twilio/Agora access token for a safe call within a match.
   * The calling user must be a participant in the match.
   */
  async generateCallToken(userId: string, matchId: string): Promise<{ token: string; roomName: string }> {
    const match = await this.matchRepository.findOne({ where: { id: matchId } });

    if (!match || !match.isActive) {
      throw new NotFoundException('Match not found or no longer active');
    }

    if (match.userAId !== userId && match.userBId !== userId) {
      throw new ForbiddenException('You are not a participant in this match');
    }

    const roomName = `match-${matchId}`;

    // TODO: Integrate Twilio Video or Agora token generation
    // Example (Twilio):
    //   const AccessToken = require('twilio').jwt.AccessToken;
    //   const VideoGrant = AccessToken.VideoGrant;
    //   const token = new AccessToken(accountSid, apiKey, apiSecret, { identity: userId });
    //   token.addGrant(new VideoGrant({ room: roomName }));
    //   return { token: token.toJwt(), roomName };

    this.logger.log(`Call token requested for user ${userId} in match ${matchId}`);

    // Log the call initiation
    const log = this.callLogRepository.create({
      matchId,
      initiatedBy: userId,
      startedAt: new Date(),
    });
    await this.callLogRepository.save(log);

    // Placeholder token
    return { token: `mock-token-${userId}-${Date.now()}`, roomName };
  }

  /**
   * End a call and record the duration.
   */
  async endCall(callLogId: string, userId: string): Promise<void> {
    const log = await this.callLogRepository.findOne({ where: { id: callLogId } });

    if (!log || log.initiatedBy !== userId) {
      throw new NotFoundException('Call log not found');
    }

    const now = new Date();
    log.endedAt = now;
    if (log.startedAt) {
      log.durationSeconds = Math.round((now.getTime() - log.startedAt.getTime()) / 1000);
    }

    await this.callLogRepository.save(log);
  }

  /**
   * Send an emergency email to a trusted contact (Family Button).
   * In production, use SendGrid / AWS SES.
   */
  async sendEmergencyAlert(userId: string, body: { trustedEmail: string; message?: string }): Promise<{ sent: boolean }> {
    this.logger.warn(`EMERGENCY ALERT from user ${userId} to ${body.trustedEmail}`);

    // TODO: Integrate SendGrid
    // await sgMail.send({
    //   to: body.trustedEmail,
    //   from: 'noreply@secondbloom.app',
    //   subject: 'Second Bloom – Emergency Alert',
    //   text: body.message ?? 'Your contact may need help.'
    // });

    return { sent: true };
  }
}
