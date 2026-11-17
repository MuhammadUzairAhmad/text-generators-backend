import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource } from '../schemas/lead.schema';

export class CreateLeadDto {
  @ApiProperty({ example: 'Sarah Connor' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'sarah@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+15551234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ enum: LeadSource, example: LeadSource.NEWSLETTER })
  @IsEnum(LeadSource)
  source: LeadSource;

  @ApiPropertyOptional({ example: 'Partnership Inquiry' })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ example: 'I would like to discuss a content collaboration.' })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({ example: '66e1234567890abcdef12345' })
  @IsString()
  @IsOptional()
  blogId?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  consent?: boolean;
}

export class QueryLeadDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional({ description: 'Search across name, email, subject, and message' })
  @IsOptional()
  @IsString()
  search?: string;
}
