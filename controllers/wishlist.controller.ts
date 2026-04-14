import { Response, NextFunction } from "express";
import { CatchAsyncError } from "../utils/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { toggleWishlistSchema } from "../models/wishlist.model";

// Toggle course in wishlist
export const toggleWishlist = CatchAsyncError(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = toggleWishlistSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ErrorHandler(JSON.stringify(parsed.error.format()), 400));
      }

      const { courseId } = parsed.data;
      const userId = req.user?.id;

      if (!userId) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Check if already in wishlist
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('wishlist')
        .select('id')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .maybeSingle();

      if (fetchError) {
        return next(new ErrorHandler(fetchError.message, 400));
      }

      if (existing) {
        // Remove from wishlist
        const { error: deleteError } = await supabaseAdmin
          .from('wishlist')
          .delete()
          .eq('id', existing.id);

        if (deleteError) {
          return next(new ErrorHandler(deleteError.message, 400));
        }

        res.status(200).json({
          success: true,
          message: "Removed from wishlist",
          isFavorited: false
        });
      } else {
        // Add to wishlist
        const { error: insertError } = await supabaseAdmin
          .from('wishlist')
          .insert({
            user_id: userId,
            course_id: courseId
          });

        if (insertError) {
          return next(new ErrorHandler(insertError.message, 400));
        }

        res.status(200).json({
          success: true,
          message: "Added to wishlist",
          isFavorited: true
        });
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Get user's wishlist
export const getMyWishlist = CatchAsyncError(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Fetch wishlist with course details
      // Note: We use .select('*, courses(*)') to get the joined course data
      const { data: wishlistItems, error } = await supabaseAdmin
        .from('wishlist')
        .select(`
          id,
          created_at,
          course:courses (
            id,
            name,
            description,
            short_description,
            price,
            estimated_price,
            thumbnail,
            ratings,
            purchased,
            level,
            categories,
            ready,
            status,
            creator
          )
        `)
        .eq('user_id', userId);

      if (error) {
        return next(new ErrorHandler(error.message, 400));
      }

      // Format and hydrate creator info if needed (similar to course.controller.ts)
      const courses = await Promise.all((wishlistItems || [])
        .filter(item => item.course) // filter out null courses if any
        .map(async (item: any) => {
          const course = item.course;
          
          if (course.creator && typeof course.creator === 'string') {
            const { data: userData } = await supabaseAdmin
              .from('users')
              .select('id, first_name, last_name, avatar_url')
              .eq('id', course.creator)
              .maybeSingle();
            
            course.creator = userData || { first_name: "Academy", last_name: "Instructor" };
          }
          
          return course;
        })
      );

      res.status(200).json({
        success: true,
        courses
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
