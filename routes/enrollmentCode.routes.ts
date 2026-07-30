import { Router } from "express";
import {
  createEnrollmentCode,
  getEnrollmentCodes,
  useEnrollmentCode,
  deleteEnrollmentCode,
  getUserEnrollmentCodes
} from "../controllers/enrollmentCode.controller";
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth);

router.post("/use", useEnrollmentCode);

router.use(authorizeRoles("admin"));

router.route("/")
  .post(createEnrollmentCode)
  .get(getEnrollmentCodes);

router.delete("/:id", deleteEnrollmentCode);
router.get("/user/:userId", getUserEnrollmentCodes);

export default router;
