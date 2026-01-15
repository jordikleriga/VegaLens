/**
 * Area Chart Generator
 * Generates Vega specs for area charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class AreaChartGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'area',
    name: 'Area Chart',
    description: 'Show cumulative totals over time with filled areas',
    category: 'trend',
    icon: 'area-chart'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true, fieldTypes: ['date', 'number', 'keyword'] },
      { name: 'yField', label: 'Y-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'colorField', label: 'Series', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'interpolate', label: 'Interpolation', type: 'select', options: ['linear', 'monotone', 'step', 'step-before', 'step-after'], default: 'monotone' },
      { name: 'stacked', label: 'Stacked', type: 'boolean', default: false },
      { name: 'aggregation', label: 'Aggregation', type: 'select', options: ['sum', 'count', 'avg', 'min', 'max'], default: 'sum' },
      { name: 'orderBy', label: 'Order By', type: 'select', options: ['_count', '_key', 'custom'], default: '_key', advanced: true },
      { name: 'orderDirection', label: 'Order Direction', type: 'select', options: ['asc', 'desc'], default: 'asc', advanced: true },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['stacked', 'overlapping', 'faceted'], default: 'stacked', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'showLine', label: 'Show Line', type: 'boolean', default: true },
      { name: 'lineWidth', label: 'Line Width', type: 'number', min: 0, max: 10, default: 2 },
      { name: 'showPoints', label: 'Show Points', type: 'boolean', default: false },
      { name: 'pointSize', label: 'Point Size', type: 'number', min: 10, max: 200, default: 30 },
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', default: true },
      { name: 'xAxisLabelAngle', label: 'X-Axis Label Angle', type: 'number', min: -90, max: 90, default: 0 },
      { name: 'yAxisZero', label: 'Y-Axis Start at Zero', type: 'boolean', default: true },
      { name: 'opacity', label: 'Fill Opacity', type: 'number', min: 0, max: 1, step: 0.1, default: 0.7 }
    ]
  };

  static example = {
    config: {
      xField: 'month',
      yField: 'value',
      title: 'Monthly Growth',
      interpolate: 'monotone',
      showLine: true
    },
    data: [
      { month: 'Jan', value: 100 },
      { month: 'Feb', value: 150 },
      { month: 'Mar', value: 180 },
      { month: 'Apr', value: 220 },
      { month: 'May', value: 280 },
      { month: 'Jun', value: 350 }
    ]
  };

  generate(data) {
    const { 
      xField, yField, colorField, stacked, interpolate,
      showLine = true, lineWidth = 2, showPoints = false, pointSize = 30,
      showGrid = true, xAxisLabelAngle = 0, yAxisZero = true, opacity,
      multiLevelMode = 'stacked'
    } = this.config;
    
    logger.debug('Generating area chart spec', {
      event: 'area_chart_generate',
      xField,
      yField,
      colorField,
      stacked,
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
    if (hasMultiLevel && !resolvedColorField && bucketFields.length > 1) {
      // Use the second bucket field for color encoding (stacked/overlapping areas)
      resolvedColorField = bucketFields[1];
      logger.debug('Auto-assigned color field for multi-level areas', { colorField: resolvedColorField });
    }

    // Handle faceted mode for multi-level data
    if (hasMultiLevel && multiLevelMode === 'faceted' && bucketFields.length > 1) {
      return this.generateFacetedSpec(data, bucketFields, resolvedXField, resolvedYField);
    }

    // Stacking only works when there's a color field to group by
    const useStacking = stacked && resolvedColorField;

    // Check if X-axis is temporal and get sorted domain
    const isTemporal = this.isTemporalField(data, resolvedXField);
    const temporalDomain = isTemporal ? this.getTemporalDomain(data, resolvedXField) : null;
    
    // Pre-sort data for temporal fields
    const sortedData = isTemporal ? this.sortDataByTemporalField(data, resolvedXField) : data;

    // Build transforms
    const transforms = [];
    
    // Only add collect transform for non-temporal data
    if (!isTemporal) {
      transforms.push({
        type: 'collect',
        sort: { field: resolvedXField }
      });
    }

    if (useStacking) {
      transforms.push({
        type: 'stack',
        groupby: [resolvedXField],
        sort: { field: resolvedColorField },
        field: resolvedYField
      });
    }

    const fillOpacity = opacity ?? 0.7;

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
          domain: { data: 'source', field: useStacking ? 'y1' : resolvedYField },
          range: 'height',
          nice: true,
          zero: yAxisZero
        },
        ...(resolvedColorField ? [this.getColorScale(resolvedColorField)] : [])
      ],
      axes: [
        { 
          orient: 'bottom', 
          scale: 'xscale', 
          title: this.getXLabel(xField), 
          labelAngle: xAxisLabelAngle, 
          labelAlign: xAxisLabelAngle !== 0 ? 'right' : 'center' 
        },
        { orient: 'left', scale: 'yscale', title: this.getYLabel(yField), grid: showGrid }
      ],
      ...(resolvedColorField ? {
        legends: [{ fill: 'color', title: this.getLegendLabel(colorField), orient: 'right' }]
      } : {}),
      marks: resolvedColorField ? [
        {
          type: 'group',
          from: {
            facet: {
              name: 'series',
              data: 'source',
              groupby: [resolvedColorField]
            }
          },
          marks: [
            {
              type: 'area',
              from: { data: 'series' },
              encode: {
                update: {
                  x: { scale: 'xscale', field: resolvedXField },
                  y: { scale: 'yscale', field: useStacking ? 'y1' : resolvedYField },
                  y2: useStacking ? { scale: 'yscale', field: 'y0' } : { scale: 'yscale', value: 0 },
                  fill: { scale: 'color', field: resolvedColorField },
                  fillOpacity: { value: fillOpacity },
                  interpolate: { value: interpolate || 'monotone' },
                  defined: { signal: `isValid(datum['${resolvedYField}'])` }
                }
              }
            },
            ...(showLine ? [{
              type: 'line',
              from: { data: 'series' },
              encode: {
                update: {
                  x: { scale: 'xscale', field: resolvedXField },
                  y: { scale: 'yscale', field: useStacking ? 'y1' : resolvedYField },
                  stroke: { scale: 'color', field: resolvedColorField },
                  strokeWidth: { value: lineWidth },
                  interpolate: { value: interpolate || 'monotone' },
                  defined: { signal: `isValid(datum['${resolvedYField}'])` }
                }
              }
            }] : [])
          ]
        }
      ] : [
        {
          type: 'area',
          from: { data: 'source' },
          encode: {
            update: {
              x: { scale: 'xscale', field: resolvedXField },
              y: { scale: 'yscale', field: resolvedYField },
              y2: { scale: 'yscale', value: 0 },
              fill: this.getFillColor(),
              fillOpacity: { value: fillOpacity },
              interpolate: { value: interpolate || 'monotone' },
              defined: { signal: `isValid(datum['${resolvedYField}'])` }
            }
          }
        },
        ...(showLine ? [{
          type: 'line',
          from: { data: 'source' },
          encode: {
            update: {
              x: { scale: 'xscale', field: resolvedXField },
              y: { scale: 'yscale', field: resolvedYField },
              stroke: this.getFillColor(),
              strokeWidth: { value: lineWidth },
              interpolate: { value: interpolate || 'monotone' },
              defined: { signal: `isValid(datum['${resolvedYField}'])` }
            }
          }
        }] : [])
      ]
    };
  }
  /**
   * Detect bucket fields from multi-level aggregated data
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
   */
  generateFacetedSpec(data, bucketFields, xField, yField) {
    const { interpolate, showLine = true, lineWidth = 2, showGrid = true, yAxisZero = true, opacity } = this.config;
    const facetField = bucketFields[0];
    const valueField = this.resolveFieldPath(yField, data) || yField;
    const fillOpacity = opacity ?? 0.7;

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
          { name: 'xscale', type: 'point', domain: { data: 'facet', field: xField, sort: true }, range: 'width' },
          { name: 'yscale', type: 'linear', domain: { data: 'facet', field: valueField }, range: 'height', nice: true, zero: yAxisZero }
        ],
        axes: [
          { orient: 'bottom', scale: 'xscale', labelAngle: -45 },
          { orient: 'left', scale: 'yscale', grid: showGrid }
        ],
        marks: [
          {
            type: 'area',
            from: { data: 'facet' },
            encode: {
              update: {
                x: { scale: 'xscale', field: xField },
                y: { scale: 'yscale', field: valueField },
                y2: { scale: 'yscale', value: 0 },
                fill: this.getFillColor(),
                fillOpacity: { value: fillOpacity },
                interpolate: { value: interpolate || 'monotone' }
              }
            }
          },
          ...(showLine ? [{
            type: 'line',
            from: { data: 'facet' },
            encode: {
              update: {
                x: { scale: 'xscale', field: xField },
                y: { scale: 'yscale', field: valueField },
                stroke: this.getFillColor(),
                strokeWidth: { value: lineWidth },
                interpolate: { value: interpolate || 'monotone' }
              }
            }
          }] : [])
        ]
      },
      title: { text: this.config.title || '' }
    };
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      xField, yField, colorField, interpolate = 'monotone',
      stacked = false, showLine = true, lineWidth = 2, showPoints = false,
      pointSize = 30, showGrid = true, xAxisLabelAngle = -45, yAxisZero = true,
      opacity = 0.7
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
                  bucketType === 'histogram' ? 'quantitative' : 'ordinal';

    const transforms = splitField ? [
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

    const encoding = {
      x: {
        field: 'xValue',
        type: xType,
        scale: xType === 'temporal' || xType === 'ordinal' ? { padding: 0 } : undefined,
        axis: {
          title: this.getXLabel(xField),
          grid: false,
          labelAngle: xAxisLabelAngle
        }
      },
      y: {
        field: 'value',
        type: 'quantitative',
        scale: { zero: yAxisZero },
        // Stack when there's a split field and stacking is enabled
        stack: splitField && stacked ? 'zero' : null,
        axis: {
          title: this.getYLabel(yField),
          grid: showGrid,
          gridColor: '#475569',
          gridOpacity: 0.3
        }
      }
    };

    if (splitField) {
      encoding.color = {
        field: 'category',
        type: 'nominal',
        scale: { scheme: colorScheme },
        legend: { title: this.getLegendLabel(colorField), orient: 'right' }
      };
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Area Chart',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.primary.buckets' }
      },
      transform: transforms,
      mark: {
        type: 'area',
        interpolate: interpolate,
        line: showLine ? { strokeWidth: lineWidth } : false,
        point: showPoints ? { size: pointSize } : false,
        opacity: opacity,
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

export default AreaChartGenerator;

