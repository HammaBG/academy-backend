import { z } from "zod";

export interface ICoursePrice {
  courseId: string;
  price: number;
}

export interface IEnrollmentCode {
  id?: string;
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
  courses: z.array(z.string().uuid('Invalid Course ID')).min(1, 'At least one course is required'),
  usageLimit: z.number().int().min(1).default(1),
});

export const updateEnrollmentCodeSchema = z.object({
  active: z.boolean().optional(),
  usageLimit: z.number().int().min(1).optional(),
});
