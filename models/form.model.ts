import mongoose, { Schema } from "mongoose";
import { z } from "zod";

export interface INote {
  text: string;
  createdAt?: string;
}

export interface IForm {
  id?: string;
  _id?: string;
  fullName: string;
  address: string;
  phoneNumber: string;
  email?: string;
  courseName: string;
  coursePrice: number;
  courseId: string;
  status:
    | 'pending'
    | 'contacted'
    | 'completed'
    | 'not-interested'
    | 'not-available'
    | 'callback'
    | 'delivered'
    | 'not-delivered';
  notes?: INote[];
  createdAt?: string;
  updatedAt?: string;
}

export const createFormSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100, 'Full name cannot exceed 100 characters'),
  address: z.string().min(1, 'Address is required').max(200, 'Address cannot exceed 200 characters'),
  phoneNumber: z.string().min(1, 'Phone number is required').refine((val) => {
    const digitsCount = (val.match(/\d/g) || []).length;
    return digitsCount >= 8;
  }, {
    message: 'Phone number must contain at least 8 digits',
  }),
  email: z.string().email('Please enter a valid email').or(z.literal("")).optional().default(""),
  courseName: z.string().min(1, 'Course name is required').max(200, 'Course name cannot exceed 200 characters'),
  coursePrice: z.number().min(0, 'Course price cannot be negative'),
  courseId: z.string().min(1, 'Course ID is required'),
});

export const updateFormSchema = z.object({
  status: z.enum([
    'pending',
    'contacted',
    'completed',
    'not-interested',
    'not-available',
    'callback',
    'delivered',
    'not-delivered'
  ]).optional(),
  fullName: z.string().max(100).optional(),
  address: z.string().max(200).optional(),
  phoneNumber: z.string().refine((val) => {
    const digitsCount = (val.match(/\d/g) || []).length;
    return digitsCount >= 8;
  }, {
    message: 'Phone number must contain at least 8 digits',
  }).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  courseName: z.string().max(200).optional(),
  coursePrice: z.number().min(0).optional(),
  courseId: z.string().optional(),
});

const NoteSchema = new Schema({
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const FormSchema = new Schema({
  fullName: { type: String, required: true },
  address: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  email: { type: String, default: "" },
  courseName: { type: String, required: true },
  coursePrice: { type: Number, required: true },
  courseId: { type: String, required: true },
  status: {
    type: String,
    enum: [
      'pending',
      'contacted',
      'completed',
      'not-interested',
      'not-available',
      'callback',
      'delivered',
      'not-delivered'
    ],
    default: 'pending'
  },
  notes: { type: [NoteSchema], default: [] }
}, {
  timestamps: true
});

export const Form = mongoose.models.Form || mongoose.model("Form", FormSchema);
