import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase, supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

// ... (existing schemas and controllers)

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Validation schemas with Zod
const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  phone: z.string().optional(),
  role: z.enum(['user', 'instructor', 'admin']).default('user'),
});

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const signUp = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsedData = signUpSchema.safeParse(req.body);
    
    if (!parsedData.success) {
      res.status(400).json({ error: 'Validation failed', details: parsedData.error.format() });
      return;
    }

    const { email, password, firstName, lastName, phone, role } = parsedData.data;

    // Pass the extra metadata inside 'options.data'
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          role: role
        }
      }
    });
    
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    
    res.status(201).json({ message: 'User signed up successfully', data });
  } catch (err) {
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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    
    res.status(200).json({ message: 'User signed in successfully', data });
  } catch (err) {
    res.status(500).json({ error: 'Sign in failed' });
  }
};

// Example protected route handler
export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // The 'user' is populated by requireAuth middleware
  const user = req.user;
  res.status(200).json({ 
    message: 'This is a protected route. You are authenticated!', 
    user 
  });
};

import { cloudinary } from '../config/cloudinary';

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, title, avatar_url } = req.body;

    let finalAvatarUrl = avatar_url;

    // Fast check if avatar_url is Base64 image
    if (avatar_url && avatar_url.startsWith('data:image')) {
       const myCloud = await cloudinary.uploader.upload(avatar_url, {
         folder: "users",
       });
       finalAvatarUrl = myCloud.secure_url;
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(id as string, {
      user_metadata: { 
        ...(role && { role }),
        ...(title && { title }),
        ...(finalAvatarUrl && { avatar_url: finalAvatarUrl })
      }
    });

    if (authError) {
      res.status(400).json({ error: authError.message });
      return;
    }

    // Attempt to update public users table safely
    const updateData: any = { id };
    if (role) updateData.role = role;
    if (title) updateData.title = title;
    if (finalAvatarUrl) updateData.avatar_url = finalAvatarUrl;
    
    // Supplement with current metadata
    const userMeta = authData.user.user_metadata;
    if (userMeta?.first_name) updateData.first_name = userMeta.first_name;
    if (userMeta?.last_name) updateData.last_name = userMeta.last_name;

    if (Object.keys(updateData).length > 1) {
      await supabaseAdmin.from('users').upsert(updateData);
    }

    res.status(200).json({ message: 'User updated successfully', user: authData.user });
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
    const { title, avatar_url } = req.body;

    let finalAvatarUrl = avatar_url;

    // Fast check if avatar_url is Base64 image
    if (avatar_url && avatar_url.startsWith('data:image')) {
       const myCloud = await cloudinary.uploader.upload(avatar_url, {
         folder: "users",
       });
       finalAvatarUrl = myCloud.secure_url;
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: { 
        ...(title && { title }),
        ...(finalAvatarUrl && { avatar_url: finalAvatarUrl })
      }
    });

    if (authError) {
      res.status(400).json({ error: authError.message });
      return;
    }

    // Update public users table
    const updateData: any = { id };
    if (title) updateData.title = title;
    if (finalAvatarUrl) updateData.avatar_url = finalAvatarUrl;

    // Supplement with current metadata
    const userMeta = authData.user.user_metadata;
    if (userMeta?.first_name) updateData.first_name = userMeta.first_name;
    if (userMeta?.last_name) updateData.last_name = userMeta.last_name;

    if (Object.keys(updateData).length > 1) {
      await supabaseAdmin.from('users').upsert(updateData);
    }

    res.status(200).json({ message: 'Profile updated successfully', user: authData.user });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getPublicInstructors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
       res.status(400).json({ error: error.message });
       return;
    }

    const instructors = users
      .filter(u => u.user_metadata?.role === 'instructor')
      .map(u => ({
        id: u.id,
        first_name: u.user_metadata?.first_name || '',
        last_name: u.user_metadata?.last_name || '',
        avatar_url: u.user_metadata?.avatar_url || '',
        title: u.user_metadata?.title || ''
      }));

    res.status(200).json({ instructors });
  } catch (err) {
    console.error("Fetch Instructors Error:", err);
    res.status(500).json({ error: 'Failed to fetch instructors' });
  }
};
