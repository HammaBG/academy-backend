import { Request, Response } from "express";
import { PrivateConsultation } from "../models/privateConsultation.model";
import { Course } from "../models/course.model";
import { User } from "../models/user.model";
import { dispatchNotification } from "./notification.controller";

// 1. Create a new confidential consultation from student to instructor
export const createConsultation = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { courseId, lessonTitle, sectionId, subject, message } = req.body;
    if (!courseId || !subject?.trim() || !message?.trim()) {
      res.status(400).json({ success: false, message: "الدورة وعنوان الاستشارة والرسالة حقول مطلوبة" });
      return;
    }

    // Find course & instructor
    let course = null;
    if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(courseId);
    }
    if (!course) {
      course = await Course.findOne({ url: courseId });
    }
    if (!course) {
      res.status(404).json({ success: false, message: "الدورة غير موجودة" });
      return;
    }

    let instructorId = course.creator?.toString() || "";
    let instructorName = "المستشار الأسري";

    if (instructorId) {
      const instUser = await User.findById(instructorId).select("first_name last_name");
      if (instUser) {
        instructorName = ((instUser.first_name || "") + " " + (instUser.last_name || "")).trim() || instructorName;
      }
    } else {
      // Fallback: assign to primary instructor or admin
      const fallbackInst = await User.findOne({ role: "instructor" });
      if (fallbackInst) {
        instructorId = fallbackInst._id.toString();
        instructorName = ((fallbackInst.first_name || "") + " " + (fallbackInst.last_name || "")).trim() || "المستشار الأسري";
      } else {
        const fallbackAdmin = await User.findOne({ role: "admin" });
        if (fallbackAdmin) {
          instructorId = fallbackAdmin._id.toString();
          instructorName = ((fallbackAdmin.first_name || "") + " " + (fallbackAdmin.last_name || "")).trim() || "إدارة الأكاديمية";
        }
      }
    }

    const dbStudent = await User.findById(authUser.id);
    const studentName = dbStudent
      ? ((dbStudent.first_name || "") + " " + (dbStudent.last_name || "")).trim() || "طالب الأكاديمية"
      : authUser.name || "طالب الأكاديمية";
    const studentEmail = dbStudent?.email || authUser.email || "";
    const studentAvatar = dbStudent?.avatar_url || "";

    const newConsultation = await PrivateConsultation.create({
      courseId: course._id.toString(),
      courseName: course.name,
      instructorId: instructorId || authUser.id,
      instructorName,
      studentId: authUser.id,
      studentName,
      studentEmail,
      studentAvatar,
      lessonTitle: lessonTitle || "",
      sectionId: sectionId || "",
      subject: subject.trim(),
      status: "open",
      unreadByInstructor: 1,
      unreadByStudent: 0,
      lastMessageAt: new Date(),
      messages: [
        {
          senderId: authUser.id,
          senderName: studentName,
          senderRole: "user",
          senderAvatar: studentAvatar,
          message: message.trim(),
          createdAt: new Date(),
        },
      ],
    });

    // Persistent & real-time notification dispatch
    const notifTitle = '🔒 استشارة سرية جديدة بانتظارك';
    const notifMessage = 'لديك استفسار سري جديد من الطالب ' + studentName + ' في دورة ' + course.name + (lessonTitle ? ' حول درس: ' + lessonTitle : '');
    const senderPayload = {
      id: authUser.id,
      name: studentName,
      role: 'user',
      roleLabel: 'طالب',
      avatar: studentAvatar,
    };

    // 1. Dispatch to instructor
    if (instructorId && instructorId !== authUser.id) {
      console.log('[PrivateConsultation] Dispatching notification to instructor:', instructorId);
      await dispatchNotification({
        recipientId: instructorId,
        title: notifTitle,
        message: notifMessage,
        type: 'private_consultation',
        link: '/instructor/consultations',
        courseName: course.name,
        sender: senderPayload,
      });
    }

    // 2. Dispatch to all admins
    const admins = await User.find({ role: 'admin' }).select('_id');
    for (const admin of admins) {
      const adminId = admin._id.toString();
      if (adminId !== instructorId && adminId !== authUser.id) {
        console.log('[PrivateConsultation] Dispatching notification to admin:', adminId);
        await dispatchNotification({
          recipientId: adminId,
          title: notifTitle,
          message: notifMessage,
          type: 'private_consultation',
          link: '/instructor/consultations',
          courseName: course.name,
          sender: senderPayload,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "تم إرسال استشارتك السرية بنجاح إلى المستشار",
      consultation: newConsultation,
    });
  } catch (err: any) {
    console.error("Create consultation error:", err);
    res.status(500).json({ success: false, message: err.message || "حدث خطأ أثناء إرسال الاستشارة" });
  }
};

// 2. Student: get private consultations for a specific course or all my consultations
export const getMyConsultations = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { courseId } = req.query;
    const query: any = { studentId: authUser.id };
    if (courseId) {
      query.courseId = courseId;
    }

    const consultations = await PrivateConsultation.find(query).sort({ lastMessageAt: -1 });
    res.status(200).json({ success: true, consultations });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "فشل تحميل الاستشارات" });
  }
};

// 3. Instructor / Admin: get consultations directed to this instructor
export const getInstructorConsultations = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const role = authUser.role;
    const query: any = {};
    if (role !== "admin") {
      query.instructorId = authUser.id;
    }

    const { status, courseId } = req.query;
    if (status && status !== "all") query.status = status;
    if (courseId && courseId !== "all") query.courseId = courseId;

    const consultations = await PrivateConsultation.find(query).sort({ lastMessageAt: -1 });
    const stats = {
      total: consultations.length,
      open: consultations.filter((c: any) => c.status === "open").length,
      answered: consultations.filter((c: any) => c.status === "answered").length,
      closed: consultations.filter((c: any) => c.status === "closed").length,
    };

    res.status(200).json({ success: true, consultations, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "فشل تحميل استشارات المدرب" });
  }
};

// 4. Get a single consultation thread with messages
export const getSingleConsultation = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const { id } = req.params;

    const consultation = await PrivateConsultation.findById(id);
    if (!consultation) {
      res.status(404).json({ success: false, message: "الاستشارة غير موجودة" });
      return;
    }

    const role = authUser.role;
    const isOwner = consultation.studentId === authUser.id;
    const isInstructor = consultation.instructorId === authUser.id;
    const isAdmin = role === "admin";

    if (!isOwner && !isInstructor && !isAdmin) {
      res.status(403).json({ success: false, message: "غير مصرح لك بالاطلاع على هذه الاستشارة" });
      return;
    }

    // Mark unread as 0 for viewer
    if (isOwner && consultation.unreadByStudent > 0) {
      consultation.unreadByStudent = 0;
      await consultation.save();
    } else if ((isInstructor || isAdmin) && consultation.unreadByInstructor > 0) {
      consultation.unreadByInstructor = 0;
      await consultation.save();
    }

    res.status(200).json({ success: true, consultation });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "فشل تحميل تفاصيل الاستشارة" });
  }
};

// 5. Add a reply message to the consultation thread
export const replyToConsultation = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({ success: false, message: "الرسالة مطلوبة" });
      return;
    }

    const consultation = await PrivateConsultation.findById(id);
    if (!consultation) {
      res.status(404).json({ success: false, message: "الاستشارة غير موجودة" });
      return;
    }

    const role = authUser.role;
    const isOwner = consultation.studentId === authUser.id;
    const isInstructor = consultation.instructorId === authUser.id;
    const isAdmin = role === "admin";

    if (!isOwner && !isInstructor && !isAdmin) {
      res.status(403).json({ success: false, message: "غير مصرح لك بالرد" });
      return;
    }

    const dbUser = await User.findById(authUser.id);
    const senderName = dbUser
      ? ((dbUser.first_name || "") + " " + (dbUser.last_name || "")).trim() || (isOwner ? "طالب" : "المستشار")
      : authUser.name || (isOwner ? "طالب" : "المستشار");
    const senderRole = isOwner ? "user" : (isAdmin ? "admin" : "instructor");
    const senderRoleLabel = isOwner ? "طالب" : (isAdmin ? "الإدارة" : "المستشار");
    const senderAvatar = dbUser?.avatar_url || "";

    const newMsg = {
      senderId: authUser.id,
      senderName,
      senderRole,
      senderAvatar,
      message: message.trim(),
      createdAt: new Date(),
    };

    consultation.messages.push(newMsg as any);
    consultation.lastMessageAt = new Date();

    if (isOwner) {
      consultation.status = "open";
      consultation.unreadByInstructor = (consultation.unreadByInstructor || 0) + 1;
    } else {
      consultation.status = "answered";
      consultation.unreadByStudent = (consultation.unreadByStudent || 0) + 1;
    }

    await consultation.save();

    // Find course slug if available for clean student link
    let courseSlugOrId = consultation.courseId;
    try {
      const courseDoc = await Course.findById(consultation.courseId).select('url');
      if (courseDoc?.url) {
        courseSlugOrId = courseDoc.url;
      }
    } catch (_) {}

    // Dispatch notification
    const senderPayload = {
      id: authUser.id,
      name: senderName,
      role: senderRole,
      roleLabel: senderRoleLabel,
      avatar: senderAvatar,
    };

    if (isOwner) {
      // Student sent reply -> notify instructor
      console.log('[PrivateConsultation Reply] Notifying instructor:', consultation.instructorId);
      await dispatchNotification({
        recipientId: consultation.instructorId,
        title: 'رسالة جديدة في الاستشارة السرية',
        message: 'أرسل الطالب ' + senderName + ' رداً في استشارة: ' + consultation.subject,
        type: 'private_consultation',
        link: '/instructor/consultations',
        courseName: consultation.courseName,
        sender: senderPayload,
      });
    } else {
      // Instructor/Admin replied -> notify student!
      console.log('[PrivateConsultation Reply] Notifying student:', consultation.studentId);
      await dispatchNotification({
        recipientId: consultation.studentId,
        title: '✨ أجاب المستشار على استشارتك السرية',
        message: 'قام المستشار ' + senderName + ' بالرد على استشارتك: ' + consultation.subject,
        type: 'private_consultation',
        link: '/my-courses/' + courseSlugOrId + '?tab=consultation',
        courseName: consultation.courseName,
        sender: senderPayload,
      });
    }

    res.status(200).json({
      success: true,
      message: "تم إرسال الرد بنجاح",
      consultation,
    });
  } catch (err: any) {
    console.error("Reply consultation error:", err);
    res.status(500).json({ success: false, message: err.message || "فشل إرسال الرد" });
  }
};

// 6. Update consultation status (open / answered / closed)
export const updateConsultationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const { id } = req.params;
    const { status } = req.body;

    if (!["open", "answered", "closed"].includes(status)) {
      res.status(400).json({ success: false, message: "الحالة غير صالحة" });
      return;
    }

    const consultation = await PrivateConsultation.findById(id);
    if (!consultation) {
      res.status(404).json({ success: false, message: "الاستشارة غير موجودة" });
      return;
    }

    const role = authUser.role;
    if (role !== "admin" && consultation.instructorId !== authUser.id && consultation.studentId !== authUser.id) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    consultation.status = status;
    await consultation.save();

    res.status(200).json({ success: true, message: "تم تحديث حالة الاستشارة", consultation });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "فشل تحديث الحالة" });
  }
};
