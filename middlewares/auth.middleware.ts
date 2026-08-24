import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User as UserModel } from '../models/user.model';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const JWT_SECRET = process.env.JWT_SECRET || "d3d8c11e7401d4b6cbdeca781938fae6eb5b01859bf5db0e97d4c2b9a71bcf23";

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
      return;
    }

    if (!decoded || !decoded.id) {
      res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
      return;
    }

    const user = await UserModel.findById(decoded.id);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: User not found' });
      return;
    }

    // Attach user to request with Supabase-style compatibility mapping
    req.user = {
      id: user._id.toString(),
      email: user.email,
      user_metadata: {
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        avatar_url: user.avatar_url,
        phone: user.phone,
        title: user.title,
        bio: user.bio,
        linkedin_url: user.linkedin_url
      }
    };
    
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

export const isAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = req.user;

  if (!user || user.user_metadata?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
    return;
  }

  next();
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.user_metadata?.role;
    if (!roles.includes(userRole)) {
      res.status(403).json({
        error: `Role: ${userRole} is not allowed to access this resource`,
      });
      return;
    }
    next();
  };
};
