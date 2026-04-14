import { Router } from 'express';
import { signUp, signIn, getProfile, getAllUsers, updateUser, getPublicInstructors } from '../controllers/auth.controller';
import { requireAuth, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Public auth routes
router.post('/signup', signUp);
router.post('/login', signIn);
router.get('/instructors', getPublicInstructors);

// Protected routes (requires valid Bearer token)
router.get('/profile', requireAuth as any, getProfile);

// Admin-only routes
router.get('/users', requireAuth as any, isAdmin as any, getAllUsers);
router.put('/users/:id', requireAuth as any, isAdmin as any, updateUser);

export default router;
