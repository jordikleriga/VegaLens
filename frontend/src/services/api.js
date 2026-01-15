import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Debug mode (enable via localStorage.setItem('debug', 'true'))
const isDebug = () => localStorage.getItem('debug') === 'true'

// Session storage key for connection config
const CONNECTION_SESSION_KEY = 'es_connection_config'

/**
 * Get connection headers from session storage
 * These headers tell the backend which ES instance to connect to
 */
function getConnectionHeaders() {
  try {
    const stored = sessionStorage.getItem(CONNECTION_SESSION_KEY)
    if (!stored) return {}
    
    const config = JSON.parse(stored)
    if (!config || !config.type || config.type === 'default') return {}
    
    const headers = {
      'X-ES-Connection-Type': config.type
    }
    
    if (config.endpoint) headers['X-ES-Endpoint'] = config.endpoint
    if (config.apiKey) headers['X-ES-Api-Key'] = config.apiKey
    if (config.cloudId) headers['X-ES-Cloud-Id'] = config.cloudId
    if (config.username) headers['X-ES-Username'] = config.username
    if (config.password) headers['X-ES-Password'] = config.password
    
    return headers
  } catch (e) {
    console.error('[API] Failed to get connection headers:', e)
    return {}
  }
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableStatuses: [502, 503, 504, 0], // Gateway errors and network failures
  retryableCodes: ['ECONNREFUSED', 'ETIMEDOUT', 'NETWORK_ERROR', 'ELASTICSEARCH_ERROR']
}

/**
 * Sleep for a given duration
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Check if an error is retryable
 */
function isRetryable(error) {
  const { response } = error
  
  // Network errors (no response)
  if (!response) return true
  
  // Check retryable status codes
  if (RETRY_CONFIG.retryableStatuses.includes(response.status)) return true
  
  // Check if backend marked as retryable
  if (response.data?.retryable) return true
  
  // Check error codes
  const code = response.data?.code
  if (code && RETRY_CONFIG.retryableCodes.includes(code)) return true
  
  return false
}

/**
 * Execute a request with retry logic
 */
async function executeWithRetry(requestFn, retryCount = 0) {
  try {
    return await requestFn()
  } catch (error) {
    if (retryCount < RETRY_CONFIG.maxRetries && isRetryable(error)) {
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, retryCount),
        RETRY_CONFIG.maxDelay
      )
      
      if (isDebug()) {
        console.log(`[API Retry] Attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries} after ${delay}ms`)
      }
      
      await sleep(delay)
      return executeWithRetry(requestFn, retryCount + 1)
    }
    throw error
  }
}

// Request interceptor - adds connection headers
api.interceptors.request.use(
  (config) => {
    // Add connection headers for ES routing
    const connectionHeaders = getConnectionHeaders()
    config.headers = {
      ...config.headers,
      ...connectionHeaders
    }
    
    if (isDebug()) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        data: config.data,
        params: config.params,
        hasConnectionHeaders: Object.keys(connectionHeaders).length > 0
      })
    }
    return config
  },
  (error) => {
    console.error('[API Request Error]', error)
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    if (isDebug()) {
      console.log(`[API Response] ${response.status} ${response.config.url}`, {
        data: response.data
      })
    }
    return response
  },
  (error) => {
    const { response, request, message } = error
    
    // Build structured error info
    const errorInfo = {
      url: request?.responseURL || error.config?.url,
      status: response?.status,
      statusText: response?.statusText,
      code: response?.data?.code || 'UNKNOWN_ERROR',
      message: response?.data?.message || message,
      suggestion: response?.data?.suggestion,
      recoverable: response?.data?.recoverable ?? true,
      retryable: response?.data?.retryable ?? false,
      details: response?.data?.details
    }
    
    // Log with appropriate detail
    if (isDebug()) {
      console.error('[API Error]', errorInfo, {
        fullResponse: response?.data
      })
    } else {
      console.error(`[API Error] ${errorInfo.code}: ${errorInfo.message}`)
    }
    
    // Attach structured error info to the error object
    error.errorInfo = errorInfo
    
    // Build user message with suggestion
    if (response?.data?.message) {
      error.userMessage = response.data.message
      if (response.data.suggestion) {
        error.userMessage += `. ${response.data.suggestion}`
      }
    } else if (response) {
      switch (response.status) {
        case 400:
          error.userMessage = 'Invalid request. Check your configuration.'
          break
        case 401:
          error.userMessage = 'Unauthorized - check Elasticsearch credentials'
          break
        case 404:
          error.userMessage = 'Resource not found'
          break
        case 500:
          error.userMessage = 'Server error - check backend logs'
          break
        case 502:
        case 503:
        case 504:
          error.userMessage = 'Service temporarily unavailable. Please try again.'
          break
        default:
          error.userMessage = response.data?.message || 'An error occurred'
      }
    } else if (request) {
      error.userMessage = 'Network error - is the backend running?'
      error.errorInfo.code = 'NETWORK_ERROR'
      error.errorInfo.retryable = true
    }
    
    return Promise.reject(error)
  }
)

/**
 * API wrapper with automatic retry for retryable errors
 */
export const apiWithRetry = {
  get: (url, config) => executeWithRetry(() => api.get(url, config)),
  post: (url, data, config) => executeWithRetry(() => api.post(url, data, config)),
  put: (url, data, config) => executeWithRetry(() => api.put(url, data, config)),
  delete: (url, config) => executeWithRetry(() => api.delete(url, config)),
  patch: (url, data, config) => executeWithRetry(() => api.patch(url, data, config))
}

export default api
