import { Request, Response } from "express";
import {
  createEnrollmentCodeSchema,
  updateEnrollmentCodeSchema,
  IEnrollmentCode,
  ICoursePrice,
  EnrollmentCode as EnrollmentCodeModel
} from "../models/enrollmentCode.model";
import { Course as CourseModel } from "../models/course.model";
import { User as UserModel } from "../models/user.model";
import { Enrollment } from "../models/enrollment.model";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Helper: map MongoDB document to frontend structure
const toCamelCase = (data: any): IEnrollmentCode => {
  const doc = data.toObject ? data.toObject() : data;
  return {
    id: doc._id.toString(),
    name: doc.name,
    courses: doc.courses || [],
    coursePrices: doc.coursePrices || [],
    usageLimit: doc.usageLimit || 1,
    usedBy: doc.usedBy || [],
    used: doc.used || false,
    active: doc.active || true,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

// Helper: fetch user details for rendering who used the code
const fetchUserData = async (userId: string) => {
  try {
    const user = await UserModel.findById(userId);
    if (user) {
      return {
        id: user._id.toString(),
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Academy Student',
        email: user.email || '',
        avatar: user.avatar_url || ''
      };
    }
    return { id: userId, name: "Academy Student", email: "", avatar: "" };
  } catch {
    return { id: userId, name: "Academy Student", email: "", avatar: "" };
  }
};

// Helper: hydrate course info inside codes
const hydrateCoursesForCode = async (code: IEnrollmentCode) => {
  if (!code.courses || code.courses.length === 0) return code;
  try {
    const coursesData = await CourseModel.find({ _id: { $in: code.courses } });

    if (coursesData) {
      const courseMap = new Map(coursesData.map(c => [c._id.toString(), { name: c.name, price: Number(c.price || 0) }]));
      
      const hydratedCourses = code.courses.map(id => {
        const match = courseMap.get(id);
        return match ? { id, name: match.name, price: match.price } : { id, name: "Deleted Course", price: 0 };
      });

      const hydratedPrices = code.coursePrices.map(cp => {
        const match = courseMap.get(cp.courseId);
        return {
          courseId: cp.courseId,
          price: cp.price,
          course: match ? { name: match.name, price: match.price } : { name: "Deleted Course", price: 0 }
        };
      });

      return {
        ...code,
        courses: hydratedCourses as any,
        coursePrices: hydratedPrices as any
      };
    }
  } catch (err) {
    console.error("Hydrating courses error:", err);
  }
  return code;
};

/**
 * Create enrollment code with multiple courses (admin only)
 */
export const createEnrollmentCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createFormSchemaForCode(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
      return;
    }

    const { name, courses, usageLimit } = parsed.data;

    // Check if courses exist in database
    const existingCourses = await CourseModel.find({ _id: { $in: courses } });
    if (!existingCourses || existingCourses.length !== courses.length) {
      res.status(404).json({ success: false, error: "One or more courses not found" });
      return;
    }

    // Check if code name already exists
    const normalizedName = String(name).toUpperCase().trim();
    const existingCode = await EnrollmentCodeModel.findOne({ name: normalizedName });

    if (existingCode) {
      res.status(400).json({ success: false, error: "Enrollment code with this name already exists" });
      return;
    }

    // Set prices
    const coursePrices: ICoursePrice[] = existingCourses.map((c) => ({
      courseId: c._id.toString(),
      price: Number(c.price || 0),
    }));

    const newCode = new EnrollmentCodeModel({
      name: normalizedName,
      courses,
      coursePrices,
      usageLimit,
    });
    await newCode.save();

    const rawCamel = toCamelCase(newCode);
    const hydrated = await hydrateCoursesForCode(rawCamel);

    res.status(201).json({
      success: true,
      message: "Enrollment code created successfully",
      enrollmentCode: hydrated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

const createFormSchemaForCode = (body: any) => {
  return createEnrollmentCodeSchema.safeParse(body);
};

/**
 * Get all enrollment codes (admin only)
 */
export const getEnrollmentCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const codesData = await EnrollmentCodeModel.find().sort({ createdAt: -1 });

    const camelCodes = codesData.map(toCamelCase);

    const hydratedCodes = await Promise.all(camelCodes.map(async (code) => {
      const codeWithCourses = await hydrateCoursesForCode(code);
      
      const usedByUsers = await Promise.all(
        (code.usedBy || []).map(async (uid) => await fetchUserData(uid))
      );

      return {
        ...codeWithCourses,
        usedBy: usedByUsers
      };
    }));

    res.status(200).json({
      success: true,
      enrollmentCodes: hydratedCodes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

/**
 * Use enrollment code to get access to multiple courses
 */
export const useEnrollmentCode = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    const userId = req.user?.id;

    if (!code) {
      res.status(400).json({ success: false, error: "Enrollment code is required" });
      return;
    }
    if (!userId) {
      res.status(401).json({ success: false, error: "User authentication required" });
      return;
    }

    const normalizedCode = String(code).toUpperCase().trim();

    // Find active enrollment code
    const codeData = await EnrollmentCodeModel.findOne({ name: normalizedCode, active: true });

    if (!codeData) {
      res.status(400).json({ success: false, error: "Invalid or inactive enrollment code" });
      return;
    }

    const enrollmentCode = toCamelCase(codeData);

    // Check if code is already flagged as used
    if (enrollmentCode.used) {
      res.status(400).json({ success: false, error: "Enrollment code already used" });
      return;
    }

    // Check if user already used this code
    if (enrollmentCode.usedBy.includes(userId)) {
      res.status(400).json({ success: false, error: "You have already used this enrollment code" });
      return;
    }

    // Check if usage limit is reached
    if (enrollmentCode.usedBy.length >= enrollmentCode.usageLimit) {
      res.status(400).json({ success: false, error: "Enrollment code usage limit reached" });
      return;
    }

    // Check which courses user is not already enrolled in
    const userEnrollments = await Enrollment.find({ user_id: userId });

    const enrolledCourseIds = new Set((userEnrollments || []).map(e => e.course_id));

    // Filter courses from enrollment code that the user does not have
    const newCourseIds = enrollmentCode.courses.filter(id => !enrolledCourseIds.has(id));

    if (newCourseIds.length === 0) {
      res.status(400).json({ success: false, error: "You are already enrolled in all courses associated with this code" });
      return;
    }

    // Get course metadata to return in response
    const coursesData = await CourseModel.find({ _id: { $in: newCourseIds } });

    // Enroll user in each new course in parallel
    const enrollmentPromises = newCourseIds.map(async (courseId) => {
      const newEnroll = new Enrollment({
        user_id: userId,
        course_id: courseId,
      });
      return await newEnroll.save();
    });

    await Promise.all(enrollmentPromises);

    // Update code usedBy list and checked status
    const updatedUsedBy = [...enrollmentCode.usedBy, userId];
    const isLimitReached = updatedUsedBy.length >= enrollmentCode.usageLimit;

    await EnrollmentCodeModel.findByIdAndUpdate(enrollmentCode.id, {
      usedBy: updatedUsedBy,
      used: isLimitReached
    });

    const totalPrice = coursesData.reduce((sum, c) => sum + Number(c.price || 0), 0);
    console.log(`[Order Confirmation Log] User ${userId} successfully used code ${enrollmentCode.name} to enroll in courses: ${coursesData.map(c => c.name).join(', ')}. Total Value: ${totalPrice}`);

    res.status(200).json({
      success: true,
      message: `Successfully enrolled in ${coursesData.length} course(s)!`,
      enrolledCourses: coursesData.map(c => ({
        id: c._id.toString(),
        courseId: c._id.toString(),
        name: c.name,
        price: Number(c.price)
      })),
      totalCourses: enrollmentCode.courses.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

/**
 * Delete enrollment code (admin only)
 */
export const deleteEnrollmentCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const code = await EnrollmentCodeModel.findByIdAndDelete(id);
    if (!code) {
      res.status(404).json({ success: false, error: "Enrollment code not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Enrollment code deleted successfully",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

/**
 * Get user's used enrollment codes (admin only)
 */
export const getUserEnrollmentCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const codesData = await EnrollmentCodeModel.find({ usedBy: userId });

    const camelCodes = codesData.map(toCamelCase);

    const hydratedCodes = await Promise.all(
      camelCodes.map(async (code) => await hydrateCoursesForCode(code))
    );

    res.status(200).json({
      success: true,
      enrollmentCodes: hydratedCodes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};
