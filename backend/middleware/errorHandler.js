/**
 * Global error handling middleware
 * Sanitizes errors before sending to client
 */
export const errorHandler = (err, req, res, next) => {
  // Log full error details server-side only
  console.error('❌ Error occurred:', {
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Sanitize database errors - never expose internal details
  if (err.code) {
    switch (err.code) {
      case 'ECONNREFUSED':
        statusCode = 503;
        message = 'Service temporarily unavailable';
        break;
      case '28P01': // Invalid password
      case '28000': // Invalid authorization
        statusCode = 503;
        message = 'Service configuration error';
        break;
      case '3D000': // Database doesn't exist
        statusCode = 503;
        message = 'Service temporarily unavailable';
        break;
      case '23505': // Unique violation
        statusCode = 409;
        message = 'Resource already exists';
        break;
      case '23503': // Foreign key violation
        statusCode = 400;
        message = 'Invalid reference';
        break;
      case '42P01': // Undefined table
        statusCode = 503;
        message = 'Service not properly configured';
        break;
      default:
        if (err.code.startsWith('23')) {
          statusCode = 400;
          message = 'Invalid data provided';
        } else if (err.code.startsWith('42')) {
          statusCode = 503;
          message = 'Service configuration error';
        }
    }
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Send sanitized response to client
  res.status(statusCode).json({
    success: false,
    message,
    // Only include stack trace in development mode
    ...(process.env.NODE_ENV === 'development' && { 
      debug: {
        originalMessage: err.message,
        code: err.code
      }
    })
  });
};