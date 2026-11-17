import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SUPPORTED_LOCALES,
  SupportedLocale,
  TranslationScope,
  BlogFAQ,
} from '../ai/gemini-translate.service';

export class TranslateArticleDto {
  @ApiProperty({ example: 'The Ultimate Guide to Unicode Text' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'the-ultimate-guide-to-unicode-text' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  excerpt?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  content?: Record<string, unknown>;

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
  coverImageAlt?: string;

  @ApiPropertyOptional({ type: Array })
  @IsOptional()
  faqs?: BlogFAQ[];

  @ApiPropertyOptional({ default: 'en' })
  @IsString()
  @IsOptional()
  fromLang?: string;

  @ApiProperty({ enum: SUPPORTED_LOCALES, example: 'nl' })
  @IsIn(SUPPORTED_LOCALES)
  toLang: SupportedLocale;

  @ApiPropertyOptional({ type: [String], example: ['title', 'content', 'faqs', 'seo'] })
  @IsArray()
  @IsOptional()
  scopes?: TranslationScope[];
}

export class BatchTranslateArticleDto {
  @ApiProperty({ example: 'The Ultimate Guide to Unicode Text' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  excerpt?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  content?: Record<string, unknown>;

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
  coverImageAlt?: string;

  @ApiPropertyOptional({ type: Array })
  @IsOptional()
  faqs?: BlogFAQ[];

  @ApiPropertyOptional({ default: 'en' })
  @IsString()
  @IsOptional()
  fromLang?: string;

  @ApiProperty({ type: [String], example: ['nl', 'es', 'fr', 'ru', 'zh', 'ar'] })
  @IsArray()
  toLangs: SupportedLocale[];

  @ApiPropertyOptional({ type: [String], example: ['title', 'content', 'faqs', 'seo'] })
  @IsArray()
  @IsOptional()
  scopes?: TranslationScope[];
}

export class UpdateStatusDto {
  @ApiProperty({ example: 'published' })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiPropertyOptional({ example: '2026-11-10T12:00:00.000Z' })
  @IsOptional()
  publishDate?: string | Date;
}
