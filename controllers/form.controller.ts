import { Request, Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import {
  createFormSchema,
  updateFormSchema,
  IForm,
  INote
} from "../models/form.model";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

// Valid statuses
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

// Helper: map frontend camelCase object to Postgres snake_case
const toSnakeCase = (data: any) => ({
  full_name: data.fullName,
  address: data.address,
  phone_number: data.phoneNumber,
  email: data.email || '',
  course_name: data.courseName,
  course_price: data.coursePrice,
  course_id: data.courseId,
  status: data.status || 'pending',
  notes: data.notes || [],
});

// Helper: map Postgres snake_case object to frontend camelCase
const toCamelCase = (data: any): IForm => ({
  id: data.id,
  fullName: data.full_name,
  address: data.address,
  phoneNumber: data.phone_number,
  email: data.email,
  courseName: data.course_name,
  coursePrice: Number(data.course_price),
  courseId: data.course_id,
  status: data.status,
  notes: data.notes || [],
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

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

    const snakeData = toSnakeCase(parsed.data);

    const { data, error } = await supabaseAdmin
      .from('forms')
      .insert(snakeData)
      .select()
      .single();

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.status(201).json({
      success: true,
      message: "Form submitted successfully! We will contact you soon.",
      data: toCamelCase(data),
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

    let query = supabaseAdmin.from('forms').select('*');

    if (status && VALID_STATUSES.includes(status as any)) {
      query = query.eq('status', status);
    }
    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    if (!data || data.length === 0) {
      res.status(404).json({ success: false, error: "No form submissions found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Form submissions retrieved successfully",
      data: data.map(toCamelCase),
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

    const { data, error } = await supabaseAdmin
      .from('forms')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: "Form submission not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Form submission retrieved successfully",
      data: toCamelCase(data),
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
    const userRole = req.user?.user_metadata?.role;

    const { data: existingForm, error: fetchError } = await supabaseAdmin
      .from('forms')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingForm) {
      res.status(404).json({ success: false, error: "Form submission not found" });
      return;
    }

    const parsed = updateFormSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.format() });
      return;
    }

    const updateBody = parsed.data;

    const updateData = {
      ...(updateBody.status && { status: updateBody.status }),
      ...(updateBody.fullName && { full_name: updateBody.fullName }),
      ...(updateBody.address && { address: updateBody.address }),
      ...(updateBody.phoneNumber && { phone_number: updateBody.phoneNumber }),
      ...(updateBody.email !== undefined && { email: updateBody.email }),
      ...(updateBody.courseName && { course_name: updateBody.courseName }),
      ...(updateBody.coursePrice !== undefined && { course_price: updateBody.coursePrice }),
      ...(updateBody.courseId && { course_id: updateBody.courseId }),
    };

    const { data: updatedForm, error: updateError } = await supabaseAdmin
      .from('forms')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      res.status(400).json({ success: false, error: updateError.message });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Form submission updated successfully",
      data: toCamelCase(updatedForm),
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

    const { data: existingForm, error: fetchError } = await supabaseAdmin
      .from('forms')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingForm) {
      res.status(404).json({ success: false, error: "Form submission not found" });
      return;
    }

    const { error: deleteError } = await supabaseAdmin
      .from('forms')
      .delete()
      .eq('id', id);

    if (deleteError) {
      res.status(400).json({ success: false, error: deleteError.message });
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

    const { data: allForms, error } = await supabaseAdmin
      .from('forms')
      .select('*');

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    const forms = allForms || [];
    const total = forms.length;

    // Status counts
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

    // Course group counts
    const courseStatsMap: Record<string, any> = {};

    forms.forEach((form: any) => {
      const status = form.status;
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }

      const createdAtDate = new Date(form.created_at);
      if (createdAtDate >= sevenDaysAgo) {
        lastWeek++;
      }
      if (createdAtDate >= today) {
        todayCount++;
      }

      // Group by courseId
      const cId = form.course_id;
      if (!courseStatsMap[cId]) {
        courseStatsMap[cId] = {
          _id: cId,
          courseName: form.course_name,
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
      cStat.totalRevenue += Number(form.course_price || 0);
      
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

    let query = supabaseAdmin.from('forms').select('*').eq('course_id', courseId);

    if (status && VALID_STATUSES.includes(status as any)) {
      query = query.eq('status', status);
    }

    const { data: formsData, error: fetchError } = await query.order('created_at', { ascending: false });

    if (fetchError) {
      res.status(400).json({ success: false, error: fetchError.message });
      return;
    }

    const forms = formsData || [];
    if (forms.length === 0) {
      res.status(404).json({ success: false, error: "No form submissions found for this course" });
      return;
    }

    // Stats for this course
    const courseStat = {
      _id: courseId,
      courseName: forms[0].course_name,
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
      courseStat.totalRevenue += Number(form.course_price || 0);
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

    const { data: form, error: fetchError } = await supabaseAdmin
      .from('forms')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !form) {
      res.status(404).json({ success: false, error: "Form submission not found" });
      return;
    }

    const notesList: INote[] = form.notes || [];
    const newNote: INote = {
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    notesList.push(newNote);

    const { data: updatedForm, error: updateError } = await supabaseAdmin
      .from('forms')
      .update({ notes: notesList })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      res.status(400).json({ success: false, error: updateError.message });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Note added successfully",
      data: updatedForm.notes || [],
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

    const { data: form, error: fetchError } = await supabaseAdmin
      .from('forms')
      .select('notes')
      .eq('id', id)
      .single();

    if (fetchError || !form) {
      res.status(404).json({ success: false, error: "Form submission not found" });
      return;
    }

    const notes: INote[] = form.notes || [];

    // Sort notes descending by createdAt
    const sortedNotes = notes.sort((a, b) => {
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

    const { data: form, error: fetchError } = await supabaseAdmin
      .from('forms')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !form) {
      res.status(404).json({ success: false, error: "Form submission not found" });
      return;
    }

    const notesList: any[] = form.notes || [];
    
    // Find note by checking matching index or matching an ID if provided
    const noteIndex = notesList.findIndex((note: any, index: number) => {
      if (note.id) return note.id === noteId;
      // Fallback: match by index if noteId is a valid index number
      return index.toString() === noteId;
    });

    if (noteIndex === -1) {
      res.status(404).json({ success: false, error: "Note not found" });
      return;
    }

    notesList.splice(noteIndex, 1);

    const { data: updatedForm, error: updateError } = await supabaseAdmin
      .from('forms')
      .update({ notes: notesList })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      res.status(400).json({ success: false, error: updateError.message });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Note deleted successfully",
      data: updatedForm.notes || [],
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
