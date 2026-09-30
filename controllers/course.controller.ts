import { mux } from '../config/mux';
import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../utils/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { cloudinary } from "../config/cloudinary";
import { createCourse, getAllCoursesService } from "../services/course.service";
import { redis } from "../config/redis";
import axios from "axios";
import { createCourseSchema, updateCourseSchema, Course } from "../models/course.model";
import { User as UserModel } from "../models/user.model";
import { Category as CategoryModel } from "../models/category.model";

// Helper to generate URL-safe slugs from title/name (supports English, numbers, and Arabic characters)
export const slugifyCourseName = (name: string): string => {
  if (!name) return "";
  return name
    .toString()
    .trim()
    .toLowerCase()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, "-")
    // Keep letters, Arabic characters (\u0600-\u06FF), numbers, and hyphens
    .replace(/[^\w\u0600-\u06FF\-]+/g, "")
    // Replace multiple consecutive hyphens with a single one
    .replace(/\-\-+/g, "-")
    // Trim hyphens from beginning and end
    .replace(/^-+/, "")
    .replace(/-+$/, "");
};

// Helper to fetch instructor data from users table OR Supabase Auth metadata
const fetchInstructorData = async (userId: string) => {
  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return { id: userId, first_name: "Academy", last_name: "Instructor", title: "Senior Expert", avatar_url: "" };
    }
    return {
      id: user._id.toString(),
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_url: user.avatar_url,
      title: user.title || "Senior Expert"
    };
  } catch (err) {
    return { id: userId, first_name: "Academy", last_name: "Instructor", title: "Senior Expert", avatar_url: "" };
  }
};

// Helper to enrich courses with their matching category color dynamically and ensure URL slug exists
const enrichCoursesWithCategoryColor = async (courses: any[]): Promise<any[]> => {
  if (!courses || courses.length === 0) return courses;
  try {
    const categories = await CategoryModel.find({}, 'name color');
    const catColorMap = categories && categories.length > 0
      ? new Map(categories.map(c => [c.name.toLowerCase().trim(), c.color]))
      : new Map();

    return courses.map(course => {
      const doc = course.toObject ? course.toObject() : course;
      const catName = (doc.categories || '').toLowerCase().trim();
      const generatedSlug = doc.url && doc.url.trim() ? doc.url.trim() : slugifyCourseName(doc.name);

      return {
        ...doc,
        id: doc._id?.toString() || doc.id,
        url: generatedSlug,
        category_color: catColorMap.get(catName) || '#F95353'
      };
    });
  } catch (err) {
    console.error('Course category enrichment error:', err);
  }
  return courses.map(c => {
    const doc = c.toObject ? c.toObject() : c;
    const generatedSlug = doc.url && doc.url.trim() ? doc.url.trim() : slugifyCourseName(doc.name);
    return {
      ...doc,
      id: doc._id?.toString() || doc.id,
      url: generatedSlug,
      category_color: '#F95353'
    };
  });
};

// upload course
export const uploadCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let data = req.body;
      //console.log("Incoming Course Data:", data);

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

      // Auto-generate URL slug if not provided
      if (!data.url || !data.url.trim()) {
        const baseSlug = slugifyCourseName(data.name) || `course-${Date.now()}`;
        // Ensure slug uniqueness
        let uniqueSlug = baseSlug;
        let counter = 1;
        while (await Course.findOne({ url: uniqueSlug })) {
          uniqueSlug = `${baseSlug}-${counter++}`;
        }
        data.url = uniqueSlug;
      } else {
        data.url = slugifyCourseName(data.url);
      }

      // Hydrate creator for the immediate response
      const hydratedCreator = await fetchInstructorData(data.creator);

      const course = new Course(data);
      await course.save();

      const [enrichedCourse] = await enrichCoursesWithCategoryColor([course]);

      res.status(201).json({
        success: true,
        course: { ...enrichedCourse, creator: hydratedCreator },
      });
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

      const course = await Course.findById(courseId);
      if (!course) {
        return next(new ErrorHandler('Course not found', 404));
      }

      const previousUrl = course.url;

      const thumbnail = data.thumbnail;

      if (thumbnail && typeof thumbnail === 'string' && thumbnail.startsWith('data:')) {
        if (course.thumbnail?.public_id) {
          await cloudinary.uploader.destroy(course.thumbnail.public_id);
        }

        const myCloud = await cloudinary.uploader.upload(thumbnail, {
          folder: "courses",
        });

        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }

      if (data.url !== undefined) {
        if (data.url && data.url.trim()) {
          data.url = slugifyCourseName(data.url);
        } else if (data.name || course.name) {
          data.url = slugifyCourseName(data.name || course.name);
        }
      } else if (!course.url && (data.name || course.name)) {
        data.url = slugifyCourseName(data.name || course.name);
      }

      const parsed = updateCourseSchema.safeParse(data);
      if (!parsed.success) {
        return next(new ErrorHandler(JSON.stringify(parsed.error.format()), 400));
      }

      Object.assign(course, data);
      await course.save();

      // Update Redis for both ID and URLs
      const redisKeyById = `course:${courseId}`;
      await redis.set(redisKeyById, JSON.stringify(course));

      if (previousUrl) {
        await redis.del(`course:${previousUrl}`);
      }
      if (course.url) {
        await redis.del(`course:${course.url}`);
      }

      // Hydrate for immediate response
      const hydratedCreator = await fetchInstructorData(course.creator);

      const [enrichedCourse] = await enrichCoursesWithCategoryColor([course]);

      res.status(200).json({
        success: true,
        course: { ...enrichedCourse, creator: hydratedCreator },
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

      const cachedCourse = await redis.get(`course:${courseId}`);
      if (cachedCourse) {
        const parsed = JSON.parse(cachedCourse);
        if (parsed && (!parsed.url || !parsed.url.trim())) {
          parsed.url = slugifyCourseName(parsed.name);
          await redis.set(`course:${courseId}`, JSON.stringify(parsed), "EX", 604800);
        }
        return res.status(200).json({
          success: true,
          course: parsed,
        });
      }

      // 1. Try finding by URL
      let course = await Course.findOne({ url: courseId });

      // 2. Try finding by MongoDB ID
      if (!course && courseId.match(/^[0-9a-fA-F]{24}$/)) {
        course = await Course.findById(courseId);
      }

      // 3. Fallback: if course has an empty/unpopulated url or matching slug name, look up courses and match slugify(name)
      if (!course) {
        const allCourses = await Course.find();
        course = allCourses.find((c: any) => {
          const s = slugifyCourseName(c.url || c.name);
          return s === courseId || c.url === courseId;
        }) || null;

        // Auto-save the resolved slug into the course if it was missing
        if (course && (!course.url || !course.url.trim())) {
          course.url = slugifyCourseName(course.name) || courseId;
          await course.save();
        }
      }

      if (!course) {
        return next(new ErrorHandler('Course not found', 404));
      }

      // If course is found by ID and has empty url, ensure url is set
      if (!course.url || !course.url.trim()) {
        course.url = slugifyCourseName(course.name);
        await course.save();
      }

      let enrichedCreator = null;
      if (course.creator && typeof course.creator === 'string') {
        enrichedCreator = await fetchInstructorData(course.creator);
      }

      const [enrichedCourse] = await enrichCoursesWithCategoryColor([course]);
      if (enrichedCreator) {
        enrichedCourse.creator = enrichedCreator;
      }

      await redis.set(`course:${courseId}`, JSON.stringify(enrichedCourse), "EX", 604800);

      res.status(200).json({
        success: true,
        course: enrichedCourse,
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
      const courses = await Course.find({ status: true }).sort({ ready: 1 });

      const hydratedCourses = await Promise.all((courses || []).map(async (course) => {
        if (course.creator && typeof course.creator === 'string') {
          const doc = course.toObject();
          return {
            ...doc,
            id: doc._id.toString(),
            creator: await fetchInstructorData(course.creator)
          };
        }
        const doc = course.toObject();
        return { ...doc, id: doc._id.toString() };
      }));

      const enrichedCourses = await enrichCoursesWithCategoryColor(hydratedCourses);

      res.status(200).json({
        success: true,
        courses: enrichedCourses,
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
      const courseIdParam = req.params.id;

      // Find course by URL (slug) or by MongoDB ObjectId
      let course = await Course.findOne({ url: courseIdParam });
      if (!course && courseIdParam.match(/^[0-9a-fA-F]{24}$/)) {
        course = await Course.findById(courseIdParam);
      }
      if (!course) {
        const allCourses = await Course.find();
        course = allCourses.find((c: any) => {
          const s = slugifyCourseName(c.url || c.name);
          return s === courseIdParam || c.url === courseIdParam;
        }) || null;
      }

      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const canonicalCourseId = course._id.toString();
      const role = user.role || user.user_metadata?.role;
      const userId = user.id;

      if (role === "admin") {
        const enrichedCourse = { ...course.toObject(), id: canonicalCourseId };
        return res.status(200).json({
          success: true,
          course: enrichedCourse,
        });
      }

      const dbUser = await UserModel.findById(userId);
      if (!dbUser) {
        return next(new ErrorHandler("User not found", 404));
      }

      const isEnrolled = dbUser.courses.includes(canonicalCourseId) || dbUser.courses.includes(courseIdParam);

      if (!isEnrolled) {
        if (role === "instructor" && String(course.creator) === String(userId)) {
          const enrichedCourse = { ...course.toObject(), id: canonicalCourseId };
          return res.status(200).json({
            success: true,
            course: enrichedCourse,
          });
        }
        return next(new ErrorHandler("You are not eligible to access this course", 403));
      }

      const progressRecord = dbUser.coursesProgress.find((p: any) => p.courseId === canonicalCourseId || p.courseId === courseIdParam) || { progress: 0, completedVideos: [] };

      const enrichedCourse = {
        ...course.toObject(),
        id: canonicalCourseId,
        completedVideos: progressRecord.completedVideos,
        progress: progressRecord.progress
      };
      return res.status(200).json({
        success: true,
        course: enrichedCourse,
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

      const course = await Course.findById(courseId);
      if (!course) {
        return next(new ErrorHandler('Course not found', 404));
      }

      const courseData = course.course_data || [];
      const contentIndex = courseData.findIndex((item: any) =>
        item.id === contentId ||
        item._id === contentId ||
        item.title === contentId ||
        item.video_section === contentId
      );

      if (contentIndex === -1) {
        return next(new ErrorHandler("Invalid content id", 400));
      }

      const newQuestion = {
        id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
        user: {
          id: user.id,
          name: user.user_metadata?.first_name + " " + user.user_metadata?.last_name,
          avatar: user.user_metadata?.avatar_url
        },
        question,
        question_replies: [],
        created_at: new Date().toISOString()
      };

      course.course_data[contentIndex].questions = course.course_data[contentIndex].questions || [];
      course.course_data[contentIndex].questions.push(newQuestion as any);

      course.markModified('course_data');
      await course.save();

      const enrichedCourse = { ...course.toObject(), id: course._id.toString() };

      res.status(200).json({
        success: true,
        course: enrichedCourse,
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

      const course = await Course.findById(courseId);
      if (!course) {
        return next(new ErrorHandler('Course not found', 404));
      }

      const courseData = course.course_data || [];
      const contentIndex = courseData.findIndex((item: any) =>
        item.id === contentId ||
        item._id === contentId ||
        item.title === contentId ||
        item.video_section === contentId
      );

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

      course.course_data[contentIndex].questions[questionIndex].question_replies = course.course_data[contentIndex].questions[questionIndex].question_replies || [];
      course.course_data[contentIndex].questions[questionIndex].question_replies.push(newAnswer as any);

      course.markModified('course_data');
      await course.save();

      const enrichedCourse = { ...course.toObject(), id: course._id.toString() };

      res.status(200).json({
        success: true,
        course: enrichedCourse,
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

      const enrollment = await Enrollment.findOne({ user_id: user.id, course_id: courseId });
      if (!enrollment) {
        return next(new ErrorHandler("You are not eligible to access this course", 403));
      }

      const course = await Course.findById(courseId);
      if (!course) {
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

      course.reviews = reviews;
      course.ratings = avg / reviews.length;
      await course.save();

      const enrichedCourse = { ...course.toObject(), id: course._id.toString() };

      await redis.set(`course:${courseId}`, JSON.stringify(enrichedCourse), "EX", 604800);

      res.status(200).json({
        success: true,
        course: enrichedCourse,
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

// get instructor's own courses
export const getInstructorCourses = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return next(new ErrorHandler("Unauthorized", 401));
      }

      const courses = await Course.find({ $or: [{ creator: userId }, { creator: String(userId) }] }).sort({ createdAt: -1 });

      const creatorData = await fetchInstructorData(userId);

      const hydratedCourses = (courses || []).map((course) => {
        const doc = course.toObject();
        return {
          ...doc,
          id: doc._id.toString(),
          creator: creatorData,
        };
      });

      res.status(200).json({
        success: true,
        courses: hydratedCourses,
      });
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

      const course = await Course.findByIdAndDelete(id);
      if (!course) {
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

// generate video url
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

// Assign course to user manually --- only for admin
export const assignCourseToUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, userId } = req.body;
      if (!courseId || !userId) {
        return next(new ErrorHandler("Course ID and User ID are required", 400));
      }

      const course = await Course.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      if (user.courses.includes(courseId)) {
        return next(new ErrorHandler("User is already enrolled in this course", 400));
      }

      await UserModel.findByIdAndUpdate(userId, {
        $addToSet: { courses: courseId }
      });

      res.status(200).json({
        success: true,
        message: "Course assigned to user successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// get enrolled courses for the authenticated user
export const getEnrolledCourses = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user?.id;

      if (!userId) {
        return next(new ErrorHandler("Unauthorized", 401));
      }

      const dbUser = await UserModel.findById(userId);
      if (!dbUser || !dbUser.courses || dbUser.courses.length === 0) {
        return res.status(200).json({
          success: true,
          courses: [],
        });
      }

      const courses = await Course.find({ _id: { $in: dbUser.courses } });

      const hydratedCourses = await Promise.all((courses || []).map(async (course) => {
        const doc = course.toObject();
        const progressList = dbUser.coursesProgress || [];
        const progressRecord = progressList.find((p: any) => p.courseId === doc._id.toString()) || { progress: 0, completedVideos: [] };
        const creatorData = course.creator ? await fetchInstructorData(course.creator) : undefined;
        return {
          ...doc,
          id: doc._id.toString(),
          creator: creatorData,
          completedVideos: progressRecord.completedVideos,
          progress: progressRecord.progress
        };
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

// toggle video progress
export const toggleVideoProgress = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, videoSectionTitle } = req.body;
      const user = (req as any).user;
      const userId = user?.id;

      if (!userId) {
        return next(new ErrorHandler("Unauthorized", 401));
      }

      const dbUser = await UserModel.findById(userId);
      if (!dbUser) {
        return next(new ErrorHandler("User not found", 404));
      }

      const course = await Course.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const courseDataList = course.course_data || [];
      const totalVideos = courseDataList.length;

      if (!dbUser.coursesProgress) {
        dbUser.coursesProgress = [];
      }
      let progressRecord = dbUser.coursesProgress.find((p: any) => p.courseId === courseId);
      if (!progressRecord) {
        const newProg = {
          courseId,
          progress: 0,
          completedVideos: []
        };
        dbUser.coursesProgress.push(newProg);
        progressRecord = dbUser.coursesProgress.find((p: any) => p.courseId === courseId);
      }

      let completedVideosList = progressRecord.completedVideos || [];

      if (completedVideosList.includes(videoSectionTitle)) {
        completedVideosList = completedVideosList.filter((v: string) => v !== videoSectionTitle);
      } else {
        completedVideosList.push(videoSectionTitle);
      }

      progressRecord.completedVideos = completedVideosList;

      if (totalVideos > 0) {
        progressRecord.progress = Math.round((completedVideosList.length / totalVideos) * 100);
      } else {
        progressRecord.progress = 0;
      }

      await dbUser.save();

      res.status(200).json({
        success: true,
        completedVideos: progressRecord.completedVideos,
        progress: progressRecord.progress
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


// Create Mux Direct Upload URL
export const createMuxUploadUrl = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const upload = await mux.video.uploads.create({
        cors_origin: '*',
        new_asset_settings: {
          playback_policy: ['public'],
          mp4_support: 'standard',
        },
      });

      res.status(200).json({
        success: true,
        data: {
          id: upload.id,
          url: upload.url,
          status: upload.status,
        },
      });
    } catch (error: any) {
      console.error('Mux upload create error:', error);
      return next(new ErrorHandler(error.message || 'Failed to create Mux upload URL', 500));
    }
  }
);

// Get Mux Upload / Asset Status & Playback ID
export const getMuxUploadAsset = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { uploadId } = req.params;
      if (!uploadId) {
        return next(new ErrorHandler('Upload ID is required', 400));
      }

      const upload = await mux.video.uploads.retrieve(uploadId as string);

      let playbackId = '';
      let assetStatus = 'waiting';
      let duration = 0;

      if (upload.asset_id) {
        const asset = await mux.video.assets.retrieve(upload.asset_id);
        assetStatus = asset.status;
        duration = asset.duration || 0;
        if (asset.playback_ids && asset.playback_ids.length > 0) {
          playbackId = asset.playback_ids[0].id;
        }
      }

      res.status(200).json({
        success: true,
        data: {
          uploadId: upload.id,
          assetId: upload.asset_id,
          uploadStatus: upload.status,
          assetStatus,
          playbackId,
          duration,
        },
      });
    } catch (error: any) {
      console.error('Mux upload asset error:', error);
      return next(new ErrorHandler(error.message || 'Failed to fetch Mux asset', 500));
    }
  }
);


// Public route to resolve videoId / assetId / uploadId to a Mux playback ID
export const getMuxPlaybackInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        return next(new ErrorHandler('Video identifier is required', 400));
      }

      // 1. If it's already a playback ID, check with Mux or return it
      try {
        const playback = await mux.video.playbackIds.retrieve(id);
        if (playback && playback.id) {
          return res.status(200).json({
            success: true,
            data: { playbackId: playback.id },
          });
        }
      } catch (e) {
        // Not a playback ID directly, try asset or upload
      }

      // 2. Try retrieving as Asset ID
      try {
        const asset = await mux.video.assets.retrieve(id);
        if (asset && asset.playback_ids && asset.playback_ids.length > 0) {
          return res.status(200).json({
            success: true,
            data: { playbackId: asset.playback_ids[0].id },
          });
        }
      } catch (e) {
        // Not an asset ID, try upload ID
      }

      // 3. Try retrieving as Upload ID
      try {
        const upload = await mux.video.uploads.retrieve(id);
        if (upload && upload.asset_id) {
          const asset = await mux.video.assets.retrieve(upload.asset_id);
          if (asset && asset.playback_ids && asset.playback_ids.length > 0) {
            return res.status(200).json({
              success: true,
              data: { playbackId: asset.playback_ids[0].id },
            });
          }
        }
      } catch (e) { }

      res.status(404).json({
        success: false,
        error: 'Mux playback ID not found for this identifier',
      });
    } catch (err: any) {
      console.error('getMuxPlaybackInfo error:', err);
      res.status(500).json({ error: 'Failed to resolve Mux video' });
    }
  }
);
