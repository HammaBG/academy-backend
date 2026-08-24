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
    const courses = await Course.find().sort({ createdAt: -1 });
    res.status(201).json({
      success: true,
      courses,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
};
