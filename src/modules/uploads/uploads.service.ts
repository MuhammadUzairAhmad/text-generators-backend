import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly configService: ConfigService) {}

  private getCredentials() {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Cloudinary credentials are not configured in environment',
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    return { cloudName, apiKey, apiSecret };
  }

  private getBaseFolder(): string {
    const custom = this.configService.get<string>('CLOUDINARY_FOLDER');
    if (custom) return custom;
    return this.configService.get<string>('NODE_ENV') === 'production'
      ? 'textgenerators'
      : 'textgenerators-dev';
  }

  getUploadSignature(customFolder?: string) {
    const { cloudName, apiKey, apiSecret } = this.getCredentials();
    const timestamp = Math.round(new Date().getTime() / 1000);
    const baseFolder = this.getBaseFolder();

    const sanitized = customFolder
      ? customFolder.replace(/[^a-zA-Z0-9_\-/]/g, '').replace(/\.\./g, '')
      : '';

    const folder = sanitized
      ? sanitized.startsWith(baseFolder)
        ? sanitized
        : `${baseFolder}/${sanitized}`
      : baseFolder;

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
      },
      apiSecret,
    );

    return {
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
    };
  }

  async deleteImage(publicId: string) {
    try {
      this.getCredentials();
      const result = await cloudinary.uploader.destroy(publicId);
      this.logger.log(`Cloudinary asset deleted: ${publicId}`);
      return result;
    } catch (err: unknown) {
      this.logger.error(`Failed to delete Cloudinary asset ${publicId}:`, err);
      throw err;
    }
  }
}
