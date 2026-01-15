import { Router } from 'express';
import { getElasticClient, testConnection } from '../config/elasticsearch.js';
import { getClientForRequest, testConnectionConfig } from '../middleware/connectionMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../middleware/logger.js';

const router = Router();

/**
 * Helper to get ES client for a request
 * Uses user-provided credentials from headers, or falls back to env config
 */
function getClient(req) {
  return getClientForRequest(req);
}

// Test Elasticsearch connection (GET - uses env config or session headers)
router.get('/connection', async (req, res, next) => {
  try {
    logger.info('Testing Elasticsearch connection');
    
    // Try user-provided connection first
    const client = getClient(req);
    
    try {
      const info = await client.info();
      const result = {
        connected: true,
        cluster_name: info.cluster_name || info.name,
        version: info.version?.number || 'serverless'
      };
      logger.info('Elasticsearch connection result', { connected: true, version: result.version });
      res.json(result);
    } catch (error) {
      logger.warn('Elasticsearch connection failed', { error: error.message });
      res.json({
        connected: false,
        error: error.message
      });
    }
  } catch (error) {
    logger.error('Elasticsearch connection test failed', { error: error.message });
    next(error);
  }
});

// Test connection with explicit config (POST - for testing before saving)
router.post('/test-connection', async (req, res, next) => {
  try {
    logger.info('Testing explicit connection configuration');
    
    // Build config from headers (frontend sends credentials in headers for security)
    const config = {
      type: req.headers['x-es-connection-type'] || 'default',
      endpoint: req.headers['x-es-endpoint'],
      apiKey: req.headers['x-es-api-key'],
      cloudId: req.headers['x-es-cloud-id'],
      username: req.headers['x-es-username'],
      password: req.headers['x-es-password']
    };
    
    const result = await testConnectionConfig(config);
    logger.info('Connection test result', { connected: result.connected, type: config.type });
    res.json(result);
  } catch (error) {
    logger.error('Connection test failed', { error: error.message });
    res.json({
      connected: false,
      error: error.message
    });
  }
});

// Get all indices
router.get('/indices', async (req, res, next) => {
  try {
    logger.info('Fetching Elasticsearch indices');
    const client = getClient(req);
    const response = await client.cat.indices({
      format: 'json',
      h: 'index,health,status,docs.count,store.size,pri,rep'
    });
    
    // Filter out system indices
    const userIndices = response
      .filter(idx => !idx.index.startsWith('.'))
      .map(idx => ({
        name: idx.index,
        health: idx.health,
        status: idx.status,
        docsCount: parseInt(idx['docs.count']) || 0,
        storeSize: idx['store.size'],
        primaryShards: parseInt(idx.pri) || 1,
        replicaShards: parseInt(idx.rep) || 0
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    logger.info('Fetched indices', { count: userIndices.length, indices: userIndices.map(i => i.name) });
    res.json(userIndices);
  } catch (error) {
    logger.error('Failed to fetch indices', { error: error.message });
    next(error);
  }
});

// Get index mapping (field structure) - uses Field Capabilities API like Kibana
router.get('/indices/:indexName/mapping', async (req, res, next) => {
  try {
    const { indexName } = req.params;
    logger.info('Fetching index mapping', { index: indexName });
    const client = getClient(req);
    
    // Use field_caps API for accurate aggregatable/searchable detection (like Kibana)
    const fieldCapsResponse = await client.fieldCaps({
      index: indexName,
      fields: '*'
    });
    
    const fields = processFieldCaps(fieldCapsResponse.fields || {});
    logger.info('Index mapping fetched', { 
      index: indexName, 
      fieldCount: fields.length,
      aggregatableFields: fields.filter(f => f.aggregatable).length,
      dateFields: fields.filter(f => f.category === 'date').length,
      numericFields: fields.filter(f => f.category === 'number').length
    });
    res.json(fields);
  } catch (error) {
    logger.error('Failed to fetch index mapping', { index: req.params.indexName, error: error.message });
    next(error);
  }
});

// Get field capabilities with detailed info
router.get('/indices/:indexName/field-caps', async (req, res, next) => {
  try {
    const { indexName } = req.params;
    logger.info('Fetching field capabilities', { index: indexName });
    const client = getClient(req);
    
    const response = await client.fieldCaps({
      index: indexName,
      fields: '*',
      include_unmapped: true
    });
    
    const fieldCount = Object.keys(response.fields || {}).length;
    logger.info('Field capabilities fetched', { index: indexName, fieldCount });
    res.json(response.fields || {});
  } catch (error) {
    logger.error('Failed to fetch field capabilities', { index: req.params.indexName, error: error.message });
    next(error);
  }
});

// Get sample data from index
router.get('/indices/:indexName/sample', async (req, res, next) => {
  try {
    const { indexName } = req.params;
    const { size = 100 } = req.query;
    logger.info('Fetching sample data', { index: indexName, size });
    const client = getClient(req);
    
    const response = await client.search({
      index: indexName,
      size: Math.min(parseInt(size), 10000), // Allow up to 10k records
      query: { match_all: {} },
      fields: ["*"], // Request all indexed fields
      _source: false // Don't return _source, use fields instead
    });
    
    const total = response.hits.total?.value || response.hits.total;
    logger.info('Sample data fetched', { index: indexName, returned: response.hits.hits.length, total });
    
    // Transform fields response - fields returns arrays, flatten to single values
    const hits = response.hits.hits.map(hit => {
      const doc = { _id: hit._id };
      if (hit.fields) {
        Object.entries(hit.fields).forEach(([key, value]) => {
          // Fields are returned as arrays, take first value for display
          // Handle nested fields by preserving the dot notation
          doc[key] = Array.isArray(value) && value.length === 1 ? value[0] : value;
        });
      }
      return doc;
    });
    
    res.json({ total, hits });
  } catch (error) {
    logger.error('Failed to fetch sample data', { index: req.params.indexName, error: error.message });
    next(error);
  }
});

// Get field values (for dropdowns/filters)
router.get('/indices/:indexName/fields/:fieldName/values', async (req, res, next) => {
  try {
    const { indexName, fieldName } = req.params;
    const { size = 100 } = req.query;
    logger.info('Fetching field values', { index: indexName, field: fieldName, size });
    const client = getClient(req);
    
    const response = await client.search({
      index: indexName,
      size: 0,
      aggs: {
        field_values: {
          terms: {
            field: fieldName,
            size: Math.min(parseInt(size), 1000)
          }
        }
      }
    });
    
    const values = response.aggregations?.field_values?.buckets?.map(b => ({
      value: b.key,
      count: b.doc_count
    })) || [];
    
    logger.info('Field values fetched', { index: indexName, field: fieldName, uniqueValues: values.length });
    res.json(values);
  } catch (error) {
    logger.error('Failed to fetch field values', { index: req.params.indexName, field: req.params.fieldName, error: error.message });
    next(error);
  }
});

// Execute custom query
router.post('/query', async (req, res, next) => {
  try {
    const { index, query, size = 100, aggs, sort } = req.body;
    
    if (!index) {
      throw new AppError('Index is required', 400);
    }
    
    logger.info('Executing custom query', { 
      index, 
      size, 
      hasQuery: !!query, 
      hasAggs: !!aggs, 
      hasSort: !!sort 
    });
    const client = getClient(req);
    
    const searchParams = {
      index,
      size: Math.min(parseInt(size), 10000),
      query: query || { match_all: {} },
      fields: ["*"], // Request all indexed fields
      _source: false // Don't return _source, use fields instead
    };
    
    if (aggs) searchParams.aggs = aggs;
    if (sort) searchParams.sort = sort;
    
    const response = await client.search(searchParams);
    
    const total = response.hits.total?.value || response.hits.total;
    logger.info('Custom query executed', { 
      index, 
      hitsReturned: response.hits.hits.length, 
      total,
      hasAggregations: !!response.aggregations
    });
    
    // Transform fields response - fields returns arrays, flatten to single values
    const hits = response.hits.hits.map(hit => {
      const doc = { _id: hit._id };
      if (hit.fields) {
        Object.entries(hit.fields).forEach(([key, value]) => {
          // Fields are returned as arrays, take first value for display
          doc[key] = Array.isArray(value) && value.length === 1 ? value[0] : value;
        });
      }
      return doc;
    });
    
    res.json({
      total,
      hits,
      aggregations: response.aggregations
    });
  } catch (error) {
    logger.error('Custom query failed', { index: req.body?.index, error: error.message });
    next(error);
  }
});

// Get field statistics
router.get('/indices/:indexName/fields/:fieldName/stats', async (req, res, next) => {
  try {
    const { indexName, fieldName } = req.params;
    logger.info('Fetching field statistics', { index: indexName, field: fieldName });
    const client = getClient(req);
    
    const response = await client.search({
      index: indexName,
      size: 0,
      aggs: {
        stats: {
          stats: { field: fieldName }
        },
        percentiles: {
          percentiles: { field: fieldName }
        }
      }
    });
    
    const stats = response.aggregations?.stats;
    logger.info('Field statistics fetched', { 
      index: indexName, 
      field: fieldName,
      min: stats?.min,
      max: stats?.max,
      avg: stats?.avg,
      count: stats?.count
    });
    
    res.json({
      stats: response.aggregations?.stats,
      percentiles: response.aggregations?.percentiles?.values
    });
  } catch (error) {
    logger.error('Failed to fetch field statistics', { index: req.params.indexName, field: req.params.fieldName, error: error.message });
    next(error);
  }
});

// Helper: Process field_caps API response (like Kibana does)
function processFieldCaps(fieldCapsFields) {
  const fields = [];
  const processedParents = new Set();
  
  for (const [fieldName, typeInfo] of Object.entries(fieldCapsFields)) {
    // Skip internal fields
    if (fieldName.startsWith('_')) continue;
    
    // Get the first type info (handle multi-type fields)
    const types = Object.keys(typeInfo);
    const primaryType = types[0];
    const typeConfig = typeInfo[primaryType];
    
    // Determine the parent field for subfields
    const isSubfield = fieldName.includes('.');
    const parentField = isSubfield ? fieldName.split('.').slice(0, -1).join('.') : null;
    
    // Create field info matching Kibana's structure
    const fieldInfo = {
      name: fieldName,
      type: primaryType,
      searchable: typeConfig.searchable !== false,
      aggregatable: typeConfig.aggregatable === true,
      isSubfield,
      parentField,
      // Field category for UI grouping (like Kibana)
      category: getFieldCategory(primaryType),
      // Metadata fields for enhanced UI
      metadata: {
        indices: typeConfig.indices || [],
        nonAggregatableIndices: typeConfig.non_aggregatable_indices || [],
        nonSearchableIndices: typeConfig.non_searchable_indices || []
      }
    };
    
    // Add esTypes for compatibility
    fieldInfo.esTypes = types;
    
    fields.push(fieldInfo);
  }
  
  // Sort fields: aggregatable first, then by name, subfields after parents
  return fields.sort((a, b) => {
    // Aggregatable fields first
    if (a.aggregatable !== b.aggregatable) {
      return a.aggregatable ? -1 : 1;
    }
    // Then by name
    return a.name.localeCompare(b.name);
  });
}

// Categorize fields like Kibana does
function getFieldCategory(type) {
  const numericTypes = ['long', 'integer', 'short', 'byte', 'double', 'float', 'half_float', 'scaled_float'];
  const stringTypes = ['keyword', 'text', 'constant_keyword', 'wildcard'];
  const dateTypes = ['date', 'date_nanos'];
  const geoTypes = ['geo_point', 'geo_shape'];
  const boolTypes = ['boolean'];
  
  if (numericTypes.includes(type)) return 'number';
  if (stringTypes.includes(type)) return 'string';
  if (dateTypes.includes(type)) return 'date';
  if (geoTypes.includes(type)) return 'geo';
  if (boolTypes.includes(type)) return 'boolean';
  return 'other';
}

export default router;
