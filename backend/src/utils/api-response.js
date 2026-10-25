/**
 * Standardized API response format helpers
 */

export function successResponse(res, { statusCode = 200, message = 'Success', data = {} } = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

export function errorResponse(res, { statusCode = 500, message = 'An error occurred', errors = [] } = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors: Array.isArray(errors) ? errors : [errors]
  });
}
