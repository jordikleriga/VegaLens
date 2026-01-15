/**
 * Elastic Serverless Configuration
 *
 * Environment variables:
 * - ES_SERVERLESS_URL: Elasticsearch Serverless endpoint
 * - ES_API_KEY: API key for authentication
 * - KIBANA_URL: Kibana Serverless endpoint (for visual validation)
 * - MCP_SERVER_URL: MCP server endpoint (optional, for local testing)
 *
 * Serverless Setup:
 * 1. Create a project at https://cloud.elastic.co/serverless-projects
 * 2. Get your Elasticsearch endpoint from the project overview
 * 3. Create an API key with appropriate permissions
 * 4. Set environment variables:
 *    export ES_SERVERLESS_URL="https://your-project.es.us-east-1.aws.elastic.cloud"
 *    export ES_API_KEY="your-api-key"
 *    export KIBANA_URL="https://your-project.kb.us-east-1.aws.elastic.cloud"
 */

// Support multiple naming conventions for env vars
const ES_URL = process.env.ES_SERVERLESS_URL
  || process.env.ELASTIC_SERVERLESS_ENDPOINT
  || process.env.ES_CLOUD_URL
  || 'http://localhost:9200';

const ES_KEY = process.env.ES_API_KEY
  || process.env.ELASTIC_API_KEY
  || null;

/**
 * Derive Kibana URL from Elasticsearch URL for Serverless
 * e.g., https://project.es.region.gcp.elastic.cloud -> https://project.kb.region.gcp.elastic.cloud
 */
function deriveKibanaUrl(esUrl) {
  if (!esUrl || esUrl === 'http://localhost:9200') return null;
  // Replace .es. with .kb. in the URL
  return esUrl.replace('.es.', '.kb.');
}

export const config = {
  // Elasticsearch Serverless
  elasticsearch: {
    url: ES_URL,
    apiKey: ES_KEY,
    // Serverless uses API key auth exclusively
    username: null,
    password: null
  },

  // Kibana Serverless (for visual validation)
  // For Serverless, derive Kibana URL from ES URL by replacing .es. with .kb.
  kibana: {
    url: process.env.KIBANA_URL || deriveKibanaUrl(ES_URL),
    apiKey: ES_KEY // Same API key works for Kibana
  },

  // MCP Server configuration
  // For Serverless, you can use the official Elastic MCP or run locally
  mcp: {
    // Default to Elastic's hosted MCP for Serverless
    url: process.env.MCP_SERVER_URL || null,
    enabled: ES_URL !== 'http://localhost:9200' || !!process.env.MCP_SERVER_URL
  },

  // Test index configuration
  // Serverless projects come with sample data indices
  testIndex: {
    name: process.env.TEST_INDEX || 'kibana_sample_data_ecommerce',
    timeField: process.env.TEST_TIME_FIELD || 'order_date',
    // Alternative sample indices:
    // - kibana_sample_data_logs (timeField: @timestamp)
    // - kibana_sample_data_flights (timeField: timestamp)
    alternatives: {
      ecommerce: { name: 'kibana_sample_data_ecommerce', timeField: 'order_date' },
      logs: { name: 'kibana_sample_data_logs', timeField: '@timestamp' },
      flights: { name: 'kibana_sample_data_flights', timeField: 'timestamp' }
    }
  },

  // Visual regression settings
  visual: {
    diffThreshold: parseFloat(process.env.VISUAL_DIFF_THRESHOLD) || 0.01,
    baselineDir: 'tests/visual-regression/baselines',
    outputDir: 'tests/visual-regression/output'
  }
};

/**
 * Get Elasticsearch client options for Serverless
 */
export function getESClientOptions() {
  const { elasticsearch } = config;

  const options = {
    node: elasticsearch.url,
    // Serverless requires TLS
    tls: {
      rejectUnauthorized: true
    }
  };

  if (elasticsearch.apiKey) {
    options.auth = { apiKey: elasticsearch.apiKey };
  }

  return options;
}

/**
 * Get Kibana request headers
 */
export function getKibanaHeaders() {
  const { kibana } = config;

  if (!kibana.apiKey) {
    return {};
  }

  return {
    'Authorization': `ApiKey ${kibana.apiKey}`,
    'kbn-xsrf': 'true',
    'Content-Type': 'application/json'
  };
}

/**
 * Check if Serverless configuration is available
 */
export function isServerlessConfigured() {
  const hasUrl = !!process.env.ES_SERVERLESS_URL || !!process.env.ELASTIC_SERVERLESS_ENDPOINT;
  const hasKey = !!process.env.ES_API_KEY || !!process.env.ELASTIC_API_KEY;
  return hasUrl && hasKey;
}

/**
 * Check if cloud/serverless configuration is available (backwards compatible)
 */
export function isCloudConfigured() {
  return isServerlessConfigured() || (!!process.env.ES_CLOUD_URL && !!ES_KEY);
}

/**
 * Check if MCP server is configured
 */
export function isMCPConfigured() {
  return config.mcp.enabled;
}

/**
 * Check if Kibana is configured
 */
export function isKibanaConfigured() {
  return !!config.kibana.url && !!config.kibana.apiKey;
}

/**
 * Get connection info for display
 */
export function getConnectionInfo() {
  return {
    elasticsearch: config.elasticsearch.url ? 'Configured' : 'Not configured',
    kibana: config.kibana.url ? 'Configured' : 'Not configured',
    mcp: config.mcp.enabled ? 'Enabled' : 'Disabled',
    testIndex: config.testIndex.name,
    isServerless: !!process.env.ES_SERVERLESS_URL
  };
}

export default config;
