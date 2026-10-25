import { errorResponse } from '../utils/api-response.js';

export function notFoundHandler(req, res, next) {
  return errorResponse(res, {
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}
