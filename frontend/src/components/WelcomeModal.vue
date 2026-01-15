<script setup>
import { ref, onMounted } from 'vue'
import {
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Github,
  X,
  CheckSquare,
  Square
} from 'lucide-vue-next'

const STORAGE_KEY = 'vegalens-welcome-dismissed'

const showModal = ref(false)
const dontShowAgain = ref(false)

onMounted(() => {
  const dismissed = localStorage.getItem(STORAGE_KEY)
  if (!dismissed) {
    showModal.value = true
  }
})

function closeModal() {
  if (dontShowAgain.value) {
    localStorage.setItem(STORAGE_KEY, 'true')
  }
  showModal.value = false
}

function toggleDontShow() {
  dontShowAgain.value = !dontShowAgain.value
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showModal"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"
          @click="closeModal"
        ></div>

        <!-- Modal -->
        <div class="relative bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
          <!-- Header -->
          <div class="relative p-6 pb-4 border-b border-slate-700/50">
            <div class="absolute inset-0 bg-gradient-to-br from-ocean-500/10 via-transparent to-coral-500/10"></div>
            <div class="relative flex items-start gap-4">
              <div class="w-14 h-14 bg-gradient-to-br from-ocean-400 to-coral-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                <Sparkles class="w-7 h-7 text-white" />
              </div>
              <div class="flex-1">
                <h2 class="text-2xl font-display font-bold text-white">Welcome to VegaLens</h2>
                <p class="text-sm text-slate-400 mt-1">Vega Dashboard Builder for Elasticsearch</p>
              </div>
              <button
                @click="closeModal"
                class="p-2 hover:bg-slate-800 rounded-lg transition-colors -mr-2 -mt-2"
              >
                <X class="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="p-6 space-y-4">
            <p class="text-slate-300 leading-relaxed">
              VegaLens is an <span class="text-ocean-400 font-medium">open-source tool</span> that helps you create beautiful Vega visualizations for Elasticsearch and Kibana.
            </p>

            <!-- Disclaimer -->
            <div class="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <AlertTriangle class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div class="text-sm">
                <p class="text-amber-200 font-medium mb-1">Disclaimer</p>
                <p class="text-amber-200/80 leading-relaxed">
                  This tool is provided as-is without any guarantees. There may be bugs or issues.
                  Your feedback helps us improve!
                </p>
              </div>
            </div>

            <!-- GitHub Link -->
            <a
              href="https://github.com/jordikleriga/VegaLens"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl transition-all duration-200 group"
            >
              <div class="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center group-hover:bg-slate-600 transition-colors">
                <Github class="w-5 h-5 text-white" />
              </div>
              <div class="flex-1">
                <p class="text-white font-medium">Report Issues or Contribute</p>
                <p class="text-xs text-slate-400">github.com/jordikleriga/VegaLens</p>
              </div>
              <ExternalLink class="w-4 h-4 text-slate-400 group-hover:text-ocean-400 transition-colors" />
            </a>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between p-6 border-t border-slate-700/50 bg-slate-800/30">
            <!-- Don't show again checkbox -->
            <button
              @click="toggleDontShow"
              class="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              <component
                :is="dontShowAgain ? CheckSquare : Square"
                class="w-4 h-4"
                :class="dontShowAgain ? 'text-ocean-400' : ''"
              />
              <span>Don't show this again</span>
            </button>

            <button
              @click="closeModal"
              class="btn-primary"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95) translateY(10px);
}
</style>
