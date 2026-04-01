import { Router } from 'express';
import { signUp, signIn, getProfile } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Public auth routes
router.post('/signup', signUp);
router.post('/login', signIn);

// Protected routes (requires valid Bearer token)
router.get('/profile', requireAuth, getProfile);

export default router;
