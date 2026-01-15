/**
 * MCP Client - Tier 2
 *
 * HTTP client for the Elastic MCP Server.
 * Supports the streamable-HTTP protocol.
 */

export class MCPClient {
  constructor(options = {}) {
    this.baseUrl = options.url || process.env.MCP_SERVER_URL || 'http://localhost:8080';
    this.timeout = options.timeout || 30000;
    this.sessionId = null;
  }

  /**
   * Make a request to the MCP server
   */
  async request(method, params = {}) {
    const url = `${this.baseUrl}/mcp`;

    const body = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(`MCP error: ${result.error.message}`);
    }

    return result.result;
  }

  /**
   * Check MCP server health
   */
  async ping() {
    try {
      const response = await fetch(`${this.baseUrl}/ping`, {
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Initialize MCP session
   */
  async initialize() {
    const result = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'vegatool-test-runner',
        version: '1.0.0'
      }
    });

    this.sessionId = result.sessionId;
    return result;
  }

  /**
   * List available tools
   */
  async listTools() {
    return this.request('tools/list');
  }

  /**
   * Execute a tool
   */
  async callTool(name, args = {}) {
    return this.request('tools/call', { name, arguments: args });
  }

  /**
   * List Elasticsearch indices
   */
  async listIndices() {
    return this.callTool('list_indices');
  }

  /**
   * Get index mappings
   */
  async getMappings(index) {
    return this.callTool('get_mappings', { index });
  }

  /**
   * Execute Elasticsearch search query
   */
  async search(index, query) {
    return this.callTool('search', {
      index,
      query: JSON.stringify(query)
    });
  }

  /**
   * Execute ES|QL query
   */
  async esql(query) {
    return this.callTool('esql', { query });
  }

  /**
   * Get shard information
   */
  async getShards(index) {
    return this.callTool('get_shards', { index });
  }

  /**
   * Close session
   */
  async close() {
    // MCP doesn't require explicit close for HTTP transport
    this.sessionId = null;
  }
}

export default MCPClient;
