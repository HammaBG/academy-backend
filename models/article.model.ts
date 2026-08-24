import mongoose, { Schema } from 'mongoose';
import { z } from 'zod';

export interface Article {
  id?: string;
  _id?: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  excerpt?: string;
  image_url?: string;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  created_at?: string;
}

export const createArticleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  status: z.enum(['draft', 'published']).default('draft'),
  excerpt: z.string().optional(),
  category_id: z.string().optional(),
  category_name: z.string().optional(),
  category_color: z.string().optional(),
});

export const updateArticleSchema = createArticleSchema.partial();

const ArticleSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  excerpt: { type: String, default: '' },
  image_url: { type: String, default: '' },
  category_id: { type: String, default: '' },
  category_name: { type: String, default: '' },
  category_color: { type: String, default: '' }
}, {
  timestamps: true
});

export const Article = mongoose.models.Article || mongoose.model('Article', ArticleSchema);
