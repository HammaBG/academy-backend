import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  recipientId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  courseName?: string;
  sender?: {
    id: string;
    name: string;
    role: string;
    roleLabel?: string;
    avatar?: string;
  };
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: 'system', index: true },
    link: { type: String, default: '' },
    courseName: { type: String, default: '' },
    sender: {
      id: { type: String, default: '' },
      name: { type: String, default: '' },
      role: { type: String, default: 'user' },
      roleLabel: { type: String, default: '' },
      avatar: { type: String, default: '' },
    },
    isRead: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
