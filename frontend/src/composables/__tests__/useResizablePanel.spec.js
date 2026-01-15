import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useResizablePanel } from '../useResizablePanel'

describe('useResizablePanel', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // Helper to create a component that uses the composable
  function createTestComponent(options = {}) {
    return defineComponent({
      setup() {
        return useResizablePanel(options)
      },
      render() {
        return h('div')
      }
    })
  }

  describe('Initialization', () => {
    it('should use initial width when no saved value exists', () => {
      const component = mount(createTestComponent({ initialWidth: 400 }))

      expect(component.vm.panelWidth).toBe(400)
    })

    it('should use default initial width of 384 when not specified', () => {
      const component = mount(createTestComponent())

      expect(component.vm.panelWidth).toBe(384)
    })

    it('should load width from localStorage on mount', () => {
      localStorage.setItem('panel-width', '450')

      const component = mount(createTestComponent())

      expect(component.vm.panelWidth).toBe(450)
    })

    it('should use custom storage key', () => {
      localStorage.setItem('custom-key', '500')

      const component = mount(createTestComponent({ storageKey: 'custom-key' }))

      expect(component.vm.panelWidth).toBe(500)
    })

    it('should ignore invalid localStorage value', () => {
      localStorage.setItem('panel-width', 'invalid')

      const component = mount(createTestComponent({ initialWidth: 400 }))

      expect(component.vm.panelWidth).toBe(400)
    })

    it('should ignore saved width below minWidth', () => {
      localStorage.setItem('panel-width', '100')

      const component = mount(createTestComponent({
        initialWidth: 384,
        minWidth: 320
      }))

      expect(component.vm.panelWidth).toBe(384)
    })

    it('should ignore saved width above maxWidth', () => {
      localStorage.setItem('panel-width', '800')

      const component = mount(createTestComponent({
        initialWidth: 384,
        maxWidth: 600
      }))

      expect(component.vm.panelWidth).toBe(384)
    })
  })

  describe('Resizing', () => {
    it('should start resizing', () => {
      const component = mount(createTestComponent())
      const preventDefault = vi.fn()

      component.vm.startResize({ clientX: 100, preventDefault })

      expect(component.vm.isResizing).toBe(true)
      expect(preventDefault).toHaveBeenCalled()
    })

    it('should provide min and max width', () => {
      const component = mount(createTestComponent({
        minWidth: 300,
        maxWidth: 700
      }))

      expect(component.vm.minWidth).toBe(300)
      expect(component.vm.maxWidth).toBe(700)
    })

    it('should reset to initial width', () => {
      const component = mount(createTestComponent({ initialWidth: 400 }))

      // Change width
      component.vm.panelWidth = 500

      // Reset
      component.vm.resetWidth()

      expect(component.vm.panelWidth).toBe(400)
    })

    it('should save width on reset', () => {
      const component = mount(createTestComponent({ initialWidth: 400 }))

      component.vm.panelWidth = 500
      component.vm.resetWidth()

      expect(localStorage.getItem('panel-width')).toBe('400')
    })
  })

  describe('Touch Support', () => {
    it('should start touch resize', () => {
      const component = mount(createTestComponent())
      const preventDefault = vi.fn()

      component.vm.startResizeTouch({
        touches: [{ clientX: 100 }],
        preventDefault
      })

      expect(component.vm.isResizing).toBe(true)
      expect(preventDefault).toHaveBeenCalled()
    })

    it('should ignore multi-touch events', () => {
      const component = mount(createTestComponent())

      component.vm.startResizeTouch({
        touches: [{ clientX: 100 }, { clientX: 200 }],
        preventDefault: vi.fn()
      })

      expect(component.vm.isResizing).toBe(false)
    })
  })

  describe('Options Configuration', () => {
    it('should use default options when none provided', () => {
      const component = mount(createTestComponent())

      expect(component.vm.panelWidth).toBe(384)
      expect(component.vm.minWidth).toBe(320)
      expect(component.vm.maxWidth).toBe(600)
    })

    it('should merge provided options with defaults', () => {
      const component = mount(createTestComponent({
        initialWidth: 500,
        minWidth: 400,
        maxWidth: 700
      }))

      expect(component.vm.panelWidth).toBe(500)
      expect(component.vm.minWidth).toBe(400)
      expect(component.vm.maxWidth).toBe(700)
    })

    it('should support all configuration options', () => {
      localStorage.setItem('test-panel', '450')

      const component = mount(createTestComponent({
        initialWidth: 400,
        minWidth: 300,
        maxWidth: 700,
        storageKey: 'test-panel'
      }))

      expect(component.vm.panelWidth).toBe(450)
    })
  })

  describe('Cleanup', () => {
    it('should cleanup event listeners on unmount', () => {
      const component = mount(createTestComponent())
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      component.unmount()

      expect(removeEventListenerSpy).toHaveBeenCalled()
    })
  })
})
