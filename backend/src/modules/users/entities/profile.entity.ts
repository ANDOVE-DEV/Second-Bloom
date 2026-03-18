import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity({ name: 'profiles' })
export class Profile {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId!: string;

  @OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'display_name', length: 50 })
  displayName!: string;

  @Column({ type: 'date', name: 'birth_date', nullable: true })
  birthDate!: string | null;

  @Column({ length: 10, default: 'other' })
  gender!: 'man' | 'woman' | 'other';

  @Column({ length: 10, default: 'any' })
  seeking!: 'man' | 'woman' | 'any';

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ length: 100, nullable: true })
  city!: string | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  latitude!: string | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  longitude!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  interests!: string[];

  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
    name: 'intent',
  })
  intent!: 'convivenza' | 'relazione_stabile' | 'amicizia' | 'vediamo' | null;

  @Column({ nullable: true })
  smokes!: boolean | null;

  @Column({ name: 'has_cohabiting_kids', nullable: true })
  hasCohabitingKids!: boolean | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'political_lean' })
  politicalLean!: 'left' | 'center' | 'right' | 'apolitical' | 'prefer_not' | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  religion!:
    | 'christian'
    | 'jewish'
    | 'muslim'
    | 'buddhist'
    | 'atheist'
    | 'other'
    | 'prefer_not'
    | null;

  @Column({
    name: 'subscription_tier',
    type: 'varchar',
    length: 10,
    default: 'free',
  })
  subscriptionTier!: 'free' | 'gold';

  @Column({ name: 'avatar_url', length: 500, nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'is_invisible', default: false })
  isInvisible!: boolean;

  @Column({ name: 'onboarding_completed', default: false })
  onboardingCompleted!: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
