import { z } from 'zod';

export interface Category {
  id: string;
  name: string;
  created_at?: string;
}

// Validation schemas with Zod
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export const updateCategorySchema = createCategorySchema.partial();

// Types derived from schemas
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
