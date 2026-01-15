<script setup>
defineProps({
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg', 'xl'].includes(v)
  },
  color: {
    type: String,
    default: 'ocean'
  }
})

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
  xl: 'w-12 h-12 border-4'
}

const colorClasses = {
  ocean: 'border-ocean-400 border-t-transparent',
  coral: 'border-coral-400 border-t-transparent',
  emerald: 'border-emerald-400 border-t-transparent',
  white: 'border-white border-t-transparent'
}
</script>

<template>
  <div 
    class="rounded-full animate-spin"
    :class="[sizeClasses[size], colorClasses[color]]"
  ></div>
</template>

