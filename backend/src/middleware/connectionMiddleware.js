/**
 * Connection Middleware
 * 
 * Creates per-request Elasticsearch clients based on user-provided credentials.
 * Falls back to environment-configured client if no user credentials provided.
 * 
 * SECURITY NOTES:
 * - Credentials are received per-request in headers (never stored server-side)
 * - Clients are created fresh for each request and not cached
 * - Sensitive headers are not logged
 */
import { Client } from '@elastic/elasticsearch';
import { getElasticClient } from '../config/elasticsearch.js';

/**
 * Create an Elasticsearch client from request headers
 * @param {Object} req - Express request object
 * @returns {Client|null} - ES client or null if no valid config
 */
export function createClientFromRequest(req) {
  const connectionType = req.headers['x-es-connection-type'];
  const endpoint = req.headers['x-es-endpoint'];
  const apiKey = req.headers['x-es-api-key'];
  const cloudId = req.headers['x-es-cloud-id'];
  const username = req.headers['x-es-username'];
  const password = req.headers['x-es-password'];

  // No custom connection type specified - return null to use default
  if (!connectionType || connectionType === 'default') {
    return null;
  }

  const config = {};

  try {
    if (connectionType === 'serverless' && endpoint) {
      config.node = endpoint;
      if (apiKey) {
        config.auth = { apiKey };
      } else {
        console.warn('[ConnectionMiddleware] Serverless connection requires API key');
        return null;
      }
    } else if (connectionType === 'cloud' && cloudId) {
      config.cloud = { id: cloudId };
      if (apiKey) {
        config.auth = { apiKey };
      } else if (username && password) {
        config.auth = { username, password };
      } else {
        console.warn('[ConnectionMiddleware] Cloud connection requires API key or credentials');
        return null;
      }
    } else if (connectionType === 'self-hosted' && endpoint) {
      config.node = endpoint;
      if (apiKey) {
        config.auth = { apiKey };
      } else if (username && password) {
        config.auth = { username, password };
      }
      // Allow connections without auth for local dev (e.g., localhost with security disabled)
      
      // Skip TLS verification for self-signed certs (common in dev)
      config.tls = { rejectUnauthorized: false };
    } else {
      console.warn('[ConnectionMiddleware] Invalid connection configuration');
      return null;
    }

    return new Client(config);
  } catch (error) {
    console.error('[ConnectionMiddleware] Failed to create client:', error.message);
    return null;
  }
}

/**
 * Get the appropriate ES client for the request
 * Uses custom connection from headers if provided, falls back to env config
 * @param {Object} req - Express request object
 * @returns {Client} - Elasticsearch client
 */
export function getClientForRequest(req) {
  // Try to create client from request headers
  const customClient = createClientFromRequest(req);
  
  if (customClient) {
    return customClient;
  }
  
  // Fall back to environment-configured client
  return getElasticClient();
}

/**
 * Express middleware that attaches ES client to request
 * Usage: router.use(elasticConnectionMiddleware)
 */
export function elasticConnectionMiddleware(req, res, next) {
  try {
    req.esClient = getClientForRequest(req);
    next();
  } catch (error) {
    console.error('[ConnectionMiddleware] Error:', error.message);
    res.status(500).json({
      error: 'Failed to establish Elasticsearch connection',
      message: error.message
    });
  }
}

/**
 * Test a connection configuration without affecting the current session
 * @param {Object} config - Connection configuration from request body/headers
 * @returns {Promise<Object>} - Connection test result
 */
export async function testConnectionConfig(config) {
  let client;
  
  try {
    if (!config.type || config.type === 'default') {
      // Test default connection
      client = getElasticClient();
    } else if (config.type === 'serverless' && config.endpoint) {
      client = new Client({
        node: config.endpoint,
        auth: config.apiKey ? { apiKey: config.apiKey } : undefined
      });
    } else if (config.type === 'cloud' && config.cloudId) {
      const clientConfig = {
        cloud: { id: config.cloudId }
      };
      if (config.apiKey) {
        clientConfig.auth = { apiKey: config.apiKey };
      } else if (config.username && config.password) {
        clientConfig.auth = { username: config.username, password: config.password };
      }
      client = new Client(clientConfig);
    } else if (config.type === 'self-hosted' && config.endpoint) {
      const clientConfig = {
        node: config.endpoint,
        tls: { rejectUnauthorized: false }
      };
      if (config.apiKey) {
        clientConfig.auth = { apiKey: config.apiKey };
      } else if (config.username && config.password) {
        clientConfig.auth = { username: config.username, password: config.password };
      }
      client = new Client(clientConfig);
    } else {
      return {
        connected: false,
        error: 'Invalid connection configuration'
      };
    }

    const info = await client.info();
    return {
      connected: true,
      cluster_name: info.cluster_name || info.name,
      version: info.version?.number || 'serverless'
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
}

export default {
  createClientFromRequest,
  getClientForRequest,
  elasticConnectionMiddleware,
  testConnectionConfig
};

