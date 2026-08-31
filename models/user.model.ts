import mongoose, { Schema } from 'mongoose';

const CourseProgressSchema = new Schema({
  courseId: { type: String, required: true },
  progress: { type: Number, default: 0 },
  completedVideos: { type: [String], default: [] }
});

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  phone: { type: String },
  role: { type: String, enum: ['user', 'instructor', 'admin'], default: 'user' },
  avatar_url: { type: String, default: '' },
  title: { type: String, default: '' },
  bio: { type: String, default: '' },
  linkedin_url: { type: String, default: '' },
  courses: { type: [String], default: [] },
  coursesProgress: { type: [CourseProgressSchema], default: [] },
  resetPasswordToken: { type: String, default: '' },
  resetPasswordExpires: { type: Date }
}, {
  timestamps: true,
  versionKey: false
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
