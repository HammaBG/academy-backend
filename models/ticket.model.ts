import mongoose, { Schema, Document } from "mongoose";
import { z } from "zod";

export interface ITicketReply {
  _id?: string;
  senderId: string;
  senderName: string;
  senderRole: "user" | "admin" | "instructor";
  message: string;
  createdAt: Date;
}

export interface ITicket extends Document {
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  subject: string;
  category: string;
  currentLevel: "single_or_engaged" | "married" | "parent" | "other" | "beginner" | "intermediate" | "advanced";
  goalOrIssue: string;
  preferredTime?: string;
  status: "pending" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  adminNotes?: string;
  replies: ITicketReply[];
  createdAt: Date;
  updatedAt: Date;
}

export const createTicketSchema = z.object({
  subject: z.string().min(3, "عنوان التذكرة يجب أن يكون 3 أحرف على الأقل").max(150, "العنوان طويل جداً"),
  category: z.string().min(2, "يرجى اختيار مجال الاستشارة"),
  currentLevel: z.string().default("single_or_engaged"),
  goalOrIssue: z.string().min(10, "يرجى كتابة تفاصيل مشكلتك أو هدفك (10 أحرف على الأقل)").max(2000),
  preferredTime: z.string().optional().default(""),
  userPhone: z.string().optional().default(""),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  adminNotes: z.string().max(1000).optional(),
});

const TicketReplySchema = new Schema<ITicketReply>(
  {
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, enum: ["user", "admin", "instructor"], default: "admin" },
    message: { type: String, required: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const TicketSchema = new Schema<ITicket>(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    userPhone: { type: String, default: "" },
    subject: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    currentLevel: {
      type: String,
      default: "single_or_engaged",
    },
    goalOrIssue: { type: String, required: true, trim: true },
    preferredTime: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "in_progress", "resolved", "closed"],
      default: "pending",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    adminNotes: { type: String, default: "" },
    replies: [TicketReplySchema],
  },
  {
    timestamps: true,
  }
);

TicketSchema.index({ createdAt: -1 });

export const Ticket = mongoose.models.Ticket || mongoose.model<ITicket>("Ticket", TicketSchema);
