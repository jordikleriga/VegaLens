<script setup>
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import NotificationContainer from '@/components/ui/NotificationContainer.vue'
import ConnectionSettingsModal from '@/components/ConnectionSettingsModal.vue'
import WelcomeModal from '@/components/WelcomeModal.vue'
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <AppSidebar />
    <div class="flex-1 flex flex-col ml-64 overflow-hidden">
      <main class="flex-1 p-8 overflow-hidden">
        <RouterView v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </main>
    </div>
    <NotificationContainer />
    <ConnectionSettingsModal />
    <WelcomeModal />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
