import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Composable for creating resizable panels
 * @param {Object} options - Configuration options
 * @param {number} options.initialWidth - Initial panel width in pixels
 * @param {number} options.minWidth - Minimum panel width
 * @param {number} options.maxWidth - Maximum panel width
 * @param {string} options.storageKey - LocalStorage key for persistence
 */
export function useResizablePanel(options = {}) {
  const {
    initialWidth = 384,
    minWidth = 320,
    maxWidth = 600,
    storageKey = 'panel-width'
  } = options

  const panelWidth = ref(initialWidth)
  const isResizing = ref(false)
  const startX = ref(0)
  const startWidth = ref(0)

  // Load saved width from localStorage
  function loadWidth() {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          panelWidth.value = parsed
        }
      }
    }
  }

  // Save width to localStorage
  function saveWidth() {
    if (storageKey) {
      localStorage.setItem(storageKey, panelWidth.value.toString())
    }
  }

  // Start resizing
  function startResize(event) {
    event.preventDefault()
    isResizing.value = true
    startX.value = event.clientX
    startWidth.value = panelWidth.value

    // Add listeners
    document.addEventListener('mousemove', doResize)
    document.addEventListener('mouseup', stopResize)
    
    // Add cursor style to body
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // Handle resize
  function doResize(event) {
    if (!isResizing.value) return

    const diff = event.clientX - startX.value
    let newWidth = startWidth.value + diff

    // Clamp to min/max
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
    panelWidth.value = newWidth
  }

  // Stop resizing
  function stopResize() {
    if (!isResizing.value) return
    
    isResizing.value = false
    
    // Remove listeners
    document.removeEventListener('mousemove', doResize)
    document.removeEventListener('mouseup', stopResize)
    
    // Reset cursor style
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    
    // Save width
    saveWidth()
  }

  // Reset to initial width
  function resetWidth() {
    panelWidth.value = initialWidth
    saveWidth()
  }

  // Handle touch events for mobile
  function startResizeTouch(event) {
    if (event.touches.length !== 1) return
    
    event.preventDefault()
    isResizing.value = true
    startX.value = event.touches[0].clientX
    startWidth.value = panelWidth.value

    document.addEventListener('touchmove', doResizeTouch, { passive: false })
    document.addEventListener('touchend', stopResizeTouch)
  }

  function doResizeTouch(event) {
    if (!isResizing.value || event.touches.length !== 1) return
    event.preventDefault()

    const diff = event.touches[0].clientX - startX.value
    let newWidth = startWidth.value + diff
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
    panelWidth.value = newWidth
  }

  function stopResizeTouch() {
    if (!isResizing.value) return
    
    isResizing.value = false
    document.removeEventListener('touchmove', doResizeTouch)
    document.removeEventListener('touchend', stopResizeTouch)
    saveWidth()
  }

  onMounted(() => {
    loadWidth()
  })

  onUnmounted(() => {
    // Cleanup any lingering listeners
    document.removeEventListener('mousemove', doResize)
    document.removeEventListener('mouseup', stopResize)
    document.removeEventListener('touchmove', doResizeTouch)
    document.removeEventListener('touchend', stopResizeTouch)
  })

  return {
    panelWidth,
    isResizing,
    startResize,
    startResizeTouch,
    resetWidth,
    minWidth,
    maxWidth
  }
}

