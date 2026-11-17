import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Blog, BlogDocument, BlogStatus } from '../blogs/schemas/blog.schema';
import { Niche, NicheDocument } from '../blogs/schemas/niche.schema';
import { Comment, CommentDocument, CommentStatus } from '../comments/schemas/comment.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Blog.name) private readonly blogModel: Model<BlogDocument>,
    @InjectModel(Niche.name) private readonly nicheModel: Model<NicheDocument>,
    @InjectModel(Comment.name) private readonly commentModel: Model<CommentDocument>,
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
  ) {}

  async getDashboardAnalytics() {
    const [
      totalBlogs,
      published,
      drafts,
      unpublished,
      totalComments,
      pendingComments,
      totalLeads,
      totalNiches,
      allBlogsViews,
      niches,
      recentBlogs,
      recentComments,
      recentLeads,
    ] = await Promise.all([
      this.blogModel.countDocuments().exec(),
      this.blogModel.countDocuments({ status: BlogStatus.PUBLISHED }).exec(),
      this.blogModel.countDocuments({ status: BlogStatus.DRAFT }).exec(),
      this.blogModel.countDocuments({ status: BlogStatus.UNPUBLISHED }).exec(),
      this.commentModel.countDocuments().exec(),
      this.commentModel.countDocuments({ status: CommentStatus.PENDING }).exec(),
      this.leadModel.countDocuments().exec(),
      this.nicheModel.countDocuments().exec(),
      this.blogModel.find().select('views viewsByDate nicheId').lean().exec(),
      this.nicheModel.find().select('_id name slug').lean().exec(),
      this.blogModel
        .find()
        .select('title slug createdAt status')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec(),
      this.commentModel
        .find()
        .select('name comment createdAt status')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec(),
      this.leadModel
        .find()
        .select('name email source createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec(),
    ]);

    const totalViews = allBlogsViews.reduce((acc, b) => acc + (b.views || 0), 0);

    // Aggregate views by date for last 30 days
    const days = 30;
    const viewsByDateMap: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      viewsByDateMap[key] = 0;
    }

    allBlogsViews.forEach((b) => {
      const viewsObj = b.viewsByDate as Record<string, number> | undefined;
      if (viewsObj && typeof viewsObj === 'object') {
        Object.entries(viewsObj).forEach(([date, count]) => {
          if (viewsByDateMap[date] !== undefined) {
            viewsByDateMap[date] += Number(count) || 0;
          }
        });
      }
    });

    const viewsByDate = Object.entries(viewsByDateMap).map(([date, views]) => ({
      date,
      views,
    }));

    // Aggregate views by niche
    const nicheMap: Record<
      string,
      { _id: string; name: string; slug: string; blogCount: number; views: number }
    > = {};

    niches.forEach((n) => {
      nicheMap[n._id.toString()] = {
        _id: n._id.toString(),
        name: n.name,
        slug: n.slug,
        blogCount: 0,
        views: 0,
      };
    });

    allBlogsViews.forEach((b) => {
      if (b.nicheId && nicheMap[b.nicheId.toString()]) {
        nicheMap[b.nicheId.toString()].blogCount += 1;
        nicheMap[b.nicheId.toString()].views += b.views || 0;
      }
    });

    const viewsByNiche = Object.values(nicheMap);

    // Recent combined activity feed
    const activity = [
      ...recentBlogs.map((b) => ({
        type: 'blog' as const,
        label: `Blog post ${b.status}: "${b.title}"`,
        detail: b.slug,
        createdAt: b.createdAt,
      })),
      ...recentComments.map((c) => ({
        type: 'comment' as const,
        label: `New comment from ${c.name} (${c.status})`,
        detail: c.comment.length > 50 ? `${c.comment.slice(0, 47)}...` : c.comment,
        createdAt: c.createdAt,
      })),
      ...recentLeads.map((l) => ({
        type: 'lead' as const,
        label: `New ${l.source} lead: ${l.name}`,
        detail: l.email,
        createdAt: l.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return {
      summary: {
        totalBlogs,
        published,
        drafts,
        unpublished,
        totalViews,
        totalComments,
        pendingComments,
        totalLeads,
        totalNiches,
      },
      viewsByDate,
      viewsByNiche,
      recentActivity: activity,
    };
  }
}
