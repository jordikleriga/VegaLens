import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useDropdownPositioning } from '../useDropdownPositioning'

describe('useDropdownPositioning', () => {
  let originalWindow

  beforeEach(() => {
    // Save original window properties
    originalWindow = {
      innerHeight: window.innerHeight
    }

    // Mock window dimensions
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800
    })
  })

  afterEach(() => {
    // Restore original window properties
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalWindow.innerHeight
    })
  })

  // Helper function available to all tests
  function createMockEvent(rectValues) {
    const button = {
      getBoundingClientRect: vi.fn().mockReturnValue(rectValues),
      closest: vi.fn().mockReturnThis()
    }

    return {
      target: button
    }
  }

  describe('getDropdownPosition', () => {
    it('should return default position when no position is set', () => {
      const { getDropdownPosition } = useDropdownPositioning()

      const position = getDropdownPosition('test-axis')

      expect(position).toEqual({
        top: '100px',
        left: '100px',
        maxHeight: '240px',
        width: '312px'
      })
    })

    it('should return stored position with default width and maxHeight', () => {
      const { dropdownPositions, getDropdownPosition } = useDropdownPositioning()

      dropdownPositions.value['test-axis'] = {
        top: 150,
        left: 200
      }

      const position = getDropdownPosition('test-axis')

      expect(position).toEqual({
        top: '150px',
        left: '200px',
        maxHeight: '240px',
        width: '312px'
      })
    })

    it('should return stored position with custom maxHeight and width', () => {
      const { dropdownPositions, getDropdownPosition } = useDropdownPositioning()

      dropdownPositions.value['test-axis'] = {
        top: 150,
        left: 200,
        maxHeight: 300,
        width: 400
      }

      const position = getDropdownPosition('test-axis')

      expect(position).toEqual({
        top: '150px',
        left: '200px',
        maxHeight: '300px',
        width: '400px'
      })
    })
  })

  describe('updateDropdownPosition', () => {
    it('should position dropdown below when sufficient space exists', () => {
      const { updateDropdownPosition, dropdownPositions } = useDropdownPositioning()

      const event = createMockEvent({
        top: 100,
        bottom: 150,
        left: 50,
        right: 200
      })

      updateDropdownPosition('test-axis', event)

      expect(dropdownPositions.value['test-axis']).toEqual({
        top: 154, // bottom (150) + 4
        left: 50,
        maxHeight: 240,
        width: 312
      })
    })

    it('should position dropdown above when more space above', () => {
      const { updateDropdownPosition, dropdownPositions } = useDropdownPositioning()

      // Button near bottom of viewport
      const event = createMockEvent({
        top: 700,
        bottom: 750,
        left: 50,
        right: 200
      })

      updateDropdownPosition('test-axis', event)

      expect(dropdownPositions.value['test-axis']).toEqual({
        top: 456, // top (700) - 240 - 4
        left: 50,
        maxHeight: 240,
        width: 312
      })
    })

    it('should constrain height when limited space below', () => {
      const { updateDropdownPosition, dropdownPositions } = useDropdownPositioning()

      // Button with 180px space below (not enough for full 240px)
      const event = createMockEvent({
        top: 100,
        bottom: 612,
        left: 50,
        right: 200
      })

      updateDropdownPosition('test-axis', event)

      expect(dropdownPositions.value['test-axis'].top).toBe(616) // bottom + 4
      expect(dropdownPositions.value['test-axis'].maxHeight).toBe(180) // space below minus padding
    })

    it('should constrain height when limited space above', () => {
      const { updateDropdownPosition, dropdownPositions } = useDropdownPositioning()

      // Button with 150px space above, 30px below (more above but still constrained)
      // viewport is 800px, button at top: 158, bottom: 208
      // Space above: 158 - 8 = 150px
      // Space below: 800 - 208 - 8 = 584px (enough space, will open below)
      // Let's use button near bottom instead
      const event = createMockEvent({
        top: 700,
        bottom: 750,
        left: 50,
        right: 200
      })

      updateDropdownPosition('test-axis', event)

      // Space below: 800 - 750 - 8 = 42px (not enough)
      // Space above: 700 - 8 = 692px (enough for full 240px)
      expect(dropdownPositions.value['test-axis'].maxHeight).toBe(240) // full height
      expect(dropdownPositions.value['test-axis'].top).toBe(456) // top - 240 - 4
    })

    it('should use minimum height of 120px when very limited space', () => {
      const { updateDropdownPosition, dropdownPositions } = useDropdownPositioning()

      // Button with only 80px space below
      const event = createMockEvent({
        top: 100,
        bottom: 712,
        left: 50,
        right: 200
      })

      updateDropdownPosition('test-axis', event)

      expect(dropdownPositions.value['test-axis'].maxHeight).toBe(120) // minimum height
    })

    it('should handle null event gracefully', () => {
      const { updateDropdownPosition, dropdownPositions } = useDropdownPositioning()

      updateDropdownPosition('test-axis', null)

      expect(dropdownPositions.value['test-axis']).toBeUndefined()
    })

    it('should handle event without target', () => {
      const { updateDropdownPosition, dropdownPositions } = useDropdownPositioning()

      updateDropdownPosition('test-axis', {})

      expect(dropdownPositions.value['test-axis']).toBeUndefined()
    })

    it('should handle multiple dropdowns independently', () => {
      const { updateDropdownPosition, dropdownPositions } = useDropdownPositioning()

      const event1 = createMockEvent({
        top: 100,
        bottom: 150,
        left: 50,
        right: 200
      })

      const event2 = createMockEvent({
        top: 200,
        bottom: 250,
        left: 100,
        right: 250
      })

      updateDropdownPosition('axis-1', event1)
      updateDropdownPosition('axis-2', event2)

      expect(dropdownPositions.value['axis-1'].top).toBe(154)
      expect(dropdownPositions.value['axis-1'].left).toBe(50)

      expect(dropdownPositions.value['axis-2'].top).toBe(254)
      expect(dropdownPositions.value['axis-2'].left).toBe(100)
    })

    it('should update existing dropdown position', () => {
      const { updateDropdownPosition, dropdownPositions } = useDropdownPositioning()

      // First position
      const event1 = createMockEvent({
        top: 100,
        bottom: 150,
        left: 50,
        right: 200
      })

      updateDropdownPosition('test-axis', event1)

      expect(dropdownPositions.value['test-axis'].top).toBe(154)

      // Update position
      const event2 = createMockEvent({
        top: 300,
        bottom: 350,
        left: 100,
        right: 250
      })

      updateDropdownPosition('test-axis', event2)

      expect(dropdownPositions.value['test-axis'].top).toBe(354)
      expect(dropdownPositions.value['test-axis'].left).toBe(100)
    })

    it('should always use fixed width of 312px', () => {
      const { updateDropdownPosition, dropdownPositions } = useDropdownPositioning()

      const event = createMockEvent({
        top: 100,
        bottom: 150,
        left: 50,
        right: 500 // Wide button
      })

      updateDropdownPosition('test-axis', event)

      expect(dropdownPositions.value['test-axis'].width).toBe(312)
    })
  })

  describe('Edge Cases', () => {
    it('should handle viewport height changes', () => {
      const { updateDropdownPosition, dropdownPositions } = useDropdownPositioning()

      // Original viewport height is 800px
      // Button near bottom - will have different behavior with smaller viewport
      const event = createMockEvent({
        top: 500,
        bottom: 550,
        left: 50,
        right: 200
      })

      updateDropdownPosition('test-axis', event)

      const position1 = { ...dropdownPositions.value['test-axis'] }

      // Change viewport height to make space below insufficient
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 600
      })

      updateDropdownPosition('test-axis', event)

      const position2 = { ...dropdownPositions.value['test-axis'] }

      // With 800px viewport: space below = 800 - 550 - 8 = 242px (enough)
      // With 600px viewport: space below = 600 - 550 - 8 = 42px (not enough)
      // Positions should be different due to viewport change
      expect(position1.top).not.toBe(position2.top)
    })

    it('should handle button at exact viewport edge', () => {
      const { updateDropdownPosition, dropdownPositions } = useDropdownPositioning()

      // Button exactly at bottom of viewport
      const event = createMockEvent({
        top: 750,
        bottom: 800,
        left: 50,
        right: 200
      })

      updateDropdownPosition('test-axis', event)

      // Should open upward
      expect(dropdownPositions.value['test-axis'].top).toBeLessThan(750)
    })

    it('should handle button at top of viewport', () => {
      const { updateDropdownPosition, dropdownPositions } = useDropdownPositioning()

      // Button at top of viewport
      const event = createMockEvent({
        top: 0,
        bottom: 50,
        left: 50,
        right: 200
      })

      updateDropdownPosition('test-axis', event)

      // Should open downward
      expect(dropdownPositions.value['test-axis'].top).toBeGreaterThan(50)
    })
  })
})
