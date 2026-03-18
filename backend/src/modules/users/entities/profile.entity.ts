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

  @Column({ name: 'avatar_url', length: 500, nullable: true })
  avatarUrl!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
