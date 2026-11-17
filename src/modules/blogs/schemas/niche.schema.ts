import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NicheDocument = Niche & Document;

@Schema({ timestamps: true, versionKey: false })
export class Niche {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true, index: true })
  slug: string;

  @Prop({ default: 0, index: true })
  order: number;

  @Prop({ default: true, index: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const NicheSchema = SchemaFactory.createForClass(Niche);
