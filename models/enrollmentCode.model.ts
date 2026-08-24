import mongoose, { Schema } from "mongoose";
import { z } from "zod";

export interface ICoursePrice {
  courseId: string;
  price: number;
}

export interface IEnrollmentCode {
  id?: string;
  _id?: string;
  name: string;
  courses: string[];
  coursePrices: ICoursePrice[];
  usageLimit: number;
  usedBy: string[];
  used: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const createEnrollmentCodeSchema = z.object({
  name: z.string().min(1, 'Name is required').trim().toUpperCase(),
  courses: z.array(z.string()).min(1, 'At least one course is required'),
  usageLimit: z.number().int().min(1).default(1),
});

export const updateEnrollmentCodeSchema = z.object({
  active: z.boolean().optional(),
  usageLimit: z.number().int().min(1).optional(),
});

const CoursePriceSchema = new Schema({
  courseId: { type: String, required: true },
  price: { type: Number, required: true }
});

const EnrollmentCodeSchema = new Schema({
  name: { type: String, required: true, unique: true },
  courses: { type: [String], default: [] },
  coursePrices: { type: [CoursePriceSchema], default: [] },
  usageLimit: { type: Number, default: 1 },
  usedBy: { type: [String], default: [] },
  used: { type: Boolean, default: false },
  active: { type: Boolean, default: true }
}, {
  timestamps: true
});

export const EnrollmentCode = mongoose.models.EnrollmentCode || mongoose.model("EnrollmentCode", EnrollmentCodeSchema);
