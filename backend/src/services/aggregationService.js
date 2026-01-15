/**
 * Elasticsearch Aggregation Service
 * Builds and executes aggregations, transforms results for Vega consumption
 */

import { getElasticClient } from '../config/elasticsearch.js';

export class AggregationService {
  constructor(index) {
    this.index = index;
    this.client = getElasticClient();
  }

  /**
   * Available aggregation types
   */
  static getAggregationTypes() {
    return {
      bucket: [
        { id: 'terms', name: 'Terms', description: 'Group by field values', fieldTypes: ['keyword', 'text', 'boolean'] },
        { id: 'date_histogram', name: 'Date Histogram', description: 'Group by time intervals', fieldTypes: ['date'] },
        { id: 'histogram', name: 'Histogram', description: 'Group by numeric ranges', fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
        { id: 'range', name: 'Range', description: 'Custom numeric ranges', fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
        { id: 'date_range', name: 'Date Range', description: 'Custom date ranges', fieldTypes: ['date'] },
        { id: 'filters', name: 'Filters', description: 'Custom filter buckets', fieldTypes: ['any'] }
      ],
      metric: [
        { id: 'count', name: 'Count', description: 'Document count', fieldTypes: ['any'] },
        { id: 'sum', name: 'Sum', description: 'Sum of values', fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
        { id: 'avg', name: 'Average', description: 'Average value', fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
        { id: 'median', name: 'Median', description: 'Median (50th percentile)', fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
        { id: 'min', name: 'Minimum', description: 'Minimum value', fieldTypes: ['number', 'long', 'integer', 'double', 'float', 'date'] },
        { id: 'max', name: 'Maximum', description: 'Maximum value', fieldTypes: ['number', 'long', 'integer', 'double', 'float', 'date'] },
        { id: 'cardinality', name: 'Unique Count', description: 'Count of unique values', fieldTypes: ['any'] },
        { id: 'percentiles', name: 'Percentiles', description: 'Percentile distribution', fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
        { id: 'stats', name: 'Stats', description: 'Multiple statistics', fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
        { id: 'extended_stats', name: 'Extended Stats', description: 'Extended statistics', fieldTypes: ['number', 'long', 'integer', 'double', 'float'] }
      ]
    };
  }

  /**
   * Date histogram intervals - aligned with Elasticsearch spec
   * Supports both calendar_interval (variable length) and fixed_interval (exact)
   * See: https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-datehistogram-aggregation.html
   */
  static getDateIntervals() {
    return {
      // Calendar intervals - variable length based on calendar (e.g., months have different days)
      calendar: [
        { id: 'minute', name: 'Minute', description: 'Per minute' },
        { id: 'hour', name: 'Hour', description: 'Per hour' },
        { id: 'day', name: 'Day', description: 'Per day' },
        { id: 'week', name: 'Week', description: 'Per week (starts Monday)' },
        { id: 'month', name: 'Month', description: 'Per calendar month' },
        { id: 'quarter', name: 'Quarter', description: 'Per quarter (3 months)' },
        { id: 'year', name: 'Year', description: 'Per calendar year' }
      ],
      // Fixed intervals - exact duration (use for sub-day granularity)
      fixed: [
        { id: '1s', name: '1 Second', ms: 1000 },
        { id: '5s', name: '5 Seconds', ms: 5000 },
        { id: '10s', name: '10 Seconds', ms: 10000 },
        { id: '30s', name: '30 Seconds', ms: 30000 },
        { id: '1m', name: '1 Minute', ms: 60000 },
        { id: '5m', name: '5 Minutes', ms: 300000 },
        { id: '10m', name: '10 Minutes', ms: 600000 },
        { id: '15m', name: '15 Minutes', ms: 900000 },
        { id: '30m', name: '30 Minutes', ms: 1800000 },
        { id: '1h', name: '1 Hour', ms: 3600000 },
        { id: '3h', name: '3 Hours', ms: 10800000 },
        { id: '6h', name: '6 Hours', ms: 21600000 },
        { id: '12h', name: '12 Hours', ms: 43200000 },
        { id: '1d', name: '1 Day', ms: 86400000 },
        { id: '7d', name: '7 Days', ms: 604800000 }
      ],
      // Common presets combining both types
      presets: [
        { id: 'auto', name: 'Auto (recommended)', description: 'Automatically select based on time range' },
        { id: 'second', name: 'Per Second', intervalType: 'fixed', interval: '1s' },
        { id: 'minute', name: 'Per Minute', intervalType: 'calendar', interval: 'minute' },
        { id: '5min', name: 'Every 5 Minutes', intervalType: 'fixed', interval: '5m' },
        { id: '15min', name: 'Every 15 Minutes', intervalType: 'fixed', interval: '15m' },
        { id: '30min', name: 'Every 30 Minutes', intervalType: 'fixed', interval: '30m' },
        { id: 'hourly', name: 'Hourly', intervalType: 'calendar', interval: 'hour' },
        { id: '3hour', name: 'Every 3 Hours', intervalType: 'fixed', interval: '3h' },
        { id: '6hour', name: 'Every 6 Hours', intervalType: 'fixed', interval: '6h' },
        { id: '12hour', name: 'Every 12 Hours', intervalType: 'fixed', interval: '12h' },
        { id: 'daily', name: 'Daily', intervalType: 'calendar', interval: 'day' },
        { id: 'weekly', name: 'Weekly', intervalType: 'calendar', interval: 'week' },
        { id: 'monthly', name: 'Monthly', intervalType: 'calendar', interval: 'month' },
        { id: 'quarterly', name: 'Quarterly', intervalType: 'calendar', interval: 'quarter' },
        { id: 'yearly', name: 'Yearly', intervalType: 'calendar', interval: 'year' }
      ]
    };
  }

  /**
   * Auto-calculate optimal interval based on time range
   * @param {number} rangeMs - Time range in milliseconds
   * @param {number} targetBuckets - Target number of buckets (default 50-100)
   */
  static calculateAutoInterval(rangeMs, targetBuckets = 75) {
    const idealIntervalMs = rangeMs / targetBuckets;
    const fixed = this.getDateIntervals().fixed;
    
    // Find the closest fixed interval
    let bestInterval = fixed[0];
    for (const interval of fixed) {
      if (interval.ms <= idealIntervalMs) {
        bestInterval = interval;
      } else {
        break;
      }
    }
    
    // For very long ranges, use calendar intervals
    if (idealIntervalMs > 604800000) { // > 7 days
      if (idealIntervalMs > 31536000000) return { type: 'calendar', interval: 'year' };
      if (idealIntervalMs > 7776000000) return { type: 'calendar', interval: 'quarter' };
      if (idealIntervalMs > 2592000000) return { type: 'calendar', interval: 'month' };
      return { type: 'calendar', interval: 'week' };
    }
    
    return { type: 'fixed', interval: bestInterval.id };
  }

  /**
   * Validate time field configuration
   * @param {string} fieldType - The Elasticsearch field type
   * @param {object} options - The aggregation options
   */
  static validateTimeFieldConfig(fieldType, options = {}) {
    const errors = [];
    const warnings = [];
    const suggestions = [];
    
    // Check if field is a date type
    const dateTypes = ['date', 'date_nanos'];
    const isDateField = dateTypes.includes(fieldType);
    
    if (!isDateField) {
      errors.push(`Field type '${fieldType}' is not a date type. Expected: ${dateTypes.join(', ')}`);
      suggestions.push('Select a field with a date type for time-based aggregations');
    }
    
    // Validate interval
    if (options.interval) {
      const intervals = this.getDateIntervals();
      const calendarIds = intervals.calendar.map(i => i.id);
      const fixedIds = intervals.fixed.map(i => i.id);
      
      const isCalendar = calendarIds.includes(options.interval);
      const isFixed = fixedIds.includes(options.interval);
      
      if (!isCalendar && !isFixed && options.interval !== 'auto') {
        errors.push(`Invalid interval '${options.interval}'`);
        suggestions.push(`Use one of: ${[...calendarIds, ...fixedIds].slice(0, 5).join(', ')}...`);
      }
      
      // Warn about calendar vs fixed
      if (options.intervalType === 'fixed' && isCalendar) {
        warnings.push(`'${options.interval}' is a calendar interval but fixed was specified`);
      }
      if (options.intervalType === 'calendar' && isFixed) {
        warnings.push(`'${options.interval}' is a fixed interval but calendar was specified`);
      }
    }
    
    // Validate timezone
    if (options.timeZone) {
      // Basic timezone validation (IANA format)
      const tzRegex = /^[A-Za-z_]+\/[A-Za-z_]+$|^UTC$|^[+-]\d{2}:\d{2}$/;
      if (!tzRegex.test(options.timeZone)) {
        warnings.push(`Timezone '${options.timeZone}' may not be valid. Use IANA format (e.g., 'America/New_York') or offset (e.g., '+05:00')`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      recommendedAggregation: isDateField ? 'date_histogram' : 'terms'
    };
  }

  /**
   * Get recommended aggregation type based on field type
   */
  static getRecommendedAggregation(fieldType) {
    const typeMap = {
      'date': { bucket: 'date_histogram', defaultInterval: 'day' },
      'date_nanos': { bucket: 'date_histogram', defaultInterval: 'hour' },
      'keyword': { bucket: 'terms', defaultSize: 25 },
      'text': { bucket: 'terms', defaultSize: 25, needsKeyword: true },
      'long': { bucket: 'histogram', defaultInterval: 10 },
      'integer': { bucket: 'histogram', defaultInterval: 10 },
      'double': { bucket: 'histogram', defaultInterval: 1 },
      'float': { bucket: 'histogram', defaultInterval: 1 },
      'boolean': { bucket: 'terms', defaultSize: 2 }
    };
    
    return typeMap[fieldType] || { bucket: 'terms', defaultSize: 25 };
  }

  /**
   * Build aggregation query from config
   * Supports both legacy single bucketAgg and new multi-level bucketAggs
   */
  buildAggregation(config) {
    const { bucketAgg, bucketAggs, metrics, splitBy, splitConfig } = config;
    const aggs = {};
    
    // Determine which bucket config to use (new array or legacy single)
    const effectiveBuckets = (bucketAggs && bucketAggs.length > 0) ? bucketAggs : (bucketAgg ? [bucketAgg] : []);
    
    if (effectiveBuckets.length === 0) {
      return aggs;
    }
    
    // Build nested bucket aggregations (multi-level hierarchy)
    // Each bucket level is nested inside the previous one
    const buildNestedAggs = (buckets, level = 0, parentAgg = null) => {
      if (level >= buckets.length) {
        // At the deepest level, add metrics
        return this.buildMetricAggs(metrics);
      }
      
      const bucket = buckets[level];
      const bucketKey = level === 0 ? 'primary' : `level_${level}`;
      const bucketConfig = this.buildBucketAgg(bucket);
      
      // Recursively build child aggregations
      const childAggs = buildNestedAggs(buckets, level + 1, bucketConfig);
      
      if (childAggs && Object.keys(childAggs).length > 0) {
        // IMPORTANT: Merge with existing aggs (e.g., order_metric from buildBucketAgg) instead of replacing
        bucketConfig.aggs = { ...bucketConfig.aggs, ...childAggs };
      }
      
      return { [bucketKey]: bucketConfig };
    };
    
    // Build the primary aggregation hierarchy
    Object.assign(aggs, buildNestedAggs(effectiveBuckets));
    
    // Handle split configuration (adds another nesting level for series/facets)
    if (splitBy || (splitConfig?.enabled && splitConfig?.field)) {
      const splitField = splitBy || splitConfig;
      const deepestLevel = effectiveBuckets.length - 1;
      const deepestKey = deepestLevel === 0 ? 'primary' : `level_${deepestLevel}`;
      
      // Find the deepest bucket and add split as a sub-aggregation
      const addSplitToDeepest = (aggObj, depth = 0) => {
        const key = depth === 0 ? 'primary' : `level_${depth}`;
        if (aggObj[key]) {
          if (depth === deepestLevel) {
            // Add split aggregation at the deepest level
            if (!aggObj[key].aggs) aggObj[key].aggs = {};
            aggObj[key].aggs.split = this.buildBucketAgg(splitField);
            // Copy metrics to split bucket
            const metricAggs = this.buildMetricAggs(metrics);
            if (Object.keys(metricAggs).length > 0) {
              aggObj[key].aggs.split.aggs = metricAggs;
            }
          } else if (aggObj[key].aggs) {
            addSplitToDeepest(aggObj[key].aggs, depth + 1);
          }
        }
      };
      
      addSplitToDeepest(aggs);
    }

    return aggs;
  }
  
  /**
   * Build metric aggregations object
   */
  buildMetricAggs(metrics) {
    const metricAggs = {};
    if (metrics && metrics.length > 0) {
      metrics.forEach((metric, idx) => {
        const metricAgg = this.buildMetricAgg(metric);
        if (metricAgg) {
          const metricKey = metric.id || `metric_${idx}`;
          metricAggs[metricKey] = metricAgg;
        }
      });
    }
    return metricAggs;
  }

  /**
   * Build bucket aggregation with enhanced ordering support
   * Supports orderBy: '_count' | '_key' | 'metric_X' (order by sub-aggregation)
   * Supports orderDirection: 'asc' | 'desc'
   * Supports orderMetric: { type, field } for custom metric ordering
   */
  buildBucketAgg(config) {
    const { type, field, options = {} } = config;
    
    // Debug: log incoming order configuration
    if (config.orderBy || options.orderBy) {
      console.log('[AggregationService] Order config:', {
        type,
        field,
        orderBy: config.orderBy || options.orderBy,
        orderDirection: config.orderDirection || options.orderDirection,
        orderMetric: config.orderMetric,
        orderMetricType: options.orderMetricType,
        orderMetricField: options.orderMetricField
      });
    }
    
    // Build order configuration
    const buildOrder = (config) => {
      const orderBy = config.orderBy || options.orderBy || '_count';
      const orderDirection = config.orderDirection || options.orderDirection || 'desc';
      
      // If ordering by a custom metric, check if we have the metric config
      // Only use order_metric if we actually have the metric defined, otherwise fallback to _count
      if (orderBy === 'custom_metric' || orderBy === 'order_metric') {
        const orderMetric = config.orderMetric || options.orderMetric;
        const hasValidMetric = orderMetric && (orderMetric.field || options.orderMetricField);
        if (hasValidMetric) {
          // This will reference the order_metric sub-aggregation we add
          return { order_metric: orderDirection };
        }
        // Fallback to _count if no valid metric configured
        return { _count: orderDirection };
      }
      
      // If ordering by a specific metric index (e.g., metric_0)
      if (orderBy.startsWith('metric_')) {
        return { [orderBy]: orderDirection };
      }
      
      // Standard ordering: _count or _key
      return { [orderBy]: orderDirection };
    };

    switch (type) {
      case 'terms': {
        const termsConfig = {
          field,
          size: options.size || 25,
          order: buildOrder(config),
          ...(options.minDocCount !== undefined && { min_doc_count: options.minDocCount }),
          ...(options.missing !== undefined && { missing: options.missing })
        };
        
        // If ordering by a custom metric, add it as a sub-aggregation
        const result = { terms: termsConfig };
        const orderBy = config.orderBy || options.orderBy || '_count';
        const orderMetric = config.orderMetric || options.orderMetric;
        
        // Support both 'custom_metric' and 'order_metric' as aliases
        if (orderMetric && (orderBy === 'order_metric' || orderBy === 'custom_metric')) {
          // Build the metric aggregation for ordering
          const metricConfig = typeof orderMetric === 'object' ? orderMetric : {
            type: options.orderMetricType || 'sum',
            field: options.orderMetricField || orderMetric
          };
          
          const builtMetricAgg = this.buildMetricAgg(metricConfig);
          
          result.aggs = {
            order_metric: builtMetricAgg
          };
          result.terms.order = { order_metric: config.orderDirection || options.orderDirection || 'desc' };
        }
        
        return result;
      }

      case 'multi_terms':
        // For Sankey and similar charts that need to group by multiple fields
        return {
          multi_terms: {
            terms: (options.fields || [field]).map(f => ({ field: f })),
            size: options.size || 100,
            order: buildOrder(config)
          }
        };

      case 'date_histogram': {
        // Determine if using calendar or fixed interval
        const intervals = AggregationService.getDateIntervals();
        const calendarIds = intervals.calendar.map(i => i.id);
        let interval = options.interval || 'day';
        
        // Handle 'auto' interval - calculate based on timeRange or default to 'day'
        let resolvedInterval = interval;
        let intervalType = 'calendar'; // Default to calendar
        
        if (interval === 'auto') {
          if (options.timeRange) {
            const auto = AggregationService.calculateAutoInterval(options.timeRange);
            resolvedInterval = auto.interval;
            intervalType = auto.type;
          } else {
            // Default to 'day' if auto but no time range provided
            resolvedInterval = 'day';
            intervalType = 'calendar';
          }
        } else {
          // Check if the interval is a calendar interval
          const isCalendarInterval = calendarIds.includes(interval) || options.intervalType === 'calendar';
          intervalType = isCalendarInterval ? 'calendar' : 'fixed';
        }
        
        // Build the aggregation with correct interval type
        const dateHistogramConfig = {
          field,
          format: options.format || 'yyyy-MM-dd\'T\'HH:mm:ss',
          min_doc_count: options.minDocCount ?? 0
        };
        
        // Use calendar_interval or fixed_interval based on type
        if (intervalType === 'calendar') {
          dateHistogramConfig.calendar_interval = resolvedInterval;
        } else {
          dateHistogramConfig.fixed_interval = resolvedInterval;
        }
        
        // Add optional settings
        if (options.timeZone) {
          dateHistogramConfig.time_zone = options.timeZone;
        }
        if (options.offset) {
          dateHistogramConfig.offset = options.offset;
        }
        if (options.extendedBounds) {
          dateHistogramConfig.extended_bounds = options.extendedBounds;
        }
        if (options.keyed !== undefined) {
          dateHistogramConfig.keyed = options.keyed;
        }
        
        return { date_histogram: dateHistogramConfig };
      }

      case 'histogram':
        return {
          histogram: {
            field,
            interval: options.interval || 10,
            min_doc_count: options.minDocCount ?? 0
          }
        };

      case 'range':
        return {
          range: {
            field,
            ranges: options.ranges || [
              { to: 50 },
              { from: 50, to: 100 },
              { from: 100 }
            ]
          }
        };

      case 'date_range':
        return {
          date_range: {
            field,
            format: options.format || 'yyyy-MM-dd',
            ranges: options.ranges || [
              { to: 'now-1M' },
              { from: 'now-1M', to: 'now' }
            ]
          }
        };

      default:
        throw new Error(`Unknown bucket aggregation type: ${type}`);
    }
  }

  /**
   * Build metric aggregation
   */
  buildMetricAgg(config) {
    const { type, field, options = {} } = config;

    switch (type) {
      case 'count':
        // For count, we don't need a metric aggregation - doc_count is automatic
        // But if they really want a specific field count, use value_count
        if (field && field !== '_id') {
          return { value_count: { field } };
        }
        // Return null to skip this metric (use doc_count instead)
        return null;

      case 'sum':
        return { sum: { field } };

      case 'avg':
        return { avg: { field } };

      case 'min':
        return { min: { field } };

      case 'max':
        return { max: { field } };

      case 'cardinality':
        return { 
          cardinality: { 
            field,
            precision_threshold: options.precisionThreshold || 3000
          } 
        };

      case 'median':
        // Median is the 50th percentile
        return {
          percentiles: {
            field,
            percents: [50]
          }
        };

      case 'percentiles':
        return {
          percentiles: {
            field,
            percents: options.percents || [25, 50, 75, 95, 99]
          }
        };

      case 'stats':
        return { stats: { field } };

      case 'extended_stats':
        return { extended_stats: { field } };

      default:
        throw new Error(`Unknown metric aggregation type: ${type}`);
    }
  }

  /**
   * Execute aggregation and transform for Vega
   */
  async execute(config) {
    const { query, size = 0 } = config;
    const aggs = this.buildAggregation(config);

    const response = await this.client.search({
      index: this.index,
      size,
      query: query || { match_all: {} },
      aggs
    });

    return this.transformForVega(response.aggregations, config);
  }

  /**
   * Transform ES aggregation results for Vega consumption
   * Supports multi-level nested bucket aggregations
   */
  transformForVega(aggregations, config) {
    if (!aggregations?.primary) {
      return [];
    }

    const { bucketAgg, bucketAggs, metrics = [], splitBy, splitConfig } = config;
    
    // Determine effective bucket configs
    const effectiveBuckets = (bucketAggs && bucketAggs.length > 0) ? bucketAggs : (bucketAgg ? [bucketAgg] : []);
    
    if (effectiveBuckets.length === 0) {
      return [];
    }
    
    const data = [];
    
    /**
     * Recursively process nested bucket aggregations
     * @param {Object} bucket - Current bucket from ES response
     * @param {number} level - Current nesting level
     * @param {Object} parentRecord - Accumulated fields from parent levels
     */
    const processBucket = (bucket, level, parentRecord = {}) => {
      const bucketConfig = effectiveBuckets[level];
      if (!bucketConfig) return;
      
      // Build record for this level
      let record = { ...parentRecord, _count: bucket.doc_count };
      
      // Handle multi_terms aggregation (key is an array)
      if (bucketConfig.type === 'multi_terms' && Array.isArray(bucket.key)) {
        const fields = bucketConfig.options?.fields || [];
        bucket.key.forEach((keyValue, idx) => {
          const rawFieldName = fields[idx] || `field_${idx}`;
          const safeFieldName = rawFieldName.replace(/\./g, '_');
          record[safeFieldName] = this.formatBucketKey(keyValue, 'terms');
        });
        if (bucket.key_as_string) {
          record._key = bucket.key_as_string;
        }
      } else {
        // Standard bucket - sanitize field name
        const rawFieldName = bucketConfig.as || bucketConfig.field;
        const safeFieldName = rawFieldName.replace(/\./g, '_');
        record[safeFieldName] = this.formatBucketKey(bucket.key, bucketConfig.type);
      }
      
      // Check if there are more nested levels
      const nextLevelKey = level === 0 ? 'level_1' : `level_${level + 1}`;
      const hasNextLevel = level + 1 < effectiveBuckets.length && bucket[nextLevelKey]?.buckets;
      
      if (hasNextLevel) {
        // Recurse into nested buckets
        for (const nestedBucket of bucket[nextLevelKey].buckets) {
          processBucket(nestedBucket, level + 1, record);
        }
      } else {
        // At the deepest level - add metrics and handle split
        this.addMetricsToRecord(record, bucket, metrics);
        
        // Handle split (series/facets) at the deepest level
        const effectiveSplit = splitBy || (splitConfig?.enabled ? splitConfig : null);
        if (effectiveSplit && bucket.split?.buckets) {
          const splitFieldName = (effectiveSplit.as || effectiveSplit.field).replace(/\./g, '_');
          
          for (const splitBucket of bucket.split.buckets) {
            const splitRecord = {
              ...record,
              [splitFieldName]: this.formatBucketKey(splitBucket.key, effectiveSplit.type || 'terms'),
              _split_count: splitBucket.doc_count
            };
            this.addMetricsToRecord(splitRecord, splitBucket, metrics);
            data.push(splitRecord);
          }
        } else {
          // No split - just add the record
          data.push(record);
        }
      }
    };
    
    // Start processing from the primary bucket
    const primaryBuckets = aggregations.primary.buckets || [];
    for (const bucket of primaryBuckets) {
      processBucket(bucket, 0, {});
    }

    // Add composite key for multi-level buckets (concatenate all bucket values)
    // This creates labels like "Men's Clothing - MALE" for the X-axis
    if (effectiveBuckets.length > 1 && data.length > 0) {
      const bucketFieldNames = effectiveBuckets.map(b => (b.as || b.field).replace(/\./g, '_'));
      for (const record of data) {
        const keyParts = bucketFieldNames.map(f => record[f] || '').filter(v => v !== '');
        record._composite_key = keyParts.join(' - ');
      }
    }

    return data;
  }
  
  /**
   * Add metric values to a record
   */
  addMetricsToRecord(record, bucket, metrics) {
    if (!metrics || metrics.length === 0) return;
    
    metrics.forEach((metric, idx) => {
      const metricKey = metric.id || `metric_${idx}`;
      const metricResult = bucket[metricKey];
      
      if (!metric.field) return;
      
      const safeFieldName = metric.field.replace(/\./g, '_');
      const fieldName = metric.as || `${metric.type}_${safeFieldName}`;
      
      if (metricResult) {
        if (metric.type === 'median') {
          // Median is 50th percentile
          record[fieldName] = metricResult.values?.['50.0'] ?? metricResult.values?.[50] ?? null;
        } else if (metric.type === 'percentiles') {
          record[fieldName] = metricResult.values;
        } else if (metric.type === 'stats' || metric.type === 'extended_stats') {
          Object.assign(record, metricResult);
        } else if (metricResult.value !== undefined) {
          record[fieldName] = metricResult.value;
        }
      }
    });
  }

  /**
   * Format bucket key based on aggregation type
   */
  formatBucketKey(key, type) {
    if (type === 'date_histogram' || type === 'date_range') {
      return new Date(key).toISOString();
    }
    return key;
  }
}

export default AggregationService;

