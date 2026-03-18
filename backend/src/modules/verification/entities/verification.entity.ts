import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

@Entity({ name: 'verifications' })
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @Column({ type: 'varchar', length: 30 })
  provider!: string; // 'jumio' | 'onfido'

  @Column({ name: 'session_id', type: 'varchar', length: 255, nullable: true })
  sessionId!: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    default: 'pending',
  })
  status!: VerificationStatus;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
