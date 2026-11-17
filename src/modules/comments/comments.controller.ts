import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import {
  CreateCommentDto,
  AdminReplyCommentDto,
  UpdateCommentStatusDto,
  QueryCommentDto,
} from './dto/comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Comments')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  // ===================== Public Endpoints =====================

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('comments')
  @ApiOperation({ summary: 'Submit a new comment (pending moderation, rate limited to 5 submissions per 5 minutes)' })
  @ApiResponse({ status: 201, description: 'Comment submitted successfully' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded, please wait before submitting another comment' })
  async createComment(@Body() dto: CreateCommentDto) {
    return this.commentsService.create(dto);
  }

  @Public()
  @Get('comments')
  @ApiOperation({ summary: 'Get approved comments for a blog post (threaded)' })
  @ApiQuery({ name: 'blogId', required: true, description: 'MongoDB ObjectId of blog' })
  @ApiResponse({ status: 200, description: 'Threaded list of approved comments' })
  async getApprovedComments(@Query('blogId') blogId: string) {
    return this.commentsService.findApprovedByBlog(blogId);
  }

  // ===================== Admin Moderation Endpoints =====================

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('admin/comments')
  @ApiOperation({ summary: 'List all comments for moderation' })
  @ApiResponse({ status: 200, description: 'Paginated comments list' })
  async getAdminComments(@Query() query: QueryCommentDto) {
    return this.commentsService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('admin/comments/:id/status')
  @ApiOperation({ summary: 'Update comment moderation status (approved, rejected, spam)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Updated comment' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCommentStatusDto,
  ) {
    return this.commentsService.updateStatus(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('admin/comments/:id/reply')
  @ApiOperation({ summary: 'Admin reply to a user comment' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 201, description: 'Created reply comment' })
  async adminReply(
    @Param('id') id: string,
    @Body() dto: AdminReplyCommentDto,
    @CurrentUser() adminUser: any,
  ) {
    return this.commentsService.adminReply(id, dto, adminUser);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('admin/comments/:id')
  @ApiOperation({ summary: 'Update comment text (e.g. edit an admin reply)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Updated comment' })
  async updateText(
    @Param('id') id: string,
    @Body('comment') comment: string,
  ) {
    return this.commentsService.updateText(id, comment);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('admin/comments/:id')
  @ApiOperation({ summary: 'Delete comment and any nested replies' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Deletion confirmation' })
  async deleteComment(@Param('id') id: string) {
    return this.commentsService.delete(id);
  }
}
