import mongoose, { Schema } from "mongoose";

const NoteSchema = new Schema(
    {
        user_id: { type: String, required: true, index: true },
        course_id: { type: String, required: true, index: true },
        course_name: { type: String, required: true },
        section_id: { type: String, required: true },
        section_title: { type: String, required: true },
        video_url: { type: String, default: "" },
        thumbnail_url: { type: String, default: "" },
        timestamp_seconds: { type: Number, required: true, default: 0 },
        time_formatted: { type: String, required: true, default: "00:00" },
        text: { type: String, required: true }
    },
    { timestamps: true }
);

export const Note = mongoose.models.Note || mongoose.model("Note", NoteSchema);
