import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../utils/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { cloudinary } from "../config/cloudinary";
import { createCourse, getAllCoursesService } from "../services/course.service";
import { supabaseAdmin } from "../config/supabase";
import { redis } from "../config/redis";
import axios from "axios";
import { createCourseSchema, updateCourseSchema } from "../models/course.model";

// upload course
export const uploadCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let data = req.body;
      console.log("Incoming Course Data:", data);

      const parsed = createCourseSchema.safeParse(data);
      if (!parsed.success) {
        return next(new ErrorHandler(JSON.stringify(parsed.error.format()), 400));
      }

      const thumbnail = data.thumbnail;

      // Handle thumbnail upload if it's a base64 string
      if (thumbnail && typeof thumbnail === 'string' && thumbnail.startsWith('data:')) {
        const myCloud = await cloudinary.uploader.upload(thumbnail, {
          folder: "courses",
        });
        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }

      data.creator = (req as any).user?.id;

      createCourse(data, res, next);
    } catch (error: any) {
      console.log(error.message);
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// edit course
export const editCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let data = req.body;
      const courseId = req.params.id;

      const { data: courseData, error: fetchError } = await supabaseAdmin
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (fetchError || !courseData) {
        return next(new ErrorHandler('Course not found', 404));
      }

      const thumbnail = data.thumbnail;

      if (thumbnail && typeof thumbnail === 'string' && thumbnail.startsWith('data:')) {
        if (courseData.thumbnail?.public_id) {
          await cloudinary.uploader.destroy(courseData.thumbnail.public_id);
        }

        const myCloud = await cloudinary.uploader.upload(thumbnail, {
          folder: "courses",
        });

        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }

      const parsed = updateCourseSchema.safeParse(data);
      if (!parsed.success) {
        return next(new ErrorHandler(JSON.stringify(parsed.error.format()), 400));
      }

      const { data: updatedCourse, error: updateError } = await supabaseAdmin
        .from('courses')
        .update(data)
        .eq('id', courseId)
        .select()
        .single();

      if (updateError) {
        return next(new ErrorHandler(updateError.message, 400));
      }

      // Update Redis
      const redisKey = `course:${courseId}`;
      await redis.set(redisKey, JSON.stringify(updatedCourse));

      res.status(200).json({
        success: true,
        course: updatedCourse,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// get single course --- without purchasing
export const getSingleCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;
      console.log(`[DEBUG] Attempting to fetch course: ${courseId}`);

      // Try Redis first
      const cachedCourse = await redis.get(`course:${courseId}`);
      if (cachedCourse) {
        return res.status(200).json({
          success: true,
          course: JSON.parse(cachedCourse),
        });
      }

      let { data: course, error } = await supabaseAdmin
        .from('courses')
        .select('*')
        .eq('url', courseId)
        .maybeSingle();

      if (error) {
        console.error("[DEBUG] Supabase error (URL):", error);
      }

      if (error || !course) {
        console.log("[DEBUG] Not found by URL, trying ID...");
        const { data: courseById, error: errorId } = await supabaseAdmin
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .maybeSingle();

        if (errorId) {
          console.error("[DEBUG] Supabase error (ID):", errorId);
        }

        if (!courseById) {
          console.warn(`[DEBUG] Course not found for ID: ${courseId}`);
          return next(new ErrorHandler('Course not found', 404));
        }

        course = courseById;
      }

      // Manually fetch creator info since foreign key relation is missing/misnamed in DB
      if (course && course.creator && typeof course.creator === 'string') {
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('id, first_name, last_name, avatar_url')
          .eq('id', course.creator)
          .maybeSingle();
        
        if (userData) {
          course.creator = userData;
        } else {
           course.creator = { first_name: "Academy", last_name: "Instructor" };
        }
      }

      await redis.set(`course:${courseId}`, JSON.stringify(course), "EX", 604800); // 7days

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// get all courses --- without purchasing
export const getAllCourses = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data: courses, error } = await supabaseAdmin
        .from('courses')
        .select('id, name, description, short_description, price, estimated_price, thumbnail, ratings, purchased, level, categories, ready, status, creator')
        .eq('status', true)
        .order('ready', { ascending: true });

      if (error) {
        return next(new ErrorHandler(error.message, 400));
      }

      // Hydrate creator data for each course
      const hydratedCourses = await Promise.all((courses || []).map(async (course) => {
        if (course.creator && typeof course.creator === 'string') {
          const { data: userData } = await supabaseAdmin
            .from('users')
            .select('id, first_name, last_name, avatar_url')
            .eq('id', course.creator)
            .maybeSingle();
          
          return {
            ...course,
            creator: userData || { first_name: "Academy", last_name: "Instructor" }
          };
        }
        return course;
      }));

      res.status(200).json({
        success: true,
        courses: hydratedCourses,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// get course content -- only for valid user
export const getCourseByUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const courseId = req.params.id;

      const { data: course, error } = await supabaseAdmin
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (error || !course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const role = user.user_metadata?.role;
      const userId = user.id;

      if (role === "admin") {
        return res.status(200).json({
          success: true,
          course,
        });
      }

      // Check enrollment (this logic depends on your user/enrollment schema in Supabase)
      // Assuming a table 'enrollments' exists
      const { data: enrollment, error: enrollError } = await supabaseAdmin
        .from('enrollments')
        .select('*')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .single();

      if (enrollError || !enrollment) {
        // Also check if teacher owns it
        if (role === "instructor" && course.creator === userId) {
          return res.status(200).json({
            success: true,
            course,
          });
        }
        return next(new ErrorHandler("You are not eligible to access this course", 403));
      }

      return res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// add question in course
export const addQuestion = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, courseId, contentId } = req.body;
      const user = (req as any).user;

      const { data: course, error: fetchError } = await supabaseAdmin
        .from('courses')
        .select('course_data')
        .eq('id', courseId)
        .single();

      if (fetchError || !course) {
        return next(new ErrorHandler('Course not found', 404));
      }

      const courseData = course.course_data || [];
      const contentIndex = courseData.findIndex((item: any) => item.id === contentId || item._id === contentId);

      if (contentIndex === -1) {
        return next(new ErrorHandler("Invalid content id", 400));
      }

      const newQuestion = {
        user: {
          id: user.id,
          name: user.user_metadata?.first_name + " " + user.user_metadata?.last_name,
          avatar: user.user_metadata?.avatar_url
        },
        question,
        question_replies: [],
        created_at: new Date().toISOString()
      };

      courseData[contentIndex].questions = courseData[contentIndex].questions || [];
      courseData[contentIndex].questions.push(newQuestion);

      const { error: updateError } = await supabaseAdmin
        .from('courses')
        .update({ course_data: courseData })
        .eq('id', courseId);

      if (updateError) {
        return next(new ErrorHandler(updateError.message, 400));
      }

      res.status(200).json({
        success: true,
        course: { ...course, course_data: courseData },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// add answer in course question
export const addAnswer = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answer, courseId, contentId, questionId } = req.body;
      const user = (req as any).user;

      const { data: course, error: fetchError } = await supabaseAdmin
        .from('courses')
        .select('course_data')
        .eq('id', courseId)
        .single();

      if (fetchError || !course) {
        return next(new ErrorHandler('Course not found', 404));
      }

      const courseData = course.course_data || [];
      const contentIndex = courseData.findIndex((item: any) => item.id === contentId || item._id === contentId);

      if (contentIndex === -1) {
        return next(new ErrorHandler("Invalid content id", 400));
      }

      const questions = courseData[contentIndex].questions || [];
      const questionIndex = questions.findIndex((item: any) => item.id === questionId || item._id === questionId);

      if (questionIndex === -1) {
        return next(new ErrorHandler("Invalid question id", 400));
      }

      const newAnswer = {
        user: {
          id: user.id,
          name: user.user_metadata?.first_name + " " + user.user_metadata?.last_name,
          avatar: user.user_metadata?.avatar_url
        },
        answer,
        created_at: new Date().toISOString(),
      };

      questions[questionIndex].question_replies = questions[questionIndex].question_replies || [];
      questions[questionIndex].question_replies.push(newAnswer);

      const { error: updateError } = await supabaseAdmin
        .from('courses')
        .update({ course_data: courseData })
        .eq('id', courseId);

      if (updateError) {
        return next(new ErrorHandler(updateError.message, 400));
      }

      res.status(200).json({
        success: true,
        course: { ...course, course_data: courseData },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// add review in course
export const addReview = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const courseId = req.params.id;
      const { review, rating } = req.body;

      // Check enrollment
      const { data: enrollment, error: enrollError } = await supabaseAdmin
        .from('enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single();

      if (enrollError || !enrollment) {
        return next(new ErrorHandler("You are not eligible to access this course", 403));
      }

      const { data: course, error: fetchError } = await supabaseAdmin
        .from('courses')
        .select('reviews, ratings')
        .eq('id', courseId)
        .single();

      if (fetchError || !course) {
        return next(new ErrorHandler('Course not found', 404));
      }

      const reviews = course.reviews || [];
      const reviewData = {
        user: {
          id: user.id,
          name: user.user_metadata?.first_name + " " + user.user_metadata?.last_name,
          avatar: user.user_metadata?.avatar_url
        },
        rating,
        comment: review,
        created_at: new Date().toISOString()
      };

      reviews.push(reviewData);

      let avg = 0;
      reviews.forEach((rev: any) => {
        avg += rev.rating;
      });

      const ratings = avg / reviews.length;

      const { error: updateError } = await supabaseAdmin
        .from('courses')
        .update({ reviews, ratings })
        .eq('id', courseId);

      if (updateError) {
        return next(new ErrorHandler(updateError.message, 400));
      }

      await redis.set(`course:${courseId}`, JSON.stringify({ ...course, reviews, ratings }), "EX", 604800);

      res.status(200).json({
        success: true,
        course: { ...course, reviews, ratings },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// get all courses --- only for admin
export const getAdminAllCourses = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllCoursesService(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Delete Course --- only for admin
export const deleteCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const { error } = await supabaseAdmin
        .from('courses')
        .delete()
        .eq('id', id);

      if (error) {
        return next(new ErrorHandler("Course not found or failed to delete", 404));
      }

      await redis.del(`course:${id}`);

      res.status(200).json({
        success: true,
        message: "Course deleted successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// generate video url (using VdoCipher if configured)
export const generateVideoUrl = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { videoId } = req.body;
      const secret = process.env.VDOCIPHER_API_SECRET;

      if (!secret) {
        return next(new ErrorHandler("VdoCipher API secret not configured", 500));
      }

      const response = await axios.post(
        `https://dev.vdocipher.com/api/videos/${videoId}/otp`,
        { ttl: 300 },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Apisecret ${secret}`,
          },
        }
      );
      res.json(response.data);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);
