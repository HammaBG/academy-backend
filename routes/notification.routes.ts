import express from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} from '../controllers/notification.controller';

const router = express.Router();

router.get('/', requireAuth, getUserNotifications);
router.put('/read-all', requireAuth, markAllAsRead);
router.put('/:id/read', requireAuth, markAsRead);
router.delete('/clear-all', requireAuth, clearAllNotifications);
router.delete('/:id', requireAuth, deleteNotification);

export default router;
