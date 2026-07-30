import { Request, Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import {
  createEnrollmentCodeSchema,
  updateEnrollmentCodeSchema,
  IEnrollmentCode,
  ICoursePrice
} from "../models/enrollmentCode.model";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Helper: map frontend camelCase object to Postgres snake_case
const toSnakeCase = (data: any) => ({
  name: data.name,
  courses: data.courses,
  course_prices: data.coursePrices || [],
  usage_limit: data.usageLimit || 1,
  used_by: data.usedBy || [],
  used: data.used || false,
  active: data.active || true,
});

// Helper: map Postgres snake_case object to frontend camelCase
const toCamelCase = (data: any): IEnrollmentCode => ({
  id: data.id,
  name: data.name,
  courses: data.courses || [],
  coursePrices: data.course_prices || [],
  usageLimit: data.usage_limit || 1,
  usedBy: data.used_by || [],
  used: data.used || false,
  active: data.active || true,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

// Helper: fetch user details for rendering who used the code
const fetchUserData = async (userId: string) => {
  try {
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (userData) {
      return {
        id: userData.id,
        name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Academy Student',
        email: userData.email || '',
        avatar: userData.avatar_url || ''
      };
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError || !user) {
      return { id: userId, name: "Academy Student", email: "", avatar: "" };
    }

    const meta = user.user_metadata || {};
    return {
      id: user.id,
      name: `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || user.email?.split('@')[0] || "Academy Student",
      email: user.email || '',
      avatar: meta.avatar_url || ""
    };
  } catch {
    return { id: userId, name: "Academy Student", email: "", avatar: "" };
  }
};

// Helper: hydrate course info inside codes
const hydrateCoursesForCode = async (code: IEnrollmentCode) => {
  if (!code.courses || code.courses.length === 0) return code;
  try {
    const { data: coursesData } = await supabaseAdmin
      .from('courses')
      .select('id, name, price')
      .in('id', code.courses);

    if (coursesData) {
      // Create a hydrated courses map
      const courseMap = new Map(coursesData.map(c => [c.id, { name: c.name, price: Number(c.price || 0) }]));
      
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
    const { data: existingCourses, error: courseFetchError } = await supabaseAdmin
      .from('courses')
      .select('id, name, price')
      .in('id', courses);

    if (courseFetchError || !existingCourses || existingCourses.length !== courses.length) {
      res.status(404).json({ success: false, error: "One or more courses not found" });
      return;
    }

    // Check if code name already exists
    const normalizedName = String(name).toUpperCase().trim();
    const { data: existingCode } = await supabaseAdmin
      .from('enrollment_codes')
      .select('id')
      .eq('name', normalizedName)
      .maybeSingle();

    if (existingCode) {
      res.status(400).json({ success: false, error: "Enrollment code with this name already exists" });
      return;
    }

    // Set prices
    const coursePrices: ICoursePrice[] = existingCourses.map((c) => ({
      courseId: c.id,
      price: Number(c.price || 0),
    }));

    const snakeCode = toSnakeCase({
      name: normalizedName,
      courses,
      coursePrices,
      usageLimit,
    });

    const { data: newCode, error: insertError } = await supabaseAdmin
      .from('enrollment_codes')
      .insert(snakeCode)
      .select()
      .single();

    if (insertError) {
      res.status(400).json({ success: false, error: insertError.message });
      return;
    }

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

// Zod schema check helper for creation
const createFormSchemaForCode = (body: any) => {
  return createEnrollmentCodeSchema.safeParse(body);
};

/**
 * Get all enrollment codes (admin only)
 */
export const getEnrollmentCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: codesData, error } = await supabaseAdmin
      .from('enrollment_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    const camelCodes = (codesData || []).map(toCamelCase);

    // Hydrate each code with courses and usedBy user details
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
    const { data: codeData, error: fetchError } = await supabaseAdmin
      .from('enrollment_codes')
      .select('*')
      .eq('name', normalizedCode)
      .eq('active', true)
      .maybeSingle();

    if (fetchError || !codeData) {
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
    const { data: userEnrollments, error: enrollError } = await supabaseAdmin
      .from('enrollments')
      .select('course_id')
      .eq('user_id', userId);

    if (enrollError) {
      res.status(400).json({ success: false, error: enrollError.message });
      return;
    }

    const enrolledCourseIds = new Set((userEnrollments || []).map(e => e.course_id));

    // Filter courses from enrollment code that the user does not have
    const newCourseIds = enrollmentCode.courses.filter(id => !enrolledCourseIds.has(id));

    if (newCourseIds.length === 0) {
      res.status(400).json({ success: false, error: "You are already enrolled in all courses associated with this code" });
      return;
    }

    // Get course metadata to return in response
    const { data: coursesData, error: coursesFetchError } = await supabaseAdmin
      .from('courses')
      .select('id, name, price')
      .in('id', newCourseIds);

    if (coursesFetchError) {
      res.status(400).json({ success: false, error: coursesFetchError.message });
      return;
    }

    // Enroll user in each new course in parallel
    const enrollmentPromises = newCourseIds.map(async (courseId) => {
      return await supabaseAdmin
        .from('enrollments')
        .insert({
          user_id: userId,
          course_id: courseId,
        });
    });

    await Promise.all(enrollmentPromises);

    // Update code usedBy list and checked status
    const updatedUsedBy = [...enrollmentCode.usedBy, userId];
    const isLimitReached = updatedUsedBy.length >= enrollmentCode.usageLimit;

    const { error: updateError } = await supabaseAdmin
      .from('enrollment_codes')
      .update({
        used_by: updatedUsedBy,
        used: isLimitReached
      })
      .eq('id', enrollmentCode.id);

    if (updateError) {
      res.status(400).json({ success: false, error: updateError.message });
      return;
    }

    // Send confirmation email note: SMTP ejs confirmation mailing is handled globally by Supabase in this stack.
    // Logging transaction details locally:
    const totalPrice = coursesData.reduce((sum, c) => sum + Number(c.price || 0), 0);
    console.log(`[Order Confirmation Log] User ${userId} successfully used code ${enrollmentCode.name} to enroll in courses: ${coursesData.map(c => c.name).join(', ')}. Total Value: ${totalPrice}`);

    res.status(200).json({
      success: true,
      message: `Successfully enrolled in ${coursesData.length} course(s)!`,
      enrolledCourses: coursesData.map(c => ({
        id: c.id,
        courseId: c.id,
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

    const { data: code, error: fetchError } = await supabaseAdmin
      .from('enrollment_codes')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !code) {
      res.status(404).json({ success: false, error: "Enrollment code not found" });
      return;
    }

    const { error: deleteError } = await supabaseAdmin
      .from('enrollment_codes')
      .delete()
      .eq('id', id);

    if (deleteError) {
      res.status(400).json({ success: false, error: deleteError.message });
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

    // Fetch codes where used_by array contains the user ID
    // In Postgrest, we can use contains filter
    const { data: codesData, error } = await supabaseAdmin
      .from('enrollment_codes')
      .select('*')
      .contains('used_by', [userId]);

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    const camelCodes = (codesData || []).map(toCamelCase);

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
