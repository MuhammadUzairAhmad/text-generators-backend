import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { LeadsService } from './leads.service';
import { CreateLeadDto, QueryLeadDto } from './dto/lead.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Leads')
@Controller()
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('leads')
  @ApiOperation({ summary: 'Capture lead from newsletter or contact form (rate limited to 5 submissions per 5 minutes)' })
  @ApiResponse({ status: 201, description: 'Lead successfully recorded' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded, please wait before submitting another message' })
  async createLead(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('admin/leads')
  @ApiOperation({ summary: 'Admin list all captured leads' })
  @ApiResponse({ status: 200, description: 'Paginated list of leads' })
  async getAdminLeads(@Query() query: QueryLeadDto) {
    return this.leadsService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('admin/leads/export')
  @ApiOperation({ summary: 'Export leads as downloadable CSV file' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportCsv(@Res({ passthrough: true }) res: Response) {
    const csvData = await this.leadsService.exportCsv();
    const dateStr = new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${dateStr}.csv"`,
    });
    return csvData;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('admin/leads/:id')
  @ApiOperation({ summary: 'Delete a lead' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Deletion confirmation' })
  async deleteLead(@Param('id') id: string) {
    return this.leadsService.delete(id);
  }
}
