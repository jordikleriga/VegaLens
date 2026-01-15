/**
 * Vega Generator Base Class
 * Provides shared utilities for all chart generators
 */

import { logger } from './utils/logger.js';

export class VegaGeneratorBase {
  // Centralized color and style defaults for consistency across all methods
  static DEFAULTS = {
    colorScheme: 'category10',
    singleColor: '#0ea5e9',
    strokeColor: '#ffffff',
    kibanaStrokeColor: '#1e293b',  // Darker stroke for Kibana visibility
    gradientStart: '#0ea5e9',
    gradientEnd: '#f97316',
    opacity: 1,
    strokeWidth: 1,
    cornerRadius: 3,
    // Axis styling defaults for Kibana dark theme
    axisColor: '#64748b',
    axisLabelColor: '#94a3b8',
    axisTitleColor: '#e2e8f0'
  };

  // Map frontend/Elasticsearch aggregation names to valid Vega aggregate operations
  static aggregationMap = {
    'sum': 'sum',
    'avg': 'average',
    'average': 'average',
    'mean': 'mean',
    'count': 'count',
    'min': 'min',
    'max': 'max',
    'median': 'median',
    'variance': 'variance',
    'stdev': 'stdev',
    'distinct': 'distinct',
    'valid': 'valid',
    'missing': 'missing'
  };

  /**
   * Get valid Vega aggregate operation from various input formats
   */
  static getVegaAggregateOp(op) {
    if (!op) return 'sum';
    const normalized = op.toLowerCase();
    return VegaGeneratorBase.aggregationMap[normalized] || 'sum';
  }

  constructor(type, config = {}) {
    this.type = type;
    this.config = {
      width: 600,
      height: 400,
      title: '',
      theme: 'default',
      ...config
    };
    
    // Color configuration - use centralized defaults
    const D = VegaGeneratorBase.DEFAULTS;
    this.colorConfig = config.colorConfig || {
      scheme: D.colorScheme,
      singleColor: D.singleColor,
      opacity: D.opacity,
      strokeColor: D.strokeColor,
      strokeWidth: D.strokeWidth,
      useGradient: false,
      gradientStart: D.gradientStart,
      gradientEnd: D.gradientEnd,
      customColors: null
    };

    logger.debug('VegaGeneratorBase initialized', {
      event: 'generator_init',
      chartType: type,
      configKeys: Object.keys(config)
    });
  }

  /**
   * Resolve a field path to the actual key in the data
   * Handles:
   * - Direct match: "category" -> "category"  
   * - Sanitized dots: "category.keyword" -> "category_keyword" (aggregated data)
   * - Base field: "category.keyword" -> "category" (raw sample data)
   */
  resolveFieldPath(fieldPath, data) {
    if (!fieldPath || !data || !Array.isArray(data) || data.length === 0) {
      return fieldPath;
    }
    
    const sampleRecord = data[0];
    
    // Direct match
    if (fieldPath in sampleRecord) return fieldPath;
    
    // Check for sanitized version (dots replaced with underscores)
    const sanitizedField = fieldPath.replace(/\./g, '_');
    if (sanitizedField in sampleRecord) return sanitizedField;
    
    // Handle .keyword suffix - try without it (for raw sample data)
    if (fieldPath.endsWith('.keyword')) {
      const baseField = fieldPath.replace(/\.keyword$/, '');
      if (baseField in sampleRecord) return baseField;
    }
    
    // Handle nested paths (e.g., "user.name")
    const parts = fieldPath.split('.');
    if (parts.length > 1) {
      let current = sampleRecord;
      let resolvedPath = [];
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          resolvedPath.push(part);
          current = current[part];
        } else {
          break;
        }
      }
      // Only return resolved path if ALL segments matched
      if (resolvedPath.length === parts.length) {
        return resolvedPath.join('.');
      }

      // Try double-underscore sanitization (common in Elasticsearch flattened fields)
      const doubleUnderscoreSanitized = fieldPath.replace(/\./g, '__');
      if (doubleUnderscoreSanitized in sampleRecord) {
        return doubleUnderscoreSanitized;
      }
    }

    // Fall back to original path - let Vega handle the error if field doesn't exist
    return fieldPath;
  }
  
  /**
   * Validate an array of color values
   * Accepts hex colors (#RGB, #RRGGBB) and rgb/rgba functions
   * Returns only valid colors, logs warnings for invalid ones
   */
  validateColors(colors) {
    if (!colors || !Array.isArray(colors)) return [];

    // Patterns for valid color formats
    const validColorPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$|^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/;

    const validColors = [];
    const invalidColors = [];

    for (const color of colors) {
      if (typeof color === 'string' && validColorPattern.test(color.trim())) {
        validColors.push(color.trim());
      } else {
        invalidColors.push(color);
      }
    }

    if (invalidColors.length > 0) {
      logger.warn('Invalid custom colors removed', {
        event: 'color_validation',
        invalid: invalidColors,
        validCount: validColors.length
      });
    }

    return validColors;
  }

  // Get color scale configuration
  getColorScale(fieldName) {
    const { scheme, customColors } = this.colorConfig;
    const colorScheme = this.config.colorScheme || scheme || VegaGeneratorBase.DEFAULTS.colorScheme;

    if (customColors && customColors.length > 0) {
      const validatedColors = this.validateColors(customColors);
      if (validatedColors.length > 0) {
        return {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'source', field: fieldName },
          range: validatedColors
        };
      }
      // Fall through to scheme if no valid custom colors
    }

    return {
      name: 'color',
      type: 'ordinal',
      domain: { data: 'source', field: fieldName },
      range: { scheme: colorScheme }
    };
  }

  // Get custom label for X-axis (falls back to field name)
  getXLabel(fieldName) {
    return this.config.xLabel || fieldName || 'X-Axis';
  }

  // Get custom label for Y-axis (falls back to field name)
  getYLabel(fieldName) {
    return this.config.yLabel || fieldName || 'Y-Axis';
  }

  // Get custom label for Legend (falls back to field name)
  getLegendLabel(fieldName) {
    return this.config.legendLabel || fieldName || 'Legend';
  }

  // Get fill color for marks
  getFillColor(fieldName = null) {
    const { singleColor, useGradient } = this.colorConfig;
    
    if (fieldName) {
      return {
        scale: 'color',
        field: fieldName
      };
    }
    
    if (useGradient) {
      return { value: singleColor };
    }
    
    return { value: singleColor || VegaGeneratorBase.DEFAULTS.singleColor };
  }

  // Get gradient definitions for the spec
  getGradientDefs() {
    if (!this.colorConfig.useGradient) return [];
    
    const { gradientStart, gradientEnd } = this.colorConfig;
    return [
      {
        name: 'gradient',
        type: 'linearGradient',
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 1,
        stops: [
          { offset: 0, color: gradientStart || VegaGeneratorBase.DEFAULTS.gradientStart },
          { offset: 1, color: gradientEnd || VegaGeneratorBase.DEFAULTS.gradientEnd }
        ]
      }
    ];
  }

  // Get stroke properties
  getStrokeProps() {
    const { strokeColor, strokeWidth } = this.colorConfig;
    return {
      stroke: { value: strokeColor || VegaGeneratorBase.DEFAULTS.strokeColor },
      strokeWidth: { value: strokeWidth ?? VegaGeneratorBase.DEFAULTS.strokeWidth }
    };
  }

  // Get opacity
  getOpacity() {
    return this.colorConfig.opacity ?? VegaGeneratorBase.DEFAULTS.opacity;
  }

  // Get the color scheme for Kibana specs
  getKibanaColorScheme() {
    return this.config.colorScheme || this.colorConfig?.scheme || VegaGeneratorBase.DEFAULTS.colorScheme;
  }

  // Get common Kibana style configuration
  // Returns values that should be used consistently across all Kibana specs
  getKibanaStyleConfig() {
    const opacity = this.getOpacity();
    const { strokeColor, strokeWidth } = this.colorConfig;
    const D = VegaGeneratorBase.DEFAULTS;
    return {
      colorScheme: this.getKibanaColorScheme(),
      opacity: opacity,
      hoverOpacity: Math.max(0.5, opacity - 0.2),
      strokeColor: strokeColor || D.kibanaStrokeColor,
      strokeWidth: strokeWidth ?? D.strokeWidth,
      cornerRadius: this.config.cornerRadius ?? D.cornerRadius
    };
  }

  // Get stroke properties for Kibana (uses darker default stroke for visibility)
  getKibanaStrokeProps() {
    const { strokeColor, strokeWidth } = this.colorConfig;
    const D = VegaGeneratorBase.DEFAULTS;
    return {
      stroke: { value: strokeColor || D.kibanaStrokeColor },
      strokeWidth: { value: strokeWidth ?? D.strokeWidth }
    };
  }

  // Get axis styling configuration for Kibana dark theme
  // Use this in generateForKibana() config.axis to ensure consistent styling
  getAxisStyleConfig() {
    const D = VegaGeneratorBase.DEFAULTS;
    return {
      domainColor: D.axisColor,
      tickColor: D.axisColor,
      labelColor: D.axisLabelColor,
      titleColor: D.axisTitleColor
    };
  }

  // Detect if a field contains temporal/date values
  // Uses multiple samples and stricter patterns to avoid false positives
  isTemporalField(data, fieldName) {
    if (!data || !data.length || !fieldName) return false;

    // Check multiple samples for more reliable detection
    const sampleSize = Math.min(10, data.length);
    const samples = data.slice(0, sampleSize).map(d => d[fieldName]).filter(v => v != null);

    if (samples.length === 0) return false;

    // If any sample is a Date object, it's temporal
    if (samples.some(s => s instanceof Date)) return true;

    // Stricter date patterns to avoid matching product IDs, account numbers, etc.
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/,                    // ISO date: 2024-01-15
      /^\d{4}-\d{2}$/,                          // Year-month: 2024-01
      /^(19|20)\d{2}$/,                         // Years 1900-2099 only (not any 4-digit number)
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i,  // Month names
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,           // US date format with anchors
      /^\d{1,2}-\d{1,2}-\d{2,4}$/,             // European date format with anchors
    ];

    // Require at least 80% of samples to match a date pattern
    const matchThreshold = Math.ceil(samples.length * 0.8);
    let matchCount = 0;

    for (const sample of samples) {
      const sampleStr = String(sample);
      if (datePatterns.some(pattern => pattern.test(sampleStr))) {
        matchCount++;
      }
    }

    return matchCount >= matchThreshold;
  }

  // Parse temporal value for sorting
  parseTemporalValue(value) {
    if (value instanceof Date) return value.getTime();
    
    const str = String(value);
    
    const monthOrder = {
      'jan': 1, 'january': 1, '01': 1, '1': 1,
      'feb': 2, 'february': 2, '02': 2, '2': 2,
      'mar': 3, 'march': 3, '03': 3, '3': 3,
      'apr': 4, 'april': 4, '04': 4, '4': 4,
      'may': 5, '05': 5, '5': 5,
      'jun': 6, 'june': 6, '06': 6, '6': 6,
      'jul': 7, 'july': 7, '07': 7, '7': 7,
      'aug': 8, 'august': 8, '08': 8, '8': 8,
      'sep': 9, 'sept': 9, 'september': 9, '09': 9, '9': 9,
      'oct': 10, 'october': 10, '10': 10,
      'nov': 11, 'november': 11, '11': 11,
      'dec': 12, 'december': 12, '12': 12
    };
    
    const monthMatch = str.toLowerCase().match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)$/i);
    if (monthMatch) {
      return monthOrder[monthMatch[1].toLowerCase()] || 0;
    }
    
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) return parsed;
    
    const yearMonthMatch = str.match(/^(\d{4})-(\d{2})$/);
    if (yearMonthMatch) {
      return new Date(parseInt(yearMonthMatch[1]), parseInt(yearMonthMatch[2]) - 1).getTime();
    }
    
    const yearMatch = str.match(/^(\d{4})$/);
    if (yearMatch) {
      return parseInt(yearMatch[1]);
    }
    
    return 0;
  }

  // Sort data by temporal field
  sortDataByTemporalField(data, fieldName) {
    if (!data || !data.length || !fieldName) return data;
    
    return [...data].sort((a, b) => {
      const aVal = this.parseTemporalValue(a[fieldName]);
      const bVal = this.parseTemporalValue(b[fieldName]);
      return aVal - bVal;
    });
  }

  // Get sorted unique values for temporal domain
  getTemporalDomain(data, fieldName) {
    if (!data || !data.length || !fieldName) return [];
    
    const values = [...new Set(data.map(d => d[fieldName]))];
    return values.sort((a, b) => {
      return this.parseTemporalValue(a) - this.parseTemporalValue(b);
    });
  }

  // Get base spec for all charts (preview with fixed dimensions)
  getBaseSpec() {
    return {
      $schema: 'https://vega.github.io/schema/vega/v5.json',
      width: this.config.width,
      height: this.config.height,
      padding: 5,
      ...(this.config.title && {
        title: {
          text: this.config.title,
          fontSize: 16,
          fontWeight: 'bold'
        }
      }),
      autosize: { type: 'fit', contains: 'padding' }
    };
  }

  // Get base spec for Kibana (no fixed dimensions - uses container sizing)
  getKibanaBaseSpec() {
    return {
      $schema: 'https://vega.github.io/schema/vega/v5.json',
      padding: 5,
      ...(this.config.title && {
        title: {
          text: this.config.title,
          fontSize: 16,
          fontWeight: 'bold'
        }
      }),
      autosize: { type: 'fit', contains: 'padding' }
    };
  }

  // Get Vega-Lite base spec
  getVegaLiteBaseSpec() {
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: this.config.width || 600,
      height: this.config.height || 400,
      ...(this.config.title && {
        title: this.config.title
      })
    };
  }

  // Get Vega-Lite base spec for Kibana (uses container sizing)
  getKibanaVegaLiteBaseSpec() {
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: 'container',
      height: 'container',
      ...(this.config.title && {
        title: this.config.title
      })
    };
  }

  // Accessibility-compliant text styles for chart labels
  // Uses WCAG AA compliant contrast ratios and readable font sizes
  static textStyles = {
    // Primary labels (category names, node labels)
    primary: {
      fontSize: 13,
      fontWeight: 600,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 0.3
    },
    // Secondary labels (smaller annotations)
    secondary: {
      fontSize: 11,
      fontWeight: 500,
      fill: '#f1f5f9'
    },
    // Value labels (numbers, percentages)
    value: {
      fontSize: 12,
      fontWeight: 700,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 0.3
    },
    // Labels on colored backgrounds (pie, treemap, etc.)
    onColor: {
      fontSize: 12,
      fontWeight: 700,
      fill: '#ffffff',
      stroke: '#1e293b',
      strokeWidth: 0.5
    },
    // External labels (outside shapes)
    external: {
      fontSize: 12,
      fontWeight: 500,
      fill: '#e2e8f0'
    }
  };

  // Get text encoding for Vega marks with accessibility styles
  getTextEncoding(style = 'primary') {
    const styles = VegaGeneratorBase.textStyles[style] || VegaGeneratorBase.textStyles.primary;
    return {
      fontSize: { value: styles.fontSize },
      fontWeight: { value: styles.fontWeight },
      fill: { value: styles.fill },
      ...(styles.stroke && { stroke: { value: styles.stroke } }),
      ...(styles.strokeWidth && { strokeWidth: { value: styles.strokeWidth } })
    };
  }

  /**
   * Validate a Vega/Vega-Lite spec
   */
  static validate(spec, options = {}) {
    const errors = [];
    const warnings = [];

    if (!spec) {
      errors.push('Spec is null or undefined');
      return { valid: false, errors, warnings };
    }

    // Detect if this is a full Vega spec or Vega-Lite
    const isVegaLite = spec.$schema?.includes('vega-lite');

    // Check $schema
    if (!spec.$schema) {
      warnings.push('Missing $schema field');
    }

    if (isVegaLite) {
      // Vega-Lite validation
      if (!spec.mark && !spec.layer && !spec.concat && !spec.hconcat && !spec.vconcat && !spec.facet && !spec.repeat) {
        errors.push('Vega-Lite spec must have mark, layer, concat, hconcat, vconcat, facet, or repeat');
      }
      
      // Check for data
      if (!spec.data) {
        warnings.push('Missing data field');
      }
      
      // Check for encoding in single mark specs
      if (spec.mark && !spec.encoding) {
        warnings.push('Mark spec missing encoding');
      }
    } else {
      // Full Vega validation
      if (!spec.data || !Array.isArray(spec.data)) {
        if (!options.allowEmptyData) {
          warnings.push('Missing or invalid data array');
        }
      }
      
      if (!spec.marks || !Array.isArray(spec.marks)) {
        if (!options.allowEmptyMarks) {
          warnings.push('Missing or invalid marks array');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      isVegaLite
    };
  }

  /**
   * Generate the chart spec - must be implemented by subclasses
   */
  generate(data) {
    throw new Error('generate() must be implemented by subclass');
  }

  /**
   * Generate a Kibana-compatible Vega-Lite spec with Elasticsearch data source
   * This is a base implementation that can be overridden by specific generators
   * @param {Object} elasticConfig - Elasticsearch configuration
   * @param {string} elasticConfig.index - Elasticsearch index pattern
   * @param {Object} elasticConfig.query - Optional query filter
   * @param {string} elasticConfig.timeField - Time field (default: @timestamp)
   * @param {Object} elasticConfig.aggregation - Aggregation configuration
   * @param {boolean} elasticConfig.useContext - Whether to apply dashboard context filters
   * @returns {Object} Vega-Lite spec for Kibana
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    
    // Build the Elasticsearch aggregation query
    const aggs = this.buildKibanaAggs(aggregation, timeField);
    const formatProperty = this.getKibanaFormatProperty(aggregation);
    
    // Determine if this is a time-based aggregation
    const isTimeBased = aggregation?.bucketAgg?.type === 'date_histogram';
    
    // Build the data.url object
    const urlConfig = {
      index: idx,
      body: {
        size: 0,
        ...(query && Object.keys(query).length > 0 ? { query } : {}),
        aggs: aggs
      }
    };
    
    // Always add Kibana context placeholders for dashboard filter integration
    urlConfig['%context%'] = true;
    urlConfig['%timefield%'] = timeField;
    
    // Build base Vega-Lite spec
    const markConfig = this.getKibanaMarkConfig();
    const encoding = this.buildKibanaEncoding(aggregation);
    
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: this.config.title || 'Generated Visualization',
      title: this.config.title || undefined,
      width: 'container',
      height: 'container',
      
      data: {
        url: urlConfig,
        format: { property: formatProperty }
      },
      
      transform: this.buildKibanaTransforms(aggregation),
      mark: markConfig,
      encoding: encoding
    };
    
    // Clean up undefined fields
    if (!spec.title) delete spec.title;
    if (!spec.transform || spec.transform.length === 0) delete spec.transform;
    
    return spec;
  }

  /**
   * Build aggregation order configuration
   * Supports orderBy: '_count' | '_key' | 'custom_metric' | 'order_metric'
   */
  buildAggOrder(bucket) {
    const orderBy = bucket.orderBy || bucket.options?.orderBy || '_count';
    const orderDirection = bucket.orderDirection || bucket.options?.orderDirection || 'desc';
    
    if (orderBy === 'custom_metric' || orderBy === 'order_metric') {
      // When ordering by a custom metric, reference the sub-aggregation
      return { 'order_metric': orderDirection };
    }
    
    return { [orderBy]: orderDirection };
  }

  /**
   * Build Elasticsearch aggregation for Kibana
   * Supports multi-level bucket aggregations and ordering options
   * Can be overridden by specific generators for custom aggregations
   */
  buildKibanaAggs(aggregation, timeField) {
    if (!aggregation) {
      return {
        primary: {
          terms: { field: this.config.xField || '_id', size: 100 }
        }
      };
    }

    const { bucketAgg, bucketAggs, metricAgg, metrics, splitBy, splitConfig } = aggregation;
    
    // Support both legacy single bucketAgg and new multi-level bucketAggs array
    const effectiveBuckets = (bucketAggs && bucketAggs.length > 0) 
      ? bucketAggs 
      : (bucketAgg ? [bucketAgg] : []);
    
    if (effectiveBuckets.length === 0) {
      return {
        primary: { terms: { field: this.config.xField || '_id', size: 100 } }
      };
    }
    
    // Get effective metrics (support both single metricAgg and metrics array)
    const effectiveMetrics = metrics && metrics.length > 0 
      ? metrics 
      : (metricAgg ? [metricAgg] : []);
    
    /**
     * Recursively build nested bucket aggregations
     */
    const buildBucketAgg = (bucket, bucketIndex = 0) => {
      const bucketType = bucket.type || 'terms';

      // Validate required field for non-date_histogram buckets
      if (bucketType !== 'date_histogram' && !bucket.field) {
        logger.warn('Bucket aggregation missing required field', {
          event: 'kibana_agg_validation',
          bucketIndex,
          bucketType,
          chartType: this.constructor.metadata?.id || this.type
        });
        // Use a fallback field to prevent ES query failure
        bucket.field = bucket.field || '_id';
      }

      if (bucketType === 'date_histogram') {
        return {
          date_histogram: {
            field: bucket.field || timeField,
            calendar_interval: bucket.options?.interval || bucket.interval || '1d',
            min_doc_count: bucket.options?.minDocCount ?? 0
          }
        };
      } else if (bucketType === 'histogram') {
        return {
          histogram: {
            field: bucket.field,
            interval: bucket.options?.interval || bucket.interval || 10,
            min_doc_count: bucket.options?.minDocCount ?? 0
          }
        };
      } else {
        // Terms aggregation with order support
        const termsConfig = {
          terms: {
            field: bucket.field,
            size: bucket.options?.size || bucket.size || 20,
            order: this.buildAggOrder(bucket)
          }
        };
        
        // Add order_metric sub-aggregation if ordering by custom metric
        if ((bucket.orderBy === 'custom_metric' || bucket.orderBy === 'order_metric') && bucket.orderMetric) {
          termsConfig.aggs = {
            order_metric: {
              [bucket.orderMetric.type]: { field: bucket.orderMetric.field }
            }
          };
        }
        
        return termsConfig;
      }
    };
    
    /**
     * Build nested aggregation structure
     */
    const buildNestedAggs = (buckets, level = 0) => {
      if (level >= buckets.length) return null;

      const bucket = buckets[level];
      const agg = buildBucketAgg(bucket, level);
      
      // Add nested child aggregations
      const child = buildNestedAggs(buckets, level + 1);
      if (child) {
        if (!agg.aggs) agg.aggs = {};
        Object.assign(agg.aggs, child);
      }
      
      // Add metrics at the deepest level
      if (level === buckets.length - 1 && effectiveMetrics.length > 0) {
        if (!agg.aggs) agg.aggs = {};
        effectiveMetrics.forEach((m, idx) => {
          if (m.type && m.type !== 'count') {
            agg.aggs[m.id || `metric_${idx}`] = { [m.type]: { field: m.field } };
          }
        });
      }
      
      // Add split aggregation at the deepest level
      if (level === buckets.length - 1) {
        const effectiveSplit = splitBy || (splitConfig?.enabled ? splitConfig : null);
        if (effectiveSplit && effectiveSplit.field) {
          if (!agg.aggs) agg.aggs = {};
          agg.aggs.split = {
            terms: {
              field: effectiveSplit.field,
              size: effectiveSplit.maxBuckets || effectiveSplit.options?.size || 10
            }
          };
          // Copy metrics to split
          if (effectiveMetrics.length > 0) {
            agg.aggs.split.aggs = {};
            effectiveMetrics.forEach((m, idx) => {
              if (m.type && m.type !== 'count') {
                agg.aggs.split.aggs[m.id || `metric_${idx}`] = { [m.type]: { field: m.field } };
              }
            });
          }
        }
      }
      
      const key = level === 0 ? 'primary' : `level_${level}`;
      return { [key]: agg };
    };
    
    return buildNestedAggs(effectiveBuckets);
  }

  /**
   * Get the format property path for Elasticsearch response
   */
  getKibanaFormatProperty(aggregation) {
    return 'aggregations.primary.buckets';
  }

  /**
   * Build transforms to flatten Elasticsearch aggregation response
   */
  buildKibanaTransforms(aggregation) {
    const transforms = [];
    
    // Calculate field - extract value from metric_0 aggregation
    if (aggregation?.metricAgg?.type && aggregation.metricAgg.type !== 'count') {
      transforms.push({
        calculate: 'datum.metric_0 ? datum.metric_0.value : datum.doc_count',
        as: 'value'
      });
    } else {
      transforms.push({
        calculate: 'datum.doc_count',
        as: 'value'
      });
    }
    
    // Extract key for categorical buckets
    transforms.push({
      calculate: 'datum.key_as_string || datum.key',
      as: 'category'
    });
    
    return transforms;
  }

  /**
   * Get mark configuration for Kibana spec
   * Override in specific generators for custom marks
   */
  getKibanaMarkConfig() {
    const markTypeMap = {
      'bar': { type: 'bar' },
      'line': { type: 'line', point: true },
      'area': { type: 'area', line: true },
      'pie': { type: 'arc' },
      'donut': { type: 'arc', innerRadius: 50 },
      'scatter': { type: 'point' },
      'heatmap': { type: 'rect' }
    };
    
    return markTypeMap[this.type] || { type: 'bar' };
  }

  /**
   * Build encoding for Kibana spec
   * Override in specific generators for custom encodings
   */
  buildKibanaEncoding(aggregation) {
    const isTimeBased = aggregation?.bucketAgg?.type === 'date_histogram';
    
    const encoding = {
      x: {
        field: isTimeBased ? 'key' : 'category',
        type: isTimeBased ? 'temporal' : 'nominal',
        title: this.getXLabel(this.config.xField),
        axis: { labelAngle: -45 }
      },
      y: {
        field: 'value',
        type: 'quantitative',
        title: this.getYLabel(this.config.yField)
      }
    };
    
    // Add color encoding if colorField is specified
    if (this.config.colorField) {
      encoding.color = {
        field: 'category',
        type: 'nominal',
        title: this.getLegendLabel(this.config.colorField)
      };
    }
    
    // Add tooltip
    encoding.tooltip = [
      { field: 'category', type: 'nominal', title: 'Category' },
      { field: 'value', type: 'quantitative', title: 'Value', format: ',.0f' }
    ];
    
    return encoding;
  }

  // ========================================
  // MULTI-LEVEL & SPLIT SUPPORT HELPERS
  // ========================================

  /**
   * Detect if data contains multi-level aggregation results
   * Multi-level data will have fields from multiple bucket levels
   */
  detectMultiLevelData(data) {
    if (!data || data.length === 0) return false;
    const sample = data[0];
    // Multi-level data typically has _split_count or multiple categorical fields
    return Object.keys(sample).some(k => k === '_split_count' || k.startsWith('level_'));
  }

  /**
   * Get all metric fields from data
   * Useful for charts that can display multiple metrics
   */
  getMultipleMetricFields(data) {
    if (!data || data.length === 0) return [];
    
    const sample = data[0];
    const metricFields = [];
    
    // Look for fields that look like aggregated metrics
    Object.keys(sample).forEach(key => {
      // Skip known non-metric fields
      if (['_count', '_split_count', '_key'].includes(key)) return;
      
      // Check if field contains numeric values
      const value = sample[key];
      if (typeof value === 'number') {
        // Check if this looks like a metric field (contains agg type prefix)
        const aggPrefixes = ['sum_', 'avg_', 'min_', 'max_', 'count_', 'median_'];
        const isMetric = aggPrefixes.some(prefix => key.startsWith(prefix)) || key === 'value';
        if (isMetric) {
          metricFields.push({
            field: key,
            label: this.formatFieldLabel(key),
            type: this.inferMetricType(key)
          });
        }
      }
    });
    
    return metricFields;
  }

  /**
   * Infer metric type from field name
   */
  inferMetricType(fieldName) {
    if (fieldName.startsWith('sum_')) return 'sum';
    if (fieldName.startsWith('avg_')) return 'average';
    if (fieldName.startsWith('min_')) return 'min';
    if (fieldName.startsWith('max_')) return 'max';
    if (fieldName.startsWith('count_')) return 'count';
    if (fieldName.startsWith('median_')) return 'median';
    return 'value';
  }

  /**
   * Format field name for display
   */
  formatFieldLabel(fieldName) {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Apply split configuration to Vega-Lite encoding
   * @param {Object} encoding - Base encoding object
   * @param {Object} splitConfig - Split configuration
   * @returns {Object} Updated encoding with split applied
   */
  applySplitEncoding(encoding, splitConfig) {
    if (!splitConfig?.enabled || !splitConfig?.field) return encoding;
    
    if (splitConfig.type === 'series') {
      // Add color encoding for series split
      encoding.color = {
        field: splitConfig.field,
        type: 'nominal',
        legend: { title: this.formatFieldLabel(splitConfig.field) }
      };
    }
    
    return encoding;
  }

  /**
   * Wrap Vega-Lite spec with facet for chart split (small multiples)
   * @param {Object} spec - Base Vega-Lite spec
   * @param {Object} splitConfig - Split configuration
   * @returns {Object} Wrapped spec with facet
   */
  applyChartSplit(spec, splitConfig) {
    if (!splitConfig?.enabled || !splitConfig?.field || splitConfig.type !== 'chart') {
      return spec;
    }
    
    const columns = splitConfig.columns || 3;
    const cellWidth = Math.floor((spec.width || 400) / columns);
    
    // Create faceted specification
    return {
      $schema: spec.$schema,
      description: spec.description,
      title: spec.title,
      data: spec.data,
      facet: {
        column: {
          field: splitConfig.field,
          type: 'nominal',
          header: { 
            title: this.formatFieldLabel(splitConfig.field),
            labelOrient: 'bottom'
          }
        }
      },
      columns: columns,
      spec: {
        width: cellWidth,
        height: spec.height || 300,
        mark: spec.mark,
        encoding: spec.encoding,
        ...(spec.layer && { layer: spec.layer })
      }
    };
  }

  /**
   * Build multi-metric layer specification for overlaid metrics
   * @param {Array} metricFields - Array of metric field definitions
   * @param {Object} baseEncoding - Base encoding for x-axis
   * @param {Object} options - Additional options
   * @returns {Array} Array of layer specifications
   */
  buildMultiMetricLayers(metricFields, baseEncoding, options = {}) {
    const { markType = 'line', colorScheme = 'category10' } = options;
    const colors = this.getSchemeColors(colorScheme, metricFields.length);
    
    return metricFields.map((metric, idx) => ({
      mark: { 
        type: markType, 
        strokeWidth: 2,
        point: markType === 'line'
      },
      encoding: {
        ...baseEncoding,
        y: { 
          field: metric.field, 
          type: 'quantitative', 
          title: metric.label,
          axis: idx === 0 ? {} : { orient: 'right' }
        },
        color: { value: colors[idx] }
      }
    }));
  }

  /**
   * Get colors from a color scheme
   */
  getSchemeColors(scheme, count) {
    const schemes = {
      category10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
      tableau10: ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab']
    };
    const colors = schemes[scheme] || schemes[VegaGeneratorBase.DEFAULTS.colorScheme];
    return colors.slice(0, count);
  }

  // ========================================
  // UNIFIED KIBANA GENERATION HELPERS
  // ========================================

  /**
   * Build a complete Kibana data source configuration
   * @param {Object} elasticConfig - Elasticsearch configuration
   * @param {Object} options - Additional options for data source
   * @returns {Array} Array of data source definitions for Vega spec
   */
  buildKibanaDataSource(elasticConfig, options = {}) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    
    // Build aggregation
    const aggs = this.buildKibanaAggs(aggregation, timeField);
    const formatProperty = options.formatProperty || this.getKibanaFormatProperty(aggregation);
    
    // Build URL config
    const urlConfig = {
      index: idx,
      body: {
        size: 0,
        ...(query && Object.keys(query).length > 0 ? { query } : {}),
        aggs
      }
    };

    // Always add Kibana context placeholders for dashboard filter integration
    urlConfig['%context%'] = true;
    urlConfig['%timefield%'] = timeField;
    
    return {
      name: options.name || 'source',
      url: urlConfig,
      format: { property: formatProperty }
    };
  }

  /**
   * Build text marks for labels with consistent accessibility styling
   * @param {Object} options - Label configuration
   * @returns {Object} Vega text mark definition
   */
  buildKibanaLabelMark(options = {}) {
    const {
      dataSource = 'source',
      textField = 'value',
      textFormat = ',.0f',
      xField = null,
      yField = null,
      xSignal = null,
      ySignal = null,
      style = 'primary',
      dx = 0,
      dy = 0,
      align = 'center',
      baseline = 'middle',
      condition = null
    } = options;

    const textStyles = VegaGeneratorBase.textStyles[style] || VegaGeneratorBase.textStyles.primary;
    
    const textMark = {
      type: 'text',
      from: { data: dataSource },
      encode: {
        enter: {
          text: textFormat 
            ? { signal: `format(datum.${textField}, '${textFormat}')` }
            : { field: textField },
          align: { value: align },
          baseline: { value: baseline },
          dx: { value: dx },
          dy: { value: dy },
          fontSize: { value: textStyles.fontSize },
          fontWeight: { value: textStyles.fontWeight },
          fill: { value: textStyles.fill },
          ...(textStyles.stroke && { stroke: { value: textStyles.stroke } }),
          ...(textStyles.strokeWidth && { strokeWidth: { value: textStyles.strokeWidth } })
        }
      }
    };

    // Add position
    if (xField) {
      textMark.encode.enter.x = { scale: 'xscale', field: xField };
    } else if (xSignal) {
      textMark.encode.enter.x = { signal: xSignal };
    }
    
    if (yField) {
      textMark.encode.enter.y = { scale: 'yscale', field: yField };
    } else if (ySignal) {
      textMark.encode.enter.y = { signal: ySignal };
    }

    return textMark;
  }

  /**
   * Build common scales for Kibana specs
   * @param {Object} options - Scale configuration
   * @returns {Array} Array of scale definitions
   */
  buildKibanaScales(options = {}) {
    const {
      xField = 'category',
      yField = 'value',
      colorField = null,
      xType = 'band',
      yType = 'linear',
      includeColor = true
    } = options;

    const styleConfig = this.getKibanaStyleConfig();
    const scales = [];

    // X scale
    scales.push({
      name: 'xscale',
      type: xType,
      domain: { data: 'source', field: xField },
      range: 'width',
      ...(xType === 'band' && { padding: 0.15 })
    });

    // Y scale
    scales.push({
      name: 'yscale',
      type: yType,
      domain: { data: 'source', field: yField },
      range: 'height',
      nice: true,
      zero: true
    });

    // Color scale
    if (includeColor && colorField) {
      scales.push({
        name: 'color',
        type: 'ordinal',
        domain: { data: 'source', field: colorField },
        range: { scheme: styleConfig.colorScheme }
      });
    }

    return scales;
  }

  /**
   * Build standard axes for Kibana specs
   * @param {Object} options - Axis configuration
   * @returns {Array} Array of axis definitions
   */
  buildKibanaAxes(options = {}) {
    const {
      xTitle = null,
      yTitle = null,
      xLabelAngle = -45,
      showGrid = true
    } = options;

    return [
      {
        orient: 'bottom',
        scale: 'xscale',
        title: xTitle || this.getXLabel(this.config.xField),
        labelAngle: xLabelAngle,
        labelAlign: xLabelAngle < 0 ? 'right' : 'center',
        labelBaseline: 'top'
      },
      {
        orient: 'left',
        scale: 'yscale',
        title: yTitle || this.getYLabel(this.config.yField),
        grid: showGrid
      }
    ];
  }

  /**
   * Build a complete Kibana Vega spec using unified helpers
   * This provides a consistent structure that generators can extend
   * @param {Object} elasticConfig - Elasticsearch configuration
   * @param {Object} options - Additional options
   * @returns {Object} Complete Vega spec for Kibana
   */
  buildUnifiedKibanaSpec(elasticConfig, options = {}) {
    const {
      marks = [],
      additionalData = [],
      additionalScales = [],
      additionalAxes = [],
      signals = [],
      legends = [],
      xField = 'category',
      yField = 'value',
      colorField = null
    } = options;

    const styleConfig = this.getKibanaStyleConfig();

    // Build data sources
    const dataSource = this.buildKibanaDataSource(elasticConfig);
    const data = [dataSource, ...additionalData];

    // Build scales
    const scales = [
      ...this.buildKibanaScales({ xField, yField, colorField }),
      ...additionalScales
    ];

    // Build axes
    const axes = [
      ...this.buildKibanaAxes(),
      ...additionalAxes
    ];

    // Build complete spec
    const spec = {
      ...this.getKibanaBaseSpec(),
      data,
      scales,
      axes,
      marks,
      ...(signals.length > 0 && { signals }),
      ...(legends.length > 0 && { legends })
    };

    return spec;
  }

  /**
   * Get accessible text styles for labels
   * @param {string} style - Style type: 'primary', 'secondary', 'value', 'onColor', 'external'
   * @returns {Object} Text style configuration
   */
  getAccessibleTextStyles(style = 'primary') {
    return VegaGeneratorBase.textStyles[style] || VegaGeneratorBase.textStyles.primary;
  }

  /**
   * Validate the configuration against the generator's schema
   * @param {Object} config - Configuration to validate
   * @param {Object} schema - Schema definition (defaults to this generator's schema)
   * @returns {Object} Validation result with isValid, errors, and warnings
   */
  static validateConfig(config, schema) {
    const errors = [];
    const warnings = [];
    const schemaToUse = schema || this.schema;

    if (!schemaToUse || !schemaToUse.fields) {
      return { isValid: true, errors: [], warnings: [{ message: 'No schema defined for validation' }] };
    }

    // Check required fields
    for (const field of schemaToUse.fields) {
      if (field.required && !config[field.name]) {
        errors.push({
          field: field.name,
          message: `Required field "${field.label || field.name}" is missing`,
          code: 'REQUIRED_FIELD_MISSING'
        });
      }
    }

    // Validate field types and constraints
    for (const field of schemaToUse.fields) {
      const value = config[field.name];
      if (value === undefined || value === null) continue;

      // Type validation
      switch (field.type) {
        case 'number':
          if (typeof value !== 'number' && isNaN(Number(value))) {
            errors.push({
              field: field.name,
              message: `"${field.label || field.name}" must be a number`,
              code: 'INVALID_TYPE'
            });
          } else {
            const numVal = Number(value);
            if (field.min !== undefined && numVal < field.min) {
              errors.push({
                field: field.name,
                message: `"${field.label || field.name}" must be at least ${field.min}`,
                code: 'VALUE_TOO_LOW'
              });
            }
            if (field.max !== undefined && numVal > field.max) {
              errors.push({
                field: field.name,
                message: `"${field.label || field.name}" must be at most ${field.max}`,
                code: 'VALUE_TOO_HIGH'
              });
            }
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            warnings.push({
              field: field.name,
              message: `"${field.label || field.name}" should be a boolean, got ${typeof value}`,
              code: 'TYPE_COERCION'
            });
          }
          break;

        case 'select':
          if (field.options && !field.options.includes(value)) {
            errors.push({
              field: field.name,
              message: `"${field.label || field.name}" must be one of: ${field.options.join(', ')}`,
              code: 'INVALID_OPTION'
            });
          }
          break;

        case 'color':
          if (typeof value === 'string' && !/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$|^rgb\(|^rgba\(|^[a-z]+$/i.test(value)) {
            warnings.push({
              field: field.name,
              message: `"${field.label || field.name}" may not be a valid color: ${value}`,
              code: 'POSSIBLY_INVALID_COLOR'
            });
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate data against expected field requirements
   * @param {Array} data - Data array to validate
   * @param {Array} requiredFields - Fields that must exist in data
   * @returns {Object} Validation result
   */
  validateData(data, requiredFields = []) {
    const errors = [];
    const warnings = [];

    if (!data || !Array.isArray(data)) {
      errors.push({
        message: 'Data must be a non-empty array',
        code: 'INVALID_DATA_FORMAT'
      });
      return { isValid: false, errors, warnings };
    }

    if (data.length === 0) {
      warnings.push({
        message: 'Data array is empty',
        code: 'EMPTY_DATA'
      });
      return { isValid: true, errors, warnings };
    }

    // Check if required fields exist in multiple sample records for reliability
    const sampleSize = Math.min(10, data.length);
    const samples = data.slice(0, sampleSize);

    for (const fieldName of requiredFields) {
      if (!fieldName) continue;

      // Try to resolve the field path first
      const resolvedField = this.resolveFieldPath(fieldName, data);
      const effectiveField = resolvedField || fieldName;

      // Count how many samples have this field
      let foundCount = 0;
      for (const sample of samples) {
        if (sample[effectiveField] !== undefined) {
          foundCount++;
        }
      }

      if (foundCount === 0) {
        errors.push({
          field: fieldName,
          message: `Required data field "${fieldName}" not found in any sample records`,
          code: 'MISSING_DATA_FIELD'
        });
      } else if (foundCount < sampleSize) {
        warnings.push({
          field: fieldName,
          message: `Field "${fieldName}" found in ${foundCount}/${sampleSize} sample records (sparse data may cause rendering issues)`,
          code: 'SPARSE_DATA_FIELD'
        });
      }
    }

    // Check for null/undefined values in required fields
    if (errors.length === 0 && requiredFields.length > 0) {
      let nullCount = 0;
      for (const record of data) {
        for (const fieldName of requiredFields) {
          const resolvedField = this.resolveFieldPath(fieldName, data);
          if (record[resolvedField] === null || record[resolvedField] === undefined) {
            nullCount++;
          }
        }
      }
      if (nullCount > 0) {
        warnings.push({
          message: `${nullCount} null/undefined values found in required fields`,
          code: 'NULL_VALUES'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get the example configuration and data for this chart type
   * @returns {Object|null} Example object or null if not defined
   */
  static getExample() {
    return this.example || null;
  }
}

export default VegaGeneratorBase;

