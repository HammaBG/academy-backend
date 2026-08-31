import { Router } from "express";
import {
  createEnrollmentCode,
  getAllEnrollmentCodes,
  useEnrollmentCode,
  deleteEnrollmentCode,
  getMyUsedCodes
} from "../controllers/enrollmentCode.controller";
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth);

router.post("/use", useEnrollmentCode);

router.use(authorizeRoles("admin"));

router.route("/")
  .post(createEnrollmentCode)
  .get(getAllEnrollmentCodes);

router.delete("/:id", deleteEnrollmentCode);
router.get("/user/my-used", getMyUsedCodes);

export default router;
