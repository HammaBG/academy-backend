import express from "express";
import {
  registerPreRegistration,
  checkPreRegistrationStatus,
  getMyPreRegistrations,
  getAllPreRegistrations,
} from "../controllers/preRegistration.controller";
import { requireAuth, authorizeRoles, optionalAuth } from "../middlewares/auth.middleware";

const router = express.Router();

// Public: register for pre-registration
router.post("/", registerPreRegistration);

// Check status (authenticated or with email query)
router.get("/status/:courseId", optionalAuth, checkPreRegistrationStatus);

// Authenticated user: get my pre-registrations
router.get("/my", requireAuth, getMyPreRegistrations);

// Admin: get all pre-registrations
router.get("/admin", requireAuth, authorizeRoles("admin"), getAllPreRegistrations);

export default router;
