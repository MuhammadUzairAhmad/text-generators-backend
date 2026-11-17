import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type BlogDocument = Blog & Document;

export enum BlogStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
}

@Schema({ _id: false })
export class BlogCoverImage {
  @Prop()
  publicId?: string;

  @Prop({ required: true })
  url: string;

  @Prop()
  width?: number;

  @Prop()
  height?: number;

  @Prop()
  format?: string;

  @Prop({ default: '' })
  alt?: string;
}

@Schema({ _id: false })
export class BlogFAQ {
  @Prop({ required: true, trim: true, default: '' })
  question: string;

  @Prop({ required: true, trim: true, default: '' })
  answer: string;
}

@Schema({ timestamps: true, versionKey: false })
export class Blog {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true, index: true })
  slug: string;

  @Prop({ default: '' })
  excerpt: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  content: Record<string, unknown>;

  @Prop({ type: BlogCoverImage, default: null })
  coverImage?: BlogCoverImage | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  authorId?: Types.ObjectId;

  @Prop({ default: '' })
  authorName: string;

  @Prop({ default: '' })
  authorAvatar: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Niche', index: true })
  nicheId?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [BlogFAQ], default: [] })
  faqs: BlogFAQ[];

  @Prop({
    type: String,
    enum: Object.values(BlogStatus),
    default: BlogStatus.DRAFT,
    index: true,
  })
  status: BlogStatus;

  @Prop({ type: Date, default: null })
  publishDate?: Date | null;

  @Prop({ default: '' })
  metaTitle?: string;

  @Prop({ default: '' })
  metaDescription?: string;

  @Prop({ default: '' })
  canonicalUrl?: string;

  @Prop({ default: '' })
  ogImage?: string;

  @Prop({ default: 0 })
  views: number;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  viewsByDate: Record<string, number>;

  @Prop({ default: false, index: true })
  isFeatured: boolean;

  @Prop({ default: true })
  allowComments: boolean;

  @Prop({ default: 'en', trim: true })
  primaryLanguage: string;

  @Prop({ type: [String], default: ['en'], index: true })
  supportedLanguages: string[];

  @Prop({ type: Map, of: MongooseSchema.Types.Mixed, default: {} })
  translations: Map<string, Record<string, unknown>>;

  createdAt: Date;
  updatedAt: Date;
}

export const BlogSchema = SchemaFactory.createForClass(Blog);

// Fast compound indexes matching the Next.js database for sub-millisecond querying
BlogSchema.index({ status: 1, publishDate: -1 });
BlogSchema.index({ status: 1, supportedLanguages: 1, publishDate: -1 });
