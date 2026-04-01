import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { supabase } from './config/supabase';
import { redis } from './config/redis';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Basic health check route to test Supabase and Redis
app.get('/health', async (req: Request, res: Response) => {
  try {
    // 1. Test Redis Connection
    const redisPing = await redis.ping();

    // 2. Test Supabase Configuration
    // A safe way to test without needing a specific table is checking if we can query an anon resource
    const { data: sbSession, error: sbError } = await supabase.auth.getSession();

    res.status(200).json({
      status: 'success',
      message: 'Backend is running!',
      services: {
        redis: redisPing === 'PONG' ? 'Connected' : 'Failed',
        supabase: sbError ? `Error: ${sbError.message}` : 'Client configured',
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Backend test failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Avoid "EADDRINUSE" by checking if we are run directly
if (require.main === module) {
  app.listen(env.PORT, () => {
    console.log(`\n🚀 Server is running on http://localhost:${env.PORT}`);
    console.log(`👉 Check health status at: http://localhost:${env.PORT}/health\n`);
  });
}

export default app;
