<script setup>
import { useNotification } from '@/composables/useNotification'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-vue-next'

const { notifications, dismiss } = useNotification()

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
}

const colors = {
  success: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
  error: 'bg-red-500/20 border-red-500/30 text-red-400',
  warning: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
  info: 'bg-ocean-500/20 border-ocean-500/30 text-ocean-400'
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-50 space-y-3 w-96">
      <TransitionGroup name="notification">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="glass-card p-4 border animate-slide-in-right"
          :class="colors[notification.type]"
        >
          <div class="flex items-start gap-3">
            <component 
              :is="icons[notification.type]" 
              class="w-5 h-5 flex-shrink-0 mt-0.5" 
            />
            <div class="flex-1 min-w-0">
              <p class="font-medium text-white">{{ notification.title }}</p>
              <p v-if="notification.message" class="text-sm opacity-80 mt-1">
                {{ notification.message }}
              </p>
            </div>
            <button
              @click="dismiss(notification.id)"
              class="p-1 rounded hover:bg-white/10 transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.notification-enter-active {
  transition: all 0.3s ease;
}

.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}
</style>

