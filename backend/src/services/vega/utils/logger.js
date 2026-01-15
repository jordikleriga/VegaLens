/**
 * Structured Logger for Vega Generator
 * Provides structured JSON logging with context and metadata
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
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

/**
 * Format a structured log entry
 */
function formatLogEntry(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  
  // Create structured log object
  const logEntry = {
    timestamp,
    level,
    message,
    ...data
  };

  // For terminal output, format nicely
  if (process.env.NODE_ENV !== 'production') {
    const levelColors = {
      ERROR: 'red',
      WARN: 'yellow',
      INFO: 'cyan',
      DEBUG: 'gray'
    };
    
    const coloredLevel = colorize(`[${level}]`, levelColors[level] || 'gray');
    const coloredTime = colorize(timestamp, 'dim');
    
    // Format data as compact JSON if present
    const dataKeys = Object.keys(data);
    let dataStr = '';
    if (dataKeys.length > 0) {
      // Filter out undefined values and format
      const cleanData = {};
      for (const key of dataKeys) {
        if (data[key] !== undefined) {
          cleanData[key] = data[key];
        }
      }
      if (Object.keys(cleanData).length > 0) {
        dataStr = colorize(JSON.stringify(cleanData), 'dim');
      }
    }
    
    return `${coloredTime} ${coloredLevel} ${message}${dataStr ? ' ' + dataStr : ''}`;
  }
  
  // Production: output as JSON
  return JSON.stringify(logEntry);
}

/**
 * Structured logger with context support
 */
class Logger {
  constructor(context = {}) {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext) {
    return new Logger({
      ...this.context,
      ...additionalContext
    });
  }

  /**
   * Log with merged context
   */
  _log(level, levelNum, message, data = {}) {
    if (currentLevel < levelNum) return;
    
    const mergedData = {
      ...this.context,
      ...data
    };

    const output = formatLogEntry(level, message, mergedData);
    
    switch (level) {
      case 'ERROR':
        console.error(output);
        break;
      case 'WARN':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  error(message, data = {}) {
    this._log('ERROR', LOG_LEVELS.ERROR, message, data);
  }

  warn(message, data = {}) {
    this._log('WARN', LOG_LEVELS.WARN, message, data);
  }

  info(message, data = {}) {
    this._log('INFO', LOG_LEVELS.INFO, message, data);
  }

  debug(message, data = {}) {
    this._log('DEBUG', LOG_LEVELS.DEBUG, message, data);
  }

  /**
   * Log chart generation event with structured data
   */
  chartGenerated(chartType, config, duration) {
    this.info('Chart generated', {
      event: 'chart_generated',
      chartType,
      configHash: this._hashConfig(config),
      duration,
      dataPoints: config.dataPoints,
      hasColorField: !!config.colorField,
      hasAggregation: !!config.aggregation
    });
  }

  /**
   * Log aggregation event
   */
  aggregationExecuted(index, aggConfig, duration, recordCount) {
    this.info('Aggregation executed', {
      event: 'aggregation_executed',
      index,
      aggType: aggConfig?.bucketAgg?.type,
      duration,
      recordCount
    });
  }

  /**
   * Log validation error with context
   */
  validationError(chartType, errors, config) {
    this.warn('Validation failed', {
      event: 'validation_error',
      chartType,
      errors,
      configKeys: Object.keys(config || {})
    });
  }

  /**
   * Log API request
   */
  apiRequest(method, path, duration, status, error = null) {
    const data = {
      event: 'api_request',
      method,
      path,
      duration,
      status
    };
    
    if (error) {
      data.error = error;
      this.error('API request failed', data);
    } else if (status >= 400) {
      this.warn('API request error response', data);
    } else {
      this.info('API request completed', data);
    }
  }

  /**
   * Create a simple hash of config for tracing
   */
  _hashConfig(config) {
    if (!config) return 'none';
    const str = JSON.stringify(config);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }
}

// Export singleton instance for general use
export const logger = new Logger();

// Export class for creating contextual loggers
export { Logger };

export default logger;

