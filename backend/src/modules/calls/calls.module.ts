import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { CallLog } from './entities/call-log.entity';
import { Match } from '../matching/entities/match.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CallLog, Match])],
  providers: [CallsService],
  controllers: [CallsController],
  exports: [CallsService],
})
export class CallsModule {}
