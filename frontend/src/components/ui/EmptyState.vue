<script setup>
import { BarChart3 } from 'lucide-vue-next'

defineProps({
  icon: {
    type: Object,
    default: () => BarChart3
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <div class="w-20 h-20 rounded-2xl bg-slate-800/60 flex items-center justify-center mb-6">
      <component :is="icon" class="w-10 h-10 text-slate-500" />
    </div>
    <h3 class="text-xl font-semibold text-white mb-2">{{ title }}</h3>
    <p v-if="description" class="text-slate-400 max-w-md">{{ description }}</p>
    <div v-if="$slots.action" class="mt-6">
      <slot name="action" />
    </div>
  </div>
</template>

