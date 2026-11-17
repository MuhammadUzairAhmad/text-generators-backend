import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryBlogDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Full-text search in title, excerpt, and tags' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by status (draft, published, unpublished, all)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by Niche ObjectId' })
  @IsOptional()
  @IsString()
  nicheId?: string;

  @ApiPropertyOptional({ description: 'Filter by Niche ObjectId or Slug' })
  @IsOptional()
  @IsString()
  niche?: string;

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

  @ApiPropertyOptional({ description: 'Filter by tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Language code (e.g. en, nl, es)' })
  @IsOptional()
  @IsString()
  lang?: string;

  @ApiPropertyOptional({ default: 'publishDate', description: 'Sort field: publishDate, createdAt, views, title' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'publishDate';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
