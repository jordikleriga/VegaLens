import { logger } from './logger.js';

export const errorHandler = (err, req, res, next) => {
  // Log with appropriate level based on status
  const status = err.status || err.meta?.statusCode || 500;
  
  // Structured logging with request context
  const logContext = {
    event: 'api_error',
    method: req.method,
    path: req.path,
    error: err.message,
    code: err.code,
    status
  };

  if (status >= 500) {
    logger.error(`API Error: ${req.method} ${req.path}`, {
      ...logContext,
      stack: err.stack
    });
  } else {
    logger.warn(`API Error: ${req.method} ${req.path}`, logContext);
  }

  // ChartError - our new structured error class
  if (err.name === 'ChartError') {
    return res.status(400).json({
      error: true,
      code: err.code,
      message: err.userMessage || err.message,
      suggestion: err.suggestion,
      recoverable: err.recoverable,
      retryable: err.retryable,
      details: process.env.NODE_ENV === 'development' ? err.details : undefined
    });
  }

  // Elasticsearch specific errors
  if (err.meta?.statusCode) {
    const esError = err.meta?.body?.error;
    return res.status(err.meta.statusCode).json({
      error: true,
      code: 'ELASTICSEARCH_ERROR',
      message: err.message,
      suggestion: getEsSuggestion(esError),
      recoverable: true,
      retryable: true,
      details: process.env.NODE_ENV === 'development' ? esError : undefined
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: true,
      code: 'VALIDATION_ERROR',
      message: err.message,
      suggestion: 'Check your input and try again.',
      recoverable: true,
      details: err.details
    });
  }

  // App errors (our custom errors)
  if (err.name === 'AppError') {
    return res.status(status).json({
      error: true,
      code: 'APP_ERROR',
      message: err.message,
      recoverable: status < 500,
      details: err.details
    });
  }

  // Default error - only include stack in development
  res.status(status).json({
    error: true,
    code: 'INTERNAL_ERROR',
    message: err.message || 'Something went wrong',
    suggestion: 'Please try again. If the problem persists, contact support.',
    recoverable: false,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Get user-friendly suggestions for common Elasticsearch errors
function getEsSuggestion(esError) {
  if (!esError) return null;
  
  const errorType = esError.type || '';
  const reason = esError.reason || '';
  
  if (errorType.includes('index_not_found')) {
    return 'The specified index does not exist. Check the index name.';
  }
  
  if (reason.includes('Fielddata is disabled')) {
    return 'Text fields cannot be aggregated. Use a keyword field or the .keyword subfield instead.';
  }
  
  if (reason.includes('No mapping found')) {
    return 'The specified field does not have a mapping. Check that the field exists in your index.';
  }
  
  if (errorType.includes('search_phase_execution_exception')) {
    return 'Search query failed. Check your field names and query syntax.';
  }
  
  return null;
}

export class AppError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

