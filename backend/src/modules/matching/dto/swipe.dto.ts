import { IsIn, IsUUID } from 'class-validator';

export class SwipeDto {
  @IsUUID()
  targetId!: string;

  @IsIn(['yes', 'pass'])
  action!: 'yes' | 'pass';
}
