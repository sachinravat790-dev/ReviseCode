import { config } from '../config/env.js';

export function requestLogger(req, res, next) {
  if (config.nodeEnv === 'test') {
    return next();
  }
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
}
