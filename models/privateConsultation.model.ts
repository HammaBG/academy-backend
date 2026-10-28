import mongoose, { Schema, Document } from "mongoose";

export interface IConsultationMessage {
  _id?: string;
  senderId: string;
  senderName: string;
  senderRole: "user" | "instructor" | "admin";
  senderAvatar?: string;
  message: string;
  createdAt: Date;
}

export interface IPrivateConsultation extends Document {
  courseId: string;
  courseName: string;
  instructorId: string;
  instructorName?: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentAvatar?: string;
  lessonTitle?: string;
  sectionId?: string;
  subject: string;
  messages: IConsultationMessage[];
  status: "open" | "answered" | "closed";
  lastMessageAt: Date;
  unreadByStudent: number;
  unreadByInstructor: number;
  createdAt: Date;
  updatedAt: Date;
}

const ConsultationMessageSchema = new Schema<IConsultationMessage>(
  {
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, enum: ["user", "instructor", "admin"], required: true },
    senderAvatar: { type: String, default: "" },
    message: { type: String, required: true, maxlength: 3000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const PrivateConsultationSchema = new Schema<IPrivateConsultation>(
  {
    courseId: { type: String, required: true, index: true },
    courseName: { type: String, required: true },
    instructorId: { type: String, required: true, index: true },
    instructorName: { type: String, default: "" },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, required: true },
    studentEmail: { type: String, required: true },
    studentAvatar: { type: String, default: "" },
    lessonTitle: { type: String, default: "" },
    sectionId: { type: String, default: "" },
    subject: { type: String, required: true, trim: true },
    messages: [ConsultationMessageSchema],
    status: {
      type: String,
      enum: ["open", "answered", "closed"],
      default: "open",
      index: true,
    },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    unreadByStudent: { type: Number, default: 0 },
    unreadByInstructor: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

PrivateConsultationSchema.index({ courseId: 1, studentId: 1 });
PrivateConsultationSchema.index({ instructorId: 1, lastMessageAt: -1 });

export const PrivateConsultation =
  mongoose.models.PrivateConsultation ||
  mongoose.model<IPrivateConsultation>("PrivateConsultation", PrivateConsultationSchema);
