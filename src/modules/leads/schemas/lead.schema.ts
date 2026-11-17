import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type LeadDocument = Lead & Document;

export enum LeadSource {
  NEWSLETTER = 'newsletter',
  CONTACT = 'contact',
  COMMENT = 'comment',
}

@Schema({ timestamps: true, versionKey: false })
export class Lead {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true, index: true })
  email: string;

  @Prop({ default: '', trim: true })
  phone?: string;

  @Prop({
    type: String,
    enum: Object.values(LeadSource),
    required: true,
    index: true,
  })
  source: LeadSource;

  @Prop({ default: 'general' })
  subject?: string;

  @Prop({ default: '' })
  message?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Blog' })
  blogId?: Types.ObjectId;

  @Prop({ default: true })
  consent: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

LeadSchema.index({ source: 1, createdAt: -1 });
LeadSchema.index({ createdAt: -1 });
