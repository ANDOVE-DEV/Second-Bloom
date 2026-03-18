import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'icebreaker_templates' })
export class IcebreakerTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  category!: string;

  @Column({ type: 'text' })
  template!: string;
}
