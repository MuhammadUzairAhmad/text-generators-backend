import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type CommentDocument = Comment & Document;

export enum CommentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SPAM = 'spam',
}

@Schema({ timestamps: true, versionKey: false })
export class Comment {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ default: '', trim: true })
  phone?: string;

  @Prop({ required: true, trim: true })
  comment: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Blog', required: true, index: true })
  blogId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Comment', default: null, index: true })
  parentId?: Types.ObjectId | null;

  @Prop({ default: false })
  isAdminReply: boolean;

  @Prop({ default: '' })
  authorAvatar?: string;

  @Prop({ default: '' })
  replyToName?: string;

  @Prop({
    type: String,
    enum: Object.values(CommentStatus),
    default: CommentStatus.PENDING,
    index: true,
  })
  status: CommentStatus;

  createdAt: Date;
  updatedAt: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

CommentSchema.index({ blogId: 1, status: 1, createdAt: 1 });
CommentSchema.index({ status: 1, createdAt: -1 });
