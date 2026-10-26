import mongoose, { Schema } from 'mongoose';

const LessonProgressSchema = new Schema({
  lessonKey: { type: String, required: true },
  lastPosition: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  watchedSeconds: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const WatchLogSchema = new Schema({
  date: { type: String, required: true },
  seconds: { type: Number, default: 0 }
}, { _id: false });

const CourseProgressSchema = new Schema({
  courseId: { type: String, required: true },
  progress: { type: Number, default: 0 },
  completedVideos: { type: [String], default: [] },
  lessons: { type: [LessonProgressSchema], default: [] },
  totalWatchedSeconds: { type: Number, default: 0 }
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
  watchLog: { type: [WatchLogSchema], default: [] },
  resetPasswordToken: { type: String, default: '' },
  resetPasswordExpires: { type: Date }
}, {
  timestamps: true,
  versionKey: false
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
