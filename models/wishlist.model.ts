import mongoose, { Schema } from "mongoose";
import { z } from "zod";

export const toggleWishlistSchema = z.object({
  courseId: z.string()
});

export type ToggleWishlistInput = z.infer<typeof toggleWishlistSchema>;

const WishlistSchema = new Schema({
  user_id: { type: String, required: true },
  course_id: { type: String, required: true }
}, {
  timestamps: true
});

WishlistSchema.index({ user_id: 1, course_id: 1 }, { unique: true });

export const Wishlist = mongoose.models.Wishlist || mongoose.model("Wishlist", WishlistSchema);
