import express from "express";
import {
  validateCoupon,
  createCoupon,
  getAllCoupons,
  updateCoupon,
  deleteCoupon,
} from "../controllers/coupon.controller";
import { requireAuth, authorizeRoles } from "../middlewares/auth.middleware";

const couponRouter = express.Router();

// Public: Validate coupon during cart checkout
couponRouter.post("/validate", validateCoupon);

// Admin: Manage coupons
couponRouter.post(
  "/create",
  requireAuth,
  authorizeRoles("admin"),
  createCoupon
);

couponRouter.get(
  "/all",
  requireAuth,
  authorizeRoles("admin"),
  getAllCoupons
);

couponRouter.put(
  "/update/:id",
  requireAuth,
  authorizeRoles("admin"),
  updateCoupon
);

couponRouter.delete(
  "/delete/:id",
  requireAuth,
  authorizeRoles("admin"),
  deleteCoupon
);

export default couponRouter;
