import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * POST /api/notifications/device-token
   * Register a device's FCM token for push notifications.
   */
  @Post('device-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register device FCM token' })
  registerToken(
    @CurrentUser() user: { id?: string },
    @Body() body: { token: string; platform: 'ios' | 'android' | 'web' },
  ) {
    if (!user.id) throw new UnauthorizedException();
    return this.notificationsService.registerDeviceToken(user.id, body.token, body.platform);
  }

  /**
   * DELETE /api/notifications/device-token/:token
   * Unregister a device token (e.g. on logout).
   */
  @Delete('device-token/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeToken(@CurrentUser() user: { id?: string }, @Param('token') token: string) {
    if (!user.id) throw new UnauthorizedException();
    return this.notificationsService.removeDeviceToken(user.id, token);
  }

  /**
   * GET /api/notifications/onboarding
   * Get the authenticated user's onboarding progress.
   */
  @Get('onboarding')
  @ApiOperation({ summary: 'Get onboarding step progress' })
  getOnboarding(@CurrentUser() user: { id?: string }) {
    if (!user.id) throw new UnauthorizedException();
    return this.notificationsService.getOnboardingProgress(user.id);
  }

  /**
   * POST /api/notifications/onboarding/:stepKey
   * Mark an onboarding step as completed.
   */
  @Post('onboarding/:stepKey')
  @HttpCode(HttpStatus.OK)
  completeStep(@CurrentUser() user: { id?: string }, @Param('stepKey') stepKey: string) {
    if (!user.id) throw new UnauthorizedException();

    const validSteps = NotificationsService.ONBOARDING_STEPS as unknown as string[];
    if (!validSteps.includes(stepKey)) {
      throw new NotFoundException(`Step key '${stepKey}' is not valid`);
    }

    return this.notificationsService.completeStep(user.id, stepKey);
  }
}
