import { Response } from "express";
import { Course } from "../models/course.model";
import { CatchAsyncError } from "../utils/catchAsyncErrors";

// create course
export const createCourse = CatchAsyncError(async (data: any, res: Response) => {
  data.fake_user = Math.floor(Math.random() * 50) + 1;

  const course = new Course(data);
  await course.save();

  res.status(201).json({
    success: true,
    course
  });
});

// Get All Courses Service
export const getAllCoursesService = async (res: Response) => {
  try {
    // Exclude heavy course_data payload when listing all courses for admin
    const courses = await Course.find()
      .select("-course_data")
      .sort({ display_order: 1, createdAt: -1 })
      .lean();

    const mapped = (courses || []).map((course: any) => ({
      ...course,
      id: course._id ? course._id.toString() : course.id,
    }));

    res.status(200).json({
      success: true,
      courses: mapped,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
};
