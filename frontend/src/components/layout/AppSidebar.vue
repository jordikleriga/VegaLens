<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useElasticStore } from '@/stores/elastic'
import { useConnectionStore } from '@/stores/connection'
import { 
  LayoutDashboard, 
  PlusCircle, 
  Database, 
  FolderOpen,
  Settings,
  HelpCircle,
  Sparkles,
  BarChart3,
  RefreshCw,
  Check,
  AlertCircle,
  ChevronDown,
  Shield,
  ExternalLink
} from 'lucide-vue-next'

const route = useRoute()
const elasticStore = useElasticStore()
const connectionStore = useConnectionStore()
const showConnectionDetails = ref(false)

async function refreshConnection() {
  await connectionStore.checkConnection()
  if (connectionStore.isConnected) {
    await elasticStore.checkConnection()
  }
}

function openConnectionSettings() {
  showConnectionDetails.value = false
  connectionStore.openSettings()
}

onMounted(async () => {
  // Check connection on mount
  await connectionStore.checkConnection()
  if (connectionStore.isConnected) {
    await elasticStore.checkConnection()
  }
})

const navItems = [
  { 
    name: 'Dashboard Builder', 
    path: '/builder', 
    icon: PlusCircle,
    description: 'Create new visualizations'
  },
  { 
    name: 'Library', 
    path: '/library', 
    icon: FolderOpen,
    description: 'Example visualizations'
  },
  { 
    name: 'Explore Data', 
    path: '/explore', 
    icon: Database,
    description: 'Browse Elasticsearch indices'
  }
]

const isActive = (path) => {
  if (path === '/builder') {
    return route.path === '/builder' || route.path.startsWith('/builder/')
  }
  if (path === '/library') {
    return route.path === '/library' || route.path.startsWith('/library/')
  }
  return route.path === path
}

// Display info for the connection
const connectionDisplayName = computed(() => {
  if (connectionStore.isConnected) {
    return connectionStore.displayName
  }
  return 'Not Connected'
})

const connectionVersion = computed(() => {
  return connectionStore.clusterInfo?.version || elasticStore.connectionInfo?.version
})
</script>

<template>
  <aside class="fixed left-0 top-0 bottom-0 w-64 bg-slate-900/80 backdrop-blur-xl border-r border-slate-700/50 flex flex-col z-40">
    <!-- Logo -->
    <RouterLink to="/" class="p-6 flex items-center gap-3 group">
      <div class="w-10 h-10 bg-gradient-to-br from-ocean-400 to-coral-500 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-glow transition-shadow duration-300">
        <BarChart3 class="w-5 h-5 text-white" />
      </div>
      <div>
        <h1 class="font-display font-semibold text-lg text-white group-hover:text-gradient transition-all duration-300">VegaLens</h1>
        <p class="text-xs text-slate-400">Dashboard Builder</p>
      </div>
    </RouterLink>

    <!-- Navigation -->
    <nav class="flex-1 px-4 py-6 space-y-2">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group"
        :class="[
          isActive(item.path) 
            ? 'bg-ocean-500/20 text-ocean-300 shadow-glow' 
            : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
        ]"
      >
        <component 
          :is="item.icon" 
          class="w-5 h-5 transition-transform duration-200 group-hover:scale-110" 
        />
        <div class="flex-1">
          <span class="font-medium text-sm">{{ item.name }}</span>
          <p class="text-xs opacity-60 mt-0.5">{{ item.description }}</p>
        </div>
        <Sparkles 
          v-if="isActive(item.path)" 
          class="w-4 h-4 text-ocean-400 animate-pulse-soft" 
        />
      </RouterLink>
    </nav>

    <!-- Bottom section -->
    <div class="p-4 border-t border-slate-700/50 space-y-2">
      <!-- Connection Status -->
      <div class="relative">
        <button
          @click="showConnectionDetails = !showConnectionDetails"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
          :class="[
            connectionStore.isConnected 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20' 
              : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
          ]"
        >
          <div 
            class="w-2 h-2 rounded-full"
            :class="connectionStore.isConnected ? 'bg-emerald-400' : 'bg-red-400'"
          ></div>
          <span class="text-sm font-medium flex-1 text-left truncate">
            {{ connectionStore.isConnected ? connectionDisplayName : 'Disconnected' }}
          </span>
          <ChevronDown 
            class="w-4 h-4 transition-transform duration-200 flex-shrink-0" 
            :class="{ 'rotate-180': showConnectionDetails }"
          />
        </button>

        <!-- Connection Details Dropdown -->
        <Transition name="dropdown">
          <div 
            v-if="showConnectionDetails"
            class="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl overflow-hidden"
          >
            <div class="px-4 py-3 border-b border-slate-700/50">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-slate-300">Elasticsearch</span>
                <div class="flex items-center gap-1">
                  <button
                    @click.stop="refreshConnection"
                    class="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                    :class="{ 'animate-spin': connectionStore.loading }"
                    title="Refresh connection"
                  >
                    <RefreshCw class="w-4 h-4 text-slate-400" />
                  </button>
                  <button
                    @click.stop="openConnectionSettings"
                    class="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                    title="Connection settings"
                  >
                    <Settings class="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
            
            <div class="p-4 space-y-3">
              <div class="flex items-center gap-3">
                <div 
                  class="w-8 h-8 rounded-lg flex items-center justify-center"
                  :class="connectionStore.isConnected ? 'bg-emerald-500/20' : 'bg-red-500/20'"
                >
                  <Check v-if="connectionStore.isConnected" class="w-4 h-4 text-emerald-400" />
                  <AlertCircle v-else class="w-4 h-4 text-red-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-white truncate">
                    {{ connectionStore.clusterInfo?.name || elasticStore.connectionInfo?.cluster_name || 'Not connected' }}
                  </p>
                  <p v-if="connectionVersion" class="text-xs text-slate-400">
                    v{{ connectionVersion }}
                  </p>
                </div>
              </div>

              <!-- Connection Type Badge -->
              <div v-if="connectionStore.isConnected && connectionStore.isCustomConnection" class="flex items-center gap-2">
                <Shield class="w-3.5 h-3.5 text-emerald-400" />
                <span class="text-xs text-slate-400">Session-only credentials</span>
              </div>

              <p v-if="connectionStore.error" class="text-xs text-red-400">
                {{ connectionStore.error }}
              </p>

              <!-- Configure Connection Button -->
              <button
                @click.stop="openConnectionSettings"
                class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <Settings class="w-4 h-4" />
                <span>{{ connectionStore.isConnected ? 'Change Connection' : 'Connect to Elasticsearch' }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <RouterLink 
        to="/help"
        class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800/60 hover:text-white transition-all duration-200"
        :class="[isActive('/help') ? 'bg-ocean-500/20 text-ocean-300' : '']"
      >
        <HelpCircle class="w-5 h-5" />
        <span class="text-sm font-medium">Help & Docs</span>
      </RouterLink>
    </div>
  </aside>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
