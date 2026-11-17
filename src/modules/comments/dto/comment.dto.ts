import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentStatus } from '../schemas/comment.schema';

export class CreateCommentDto {
  @ApiProperty({ example: 'Alice Johnson' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+123456789' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'This article was super helpful for understanding Unicode!' })
  @IsString()
  @IsNotEmpty()
  comment: string;

  @ApiProperty({ example: '66e1234567890abcdef12345' })
  @IsString()
  @IsNotEmpty()
  blogId: string;

  @ApiPropertyOptional({ example: '66e1234567890abcdef12346' })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Bot anti-spam honeypot field (must remain empty)' })
  @IsString()
  @IsOptional()
  website_hp?: string;
}

export class AdminReplyCommentDto {
  @ApiProperty({ example: 'Thanks Alice, glad you found it useful!' })
  @IsString()
  @IsNotEmpty()
  comment: string;
}

export class UpdateCommentStatusDto {
  @ApiProperty({ enum: CommentStatus, example: CommentStatus.APPROVED })
  @IsEnum(CommentStatus)
  status: CommentStatus;
}

export class QueryCommentDto {
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

  @ApiPropertyOptional({ description: 'Filter by status (pending, approved, rejected, spam, all)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by comment type: all, root (reader comments), replies' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by blog MongoDB ObjectId' })
  @IsOptional()
  @IsString()
  blogId?: string;

  @ApiPropertyOptional({ description: 'Date preset: today, 7d, 30d, 90d, custom' })
  @IsOptional()
  @IsString()
  datePreset?: string;

  @ApiPropertyOptional({ description: 'Custom start date (ISO string)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Custom end date (ISO string)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Search by comment text, name, or email' })
  @IsOptional()
  @IsString()
  search?: string;
}
