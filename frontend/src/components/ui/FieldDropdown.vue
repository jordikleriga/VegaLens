<script setup>
import { ref, computed, watch } from 'vue'
import { useElasticStore } from '@/stores/elastic'
import { ChevronDown, Search, Check, Database, Hash, Calendar, Type, ToggleLeft } from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: 'Select Field'
  },
  placeholder: {
    type: String,
    default: 'Choose a field...'
  },
  fieldTypes: {
    type: Array,
    default: () => []
  },
  required: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const elasticStore = useElasticStore()

const isOpen = ref(false)
const searchQuery = ref('')

const typeIcons = {
  keyword: Type,
  text: Type,
  long: Hash,
  integer: Hash,
  short: Hash,
  byte: Hash,
  double: Hash,
  float: Hash,
  date: Calendar,
  boolean: ToggleLeft,
  object: Database
}

const typeColors = {
  keyword: 'text-ocean-400 bg-ocean-500/20',
  text: 'text-emerald-400 bg-emerald-500/20',
  long: 'text-purple-400 bg-purple-500/20',
  integer: 'text-purple-400 bg-purple-500/20',
  double: 'text-purple-400 bg-purple-500/20',
  float: 'text-purple-400 bg-purple-500/20',
  date: 'text-coral-400 bg-coral-500/20',
  boolean: 'text-amber-400 bg-amber-500/20',
  object: 'text-slate-400 bg-slate-500/20'
}

const filteredFields = computed(() => {
  let fields = elasticStore.fields
  
  // Filter by allowed types
  if (props.fieldTypes.length > 0) {
    const typeMap = {
      number: ['long', 'integer', 'short', 'byte', 'double', 'float', 'half_float', 'scaled_float'],
      text: ['text', 'keyword'],
      date: ['date', 'date_nanos']
    }
    
    fields = fields.filter(f => {
      if (props.fieldTypes.includes(f.type)) return true
      
      for (const [category, types] of Object.entries(typeMap)) {
        if (props.fieldTypes.includes(category) && types.includes(f.type)) {
          return true
        }
      }
      return false
    })
  }
  
  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    fields = fields.filter(f => f.name.toLowerCase().includes(query))
  }
  
  return fields
})

const selectedField = computed(() => {
  if (!props.modelValue) return null
  return elasticStore.fields.find(f => 
    f.name === props.modelValue || f.keywordField === props.modelValue
  )
})

function selectField(field) {
  const value = field.keywordField || field.name
  emit('update:modelValue', value)
  isOpen.value = false
  searchQuery.value = ''
}

function clearSelection() {
  emit('update:modelValue', '')
}

// Close dropdown when clicking outside
function handleClickOutside(event) {
  if (!event.target.closest('.field-dropdown')) {
    isOpen.value = false
  }
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('click', handleClickOutside)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})
</script>

<template>
  <div class="field-dropdown relative">
    <label v-if="label" class="form-label flex items-center gap-2">
      {{ label }}
      <span v-if="required" class="text-coral-400">*</span>
    </label>
    
    <button
      type="button"
      @click="isOpen = !isOpen"
      :disabled="disabled"
      class="w-full flex items-center justify-between form-select text-left"
      :class="{ 
        'border-ocean-500 ring-2 ring-ocean-500/20': isOpen,
        'opacity-50 cursor-not-allowed': disabled
      }"
    >
      <div v-if="selectedField" class="flex items-center gap-2">
        <span 
          class="w-6 h-6 rounded flex items-center justify-center"
          :class="typeColors[selectedField.type] || 'text-slate-400 bg-slate-500/20'"
        >
          <component 
            :is="typeIcons[selectedField.type] || Database" 
            class="w-3.5 h-3.5" 
          />
        </span>
        <span class="text-white truncate">{{ selectedField.name }}</span>
        <span class="text-xs text-slate-500">({{ selectedField.type }})</span>
      </div>
      <span v-else class="text-slate-400">{{ placeholder }}</span>
      
      <div class="flex items-center gap-2">
        <button
          v-if="modelValue && !required"
          @click.stop="clearSelection"
          class="p-1 rounded hover:bg-slate-700/50"
        >
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <ChevronDown 
          class="w-5 h-5 text-slate-400 transition-transform duration-200" 
          :class="{ 'rotate-180': isOpen }"
        />
      </div>
    </button>

    <!-- Dropdown -->
    <Transition name="dropdown">
      <div 
        v-if="isOpen" 
        class="absolute z-50 w-full mt-2 py-2 bg-slate-800 border border-slate-600/50 rounded-xl shadow-xl max-h-80 overflow-hidden"
      >
        <!-- Search -->
        <div class="px-3 pb-2">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search fields..."
              class="w-full pl-9 pr-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-ocean-500"
              @click.stop
            />
          </div>
        </div>

        <!-- Field List -->
        <div class="overflow-y-auto max-h-60">
          <template v-if="filteredFields.length > 0">
            <button
              v-for="field in filteredFields"
              :key="field.name"
              @click="selectField(field)"
              class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-ocean-500/20 transition-colors"
            >
              <span 
                class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                :class="typeColors[field.type] || 'text-slate-400 bg-slate-500/20'"
              >
                <component 
                  :is="typeIcons[field.type] || Database" 
                  class="w-4 h-4" 
                />
              </span>
              <div class="flex-1 text-left min-w-0">
                <p class="text-sm font-medium text-white truncate">{{ field.name }}</p>
                <p class="text-xs text-slate-500">{{ field.type }}</p>
              </div>
              <Check 
                v-if="modelValue === field.name || modelValue === field.keywordField" 
                class="w-4 h-4 text-ocean-400 flex-shrink-0" 
              />
            </button>
          </template>
          
          <div v-else class="px-4 py-6 text-center text-slate-400 text-sm">
            No matching fields
          </div>
        </div>
      </div>
    </Transition>
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
</style>

