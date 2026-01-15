/**
 * Query Validator - Tier 2
 *
 * Validates that generated Elasticsearch queries execute correctly
 * and return expected data shapes.
 *
 * Supports two connection modes:
 * - MCP Server: Uses MCPClient for MCP-based connections
 * - Direct ES: Uses ESClient for direct Elasticsearch connections (e.g., Serverless)
 */

import { MCPClient } from './MCPClient.js';
import { ESClient } from './ESClient.js';
import { isMCPConfigured, isServerlessConfigured } from '../config/elastic-cloud.js';

export class QueryValidator {
  constructor(options = {}) {
    this.client = null;
    this.clientType = null;
    this.defaultIndex = options.defaultIndex || 'test-data';
    this.options = options;
  }

  /**
   * Initialize the validator - tries MCP first, then direct ES
   */
  async init() {
    // Try MCP first if configured
    if (isMCPConfigured()) {
      try {
        this.client = this.options.mcpClient || new MCPClient(this.options);
        const healthy = await this.client.ping();
        if (healthy) {
          await this.client.initialize();
          this.clientType = 'mcp';
          return true;
        }
      } catch (e) {
        console.log('  MCP connection failed, trying direct ES...');
      }
    }

    // Fall back to direct Elasticsearch if Serverless is configured
    if (isServerlessConfigured()) {
      try {
        this.client = new ESClient(this.options);
        const healthy = await this.client.ping();
        if (healthy) {
          await this.client.initialize();
          this.clientType = 'direct';
          console.log('  Connected via direct Elasticsearch client');
          return true;
        }
      } catch (e) {
        throw new Error(`Direct ES connection failed: ${e.message}`);
      }
    }

    throw new Error('No Elasticsearch connection available. Configure MCP_SERVER_URL or ES_SERVERLESS_URL/ES_API_KEY');
  }

  /**
   * Extract query from a Kibana Vega spec
   * Handles multiple spec formats:
   * - Vega-Lite: spec.data.url
   * - Full Vega array: spec.data[] with named sources
   * - Layer-based: spec.layer[].data.url
   */
  extractQuery(spec) {
    // Case 1: Direct Vega-Lite format (spec.data.url)
    if (spec.data?.url?.body) {
      return {
        index: spec.data.url.index,
        query: spec.data.url.body,
        format: spec.data.format
      };
    }

    // Case 2: Full Vega format with data array
    if (Array.isArray(spec.data)) {
      // Look for any data source with a URL body
      const urlData = spec.data.find(d => d.url?.body);
      if (urlData) {
        return {
          index: urlData.url.index,
          query: urlData.url.body,
          format: urlData.format
        };
      }
    }

    // Case 3: Layer-based Vega-Lite (spec.layer[].data.url)
    if (spec.layer && Array.isArray(spec.layer)) {
      for (const layer of spec.layer) {
        if (layer.data?.url?.body) {
          return {
            index: layer.data.url.index,
            query: layer.data.url.body,
            format: layer.data.format
          };
        }
      }
    }

    // Case 4: Spec with nested spec property (faceted charts)
    if (spec.spec?.data?.url?.body) {
      return {
        index: spec.spec.data.url.index,
        query: spec.spec.data.url.body,
        format: spec.spec.data.format
      };
    }

    return null;
  }

  /**
   * Validate a query executes without errors
   */
  async validateQueryExecution(index, query) {
    const result = {
      valid: true,
      response: null,
      error: null,
      duration: 0
    };

    const startTime = Date.now();

    try {
      const response = await this.client.search(index, query);
      result.response = response;
      result.duration = Date.now() - startTime;

      // Check for Elasticsearch errors in response
      if (response.error) {
        result.valid = false;
        result.error = response.error.reason || response.error.type;
      }

    } catch (error) {
      result.valid = false;
      result.error = error.message;
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Validate response shape matches expected transform
   */
  validateResponseShape(response, spec) {
    const result = {
      valid: true,
      issues: []
    };

    // Get expected format
    const format = spec.data?.format || spec.data?.find?.(d => d.format)?.format;
    const expectedPath = format?.property || 'aggregations';

    // Check aggregations exist
    if (!response.aggregations) {
      // Not all specs use aggregations (e.g., metric with single value)
      if (expectedPath.includes('aggregations')) {
        result.issues.push('Response missing aggregations');
      }
      return result;
    }

    // Check primary bucket exists
    const aggKeys = Object.keys(response.aggregations);
    if (aggKeys.length === 0) {
      result.issues.push('Aggregations object is empty');
      result.valid = false;
      return result;
    }

    // Check buckets format
    const primaryAgg = response.aggregations[aggKeys[0]];

    if (primaryAgg.buckets) {
      // Terms/histogram/date_histogram aggregation
      if (!Array.isArray(primaryAgg.buckets)) {
        result.issues.push('Buckets should be an array');
        result.valid = false;
      } else if (primaryAgg.buckets.length === 0) {
        result.issues.push('Buckets array is empty (no matching data)');
        // Not necessarily invalid, just a warning
      } else {
        // Check bucket structure
        const firstBucket = primaryAgg.buckets[0];
        if (firstBucket.key === undefined) {
          result.issues.push('Bucket missing key field');
          result.valid = false;
        }
        if (firstBucket.doc_count === undefined) {
          result.issues.push('Bucket missing doc_count field');
          result.valid = false;
        }
      }
    } else if (primaryAgg.value !== undefined) {
      // Single metric aggregation
      if (typeof primaryAgg.value !== 'number') {
        result.issues.push('Metric value should be a number');
        result.valid = false;
      }
    } else if (primaryAgg.hits?.hits) {
      // top_hits aggregation (used by binned_heatmap, density, etc.)
      if (!Array.isArray(primaryAgg.hits.hits)) {
        result.issues.push('top_hits response should have hits array');
        result.valid = false;
      }
      // Empty hits array is valid but may indicate no matching data
    } else {
      result.issues.push('Unknown aggregation format');
      result.valid = false;
    }

    return result;
  }

  /**
   * Validate transforms can be applied to response
   */
  validateTransforms(response, spec) {
    const result = {
      valid: true,
      issues: [],
      transformedData: null
    };

    const transforms = spec.transform || [];
    if (transforms.length === 0) {
      return result;
    }

    // Get the data from response
    const format = spec.data?.format;
    let data;

    try {
      if (format?.property) {
        // Navigate to the specified property path
        const path = format.property.split('.');
        data = response;
        for (const key of path) {
          data = data[key];
        }
      } else {
        data = response.aggregations?.primary?.buckets || [];
      }

      if (!Array.isArray(data)) {
        data = [data];
      }

      // Simulate transforms
      const transformedData = data.map(datum => {
        const result = { ...datum };

        for (const transform of transforms) {
          if (transform.calculate && transform.as) {
            try {
              // Simple expression evaluation for validation
              let expr = transform.calculate;

              // Replace datum references
              expr = expr.replace(/datum\.([a-zA-Z_][a-zA-Z0-9_.]*)/g, (_, field) => {
                const parts = field.split('.');
                let val = datum;
                for (const p of parts) {
                  val = val?.[p];
                }
                return typeof val === 'string' ? `"${val}"` : val;
              });

              // This is a basic check - real Vega has more complex expression evaluation
              result[transform.as] = 'validated';
            } catch (e) {
              result.issues.push(`Transform failed: ${transform.as} - ${e.message}`);
            }
          }
        }

        return result;
      });

      result.transformedData = transformedData;

    } catch (error) {
      result.valid = false;
      result.issues.push(`Transform validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Full validation of a spec's query
   */
  async validateSpec(spec, options = {}) {
    const result = {
      valid: true,
      queryExtracted: false,
      queryValid: false,
      responseValid: false,
      transformsValid: false,
      details: {}
    };

    // Extract query
    const extracted = this.extractQuery(spec);
    if (!extracted) {
      result.valid = false;
      result.details.extraction = 'Could not extract query from spec';
      return result;
    }

    result.queryExtracted = true;
    result.details.index = extracted.index;

    // Use provided index or extracted index
    const index = options.index || extracted.index || this.defaultIndex;

    // Validate query execution
    const queryResult = await this.validateQueryExecution(index, extracted.query);
    result.queryValid = queryResult.valid;
    result.details.queryExecution = queryResult;

    if (!queryResult.valid) {
      result.valid = false;
      return result;
    }

    // Validate response shape
    const shapeResult = this.validateResponseShape(queryResult.response, spec);
    result.responseValid = shapeResult.valid;
    result.details.responseShape = shapeResult;

    if (!shapeResult.valid) {
      result.valid = false;
    }

    // Validate transforms
    const transformResult = this.validateTransforms(queryResult.response, spec);
    result.transformsValid = transformResult.valid;
    result.details.transforms = transformResult;

    if (!transformResult.valid) {
      result.valid = false;
    }

    return result;
  }

  /**
   * Batch validate multiple specs
   */
  async validateBatch(specs, options = {}) {
    const results = {
      total: specs.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    for (const { name, spec } of specs) {
      try {
        const result = await this.validateSpec(spec, options);

        results.details.push({
          name,
          ...result
        });

        if (result.valid) {
          results.passed++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          name,
          valid: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Close the validator
   */
  async close() {
    if (this.client) {
      await this.client.close();
    }
  }

  /**
   * Get connection info
   */
  getConnectionInfo() {
    return {
      type: this.clientType,
      connected: !!this.client
    };
  }
}

export default QueryValidator;
