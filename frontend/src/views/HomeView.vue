<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useElasticStore } from '@/stores/elastic'
import { useDashboardStore } from '@/stores/dashboard'
import { 
  PlusCircle, 
  ArrowRight, 
  BarChart3, 
  LineChart, 
  PieChart,
  Activity,
  Database,
  Layers,
  Sparkles,
  TrendingUp
} from 'lucide-vue-next'

const elasticStore = useElasticStore()
const dashboardStore = useDashboardStore()

const stats = ref([
  { label: 'Indices Available', value: 0, icon: Database, color: 'ocean' },
  { label: 'Saved Dashboards', value: 0, icon: Layers, color: 'coral' },
  { label: 'Visualizations', value: 0, icon: BarChart3, color: 'emerald' }
])

const quickStarts = [
  { 
    type: 'bar', 
    name: 'Bar Chart', 
    description: 'Compare categories',
    icon: BarChart3,
    gradient: 'from-ocean-500 to-ocean-600'
  },
  { 
    type: 'line', 
    name: 'Line Chart', 
    description: 'Show trends over time',
    icon: LineChart,
    gradient: 'from-emerald-500 to-emerald-600'
  },
  { 
    type: 'pie', 
    name: 'Pie Chart', 
    description: 'Display proportions',
    icon: PieChart,
    gradient: 'from-coral-500 to-coral-600'
  },
  { 
    type: 'scatter', 
    name: 'Scatter Plot', 
    description: 'Find correlations',
    icon: Activity,
    gradient: 'from-purple-500 to-purple-600'
  }
]

onMounted(async () => {
  await elasticStore.checkConnection()
  if (elasticStore.connected) {
    await elasticStore.fetchIndices()
    stats.value[0].value = elasticStore.indices.length
  }
  await dashboardStore.fetchDashboards()
  stats.value[1].value = dashboardStore.dashboards.length
  stats.value[2].value = dashboardStore.dashboards.reduce(
    (acc, d) => acc + (d.visualizationCount || 0), 0
  )
})
</script>

<template>
  <div class="space-y-10 animate-fade-in">
    <!-- Hero Section -->
    <section class="relative overflow-hidden glass-card p-10">
      <div class="absolute inset-0 bg-gradient-to-br from-ocean-500/10 via-transparent to-coral-500/10"></div>
      <div class="relative z-10">
        <div class="flex items-start justify-between">
          <div class="max-w-2xl">
            <div class="flex items-center gap-2 mb-4">
              <Sparkles class="w-5 h-5 text-ocean-400" />
              <span class="text-sm font-medium text-ocean-400">Welcome to VegaLens</span>
            </div>
            <h1 class="text-4xl font-display font-bold text-white mb-4">
              Create Beautiful 
              <span class="text-gradient">Vega Dashboards</span>
              <br />for Elasticsearch
            </h1>
            <p class="text-lg text-slate-300 mb-8 leading-relaxed">
              Drag-and-drop interface to build powerful visualizations. 
              Connect to your Elasticsearch data and generate Vega specs 
              compatible with Kibana.
            </p>
            <div class="flex items-center gap-4">
              <RouterLink to="/builder" class="btn-primary inline-flex items-center gap-2">
                <PlusCircle class="w-5 h-5" />
                Create Dashboard
              </RouterLink>
              <RouterLink to="/explore" class="btn-secondary inline-flex items-center gap-2">
                <Database class="w-5 h-5" />
                Explore Data
              </RouterLink>
            </div>
          </div>
          
          <!-- Floating chart illustration -->
          <div class="hidden xl:block relative">
            <div class="w-64 h-64 relative animate-float">
              <div class="absolute inset-0 bg-gradient-to-br from-ocean-500/30 to-coral-500/30 rounded-3xl blur-2xl"></div>
              <div class="relative glass-card p-6 rounded-3xl border-ocean-500/30">
                <div class="flex items-end gap-2 h-40">
                  <div class="flex-1 bg-gradient-to-t from-ocean-500 to-ocean-400 rounded-lg h-3/4 animate-pulse-soft" style="animation-delay: 0s;"></div>
                  <div class="flex-1 bg-gradient-to-t from-ocean-500 to-ocean-400 rounded-lg h-full animate-pulse-soft" style="animation-delay: 0.1s;"></div>
                  <div class="flex-1 bg-gradient-to-t from-coral-500 to-coral-400 rounded-lg h-1/2 animate-pulse-soft" style="animation-delay: 0.2s;"></div>
                  <div class="flex-1 bg-gradient-to-t from-ocean-500 to-ocean-400 rounded-lg h-2/3 animate-pulse-soft" style="animation-delay: 0.3s;"></div>
                  <div class="flex-1 bg-gradient-to-t from-coral-500 to-coral-400 rounded-lg h-4/5 animate-pulse-soft" style="animation-delay: 0.4s;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats -->
    <section class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div
        v-for="(stat, index) in stats"
        :key="stat.label"
        class="glass-card p-6 flex items-center gap-4 animate-slide-up"
        :style="{ animationDelay: `${index * 0.1}s` }"
      >
        <div 
          class="w-14 h-14 rounded-2xl flex items-center justify-center"
          :class="{
            'bg-ocean-500/20': stat.color === 'ocean',
            'bg-coral-500/20': stat.color === 'coral',
            'bg-emerald-500/20': stat.color === 'emerald'
          }"
        >
          <component 
            :is="stat.icon" 
            class="w-7 h-7"
            :class="{
              'text-ocean-400': stat.color === 'ocean',
              'text-coral-400': stat.color === 'coral',
              'text-emerald-400': stat.color === 'emerald'
            }"
          />
        </div>
        <div>
          <p class="text-3xl font-bold text-white">{{ stat.value }}</p>
          <p class="text-sm text-slate-400">{{ stat.label }}</p>
        </div>
      </div>
    </section>

    <!-- Quick Start -->
    <section>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-display font-semibold text-white">Quick Start</h2>
          <p class="text-sm text-slate-400 mt-1">Choose a visualization type to get started</p>
        </div>
        <RouterLink 
          to="/builder" 
          class="flex items-center gap-2 text-sm text-ocean-400 hover:text-ocean-300 transition-colors"
        >
          View all types
          <ArrowRight class="w-4 h-4" />
        </RouterLink>
      </div>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RouterLink
          v-for="(viz, index) in quickStarts"
          :key="viz.type"
          :to="`/builder?type=${viz.type}`"
          class="glass-card p-6 group hover:border-ocean-500/50 hover:shadow-glow transition-all duration-300 animate-slide-up"
          :style="{ animationDelay: `${0.3 + index * 0.1}s` }"
        >
          <div 
            class="w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
            :class="viz.gradient"
          >
            <component :is="viz.icon" class="w-6 h-6 text-white" />
          </div>
          <h3 class="font-semibold text-white mb-1">{{ viz.name }}</h3>
          <p class="text-sm text-slate-400">{{ viz.description }}</p>
        </RouterLink>
      </div>
    </section>

    <!-- Recent Dashboards -->
    <section v-if="dashboardStore.dashboards.length > 0">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-display font-semibold text-white">Recent Dashboards</h2>
          <p class="text-sm text-slate-400 mt-1">Continue where you left off</p>
        </div>
        <RouterLink 
          to="/library" 
          class="flex items-center gap-2 text-sm text-ocean-400 hover:text-ocean-300 transition-colors"
        >
          View all
          <ArrowRight class="w-4 h-4" />
        </RouterLink>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <RouterLink
          v-for="dashboard in dashboardStore.dashboards.slice(0, 3)"
          :key="dashboard.id"
          :to="`/dashboards/${dashboard.id}`"
          class="glass-card p-6 hover:border-ocean-500/50 hover:shadow-glow transition-all duration-300"
        >
          <div class="flex items-start justify-between mb-4">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-ocean-500 to-coral-500 flex items-center justify-center">
              <Layers class="w-5 h-5 text-white" />
            </div>
            <span class="chip">
              {{ dashboard.visualizationCount || 0 }} charts
            </span>
          </div>
          <h3 class="font-semibold text-white mb-1 truncate">{{ dashboard.name }}</h3>
          <p class="text-sm text-slate-400 truncate">{{ dashboard.description || 'No description' }}</p>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

