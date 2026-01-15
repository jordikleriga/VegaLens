<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useConnectionStore } from '@/stores/connection'
import { 
  X, 
  Shield, 
  Server, 
  Cloud, 
  Database, 
  Check, 
  AlertCircle, 
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Info,
  Key,
  ExternalLink
} from 'lucide-vue-next'

const connectionStore = useConnectionStore()

const connectionTypes = [
  {
    id: 'default',
    name: 'Development',
    icon: Server,
    description: 'Use server-configured connection'
  },
  { 
    id: 'serverless', 
    name: 'Serverless', 
    icon: Cloud,
    description: 'Elasticsearch Serverless'
  },
  { 
    id: 'cloud', 
    name: 'Elastic Cloud', 
    icon: Cloud,
    description: 'Standard Elastic Cloud deployment'
  },
  { 
    id: 'self-hosted', 
    name: 'Self-Hosted', 
    icon: Database,
    description: 'On-premise or self-managed'
  }
]

// Form state
const selectedType = ref('default')
const connectionName = ref('')
const endpoint = ref('')
const cloudId = ref('')
const apiKey = ref('')
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const testResult = ref(null)

// Load existing config on mount
onMounted(() => {
  const config = connectionStore.loadFromSession()
  if (config) {
    selectedType.value = config.type || 'default'
    connectionName.value = config.name || ''
    endpoint.value = config.endpoint || ''
    cloudId.value = config.cloudId || ''
    // Note: We don't reload apiKey/password for security
  }
})

// Reset form when type changes
watch(selectedType, () => {
  testResult.value = null
})

// Check if form is valid
const isFormValid = computed(() => {
  if (selectedType.value === 'default') return true
  
  if (selectedType.value === 'serverless') {
    return endpoint.value && apiKey.value
  }
  
  if (selectedType.value === 'cloud') {
    return cloudId.value && apiKey.value
  }
  
  if (selectedType.value === 'self-hosted') {
    return endpoint.value && (apiKey.value || (username.value && password.value))
  }
  
  return false
})

// Build config from form
function buildConfig() {
  const config = {
    type: selectedType.value,
    name: connectionName.value
  }
  
  if (selectedType.value === 'serverless') {
    config.endpoint = endpoint.value
    config.apiKey = apiKey.value
  } else if (selectedType.value === 'cloud') {
    config.cloudId = cloudId.value
    config.apiKey = apiKey.value
  } else if (selectedType.value === 'self-hosted') {
    config.endpoint = endpoint.value
    if (apiKey.value) {
      config.apiKey = apiKey.value
    } else {
      config.username = username.value
      config.password = password.value
    }
  }
  
  return config
}

// Test connection
async function handleTestConnection() {
  testResult.value = null
  
  const config = buildConfig()
  let result
  
  if (selectedType.value === 'default') {
    result = await connectionStore.useDefaultConnection()
  } else {
    result = await connectionStore.testConnection(config)
  }
  
  testResult.value = result
}

// Connect and close modal
async function handleConnect() {
  await handleTestConnection()
  
  if (testResult.value?.success) {
    connectionStore.closeSettings()
  }
}

// Disconnect
function handleDisconnect() {
  connectionStore.disconnect()
  testResult.value = null
  // Reset form
  selectedType.value = 'default'
  connectionName.value = ''
  endpoint.value = ''
  cloudId.value = ''
  apiKey.value = ''
  username.value = ''
  password.value = ''
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="connectionStore.showModal" 
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div 
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="connectionStore.closeSettings()"
        />
        
        <!-- Modal -->
        <div class="relative w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-slate-700/50">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Database class="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-white">Connect to Elasticsearch</h2>
                <p class="text-sm text-slate-400">Configure your data source</p>
              </div>
            </div>
            <button 
              @click="connectionStore.closeSettings()"
              class="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
          
          <!-- Security Notice -->
          <div class="mx-6 mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div class="flex items-start gap-3">
              <Shield class="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div class="text-sm">
                <p class="text-emerald-300 font-medium mb-2">Your credentials are secure</p>
                <ul class="text-emerald-200/70 space-y-2">
                  <li class="flex gap-2">
                    <Lock class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>Stored in <strong>session storage only</strong> — cleared when you close the browser</span>
                  </li>
                  <li class="flex gap-2">
                    <Shield class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span><strong>Never saved permanently</strong> on our servers or in your browser</span>
                  </li>
                  <li class="flex gap-2">
                    <Lock class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>All connections use <strong>encrypted HTTPS</strong></span>
                  </li>
                  <li class="flex gap-2">
                    <Key class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      <a 
                        href="https://www.elastic.co/guide/en/elasticsearch/reference/current/security-api-create-api-key.html" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="text-emerald-300 hover:text-emerald-200 underline inline-flex items-center gap-1"
                      >
                        Create an API key
                        <ExternalLink class="w-3 h-3" />
                      </a>
                      with <strong>least privilege</strong> — only grant read access to required indices
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <!-- Content -->
          <div class="p-6 space-y-6">
            <!-- Connection Type Selector -->
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-3">Connection Type</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="type in connectionTypes"
                  :key="type.id"
                  @click="selectedType = type.id"
                  :class="[
                    'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                    selectedType === type.id 
                      ? 'bg-sky-500/10 border-sky-500/50 ring-1 ring-sky-500/30' 
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                  ]"
                >
                  <component 
                    :is="type.icon" 
                    :class="[
                      'w-5 h-5',
                      selectedType === type.id ? 'text-sky-400' : 'text-slate-400'
                    ]"
                  />
                  <div>
                    <p :class="[
                      'text-sm font-medium',
                      selectedType === type.id ? 'text-sky-300' : 'text-slate-300'
                    ]">
                      {{ type.name }}
                    </p>
                    <p class="text-xs text-slate-500">{{ type.description }}</p>
                  </div>
                </button>
              </div>
            </div>
            
            <!-- Default Connection Info -->
            <div v-if="selectedType === 'default'" class="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div class="flex items-start gap-3">
                <Info class="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div class="text-sm text-slate-400">
                  <p>Uses the Elasticsearch connection configured on the server via environment variables.</p>
                  <p class="mt-2 text-slate-500">This is ideal for development or when the server admin has pre-configured a shared cluster.</p>
                </div>
              </div>
            </div>
            
            <!-- Serverless Fields -->
            <template v-if="selectedType === 'serverless'">
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  Connection Name <span class="text-slate-500">(optional)</span>
                </label>
                <input
                  v-model="connectionName"
                  type="text"
                  placeholder="My Serverless Project"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  Elasticsearch Endpoint <span class="text-red-400">*</span>
                </label>
                <input
                  v-model="endpoint"
                  type="url"
                  placeholder="https://your-project.es.region.aws.elastic.cloud"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-colors"
                  required
                />
                <p class="mt-1.5 text-xs text-slate-500">Find this in Elastic Cloud Console → Your Project → Endpoints</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  API Key <span class="text-red-400">*</span>
                </label>
                <div class="relative">
                  <input
                    v-model="apiKey"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="Enter your API key"
                    class="w-full px-4 py-2.5 pr-12 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-colors"
                    required
                  />
                  <button
                    type="button"
                    @click="showPassword = !showPassword"
                    class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                  >
                    <Eye v-if="!showPassword" class="w-5 h-5" />
                    <EyeOff v-else class="w-5 h-5" />
                  </button>
                </div>
              </div>
            </template>
            
            <!-- Cloud Fields -->
            <template v-if="selectedType === 'cloud'">
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  Connection Name <span class="text-slate-500">(optional)</span>
                </label>
                <input
                  v-model="connectionName"
                  type="text"
                  placeholder="My Cloud Deployment"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  Cloud ID <span class="text-red-400">*</span>
                </label>
                <input
                  v-model="cloudId"
                  type="text"
                  placeholder="deployment-name:base64encodedstring"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-colors"
                  required
                />
                <p class="mt-1.5 text-xs text-slate-500">Find this in Cloud Console → Deployment → Manage → Cloud ID</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  API Key <span class="text-red-400">*</span>
                </label>
                <div class="relative">
                  <input
                    v-model="apiKey"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="Enter your API key"
                    class="w-full px-4 py-2.5 pr-12 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-colors"
                    required
                  />
                  <button
                    type="button"
                    @click="showPassword = !showPassword"
                    class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                  >
                    <Eye v-if="!showPassword" class="w-5 h-5" />
                    <EyeOff v-else class="w-5 h-5" />
                  </button>
                </div>
              </div>
            </template>
            
            <!-- Self-Hosted Fields -->
            <template v-if="selectedType === 'self-hosted'">
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  Connection Name <span class="text-slate-500">(optional)</span>
                </label>
                <input
                  v-model="connectionName"
                  type="text"
                  placeholder="My Cluster"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  Elasticsearch URL <span class="text-red-400">*</span>
                </label>
                <input
                  v-model="endpoint"
                  type="url"
                  placeholder="https://localhost:9200"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-colors"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-300 mb-2">
                  API Key <span class="text-slate-500">(or use username/password below)</span>
                </label>
                <div class="relative">
                  <input
                    v-model="apiKey"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="Enter your API key"
                    class="w-full px-4 py-2.5 pr-12 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    @click="showPassword = !showPassword"
                    class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                  >
                    <Eye v-if="!showPassword" class="w-5 h-5" />
                    <EyeOff v-else class="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-300 mb-2">Username</label>
                  <input
                    v-model="username"
                    type="text"
                    placeholder="elastic"
                    :disabled="!!apiKey"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-colors disabled:opacity-50"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-300 mb-2">Password</label>
                  <input
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="••••••••"
                    :disabled="!!apiKey"
                    class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-colors disabled:opacity-50"
                  />
                </div>
              </div>
            </template>
            
            <!-- Test Result -->
            <Transition name="fade">
              <div 
                v-if="testResult"
                :class="[
                  'p-4 rounded-xl border',
                  testResult.success 
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : 'bg-red-500/10 border-red-500/30'
                ]"
              >
                <div class="flex items-start gap-3">
                  <Check v-if="testResult.success" class="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <AlertCircle v-else class="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <p :class="testResult.success ? 'text-emerald-300' : 'text-red-300'">
                      {{ testResult.success ? 'Connection successful!' : 'Connection failed' }}
                    </p>
                    <p v-if="testResult.cluster_name" class="text-sm text-slate-400 mt-1">
                      Cluster: {{ testResult.cluster_name }} (v{{ testResult.version }})
                    </p>
                    <p v-if="testResult.error" class="text-sm text-red-400/80 mt-1">
                      {{ testResult.error }}
                    </p>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
          
          <!-- Footer -->
          <div class="flex items-center justify-between p-6 border-t border-slate-700/50 bg-slate-800/30">
            <button
              v-if="connectionStore.isConnected"
              @click="handleDisconnect"
              class="px-4 py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Disconnect
            </button>
            <div v-else />
            
            <div class="flex items-center gap-3">
              <button
                @click="handleTestConnection"
                :disabled="!isFormValid || connectionStore.loading"
                class="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Test Connection
              </button>
              <button
                @click="handleConnect"
                :disabled="!isFormValid || connectionStore.loading"
                class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-sky-500/20"
              >
                <Loader2 v-if="connectionStore.loading" class="w-4 h-4 animate-spin" />
                <span>{{ connectionStore.loading ? 'Connecting...' : 'Connect' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95) translateY(10px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

