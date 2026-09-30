import { Router } from 'express';
import {
  createArticle,
  getAllArticles,
  getPublicArticles,
  getPublicArticleById,
  getArticleById,
  updateArticle,
  deleteArticle,
} from '../controllers/article.controller';
import { requireAuth, authorizeRoles } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

// Public routes
router.get('/public', getPublicArticles);
router.get('/public/:id', getPublicArticleById);

// Protected routes - both admin and instructor can create and manage articles
router.post('/', requireAuth, authorizeRoles('admin', 'instructor'), upload.single('image'), createArticle);
router.get('/', requireAuth, authorizeRoles('admin', 'instructor'), getAllArticles);
router.get('/:id', requireAuth, authorizeRoles('admin', 'instructor'), getArticleById);
router.put('/:id', requireAuth, authorizeRoles('admin', 'instructor'), upload.single('image'), updateArticle);
router.delete('/:id', requireAuth, authorizeRoles('admin', 'instructor'), deleteArticle);

export default router;
