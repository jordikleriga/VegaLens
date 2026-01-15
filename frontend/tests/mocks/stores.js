/**
 * Pinia Store Test Helpers
 *
 * Utilities for testing Pinia stores
 */

import { setActivePinia, createPinia } from 'pinia'

/**
 * Creates and activates a fresh Pinia instance for testing
 * Call this in beforeEach() to ensure isolated store state
 * @returns {Pinia} Fresh Pinia instance
 */
export function createTestingPinia() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

/**
 * Resets all stores to initial state
 * Useful for cleanup between tests
 */
export function resetStores(pinia) {
  pinia._s.forEach(store => {
    if (store.$reset) {
      store.$reset()
    }
  })
}
