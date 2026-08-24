import { Response, NextFunction } from "express";
import { CatchAsyncError } from "../utils/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { toggleWishlistSchema, Wishlist as WishlistModel } from "../models/wishlist.model";
import { Course as CourseModel } from "../models/course.model";
import { User as UserModel } from "../models/user.model";

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
      const existing = await WishlistModel.findOne({ user_id: userId, course_id: courseId });

      if (existing) {
        // Remove from wishlist
        await WishlistModel.findByIdAndDelete(existing._id);

        res.status(200).json({
          success: true,
          message: "Removed from wishlist",
          isFavorited: false
        });
      } else {
        // Add to wishlist
        const newItem = new WishlistModel({
          user_id: userId,
          course_id: courseId
        });
        await newItem.save();

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

      const wishlistItems = await WishlistModel.find({ user_id: userId });

      if (!wishlistItems || wishlistItems.length === 0) {
        return res.status(200).json({
          success: true,
          courses: []
        });
      }

      const courseIds = wishlistItems.map(item => item.course_id);

      const dbCourses = await CourseModel.find({ _id: { $in: courseIds } });

      const courses = await Promise.all(dbCourses.map(async (course) => {
        const doc = course.toObject();
        doc.id = doc._id.toString();

        if (doc.creator && typeof doc.creator === 'string') {
          const userData = await UserModel.findById(doc.creator);
          if (userData) {
            doc.creator = {
              id: userData._id.toString(),
              first_name: userData.first_name || '',
              last_name: userData.last_name || '',
              avatar_url: userData.avatar_url || ''
            };
          } else {
            doc.creator = { first_name: "Academy", last_name: "Instructor", avatar_url: '' };
          }
        }
        
        return doc;
      }));

      res.status(200).json({
        success: true,
        courses
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
