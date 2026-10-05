import mongoose, { Schema, Document } from "mongoose";
import { z } from "zod";

export interface IPreRegistration extends Document {
  courseId: mongoose.Types.ObjectId | string;
  courseName: string;
  userId?: mongoose.Types.ObjectId | string;
  fullName: string;
  email: string;
  phoneNumber: string;
  status: "pending" | "notified" | "converted";
  notifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const createPreRegistrationSchema = z.object({
  courseId: z.string().min(1, "Course ID is required"),
  courseName: z.string().min(1, "Course name is required"),
  fullName: z.string().min(1, "Full name is required").max(100),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().min(1, "Phone number is required").refine((val) => {
    const digitsCount = (val.match(/\d/g) || []).length;
    return digitsCount >= 8;
  }, {
    message: "Phone number must contain at least 8 digits",
  }),
});

const PreRegistrationSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    courseName: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phoneNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "notified", "converted"],
      default: "pending",
    },
    notifiedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

PreRegistrationSchema.index({ courseId: 1, email: 1 }, { unique: true });

export const PreRegistration =
  mongoose.models.PreRegistration ||
  mongoose.model<IPreRegistration>("PreRegistration", PreRegistrationSchema);
