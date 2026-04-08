import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  surname: string;

  @IsString()
  @MinLength(1)
  phoneNumber: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  birthDate: string;

  @IsString()
  @MinLength(6)
  password: string;
}
