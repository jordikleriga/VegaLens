import { Router } from 'express';
import { AggregationService } from '../services/aggregationService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../middleware/logger.js';
import { getClientForRequest } from '../middleware/connectionMiddleware.js';

const router = Router();

/**
 * Helper to get ES client for a request
 * Uses user-provided credentials from headers, or falls back to env config
 */
function getClient(req) {
  return getClientForRequest(req);
}

// Get available aggregation types
router.get('/types', (req, res) => {
  const types = AggregationService.getAggregationTypes();
  logger.debug('Fetched aggregation types', { bucketTypes: types.bucket?.length || 0, metricTypes: types.metric?.length || 0 });
  res.json(types);
});

// Get date histogram intervals (full specification)
router.get('/date-intervals', (req, res) => {
  const intervals = AggregationService.getDateIntervals();
  logger.debug('Fetched date intervals', { calendar: intervals.calendar?.length || 0, fixed: intervals.fixed?.length || 0 });
  res.json(intervals);
});

// Get time interval presets (simplified list for UI dropdowns)
router.get('/time-intervals', (req, res) => {
  const intervals = AggregationService.getDateIntervals();
  logger.debug('Fetched time interval presets', { presetsCount: intervals.presets?.length || 0 });
  res.json({
    presets: intervals.presets,
    calendar: intervals.calendar,
    fixed: intervals.fixed
  });
});

// Validate time field configuration
router.post('/validate-time-field', (req, res) => {
  const { fieldType, options } = req.body;
  
  if (!fieldType) {
    return res.status(400).json({ 
      error: 'Field type is required',
      valid: false 
    });
  }
  
  const validation = AggregationService.validateTimeFieldConfig(fieldType, options || {});
  res.json(validation);
});

// Calculate auto-interval based on time range
router.post('/auto-interval', (req, res) => {
  const { rangeMs, targetBuckets } = req.body;
  
  if (!rangeMs || rangeMs <= 0) {
    return res.status(400).json({ 
      error: 'rangeMs (time range in milliseconds) is required and must be positive',
      valid: false 
    });
  }
  
  const autoInterval = AggregationService.calculateAutoInterval(
    rangeMs, 
    targetBuckets || 75
  );
  
  // Also return human-readable info
  const intervals = AggregationService.getDateIntervals();
  let intervalInfo = null;
  
  if (autoInterval.type === 'fixed') {
    intervalInfo = intervals.fixed.find(i => i.id === autoInterval.interval);
  } else {
    intervalInfo = intervals.calendar.find(i => i.id === autoInterval.interval);
  }
  
  res.json({
    ...autoInterval,
    name: intervalInfo?.name || autoInterval.interval,
    description: intervalInfo?.description,
    rangeMs,
    targetBuckets: targetBuckets || 75
  });
});

// Get recommended aggregation type for a field type
router.get('/recommended/:fieldType', (req, res) => {
  const { fieldType } = req.params;
  const recommendation = AggregationService.getRecommendedAggregation(fieldType);
  res.json({
    fieldType,
    recommendation
  });
});

// Execute aggregation and get Vega-ready data
router.post('/execute', async (req, res, next) => {
  try {
    const { index, config } = req.body;
    
    // Validation
    if (!index) {
      throw new AppError('Index is required', 400);
    }
    
    if (!config) {
      throw new AppError('Aggregation config is required', 400);
    }
    
    // Support both legacy single bucketAgg and new multi-level bucketAggs array
    const hasBuckets = config.bucketAgg || (config.bucketAggs && config.bucketAggs.length > 0);
    if (!hasBuckets) {
      throw new AppError('Bucket aggregation configuration is required', 400);
    }
    
    // Get effective first bucket for validation
    const effectiveBucket = config.bucketAgg || config.bucketAggs[0];
    if (!effectiveBucket.type) {
      throw new AppError('Bucket aggregation type is required', 400);
    }
    if (!effectiveBucket.field) {
      throw new AppError('Bucket aggregation field is required', 400);
    }
    
    // Validate all bucket levels if using multi-level
    if (config.bucketAggs && config.bucketAggs.length > 1) {
      config.bucketAggs.forEach((bucket, idx) => {
        if (!bucket.type) {
          throw new AppError(`Bucket level ${idx + 1} is missing type`, 400);
        }
        if (!bucket.field) {
          throw new AppError(`Bucket level ${idx + 1} is missing field`, 400);
        }
      });
    }
    
    logger.info('Executing aggregation', {
      index,
      bucketLevels: config.bucketAggs?.length || 1,
      bucketType: effectiveBucket.type,
      bucketField: effectiveBucket.field,
      bucketOptions: JSON.stringify(effectiveBucket.options || {}),
      orderBy: effectiveBucket.orderBy || effectiveBucket.options?.orderBy || '_count',
      orderDirection: effectiveBucket.orderDirection || effectiveBucket.options?.orderDirection || 'desc',
      metricsCount: config.metrics?.length || 0,
      hasSplit: !!config.splitBy || !!config.splitConfig?.enabled
    });
    
    const service = new AggregationService(index, getClient(req));
    const data = await service.execute(config);

    logger.info('Aggregation completed', { 
      index, 
      bucketCount: data.length,
      sampleFields: data.length > 0 ? Object.keys(data[0]) : []
    });
    
    res.json({
      success: true,
      count: data.length,
      data,
      _meta: {
        index,
        bucketField: config.bucketAgg.field,
        bucketType: config.bucketAgg.type,
        fields: data.length > 0 ? Object.keys(data[0]) : []
      }
    });
  } catch (error) {
    logger.error('Aggregation failed', { 
      error: error.message,
      index: req.body?.index,
      config: req.body?.config
    });
    
    // Handle Elasticsearch specific errors with cleaner messages
    if (error.meta?.body?.error) {
      const esError = error.meta.body.error;
      let message = esError.reason || esError.type || 'Elasticsearch error';
      let suggestion = null;
      
      // Check for nested root causes (common in Elasticsearch errors)
      const rootCause = esError.root_cause?.[0];
      if (rootCause?.reason) {
        message = rootCause.reason;
      }
      
      // Check for fielddata error
      if (message.includes('Fielddata is disabled')) {
        const fieldMatch = message.match(/on \[([^\]]+)\]/);
        const fieldName = fieldMatch ? fieldMatch[1] : 'field';
        message = `Cannot aggregate on text field "${fieldName}"`;
        suggestion = 'Text fields cannot be aggregated. Select a keyword field instead, or use the .keyword subfield if available.';
      }
      
      // Check for field not found
      if (esError.type === 'illegal_argument_exception' && message.includes('not found')) {
        message = 'Field not found in index';
        suggestion = 'Make sure the field name is correct and exists in your Elasticsearch index mapping.';
      }
      
      // Check for mapping issues
      if (message.includes('No mapping found')) {
        suggestion = 'The specified field does not have a mapping in this index.';
      }
      
      // Check for all shards failed (often means query/mapping issue)
      if (message.includes('all shards failed') || esError.type === 'search_phase_execution_exception') {
        const failedShardReason = esError.failed_shards?.[0]?.reason?.reason;
        if (failedShardReason) {
          message = failedShardReason;
          // Re-check for common patterns in the shard reason
          if (message.includes('Fielddata is disabled')) {
            const fieldMatch = message.match(/on \[([^\]]+)\]/);
            const fieldName = fieldMatch ? fieldMatch[1] : req.body?.config?.bucketAgg?.field;
            message = `Cannot aggregate on text field "${fieldName}"`;
            suggestion = 'Text fields cannot be aggregated directly. Use a ".keyword" subfield or choose a keyword field.';
          }
        } else {
          suggestion = 'Check that the field exists and is aggregatable.';
        }
      }
      
      return res.status(400).json({
        error: 'Aggregation Error',
        message,
        suggestion,
        details: {
          field: req.body?.config?.bucketAgg?.field,
          type: req.body?.config?.bucketAgg?.type,
          esErrorType: esError.type
        }
      });
    }
    next(error);
  }
});

// Preview aggregation query (without executing)
router.post('/preview-query', (req, res, next) => {
  try {
    const { index, config } = req.body;
    
    if (!index || !config) {
      throw new AppError('Index and config are required', 400);
    }
    
    const service = new AggregationService(index, getClient(req));
    const aggs = service.buildAggregation(config);
    
    res.json({
      index,
      size: config.size || 0,
      query: config.query || { match_all: {} },
      aggs
    });
  } catch (error) {
    next(error);
  }
});

export default router;

