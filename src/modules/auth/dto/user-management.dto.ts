import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'jane@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecretP@ss123!', minimum: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: ['super_admin', 'admin'], default: 'admin' })
  @IsIn(['super_admin', 'admin'])
  @IsOptional()
  role?: 'super_admin' | 'admin';
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'NewSecretP@ss123!', minimum: 8 })
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ enum: ['super_admin', 'admin'] })
  @IsIn(['super_admin', 'admin'])
  @IsOptional()
  role?: 'super_admin' | 'admin';

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Super Admin' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  avatar?: {
    publicId?: string;
    url: string;
  } | null;
}
