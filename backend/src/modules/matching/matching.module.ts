import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { Profile } from '../users/entities/profile.entity';
import { Match } from './entities/match.entity';
import { Swipe } from './entities/swipe.entity';
import { AffinityService } from './affinity.service';
import { MatchingCacheService } from './matching-cache.service';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { MatchingProcessor } from './matching.processor';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    TypeOrmModule.forFeature([Swipe, Match, Profile]),
    BullModule.registerQueue({ name: 'matching' }),
    UsersModule
  ],
  controllers: [MatchingController],
  providers: [MatchingService, AffinityService, MatchingCacheService, MatchingProcessor],
})
export class MatchingModule {}
