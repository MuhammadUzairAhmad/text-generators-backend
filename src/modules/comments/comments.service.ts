import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument, CommentStatus } from './schemas/comment.schema';
import {
  CreateCommentDto,
  AdminReplyCommentDto,
  UpdateCommentStatusDto,
  QueryCommentDto,
} from './dto/comment.dto';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectModel(Comment.name) private readonly commentModel: Model<CommentDocument>,
  ) {}

  /**
   * Submit a comment (public, pending moderation)
   */
  async create(dto: CreateCommentDto): Promise<CommentDocument> {
    if (!Types.ObjectId.isValid(dto.blogId)) {
      throw new BadRequestException(`Invalid blog ID: ${dto.blogId}`);
    }

    // Bot honeypot detection
    if (dto.website_hp && dto.website_hp.trim().length > 0) {
      this.logger.warn(`Bot honeypot triggered by ${dto.email} (name: ${dto.name})`);
      return {
        _id: new Types.ObjectId(),
        name: dto.name,
        email: dto.email,
        comment: dto.comment,
        status: CommentStatus.SPAM,
      } as any;
    }

    // Public submissions are restricted to top-level comments (admin/staff reply via admin dashboard)
    const comment = new this.commentModel({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone?.trim() || '',
      comment: dto.comment.trim(),
      blogId: new Types.ObjectId(dto.blogId),
      parentId: null,
      replyToName: '',
      isAdminReply: false,
      status: CommentStatus.PENDING,
    });

    const saved = await comment.save();
    this.logger.log(`New comment submitted by ${saved.name} on blog ${saved.blogId}`);
    return saved;
  }

  /**
   * Get approved comments for a blog post
   */
  async findApprovedByBlog(blogId: string) {
    if (!Types.ObjectId.isValid(blogId)) {
      return [];
    }

    const allApproved = await this.commentModel
      .find({
        blogId: new Types.ObjectId(blogId),
        status: CommentStatus.APPROVED,
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    // Collect IDs of approved root comments to prevent orphaned replies if parent is unapproved
    const approvedRootIds = new Set(
      allApproved.filter((c) => !c.parentId).map((c) => c._id.toString()),
    );

    // Only return root comments and replies whose parent comment is also approved
    const validComments = allApproved.filter(
      (c) => !c.parentId || approvedRootIds.has(c.parentId.toString()),
    );

    return validComments.map((c) => ({
      ...c,
      _id: c._id.toString(),
      id: c._id.toString(),
      blogId: c.blogId.toString(),
      parentId: c.parentId ? c.parentId.toString() : null,
      isAdminReply: Boolean(c.isAdminReply),
    }));
  }

  /**
   * Admin: List all comments with pagination and status/search filters
   */
  async findAll(queryDto: QueryCommentDto) {
    const { page = 1, limit = 20, status, blogId, search, datePreset, startDate, endDate, type = 'root' } = queryDto;
    const filter: Record<string, any> = {};

    if (status && (status as string) !== 'all') {
      filter.status = status;
    }

    if (type === 'root') {
      filter.parentId = null;
    } else if (type === 'replies') {
      filter.parentId = { $ne: null };
    }

    if (blogId && Types.ObjectId.isValid(blogId)) {
      filter.blogId = new Types.ObjectId(blogId);
    }

    // Date range filtering
    if (startDate || endDate) {
      const dateFilter: Record<string, any> = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          dateFilter.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          dateFilter.$lte = end;
        }
      }
      if (Object.keys(dateFilter).length > 0) {
        filter.createdAt = dateFilter;
      }
    } else if (datePreset && datePreset !== 'all' && datePreset !== 'custom') {
      const now = Date.now();
      let start: Date | null = null;
      if (datePreset === 'today') {
        start = new Date();
        start.setHours(0, 0, 0, 0);
      } else if (datePreset === '7d') {
        start = new Date(now - 7 * 24 * 60 * 60 * 1000);
      } else if (datePreset === '30d') {
        start = new Date(now - 30 * 24 * 60 * 60 * 1000);
      } else if (datePreset === '90d') {
        start = new Date(now - 90 * 24 * 60 * 60 * 1000);
      }
      if (start) {
        filter.createdAt = { $gte: start };
      }
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { comment: regex }];
    }

    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);

    const [items, total] = await Promise.all([
      this.commentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('blogId', 'title slug')
        .lean()
        .exec(),
      this.commentModel.countDocuments(filter).exec(),
    ]);

    // Look up any child replies for the returned comments
    const itemIds = items.map((i) => i._id);
    const childReplies = await this.commentModel
      .find({ parentId: { $in: itemIds } })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    // Look up parent comments for any items that are replies
    const parentIds = items
      .filter((i) => i.parentId)
      .map((i) => i.parentId);

    const parentMap = new Map<string, any>();
    if (parentIds.length > 0) {
      const parentDocs = await this.commentModel
        .find({ _id: { $in: parentIds } })
        .select('name comment email')
        .lean()
        .exec();
      for (const p of parentDocs) {
        parentMap.set(p._id.toString(), p);
      }
    }

    const enrichedItems = items.map((item) => {
      const itemIdStr = item._id.toString();
      const repliesForItem = childReplies
        .filter((r) => r.parentId && r.parentId.toString() === itemIdStr)
        .map((r) => ({
          ...r,
          _id: r._id.toString(),
          id: r._id.toString(),
        }));

      const parentDoc = item.parentId && parentMap.has(item.parentId.toString())
        ? parentMap.get(item.parentId.toString())
        : null;

      return {
        ...item,
        _id: itemIdStr,
        id: itemIdStr,
        replies: repliesForItem,
        parentComment: parentDoc
          ? {
              _id: parentDoc._id.toString(),
              name: parentDoc.name,
              comment: parentDoc.comment,
              email: parentDoc.email,
            }
          : null,
      };
    });

    return {
      items: enrichedItems,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin: Update moderation status (approve, reject, spam)
   */
  async updateStatus(id: string, dto: UpdateCommentStatusDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid comment ID: ${id}`);
    }

    const updated = await this.commentModel
      .findByIdAndUpdate(id, { $set: { status: dto.status } }, { returnDocument: 'after' })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Comment not found: ${id}`);
    }

    this.logger.log(`Comment ${id} status updated to ${dto.status}`);
    return updated;
  }

  /**
   * Admin: Update comment text (e.g. edit an admin reply or correct typo)
   */
  async updateText(id: string, commentText: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid comment ID: ${id}`);
    }

    const updated = await this.commentModel.findByIdAndUpdate(
      id,
      { $set: { comment: commentText.trim() } },
      { returnDocument: 'after' },
    ).exec();

    if (!updated) {
      throw new NotFoundException(`Comment not found: ${id}`);
    }

    this.logger.log(`Comment ${id} text updated`);
    return updated;
  }

  /**
   * Admin: Post an official reply to an existing comment
   */
  async adminReply(
    id: string,
    dto: AdminReplyCommentDto,
    adminUser: { name?: string; email?: string },
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid comment ID: ${id}`);
    }

    const parent = await this.commentModel.findById(id).lean().exec();
    if (!parent) {
      throw new NotFoundException(`Parent comment not found: ${id}`);
    }

    const reply = new this.commentModel({
      name: adminUser?.name || 'Administrator',
      email: adminUser?.email || 'admin@textgenerators.ai',
      comment: dto.comment.trim(),
      blogId: parent.blogId,
      parentId: parent._id,
      replyToName: parent.name,
      isAdminReply: true,
      status: CommentStatus.APPROVED,
    });

    const saved = await reply.save();
    this.logger.log(`Admin replied to comment ${id}`);
    return saved;
  }

  /**
   * Admin: Delete comment and its replies
   */
  async delete(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid comment ID: ${id}`);
    }

    const objId = new Types.ObjectId(id);
    await this.commentModel.deleteMany({
      $or: [{ _id: objId }, { parentId: objId }],
    }).exec();

    this.logger.log(`Deleted comment and replies for ID ${id}`);
    return { success: true, id };
  }
}
