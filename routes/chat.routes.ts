import express from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { getCourseMessages, deleteCourseMessage } from '../controllers/chat.controller';

const chatRouter = express.Router();

chatRouter.get('/:courseId/messages', requireAuth, getCourseMessages);
chatRouter.delete('/:courseId/messages/:messageId', requireAuth, deleteCourseMessage);

export default chatRouter;
