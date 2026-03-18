import { Body, Controller, HttpCode, HttpStatus, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CallsService } from './calls.service';

@ApiTags('Calls')
@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  /**
   * POST /api/calls/token
   * Generate a Twilio/Agora token to join a video/audio room for a match.
   */
  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate call access token for a match' })
  generateToken(
    @CurrentUser() user: { id?: string },
    @Body() body: { matchId: string },
  ) {
    if (!user.id) throw new UnauthorizedException();
    return this.callsService.generateCallToken(user.id, body.matchId);
  }

  /**
   * POST /api/calls/end
   * Record call end time and duration.
   */
  @Post('end')
  @HttpCode(HttpStatus.OK)
  endCall(
    @CurrentUser() user: { id?: string },
    @Body() body: { callLogId: string },
  ) {
    if (!user.id) throw new UnauthorizedException();
    return this.callsService.endCall(body.callLogId, user.id);
  }

  /**
   * POST /api/calls/emergency
   * Family Button: send an emergency alert to a trusted contact.
   */
  @Post('emergency')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Family Button – send emergency alert to trusted contact' })
  sendEmergency(
    @CurrentUser() user: { id?: string },
    @Body() body: { trustedEmail: string; message?: string },
  ) {
    if (!user.id) throw new UnauthorizedException();
    return this.callsService.sendEmergencyAlert(user.id, body);
  }
}
