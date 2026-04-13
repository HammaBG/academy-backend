import { z } from 'zod';

export interface Article {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  excerpt?: string;
  image_url?: string;
  created_at?: string;
}

// Validation schemas with Zod
export const createArticleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  status: z.enum(['draft', 'published']).default('draft'),
  excerpt: z.string().optional(),
});

export const updateArticleSchema = createArticleSchema.partial();

// Types derived from schemas for better integration
export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
