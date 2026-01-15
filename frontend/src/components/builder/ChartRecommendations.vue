<script setup>
import { ref, watch, computed } from 'vue'
import { Sparkles, ChevronDown, ChevronUp, Info, Loader2 } from 'lucide-vue-next'
import { useElasticStore } from '@/stores/elastic'
import { useVegaStore } from '@/stores/vega'
import { useAggregationStore } from '@/stores/aggregation'
import api from '@/services/api'
import VegaMiniPreview from './VegaMiniPreview.vue'

const emit = defineEmits(['select'])

const elasticStore = useElasticStore()
const vegaStore = useVegaStore()
const aggregationStore = useAggregationStore()

const recommendations = ref([])
const analyzedFields = ref({})
const loading = ref(false)
const error = ref(null)
const showRecommendations = ref(true)
const hasAttemptedFetch = ref(false)

// Check if we have sufficient data for recommendations
const canFetchRecommendations = computed(() => {
  return elasticStore.currentIndex && 
         elasticStore.fieldMappings && 
         Object.keys(elasticStore.fieldMappings).length > 0
})

// Summary of analyzed fields
const fieldSummary = computed(() => {
  const fields = analyzedFields.value
  const parts = []
  if (fields.date?.length) parts.push(`${fields.date.length} date`)
  if (fields.numeric?.length) parts.push(`${fields.numeric.length} numeric`)
  if (fields.categorical?.length) parts.push(`${fields.categorical.length} categorical`)
  if (fields.text?.length) parts.push(`${fields.text.length} text`)
  return parts.join(', ') || 'No fields analyzed'
})

// Fetch recommendations when data source changes
watch(
  () => [elasticStore.currentIndex, elasticStore.fieldMappings],
  async () => {
    if (canFetchRecommendations.value) {
      await fetchRecommendations()
    }
  },
  { immediate: true }
)

// Also re-fetch when aggregation config changes (user may have selected different fields)
watch(
  () => aggregationStore.currentConfig,
  async () => {
    if (canFetchRecommendations.value && aggregationStore.hasAggregation) {
      await fetchRecommendations()
    }
  },
  { deep: true }
)

async function fetchRecommendations() {
  if (loading.value) return
  
  loading.value = true
  error.value = null
  hasAttemptedFetch.value = true
  
  try {
    const response = await api.post('/vega/recommend', {
      fieldMappings: elasticStore.fieldMappings,
      sampleData: elasticStore.sampleData?.slice(0, 20) || [],
      aggregationConfig: aggregationStore.hasAggregation ? aggregationStore.currentConfig : null
    })
    
    recommendations.value = response.data.recommendations || []
    analyzedFields.value = response.data.analyzedFields || {}
    
    // Auto-expand if we have recommendations
    if (recommendations.value.length > 0) {
      showRecommendations.value = true
    }
  } catch (err) {
    console.error('Failed to get recommendations:', err)
    error.value = err.message
    recommendations.value = []
  } finally {
    loading.value = false
  }
}

function selectRecommendation(chartType) {
  vegaStore.selectType(chartType)
  emit('select', chartType)
}

function toggleRecommendations() {
  showRecommendations.value = !showRecommendations.value
}

// Get score color based on match percentage
function getScoreColor(score) {
  if (score >= 85) return 'from-emerald-500 to-green-500'
  if (score >= 70) return 'from-ocean-500 to-cyan-500'
  if (score >= 50) return 'from-amber-500 to-yellow-500'
  return 'from-slate-500 to-slate-400'
}

function getScoreTextColor(score) {
  if (score >= 85) return 'text-emerald-400'
  if (score >= 70) return 'text-ocean-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-slate-400'
}
</script>

<template>
  <div 
    class="recommendations-panel rounded-xl border border-slate-700/50 overflow-hidden transition-all duration-300 mb-3"
    :class="{ 'bg-gradient-to-r from-amber-500/5 to-ocean-500/5': recommendations.length > 0 }"
  >
    <!-- Header -->
    <button 
      @click="toggleRecommendations"
      class="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors"
    >
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
          <Sparkles class="w-4 h-4 text-amber-400" />
        </div>
        <div class="text-left">
          <h3 class="font-semibold text-white text-sm">
            Smart Recommendations
            <span v-if="recommendations.length > 0" class="text-slate-400 font-normal">
              ({{ recommendations.length }})
            </span>
          </h3>
          <p class="text-xs text-slate-500">{{ fieldSummary }}</p>
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <!-- Loading indicator -->
        <Loader2 v-if="loading" class="w-4 h-4 text-ocean-400 animate-spin" />
        
        <!-- Collapse/expand icon -->
        <component 
          :is="showRecommendations ? ChevronUp : ChevronDown" 
          class="w-4 h-4 text-slate-400"
        />
      </div>
    </button>

    <!-- Content -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 max-h-0"
      enter-to-class="opacity-100 max-h-[500px]"
      leave-from-class="opacity-100 max-h-[500px]"
      leave-to-class="opacity-0 max-h-0"
    >
      <div v-if="showRecommendations" class="overflow-hidden">
        <!-- Error State -->
        <div v-if="error" class="px-4 pb-4">
          <div class="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
            Failed to get recommendations: {{ error }}
          </div>
        </div>

        <!-- No Data Source Selected -->
        <div v-else-if="!canFetchRecommendations" class="px-4 pb-4">
          <div class="p-3 rounded-lg bg-slate-800/50 text-sm text-slate-400 text-center">
            <Info class="w-4 h-4 inline-block mr-1 opacity-50" />
            Select a data source in Step 1 to get AI-powered chart recommendations
          </div>
        </div>

        <!-- No Recommendations Found -->
        <div v-else-if="!loading && recommendations.length === 0" class="px-4 pb-4">
          <div class="p-3 rounded-lg bg-slate-800/50 text-sm text-slate-400 text-center">
            <Info class="w-4 h-4 inline-block mr-1 opacity-50" />
            No specific recommendations for your data. Try any chart type!
          </div>
        </div>

        <!-- Recommendations Grid -->
        <div v-else-if="recommendations.length > 0" class="px-4 pb-4">
          <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <button
              v-for="rec in recommendations"
              :key="rec.type"
              @click="selectRecommendation(rec.type)"
              class="recommendation-card group flex-shrink-0 w-36 p-3 rounded-xl 
                     bg-slate-800/50 border border-slate-700/50 
                     hover:border-ocean-500/50 hover:bg-slate-800 
                     transition-all duration-200 text-left"
              :class="{ 
                'ring-2 ring-ocean-500/50 border-ocean-500': vegaStore.selectedType === rec.type 
              }"
            >
              <!-- Mini Preview -->
              <div class="h-16 mb-2 rounded-lg overflow-hidden bg-slate-900/50 flex items-center justify-center">
                <VegaMiniPreview 
                  :chart-type="rec.type" 
                  :width="120" 
                  :height="60"
                  class="transform group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              
              <!-- Chart Name -->
              <div class="text-xs font-medium text-white mb-1 truncate">
                {{ rec.name }}
              </div>
              
              <!-- Match Score -->
              <div class="flex items-center gap-2 mb-1.5">
                <div class="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    class="h-full rounded-full bg-gradient-to-r transition-all duration-500"
                    :class="getScoreColor(rec.score)"
                    :style="{ width: `${rec.score}%` }"
                  />
                </div>
                <span class="text-[10px] font-medium" :class="getScoreTextColor(rec.score)">
                  {{ rec.score }}%
                </span>
              </div>
              
              <!-- Reason (truncated) -->
              <p class="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                {{ rec.reason }}
              </p>
            </button>
          </div>
          
          <!-- Help text -->
          <p class="text-[10px] text-slate-500 mt-2 text-center">
            Click a recommendation to select it, or browse all chart types below
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.recommendations-panel {
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.5) 0%,
    rgba(15, 23, 42, 0.8) 100%
  );
}

.recommendation-card {
  backdrop-filter: blur(4px);
}

.recommendation-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.3);
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

