/**
 * Request/Response Logging Middleware
 * Provides detailed logging for debugging API issues
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLevel = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function formatTimestamp() {
  return new Date().toISOString();
}

function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

function formatMethod(method) {
  const methodColors = {
    GET: 'green',
    POST: 'blue',
    PUT: 'yellow',
    DELETE: 'red',
    PATCH: 'magenta'
  };
  return colorize(method.padEnd(6), methodColors[method] || 'gray');
}

function formatStatus(status) {
  if (status >= 500) return colorize(status, 'red');
  if (status >= 400) return colorize(status, 'yellow');
  if (status >= 300) return colorize(status, 'cyan');
  return colorize(status, 'green');
}

function formatDuration(ms) {
  if (ms < 100) return colorize(`${ms}ms`, 'green');
  if (ms < 500) return colorize(`${ms}ms`, 'yellow');
  return colorize(`${ms}ms`, 'red');
}

export const logger = {
  error: (message, data = {}) => {
    if (currentLevel >= LOG_LEVELS.ERROR) {
      console.error(colorize(`[ERROR] ${formatTimestamp()}`, 'red'), message, data);
    }
  },
  
  warn: (message, data = {}) => {
    if (currentLevel >= LOG_LEVELS.WARN) {
      console.warn(colorize(`[WARN] ${formatTimestamp()}`, 'yellow'), message, data);
    }
  },
  
  info: (message, data = {}) => {
    if (currentLevel >= LOG_LEVELS.INFO) {
      console.log(colorize(`[INFO] ${formatTimestamp()}`, 'cyan'), message, data);
    }
  },
  
  debug: (message, data = {}) => {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      console.log(colorize(`[DEBUG] ${formatTimestamp()}`, 'gray'), message, data);
    }
  }
};

/**
 * Request logging middleware
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // Log request body for POST/PUT/PATCH (in debug mode)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && currentLevel >= LOG_LEVELS.DEBUG) {
    logger.debug(`Request body for ${req.method} ${req.path}:`, {
      body: req.body,
      params: req.params,
      query: req.query
    });
  }
  
  // Capture the response
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    
    // Log the request
    const logLine = `${formatMethod(req.method)} ${req.path} ${formatStatus(status)} ${formatDuration(duration)}`;
    
    if (status >= 400) {
      logger.warn(logLine, {
        error: typeof body === 'string' ? body : undefined,
        query: req.query,
        params: req.params
      });
    } else if (currentLevel >= LOG_LEVELS.DEBUG) {
      logger.debug(logLine);
    }
    
    return originalSend.call(this, body);
  };
  
  next();
}

/**
 * Validate request body against schema
 */
export function validateRequest(schema) {
  return (req, res, next) => {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];
      
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`Missing required field: ${field}`);
        continue;
      }
      
      if (value !== undefined && value !== null) {
        if (rules.type && typeof value !== rules.type) {
          // Special case for arrays
          if (rules.type === 'array' && !Array.isArray(value)) {
            errors.push(`Field '${field}' must be an array`);
          } else if (rules.type !== 'array' && typeof value !== rules.type) {
            errors.push(`Field '${field}' must be of type ${rules.type}`);
          }
        }
        
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`Field '${field}' must be one of: ${rules.enum.join(', ')}`);
        }
        
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`Field '${field}' must have at least ${rules.minLength} items`);
        }
      }
    }
    
    if (errors.length > 0) {
      logger.warn('Request validation failed', { errors, body: req.body });
      return res.status(400).json({
        error: 'Validation Error',
        message: errors.join('; '),
        details: errors
      });
    }
    
    next();
  };
}

export default { logger, requestLogger, validateRequest };

