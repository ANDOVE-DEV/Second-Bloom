import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Match } from '../../matching/entities/match.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'call_logs' })
export class CallLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'match_id', type: 'uuid' })
  matchId!: string;

  @Column({ name: 'initiated_by', type: 'uuid' })
  initiatedBy!: string;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Column({ name: 'duration_s', type: 'integer', nullable: true })
  durationSeconds!: number | null;

  @ManyToOne(() => Match, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match!: Match;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'initiated_by' })
  initiator!: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
