import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

let client = null;

export const getElasticClient = () => {
  if (client) return client;

  const config = {};

  // Serverless connection (Elasticsearch Serverless uses endpoint URL + API key)
  if (process.env.ELASTIC_SERVERLESS_ENDPOINT) {
    config.node = process.env.ELASTIC_SERVERLESS_ENDPOINT;
    
    if (process.env.ELASTIC_API_KEY) {
      config.auth = { apiKey: process.env.ELASTIC_API_KEY };
    } else {
      throw new Error('Elasticsearch Serverless requires ELASTIC_API_KEY.');
    }
  }
  // Cloud connection (for standard Elastic Cloud deployments)
  else if (process.env.ELASTIC_CLOUD_ID) {
    config.cloud = { id: process.env.ELASTIC_CLOUD_ID };
    
    if (process.env.ELASTIC_API_KEY) {
      config.auth = { apiKey: process.env.ELASTIC_API_KEY };
    } else if (process.env.ELASTIC_USERNAME && process.env.ELASTIC_PASSWORD) {
      config.auth = {
        username: process.env.ELASTIC_USERNAME,
        password: process.env.ELASTIC_PASSWORD
      };
    }
  } 
  // Direct node connection (for on-prem or self-hosted)
  else if (process.env.ELASTIC_NODE) {
    config.node = process.env.ELASTIC_NODE;
    
    if (process.env.ELASTIC_API_KEY) {
      config.auth = { apiKey: process.env.ELASTIC_API_KEY };
    } else if (process.env.ELASTIC_USERNAME && process.env.ELASTIC_PASSWORD) {
      config.auth = {
        username: process.env.ELASTIC_USERNAME,
        password: process.env.ELASTIC_PASSWORD
      };
    }
    
    // For self-signed certs in development
    if (process.env.ELASTIC_SKIP_TLS === 'true') {
      config.tls = { rejectUnauthorized: false };
    }
  } else {
    throw new Error('Elasticsearch connection not configured. Set ELASTIC_SERVERLESS_ENDPOINT, ELASTIC_CLOUD_ID, or ELASTIC_NODE.');
  }

  client = new Client(config);
  return client;
};

export const testConnection = async () => {
  try {
    const esClient = getElasticClient();
    const info = await esClient.info();
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
};

// Reset client (useful for config changes)
export const resetClient = () => {
  client = null;
};
