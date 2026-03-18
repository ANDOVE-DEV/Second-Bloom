import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { Profile } from '../users/entities/profile.entity';
import { Match } from './entities/match.entity';
import { Swipe } from './entities/swipe.entity';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

@Module({
  imports: [TypeOrmModule.forFeature([Swipe, Match, Profile]), UsersModule],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
