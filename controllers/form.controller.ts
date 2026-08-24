import { Request, Response } from "express";
import {
  createFormSchema,
  updateFormSchema,
  IForm,
  INote,
  Form as FormModel
} from "../models/form.model";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const VALID_STATUSES = [
  'pending',
  'contacted',
  'completed',
  'not-interested',
  'not-available',
  'callback',
  'delivered',
  'not-delivered',
] as const;

// Helper: map MongoDB document to frontend structure
const toCamelCase = (data: any): IForm => {
  const doc = data.toObject ? data.toObject() : data;
  return {
    id: doc._id.toString(),
    fullName: doc.fullName,
    address: doc.address,
    phoneNumber: doc.phoneNumber,
    email: doc.email,
    courseName: doc.courseName,
    coursePrice: Number(doc.coursePrice),
    courseId: doc.courseId,
    status: doc.status,
    notes: doc.notes || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

/**
 * Create form submission
 */
export const createForm = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createFormSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
      return;
    }

    const newForm = new FormModel(parsed.data);
    await newForm.save();

    res.status(201).json({
      success: true,
      message: "Form submitted successfully! We will contact you soon.",
      data: toCamelCase(newForm),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

/**
 * Get all form submissions
 */
export const getAllForms = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, courseId } = req.query;

    const filter: any = {};
    if (status && VALID_STATUSES.includes(status as any)) {
      filter.status = status;
    }
    if (courseId) {
      filter.courseId = courseId;
    }

    const forms = await FormModel.find(filter).sort({ createdAt: -1 });

    if (!forms || forms.length === 0) {
      res.status(404).json({ success: false, error: "No form submissions found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Form submissions retrieved successfully",
      data: forms.map(toCamelCase),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

/**
 * Get form by ID
 */
export const getFormById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const form = await FormModel.findById(id);
    if (!form) {
      res.status(404).json({ success: false, error: "Form submission not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Form submission retrieved successfully",
      data: toCamelCase(form),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

/**
 * Update form submission
 */
export const updateForm = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const form = await FormModel.findById(id);
    if (!form) {
      res.status(404).json({ success: false, error: "Form submission not found" });
      return;
    }

    const parsed = updateFormSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
      return;
    }

    const updateBody = parsed.data;

    if (updateBody.status !== undefined) form.status = updateBody.status;
    if (updateBody.fullName !== undefined) form.fullName = updateBody.fullName;
    if (updateBody.address !== undefined) form.address = updateBody.address;
    if (updateBody.phoneNumber !== undefined) form.phoneNumber = updateBody.phoneNumber;
    if (updateBody.email !== undefined) form.email = updateBody.email;
    if (updateBody.courseName !== undefined) form.courseName = updateBody.courseName;
    if (updateBody.coursePrice !== undefined) form.coursePrice = updateBody.coursePrice;
    if (updateBody.courseId !== undefined) form.courseId = updateBody.courseId;

    await form.save();

    res.status(200).json({
      success: true,
      message: "Form submission updated successfully",
      data: toCamelCase(form),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

/**
 * Delete form submission
 */
export const deleteForm = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const form = await FormModel.findByIdAndDelete(id);
    if (!form) {
      res.status(404).json({ success: false, error: "Form submission not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Form submission deleted successfully",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

/**
 * Get form statistics
 */
export const getFormStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const forms = await FormModel.find();
    const total = forms.length;

    const statusCounts: Record<string, number> = {
      pending: 0,
      contacted: 0,
      completed: 0,
      'not-interested': 0,
      'not-available': 0,
      callback: 0,
      delivered: 0,
      'not-delivered': 0,
    };

    let lastWeek = 0;
    let todayCount = 0;

    const courseStatsMap: Record<string, any> = {};

    forms.forEach((form: any) => {
      const status = form.status;
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }

      const createdAtDate = new Date(form.createdAt);
      if (createdAtDate >= sevenDaysAgo) {
        lastWeek++;
      }
      if (createdAtDate >= today) {
        todayCount++;
      }

      const cId = form.courseId;
      if (!courseStatsMap[cId]) {
        courseStatsMap[cId] = {
          _id: cId,
          courseName: form.courseName,
          totalSubmissions: 0,
          totalRevenue: 0,
          pending: 0,
          contacted: 0,
          completed: 0,
          notInterested: 0,
          notAvailable: 0,
          callback: 0,
          delivered: 0,
          notDelivered: 0,
        };
      }

      const cStat = courseStatsMap[cId];
      cStat.totalSubmissions++;
      cStat.totalRevenue += Number(form.coursePrice || 0);
      
      if (status === 'pending') cStat.pending++;
      else if (status === 'contacted') cStat.contacted++;
      else if (status === 'completed') cStat.completed++;
      else if (status === 'not-interested') cStat.notInterested++;
      else if (status === 'not-available') cStat.notAvailable++;
      else if (status === 'callback') cStat.callback++;
      else if (status === 'delivered') cStat.delivered++;
      else if (status === 'not-delivered') cStat.notDelivered++;
    });

    const courseStats = Object.values(courseStatsMap).sort((a: any, b: any) => b.totalSubmissions - a.totalSubmissions);

    res.status(200).json({
      success: true,
      message: "Form statistics retrieved successfully",
      data: {
        total,
        pending: statusCounts['pending'],
        contacted: statusCounts['contacted'],
        completed: statusCounts['completed'],
        notInterested: statusCounts['not-interested'],
        notAvailable: statusCounts['not-available'],
        callback: statusCounts['callback'],
        delivered: statusCounts['delivered'],
        notDelivered: statusCounts['not-delivered'],
        lastWeek,
        today: todayCount,
        courseStats,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

/**
 * Get forms by course ID
 */
export const getFormsByCourseId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { status } = req.query;

    const filter: any = { courseId };
    if (status && VALID_STATUSES.includes(status as any)) {
      filter.status = status;
    }

    const forms = await FormModel.find(filter).sort({ createdAt: -1 });

    if (forms.length === 0) {
      res.status(404).json({ success: false, error: "No form submissions found for this course" });
      return;
    }

    const courseStat = {
      _id: courseId,
      courseName: forms[0].courseName,
      totalSubmissions: 0,
      totalRevenue: 0,
      pending: 0,
      contacted: 0,
      completed: 0,
      notInterested: 0,
      notAvailable: 0,
      callback: 0,
      delivered: 0,
      notDelivered: 0,
    };

    forms.forEach((form: any) => {
      courseStat.totalSubmissions++;
      courseStat.totalRevenue += Number(form.coursePrice || 0);
      const s = form.status;
      if (s === 'pending') courseStat.pending++;
      else if (s === 'contacted') courseStat.contacted++;
      else if (s === 'completed') courseStat.completed++;
      else if (s === 'not-interested') courseStat.notInterested++;
      else if (s === 'not-available') courseStat.notAvailable++;
      else if (s === 'callback') courseStat.callback++;
      else if (s === 'delivered') courseStat.delivered++;
      else if (s === 'not-delivered') courseStat.notDelivered++;
    });

    res.status(200).json({
      success: true,
      message: "Course form submissions retrieved successfully",
      data: forms.map(toCamelCase),
      courseStats: courseStat,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

/**
 * Add note to a form submission
 */
export const addNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      res.status(400).json({ success: false, error: "Note text is required" });
      return;
    }

    const form = await FormModel.findById(id);

    if (!form) {
      res.status(404).json({ success: false, error: "Form submission not found" });
      return;
    }

    const notesList = form.notes || [];
    const newNote = {
      text: text.trim(),
      createdAt: new Date()
    };

    notesList.push(newNote as any);
    form.notes = notesList;
    await form.save();

    res.status(200).json({
      success: true,
      message: "Note added successfully",
      data: form.notes || [],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

/**
 * Get all notes from a form submission
 */
export const getNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const form = await FormModel.findById(id);

    if (!form) {
      res.status(404).json({ success: false, error: "Form submission not found" });
      return;
    }

    const notes = form.notes || [];

    const sortedNotes = notes.sort((a: any, b: any) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    res.status(200).json({
      success: true,
      message: "Notes retrieved successfully",
      data: sortedNotes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

/**
 * Delete a note from a form submission
 */
export const deleteNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, noteId } = req.params;

    const form = await FormModel.findById(id);

    if (!form) {
      res.status(404).json({ success: false, error: "Form submission not found" });
      return;
    }

    const notesList = form.notes || [];
    
    const noteIndex = notesList.findIndex((note: any, index: number) => {
      if (note._id) return note._id.toString() === noteId;
      return index.toString() === noteId;
    });

    if (noteIndex === -1) {
      res.status(404).json({ success: false, error: "Note not found" });
      return;
    }

    notesList.splice(noteIndex, 1);
    form.notes = notesList;
    await form.save();

    res.status(200).json({
      success: true,
      message: "Note deleted successfully",
      data: form.notes || [],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};

export default {
  createForm,
  getAllForms,
  getFormById,
  updateForm,
  deleteForm,
  getFormStats,
  getFormsByCourseId,
  addNote,
  getNotes,
  deleteNote
};
