import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage extends Document {
  courseId: string;
  sender: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    role: string;
  };
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema: Schema = new Schema(
  {
    courseId: {
      type: String,
      required: true,
      index: true,
    },
    sender: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      email: { type: String },
      avatar: { type: String, default: '' },
      role: { type: String, enum: ['user', 'instructor', 'admin'], default: 'user' },
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
);

ChatMessageSchema.index({ courseId: 1, createdAt: -1 });

export const ChatMessage =
  mongoose.models.ChatMessage || mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
