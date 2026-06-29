import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { supabase } from './config/supabase';
import { redis } from './config/redis';
import authRoutes from './routes/auth.routes';
import articleRoutes from './routes/article.routes';
import categoryRoutes from './routes/category.routes';
import courseRoutes from './routes/course.routes';
import wishlistRoutes from './routes/wishlist.routes';

const app = express();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log("================================");
    console.log(`🚀 Server started on port ${PORT}`);
    console.log(`🌍 http://localhost:${PORT}`);
    console.log("================================");
});
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/wishlist', wishlistRoutes);


export default app;
