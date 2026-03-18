import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VerificationService } from './verification.service';

@ApiTags('Verification')
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  /**
   * GET /api/verification/status
   * Returns the current KYC status for the authenticated user.
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  getStatus(@CurrentUser() user: { id?: string }) {
    if (!user.id) throw new UnauthorizedException();
    return this.verificationService.getVerificationStatus(user.id);
  }

  /**
   * POST /api/verification/initiate
   * Starts a KYC session and returns the redirect URL for the provider.
   */
  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate KYC verification session' })
  initiateKyc(
    @CurrentUser() user: { id?: string },
    @Body() body: { provider?: 'jumio' | 'onfido' },
  ) {
    if (!user.id) throw new UnauthorizedException();
    return this.verificationService.initiateKyc(user.id, body.provider ?? 'jumio');
  }

  /**
   * POST /api/verification/webhook
   * Receives webhook callbacks from KYC providers (Jumio / Onfido).
   * NOTE: In production, you MUST validate the webhook signature before processing.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'KYC provider webhook (Jumio / Onfido)' })
  async handleWebhook(
    @Body() body: { sessionId: string; status: 'approved' | 'rejected' | 'pending'; provider: string },
  ) {
    // TODO: validate HMAC / signature from provider before trusting payload
    await this.verificationService.handleKycWebhook(body);
    return { received: true };
  }
}
