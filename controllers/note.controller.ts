import { Response, NextFunction } from "express";
import { CatchAsyncError } from "../utils/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { Note as NoteModel } from "../models/note.model";

export const createNote = CatchAsyncError(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return next(new ErrorHandler("User not found", 401));

    const { courseId, courseName, sectionId, sectionTitle, videoUrl, thumbnailUrl, timestampSeconds, timeFormatted, text } = req.body;
    if (!text || !courseId || !sectionId) {
        return next(new ErrorHandler("Missing required fields", 400));
    }

    const note = await NoteModel.create({
        user_id: userId,
        course_id: courseId,
        course_name: courseName,
        section_id: sectionId,
        section_title: sectionTitle,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        timestamp_seconds: timestampSeconds,
        time_formatted: timeFormatted,
        text
    });

    res.status(201).json({ success: true, note });
});

export const getUserNotes = CatchAsyncError(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return next(new ErrorHandler("User not found", 401));

    const notes = await NoteModel.find({ user_id: userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, notes });
});

export const deleteNote = CatchAsyncError(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const { id } = req.params;

    await NoteModel.findOneAndDelete({ _id: id, user_id: userId });
    res.status(200).json({ success: true, message: "Note deleted" });
});
