import { Router } from 'express';
import { 
  signUp, 
  signIn, 
  getProfile, 
  getAllUsers, 
  updateUser, 
  getPublicInstructors, 
  updateProfile, 
  getInstructorById,
  forgotPassword,
  resetPassword
} from '../controllers/auth.controller';
import { requireAuth, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Public auth routes
router.post('/signup', signUp);
router.post('/login', signIn);
router.get('/instructors', getPublicInstructors);
router.get('/instructors/:id', getInstructorById);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes (requires valid Bearer token)
router.get('/profile', requireAuth as any, getProfile);
router.put('/update-profile', requireAuth as any, updateProfile as any);

// Admin-only routes
router.get('/users', requireAuth as any, isAdmin as any, getAllUsers);
router.put('/users/:id', requireAuth as any, isAdmin as any, updateUser);

export default router;
