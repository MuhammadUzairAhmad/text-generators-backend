import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Blog, BlogDocument, BlogStatus } from './schemas/blog.schema';
import { Niche, NicheDocument } from './schemas/niche.schema';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { QueryBlogDto } from './dto/query-blog.dto';
import { CreateNicheDto, UpdateNicheDto } from './dto/create-niche.dto';
import { transliterateToSlug } from '../../common/utils/slug.util';

@Injectable()
export class BlogsService {
  private readonly logger = new Logger(BlogsService.name);

  constructor(
    @InjectModel(Blog.name) private readonly blogModel: Model<BlogDocument>,
    @InjectModel(Niche.name) private readonly nicheModel: Model<NicheDocument>,
  ) {}

  /**
   * Generates a unique URL slug based on the title, transliterating Unicode and Cyrillic
   */
  private async generateUniqueSlug(title: string, currentId?: string): Promise<string> {
    const base = transliterateToSlug(title) || 'article';
    let slug = base;
    let counter = 1;

    while (true) {
      const query: Record<string, any> = { slug };
      if (currentId && Types.ObjectId.isValid(currentId)) {
        query._id = { $ne: new Types.ObjectId(currentId) };
      }

      const existing = await this.blogModel.findOne(query).lean().exec();
      if (!existing) {
        return slug;
      }
      slug = `${base}-${counter++}`;
    }
  }

  /**
   * Create a new blog post
   */
  async create(dto: CreateBlogDto, user?: { userId: string; name?: string }): Promise<BlogDocument> {
    const slug = dto.slug ? transliterateToSlug(dto.slug) : await this.generateUniqueSlug(dto.title);

    // Verify slug uniqueness
    const existing = await this.blogModel.findOne({ slug }).lean().exec();
    if (existing) {
      throw new ConflictException(`A blog with slug '${slug}' already exists`);
    }

    // Auto-fill publishDate if published without explicit date
    let publishDate = dto.publishDate ? new Date(dto.publishDate) : null;
    if (dto.status === BlogStatus.PUBLISHED && !publishDate) {
      publishDate = new Date();
    }

    // Auto-derive supportedLanguages
    const supported = new Set<string>([dto.primaryLanguage || 'en']);
    if (dto.translations && typeof dto.translations === 'object') {
      Object.keys(dto.translations).forEach((lang) => supported.add(lang));
    }

    const createdBlog = new this.blogModel({
      ...dto,
      slug,
      publishDate,
      authorId: user?.userId && Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : undefined,
      authorName: dto.authorName || user?.name || 'Admin',
      supportedLanguages: Array.from(supported),
    });

    const saved = await createdBlog.save();
    this.logger.log(`Created blog post: "${saved.title}" (${saved.slug})`);
    return saved;
  }

  /**
   * Query blogs with pagination, filtering, search, and sorting
   */
  async findAll(queryDto: QueryBlogDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      nicheId,
      niche,
      tag,
      lang,
      datePreset,
      startDate,
      endDate,
      sortBy = 'publishDate',
      sortOrder = 'desc',
    } = queryDto;

    const filter: Record<string, any> = {};

    if (status && (status as string) !== 'all') {
      filter.status = status;
    }

    const effectiveNiche = nicheId || niche;
    if (effectiveNiche) {
      if (Types.ObjectId.isValid(effectiveNiche)) {
        filter.nicheId = new Types.ObjectId(effectiveNiche);
      } else {
        const foundNiche = await this.nicheModel.findOne({ slug: effectiveNiche.toLowerCase() }).lean().exec();
        if (foundNiche) {
          filter.nicheId = foundNiche._id;
        }
      }
    }

    if (tag) {
      filter.tags = tag;
    }

    if (lang) {
      filter.supportedLanguages = lang;
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
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { excerpt: searchRegex },
        { tags: searchRegex },
      ];
    }

    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortDirection };

    const [items, total] = await Promise.all([
      this.blogModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('nicheId', 'name slug')
        .lean()
        .exec(),
      this.blogModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      hasMore: skip + items.length < total,
    };
  }

  /**
   * Find a single blog post by MongoDB ID or slug, with optional locale resolution
   */
  async findOne(idOrSlug: string, lang?: string) {
    const isObjectId = Types.ObjectId.isValid(idOrSlug) && idOrSlug.length === 24;
    let blog: any = null;

    if (isObjectId) {
      blog = await this.blogModel
        .findById(idOrSlug)
        .populate('nicheId', 'name slug')
        .lean()
        .exec();
    }

    if (!blog) {
      const lower = idOrSlug.toLowerCase();
      const orClauses: Record<string, any>[] = [{ slug: lower }];
      if (lang) {
        orClauses.push({ [`translations.${lang}.slug`]: lower });
      }
      blog = await this.blogModel
        .findOne({ $or: orClauses })
        .populate('nicheId', 'name slug')
        .lean()
        .exec();
    }

    if (!blog) {
      throw new NotFoundException(`Blog post not found: ${idOrSlug}`);
    }

    // If requested with a specific language and a translation exists, overlay translated fields
    if (lang && lang !== blog.primaryLanguage && blog.translations) {
      const translation = (blog.translations as Record<string, any>)[lang];
      if (translation) {
        return {
          ...blog,
          title: translation.title || blog.title,
          slug: translation.slug || blog.slug,
          excerpt: translation.excerpt ?? blog.excerpt,
          content: translation.content || blog.content,
          metaTitle: translation.metaTitle || blog.metaTitle,
          metaDescription: translation.metaDescription || blog.metaDescription,
          coverImage: {
            ...blog.coverImage,
            alt: translation.coverImageAlt || blog.coverImage?.alt || '',
          },
          faqs: Array.isArray(translation.faqs) && translation.faqs.length > 0 ? translation.faqs : blog.faqs,
          activeLanguage: lang,
        };
      }
    }

    return blog;
  }

  /**
   * Update an existing blog post
   */
  async update(id: string, dto: UpdateBlogDto): Promise<BlogDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid blog ID: ${id}`);
    }

    const current = await this.blogModel.findById(id).exec();
    if (!current) {
      throw new NotFoundException(`Blog post not found with ID ${id}`);
    }

    // Handle slug change if provided
    let slug = current.slug;
    if (dto.slug && dto.slug !== current.slug) {
      slug = await this.generateUniqueSlug(dto.slug, id);
    }

    // Auto-fill publishDate if transitioning to published without an existing publishDate
    let publishDate = current.publishDate;
    if (dto.publishDate !== undefined) {
      publishDate = dto.publishDate ? new Date(dto.publishDate) : null;
    } else if (dto.status === BlogStatus.PUBLISHED && !current.publishDate) {
      publishDate = new Date();
    }

    // Recompute supported languages
    const supported = new Set<string>([dto.primaryLanguage || current.primaryLanguage || 'en']);
    const translations = dto.translations || current.translations || {};
    if (typeof translations === 'object') {
      Object.keys(translations).forEach((lang) => supported.add(lang));
    }

    Object.assign(current, {
      ...dto,
      slug,
      publishDate,
      supportedLanguages: Array.from(supported),
    });

    const updated = await current.save();
    this.logger.log(`Updated blog post: "${updated.title}" (${updated.slug})`);
    return updated;
  }

  /**
   * Delete a blog post
   */
  async remove(id: string): Promise<{ success: boolean; id: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid blog ID: ${id}`);
    }

    const res = await this.blogModel.findByIdAndDelete(id).exec();
    if (!res) {
      throw new NotFoundException(`Blog post not found with ID ${id}`);
    }

    this.logger.log(`Deleted blog post: ${id}`);
    return { success: true, id };
  }

  /**
   * Fast status toggle endpoint
   */
  async updateStatus(id: string, status: string, publishDate?: string | Date) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid blog ID: ${id}`);
    }

    const updateData: Record<string, unknown> = { status };
    if (publishDate) {
      updateData.publishDate = new Date(publishDate);
    } else if (status === BlogStatus.PUBLISHED) {
      const blog = await this.blogModel.findById(id).select('publishDate').lean().exec();
      if (blog && !blog.publishDate) {
        updateData.publishDate = new Date();
      }
    }

    const updated = await this.blogModel
      .findByIdAndUpdate(id, { $set: updateData }, { returnDocument: 'after' })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Blog not found: ${id}`);
    }

    return updated;
  }

  /**
   * Record page view atomically with daily analytics aggregation
   */
  async recordView(slug: string): Promise<{ success: boolean; views: number }> {
    const today = new Date().toISOString().split('T')[0];
    const update = {
      $inc: {
        views: 1,
        [`viewsByDate.${today}`]: 1,
      },
    };

    const blog = await this.blogModel
      .findOneAndUpdate({ slug: slug.toLowerCase() }, update, { returnDocument: 'after' })
      .select('views')
      .lean()
      .exec();

    if (!blog) {
      throw new NotFoundException(`Blog with slug '${slug}' not found`);
    }

    return { success: true, views: blog.views };
  }

  /**
   * Save translated content for a specific blog
   */
  async saveTranslations(id: string, translations: Record<string, unknown>) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid blog ID: ${id}`);
    }

    const blog = await this.blogModel.findById(id).exec();
    if (!blog) {
      throw new NotFoundException(`Blog post not found: ${id}`);
    }

    const currentTranslations = (blog.translations as unknown as Record<string, unknown>) || {};
    const mergedTranslations = { ...currentTranslations, ...translations };

    const supported = new Set<string>([blog.primaryLanguage || 'en']);
    Object.keys(mergedTranslations).forEach((lang) => supported.add(lang));

    blog.translations = mergedTranslations as unknown as Map<string, Record<string, unknown>>;
    blog.supportedLanguages = Array.from(supported);

    await blog.save();
    return {
      success: true,
      supportedLanguages: blog.supportedLanguages,
      translations: blog.translations,
    };
  }

  // ===================== Niches Management =====================

  async findAllNiches() {
    return this.nicheModel.find().sort({ order: 1, name: 1 }).lean().exec();
  }

  async createNiche(dto: CreateNicheDto) {
    const slug = dto.slug ? transliterateToSlug(dto.slug) : transliterateToSlug(dto.name);
    const existing = await this.nicheModel.findOne({ slug }).lean().exec();
    if (existing) {
      throw new ConflictException(`Niche with slug '${slug}' already exists`);
    }

    const niche = new this.nicheModel({ ...dto, slug });
    return niche.save();
  }

  async updateNiche(id: string, dto: UpdateNicheDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid niche ID: ${id}`);
    }

    const updateData: Record<string, unknown> = { ...dto };
    if (dto.slug) {
      updateData.slug = transliterateToSlug(dto.slug);
    } else if (dto.name) {
      updateData.slug = transliterateToSlug(dto.name);
    }

    const updated = await this.nicheModel
      .findByIdAndUpdate(id, { $set: updateData }, { returnDocument: 'after' })
      .exec();

    if (!updated) {
      throw new NotFoundException(`Niche not found: ${id}`);
    }

    return updated;
  }

  async deleteNiche(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid niche ID: ${id}`);
    }

    const deleted = await this.nicheModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`Niche not found: ${id}`);
    }

    return { success: true, id };
  }
}
