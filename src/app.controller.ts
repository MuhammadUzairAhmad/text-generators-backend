import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API service root status' })
  @ApiResponse({ status: 200, description: 'Service health and status links' })
  getRoot() {
    return {
      name: 'TextGenerators API',
      status: 'online',
      version: '1.0.0',
      documentation: '/docs',
      health: '/api/health',
      timestamp: new Date().toISOString(),
    };
  }
}
