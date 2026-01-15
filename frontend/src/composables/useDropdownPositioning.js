import { ref } from 'vue'

/**
 * Dropdown Positioning Composable
 *
 * Provides smart positioning logic for dropdown menus that adapts to viewport constraints.
 * Automatically positions dropdowns to avoid overflow by detecting available space above
 * and below the trigger button.
 *
 * @returns {Object} Positioning utilities
 * @returns {Ref<Object>} dropdownPositions - Position state for each dropdown by ID
 * @returns {Function} getDropdownPosition - Get computed position for a dropdown
 * @returns {Function} updateDropdownPosition - Calculate and update dropdown position based on trigger element
 */
export function useDropdownPositioning() {
  const dropdownPositions = ref({})

  /**
   * Calculate dropdown position for rendering
   * @param {string} axisId - Unique identifier for the dropdown
   * @returns {Object} CSS position object with top, left, maxHeight, width
   */
  function getDropdownPosition(axisId) {
    const pos = dropdownPositions.value[axisId]
    if (!pos || !pos.top) {
      return { top: '100px', left: '100px', maxHeight: '240px', width: '312px' }
    }
    return {
      top: `${pos.top}px`,
      left: `${pos.left}px`,
      maxHeight: `${pos.maxHeight || 240}px`,
      width: `${pos.width || 312}px`
    }
  }

  /**
   * Update dropdown position based on trigger button location
   * Smart positioning algorithm that considers viewport edges:
   * - Prefers opening downward if space available
   * - Opens upward if more space above
   * - Constrains height when insufficient space in either direction
   *
   * @param {string} axisId - Unique identifier for the dropdown
   * @param {Event} event - Click event from trigger button
   */
  function updateDropdownPosition(axisId, event) {
    const button = event?.target?.closest('button')
    if (button) {
      const rect = button.getBoundingClientRect()
      const dropdownHeight = 240 // max-h-60 = 240px
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom - 8
      const spaceAbove = rect.top - 8

      let top, maxHeight

      if (spaceBelow >= dropdownHeight) {
        // Enough space below - open downward
        top = rect.bottom + 4
        maxHeight = dropdownHeight
      } else if (spaceAbove >= dropdownHeight) {
        // Enough space above - open upward
        top = rect.top - dropdownHeight - 4
        maxHeight = dropdownHeight
      } else if (spaceBelow >= spaceAbove) {
        // More space below but not enough - constrain height
        top = rect.bottom + 4
        maxHeight = Math.max(120, spaceBelow) // Minimum 120px
      } else {
        // More space above but not enough - open upward, constrain height
        maxHeight = Math.max(120, spaceAbove)
        top = rect.top - maxHeight - 4
      }

      dropdownPositions.value[axisId] = {
        top,
        left: rect.left,
        maxHeight,
        width: 312 // w-78 = 312px
      }
    }
  }

  return {
    dropdownPositions,
    getDropdownPosition,
    updateDropdownPosition
  }
}
