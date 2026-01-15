<script setup>
import { ref, computed } from 'vue'
import { useElasticStore } from '@/stores/elastic'
import { 
  Database, 
  Search, 
  ChevronDown, 
  Check,
  AlertCircle,
  RefreshCw,
  Hash,
  HardDrive,
  Type,
  Calendar,
  MapPin,
  ToggleLeft,
  Box
} from 'lucide-vue-next'

const emit = defineEmits(['next'])

const elasticStore = useElasticStore()

const searchQuery = ref('')
const isOpen = ref(false)
const activeTooltip = ref(null)
const tooltipPosition = ref({ top: 0, left: 0 })

// Tooltip show/hide 
function showTooltip(type, event) {
  const rect = event.currentTarget.getBoundingClientRect()
  tooltipPosition.value = {
    top: rect.top,
    left: rect.right + 16
  }
  activeTooltip.value = type
}

function hideTooltip() {
  activeTooltip.value = null
}

// Get fields sorted alphabetically
function getSortedFields(type) {
  if (!fieldsByType.value[type]) return []
  return [...fieldsByType.value[type]].sort((a, b) => 
    a.name.localeCompare(b.name)
  )
}

// Tooltip positioning - positioned to the right of the hovered card
const tooltipStyle = computed(() => ({
  top: `${tooltipPosition.value.top}px`,
  left: `${tooltipPosition.value.left}px`,
  zIndex: 99999,
  maxWidth: 'calc(100vw - 300px)',
  maxHeight: '80vh',
  overflow: 'auto'
}))

// Sample size - bound to store
const sampleSize = computed({
  get: () => elasticStore.sampleSize,
  set: (val) => elasticStore.setSampleSize(val)
})

// Field type configuration
const fieldTypeConfig = {
  string: { 
    label: 'Text', 
    icon: Type, 
    color: 'text-emerald-400', 
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30'
  },
  number: { 
    label: 'Numeric', 
    icon: Hash, 
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30'
  },
  date: { 
    label: 'Date', 
    icon: Calendar, 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30'
  },
  geo: { 
    label: 'Geo', 
    icon: MapPin, 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30'
  },
  boolean: { 
    label: 'Boolean', 
    icon: ToggleLeft, 
    color: 'text-pink-400', 
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30'
  },
  other: { 
    label: 'Other', 
    icon: Box, 
    color: 'text-slate-400', 
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30'
  }
}

// Group fields by type
const fieldsByType = computed(() => {
  const groups = {}
  for (const field of elasticStore.fields) {
    const category = field.category || 'other'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(field)
  }
  return groups
})

// Get sorted type entries for display
const sortedFieldTypes = computed(() => {
  const order = ['string', 'number', 'date', 'boolean', 'geo', 'other']
  return order
    .filter(type => fieldsByType.value[type]?.length > 0)
    .map(type => ({
      type,
      config: fieldTypeConfig[type],
      fields: fieldsByType.value[type]
    }))
})

const filteredIndices = computed(() => {
  if (!searchQuery.value) return elasticStore.indices
  const query = searchQuery.value.toLowerCase()
  return elasticStore.indices.filter(idx => 
    idx.name.toLowerCase().includes(query)
  )
})

const selectedIndexInfo = computed(() => {
  if (!elasticStore.currentIndex) return null
  return elasticStore.indices.find(idx => idx.name === elasticStore.currentIndex)
})

async function selectIndex(index) {
  elasticStore.selectIndex(index.name)
  isOpen.value = false
  
  // Fetch sample data
  await elasticStore.fetchSampleData(index.name, sampleSize.value)
}

async function refreshData() {
  if (elasticStore.currentIndex) {
    await elasticStore.fetchSampleData(elasticStore.currentIndex, sampleSize.value)
  }
}

function proceedToNext() {
  if (elasticStore.currentIndex) {
    emit('next')
  }
}

</script>

<template>
  <div class="glass-card p-6 space-y-6 overflow-visible">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-ocean-500/20 flex items-center justify-center">
        <Database class="w-5 h-5 text-ocean-400" />
      </div>
      <div>
        <h3 class="font-semibold text-white">Select Data Source</h3>
        <p class="text-sm text-slate-400">Choose an Elasticsearch index</p>
      </div>
    </div>

    <!-- Connection Status -->
    <div 
      v-if="!elasticStore.connected"
      class="p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
    >
      <div class="flex items-center gap-3">
        <AlertCircle class="w-5 h-5 text-red-400" />
        <div>
          <p class="text-sm font-medium text-red-400">Not Connected</p>
          <p class="text-xs text-slate-400">Check your Elasticsearch configuration</p>
        </div>
      </div>
    </div>

    <!-- Index Dropdown -->
    <div v-else class="space-y-4">
      <div class="relative z-50">
        <label class="form-label">Index</label>
        <button
          @click="isOpen = !isOpen"
          class="w-full flex items-center justify-between form-select text-left"
          :class="{ 'border-ocean-500': isOpen }"
        >
          <span v-if="elasticStore.currentIndex" class="text-white">
            {{ elasticStore.currentIndex }}
          </span>
          <span v-else class="text-slate-400">Select an index...</span>
          <ChevronDown 
            class="w-5 h-5 text-slate-400 transition-transform duration-200" 
            :class="{ 'rotate-180': isOpen }"
          />
        </button>

        <!-- Dropdown -->
        <Transition name="dropdown">
          <div v-if="isOpen" class="absolute z-[100] mt-2 w-full min-w-[200px] py-2 bg-slate-800 border border-slate-600/50 rounded-xl shadow-2xl max-h-80 overflow-y-auto">
            <!-- Search -->
            <div class="px-3 pb-2 sticky top-0 bg-slate-800">
              <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search indices..."
                  class="w-full pl-9 pr-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-ocean-500"
                  @click.stop
                />
              </div>
            </div>

            <!-- Index List -->
            <div v-if="filteredIndices.length > 0">
              <button
                v-for="index in filteredIndices"
                :key="index.name"
                @click="selectIndex(index)"
                class="w-full flex items-center gap-3 px-4 py-3 hover:bg-ocean-500/20 transition-colors"
              >
                <div 
                  class="w-8 h-8 rounded-lg flex items-center justify-center"
                  :class="[
                    index.health === 'green' ? 'bg-emerald-500/20' :
                    index.health === 'yellow' ? 'bg-amber-500/20' : 'bg-red-500/20'
                  ]"
                >
                  <Database 
                    class="w-4 h-4"
                    :class="[
                      index.health === 'green' ? 'text-emerald-400' :
                      index.health === 'yellow' ? 'text-amber-400' : 'text-red-400'
                    ]"
                  />
                </div>
                <div class="flex-1 text-left">
                  <p class="text-sm font-medium text-white">{{ index.name }}</p>
                  <p class="text-xs text-slate-400">
                    {{ index.docsCount.toLocaleString() }} docs · {{ index.storeSize }}
                  </p>
                </div>
                <Check 
                  v-if="elasticStore.currentIndex === index.name" 
                  class="w-4 h-4 text-ocean-400" 
                />
              </button>
            </div>
            
            <div v-else class="px-4 py-6 text-center text-slate-400 text-sm">
              No indices found
            </div>
          </div>
        </Transition>
      </div>

      <!-- Selected Index Info -->
      <div v-if="selectedIndexInfo" class="p-4 bg-slate-800/40 rounded-xl space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-slate-400">Selected Index</span>
          <button
            @click="refreshData"
            :disabled="elasticStore.loading.data"
            class="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <RefreshCw 
              class="w-4 h-4 text-slate-400" 
              :class="{ 'animate-spin': elasticStore.loading.data }"
            />
          </button>
        </div>
        
        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 bg-slate-800/60 rounded-lg">
            <div class="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Hash class="w-3 h-3" />
              Documents
            </div>
            <p class="font-semibold text-white">
              {{ selectedIndexInfo.docsCount.toLocaleString() }}
            </p>
          </div>
          <div class="p-3 bg-slate-800/60 rounded-lg">
            <div class="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <HardDrive class="w-3 h-3" />
              Size
            </div>
            <p class="font-semibold text-white">{{ selectedIndexInfo.storeSize }}</p>
          </div>
        </div>

        <!-- Fields Preview by Type -->
        <div v-if="elasticStore.fields.length > 0">
          <p class="text-sm text-slate-400 mb-3">
            {{ elasticStore.fields.length }} fields available
          </p>
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="{ type, config, fields } in sortedFieldTypes"
              :key="type"
              class="field-type-card"
              @mouseenter="showTooltip(type, $event)"
              @mouseleave="hideTooltip"
            >
              <!-- Type Card -->
              <div 
                class="flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all duration-200 cursor-pointer"
                :class="[config.bgColor, config.borderColor, 'hover:border-opacity-60']"
              >
                <component :is="config.icon" class="w-4 h-4" :class="config.color" />
                <span class="text-sm font-medium" :class="config.color">{{ config.label }}</span>
                <span class="ml-auto text-sm text-slate-400">{{ fields.length }}</span>
              </div>
            </div>
          </div>
          
          <!-- Tooltip Portal -->
          <Teleport to="body">
            <Transition name="tooltip">
              <div 
                v-if="activeTooltip && fieldsByType[activeTooltip]"
                class="fixed bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-5"
                :style="tooltipStyle"
              >
                <p class="text-sm font-semibold mb-4 pb-2 border-b border-slate-700" :class="fieldTypeConfig[activeTooltip].color">
                  {{ fieldTypeConfig[activeTooltip].label }} Fields ({{ fieldsByType[activeTooltip].length }})
                </p>
                <div 
                  class="gap-x-8 gap-y-1"
                  :style="{ 
                    columns: Math.min(3, Math.ceil(fieldsByType[activeTooltip].length / 15)) + '',
                    columnWidth: '200px'
                  }"
                >
                  <p 
                    v-for="field in getSortedFields(activeTooltip)" 
                    :key="field.name"
                    class="text-sm text-slate-300 py-0.5 break-inside-avoid"
                  >
                    {{ field.name }}
                  </p>
                </div>
              </div>
            </Transition>
          </Teleport>
        </div>
      </div>
    </div>

    <!-- Continue Button -->
    <button
      @click="proceedToNext"
      :disabled="!elasticStore.currentIndex"
      class="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Continue to Chart Type
    </button>
  </div>
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

.tooltip-enter-active,
.tooltip-leave-active {
  transition: all 0.15s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>

