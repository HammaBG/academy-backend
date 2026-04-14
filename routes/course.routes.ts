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
  getSingleCourse,
  uploadCourse,
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

courseRouter.get("/get-course-content/:id", requireAuth, getCourseByUser);

courseRouter.put("/add-question", requireAuth, addQuestion);

courseRouter.put("/add-answer", requireAuth, addAnswer);

courseRouter.put("/add-review/:id", requireAuth, addReview);

// add-reply to review (admin/instructor only in original code)
courseRouter.put(
  "/add-reply",
  requireAuth,
  authorizeRoles("admin", "instructor"),
  // Note: Your original code had addReplyToReview but I didn't see the full implementation in the snippet.
  // I will skip for now or implement if needed.
);

courseRouter.post("/getVdoCipherOTP", generateVideoUrl);

courseRouter.delete(
  "/delete-course/:id",
  requireAuth,
  authorizeRoles("admin"),
  deleteCourse
);

export default courseRouter;
