import { Router } from 'express';
import { signUp, signIn, getProfile, getAllUsers } from '../controllers/auth.controller';
import { requireAuth, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Public auth routes
router.post('/signup', signUp);
router.post('/login', signIn);

// Protected routes (requires valid Bearer token)
router.get('/profile', requireAuth, getProfile);

// Admin-only routes
router.get('/users', requireAuth, isAdmin, getAllUsers);

export default router;
