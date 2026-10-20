import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../utils/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import {
  Coupon,
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
} from "../models/coupon.model";

// 1. Validate & calculate coupon discount for checkout (Public/Authenticated)
export const validateCoupon = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validateCouponSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ErrorHandler(JSON.stringify(parsed.error.format()), 400));
      }

      const { code, cartTotal, courseIds } = parsed.data;

      const coupon = await Coupon.findOne({
        code: code.trim().toUpperCase(),
        active: true,
      });

      if (!coupon) {
        return next(new ErrorHandler("كود الخصم غير صحيح أو غير مفعّل", 404));
      }

      // Check expiration
      if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
        return next(new ErrorHandler("لقد انتهت صلاحية كود الخصم هذا", 400));
      }

      // Check overall usage limit
      if (coupon.usageLimit && coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
        return next(new ErrorHandler("تم استنفاذ الحد الأقصى لاستخدام كود الخصم", 400));
      }

      // Check min order amount
      if (coupon.minOrderAmount && cartTotal < coupon.minOrderAmount) {
        return next(
          new ErrorHandler(
            `الحد الأدنى للطلب لتفعيل هذا الكوبون هو ${coupon.minOrderAmount} د.ت`,
            400
          )
        );
      }

      // Check course restrictions if any
      if (coupon.courses && coupon.courses.length > 0) {
        const matchesAny = courseIds.some((cid) => coupon.courses?.includes(cid));
        if (!matchesAny) {
          return next(
            new ErrorHandler("هذا الكوبون غير متاح للكورسات الموجودة في سلتك", 400)
          );
        }
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.discountType === "percentage") {
        discountAmount = (cartTotal * coupon.discountValue) / 100;
        if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
        }
      } else {
        discountAmount = coupon.discountValue;
      }

      // Ensure discount doesn't exceed total
      discountAmount = Math.min(discountAmount, cartTotal);
      discountAmount = Math.round(discountAmount * 100) / 100;
      const finalTotal = Math.max(0, Math.round((cartTotal - discountAmount) * 100) / 100);

      res.status(200).json({
        success: true,
        coupon: {
          id: coupon._id.toString(),
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          description: coupon.description,
        },
        discountAmount,
        finalTotal,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// 2. Create coupon (Admin)
export const createCoupon = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createCouponSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ErrorHandler(JSON.stringify(parsed.error.format()), 400));
      }

      const existing = await Coupon.findOne({ code: parsed.data.code });
      if (existing) {
        return next(new ErrorHandler("رمز الكوبون مسجل بالفعل", 400));
      }

      const coupon = new Coupon({
        ...parsed.data,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      });

      await coupon.save();

      res.status(201).json({
        success: true,
        message: "تم إنشاء الكوبون بنجاح",
        coupon,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// 3. Get all coupons (Admin)
export const getAllCoupons = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const coupons = await Coupon.find().sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        coupons,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// 4. Update coupon (Admin)
export const updateCoupon = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parsed = updateCouponSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(new ErrorHandler(JSON.stringify(parsed.error.format()), 400));
      }

      const updateData: any = { ...parsed.data };
      if (parsed.data.expiresAt !== undefined) {
        updateData.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
      }

      const coupon = await Coupon.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!coupon) {
        return next(new ErrorHandler("الكوبون غير موجود", 404));
      }

      res.status(200).json({
        success: true,
        message: "تم تحديث الكوبون بنجاح",
        coupon,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// 5. Delete coupon (Admin)
export const deleteCoupon = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const coupon = await Coupon.findByIdAndDelete(id);

      if (!coupon) {
        return next(new ErrorHandler("الكوبون غير موجود", 404));
      }

      res.status(200).json({
        success: true,
        message: "تم حذف الكوبون بنجاح",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
