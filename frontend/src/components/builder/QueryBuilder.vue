<script setup>
import { ref, computed, watch } from 'vue'
import { useElasticStore } from '@/stores/elastic'
import { Plus, Trash2, Filter, ChevronDown, Play } from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue', 'execute'])

const elasticStore = useElasticStore()

const filters = ref([])
const aggregationType = ref('none')
const groupByField = ref('')
const metricField = ref('')
const metricOperation = ref('avg')

const aggregatableFields = computed(() => 
  elasticStore.fields.filter(f => f.aggregatable)
)

const numericFields = computed(() => 
  elasticStore.fields.filter(f => 
    ['long', 'integer', 'short', 'byte', 'double', 'float'].includes(f.type)
  )
)

function addFilter() {
  filters.value.push({
    id: Date.now(),
    field: '',
    operator: 'equals',
    value: ''
  })
}

function removeFilter(id) {
  filters.value = filters.value.filter(f => f.id !== id)
}

function buildQuery() {
  const query = {
    bool: {
      must: []
    }
  }
  
  for (const filter of filters.value) {
    if (!filter.field || !filter.value) continue
    
    switch (filter.operator) {
      case 'equals':
        query.bool.must.push({ term: { [filter.field]: filter.value } })
        break
      case 'contains':
        query.bool.must.push({ match: { [filter.field]: filter.value } })
        break
      case 'gt':
        query.bool.must.push({ range: { [filter.field]: { gt: filter.value } } })
        break
      case 'gte':
        query.bool.must.push({ range: { [filter.field]: { gte: filter.value } } })
        break
      case 'lt':
        query.bool.must.push({ range: { [filter.field]: { lt: filter.value } } })
        break
      case 'lte':
        query.bool.must.push({ range: { [filter.field]: { lte: filter.value } } })
        break
    }
  }
  
  const result = {
    query: query.bool.must.length > 0 ? query : { match_all: {} }
  }
  
  // Add aggregations if configured
  if (aggregationType.value !== 'none' && groupByField.value) {
    result.aggs = {
      grouped: {
        terms: {
          field: groupByField.value,
          size: 100
        }
      }
    }
    
    if (metricField.value && metricOperation.value) {
      result.aggs.grouped.aggs = {
        metric: {
          [metricOperation.value]: { field: metricField.value }
        }
      }
    }
  }
  
  return result
}

function executeQuery() {
  const query = buildQuery()
  emit('update:modelValue', query)
  emit('execute', query)
}

watch([filters, aggregationType, groupByField, metricField, metricOperation], () => {
  emit('update:modelValue', buildQuery())
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <!-- Filters Section -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <Filter class="w-4 h-4 text-ocean-400" />
          <span class="font-medium text-white">Filters</span>
        </div>
        <button
          @click="addFilter"
          class="flex items-center gap-1 text-sm text-ocean-400 hover:text-ocean-300"
        >
          <Plus class="w-4 h-4" />
          Add Filter
        </button>
      </div>
      
      <div v-if="filters.length === 0" class="p-4 bg-slate-800/40 rounded-xl text-center text-sm text-slate-400">
        No filters applied. Click "Add Filter" to narrow down your data.
      </div>
      
      <div v-else class="space-y-3">
        <div
          v-for="filter in filters"
          :key="filter.id"
          class="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl"
        >
          <!-- Field -->
          <select v-model="filter.field" class="form-select flex-1 py-2 text-sm">
            <option value="">Select field...</option>
            <option v-for="field in elasticStore.fields" :key="field.name" :value="field.name">
              {{ field.name }}
            </option>
          </select>
          
          <!-- Operator -->
          <select v-model="filter.operator" class="form-select w-32 py-2 text-sm">
            <option value="equals">equals</option>
            <option value="contains">contains</option>
            <option value="gt">&gt;</option>
            <option value="gte">&gt;=</option>
            <option value="lt">&lt;</option>
            <option value="lte">&lt;=</option>
          </select>
          
          <!-- Value -->
          <input
            v-model="filter.value"
            type="text"
            placeholder="Value"
            class="form-input flex-1 py-2 text-sm"
          />
          
          <!-- Remove -->
          <button
            @click="removeFilter(filter.id)"
            class="p-2 text-slate-400 hover:text-red-400 transition-colors"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Aggregation Section -->
    <div>
      <div class="flex items-center gap-2 mb-3">
        <ChevronDown class="w-4 h-4 text-coral-400" />
        <span class="font-medium text-white">Aggregation</span>
      </div>
      
      <div class="space-y-3">
        <div>
          <label class="form-label text-xs">Type</label>
          <select v-model="aggregationType" class="form-select py-2 text-sm">
            <option value="none">None</option>
            <option value="terms">Group by field</option>
          </select>
        </div>
        
        <template v-if="aggregationType === 'terms'">
          <div>
            <label class="form-label text-xs">Group By</label>
            <select v-model="groupByField" class="form-select py-2 text-sm">
              <option value="">Select field...</option>
              <option v-for="field in aggregatableFields" :key="field.name" :value="field.keywordField || field.name">
                {{ field.name }}
              </option>
            </select>
          </div>
          
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label text-xs">Metric Field</label>
              <select v-model="metricField" class="form-select py-2 text-sm">
                <option value="">None</option>
                <option v-for="field in numericFields" :key="field.name" :value="field.name">
                  {{ field.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="form-label text-xs">Operation</label>
              <select v-model="metricOperation" class="form-select py-2 text-sm">
                <option value="avg">Average</option>
                <option value="sum">Sum</option>
                <option value="min">Min</option>
                <option value="max">Max</option>
                <option value="value_count">Count</option>
              </select>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Execute Button -->
    <button
      @click="executeQuery"
      class="btn-primary w-full flex items-center justify-center gap-2"
    >
      <Play class="w-4 h-4" />
      Execute Query
    </button>
  </div>
</template>

