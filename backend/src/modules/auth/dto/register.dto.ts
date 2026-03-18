import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Length(8, 72)
  password!: string;

  @IsString()
  @Length(2, 50)
  displayName!: string;
}
