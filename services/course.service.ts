import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { ICourse } from "../models/course.model";
import { CatchAsyncError } from "../utils/catchAsyncErrors";

// create course
export const createCourse = CatchAsyncError(async (data: any, res: Response) => {
  // Set fake_user to a random number between 1 and 50
  data.fake_user = Math.floor(Math.random() * 50) + 1;

  const { data: course, error } = await supabaseAdmin
    .from('courses')
    .insert(data)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ success: false, error: error.message });
  }

  // Note: Handling admin course association if needed
  // In your original code: user?.courses?.push(course._id);

  res.status(201).json({
    success: true,
    course
  });
});

// Get All Courses Service
export const getAllCoursesService = async (res: Response) => {
  const { data: courses, error } = await supabaseAdmin
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(400).json({ success: false, error: error.message });
  }

  res.status(201).json({
    success: true,
    courses,
  });
};
