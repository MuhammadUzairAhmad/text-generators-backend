import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BlogStatus } from '../schemas/blog.schema';

export class CoverImageDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  publicId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  height?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  format?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  alt?: string;
}

export class FAQItemDto {
  @ApiProperty({ example: 'What is a fancy text generator?' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ example: 'A tool that converts standard characters into Unicode glyphs.' })
  @IsString()
  @IsNotEmpty()
  answer: string;
}

export class CreateBlogDto {
  @ApiProperty({ example: 'The Ultimate Guide to Unicode Text' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'the-ultimate-guide-to-unicode-text' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'A deep dive into Unicode styling, glyphs, and typography.' })
  @IsString()
  @IsOptional()
  excerpt?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  content?: Record<string, unknown>;

  @ApiPropertyOptional({ type: CoverImageDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CoverImageDto)
  coverImage?: CoverImageDto;

  @ApiPropertyOptional({ example: 'Admin User' })
  @IsString()
  @IsOptional()
  authorName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  authorAvatar?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nicheId?: string;

  @ApiPropertyOptional({ type: [String], example: ['fonts', 'unicode', 'styling'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ type: [FAQItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FAQItemDto)
  @IsOptional()
  faqs?: FAQItemDto[];

  @ApiPropertyOptional({ enum: BlogStatus, default: BlogStatus.DRAFT })
  @IsEnum(BlogStatus)
  @IsOptional()
  status?: BlogStatus;

  @ApiPropertyOptional({ example: '2026-11-10T12:00:00.000Z' })
  @IsOptional()
  publishDate?: string | Date;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  metaDescription?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  canonicalUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ogImage?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  allowComments?: boolean;

  @ApiPropertyOptional({ default: 'en' })
  @IsString()
  @IsOptional()
  primaryLanguage?: string;

  @ApiPropertyOptional({ type: [String], default: ['en'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supportedLanguages?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  translations?: Record<string, Record<string, unknown>>;
}
