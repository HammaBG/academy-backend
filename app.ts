import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { redis } from './config/redis';
import { connectDB } from './config/db';
import authRoutes from './routes/auth.routes';
import articleRoutes from './routes/article.routes';
import categoryRoutes from './routes/category.routes';
import courseRoutes from './routes/course.routes';
import wishlistRoutes from './routes/wishlist.routes';
import formRoutes from './routes/form.routes';
import enrollmentCodeRoutes from './routes/enrollmentCode.routes';

const app = express();

// Connect to MongoDB
connectDB();

const corsOptions = {
  origin: process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Knowledge-Id'],
  maxAge: 86400 // 24 hours
};

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    cors_origin: process.env.CORS_ORIGIN || 'not set'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/enrollment-codes', enrollmentCodeRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log("================================");
    console.log(`?? Server started on port ${PORT}`);
    console.log(`?? Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`?? CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
    console.log("================================");
  });
}

export default app;
