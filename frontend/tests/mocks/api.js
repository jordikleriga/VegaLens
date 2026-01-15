/**
 * API Mock Helpers
 *
 * Provides utilities for mocking axios API calls in tests
 */

import { vi } from 'vitest'

/**
 * Creates a mock API instance with common methods
 * @returns {Object} Mock API object with get, post, put, delete methods
 */
export const createMockApi = () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
  interceptors: {
    request: { use: vi.fn(), eject: vi.fn() },
    response: { use: vi.fn(), eject: vi.fn() }
  },
  defaults: {
    baseURL: '',
    headers: {}
  }
})

/**
 * Mock successful API response
 * @param {*} data - Response data
 * @param {number} status - HTTP status code
 * @returns {Promise} Resolved promise with response object
 */
export const mockSuccessResponse = (data, status = 200) => {
  return Promise.resolve({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {}
  })
}

/**
 * Mock error API response
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Promise} Rejected promise with error object
 */
export const mockErrorResponse = (message, status = 500) => {
  const error = new Error(message)
  error.response = {
    data: { message },
    status,
    statusText: 'Error',
    headers: {},
    config: {}
  }
  return Promise.reject(error)
}
