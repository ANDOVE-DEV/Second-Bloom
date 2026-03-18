import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Boost } from './entities/boost.entity';
import { Profile } from '../users/entities/profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Boost, Profile])],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
