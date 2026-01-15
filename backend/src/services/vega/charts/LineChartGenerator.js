/**
 * Line Chart Generator
 * Generates Vega specs for line charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class LineChartGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'line',
    name: 'Line Chart',
    description: 'Show trends over time or continuous data',
    category: 'trend',
    icon: 'line-chart'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true, fieldTypes: ['date', 'number', 'keyword'] },
      { name: 'yField', label: 'Y-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'colorField', label: 'Series', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'interpolate', label: 'Line Style', type: 'select', options: ['linear', 'monotone', 'step', 'step-before', 'step-after'], default: 'linear' },
      { name: 'showPoints', label: 'Show Points', type: 'boolean', default: false },
      { name: 'strokeWidth', label: 'Line Width', type: 'number', min: 1, max: 10, default: 2 },
      { name: 'aggregation', label: 'Aggregation', type: 'select', options: ['sum', 'count', 'avg', 'min', 'max'], default: 'sum' },
      { name: 'orderBy', label: 'Order By', type: 'select', options: ['_count', '_key', 'custom'], default: '_key', advanced: true },
      { name: 'orderDirection', label: 'Order Direction', type: 'select', options: ['asc', 'desc'], default: 'asc', advanced: true },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['series', 'layered', 'faceted'], default: 'series', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'pointSize', label: 'Point Size', type: 'number', min: 10, max: 200, default: 50 },
      { name: 'pointShape', label: 'Point Shape', type: 'select', options: ['circle', 'square', 'diamond', 'triangle-up', 'triangle-down'], default: 'circle' },
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', default: true },
      { name: 'yAxisZero', label: 'Y-Axis Start at Zero', type: 'boolean', default: true }
    ]
  };

  static example = {
    config: {
      xField: 'month',
      yField: 'revenue',
      title: 'Monthly Revenue Trend',
      interpolate: 'monotone',
      showPoints: true,
      strokeWidth: 2
    },
    data: [
      { month: 'Jan', revenue: 4200 },
      { month: 'Feb', revenue: 4800 },
      { month: 'Mar', revenue: 5100 },
      { month: 'Apr', revenue: 4900 },
      { month: 'May', revenue: 5500 },
      { month: 'Jun', revenue: 6200 }
    ]
  };

  generate(data) {
    const { 
      xField, yField, colorField, interpolate, showPoints, strokeWidth, aggregation,
      pointSize = 50, pointShape = 'circle', showGrid = true, yAxisZero = true,
      multiLevelMode = 'series'
    } = this.config;
    
    logger.debug('Generating line chart spec', {
      event: 'line_chart_generate',
      xField,
      yField,
      colorField,
      interpolate,
      multiLevelMode
    });

    // Detect multi-level bucket data
    const hasMultiLevel = data?.[0]?.hasOwnProperty('_composite_key');
    const bucketFields = this.detectBucketFields(data);
    
    // Resolve field paths to actual data keys
    const resolvedXField = this.resolveFieldPath(xField, data);
    const resolvedYField = this.resolveFieldPath(yField, data);
    
    // For multi-level data, auto-assign color field if not explicitly set
    let resolvedColorField = colorField ? this.resolveFieldPath(colorField, data) : null;
    if (hasMultiLevel && !resolvedColorField && bucketFields.length > 1 && multiLevelMode === 'series') {
      // Use the second bucket field for color encoding (separate lines)
      resolvedColorField = bucketFields[1];
      logger.debug('Auto-assigned color field for multi-level series', { colorField: resolvedColorField });
    }
    
    // Handle faceted mode for multi-level data
    if (hasMultiLevel && multiLevelMode === 'faceted' && bucketFields.length > 1) {
      return this.generateFacetedSpec(data, bucketFields, resolvedXField, resolvedYField);
    }
    
    // Handle layered mode (overlapping lines with different dash patterns)
    if (hasMultiLevel && multiLevelMode === 'layered' && bucketFields.length > 1) {
      return this.generateLayeredSpec(data, bucketFields, resolvedXField, resolvedYField);
    }

    // Check if data needs aggregation
    const xValues = (data || []).map(d => d[resolvedXField]);
    const needsAggregation = xValues.length !== new Set(xValues).size;
    const valueField = needsAggregation ? 'value' : resolvedYField;

    // Check if X-axis is temporal
    const isTemporal = this.isTemporalField(data, resolvedXField);

    // CRITICAL: Sort data by x-field to ensure line connects points in correct order
    // For temporal data, sort by time; for categorical data, sort alphabetically
    let sortedData;
    if (isTemporal) {
      sortedData = this.sortDataByTemporalField(data, resolvedXField);
    } else {
      // Sort alphabetically by x-field for categorical data
      sortedData = [...(data || [])].sort((a, b) => {
        const aVal = String(a[resolvedXField] || '');
        const bVal = String(b[resolvedXField] || '');
        return aVal.localeCompare(bVal);
      });
    }
    const temporalDomain = isTemporal ? this.getTemporalDomain(data, resolvedXField) : null;

    const vegaAggOp = VegaGeneratorBase.getVegaAggregateOp(aggregation);

    // Build transforms - aggregate if needed, then ALWAYS sort by x-field for correct line order
    const transforms = [];

    if (needsAggregation) {
      transforms.push({
        type: 'aggregate',
        groupby: resolvedColorField ? [resolvedXField, resolvedColorField] : [resolvedXField],
        ops: [vegaAggOp],
        fields: [resolvedYField],
        as: ['value']
      });
    }

    // For non-temporal data, add collect transform to sort data by x-field
    // This ensures line connects points in alphabetical order, not data arrival order
    if (!isTemporal) {
      transforms.push({
        type: 'collect',
        sort: { field: resolvedXField, order: 'ascending' }
      });
    }

    return {
      ...this.getBaseSpec(),
      data: [
        {
          name: 'source',
          values: sortedData || [],
          transform: transforms
        }
      ],
      scales: [
        {
          name: 'xscale',
          type: 'point',
          domain: temporalDomain || { data: 'source', field: resolvedXField, sort: true },
          range: 'width'
        },
        {
          name: 'yscale',
          type: 'linear',
          domain: { data: 'source', field: valueField },
          range: 'height',
          nice: true,
          zero: yAxisZero
        },
        ...(resolvedColorField ? [this.getColorScale(resolvedColorField)] : [])
      ],
      axes: [
        { orient: 'bottom', scale: 'xscale', title: this.getXLabel(xField) },
        { orient: 'left', scale: 'yscale', title: this.getYLabel(yField), grid: showGrid }
      ],
      ...(resolvedColorField ? {
        legends: [{ stroke: 'color', title: this.getLegendLabel(colorField), orient: 'right' }]
      } : {}),
      marks: [
        {
          type: 'group',
          from: {
            facet: {
              name: 'series',
              data: 'source',
              groupby: resolvedColorField ? [resolvedColorField] : []
            }
          },
          marks: [
            {
              type: 'line',
              from: { data: 'series' },
              encode: {
                enter: {
                  x: { scale: 'xscale', field: resolvedXField },
                  y: { scale: 'yscale', field: valueField },
                  stroke: resolvedColorField
                    ? { scale: 'color', field: resolvedColorField }
                    : this.getFillColor(),
                  strokeWidth: { value: strokeWidth || 2 },
                  interpolate: { value: interpolate || 'linear' }
                }
              }
            },
            ...(showPoints ? [{
              type: 'symbol',
              from: { data: 'series' },
              encode: {
                enter: {
                  x: { scale: 'xscale', field: resolvedXField },
                  y: { scale: 'yscale', field: valueField },
                  fill: resolvedColorField
                    ? { scale: 'color', field: resolvedColorField }
                    : this.getFillColor(),
                  size: { value: pointSize },
                  shape: { value: pointShape }
                },
                update: { fillOpacity: { value: this.getOpacity() } },
                hover: { fillOpacity: { value: 0.5 } }
              }
            }] : [])
          ]
        }
      ]
    };
  }
  /**
   * Detect bucket fields from multi-level aggregated data
   * @param {Array} data - Chart data
   * @returns {Array} List of bucket field names (strings)
   */
  detectBucketFields(data) {
    if (!data || data.length === 0) return [];
    const sample = data[0];
    return Object.keys(sample).filter(k => 
      !['_count', '_composite_key', '_split_count'].includes(k) && 
      typeof sample[k] === 'string'
    );
  }

  /**
   * Generate faceted (small multiples) spec for multi-level data
   * Creates a grid of line charts, one per sub-group
   */
  generateFacetedSpec(data, bucketFields, xField, yField) {
    const { interpolate, showPoints, strokeWidth, showGrid = true, yAxisZero = true, pointSize = 50 } = this.config;
    const facetField = bucketFields[0]; // First bucket for facets
    const seriesField = bucketFields.length > 2 ? bucketFields[1] : null; // Optional series within facets
    
    const valueField = this.resolveFieldPath(yField, data) || yField;
    const resolvedXField = xField;

    return {
      ...this.getBaseSpec(),
      data: [{ name: 'source', values: data || [] }],
      facet: {
        data: 'source',
        field: facetField,
        columns: Math.min(3, new Set(data.map(d => d[facetField])).size)
      },
      spec: {
        width: Math.floor(this.config.width / 3) - 40,
        height: Math.floor(this.config.height / 2) - 40,
        scales: [
          { name: 'xscale', type: 'point', domain: { data: 'facet', field: resolvedXField, sort: true }, range: 'width' },
          { name: 'yscale', type: 'linear', domain: { data: 'facet', field: valueField }, range: 'height', nice: true, zero: yAxisZero }
        ],
        axes: [
          { orient: 'bottom', scale: 'xscale', labelAngle: -45 },
          { orient: 'left', scale: 'yscale', grid: showGrid }
        ],
        marks: [{
          type: 'line',
          from: { data: 'facet' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: resolvedXField },
              y: { scale: 'yscale', field: valueField },
              stroke: this.getFillColor(),
              strokeWidth: { value: strokeWidth || 2 },
              interpolate: { value: interpolate || 'linear' }
            }
          }
        },
        ...(showPoints ? [{
          type: 'symbol',
          from: { data: 'facet' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: resolvedXField },
              y: { scale: 'yscale', field: valueField },
              fill: this.getFillColor(),
              size: { value: pointSize }
            }
          }
        }] : [])]
      },
      title: { text: this.config.title || '' }
    };
  }

  /**
   * Generate layered spec with overlapping lines using dash patterns
   * Different sub-groups get different line styles
   */
  generateLayeredSpec(data, bucketFields, xField, yField) {
    const { interpolate, showPoints, strokeWidth, showGrid = true, yAxisZero = true, pointSize = 50 } = this.config;
    const layerField = bucketFields[1]; // Second bucket for layers
    const valueField = this.resolveFieldPath(yField, data) || yField;
    const resolvedXField = xField;
    
    // Create dash pattern scale for different layers
    const layerValues = [...new Set(data.map(d => d[layerField]))];
    const dashPatterns = [[1, 0], [4, 4], [8, 4], [4, 2, 1, 2], [8, 2, 2, 2]];
    
    return {
      ...this.getBaseSpec(),
      data: [{ name: 'source', values: data || [] }],
      scales: [
        { name: 'xscale', type: 'point', domain: { data: 'source', field: resolvedXField, sort: true }, range: 'width' },
        { name: 'yscale', type: 'linear', domain: { data: 'source', field: valueField }, range: 'height', nice: true, zero: yAxisZero },
        this.getColorScale(layerField),
        { 
          name: 'dashScale', 
          type: 'ordinal', 
          domain: layerValues, 
          range: dashPatterns.slice(0, layerValues.length)
        }
      ],
      axes: [
        { orient: 'bottom', scale: 'xscale', title: this.getXLabel(xField) },
        { orient: 'left', scale: 'yscale', title: this.getYLabel(yField), grid: showGrid }
      ],
      legends: [
        { stroke: 'color', title: this.formatFieldLabel(layerField), orient: 'right' }
      ],
      marks: [{
        type: 'group',
        from: {
          facet: { name: 'series', data: 'source', groupby: [layerField] }
        },
        marks: [{
          type: 'line',
          from: { data: 'series' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: resolvedXField },
              y: { scale: 'yscale', field: valueField },
              stroke: { scale: 'color', field: layerField },
              strokeWidth: { value: strokeWidth || 2 },
              strokeDash: { scale: 'dashScale', field: layerField },
              interpolate: { value: interpolate || 'linear' }
            }
          }
        },
        ...(showPoints ? [{
          type: 'symbol',
          from: { data: 'series' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: resolvedXField },
              y: { scale: 'yscale', field: valueField },
              fill: { scale: 'color', field: layerField },
              size: { value: pointSize }
            }
          }
        }] : [])]
      }]
    };
  }

  /**
   * Format field name for display
   */
  formatFieldLabel(fieldName) {
    if (!fieldName) return '';
    return fieldName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      xField, yField, colorField, interpolate = 'linear',
      showPoints, strokeWidth = 2, showGrid = true, pointSize = 50,
      pointShape = 'circle', yAxisZero = true
    } = this.config;

    // Use actual aggregation config structure
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const splitBy = aggregation?.splitBy;
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || xField;
    const bucketType = bucketAgg?.type || 'date_histogram';
    const bucketOptions = bucketAgg?.options || {};

    const splitField = splitBy?.field || colorField;
    const splitOptions = splitBy?.options || { size: 10 };

    const metric = metrics[0];
    const metricType = metric?.type || 'count';
    const metricField = metric?.field || yField;

    // Build bucket aggregation options
    let bucketAggConfig;
    if (bucketType === 'date_histogram') {
      bucketAggConfig = {
        field: bucketField,
        calendar_interval: bucketOptions.calendarInterval || bucketOptions.interval || 'day',
        ...(bucketOptions.timeZone && { time_zone: bucketOptions.timeZone }),
        min_doc_count: 0
      };
    } else if (bucketType === 'histogram') {
      bucketAggConfig = {
        field: bucketField,
        interval: bucketOptions.interval || 1,
        min_doc_count: 0
      };
    } else {
      // terms or other
      bucketAggConfig = {
        field: bucketField,
        size: bucketOptions.size || 50,
        ...(bucketOptions.orderBy && { order: { [bucketOptions.orderBy]: bucketOptions.orderDirection || 'desc' } })
      };
    }

    // Build aggregation structure
    const aggs = {
      primary: {
        [bucketType]: bucketAggConfig,
        aggs: {}
      }
    };

    // Add split-by (series) aggregation
    if (splitField) {
      aggs.primary.aggs.split = {
        terms: {
          field: splitField,
          size: splitOptions.size || 10
        },
        aggs: {}
      };

      // Add metric to split aggregation
      if (metricType !== 'count' && metricField) {
        aggs.primary.aggs.split.aggs.metric_value = {
          [metricType]: { field: metricField }
        };
      }
    } else {
      // Add metric to primary aggregation when no split
      if (metricType !== 'count' && metricField) {
        aggs.primary.aggs.metric_value = {
          [metricType]: { field: metricField }
        };
      }
    }

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

    const colorScheme = this.config.colorScheme || 'tableau10';

    // Determine X-axis type
    const xType = bucketType === 'date_histogram' ? 'temporal' :
                  bucketType === 'histogram' ? 'quantitative' : 'nominal';

    const isOrdinal = xType === 'nominal';

    // Base transforms to extract data from ES response
    const baseTransforms = splitField ? [
      { flatten: ['split.buckets'], as: ['series'] },
      { calculate: 'datum.key_as_string || datum.key', as: 'xValue' },
      { calculate: 'datum.series.key', as: 'category' },
      {
        calculate: metricType !== 'count'
          ? 'datum.series.metric_value ? datum.series.metric_value.value : 0'
          : 'datum.series.doc_count || 0',
        as: 'value'
      }
    ] : [
      { calculate: 'datum.key_as_string || datum.key', as: 'xValue' },
      {
        calculate: metricType !== 'count'
          ? 'datum.metric_value ? datum.metric_value.value : 0'
          : 'datum.doc_count || 0',
        as: 'value'
      }
    ];

    // For ordinal x-axis, add window transform to compute sort index within each series
    // This index is used in the 'order' encoding to control line connection sequence
    const transforms = isOrdinal ? [
      ...baseTransforms,
      {
        window: [{ op: 'row_number', as: '__sort_order' }],
        sort: [{ field: 'xValue', order: 'ascending' }],
        groupby: splitField ? ['category'] : []
      }
    ] : baseTransforms;

    // Build encoding
    const encoding = {
      x: {
        field: 'xValue',
        type: xType,
        scale: xType === 'temporal' || xType === 'nominal' ? { padding: 0 } : undefined,
        axis: {
          title: this.getXLabel(xField),
          grid: false,
          labelAngle: xType === 'temporal' ? -45 : 0
        },
        // Sort x-axis alphabetically for nominal types
        sort: isOrdinal ? 'ascending' : undefined
      },
      y: {
        field: 'value',
        type: 'quantitative',
        scale: { zero: yAxisZero },
        axis: { title: this.getYLabel(yField), grid: showGrid }
      },
      ...(splitField ? {
        color: {
          field: 'category',
          type: 'nominal',
          scale: { scheme: colorScheme },
          legend: { title: this.getLegendLabel(colorField), orient: 'right' }
        }
      } : {}),
      // Order encoding: tells Vega-Lite how to connect points for line marks
      // __sort_order is computed via window transform (1=first alphabetically, etc.)
      ...(isOrdinal ? { order: { field: '__sort_order', type: 'quantitative' } } : {}),
      tooltip: [
        { field: 'xValue', type: xType, title: this.getXLabel(xField) },
        { field: 'value', type: 'quantitative', title: this.getYLabel(yField) },
        ...(splitField ? [{ field: 'category', type: 'nominal', title: this.getLegendLabel(colorField) }] : [])
      ]
    };

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Line Chart',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.primary.buckets' }
      },
      transform: transforms,
      mark: {
        type: 'line',
        interpolate: interpolate,
        strokeWidth: strokeWidth,
        point: showPoints ? { size: pointSize, shape: pointShape } : false,
        tooltip: true
      },
      encoding,
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default LineChartGenerator;

