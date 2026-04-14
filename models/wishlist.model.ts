import { z } from "zod";

export const toggleWishlistSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
});

export type ToggleWishlistInput = z.infer<typeof toggleWishlistSchema>;
