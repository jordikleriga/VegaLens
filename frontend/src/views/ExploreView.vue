<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useElasticStore } from '@/stores/elastic'
import { 
  Database, 
  Search, 
  RefreshCw, 
  Table2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  AlertCircle,
  Filter,
  X,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  BarChart3,
  Check
} from 'lucide-vue-next'

const router = useRouter()
const elasticStore = useElasticStore()

const selectedIndex = ref(null)
const fieldSearchQuery = ref('')
const selectedTypes = ref([])

// Custom index dropdown state
const showIndexDropdown = ref(false)

function toggleIndexDropdown() {
  showIndexDropdown.value = !showIndexDropdown.value
}

function closeIndexDropdown() {
  showIndexDropdown.value = false
}

// Column sorting state
const sortField = ref(null)
const sortDirection = ref('asc') // 'asc' or 'desc'

// Column filter state
const columnFilterField = ref(null)
const columnFilterValue = ref('')

// Row detail modal
const selectedRow = ref(null)
const showRowDetail = ref(false)

// Pagination state
const currentPage = ref(1)
const pageSize = ref(25)
const pageSizeOptions = [25, 50, 100]

// Reset page when index changes
watch(() => selectedIndex.value, () => {
  currentPage.value = 1
})

// Get unique field types from current fields, sorted by count (highest first)
const uniqueFieldTypes = computed(() => {
  const types = [...new Set(elasticStore.fields.map(f => f.type))]
  // Sort by count descending
  return types.sort((a, b) => {
    const countA = elasticStore.fields.filter(f => f.type === a).length
    const countB = elasticStore.fields.filter(f => f.type === b).length
    return countB - countA
  })
})

// Filter fields by selected types and search query
const filteredFields = computed(() => {
  let fields = elasticStore.fields
  
  // Filter by type
  if (selectedTypes.value.length > 0) {
    fields = fields.filter(f => selectedTypes.value.includes(f.type))
  }
  
  // Filter by search query
  if (fieldSearchQuery.value) {
    const query = fieldSearchQuery.value.toLowerCase()
    fields = fields.filter(f => f.name.toLowerCase().includes(query))
  }
  
  return fields
})

// Toggle type filter
function toggleTypeFilter(type) {
  const index = selectedTypes.value.indexOf(type)
  if (index === -1) {
    selectedTypes.value.push(type)
  } else {
    selectedTypes.value.splice(index, 1)
  }
}

// Clear all type filters
function clearTypeFilters() {
  selectedTypes.value = []
  fieldSearchQuery.value = ''
}

// Check if a type is selected
function isTypeSelected(type) {
  return selectedTypes.value.includes(type)
}

// Sorted and filtered data
const processedData = computed(() => {
  let data = [...elasticStore.sampleData]
  
  // Apply column filter
  if (columnFilterField.value && columnFilterValue.value) {
    const filterVal = columnFilterValue.value.toLowerCase()
    data = data.filter(row => {
      const val = getNestedValue(row, columnFilterField.value)
      return val != null && String(val).toLowerCase().includes(filterVal)
    })
  }
  
  // Apply sorting
  if (sortField.value) {
    data.sort((a, b) => {
      const aVal = getNestedValue(a, sortField.value)
      const bVal = getNestedValue(b, sortField.value)
      
      // Handle nulls
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortDirection.value === 'asc' ? 1 : -1
      if (bVal == null) return sortDirection.value === 'asc' ? -1 : 1
      
      // Compare values
      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }
      
      return sortDirection.value === 'asc' ? comparison : -comparison
    })
  }
  
  return data
})

// Pagination computed properties
const totalRecords = computed(() => processedData.value.length)
const totalPages = computed(() => Math.ceil(totalRecords.value / pageSize.value))

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return processedData.value.slice(start, end)
})

// Get unique values for a column (for filter dropdown)
function getColumnValues(fieldName) {
  const values = new Set()
  elasticStore.sampleData.forEach(row => {
    const val = getNestedValue(row, fieldName)
    if (val != null) values.add(val)
  })
  return Array.from(values).slice(0, 50) // Limit to 50 unique values
}

// Sort by column
function sortByColumn(fieldName) {
  if (sortField.value === fieldName) {
    // Toggle direction or clear
    if (sortDirection.value === 'asc') {
      sortDirection.value = 'desc'
    } else {
      sortField.value = null
      sortDirection.value = 'asc'
    }
  } else {
    sortField.value = fieldName
    sortDirection.value = 'asc'
  }
  currentPage.value = 1
}

// Apply column filter
function applyColumnFilter(fieldName, value) {
  columnFilterField.value = fieldName
  columnFilterValue.value = value
  currentPage.value = 1
}

// Clear column filter
function clearColumnFilter() {
  columnFilterField.value = null
  columnFilterValue.value = ''
  currentPage.value = 1
}

// Open row detail modal
function openRowDetail(row) {
  selectedRow.value = row
  showRowDetail.value = true
}

// Close row detail modal
function closeRowDetail() {
  showRowDetail.value = false
  selectedRow.value = null
}

// Get value from object - handles both flat keys (from fields API) and nested paths
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined
  
  // First try direct key lookup (for flat field names like "category.keyword")
  if (obj.hasOwnProperty(path)) {
    return obj[path]
  }
  
  // Fall back to nested path traversal
  return path.split('.').reduce((acc, part) => acc?.[part], obj)
}

// Format field value for display in modal
function formatFieldValue(value) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

// Page range for display
const pageRange = computed(() => {
  const range = []
  const maxPages = 5
  let start = Math.max(1, currentPage.value - Math.floor(maxPages / 2))
  let end = Math.min(totalPages.value, start + maxPages - 1)
  
  if (end - start < maxPages - 1) {
    start = Math.max(1, end - maxPages + 1)
  }
  
  for (let i = start; i <= end; i++) {
    range.push(i)
  }
  return range
})

// Pagination methods
function goToPage(page) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function firstPage() {
  currentPage.value = 1
}

function lastPage() {
  currentPage.value = totalPages.value
}

function setPageSize(size) {
  pageSize.value = size
  currentPage.value = 1
}

async function selectIndex(index) {
  selectedIndex.value = index
  currentPage.value = 1
  elasticStore.selectIndex(index.name)
  // Fetch 5000 sample records
  await elasticStore.fetchSampleData(index.name, 5000)
}

async function selectIndexByName(name) {
  if (!name) return
  const index = elasticStore.indices.find(idx => idx.name === name)
  if (index) {
    await selectIndex(index)
  }
}

async function refresh() {
  await elasticStore.fetchIndices()
}

// Navigate to Dashboard Builder step 2 (chart selection)
function goToBuilder() {
  router.push('/builder')
}

function getTypeColor(type) {
  const colors = {
    keyword: 'bg-ocean-500/20 text-ocean-400',
    text: 'bg-emerald-500/20 text-emerald-400',
    long: 'bg-purple-500/20 text-purple-400',
    integer: 'bg-purple-500/20 text-purple-400',
    double: 'bg-purple-500/20 text-purple-400',
    float: 'bg-purple-500/20 text-purple-400',
    date: 'bg-coral-500/20 text-coral-400',
    boolean: 'bg-amber-500/20 text-amber-400',
    object: 'bg-slate-500/20 text-slate-400',
    nested: 'bg-pink-500/20 text-pink-400',
    geo_point: 'bg-cyan-500/20 text-cyan-400'
  }
  return colors[type] || 'bg-slate-500/20 text-slate-400'
}

onMounted(async () => {
  await elasticStore.checkConnection()
  if (elasticStore.connected) {
    await elasticStore.fetchIndices()
  }
})
</script>

<template>
  <div class="h-full flex flex-col animate-fade-in overflow-hidden">
    <!-- Connection Warning -->
    <div 
      v-if="!elasticStore.connected" 
      class="glass-card p-6 border-red-500/30 bg-red-500/5 mb-4 flex-shrink-0"
    >
      <div class="flex items-center gap-4">
        <AlertCircle class="w-6 h-6 text-red-400" />
        <div>
          <h3 class="font-semibold text-red-400">Connection Error</h3>
          <p class="text-sm text-slate-400">
            Unable to connect to Elasticsearch. Check your configuration and try again.
          </p>
        </div>
        <button @click="refresh" class="btn-secondary ml-auto">
          <RefreshCw class="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    </div>

    <!-- Unified Data Explorer Card - Full Height -->
    <div class="glass-card flex-1 flex flex-col overflow-hidden min-h-0">
      <!-- Header with Index Dropdown -->
      <div class="flex items-center justify-between p-4 border-b border-slate-700/50 flex-shrink-0">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-3">
            <Table2 class="w-5 h-5 text-ocean-400" />
            <span class="font-medium text-white">Data Explorer</span>
          </div>
          
          <!-- Index Dropdown (Custom) -->
          <div class="relative z-50">
            <!-- Click outside to close - placed first so it's behind the dropdown -->
            <div v-if="showIndexDropdown" class="fixed inset-0 z-40" @click="closeIndexDropdown"></div>
            
            <button
              @click="toggleIndexDropdown"
              class="relative z-50 flex items-center gap-2 px-3 py-2 bg-slate-800/60 border border-slate-600/50 rounded-xl text-sm min-w-[240px] hover:border-slate-500 transition-all duration-200"
            >
              <Database class="w-4 h-4 text-slate-400" />
              <span class="flex-1 text-left truncate" :class="selectedIndex ? 'text-white' : 'text-slate-400'">
                {{ selectedIndex ? selectedIndex.name : 'Select an index...' }}
              </span>
              <ChevronDown class="w-4 h-4 text-slate-400 transition-transform" :class="{ 'rotate-180': showIndexDropdown }" />
            </button>
            
            <!-- Dropdown Menu -->
            <Transition name="dropdown">
              <div 
                v-if="showIndexDropdown"
                class="absolute top-full left-0 mt-2 w-full bg-slate-800 border border-slate-600/50 rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <div class="max-h-64 overflow-y-auto">
                  <button
                    v-for="index in elasticStore.indices"
                    :key="index.name"
                    @click="selectIndexByName(index.name); closeIndexDropdown()"
                    class="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-700/50 transition-colors text-left"
                    :class="selectedIndex?.name === index.name ? 'bg-ocean-500/20' : ''"
                  >
                    <div 
                      class="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      :class="[
                        index.health === 'green' ? 'bg-emerald-500/20' :
                        index.health === 'yellow' ? 'bg-amber-500/20' : 'bg-red-500/20'
                      ]"
                    >
                      <Database 
                        class="w-3 h-3"
                        :class="[
                          index.health === 'green' ? 'text-emerald-400' :
                          index.health === 'yellow' ? 'text-amber-400' : 'text-red-400'
                        ]"
                      />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-white truncate">{{ index.name }}</p>
                      <p class="text-xs text-slate-400">{{ index.docsCount?.toLocaleString() || 0 }} docs</p>
                    </div>
                    <Check v-if="selectedIndex?.name === index.name" class="w-4 h-4 text-ocean-400 flex-shrink-0" />
                  </button>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Stats chips -->
          <template v-if="selectedIndex">
            <span class="chip text-xs">{{ filteredFields.length }} fields</span>
            <span class="chip text-xs bg-coral-500/20 text-coral-400">{{ totalRecords.toLocaleString() }} records</span>
          </template>
        </div>

        <div class="flex items-center gap-2">
          <!-- Build Chart button - only shows when index is loaded -->
          <button 
            v-if="selectedIndex"
            @click="goToBuilder"
            class="btn-primary flex items-center gap-2 text-sm"
          >
            <BarChart3 class="w-4 h-4" />
            Build Chart
          </button>
          
          <button 
            @click="refresh"
            :disabled="elasticStore.loading.indices"
            class="btn-secondary flex items-center gap-2 text-sm"
            title="Refresh indices"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': elasticStore.loading.indices }" />
          </button>
        </div>
      </div>
      
      <!-- Content Area -->
      <template v-if="selectedIndex">
        <!-- Filters Bar - Single Line -->
        <div class="p-3 border-b border-slate-700/50 bg-slate-800/20 flex-shrink-0">
          <div class="flex items-center gap-3">
            <!-- Type Filter Chips -->
            <span class="text-sm text-slate-300 flex items-center gap-1.5 font-medium flex-shrink-0">
              <Filter class="w-4 h-4" />
              Filter:
            </span>
            <div class="flex flex-wrap gap-1.5 items-center flex-1">
              <button
                v-for="type in uniqueFieldTypes"
                :key="type"
                @click="toggleTypeFilter(type)"
                class="text-xs px-2.5 py-1 rounded-full font-semibold transition-all duration-200"
                :class="[
                  getTypeColor(type),
                  isTypeSelected(type) 
                    ? 'ring-2 ring-white/60 scale-105' 
                    : 'opacity-75 hover:opacity-100'
                ]"
              >
                {{ type }}
                <span class="ml-0.5 font-medium">
                  ({{ elasticStore.fields.filter(f => f.type === type).length }})
                </span>
              </button>
            </div>

            <!-- Search aligned right -->
            <div class="flex items-center gap-2 flex-shrink-0">
              <button 
                v-if="selectedTypes.length > 0 || fieldSearchQuery"
                @click="clearTypeFilters"
                class="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <X class="w-3 h-3" />
                Clear
              </button>
              <div class="relative">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  v-model="fieldSearchQuery"
                  type="text"
                  placeholder="Search fields..."
                  class="form-input pl-8 py-1.5 text-sm w-48"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="elasticStore.loading.fields || elasticStore.loading.data" class="flex-1 flex items-center justify-center">
          <RefreshCw class="w-8 h-8 text-ocean-400 animate-spin" />
        </div>

        <!-- No Fields Match -->
        <div v-else-if="filteredFields.length === 0" class="flex-1 flex items-center justify-center text-slate-400">
          <div class="text-center">
            <Filter class="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p class="text-sm">No fields match the current filters</p>
          </div>
        </div>

        <!-- Data View -->
        <template v-else>
          <!-- Column Filter Active Banner -->
          <div v-if="columnFilterField" class="px-3 py-2 bg-ocean-500/10 border-b border-ocean-500/30 flex-shrink-0">
            <div class="flex items-center justify-between">
              <span class="text-sm text-ocean-300">
                Filtering <strong>{{ columnFilterField }}</strong> by "{{ columnFilterValue }}"
              </span>
              <button 
                @click="clearColumnFilter" 
                class="flex items-center gap-1 text-xs text-ocean-300 hover:text-white transition-colors"
              >
                <X class="w-3 h-3" />
                Clear Filter
              </button>
            </div>
          </div>

          <!-- No data after filter -->
          <div v-if="processedData.length === 0" class="flex-1 flex items-center justify-center">
            <div class="text-center text-slate-400">
              <Filter class="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p class="text-sm">No records match the filter</p>
              <button v-if="columnFilterField" @click="clearColumnFilter" class="btn-secondary mt-3 text-sm">Clear Filter</button>
            </div>
          </div>

          <!-- Data Table - Scrollable -->
          <div v-else class="flex-1 overflow-auto min-h-0">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10 bg-slate-900">
              <tr class="border-b border-slate-700/50">
                <!-- View column -->
                <th class="px-2 py-3 text-center w-12">
                  <Eye class="w-4 h-4 text-slate-500 mx-auto" />
                </th>
                <th 
                  v-for="field in filteredFields" 
                  :key="field.name"
                  class="px-3 py-2 text-left group"
                >
                  <div class="flex flex-col gap-1">
                    <!-- Type badge -->
                    <span 
                      class="text-xs px-2 py-0.5 rounded font-semibold w-fit cursor-pointer hover:ring-2 hover:ring-white/30 transition-all"
                      :class="getTypeColor(field.type)"
                      @click.stop="toggleTypeFilter(field.type)"
                      :title="'Click to filter by ' + field.type"
                    >
                      {{ field.type }}
                    </span>
                    <!-- Field name with sort -->
                    <button 
                      @click="sortByColumn(field.name)"
                      class="flex items-center gap-1.5 text-slate-300 font-medium hover:text-white transition-colors text-left"
                    >
                      <span class="truncate max-w-[120px]" :title="field.name">{{ field.name }}</span>
                      <component 
                        :is="sortField === field.name ? (sortDirection === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown"
                        class="w-3 h-3 flex-shrink-0 transition-opacity"
                        :class="sortField === field.name ? 'text-ocean-400' : 'text-slate-600 opacity-0 group-hover:opacity-100'"
                      />
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="(row, index) in paginatedData" 
                :key="row._id || index"
                class="border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors"
              >
                <!-- View button -->
                <td class="px-2 py-2 text-center">
                  <button 
                    @click="openRowDetail(row)"
                    class="p-1.5 rounded-lg hover:bg-ocean-500/20 transition-colors group"
                    title="View all fields"
                  >
                    <Eye class="w-4 h-4 text-slate-500 group-hover:text-ocean-400" />
                  </button>
                </td>
                <td 
                  v-for="field in filteredFields" 
                  :key="field.name"
                  class="px-3 py-2 text-slate-300 truncate max-w-[180px] cursor-pointer hover:text-white"
                  :title="String(getNestedValue(row, field.name) ?? '')"
                  @click="openRowDetail(row)"
                >
                  {{ getNestedValue(row, field.name) ?? '-' }}
                </td>
              </tr>
            </tbody>
          </table>
          </div>

          <!-- Pagination - Fixed at bottom -->
          <div v-if="totalPages > 0" class="flex items-center justify-between p-3 border-t border-slate-700/50 bg-slate-800/20 flex-shrink-0">
          <!-- Left: Showing info -->
          <div class="flex items-center gap-4">
            <span class="text-sm text-slate-400">
              Showing {{ ((currentPage - 1) * pageSize) + 1 }} - {{ Math.min(currentPage * pageSize, totalRecords) }} of {{ totalRecords.toLocaleString() }}
            </span>
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500">Per page:</span>
              <select 
                :value="pageSize"
                @change="setPageSize(Number($event.target.value))"
                class="form-select py-1 text-xs w-auto"
              >
                <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
              </select>
            </div>
          </div>

          <!-- Right: Page controls -->
          <div class="flex items-center gap-1">
            <button
              @click="firstPage"
              :disabled="currentPage === 1"
              class="p-2 rounded-lg hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="First page"
            >
              <ChevronsLeft class="w-4 h-4 text-slate-400" />
            </button>
            <button
              @click="prevPage"
              :disabled="currentPage === 1"
              class="p-2 rounded-lg hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <ChevronLeft class="w-4 h-4 text-slate-400" />
            </button>

            <div class="flex items-center gap-1 mx-2">
              <button
                v-for="page in pageRange"
                :key="page"
                @click="goToPage(page)"
                class="min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors"
                :class="page === currentPage 
                  ? 'bg-ocean-500 text-white' 
                  : 'text-slate-400 hover:bg-slate-700/50'"
              >
                {{ page }}
              </button>
            </div>

            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              class="p-2 rounded-lg hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <ChevronRight class="w-4 h-4 text-slate-400" />
            </button>
            <button
              @click="lastPage"
              :disabled="currentPage === totalPages"
              class="p-2 rounded-lg hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Last page"
            >
              <ChevronsRight class="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
        </template>
      </template>

      <!-- Empty State - No index selected -->
      <div v-else class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <Database class="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 class="text-xl font-semibold text-white mb-2">Select an Index</h3>
          <p class="text-slate-400">
            Choose an index from the dropdown above to explore data.
          </p>
        </div>
      </div>
    </div>

    <!-- Row Detail Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showRowDetail && selectedRow" 
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div 
            class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            @click="closeRowDetail"
          ></div>

          <!-- Modal -->
          <div class="relative bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <!-- Header -->
            <div class="flex items-center justify-between p-4 border-b border-slate-700/50 flex-shrink-0">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-ocean-500/20 flex items-center justify-center">
                  <Eye class="w-5 h-5 text-ocean-400" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-white">Record Details</h2>
                  <p class="text-xs text-slate-400">ID: {{ selectedRow._id || 'N/A' }}</p>
                </div>
              </div>
              <button 
                @click="closeRowDetail"
                class="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X class="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <!-- Content - Scrollable -->
            <div class="flex-1 overflow-y-auto p-4">
              <div class="grid grid-cols-1 gap-2">
                <div 
                  v-for="field in elasticStore.fields" 
                  :key="field.name"
                  class="flex items-start gap-3 p-3 bg-slate-800/40 rounded-lg hover:bg-slate-800/60 transition-colors"
                >
                  <!-- Field type badge -->
                  <span 
                    class="text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 mt-0.5"
                    :class="getTypeColor(field.type)"
                  >
                    {{ field.type }}
                  </span>
                  <!-- Field name -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-300">{{ field.name }}</p>
                    <p class="text-sm text-white mt-1 break-all">
                      {{ formatFieldValue(getNestedValue(selectedRow, field.name)) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end p-4 border-t border-slate-700/50 flex-shrink-0">
              <button @click="closeRowDetail" class="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Ensure sticky header works in scrollable container */
thead {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgb(15 23 42); /* slate-900 */
}

/* Modal transitions */
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
  transform: scale(0.95);
}

/* Dropdown transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>

