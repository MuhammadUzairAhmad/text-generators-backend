import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Check API and Database Health Status' })
  @ApiResponse({ status: 200, description: 'API is operational' })
  @ApiResponse({ status: 503, description: 'Database connection degraded' })
  async check(@Res() res: Response) {
    const isDbConnected = this.connection.readyState === 1;
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    const healthData = {
      status: isDbConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(uptime),
      database: {
        status: isDbConnected ? 'connected' : 'disconnected',
        readyState: this.connection.readyState,
      },
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      },
    };

    return res
      .status(isDbConnected ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json(healthData);
  }
}
