<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useVegaStore } from '@/stores/vega'
import {
  BarChart3,
  LineChart,
  Activity,
  Grid3X3,
  BarChart2,
  Circle,
  Box,
  ArrowRightLeft,
  CircleDot,
  Radar,
  Filter,
  GitCommit,
  Layers,
  Waves,
  Mountain,
  LayoutGrid,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Eye,
  Info,
  ExternalLink
} from 'lucide-vue-next'
import VegaMiniPreview from './VegaMiniPreview.vue'

const emit = defineEmits(['next'])

const vegaStore = useVegaStore()

// Search and collapse state
const searchQuery = ref('')
const expandedSections = ref({})
const allExpanded = ref(false)

// Hover preview state
const hoveredChart = ref(null)
const hoverPosition = ref({ x: 0, y: 0 })
const hoverTimeout = ref(null)

// Initialize all sections as collapsed by default
const initExpandedSections = () => {
  Object.keys(vegaStore.orderedTypesByCategory).forEach(cat => {
    if (expandedSections.value[cat] === undefined) {
      expandedSections.value[cat] = false // Start collapsed
    }
  })
}

// Toggle section
function toggleSection(category) {
  initExpandedSections()
  expandedSections.value[category] = !expandedSections.value[category]
  updateAllExpandedState()
}

// Check if section is expanded
function isSectionExpanded(category) {
  if (searchQuery.value) return true
  if (expandedSections.value[category] === undefined) return false
  return expandedSections.value[category]
}

// Toggle all sections
function toggleAllSections() {
  initExpandedSections()
  allExpanded.value = !allExpanded.value
  Object.keys(expandedSections.value).forEach(cat => {
    expandedSections.value[cat] = allExpanded.value
  })
}

// Update allExpanded state based on current sections
function updateAllExpandedState() {
  const sections = Object.values(expandedSections.value)
  allExpanded.value = sections.length > 0 && sections.every(v => v)
}

// Filtered types by category based on search
const filteredTypesByCategory = computed(() => {
  if (!searchQuery.value) return vegaStore.orderedTypesByCategory
  
  const query = searchQuery.value.toLowerCase()
  const filtered = {}
  
  for (const category of vegaStore.categoryOrder) {
    const types = vegaStore.orderedTypesByCategory[category]
    if (!types) continue
    
    const matchingTypes = types.filter(type => 
      type.name.toLowerCase().includes(query) ||
      type.description?.toLowerCase().includes(query) ||
      category.toLowerCase().includes(query)
    )
    if (matchingTypes.length > 0) {
      filtered[category] = matchingTypes
    }
  }
  
  return filtered
})

const hasResults = computed(() => {
  return Object.values(filteredTypesByCategory.value).some(arr => arr.length > 0)
})

function clearSearch() {
  searchQuery.value = ''
}

// Handle hover for preview popup
function handleMouseEnter(event, type) {
  clearTimeout(hoverTimeout.value)
  hoverTimeout.value = setTimeout(() => {
    const rect = event.target.getBoundingClientRect()
    hoverPosition.value = {
      x: rect.right + 10,
      y: rect.top
    }
    
    // Adjust if popup would go off screen
    if (hoverPosition.value.x + 240 > window.innerWidth) {
      hoverPosition.value.x = rect.left - 250
    }
    if (hoverPosition.value.y + 200 > window.innerHeight) {
      hoverPosition.value.y = window.innerHeight - 210
    }
    
    hoveredChart.value = type
  }, 300) // Delay before showing popup
}

function handleMouseLeave() {
  clearTimeout(hoverTimeout.value)
  hoveredChart.value = null
}

// Clean up on unmount
onUnmounted(() => {
  clearTimeout(hoverTimeout.value)
})

const iconMap = {
  bar: BarChart3,
  line: LineChart,
  area: Activity,
  scatter: Circle,
  heatmap: Grid3X3,
  histogram: BarChart2,
  boxplot: Box,
  sankey: ArrowRightLeft,
  radial: CircleDot,
  radar: Radar,
  funnel: Filter,
  sparkline: Activity,
  error_bars: GitCommit,
  horizon: Layers,
  circle_packing: Circle,
  streamgraph: Waves,
  density: Mountain,
  marimekko: LayoutGrid
}

const gradientMap = {
  comparison: 'from-ocean-500 to-ocean-600',
  trend: 'from-emerald-500 to-emerald-600',
  composition: 'from-coral-500 to-coral-600',
  relationship: 'from-purple-500 to-purple-600',
  correlation: 'from-purple-500 to-purple-600',
  distribution: 'from-cyan-500 to-cyan-600',
  hierarchy: 'from-amber-500 to-amber-600',
  flow: 'from-rose-500 to-rose-600',
  raw: 'from-slate-500 to-slate-600'
}

async function selectType(type) {
  await vegaStore.selectType(type.id)
  emit('next')
}

function proceedToNext() {
  if (vegaStore.selectedType) {
    emit('next')
  }
}

// Get selected chart type info
const selectedTypeInfo = computed(() => {
  return vegaStore.visualizationTypes.find(t => t.id === vegaStore.selectedType)
})
</script>

<template>
  <div class="glass-card p-6 space-y-4">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-coral-500/20 flex items-center justify-center">
        <BarChart3 class="w-5 h-5 text-coral-400" />
      </div>
      <div>
        <h3 class="font-semibold text-white">Choose Chart Type</h3>
        <p class="text-sm text-slate-400">Select how to visualize your data</p>
      </div>
    </div>


    <!-- Search Bar with Toggle -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search chart types..."
          class="form-input pl-10 pr-10 py-2 text-sm"
        />
        <button 
          v-if="searchQuery"
          @click="clearSearch"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      <button
        @click="toggleAllSections"
        :disabled="!!searchQuery"
        class="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border transition-all duration-200"
        :class="searchQuery 
          ? 'border-slate-700 bg-slate-800/30 text-slate-500 cursor-not-allowed' 
          : allExpanded 
            ? 'border-ocean-500/50 bg-ocean-500/10 text-ocean-300 hover:bg-ocean-500/20' 
            : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'"
        :title="allExpanded ? 'Collapse All' : 'Expand All'"
      >
        <component :is="allExpanded ? ChevronDown : ChevronRight" class="w-3.5 h-3.5" />
        <span>{{ allExpanded ? 'Collapse' : 'Expand' }}</span>
      </button>
    </div>

    <!-- No Results -->
    <div v-if="!hasResults && searchQuery" class="text-center py-6 text-slate-400">
      <Search class="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p class="text-sm">No chart types match "{{ searchQuery }}"</p>
    </div>

    <!-- Category Sections -->
    <div class="space-y-2 max-h-[500px] overflow-y-auto scrollbar-hide pr-2">
      <div 
        v-for="(types, category) in filteredTypesByCategory" 
        :key="category"
        class="border border-slate-700/50 rounded-xl overflow-hidden"
      >
        <!-- Category Header -->
        <button
          @click="toggleSection(category)"
          class="w-full flex items-center justify-between p-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
        >
          <div class="flex items-center gap-2">
            <div 
              class="w-6 h-6 rounded-md bg-gradient-to-br flex items-center justify-center"
              :class="gradientMap[category]"
            >
              <component :is="iconMap[types[0]?.id] || BarChart3" class="w-3 h-3 text-white" />
            </div>
            <h4 class="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              {{ vegaStore.categoryLabels[category] || category }}
            </h4>
            <span class="text-xs text-slate-500">({{ types.length }})</span>
          </div>
          <component 
            :is="isSectionExpanded(category) ? ChevronDown : ChevronRight" 
            class="w-4 h-4 text-slate-400"
          />
        </button>
        
        <!-- Category Content with Visual Thumbnails -->
        <Transition name="collapse">
          <div v-if="isSectionExpanded(category)" class="p-2 bg-slate-900/30">
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="type in types"
                :key="type.id"
                @click="selectType(type)"
                @mouseenter="handleMouseEnter($event, type)"
                @mouseleave="handleMouseLeave"
                class="chart-card p-2 rounded-lg border transition-all duration-200 text-left group"
                :class="[
                  vegaStore.selectedType === type.id
                    ? 'bg-ocean-500/20 border-ocean-400 shadow-glow'
                    : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/60'
                ]"
              >
                <!-- Visual Thumbnail -->
                <div class="h-14 mb-2 rounded-md overflow-hidden bg-slate-900/50 flex items-center justify-center">
                  <VegaMiniPreview 
                    :chart-type="type.id" 
                    :width="120" 
                    :height="52"
                    class="transform group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                
                <!-- Chart Info -->
                <div class="flex items-start gap-2">
                  <div 
                    class="w-6 h-6 flex-shrink-0 rounded-md bg-gradient-to-br flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                    :class="gradientMap[type.category]"
                  >
                    <component 
                      :is="iconMap[type.id] || BarChart3" 
                      class="w-3 h-3 text-white" 
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p 
                      class="text-xs font-medium truncate"
                      :class="vegaStore.selectedType === type.id ? 'text-ocean-300' : 'text-white'"
                    >
                      {{ type.name }}
                    </p>
                    <p class="text-[10px] text-slate-500 truncate">{{ type.description }}</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Selected Type Info -->
    <div
      v-if="vegaStore.selectedType"
      class="p-3 bg-ocean-500/10 border border-ocean-500/30 rounded-xl space-y-2"
    >
      <div class="flex items-center gap-3">
        <div class="w-16 h-12 rounded-lg overflow-hidden bg-slate-800/50">
          <VegaMiniPreview
            :chart-type="vegaStore.selectedType"
            :width="64"
            :height="48"
          />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-ocean-300 truncate">
            {{ selectedTypeInfo?.name }}
          </p>
          <p class="text-xs text-slate-400 truncate">
            {{ selectedTypeInfo?.description }}
          </p>
        </div>
        <Eye class="w-4 h-4 text-ocean-400 flex-shrink-0" />
      </div>
      <!-- Help Text (if available) -->
      <div
        v-if="selectedTypeInfo?.helpText"
        class="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs"
      >
        <Info class="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div class="flex-1 min-w-0">
          <p class="text-amber-200/90">{{ selectedTypeInfo.helpText }}</p>
          <a
            v-if="selectedTypeInfo?.helpLink"
            :href="selectedTypeInfo.helpLink"
            target="_blank"
            class="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 mt-1"
          >
            <span>Learn more</span>
            <ExternalLink class="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>

    <!-- Continue Button -->
    <button
      @click="proceedToNext"
      :disabled="!vegaStore.selectedType"
      class="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Continue to Configuration
    </button>

    <!-- Hover Preview Popup -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div 
          v-if="hoveredChart"
          class="preview-popup fixed z-50 pointer-events-none"
          :style="{ 
            left: `${hoverPosition.x}px`, 
            top: `${hoverPosition.y}px` 
          }"
        >
          <div class="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4 w-56">
            <!-- Larger Preview -->
            <div class="h-28 mb-3 rounded-lg overflow-hidden bg-slate-900/70 flex items-center justify-center p-2">
              <VegaMiniPreview 
                :chart-type="hoveredChart.id" 
                :width="190" 
                :height="105"
              />
            </div>
            
            <!-- Chart Info -->
            <div class="text-center">
              <h4 class="font-medium text-white mb-1">{{ hoveredChart.name }}</h4>
              <p class="text-xs text-slate-400">{{ hoveredChart.description }}</p>
              <div 
                class="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r"
                :class="gradientMap[hoveredChart.category]"
              >
                {{ vegaStore.categoryLabels[hoveredChart.category] || hoveredChart.category }}
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 500px;
}

.chart-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.chart-card:hover {
  transform: translateY(-1px);
}

.preview-popup {
  transform-origin: left center;
}

.shadow-glow {
  box-shadow: 0 0 20px rgba(14, 165, 233, 0.15);
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
