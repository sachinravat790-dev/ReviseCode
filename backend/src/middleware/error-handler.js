import { errorResponse } from '../utils/api-response.js';
import { config } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  // Handle body-parser JSON syntax error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return errorResponse(res, {
      statusCode: 400,
      message: 'Malformed JSON payload in request body',
      errors: [err.message]
    });
  }

  // Handle custom status errors
  const statusCode = err.statusCode || (res.statusCode && res.statusCode >= 400 ? res.statusCode : 500);
  const message = err.message || 'Internal Server Error';

  const errors = err.errors || [];

  if (config.nodeEnv !== 'production' && statusCode === 500) {
    console.error('Unhandled server error:', err);
  }

  return errorResponse(res, {
    statusCode,
    message,
    errors: errors.length > 0 ? errors : (config.nodeEnv === 'production' && statusCode === 500 ? [] : [err.message])
  });
}
