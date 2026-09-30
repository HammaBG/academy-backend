import { Request, Response } from "express";
import { Ticket, createTicketSchema, updateTicketStatusSchema } from "../models/ticket.model";
import { User } from "../models/user.model";

export const createTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const validatedData = createTicketSchema.parse(req.body);

    const dbUser = await User.findById(authUser.id);
    const fullName = dbUser
      ? `${dbUser.first_name || ""} ${dbUser.last_name || ""}`.trim() || "طالب الأكاديمية"
      : authUser.user_metadata?.first_name || authUser.name || "طالب الأكاديمية";
    const email = dbUser?.email || authUser.email || "";
    const phone = validatedData.userPhone || dbUser?.phone || "";

    const newTicket = await Ticket.create({
      userId: authUser.id,
      userEmail: email,
      userName: fullName,
      userPhone: phone,
      subject: validatedData.subject,
      category: validatedData.category,
      currentLevel: validatedData.currentLevel,
      goalOrIssue: validatedData.goalOrIssue,
      preferredTime: validatedData.preferredTime,
      status: "pending",
      priority: "medium",
      replies: [],
    });

    res.status(201).json({
      success: true,
      message: "تم إرسال تذكرة الاستشارة بنجاح، سيقوم المستشار بمراجعتها والرد عليك قريباً",
      ticket: newTicket,
    });
  } catch (error: any) {
    console.error("Create ticket error:", error);
    if (error.errors) {
      res.status(400).json({ success: false, message: error.errors[0]?.message || "Validation Error" });
      return;
    }
    res.status(500).json({ success: false, message: error.message || "Failed to create ticket" });
  }
};

export const getMyTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const tickets = await Ticket.find({ userId: authUser.id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      tickets,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch tickets" });
  }
};

export const getSingleTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const { id } = req.params;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }

    const role = authUser.role || authUser.user_metadata?.role;
    if (role !== "admin" && role !== "instructor" && ticket.userId !== authUser.id) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    res.status(200).json({
      success: true,
      ticket,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch ticket" });
  }
};

export const addReplyToTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({ success: false, message: "الرسالة مطلوبة" });
      return;
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }

    const role = authUser.role || authUser.user_metadata?.role;
    const isAdminOrInstructor = role === "admin" || role === "instructor";

    if (!isAdminOrInstructor && ticket.userId !== authUser.id) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const dbUser = await User.findById(authUser.id);
    const senderName = dbUser
      ? `${dbUser.first_name || ""} ${dbUser.last_name || ""}`.trim() || (isAdminOrInstructor ? "مستشار الأكاديمية" : "طالب")
      : authUser.name || (isAdminOrInstructor ? "مستشار الأكاديمية" : "طالب");

    ticket.replies.push({
      senderId: authUser.id,
      senderName,
      senderRole: isAdminOrInstructor ? "admin" : "user",
      message: message.trim(),
      createdAt: new Date(),
    });

    if (isAdminOrInstructor && ticket.status === "pending") {
      ticket.status = "in_progress";
    }

    await ticket.save();

    res.status(200).json({
      success: true,
      message: "تم إضافة الرد بنجاح",
      ticket,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to add reply" });
  }
};

export const getAllTicketsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, category, priority, search } = req.query;

    const query: any = {};

    if (status && status !== "all") {
      query.status = status;
    }
    if (category && category !== "all") {
      query.category = category;
    }
    if (priority && priority !== "all") {
      query.priority = priority;
    }
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: "i" } },
        { userName: { $regex: search, $options: "i" } },
        { userEmail: { $regex: search, $options: "i" } },
        { goalOrIssue: { $regex: search, $options: "i" } },
      ];
    }

    const tickets = await Ticket.find(query).sort({ createdAt: -1 });

    const stats = {
      total: await Ticket.countDocuments(),
      pending: await Ticket.countDocuments({ status: "pending" }),
      in_progress: await Ticket.countDocuments({ status: "in_progress" }),
      resolved: await Ticket.countDocuments({ status: "resolved" }),
      closed: await Ticket.countDocuments({ status: "closed" }),
    };

    res.status(200).json({
      success: true,
      tickets,
      stats,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch admin tickets" });
  }
};

export const updateTicketStatusAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const validatedData = updateTicketStatusSchema.parse(req.body);

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }

    if (validatedData.status) ticket.status = validatedData.status;
    if (validatedData.priority) ticket.priority = validatedData.priority;
    if (validatedData.adminNotes !== undefined) ticket.adminNotes = validatedData.adminNotes;

    await ticket.save();

    res.status(200).json({
      success: true,
      message: "تم تحديث حالة التذكرة بنجاح",
      ticket,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to update ticket" });
  }
};

export const deleteTicketAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findByIdAndDelete(id);
    if (!ticket) {
      res.status(404).json({ success: false, message: "Ticket not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "تم حذف التذكرة بنجاح",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to delete ticket" });
  }
};
