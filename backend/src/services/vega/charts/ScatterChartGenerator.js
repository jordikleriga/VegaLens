/**
 * Scatter Chart Generator
 * Generates Vega specs for scatter plots
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class ScatterChartGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'scatter',
    name: 'Scatter Plot',
    description: 'Show correlation between two variables with points',
    category: 'relationship',
    icon: 'scatter-chart'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'yField', label: 'Y-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'sizeField', label: 'Size By', type: 'field', required: false, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'colorField', label: 'Color By', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'showTrendline', label: 'Show Trendline', type: 'boolean', default: false },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['color', 'shape', 'faceted'], default: 'color', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'pointSize', label: 'Point Size', type: 'number', min: 10, max: 500, default: 60 },
      { name: 'pointShape', label: 'Point Shape', type: 'select', options: ['circle', 'square', 'diamond', 'triangle-up', 'triangle-down', 'cross'], default: 'circle' },
      { name: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.1, default: 0.7 },
      { name: 'trendlineColor', label: 'Trendline Color', type: 'color', default: '#ef4444' },
      { name: 'trendlineWidth', label: 'Trendline Width', type: 'number', min: 1, max: 5, default: 2 },
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', default: true },
      { name: 'xAxisZero', label: 'X-Axis Start at Zero', type: 'boolean', default: false },
      { name: 'yAxisZero', label: 'Y-Axis Start at Zero', type: 'boolean', default: false }
    ]
  };

  static example = {
    config: {
      xField: 'height',
      yField: 'weight',
      colorField: 'gender',
      title: 'Height vs Weight',
      pointSize: 60,
      opacity: 0.7
    },
    data: [
      { height: 165, weight: 60, gender: 'Female' },
      { height: 175, weight: 75, gender: 'Male' },
      { height: 160, weight: 55, gender: 'Female' },
      { height: 180, weight: 82, gender: 'Male' },
      { height: 170, weight: 68, gender: 'Female' },
      { height: 185, weight: 90, gender: 'Male' }
    ]
  };

  generate(data) {
    const { 
      xField, yField, sizeField, colorField, opacity, showTrendline,
      pointSize = 60, pointShape = 'circle',
      trendlineColor = '#ef4444', trendlineWidth = 2,
      showGrid = true, xAxisZero = false, yAxisZero = false
    } = this.config;
    
    logger.debug('Generating scatter chart spec', {
      event: 'scatter_chart_generate',
      xField,
      yField,
      colorField,
      showTrendline
    });

    // Resolve field paths to actual data keys
    const resolvedXField = this.resolveFieldPath(xField, data);
    const resolvedYField = this.resolveFieldPath(yField, data);
    const resolvedSizeField = sizeField ? this.resolveFieldPath(sizeField, data) : null;
    const resolvedColorField = colorField ? this.resolveFieldPath(colorField, data) : null;

    const fillOpacity = opacity ?? 0.7;

    return {
      ...this.getBaseSpec(),
      data: [
        {
          name: 'source',
          values: data || []
        },
        ...(showTrendline ? [{
          name: 'trend',
          source: 'source',
          transform: [
            {
              type: 'regression',
              method: 'linear',
              x: resolvedXField,
              y: resolvedYField,
              as: ['u', 'v']
            }
          ]
        }] : [])
      ],
      scales: [
        {
          name: 'xscale',
          type: 'linear',
          domain: { data: 'source', field: resolvedXField },
          range: 'width',
          nice: true,
          zero: xAxisZero
        },
        {
          name: 'yscale',
          type: 'linear',
          domain: { data: 'source', field: resolvedYField },
          range: 'height',
          nice: true,
          zero: yAxisZero
        },
        ...(resolvedSizeField ? [{
          name: 'size',
          type: 'linear',
          domain: { data: 'source', field: resolvedSizeField },
          range: [pointSize * 0.5, pointSize * 5]
        }] : []),
        ...(resolvedColorField ? [this.getColorScale(resolvedColorField)] : [])
      ],
      axes: [
        { orient: 'bottom', scale: 'xscale', title: this.getXLabel(xField), grid: showGrid },
        { orient: 'left', scale: 'yscale', title: this.getYLabel(yField), grid: showGrid }
      ],
      ...(resolvedColorField ? {
        legends: [{ fill: 'color', title: this.getLegendLabel(colorField), orient: 'right' }]
      } : {}),
      marks: [
        {
          type: 'symbol',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: resolvedXField },
              y: { scale: 'yscale', field: resolvedYField },
              shape: { value: pointShape },
              size: resolvedSizeField 
                ? { scale: 'size', field: resolvedSizeField }
                : { value: pointSize },
              fill: resolvedColorField
                ? { scale: 'color', field: resolvedColorField }
                : this.getFillColor(),
              fillOpacity: { value: fillOpacity },
              stroke: { value: 'white' },
              strokeWidth: { value: 1 }
            },
            update: { fillOpacity: { value: fillOpacity } },
            hover: { fillOpacity: { value: 1 } }
          }
        },
        ...(showTrendline ? [{
          type: 'line',
          from: { data: 'trend' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: 'u' },
              y: { scale: 'yscale', field: 'v' },
              stroke: { value: trendlineColor },
              strokeWidth: { value: trendlineWidth },
              strokeDash: { value: [4, 4] }
            }
          }
        }] : [])
      ]
    };
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      xField, yField, sizeField, colorField, showTrendline,
      pointSize = 60, pointShape = 'circle', opacity = 0.7,
      trendlineColor = '#ef4444', trendlineWidth = 2,
      showGrid = true, xAxisZero = false, yAxisZero = false
    } = this.config;

    // Extract actual ES field names from aggregation config (consistent pattern)
    const bucketAggs = aggregation?.bucketAggs || [];
    const primaryBucket = bucketAggs[0] || aggregation?.bucketAgg;
    const metrics = aggregation?.metrics || [];

    // For scatter: color field is the primary bucket (category grouping)
    const colorBucketField = primaryBucket?.field || colorField;
    const bucketSize = primaryBucket?.options?.size || 20;

    // Get metric configs for x, y axes
    // The UI passes metrics array with type (avg, sum, max, min, etc.) and field
    const xMetric = metrics[0];
    const yMetric = metrics[1];

    // Use the actual field names and aggregation types from metrics config
    const esXField = xMetric?.field || xField;
    const esYField = yMetric?.field || yField;
    const xMetricType = xMetric?.type || 'avg';
    const yMetricType = yMetric?.type || 'avg';

    // Size field: look up in metrics array by field name (like BubbleChartGenerator)
    // If sizeField is set, find its metric config in the metrics array
    const sizeMetric = sizeField ? metrics.find(m => m.field === sizeField) : null;
    const sizeFieldInMetrics = !!sizeMetric;
    const sizeMetricType = sizeMetric?.type || 'avg';

    // Determine if we're using a real ES field or doc_count
    const esSizeField = sizeFieldInMetrics ? sizeField : null;
    const useSizeDocCount = sizeField && !sizeFieldInMetrics;

    // Scatter plots should aggregate data per category (like preview does)
    // Each point = one category with aggregated x and y values
    const aggs = colorBucketField ? {
      categories: {
        terms: { field: colorBucketField, size: bucketSize },
        aggs: {
          x_metric: { [xMetricType]: { field: esXField } },
          y_metric: { [yMetricType]: { field: esYField } },
          // Only add size_metric if we have a valid ES field (not count-based)
          ...(esSizeField ? { size_metric: { [sizeMetricType]: { field: esSizeField } } } : {})
        }
      }
    } : {
      // Without category, create a single aggregated point
      overall: {
        stats: { field: esXField }
      },
      y_stat: {
        stats: { field: esYField }
      }
    };

    const urlConfig = {
      index: idx,
      body: {
        size: 0,
        ...(query && Object.keys(query).length > 0 ? { query } : {}),
        aggs
      }
    };

    if (useContext) {
      urlConfig['%context%'] = true;
      urlConfig['%timefield%'] = timeField;
    }

    const colorScheme = this.colorConfig?.scheme || 'tableau10';
    const formatProperty = colorBucketField
      ? 'aggregations.categories.buckets'
      : 'aggregations';

    // Helper to clean up field names for display
    const cleanFieldName = (field) => {
      if (!field) return '';
      return field.replace(/\.keyword$/, '').replace(/_/g, ' ');
    };

    // Determine if we have any size encoding (either field-based or count-based)
    const hasSizeEncoding = esSizeField || useSizeDocCount;

    // Transforms extract aggregated metric values (not raw document data)
    // Each bucket = one point with x_metric.value and y_metric.value
    const transforms = colorBucketField ? [
      // Extract category from bucket key
      { calculate: 'datum.key', as: 'category' },
      // Extract x, y from aggregated metrics
      { calculate: 'datum.x_metric.value', as: 'x' },
      { calculate: 'datum.y_metric.value', as: 'y' },
      // Size: use size_metric.value for field-based, doc_count for count-based
      ...(esSizeField ? [{ calculate: 'datum.size_metric.value', as: 'size' }] : []),
      ...(useSizeDocCount ? [{ calculate: 'datum.doc_count', as: 'size' }] : []),
      // Filter out invalid data points
      { filter: 'isValid(datum.x) && isValid(datum.y)' }
    ] : [
      // Single aggregated point (no category grouping)
      { calculate: 'datum.overall.avg', as: 'x' },
      { calculate: 'datum.y_stat.avg', as: 'y' },
      { filter: 'isValid(datum.x) && isValid(datum.y)' }
    ];

    // Build axis titles with metric type (e.g., "max products base price")
    const xTitle = `${xMetricType} ${cleanFieldName(esXField)}`;
    const yTitle = `${yMetricType} ${cleanFieldName(esYField)}`;

    const encoding = {
      x: {
        field: 'x',
        type: 'quantitative',
        title: xTitle,
        scale: { zero: xAxisZero, nice: true }
      },
      y: {
        field: 'y',
        type: 'quantitative',
        title: yTitle,
        scale: { zero: yAxisZero, nice: true }
      },
      tooltip: [
        { field: 'x', type: 'quantitative', title: xTitle, format: ',.2f' },
        { field: 'y', type: 'quantitative', title: yTitle, format: ',.2f' },
        ...(colorBucketField ? [{ field: 'category', type: 'nominal', title: cleanFieldName(colorBucketField) }] : []),
        ...(hasSizeEncoding ? [{ field: 'size', type: 'quantitative', title: useSizeDocCount ? 'Count' : cleanFieldName(esSizeField), format: ',.2f' }] : [])
      ]
    };

    if (hasSizeEncoding) {
      encoding.size = {
        field: 'size',
        type: 'quantitative',
        scale: { range: [pointSize * 0.5, pointSize * 5] },
        legend: { title: useSizeDocCount ? 'Count' : cleanFieldName(esSizeField) }
      };
    }

    if (colorBucketField) {
      encoding.color = {
        field: 'category',
        type: 'nominal',
        scale: { scheme: colorScheme },
        legend: { title: cleanFieldName(colorBucketField) }
      };
    }

    const baseSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Scatter Plot',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: formatProperty }
      },
      transform: transforms,
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig()
      }
    };

    // If trendline is requested, use layer composition
    if (showTrendline) {
      return {
        ...baseSpec,
        layer: [
          {
            mark: {
              type: 'point',
              shape: pointShape,
              opacity: opacity,
              size: hasSizeEncoding ? undefined : pointSize,
              filled: true
            },
            encoding
          },
          {
            mark: {
              type: 'line',
              color: trendlineColor,
              strokeWidth: trendlineWidth,
              strokeDash: [4, 4]
            },
            transform: [
              { regression: 'y', on: 'x' }
            ],
            encoding: {
              x: { field: 'x', type: 'quantitative' },
              y: { field: 'y', type: 'quantitative' }
            }
          }
        ]
      };
    }

    return {
      ...baseSpec,
      mark: {
        type: 'point',
        shape: pointShape,
        opacity: opacity,
        size: hasSizeEncoding ? undefined : pointSize,
        filled: true
      },
      encoding
    };
  }
}

export default ScatterChartGenerator;

