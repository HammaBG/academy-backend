import express from "express";
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware";
import {
  createConsultation,
  getMyConsultations,
  getInstructorConsultations,
  getSingleConsultation,
  replyToConsultation,
  updateConsultationStatus,
} from "../controllers/privateConsultation.controller";

const router = express.Router();

router.post("/", requireAuth, createConsultation);
router.post("/create", requireAuth, createConsultation);
router.get("/my-consultations", requireAuth, getMyConsultations);
router.get("/instructor/all", requireAuth, authorizeRoles("instructor", "admin"), getInstructorConsultations);
router.get("/:id", requireAuth, getSingleConsultation);
router.post("/:id/reply", requireAuth, replyToConsultation);
router.put("/:id/status", requireAuth, updateConsultationStatus);

export default router;
