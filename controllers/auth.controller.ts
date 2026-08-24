import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User as UserModel } from '../models/user.model';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { cloudinary } from '../config/cloudinary';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/email.service';

const JWT_SECRET = process.env.JWT_SECRET || "d3d8c11e7401d4b6cbdeca781938fae6eb5b01859bf5db0e97d4c2b9a71bcf23";

// Validation schemas with Zod
const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  phone: z.string().min(8, 'Phone number must be at least 8 digits'),
  role: z.enum(['user', 'instructor', 'admin']).default('user'),
});

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const dbUsers = await UserModel.find().select('-password');
    const users = dbUsers.map(u => ({
      id: u._id.toString(),
      email: u.email,
      user_metadata: {
        first_name: u.first_name,
        last_name: u.last_name,
        role: u.role,
        avatar_url: u.avatar_url,
        phone: u.phone,
        title: u.title,
        bio: u.bio,
        linkedin_url: u.linkedin_url
      }
    }));
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const signUp = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedData = signUpSchema.safeParse(req.body);

    if (!parsedData.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedData.error.format() });
      return;
    }

    const { email, password, firstName, lastName, phone, role } = parsedData.data;

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: 'Email is already registered' });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save user
    const newUser = new UserModel({
      email,
      password: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      phone,
      role
    });

    await newUser.save();

    // Trigger welcome email asynchronously (fire & forget)
    sendWelcomeEmail(email, `${firstName} ${lastName}`);

    // Generate JWT token automatically for instant authentication
    const token = jwt.sign(
      { id: newUser._id.toString(), role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Map response user matching frontend requirements
    const userData = {
      session: {
        access_token: token
      },
      user: {
        id: newUser._id.toString(),
        email: newUser.email,
        user_metadata: {
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          role: newUser.role,
          phone: newUser.phone,
          avatar_url: newUser.avatar_url,
          title: newUser.title,
          bio: newUser.bio,
          linkedin_url: newUser.linkedin_url
        }
      }
    };

    res.status(201).json({ message: 'User signed up successfully', data: userData });
  } catch (err: any) {
    console.error("Signup error:", err);
    res.status(500).json({ error: 'Sign up failed' });
  }
};

export const signIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedData = signInSchema.safeParse(req.body);

    if (!parsedData.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedData.error.format() });
      return;
    }

    const { email, password } = parsedData.data;

    const user = await UserModel.findOne({ email });
    if (!user) {
      res.status(400).json({ error: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const responseData = {
      session: {
        access_token: token
      },
      user: {
        id: user._id.toString(),
        email: user.email,
        user_metadata: {
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          phone: user.phone,
          avatar_url: user.avatar_url,
          title: user.title,
          bio: user.bio,
          linkedin_url: user.linkedin_url
        }
      }
    };

    res.status(200).json({ message: 'User signed in successfully', data: responseData });
  } catch (err) {
    console.error("Signin error:", err);
    res.status(500).json({ error: 'Sign in failed' });
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = req.user;
  res.status(200).json({
    message: 'Authenticated successfully!',
    user
  });
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, title, avatar_url } = req.body;

    let finalAvatarUrl = avatar_url;

    if (avatar_url && avatar_url.startsWith('data:image')) {
      const myCloud = await cloudinary.uploader.upload(avatar_url, {
        folder: "users",
      });
      finalAvatarUrl = myCloud.secure_url;
    }

    const user = await UserModel.findById(id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (role) user.role = role;
    if (title !== undefined) user.title = title;
    if (finalAvatarUrl !== undefined) user.avatar_url = finalAvatarUrl;

    await user.save();

    const supabaseStyleUser = {
      id: user._id.toString(),
      email: user.email,
      user_metadata: {
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        avatar_url: user.avatar_url,
        phone: user.phone,
        title: user.title,
        bio: user.bio,
        linkedin_url: user.linkedin_url
      }
    };

    res.status(200).json({ message: 'User updated successfully', user: supabaseStyleUser });
  } catch (err) {
    console.error("Update User Error:", err);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = user.id;
    const { title, avatar_url, bio, linkedin_url } = req.body;

    let finalAvatarUrl = avatar_url;

    if (avatar_url && avatar_url.startsWith('data:image')) {
      const myCloud = await cloudinary.uploader.upload(avatar_url, {
        folder: "users",
      });
      finalAvatarUrl = myCloud.secure_url;
    }

    const dbUser = await UserModel.findById(id);
    if (!dbUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (title !== undefined) dbUser.title = title;
    if (finalAvatarUrl !== undefined) dbUser.avatar_url = finalAvatarUrl;
    if (bio !== undefined) dbUser.bio = bio;
    if (linkedin_url !== undefined) dbUser.linkedin_url = linkedin_url;

    await dbUser.save();

    const supabaseStyleUser = {
      id: dbUser._id.toString(),
      email: dbUser.email,
      user_metadata: {
        first_name: dbUser.first_name,
        last_name: dbUser.last_name,
        role: dbUser.role,
        avatar_url: dbUser.avatar_url,
        phone: dbUser.phone,
        title: dbUser.title,
        bio: dbUser.bio,
        linkedin_url: dbUser.linkedin_url
      }
    };

    res.status(200).json({ message: 'Profile updated successfully', user: supabaseStyleUser });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getPublicInstructors = async (req: Request, res: Response): Promise<void> => {
  try {
    const instructors = await UserModel.find({ role: 'instructor' });

    const mappedInstructors = instructors.map(u => ({
      id: u._id.toString(),
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      avatar_url: u.avatar_url || '',
      title: u.title || ''
    }));

    res.status(200).json({ instructors: mappedInstructors });
  } catch (err) {
    console.error("Fetch Instructors Error:", err);
    res.status(500).json({ error: 'Failed to fetch instructors' });
  }
};

export const getInstructorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await UserModel.findOne({ _id: id, role: 'instructor' });
    if (!user) {
      res.status(404).json({ error: 'Instructor not found' });
      return;
    }

    const instructor = {
      id: user._id.toString(),
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      avatar_url: user.avatar_url || '',
      title: user.title || '',
      email: user.email || '',
      bio: user.bio || '',
      phone: user.phone || ''
    };

    res.status(200).json({ instructor });
  } catch (err) {
    console.error("Fetch Instructor Error:", err);
    res.status(500).json({ error: 'Failed to fetch instructor' });
  }
};

// POST /forgot-password
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      res.status(404).json({ error: "No account registered with this email" });
      return;
    }

    // Generate reset token (valid for 1 hour)
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

    await user.save();

    // Trigger email send
    sendPasswordResetEmail(email, token);

    res.status(200).json({ message: "Password reset link sent to your email" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to request password reset" });
  }
};

// POST /reset-password
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password, token } = req.body;
    if (!password || !token) {
      res.status(400).json({ error: "Password and token are required" });
      return;
    }

    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    user.resetPasswordToken = '';
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
};
