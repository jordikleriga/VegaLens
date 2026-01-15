/**
 * ES Client - Direct Elasticsearch Client for Tier 2
 *
 * Direct connection to Elasticsearch Serverless without MCP server.
 * Uses the official @elastic/elasticsearch client.
 */

import { Client } from '@elastic/elasticsearch';
import { config, getESClientOptions } from '../config/elastic-cloud.js';

export class ESClient {
  constructor(options = {}) {
    this.client = null;
    this.options = options;
  }

  /**
   * Initialize the Elasticsearch client
   */
  async init() {
    const clientOptions = getESClientOptions();
    this.client = new Client(clientOptions);
    return true;
  }

  /**
   * Check Elasticsearch health
   */
  async ping() {
    try {
      if (!this.client) {
        await this.init();
      }
      const response = await this.client.ping();
      return response === true;
    } catch (error) {
      console.error('ES ping failed:', error.message);
      return false;
    }
  }

  /**
   * Initialize (compatibility with MCPClient interface)
   */
  async initialize() {
    if (!this.client) {
      await this.init();
    }
    // Get cluster info
    const info = await this.client.info();
    return {
      serverInfo: {
        name: 'elasticsearch-direct',
        version: info.version?.number || 'unknown'
      }
    };
  }

  /**
   * List Elasticsearch indices
   */
  async listIndices() {
    const response = await this.client.cat.indices({ format: 'json' });
    return response.map(idx => ({
      name: idx.index,
      docs: idx['docs.count'],
      size: idx['store.size']
    }));
  }

  /**
   * Get index mappings
   */
  async getMappings(index) {
    const response = await this.client.indices.getMapping({ index });
    return response[index]?.mappings || response;
  }

  /**
   * Execute Elasticsearch search query
   */
  async search(index, query) {
    // Handle query that might be a string (from MCP format)
    const body = typeof query === 'string' ? JSON.parse(query) : query;

    const response = await this.client.search({
      index,
      ...body
    });

    return response;
  }

  /**
   * Execute ES|QL query
   */
  async esql(query) {
    const response = await this.client.esql.query({
      query,
      format: 'json'
    });
    return response;
  }

  /**
   * Get shard information
   */
  async getShards(index) {
    const response = await this.client.cat.shards({
      index,
      format: 'json'
    });
    return response;
  }

  /**
   * Close the client
   */
  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}

export default ESClient;
