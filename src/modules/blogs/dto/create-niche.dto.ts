import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNicheDto {
  @ApiProperty({ example: 'Font Converters' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'font-converters' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateNicheDto {
  @ApiPropertyOptional({ example: 'Font Converters' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'font-converters' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
