import mongoose, { Schema } from 'mongoose';
import { z } from 'zod';

export interface Category {
  id?: string;
  _id?: string;
  name: string;
  color?: string;
  description?: string;
}

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  color: z.string().optional(),
  description: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

const CategorySchema = new Schema({
  name: { type: String, required: true, unique: true },
  color: { type: String, default: '#F95353' },
  description: { type: String, default: '' }
}, {
  timestamps: true
});

export const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
