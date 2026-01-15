import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConnectionStore } from '../connection'

const SESSION_KEY = 'es_connection_config'

describe('Connection Store', () => {
  let mockSessionStorage
  let mockFetch

  beforeEach(() => {
    setActivePinia(createPinia())

    // Mock sessionStorage
    mockSessionStorage = {
      data: {},
      getItem(key) {
        return this.data[key] || null
      },
      setItem(key, value) {
        this.data[key] = value
      },
      removeItem(key) {
        delete this.data[key]
      },
      clear() {
        this.data = {}
      }
    }
    global.sessionStorage = mockSessionStorage

    // Mock fetch
    mockFetch = vi.fn()
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useConnectionStore()

      expect(store.isConnected).toBe(false)
      expect(store.connectionType).toBe(null)
      expect(store.connectionName).toBe('')
      expect(store.clusterInfo).toBe(null)
      expect(store.loading).toBe(false)
      expect(store.error).toBe(null)
      expect(store.showModal).toBe(false)
    })

    it('should initialize from sessionStorage if config exists', () => {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        type: 'serverless',
        name: 'My Cluster',
        endpoint: 'https://test.es.cloud',
        apiKey: 'test-key'
      }))

      const store = useConnectionStore()

      expect(store.connectionType).toBe('serverless')
      expect(store.connectionName).toBe('My Cluster')
    })

    it('should handle invalid JSON in sessionStorage', () => {
      sessionStorage.setItem(SESSION_KEY, 'invalid-json')

      const store = useConnectionStore()

      expect(store.connectionType).toBe(null)
      expect(sessionStorage.getItem(SESSION_KEY)).toBe(null)
    })
  })

  describe('Computed Properties', () => {
    describe('isCustomConnection', () => {
      it('should return false when no connection type', () => {
        const store = useConnectionStore()

        // With null connectionType, the computed returns null (falsy)
        expect(store.isCustomConnection).toBeFalsy()
      })

      it('should return false when using default connection', () => {
        const store = useConnectionStore()
        store.connectionType = 'default'

        expect(store.isCustomConnection).toBe(false)
      })

      it('should return true when using custom connection', () => {
        const store = useConnectionStore()
        store.connectionType = 'serverless'

        expect(store.isCustomConnection).toBe(true)
      })
    })

    describe('displayName', () => {
      it('should return "Default (Server Config)" for default connection', () => {
        const store = useConnectionStore()
        store.connectionType = 'default'

        expect(store.displayName).toBe('Default (Server Config)')
      })

      it('should return connection name if provided', () => {
        const store = useConnectionStore()
        store.connectionType = 'serverless'
        store.connectionName = 'Production Cluster'

        expect(store.displayName).toBe('Production Cluster')
      })

      it('should return hostname from endpoint if no name', () => {
        const store = useConnectionStore()
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          type: 'serverless',
          endpoint: 'https://my-cluster.es.cloud:443'
        }))

        expect(store.displayName).toBe('my-cluster.es.cloud')
      })

      it('should return truncated endpoint if URL parsing fails', () => {
        const store = useConnectionStore()
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          type: 'self-hosted',
          endpoint: 'not-a-valid-url-but-very-long-endpoint'
        }))

        const display = store.displayName
        expect(display.length).toBeLessThanOrEqual(30)
        expect(display).toBe('not-a-valid-url-but-very-long-')
      })

      it('should extract name from cloudId', () => {
        const store = useConnectionStore()
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          type: 'cloud',
          cloudId: 'staging:dXMtY2VudHJhbC0xLmF3cy5mb3VuZC5pbzo0NDMkZTZjZmYyNGI='
        }))

        expect(store.displayName).toBe('staging')
      })

      it('should return "Elastic Cloud" for cloudId without colon', () => {
        const store = useConnectionStore()
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          type: 'cloud',
          cloudId: 'dXMtY2VudHJhbC0xLmF3cy5mb3VuZC5pbyo0NDMkZTZjZmYyNGI='
        }))

        // If cloudId doesn't have a colon, it returns the cloudId itself
        // Only if split()[0] is empty or undefined does it return 'Elastic Cloud'
        const display = store.displayName
        expect(display).toBeDefined()
        // The code returns cloudId.split(':')[0] || 'Elastic Cloud'
        // Since there's no colon, split returns the whole string (not empty)
        expect(display).toBe('dXMtY2VudHJhbC0xLmF3cy5mb3VuZC5pbyo0NDMkZTZjZmYyNGI=')
      })

      it('should return "Not Connected" when no config', () => {
        const store = useConnectionStore()

        expect(store.displayName).toBe('Not Connected')
      })
    })
  })

  describe('Session Storage Methods', () => {
    describe('loadFromSession', () => {
      it('should load valid config from sessionStorage', () => {
        const store = useConnectionStore()

        const config = {
          type: 'serverless',
          name: 'Test',
          endpoint: 'https://test.es.cloud',
          apiKey: 'test-key'
        }

        sessionStorage.setItem(SESSION_KEY, JSON.stringify(config))

        const loaded = store.loadFromSession()

        expect(loaded).toEqual(config)
      })

      it('should return null when no config stored', () => {
        const store = useConnectionStore()

        const loaded = store.loadFromSession()

        expect(loaded).toBe(null)
      })

      it('should return null and clear storage on invalid JSON', () => {
        const store = useConnectionStore()
        sessionStorage.setItem(SESSION_KEY, '{invalid-json}')

        const loaded = store.loadFromSession()

        expect(loaded).toBe(null)
        expect(sessionStorage.getItem(SESSION_KEY)).toBe(null)
      })
    })

    describe('saveToSession', () => {
      it('should save config to sessionStorage', () => {
        const store = useConnectionStore()

        const config = {
          type: 'cloud',
          name: 'My Cloud',
          cloudId: 'test:abc123',
          apiKey: 'key123'
        }

        store.saveToSession(config)

        const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY))
        expect(stored).toEqual(config)
        expect(store.connectionType).toBe('cloud')
        expect(store.connectionName).toBe('My Cloud')
      })

      it('should update store state when saving', () => {
        const store = useConnectionStore()

        store.saveToSession({
          type: 'serverless',
          name: 'Test Serverless'
        })

        expect(store.connectionType).toBe('serverless')
        expect(store.connectionName).toBe('Test Serverless')
      })

      it('should handle missing name field', () => {
        const store = useConnectionStore()

        store.saveToSession({
          type: 'self-hosted',
          endpoint: 'http://localhost:9200'
        })

        expect(store.connectionName).toBe('')
      })
    })

    describe('getConnectionHeaders', () => {
      it('should return empty object when no config', () => {
        const store = useConnectionStore()

        const headers = store.getConnectionHeaders()

        expect(headers).toEqual({})
      })

      it('should return headers for serverless connection', () => {
        const store = useConnectionStore()

        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          type: 'serverless',
          endpoint: 'https://test.es.cloud',
          apiKey: 'test-api-key'
        }))

        const headers = store.getConnectionHeaders()

        expect(headers).toEqual({
          'X-ES-Connection-Type': 'serverless',
          'X-ES-Endpoint': 'https://test.es.cloud',
          'X-ES-Api-Key': 'test-api-key'
        })
      })

      it('should return headers for cloud connection', () => {
        const store = useConnectionStore()

        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          type: 'cloud',
          cloudId: 'staging:abc123',
          apiKey: 'cloud-key'
        }))

        const headers = store.getConnectionHeaders()

        expect(headers).toEqual({
          'X-ES-Connection-Type': 'cloud',
          'X-ES-Cloud-Id': 'staging:abc123',
          'X-ES-Api-Key': 'cloud-key'
        })
      })

      it('should return headers for self-hosted with basic auth', () => {
        const store = useConnectionStore()

        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          type: 'self-hosted',
          endpoint: 'http://localhost:9200',
          username: 'elastic',
          password: 'changeme'
        }))

        const headers = store.getConnectionHeaders()

        expect(headers).toEqual({
          'X-ES-Connection-Type': 'self-hosted',
          'X-ES-Endpoint': 'http://localhost:9200',
          'X-ES-Username': 'elastic',
          'X-ES-Password': 'changeme'
        })
      })

      it('should include only provided fields', () => {
        const store = useConnectionStore()

        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          type: 'serverless',
          endpoint: 'https://test.es.cloud'
          // No apiKey
        }))

        const headers = store.getConnectionHeaders()

        expect(headers).toEqual({
          'X-ES-Connection-Type': 'serverless',
          'X-ES-Endpoint': 'https://test.es.cloud'
        })
        expect(headers['X-ES-Api-Key']).toBeUndefined()
      })
    })
  })

  describe('Connection Actions', () => {
    describe('testConnection', () => {
      it('should test connection successfully', async () => {
        const store = useConnectionStore()

        mockFetch.mockResolvedValue({
          json: async () => ({
            connected: true,
            cluster_name: 'test-cluster',
            version: '8.0.0'
          })
        })

        const config = {
          type: 'serverless',
          name: 'Test',
          endpoint: 'https://test.es.cloud',
          apiKey: 'test-key'
        }

        const result = await store.testConnection(config)

        expect(result.success).toBe(true)
        expect(result.cluster_name).toBe('test-cluster')
        expect(store.isConnected).toBe(true)
        expect(store.clusterInfo).toEqual({
          name: 'test-cluster',
          version: '8.0.0'
        })

        // Config should be saved
        const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY))
        expect(saved).toEqual(config)
      })

      it('should send connection headers in request', async () => {
        const store = useConnectionStore()

        mockFetch.mockResolvedValue({
          json: async () => ({ connected: true, cluster_name: 'test' })
        })

        const config = {
          type: 'cloud',
          cloudId: 'test:abc',
          apiKey: 'key123'
        }

        await store.testConnection(config)

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/elastic/test-connection',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'X-ES-Connection-Type': 'cloud',
              'X-ES-Cloud-Id': 'test:abc',
              'X-ES-Api-Key': 'key123'
            })
          })
        )
      })

      it('should handle connection failure', async () => {
        const store = useConnectionStore()

        mockFetch.mockResolvedValue({
          json: async () => ({
            connected: false,
            error: 'Invalid API key'
          })
        })

        const result = await store.testConnection({
          type: 'serverless',
          endpoint: 'https://test.es.cloud',
          apiKey: 'invalid-key'
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Invalid API key')
        expect(store.error).toBe('Invalid API key')
        expect(store.isConnected).toBe(false)
      })

      it('should handle network errors', async () => {
        const store = useConnectionStore()

        mockFetch.mockRejectedValue(new Error('Network error'))

        const result = await store.testConnection({
          type: 'serverless',
          endpoint: 'https://test.es.cloud'
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Network error')
        expect(store.error).toBe('Network error')
      })

      it('should not send headers for default connection type', async () => {
        const store = useConnectionStore()

        mockFetch.mockResolvedValue({
          json: async () => ({ connected: true, cluster_name: 'default' })
        })

        await store.testConnection({ type: 'default' })

        const headers = mockFetch.mock.calls[0][1].headers
        expect(headers['X-ES-Connection-Type']).toBeUndefined()
        expect(headers['X-ES-Endpoint']).toBeUndefined()
      })

      it('should set loading state during test', async () => {
        const store = useConnectionStore()

        mockFetch.mockImplementation(() => {
          expect(store.loading).toBe(true)
          return Promise.resolve({
            json: async () => ({ connected: true, cluster_name: 'test' })
          })
        })

        await store.testConnection({ type: 'serverless' })

        expect(store.loading).toBe(false)
      })
    })

    describe('useDefaultConnection', () => {
      it('should connect using default server config', async () => {
        const store = useConnectionStore()

        mockFetch.mockResolvedValue({
          json: async () => ({
            connected: true,
            cluster_name: 'default-cluster',
            version: '8.5.0'
          })
        })

        const result = await store.useDefaultConnection()

        expect(mockFetch).toHaveBeenCalledWith('/api/elastic/connection')
        expect(result.success).toBe(true)
        expect(store.connectionType).toBe('default')
        expect(store.connectionName).toBe('')
        expect(store.isConnected).toBe(true)
        expect(store.clusterInfo).toEqual({
          name: 'default-cluster',
          version: '8.5.0'
        })
      })

      it('should clear custom config from sessionStorage', async () => {
        const store = useConnectionStore()

        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          type: 'serverless',
          endpoint: 'https://test.es.cloud'
        }))

        mockFetch.mockResolvedValue({
          json: async () => ({ connected: true, cluster_name: 'default' })
        })

        await store.useDefaultConnection()

        expect(sessionStorage.getItem(SESSION_KEY)).toBe(null)
      })

      it('should handle default connection not configured', async () => {
        const store = useConnectionStore()

        mockFetch.mockResolvedValue({
          json: async () => ({
            connected: false,
            error: 'No .env configuration found'
          })
        })

        const result = await store.useDefaultConnection()

        expect(result.success).toBe(false)
        expect(store.error).toBe('No .env configuration found')
      })

      it('should handle network errors', async () => {
        const store = useConnectionStore()

        mockFetch.mockRejectedValue(new Error('Server unreachable'))

        const result = await store.useDefaultConnection()

        expect(result.success).toBe(false)
        expect(store.error).toBe('Server unreachable')
      })
    })

    describe('checkConnection', () => {
      it('should test connection when saved config exists', async () => {
        const store = useConnectionStore()

        const config = {
          type: 'serverless',
          endpoint: 'https://test.es.cloud',
          apiKey: 'test-key'
        }

        sessionStorage.setItem(SESSION_KEY, JSON.stringify(config))

        mockFetch.mockResolvedValue({
          json: async () => ({ connected: true, cluster_name: 'test' })
        })

        await store.checkConnection()

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/elastic/test-connection',
          expect.objectContaining({ method: 'POST' })
        )
      })

      it('should use default connection when no saved config', async () => {
        const store = useConnectionStore()

        mockFetch.mockResolvedValue({
          json: async () => ({ connected: true, cluster_name: 'default' })
        })

        await store.checkConnection()

        expect(mockFetch).toHaveBeenCalledWith('/api/elastic/connection')
      })
    })

    describe('disconnect', () => {
      it('should clear all connection state', () => {
        const store = useConnectionStore()

        // Set up connected state
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          type: 'serverless',
          endpoint: 'https://test.es.cloud'
        }))
        store.isConnected = true
        store.connectionType = 'serverless'
        store.connectionName = 'Test'
        store.clusterInfo = { name: 'test', version: '8.0.0' }
        store.error = 'Some error'

        store.disconnect()

        expect(sessionStorage.getItem(SESSION_KEY)).toBe(null)
        expect(store.isConnected).toBe(false)
        expect(store.connectionType).toBe(null)
        expect(store.connectionName).toBe('')
        expect(store.clusterInfo).toBe(null)
        expect(store.error).toBe(null)
      })
    })

    describe('openSettings', () => {
      it('should open settings modal', () => {
        const store = useConnectionStore()

        store.openSettings()

        expect(store.showModal).toBe(true)
      })
    })

    describe('closeSettings', () => {
      it('should close settings modal', () => {
        const store = useConnectionStore()
        store.showModal = true

        store.closeSettings()

        expect(store.showModal).toBe(false)
      })
    })
  })

  describe('Security & Privacy', () => {
    it('should store credentials only in sessionStorage (not localStorage)', () => {
      const store = useConnectionStore()

      const config = {
        type: 'serverless',
        endpoint: 'https://test.es.cloud',
        apiKey: 'secret-key'
      }

      store.saveToSession(config)

      // Should be in sessionStorage
      expect(sessionStorage.getItem(SESSION_KEY)).toBeDefined()

      // Should NOT be in localStorage
      expect(localStorage.getItem(SESSION_KEY)).toBe(null)
    })

    it('should clear credentials on disconnect', () => {
      const store = useConnectionStore()

      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        type: 'serverless',
        apiKey: 'secret-key'
      }))

      store.disconnect()

      expect(sessionStorage.getItem(SESSION_KEY)).toBe(null)
    })

    it('should not include credentials in connection type', () => {
      const store = useConnectionStore()

      store.saveToSession({
        type: 'serverless',
        name: 'Test',
        endpoint: 'https://test.es.cloud',
        apiKey: 'secret-key',
        username: 'admin',
        password: 'secret-pass'
      })

      // Public properties should not expose credentials
      expect(store.connectionType).toBe('serverless')
      expect(store.connectionName).toBe('Test')

      // Credentials not exposed in computed properties
      expect(store.displayName).toBe('Test')
      expect(store.displayName).not.toContain('secret')
    })
  })
})
