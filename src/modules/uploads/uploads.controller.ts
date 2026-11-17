import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Uploads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('admin/uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('signature')
  @ApiOperation({ summary: 'Generate secure Cloudinary upload signature for client-side uploads' })
  @ApiQuery({ name: 'folder', required: false, description: 'Optional subfolder path' })
  @ApiResponse({ status: 200, description: 'Cloudinary upload signature parameters' })
  getSignature(@Query('folder') folder?: string) {
    return this.uploadsService.getUploadSignature(folder);
  }

  @Post('signature')
  @ApiOperation({ summary: 'Generate secure Cloudinary upload signature (POST alias)' })
  @ApiQuery({ name: 'folder', required: false })
  createSignature(@Query('folder') folder?: string) {
    return this.uploadsService.getUploadSignature(folder);
  }

  @Delete(':publicId')
  @ApiOperation({ summary: 'Delete an uploaded image asset from Cloudinary' })
  @ApiParam({ name: 'publicId', description: 'Cloudinary asset publicId' })
  @ApiResponse({ status: 200, description: 'Deletion status' })
  deleteAsset(@Param('publicId') publicId: string) {
    return this.uploadsService.deleteImage(publicId);
  }
}
