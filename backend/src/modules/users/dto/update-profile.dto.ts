import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  displayName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsIn(['man', 'woman', 'other'])
  gender?: 'man' | 'woman' | 'other';

  @IsOptional()
  @IsIn(['man', 'woman', 'any'])
  seeking?: 'man' | 'woman' | 'any';

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  city?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsIn(['convivenza', 'relazione_stabile', 'amicizia', 'vediamo'])
  intent?: 'convivenza' | 'relazione_stabile' | 'amicizia' | 'vediamo';

  @IsOptional()
  @IsBoolean()
  smokes?: boolean;

  @IsOptional()
  @IsBoolean()
  hasCohabitingKids?: boolean;

  @IsOptional()
  @IsIn(['left', 'center', 'right', 'apolitical', 'prefer_not'])
  politicalLean?: 'left' | 'center' | 'right' | 'apolitical' | 'prefer_not';

  @IsOptional()
  @IsIn([
    'christian',
    'jewish',
    'muslim',
    'buddhist',
    'atheist',
    'other',
    'prefer_not',
  ])
  religion?:
    | 'christian'
    | 'jewish'
    | 'muslim'
    | 'buddhist'
    | 'atheist'
    | 'other'
    | 'prefer_not';
}
