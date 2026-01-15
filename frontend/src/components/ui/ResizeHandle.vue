<script setup>
import { GripVertical } from 'lucide-vue-next'

defineProps({
  isResizing: {
    type: Boolean,
    default: false
  },
  orientation: {
    type: String,
    default: 'vertical',
    validator: (v) => ['vertical', 'horizontal'].includes(v)
  }
})

const emit = defineEmits(['mousedown', 'touchstart'])

function handleMouseDown(e) {
  emit('mousedown', e)
}

function handleTouchStart(e) {
  emit('touchstart', e)
}
</script>

<template>
  <div 
    class="resize-handle"
    :class="[
      orientation === 'vertical' ? 'resize-handle-vertical' : 'resize-handle-horizontal',
      { 'is-resizing': isResizing }
    ]"
    @mousedown="handleMouseDown"
    @touchstart="handleTouchStart"
  >
    <div class="handle-indicator">
      <GripVertical v-if="orientation === 'vertical'" class="handle-icon" />
      <div v-else class="handle-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resize-handle {
  @apply flex items-center justify-center transition-colors relative;
  touch-action: none;
}

.resize-handle-vertical {
  @apply w-2 bg-slate-700/30 hover:bg-ocean-500/50 cursor-col-resize;
}

.resize-handle-horizontal {
  @apply h-2 bg-slate-700/30 hover:bg-ocean-500/50 cursor-row-resize;
}

.resize-handle.is-resizing {
  @apply bg-ocean-500/70;
}

.handle-indicator {
  @apply absolute pointer-events-none transition-opacity duration-200;
}

.resize-handle-vertical .handle-indicator {
  @apply flex items-center justify-center;
}

.handle-icon {
  @apply w-3 h-5 text-slate-500 opacity-0 transition-opacity duration-200;
}

.resize-handle:hover .handle-icon,
.resize-handle.is-resizing .handle-icon {
  @apply opacity-100 text-slate-300;
}

.handle-dots {
  @apply flex flex-col gap-0.5;
}

.handle-dots span {
  @apply w-1 h-1 rounded-full bg-slate-500;
}

.resize-handle:hover .handle-dots span,
.resize-handle.is-resizing .handle-dots span {
  @apply bg-slate-300;
}

/* Add a larger hit area for easier grabbing */
.resize-handle::before {
  content: '';
  @apply absolute inset-y-0;
}

.resize-handle-vertical::before {
  @apply -left-1 -right-1;
}

.resize-handle-horizontal::before {
  @apply -top-1 -bottom-1 inset-x-0;
}
</style>

