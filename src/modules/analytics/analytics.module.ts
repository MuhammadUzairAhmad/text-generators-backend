import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Blog, BlogSchema } from '../blogs/schemas/blog.schema';
import { Niche, NicheSchema } from '../blogs/schemas/niche.schema';
import { Comment, CommentSchema } from '../comments/schemas/comment.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Blog.name, schema: BlogSchema },
      { name: Niche.name, schema: NicheSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Lead.name, schema: LeadSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
