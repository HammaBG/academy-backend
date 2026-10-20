import mongoose, { Schema } from "mongoose";
import { z } from "zod";

export interface ICoupon {
  id?: string;
  _id?: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usedCount: number;
  usedBy: string[];
  expiresAt?: Date | null;
  active: boolean;
  courses?: string[];
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const createCouponSchema = z.object({
  code: z.string().min(2, "رمز الكوبون يجب أن يتكون من حرفين على الأقل").max(30).trim().toUpperCase(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().min(0.1, "قيمة الخصم يجب أن تكون أكبر من صفر"),
  minOrderAmount: z.number().min(0).optional().default(0),
  maxDiscountAmount: z.number().min(0).optional(),
  usageLimit: z.number().int().min(0).optional().default(0),
  expiresAt: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
  courses: z.array(z.string()).optional().default([]),
  description: z.string().max(200).optional().default(""),
});

export const updateCouponSchema = z.object({
  discountType: z.enum(["percentage", "fixed"]).optional(),
  discountValue: z.number().min(0.1).optional(),
  minOrderAmount: z.number().min(0).optional(),
  maxDiscountAmount: z.number().min(0).optional(),
  usageLimit: z.number().int().min(0).optional(),
  expiresAt: z.string().optional().nullable(),
  active: z.boolean().optional(),
  courses: z.array(z.string()).optional(),
  description: z.string().max(200).optional(),
});

export const validateCouponSchema = z.object({
  code: z.string().min(1, "رمز الكوبون مطلوب").trim().toUpperCase(),
  cartTotal: z.number().min(0),
  courseIds: z.array(z.string()).optional().default([]),
});

const CouponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
      default: "percentage",
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
    },
    usageLimit: {
      type: Number,
      default: 0,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    usedBy: {
      type: [String],
      default: [],
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
    courses: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

CouponSchema.set("toJSON", {
  virtuals: true,
  transform: (_, ret: any) => {
    ret.id = ret._id ? ret._id.toString() : ret.id;
    return ret;
  },
});

export const Coupon = mongoose.model<ICoupon>("Coupon", CouponSchema);
