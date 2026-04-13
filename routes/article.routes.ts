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
import { requireAuth, isAdmin } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

// All article routes require auth + admin
router.post('/', requireAuth, isAdmin, upload.single('image'), createArticle);
router.get('/public', getPublicArticles);
router.get('/public/:id', getPublicArticleById);
router.get('/', requireAuth, isAdmin, getAllArticles);


router.get('/:id', requireAuth, isAdmin, getArticleById);
router.put('/:id', requireAuth, isAdmin, upload.single('image'), updateArticle);
router.delete('/:id', requireAuth, isAdmin, deleteArticle);

export default router;
