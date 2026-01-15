/**
 * Vega-Embed Mock
 *
 * Mock implementation of vega-embed for testing
 */

import { vi } from 'vitest'

/**
 * Mock vega-embed function
 */
export default vi.fn((element, spec, options) => {
  return Promise.resolve({
    view: {
      signal: vi.fn(),
      data: vi.fn(),
      change: vi.fn(),
      run: vi.fn(),
      finalize: vi.fn()
    },
    spec,
    vgSpec: spec
  })
})
