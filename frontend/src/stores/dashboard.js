import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'

export const useDashboardStore = defineStore('dashboard', () => {
  // State
  const dashboards = ref([])
  const currentDashboard = ref(null)
  const loading = ref({
    list: false,
    detail: false,
    save: false
  })
  const error = ref(null)

  // Actions
  async function fetchDashboards() {
    loading.value.list = true
    error.value = null
    try {
      const response = await api.get('/dashboards')
      dashboards.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.list = false
    }
  }

  async function fetchDashboard(id) {
    loading.value.detail = true
    error.value = null
    try {
      const response = await api.get(`/dashboards/${id}`)
      currentDashboard.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.detail = false
    }
  }

  async function createDashboard(data) {
    loading.value.save = true
    error.value = null
    try {
      const response = await api.post('/dashboards', data)
      dashboards.value.push(response.data)
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.save = false
    }
  }

  async function updateDashboard(id, data) {
    loading.value.save = true
    error.value = null
    try {
      const response = await api.put(`/dashboards/${id}`, data)
      const index = dashboards.value.findIndex(d => d.id === id)
      if (index !== -1) {
        dashboards.value[index] = response.data
      }
      if (currentDashboard.value?.id === id) {
        currentDashboard.value = response.data
      }
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.save = false
    }
  }

  async function deleteDashboard(id) {
    loading.value.save = true
    error.value = null
    try {
      await api.delete(`/dashboards/${id}`)
      dashboards.value = dashboards.value.filter(d => d.id !== id)
      if (currentDashboard.value?.id === id) {
        currentDashboard.value = null
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.save = false
    }
  }

  async function addVisualization(dashboardId, visualization) {
    loading.value.save = true
    error.value = null
    try {
      const response = await api.post(`/dashboards/${dashboardId}/visualizations`, visualization)
      if (currentDashboard.value?.id === dashboardId) {
        currentDashboard.value.visualizations.push(response.data)
      }
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.save = false
    }
  }

  async function updateVisualization(dashboardId, vizId, data) {
    loading.value.save = true
    error.value = null
    try {
      const response = await api.put(`/dashboards/${dashboardId}/visualizations/${vizId}`, data)
      if (currentDashboard.value?.id === dashboardId) {
        const index = currentDashboard.value.visualizations.findIndex(v => v.id === vizId)
        if (index !== -1) {
          currentDashboard.value.visualizations[index] = response.data
        }
      }
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.save = false
    }
  }

  async function removeVisualization(dashboardId, vizId) {
    loading.value.save = true
    error.value = null
    try {
      await api.delete(`/dashboards/${dashboardId}/visualizations/${vizId}`)
      if (currentDashboard.value?.id === dashboardId) {
        currentDashboard.value.visualizations = 
          currentDashboard.value.visualizations.filter(v => v.id !== vizId)
      }
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    } finally {
      loading.value.save = false
    }
  }

  async function exportToKibana(id) {
    try {
      const response = await api.get(`/dashboards/${id}/export/kibana`)
      return response.data
    } catch (err) {
      error.value = err.response?.data?.message || err.message
      throw err
    }
  }

  function setCurrentDashboard(dashboard) {
    currentDashboard.value = dashboard
  }

  function reset() {
    currentDashboard.value = null
    error.value = null
  }

  return {
    // State
    dashboards,
    currentDashboard,
    loading,
    error,
    
    // Actions
    fetchDashboards,
    fetchDashboard,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    addVisualization,
    updateVisualization,
    removeVisualization,
    exportToKibana,
    setCurrentDashboard,
    reset
  }
})

