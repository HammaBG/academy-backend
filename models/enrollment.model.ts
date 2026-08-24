import mongoose, { Schema } from "mongoose";

const EnrollmentSchema = new Schema({
  user_id: { type: String, required: true },
  course_id: { type: String, required: true },
  progress: { type: Number, default: 0 }
}, {
  timestamps: true
});

EnrollmentSchema.index({ user_id: 1, course_id: 1 }, { unique: true });

export const Enrollment = mongoose.models.Enrollment || mongoose.model("Enrollment", EnrollmentSchema);
