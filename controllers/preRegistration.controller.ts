import { Request, Response } from "express";
import { PreRegistration, createPreRegistrationSchema } from "../models/preRegistration.model";
import { Course } from "../models/course.model";
import { sendPreRegistrationConfirmationEmail } from "../services/email.service";

/**
 * Register user for course pre-registration
 */
export const registerPreRegistration = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createPreRegistrationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Validation failed", details: parsed.error.format() });
      return;
    }

    const { courseId, courseName, fullName, email, phoneNumber } = parsed.data;
    const userId = (req as any).user?._id || (req as any).user?.id || undefined;

    // Check if already registered
    const existing = await PreRegistration.findOne({
      courseId,
      email: email.toLowerCase().trim(),
    });

    if (existing) {
      res.status(200).json({
        success: true,
        message: "أنت مسجل بالفعل في الحجز المسبق لهذه الدورة!",
        data: existing,
        alreadyRegistered: true,
      });
      return;
    }

    const newRecord = new PreRegistration({
      courseId,
      courseName,
      userId,
      fullName,
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim(),
      status: "pending",
    });

    await newRecord.save();

    // Send confirmation email asynchronously
    sendPreRegistrationConfirmationEmail(email.toLowerCase().trim(), fullName, courseName).catch((err) => {
      console.error("[PreRegistration] Error sending confirmation email:", err);
    });

    res.status(201).json({
      success: true,
      message: "تم تسجيل حجزك المسبق بنجاح! تم إرسال بريد إلكتروني بالتأكيد وسنتصل بك فور اكتمال الدورة لتأكيد طلبك بالخصم المخصص لك.",
      data: newRecord,
    });
  } catch (err: any) {
    console.error("[PreRegistration Error]:", err);
    res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
  }
};

/**
 * Check if current user/email is pre-registered for a course
 */
export const checkPreRegistrationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const email = (req.query.email as string)?.toLowerCase().trim();
    const userId = (req as any).user?._id || (req as any).user?.id;

    if (!courseId) {
      res.status(400).json({ success: false, error: "Course ID is required" });
      return;
    }

    const query: any = { courseId };
    if (email) {
      query.email = email;
    } else if (userId) {
      query.userId = userId;
    } else {
      res.status(200).json({ success: true, isRegistered: false });
      return;
    }

    const registration = await PreRegistration.findOne(query);

    res.status(200).json({
      success: true,
      isRegistered: !!registration,
      data: registration || null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
  }
};

/**
 * Get current user's pre-registered courses
 */
export const getMyPreRegistrations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?._id || (req as any).user?.id;
    const userEmail = (req as any).user?.email?.toLowerCase().trim();

    if (!userId && !userEmail) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const filter: any = {
      $or: [
        ...(userId ? [{ userId }] : []),
        ...(userEmail ? [{ email: userEmail }] : []),
      ],
    };

    const items = await PreRegistration.find(filter)
      .populate("courseId", "name thumbnail price estimated_price ready status url categories short_description preregistration_discount")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: items,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
  }
};

/**
 * Get all pre-registrations (Admin)
 */
export const getAllPreRegistrations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId, status } = req.query;
    const filter: any = {};
    if (courseId) filter.courseId = courseId;
    if (status) filter.status = status;

    const items = await PreRegistration.find(filter)
      .populate("courseId", "name ready price url preregistration_discount")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: items,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
  }
};
