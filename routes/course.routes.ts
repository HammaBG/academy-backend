import express from "express";
import {
  addAnswer,
  addQuestion,
  addReview,
  deleteCourse,
  editCourse,
  generateVideoUrl,
  getAdminAllCourses,
  getAllCourses,
  getCourseByUser,
  getEnrolledCourses,
  getInstructorCourses,
  getSingleCourse,
  uploadCourse,
  assignCourseToUser,
  toggleVideoProgress
} from "../controllers/course.controller";
import { authorizeRoles, requireAuth } from "../middlewares/auth.middleware";

const courseRouter = express.Router();

courseRouter.post(
  "/create-course",
  requireAuth,
  authorizeRoles("admin", "instructor"),
  uploadCourse
);

courseRouter.put(
  "/edit-course/:id",
  requireAuth,
  authorizeRoles("admin", "instructor"),
  editCourse
);

courseRouter.get("/get-course/:id", getSingleCourse);

courseRouter.get("/get-courses", getAllCourses);

courseRouter.get(
  "/get-admin-courses",
  requireAuth,
  authorizeRoles("admin", "instructor", "sales"),
  getAdminAllCourses
);

courseRouter.get(
  "/get-instructor-courses",
  requireAuth,
  authorizeRoles("instructor"),
  getInstructorCourses
);

courseRouter.get("/get-course-content/:id", requireAuth, getCourseByUser);

courseRouter.get("/get-user-courses", requireAuth, getEnrolledCourses);

courseRouter.put("/add-question", requireAuth, addQuestion);

courseRouter.put("/add-answer", requireAuth, addAnswer);

courseRouter.put("/add-review/:id", requireAuth, addReview);

courseRouter.post("/toggle-video-progress", requireAuth, toggleVideoProgress);

courseRouter.post("/getVdoCipherOTP", generateVideoUrl);

courseRouter.delete(
  "/delete-course/:id",
  requireAuth,
  authorizeRoles("admin"),
  deleteCourse
);

courseRouter.post(
  "/assign-course",
  requireAuth,
  authorizeRoles("admin"),
  assignCourseToUser
);

courseRouter.get(
  "/get-enrolled-courses",
  requireAuth,
  getEnrolledCourses
);

export default courseRouter;
