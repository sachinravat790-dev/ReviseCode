import { Router } from 'express';
import { successResponse } from '../utils/api-response.js';
import { config, isSupabaseConfigured } from '../config/env.js';

const router = Router();

router.get('/health', (req, res) => {
  return successResponse(res, {
    statusCode: 200,
    message: 'ReviseCode backend is running healthy',
    data: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      version: '1.0.0',
      database: isSupabaseConfigured() ? 'configured' : 'pending_credentials',
      storageEngine: 'Supabase PostgreSQL'
    }
  });
});

export default router;
