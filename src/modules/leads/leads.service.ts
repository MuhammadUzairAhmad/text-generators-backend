import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument } from './schemas/lead.schema';
import { CreateLeadDto, QueryLeadDto } from './dto/lead.dto';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
  ) {}

  /**
   * Capture a new lead from newsletter or contact form
   */
  async create(dto: CreateLeadDto): Promise<LeadDocument> {
    const email = dto.email.trim().toLowerCase();

    // Check if lead already exists for newsletter to prevent duplicate spam
    const existing = await this.leadModel.findOne({ email }).exec();
    if (existing) {
      if (dto.message) {
        existing.message = dto.message;
      }
      if (dto.phone) {
        existing.phone = dto.phone;
      }
      if (dto.subject) {
        existing.subject = dto.subject;
      }
      const saved = await existing.save();
      this.logger.log(`Existing lead updated: ${email}`);
      return saved;
    }

    const lead = new this.leadModel({
      ...dto,
      email,
      blogId: dto.blogId && Types.ObjectId.isValid(dto.blogId) ? new Types.ObjectId(dto.blogId) : undefined,
    });

    const saved = await lead.save();
    this.logger.log(`New lead captured: ${email} (${dto.source})`);
    return saved;
  }

  /**
   * Admin: List leads with search, source filter, and pagination
   */
  async findAll(queryDto: QueryLeadDto) {
    const { page = 1, limit = 20, source, search } = queryDto;
    const filter: Record<string, any> = {};

    if (source) {
      filter.source = source;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { subject: regex },
        { message: regex },
      ];
    }

    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);

    const [items, total] = await Promise.all([
      this.leadModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('blogId', 'title slug')
        .lean()
        .exec(),
      this.leadModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin: Export all leads to CSV format
   */
  async exportCsv(): Promise<string> {
    const leads = await this.leadModel.find().sort({ createdAt: -1 }).lean().exec();

    const headers = ['ID', 'Name', 'Email', 'Phone', 'Source', 'Subject', 'Message', 'Created At'];
    const rows = leads.map((lead) => [
      lead._id.toString(),
      `"${(lead.name || '').replace(/"/g, '""')}"`,
      `"${(lead.email || '').replace(/"/g, '""')}"`,
      `"${(lead.phone || '').replace(/"/g, '""')}"`,
      lead.source,
      `"${(lead.subject || '').replace(/"/g, '""')}"`,
      `"${(lead.message || '').replace(/"/g, '""')}"`,
      lead.createdAt ? new Date(lead.createdAt).toISOString() : '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Admin: Delete a lead
   */
  async delete(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid lead ID: ${id}`);
    }

    const res = await this.leadModel.findByIdAndDelete(id).exec();
    if (!res) {
      throw new NotFoundException(`Lead not found: ${id}`);
    }

    this.logger.log(`Deleted lead: ${id}`);
    return { success: true, id };
  }
}
