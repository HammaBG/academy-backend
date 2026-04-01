import { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

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
