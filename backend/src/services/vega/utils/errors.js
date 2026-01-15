/**
 * Error Handling Utilities
 * Provides user-friendly error messages and recovery suggestions
 */

import { logger } from './logger.js';

/**
 * Error codes for chart generation
 */
export const ErrorCodes = {
  // Configuration errors
  UNKNOWN_CHART_TYPE: 'UNKNOWN_CHART_TYPE',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE: 'INVALID_FIELD_TYPE',
  INVALID_CONFIG: 'INVALID_CONFIG',
  
  // Data errors
  NO_DATA: 'NO_DATA',
  EMPTY_DATA: 'EMPTY_DATA',
  INVALID_DATA_FORMAT: 'INVALID_DATA_FORMAT',
  FIELD_NOT_FOUND: 'FIELD_NOT_FOUND',
  
  // Generation errors
  SPEC_GENERATION_FAILED: 'SPEC_GENERATION_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  
  // External errors
  ELASTICSEARCH_ERROR: 'ELASTICSEARCH_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT'
};

/**
 * User-friendly error messages with recovery suggestions
 */
const ERROR_MESSAGES = {
  [ErrorCodes.UNKNOWN_CHART_TYPE]: {
    message: 'Unknown chart type',
    suggestion: 'Select a valid chart type from the visualization picker.',
    recoverable: true
  },
  [ErrorCodes.MISSING_REQUIRED_FIELD]: {
    message: 'Required field is missing',
    suggestion: 'Configure all required fields in the chart configuration panel.',
    recoverable: true
  },
  [ErrorCodes.INVALID_FIELD_TYPE]: {
    message: 'Field type is not compatible with this axis',
    suggestion: 'Select a field with the correct data type for this axis.',
    recoverable: true
  },
  [ErrorCodes.INVALID_CONFIG]: {
    message: 'Invalid chart configuration',
    suggestion: 'Check your configuration values and try again.',
    recoverable: true
  },
  [ErrorCodes.NO_DATA]: {
    message: 'No data available for visualization',
    suggestion: 'Select an index with data or adjust your time range filter.',
    recoverable: true
  },
  [ErrorCodes.EMPTY_DATA]: {
    message: 'Query returned no results',
    suggestion: 'Try expanding your time range or adjusting filters.',
    recoverable: true
  },
  [ErrorCodes.INVALID_DATA_FORMAT]: {
    message: 'Data format is not compatible',
    suggestion: 'Ensure your data matches the expected format for this chart type.',
    recoverable: false
  },
  [ErrorCodes.FIELD_NOT_FOUND]: {
    message: 'Configured field not found in data',
    suggestion: 'The field may have been renamed or removed. Select a different field.',
    recoverable: true
  },
  [ErrorCodes.SPEC_GENERATION_FAILED]: {
    message: 'Failed to generate chart specification',
    suggestion: 'Try a different chart type or configuration.',
    recoverable: true
  },
  [ErrorCodes.VALIDATION_FAILED]: {
    message: 'Chart specification validation failed',
    suggestion: 'Check your configuration and try again.',
    recoverable: true
  },
  [ErrorCodes.ELASTICSEARCH_ERROR]: {
    message: 'Elasticsearch query failed',
    suggestion: 'Check your connection and try again.',
    recoverable: true,
    retryable: true
  },
  [ErrorCodes.NETWORK_ERROR]: {
    message: 'Network connection failed',
    suggestion: 'Check your internet connection and try again.',
    recoverable: true,
    retryable: true
  },
  [ErrorCodes.TIMEOUT]: {
    message: 'Request timed out',
    suggestion: 'The query took too long. Try reducing the time range or sample size.',
    recoverable: true,
    retryable: true
  }
};

/**
 * Custom error class for chart generation errors
 */
export class ChartError extends Error {
  constructor(code, details = {}) {
    const errorInfo = ERROR_MESSAGES[code] || {
      message: 'An unexpected error occurred',
      suggestion: 'Please try again.',
      recoverable: false
    };
    
    super(details.message || errorInfo.message);
    
    this.name = 'ChartError';
    this.code = code;
    this.userMessage = details.message || errorInfo.message;
    this.suggestion = details.suggestion || errorInfo.suggestion;
    this.recoverable = errorInfo.recoverable;
    this.retryable = errorInfo.retryable || false;
    this.details = details;
    
    // Capture stack trace
    Error.captureStackTrace(this, ChartError);
    
    // Log the error
    logger.error('Chart error occurred', {
      event: 'chart_error',
      code,
      message: this.userMessage,
      details
    });
  }

  /**
   * Convert to a user-friendly JSON response
   */
  toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.userMessage,
      suggestion: this.suggestion,
      recoverable: this.recoverable,
      retryable: this.retryable,
      details: this.details
    };
  }
}

/**
 * Wrap an async function with retry logic
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Retry options
 * @returns {Function} Wrapped function with retry logic
 */
export function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryableErrors = [ErrorCodes.ELASTICSEARCH_ERROR, ErrorCodes.NETWORK_ERROR, ErrorCodes.TIMEOUT]
  } = options;

  return async function retryWrapper(...args) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = error instanceof ChartError 
          ? retryableErrors.includes(error.code)
          : error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT';
        
        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          baseDelay * Math.pow(backoffMultiplier, attempt),
          maxDelay
        );
        
        logger.warn('Retrying after error', {
          event: 'retry_attempt',
          attempt: attempt + 1,
          maxRetries,
          delay,
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  };
}

/**
 * Parse Elasticsearch errors into user-friendly messages
 */
export function parseElasticsearchError(error) {
  const message = error.message || '';
  const meta = error.meta || {};
  
  // Connection errors
  if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
    return new ChartError(ErrorCodes.NETWORK_ERROR, {
      message: 'Cannot connect to Elasticsearch',
      suggestion: 'Check that Elasticsearch is running and accessible.',
      originalError: message
    });
  }
  
  // Timeout errors
  if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
    return new ChartError(ErrorCodes.TIMEOUT, {
      message: 'Elasticsearch query timed out',
      suggestion: 'Try reducing the time range or sample size.',
      originalError: message
    });
  }
  
  // Index not found
  if (message.includes('index_not_found')) {
    return new ChartError(ErrorCodes.NO_DATA, {
      message: 'Index not found',
      suggestion: 'Select a valid index from the available options.',
      originalError: message
    });
  }
  
  // Field mapping errors
  if (message.includes('mapper_parsing_exception') || message.includes('field')) {
    return new ChartError(ErrorCodes.INVALID_FIELD_TYPE, {
      message: 'Field type error in query',
      suggestion: 'The selected field may not support this operation.',
      originalError: message
    });
  }
  
  // Default Elasticsearch error
  return new ChartError(ErrorCodes.ELASTICSEARCH_ERROR, {
    message: 'Elasticsearch query failed',
    suggestion: 'Check the query configuration and try again.',
    originalError: message,
    statusCode: meta.statusCode
  });
}

/**
 * Parse Vega rendering errors into user-friendly messages
 */
export function parseVegaError(error) {
  const message = error.message || '';
  
  // Field reference errors
  if (message.includes('Invalid field reference') || message.includes('datum')) {
    const fieldMatch = message.match(/'([^']+)'/) || message.match(/\{([^}]+)\}/);
    const fieldName = fieldMatch ? fieldMatch[1] : 'unknown';
    
    return new ChartError(ErrorCodes.FIELD_NOT_FOUND, {
      message: `Field "${fieldName}" not found in data`,
      suggestion: 'Check that your X-Axis and Y-Axis fields are correctly mapped.',
      field: fieldName
    });
  }
  
  // Encoding errors
  if (message.includes('encoding')) {
    return new ChartError(ErrorCodes.INVALID_CONFIG, {
      message: 'Chart encoding error',
      suggestion: 'Make sure you have selected valid fields for all required axes.'
    });
  }
  
  // Data errors
  if (message.includes('data') && message.includes('undefined')) {
    return new ChartError(ErrorCodes.NO_DATA, {
      message: 'No data available',
      suggestion: 'Run an aggregation first or ensure your data source has records.'
    });
  }
  
  // Default Vega error
  return new ChartError(ErrorCodes.SPEC_GENERATION_FAILED, {
    message: 'Chart rendering failed',
    suggestion: 'Try a different chart type or configuration.',
    originalError: message
  });
}

export default {
  ErrorCodes,
  ChartError,
  withRetry,
  parseElasticsearchError,
  parseVegaError
};

