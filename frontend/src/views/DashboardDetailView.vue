<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboard'
import VegaPreview from '@/components/builder/VegaPreview.vue'
import { 
  ArrowLeft, 
  Edit, 
  Download, 
  Trash2,
  Plus,
  Settings,
  RefreshCw
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const dashboardStore = useDashboardStore()

const isEditing = ref(false)
const editedName = ref('')
const editedDescription = ref('')

async function loadDashboard() {
  await dashboardStore.fetchDashboard(route.params.id)
  if (dashboardStore.currentDashboard) {
    editedName.value = dashboardStore.currentDashboard.name
    editedDescription.value = dashboardStore.currentDashboard.description
  }
}

async function saveEdits() {
  await dashboardStore.updateDashboard(route.params.id, {
    name: editedName.value,
    description: editedDescription.value
  })
  isEditing.value = false
}

async function deleteDashboard() {
  if (confirm('Are you sure you want to delete this dashboard?')) {
    await dashboardStore.deleteDashboard(route.params.id)
    router.push('/dashboards')
  }
}

async function exportToKibana() {
  try {
    const data = await dashboardStore.exportToKibana(route.params.id)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dashboard-${route.params.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Export failed:', error)
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <!-- Loading -->
    <div v-if="dashboardStore.loading.detail" class="flex items-center justify-center py-20">
      <RefreshCw class="w-8 h-8 text-ocean-400 animate-spin" />
    </div>

    <template v-else-if="dashboardStore.currentDashboard">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div class="flex items-start gap-4">
          <button 
            @click="router.push('/dashboards')"
            class="p-2 rounded-xl hover:bg-slate-800/60 transition-colors"
          >
            <ArrowLeft class="w-5 h-5 text-slate-400" />
          </button>
          
          <div v-if="!isEditing">
            <h1 class="text-2xl font-display font-semibold text-white">
              {{ dashboardStore.currentDashboard.name }}
            </h1>
            <p class="text-slate-400 mt-1">
              {{ dashboardStore.currentDashboard.description || 'No description' }}
            </p>
          </div>
          
          <div v-else class="space-y-3">
            <input
              v-model="editedName"
              type="text"
              class="form-input text-xl font-semibold"
              placeholder="Dashboard name"
            />
            <textarea
              v-model="editedDescription"
              class="form-input resize-none"
              rows="2"
              placeholder="Description"
            ></textarea>
            <div class="flex gap-2">
              <button @click="saveEdits" class="btn-primary text-sm py-2">Save</button>
              <button @click="isEditing = false" class="btn-secondary text-sm py-2">Cancel</button>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="isEditing = true"
            class="btn-secondary flex items-center gap-2"
            v-if="!isEditing"
          >
            <Edit class="w-4 h-4" />
            Edit
          </button>
          <button @click="exportToKibana" class="btn-secondary flex items-center gap-2">
            <Download class="w-4 h-4" />
            Export
          </button>
          <button @click="deleteDashboard" class="btn-secondary text-red-400 hover:text-red-300">
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Visualizations Grid -->
      <div 
        v-if="dashboardStore.currentDashboard.visualizations?.length > 0"
        class="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <div
          v-for="viz in dashboardStore.currentDashboard.visualizations"
          :key="viz.id"
          class="glass-card overflow-hidden"
        >
          <div class="flex items-center justify-between p-4 border-b border-slate-700/50">
            <h3 class="font-medium text-white">{{ viz.title || 'Untitled' }}</h3>
            <button class="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors">
              <Settings class="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div class="p-4">
            <VegaPreview :spec="viz.vegaSpec" :height="300" />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="glass-card p-12 text-center">
        <div class="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-4">
          <Plus class="w-8 h-8 text-slate-500" />
        </div>
        <h3 class="text-xl font-semibold text-white mb-2">No Visualizations</h3>
        <p class="text-slate-400 mb-6">
          Add your first visualization to this dashboard.
        </p>
        <RouterLink :to="`/builder/${route.params.id}`" class="btn-primary inline-flex items-center gap-2">
          <Plus class="w-5 h-5" />
          Add Visualization
        </RouterLink>
      </div>
    </template>

    <!-- Not Found -->
    <div v-else class="glass-card p-12 text-center">
      <h3 class="text-xl font-semibold text-white mb-2">Dashboard Not Found</h3>
      <p class="text-slate-400 mb-6">
        The dashboard you're looking for doesn't exist or has been deleted.
      </p>
      <RouterLink to="/dashboards" class="btn-primary">
        Back to Dashboards
      </RouterLink>
    </div>
  </div>
</template>

