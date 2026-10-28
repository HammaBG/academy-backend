import { Request, Response } from 'express';
import { Notification } from '../models/notification.model';
import { getIO } from '../config/socket';

export const getUserNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser || !authUser.id) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const notifications = await Notification.find({ recipientId: authUser.id })
      .sort({ createdAt: -1 })
      .limit(60);

    const unreadCount = await Notification.countDocuments({
      recipientId: authUser.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err: any) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch notifications' });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const { id } = req.params;

    await Notification.updateOne(
      { _id: id, recipientId: authUser.id },
      { $set: { isRead: true } }
    );

    res.status(200).json({ success: true, message: 'Marked as read' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    await Notification.updateMany(
      { recipientId: authUser.id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ success: true, message: 'All marked as read' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const { id } = req.params;

    await Notification.deleteOne({ _id: id, recipientId: authUser.id });
    res.status(200).json({ success: true, message: 'Deleted notification' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const clearAllNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    await Notification.deleteMany({ recipientId: authUser.id });
    res.status(200).json({ success: true, message: 'Cleared all notifications' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper function to dispatch persistent notification + real-time Socket.IO event
export const dispatchNotification = async (params: {
  recipientId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  courseName?: string;
  sender: {
    id: string;
    name: string;
    role: string;
    roleLabel?: string;
    avatar?: string;
  };
}) => {
  try {
    const notif = await Notification.create({
      recipientId: params.recipientId,
      title: params.title,
      message: params.message,
      type: params.type,
      link: params.link || '',
      courseName: params.courseName || '',
      sender: params.sender,
      isRead: false,
      createdAt: new Date(),
    });

    const io = getIO();
    if (io) {
      const payload = {
        id: notif._id.toString(),
        title: notif.title,
        message: notif.message,
        type: notif.type,
        link: notif.link,
        courseName: notif.courseName,
        sender: notif.sender,
        isRead: false,
        createdAt: notif.createdAt.toISOString(),
      };
      const room = 'user:' + params.recipientId;
      console.log('[Notification Dispatch] Emitting socket to room', room, payload.title);
      io.to(room).emit('new_chat_notification', payload);
    } else {
      console.warn('[Notification Dispatch] Socket.IO instance not available');
    }

    return notif;
  } catch (err) {
    console.error('[Notification Dispatch Error]:', err);
    return null;
  }
};
