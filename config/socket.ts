import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User as UserModel } from '../models/user.model';
import { Course as CourseModel } from '../models/course.model';
import { ChatMessage } from '../models/chat.model';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    name: string;
    avatar: string;
    role: string;
  };
}

const activeCourseUsers = new Map<string, Map<string, { id: string; name: string; avatar: string; role: string }>>();

export const initSocketServer = (httpServer: HttpServer) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',')
        : ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const JWT_SECRET = process.env.JWT_SECRET;
      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
      }

      if (!decoded || !decoded.id) {
        return next(new Error('Authentication error: Invalid token payload'));
      }

      const user = await UserModel.findById(decoded.id);
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      const fullName = ((user.first_name || '') + ' ' + (user.last_name || '')).trim() || 'طالب الأكاديمية';

      socket.user = {
        id: user._id.toString(),
        email: user.email,
        name: fullName,
        avatar: user.avatar_url || '',
        role: user.role || 'user',
      };

      next();
    } catch (err: any) {
      next(new Error('Authentication error: ' + err.message));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user;
    if (!user) return;

    // Join private room for user-targeted notifications
    socket.join('user:' + user.id);

    socket.on('join_course_room', async ({ courseId }: { courseId: string }) => {
      try {
        if (!courseId) return;
        let course = null;
        if (courseId.match(/^[0-9a-fA-F]{24}$/)) {
          course = await CourseModel.findById(courseId);
        }
        if (!course) {
          course = await CourseModel.findOne({ url: courseId });
        }
        if (!course) {
          socket.emit('error_message', { message: 'Course not found' });
          return;
        }

        const canonicalCourseId = course._id.toString();
        const isInstructor = user.role === 'admin' || (user.role === 'instructor' && String(course.creator) === String(user.id)) || (String(course.creator) === String(user.id));
        const dbUser = await UserModel.findById(user.id);
        const isEnrolled = dbUser?.courses?.includes(canonicalCourseId) || dbUser?.courses?.includes(courseId);

        if (!isInstructor && !isEnrolled) {
          socket.emit('error_message', { message: 'You must be enrolled in this course to join the chat room' });
          return;
        }

        const roomName = 'course:' + courseId;
        socket.join(roomName);

        if (!activeCourseUsers.has(courseId)) {
          activeCourseUsers.set(courseId, new Map());
        }
        activeCourseUsers.get(courseId)!.set(socket.id, {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
        });

        const roomUsers = Array.from(activeCourseUsers.get(courseId)!.values());
        const uniqueUsers = Array.from(new Map(roomUsers.map((u) => [u.id, u])).values());

        io.to(roomName).emit('room_users_updated', {
          courseId,
          count: uniqueUsers.length,
          users: uniqueUsers,
        });

        socket.emit('joined_room_success', {
          courseId,
          onlineCount: uniqueUsers.length,
        });
      } catch (err: any) {
        socket.emit('error_message', { message: err.message });
      }
    });

    socket.on('leave_course_room', ({ courseId }: { courseId: string }) => {
      if (!courseId) return;
      const roomName = 'course:' + courseId;
      socket.leave(roomName);

      if (activeCourseUsers.has(courseId)) {
        activeCourseUsers.get(courseId)!.delete(socket.id);
        const roomUsers = Array.from(activeCourseUsers.get(courseId)!.values());
        const uniqueUsers = Array.from(new Map(roomUsers.map((u) => [u.id, u])).values());
        io.to(roomName).emit('room_users_updated', {
          courseId,
          count: uniqueUsers.length,
          users: uniqueUsers,
        });
      }
    });

    socket.on('send_message', async ({ courseId, message }: { courseId: string; message: string }) => {
      try {
        if (!courseId || !message || !message.trim()) return;

        const trimmed = message.trim();
        if (trimmed.length > 2000) {
          socket.emit('error_message', { message: 'Message is too long (max 2000 chars)' });
          return;
        }

        const newMsg = await ChatMessage.create({
          courseId,
          sender: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            role: user.role,
          },
          message: trimmed,
        });

        const formattedMsg = {
          id: newMsg._id.toString(),
          courseId,
          sender: newMsg.sender,
          message: newMsg.message,
          createdAt: newMsg.createdAt.toISOString(),
        };

        const roomName = 'course:' + courseId;
        io.to(roomName).emit('new_message', formattedMsg);

        // Notify enrolled students, course creator, and admins
        try {
          const mongoose = await import('mongoose');
          let courseDoc = null;
          if (mongoose.default.isValidObjectId(courseId)) {
            courseDoc = await CourseModel.findById(courseId).select('name url creator _id');
          }
          if (!courseDoc) {
            courseDoc = await CourseModel.findOne({ url: courseId }).select('name url creator _id');
          }

          const courseName = courseDoc?.name || 'الدورة';
          const courseSlugOrId = courseDoc?.url || courseId;
          const canonicalCourseId = courseDoc ? courseDoc._id.toString() : courseId;

          // Find enrolled users matching either ObjectId or string courseId
          const queryConditions: any[] = [
            { courses: courseId },
            { courses: canonicalCourseId },
          ];
          if (mongoose.default.isValidObjectId(canonicalCourseId)) {
            queryConditions.push({ courses: new mongoose.default.Types.ObjectId(canonicalCourseId) });
          }

          const enrolledUsers = await UserModel.find({
            $or: queryConditions
          }).select('_id email');

          const recipientIds = new Set<string>();

          enrolledUsers.forEach((u: any) => {
            recipientIds.add(u._id.toString());
          });

          if (courseDoc?.creator) {
            recipientIds.add(courseDoc.creator.toString());
          }

          const adminUsers = await UserModel.find({ role: 'admin' }).select('_id');
          adminUsers.forEach((a: any) => {
            recipientIds.add(a._id.toString());
          });

          // Exclude the sender
          recipientIds.delete(user.id);

          console.log(`[Socket] Message from ${user.name} (${user.role}) in ${courseName}. Sending notif to ${recipientIds.size} recipient(s):`, Array.from(recipientIds));

          const roleArabic = user.role === 'admin' ? 'الإدارة' : user.role === 'instructor' ? 'المدرب' : 'طالب';
          const notifPayload = {
            id: 'chat-' + newMsg._id.toString(),
            courseId: canonicalCourseId,
            courseName,
            link: '/my-courses/' + courseSlugOrId + '?tab=chat',
            sender: {
              id: user.id,
              name: user.name,
              role: user.role,
              roleLabel: roleArabic,
            },
            message: trimmed.length > 80 ? trimmed.substring(0, 80) + '...' : trimmed,
            createdAt: formattedMsg.createdAt,
          };

          recipientIds.forEach((recipientId) => {
            io.to('user:' + recipientId).emit('new_chat_notification', notifPayload);
          });
        } catch (notifErr) {
          console.error('Failed to dispatch chat notifications:', notifErr);
        }
      } catch (err: any) {
        socket.emit('error_message', { message: 'Failed to send message: ' + err.message });
      }
    });

    socket.on('typing', ({ courseId, isTyping }: { courseId: string; isTyping: boolean }) => {
      if (!courseId) return;
      const roomName = 'course:' + courseId;
      socket.to(roomName).emit('user_typing', {
        courseId,
        user: {
          id: user.id,
          name: user.name,
        },
        isTyping,
      });
    });

    socket.on('disconnect', () => {
      activeCourseUsers.forEach((usersMap, courseId) => {
        if (usersMap.has(socket.id)) {
          usersMap.delete(socket.id);
          const roomUsers = Array.from(usersMap.values());
          const uniqueUsers = Array.from(new Map(roomUsers.map((u) => [u.id, u])).values());
          io.to('course:' + courseId).emit('room_users_updated', {
            courseId,
            count: uniqueUsers.length,
            users: uniqueUsers,
          });
        }
      });
    });
  });

  return io;
};
