<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useElasticStore } from '@/stores/elastic'
import { 
  Search, 
  RefreshCw,
  ChevronDown,
  Check,
  AlertCircle
} from 'lucide-vue-next'

const route = useRoute()
const elasticStore = useElasticStore()

const searchQuery = ref('')
const showConnectionStatus = ref(false)

const pageTitle = computed(() => {
  const titles = {
    '/': 'Welcome',
    '/builder': 'Dashboard Builder',
    '/library': 'Library',
    '/explore': 'Explore Data',
    '/help': 'Help & Docs'
  }
  
  if (route.path.startsWith('/builder/')) return 'Edit Dashboard'
  
  return titles[route.path] || 'VegaLens'
})

const breadcrumbs = computed(() => {
  const parts = route.path.split('/').filter(Boolean)
  return parts.map((part, index) => ({
    name: part.charAt(0).toUpperCase() + part.slice(1),
    path: '/' + parts.slice(0, index + 1).join('/')
  }))
})

async function refreshConnection() {
  await elasticStore.checkConnection()
}

onMounted(() => {
  elasticStore.checkConnection()
})
</script>

<template>
  <header class="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-700/50">
    <div class="flex items-center justify-between px-8 py-4">
      <!-- Left: Title and Breadcrumbs -->
      <div>
        <h1 class="text-2xl font-display font-semibold text-white">{{ pageTitle }}</h1>
        <nav v-if="breadcrumbs.length > 1" class="flex items-center gap-2 mt-1 text-sm">
          <RouterLink to="/" class="text-slate-400 hover:text-ocean-400 transition-colors">
            Home
          </RouterLink>
          <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
            <span class="text-slate-600">/</span>
            <RouterLink 
              :to="crumb.path" 
              class="text-slate-400 hover:text-ocean-400 transition-colors"
              :class="{ 'text-slate-200': index === breadcrumbs.length - 1 }"
            >
              {{ crumb.name }}
            </RouterLink>
          </template>
        </nav>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-4">
        <!-- Search -->
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search dashboards..."
            class="w-64 pl-10 pr-4 py-2 bg-slate-800/60 border border-slate-600/50 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500/20 transition-all duration-200"
          />
        </div>

        <!-- Connection Status -->
        <div class="relative">
          <button
            @click="showConnectionStatus = !showConnectionStatus"
            class="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200"
            :class="[
              elasticStore.connected 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
            ]"
          >
            <div 
              class="w-2 h-2 rounded-full"
              :class="elasticStore.connected ? 'bg-emerald-400' : 'bg-red-400'"
            ></div>
            <span class="text-sm font-medium">
              {{ elasticStore.connected ? 'Connected' : 'Disconnected' }}
            </span>
            <ChevronDown class="w-4 h-4" />
          </button>

          <!-- Dropdown -->
          <Transition name="dropdown">
            <div 
              v-if="showConnectionStatus"
              class="dropdown-menu right-0 w-72"
            >
              <div class="px-4 py-3 border-b border-slate-700/50">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-slate-300">Elasticsearch Status</span>
                  <button
                    @click="refreshConnection"
                    class="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                    :class="{ 'animate-spin': elasticStore.loading.connection }"
                  >
                    <RefreshCw class="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
              
              <div class="p-4 space-y-3">
                <div class="flex items-center gap-3">
                  <div 
                    class="w-10 h-10 rounded-xl flex items-center justify-center"
                    :class="elasticStore.connected ? 'bg-emerald-500/20' : 'bg-red-500/20'"
                  >
                    <Check v-if="elasticStore.connected" class="w-5 h-5 text-emerald-400" />
                    <AlertCircle v-else class="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p class="text-sm font-medium text-white">
                      {{ elasticStore.connected ? 'Connection Active' : 'Connection Failed' }}
                    </p>
                    <p class="text-xs text-slate-400">
                      {{ elasticStore.connectionInfo?.cluster_name || 'Not connected' }}
                    </p>
                  </div>
                </div>

                <div v-if="elasticStore.connectionInfo?.version" class="p-3 bg-slate-800/50 rounded-lg">
                  <p class="text-xs text-slate-400">Elasticsearch Version</p>
                  <p class="text-sm font-mono text-slate-200">{{ elasticStore.connectionInfo.version }}</p>
                </div>

                <p v-if="elasticStore.error" class="text-xs text-red-400">
                  {{ elasticStore.error }}
                </p>
              </div>
            </div>
          </Transition>
        </div>

      </div>
    </div>
  </header>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>

