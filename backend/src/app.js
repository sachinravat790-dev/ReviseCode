import express from 'express';
import cors from 'cors';
import { config, isSupabaseConfigured } from './config/env.js';
import { requestLogger } from './middleware/request-logger.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import apiRoutes from './routes/index.routes.js';
import { successResponse } from './utils/api-response.js';

const app = express();

// Parse comma-separated client origins
const allowedOrigins = (config.clientOrigin || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// CORS configuration supporting frontend origin and standard tooling
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., curl, mobile, server-to-server)
    if (!origin) return callback(null, true);

    // Allow wildcard or explicit matches
    if (
      config.clientOrigin === '*' ||
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin) ||
      origin === config.clientOrigin
    ) {
      return callback(null, true);
    }

    // Allow Vercel preview and production deployments (*.vercel.app)
    if (/^https:\/\/([a-z0-9_-]+\.)?vercel\.app$/i.test(origin)) {
      return callback(null, true);
    }

    // Allow localhost ports during development
    if (config.nodeEnv !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Built-in JSON and urlencoded body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging in non-test environments
if (config.nodeEnv !== 'test') {
  app.use(requestLogger);
}

// Mount all API endpoints under /api
app.use('/api', apiRoutes);

// Root path friendly message
app.get('/', (req, res) => {
  res.json({
    name: 'ReviseCode Backend API',
    version: '1.0.0',
    documentation: '/api/health',
    status: 'online'
  });
});

// Production Root Health Check (ideal for Render, container orchestrators, and uptime monitors)
app.get('/health', (req, res) => {
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

// Centralized 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

export default app;
