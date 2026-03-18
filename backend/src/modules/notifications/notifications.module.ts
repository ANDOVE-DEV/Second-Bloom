import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { DeviceToken } from './entities/device-token.entity';
import { OnboardingStep } from './entities/onboarding-step.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken, OnboardingStep])],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
