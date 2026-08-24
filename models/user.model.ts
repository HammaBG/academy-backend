import mongoose, { Schema } from 'mongoose';

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
  resetPasswordToken: { type: String, default: '' },
  resetPasswordExpires: { type: Date }
}, {
  timestamps: true
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
