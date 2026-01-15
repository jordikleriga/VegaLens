/**
 * Connection Store
 * 
 * Manages user-provided Elasticsearch connection settings.
 * 
 * SECURITY NOTES:
 * - Credentials are stored in sessionStorage only (cleared on browser close)
 * - Credentials are never persisted to localStorage or server
 * - All communication uses HTTPS encryption
 * - API keys are sent in headers, never in URLs
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const SESSION_KEY = 'es_connection_config'

export const useConnectionStore = defineStore('connection', () => {
  // State
  const isConnected = ref(false)
  const connectionType = ref(null) // 'serverless' | 'cloud' | 'self-hosted' | 'default'
  const connectionName = ref('')
  const clusterInfo = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const showModal = ref(false)

  // Check if using custom connection (vs env fallback)
  const isCustomConnection = computed(() => 
    connectionType.value && connectionType.value !== 'default'
  )

  // Get display name for connection
  const displayName = computed(() => {
    if (connectionType.value === 'default') {
      return 'Default (Server Config)'
    }
    if (connectionName.value) {
      return connectionName.value
    }
    const config = loadFromSession()
    if (config?.endpoint) {
      try {
        const url = new URL(config.endpoint)
        return url.hostname
      } catch {
        return config.endpoint.slice(0, 30)
      }
    }
    if (config?.cloudId) {
      return config.cloudId.split(':')[0] || 'Elastic Cloud'
    }
    return 'Not Connected'
  })

  /**
   * Load connection config from sessionStorage
   * Returns null if no config stored
   */
  function loadFromSession() {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (!stored) return null
      return JSON.parse(stored)
    } catch (e) {
      console.error('[Connection] Failed to load from session:', e)
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
  }

  /**
   * Save connection config to sessionStorage
   * API key is stored here but cleared on browser close
   */
  function saveToSession(config) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(config))
      connectionType.value = config.type
      connectionName.value = config.name || ''
    } catch (e) {
      console.error('[Connection] Failed to save to session:', e)
    }
  }

  /**
   * Get headers to send with API requests
   * These headers tell the backend which ES instance to connect to
   */
  function getConnectionHeaders() {
    const config = loadFromSession()
    
    // No custom config - use server's .env configuration
    if (!config) {
      return {}
    }

    const headers = {
      'X-ES-Connection-Type': config.type
    }

    if (config.endpoint) {
      headers['X-ES-Endpoint'] = config.endpoint
    }
    if (config.apiKey) {
      headers['X-ES-Api-Key'] = config.apiKey
    }
    if (config.cloudId) {
      headers['X-ES-Cloud-Id'] = config.cloudId
    }
    if (config.username) {
      headers['X-ES-Username'] = config.username
    }
    if (config.password) {
      headers['X-ES-Password'] = config.password
    }

    return headers
  }

  /**
   * Test a connection configuration
   */
  async function testConnection(config) {
    loading.value = true
    error.value = null

    try {
      const headers = {
        'Content-Type': 'application/json'
      }

      // Add connection headers based on config
      if (config.type !== 'default') {
        headers['X-ES-Connection-Type'] = config.type
        if (config.endpoint) headers['X-ES-Endpoint'] = config.endpoint
        if (config.apiKey) headers['X-ES-Api-Key'] = config.apiKey
        if (config.cloudId) headers['X-ES-Cloud-Id'] = config.cloudId
        if (config.username) headers['X-ES-Username'] = config.username
        if (config.password) headers['X-ES-Password'] = config.password
      }

      const response = await fetch('/api/elastic/test-connection', {
        method: 'POST',
        headers
      })

      const result = await response.json()

      if (result.connected) {
        // Save successful connection
        saveToSession(config)
        isConnected.value = true
        clusterInfo.value = {
          name: result.cluster_name,
          version: result.version
        }
        return { success: true, ...result }
      } else {
        error.value = result.error || 'Connection failed'
        return { success: false, error: result.error }
      }
    } catch (e) {
      error.value = e.message || 'Failed to test connection'
      return { success: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Use default server configuration (from .env)
   */
  async function useDefaultConnection() {
    loading.value = true
    error.value = null

    try {
      const response = await fetch('/api/elastic/connection')
      const result = await response.json()

      if (result.connected) {
        // Clear any custom config
        sessionStorage.removeItem(SESSION_KEY)
        connectionType.value = 'default'
        connectionName.value = ''
        isConnected.value = true
        clusterInfo.value = {
          name: result.cluster_name,
          version: result.version
        }
        return { success: true, ...result }
      } else {
        error.value = result.error || 'Default connection not configured'
        return { success: false, error: result.error }
      }
    } catch (e) {
      error.value = e.message
      return { success: false, error: e.message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Check current connection status
   */
  async function checkConnection() {
    const config = loadFromSession()
    
    if (config) {
      // We have saved credentials - test them
      return testConnection(config)
    } else {
      // Check if default server connection works
      return useDefaultConnection()
    }
  }

  /**
   * Disconnect and clear credentials
   */
  function disconnect() {
    sessionStorage.removeItem(SESSION_KEY)
    isConnected.value = false
    connectionType.value = null
    connectionName.value = ''
    clusterInfo.value = null
    error.value = null
  }

  /**
   * Open connection settings modal
   */
  function openSettings() {
    showModal.value = true
  }

  /**
   * Close connection settings modal
   */
  function closeSettings() {
    showModal.value = false
  }

  /**
   * Initialize on store creation
   */
  function init() {
    const config = loadFromSession()
    if (config) {
      connectionType.value = config.type
      connectionName.value = config.name || ''
    }
  }

  // Initialize
  init()

  return {
    // State
    isConnected,
    connectionType,
    connectionName,
    clusterInfo,
    loading,
    error,
    showModal,

    // Computed
    isCustomConnection,
    displayName,

    // Methods
    loadFromSession,
    saveToSession,
    getConnectionHeaders,
    testConnection,
    useDefaultConnection,
    checkConnection,
    disconnect,
    openSettings,
    closeSettings
  }
})

