import { errorResponse } from '../utils/api-response.js';

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const formattedErrors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return errorResponse(res, {
        statusCode: 400,
        message: 'Validation failed',
        errors: formattedErrors
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const formattedErrors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid query parameters',
        errors: formattedErrors
      });
    }
    req.query = result.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const formattedErrors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return errorResponse(res, {
        statusCode: 400,
        message: 'Invalid URL parameters',
        errors: formattedErrors
      });
    }
    req.params = result.data;
    next();
  };
}
