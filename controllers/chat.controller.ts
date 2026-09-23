import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from '../utils/catchAsyncErrors';
import ErrorHandler from '../utils/ErrorHandler';
import { ChatMessage } from '../models/chat.model';
import { Course as CourseModel } from '../models/course.model';
import { User as UserModel } from '../models/user.model';

// Fetch recent messages for a course (last 100 messages)
export const getCourseMessages = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId } = req.params;
      const user = (req as any).user;

      if (!courseId) {
        return next(new ErrorHandler('Course ID is required', 400));
      }

      let course = null;
      if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
        course = await CourseModel.findById(courseId);
      }
      if (!course) {
        course = await CourseModel.findOne({ url: courseId });
      }
      if (!course) {
        return next(new ErrorHandler('Course not found', 404));
      }

      const canonicalCourseId = course._id.toString();

      // Check authorization
      const role = user.role || user.user_metadata?.role;
      const isInstructor = role === 'admin' || (role === 'instructor' && String(course.creator) === String(user.id)) || (String(course.creator) === String(user.id));
      const dbUser = await UserModel.findById(user.id);
      const isEnrolled = dbUser?.courses?.includes(canonicalCourseId) || dbUser?.courses?.includes(courseId);

      if (!isInstructor && !isEnrolled) {
        return next(new ErrorHandler('You are not authorized to view this course chat', 403));
      }

      const limit = parseInt(req.query.limit as string, 10) || 100;
      const messages = await ChatMessage.find({
        $or: [{ courseId: canonicalCourseId }, { courseId }]
      })
        .sort({ createdAt: 1 })
        .limit(limit);

      const formatted = messages.map((m: any) => ({
        id: m._id.toString(),
        courseId: m.courseId,
        sender: m.sender,
        message: m.message,
        createdAt: m.createdAt.toISOString(),
      }));

      res.status(200).json({
        success: true,
        messages: formatted,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Delete message (Owner or Instructor or Admin)
export const deleteCourseMessage = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, messageId } = req.params;
      const user = (req as any).user;

      const message = await ChatMessage.findById(messageId);
      if (!message) {
        return next(new ErrorHandler('Message not found', 404));
      }

      const course = await CourseModel.findById(courseId);
      const role = user.role || user.user_metadata?.role;
      const isInstructor = role === 'admin' || (course && String(course.creator) === String(user.id));
      const isOwner = message.sender.id === user.id;

      if (!isInstructor && !isOwner) {
        return next(new ErrorHandler('You do not have permission to delete this message', 403));
      }

      await ChatMessage.findByIdAndDelete(messageId);

      res.status(200).json({
        success: true,
        message: 'Message deleted successfully',
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
