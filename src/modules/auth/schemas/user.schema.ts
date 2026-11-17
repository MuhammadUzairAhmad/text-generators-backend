import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true, versionKey: false })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ type: String, enum: ['super_admin', 'admin'], default: 'super_admin' })
  role: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({
    type: {
      publicId: { type: String },
      url: { type: String, required: true },
    },
    default: null,
  })
  avatar?: {
    publicId?: string;
    url: string;
  } | null;

  @Prop()
  lastLoginAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
