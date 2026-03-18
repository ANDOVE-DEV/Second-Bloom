import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'matches' })
@Unique('uq_match_users', ['userAId', 'userBId'])
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_a_id', type: 'uuid' })
  userAId!: string;

  @Column({ name: 'user_b_id', type: 'uuid' })
  userBId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_a_id' })
  userA!: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_b_id' })
  userB!: User;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'matched_at' })
  matchedAt!: Date;
}
