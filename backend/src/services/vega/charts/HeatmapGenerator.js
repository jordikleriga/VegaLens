/**
 * Heatmap Generator
 * Generates Vega specs for heatmaps
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class HeatmapGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'heatmap',
    name: 'Heatmap',
    description: 'Show values across two dimensions with color intensity',
    category: 'distribution',
    icon: 'grid'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true, fieldTypes: ['keyword', 'text', 'date'] },
      { name: 'yField', label: 'Y-Axis', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'aggregation', label: 'Aggregation', type: 'select', options: ['sum', 'count', 'avg', 'min', 'max'], default: 'sum' },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['nested_axes', 'faceted'], default: 'nested_axes', advanced: true, description: 'How to display multi-level bucket data on axes' },
      { name: 'heatmapScheme', label: 'Color Scheme', type: 'select', options: ['blues', 'greens', 'oranges', 'reds', 'purples', 'viridis', 'inferno', 'magma', 'plasma', 'warm', 'cool'], default: 'blues' },
      { name: 'reverseColors', label: 'Reverse Colors', type: 'boolean', default: false },
      { name: 'cellPadding', label: 'Cell Padding', type: 'number', min: 0, max: 20, default: 1 },
      { name: 'cornerRadius', label: 'Corner Radius', type: 'number', min: 0, max: 20, default: 0 },
      { name: 'showValues', label: 'Show Values', type: 'boolean', default: false },
      { name: 'valueFontSize', label: 'Value Font Size', type: 'number', min: 8, max: 20, default: 10 },
      { name: 'xAxisLabelAngle', label: 'X-Axis Label Angle', type: 'number', min: -90, max: 90, default: -45 }
    ]
  };

  static example = {
    config: {
      xField: 'day',
      yField: 'hour',
      valueField: 'count',
      title: 'Activity Heatmap',
      heatmapScheme: 'blues'
    },
    data: [
      { day: 'Mon', hour: '9am', count: 45 },
      { day: 'Mon', hour: '12pm', count: 80 },
      { day: 'Mon', hour: '3pm', count: 65 },
      { day: 'Tue', hour: '9am', count: 50 },
      { day: 'Tue', hour: '12pm', count: 95 },
      { day: 'Tue', hour: '3pm', count: 70 },
      { day: 'Wed', hour: '9am', count: 55 },
      { day: 'Wed', hour: '12pm', count: 85 },
      { day: 'Wed', hour: '3pm', count: 60 }
    ]
  };

  generate(data) {
    const { 
      xField, yField, valueField, aggregation,
      heatmapScheme = 'blues', reverseColors = false,
      cellPadding = 1, cornerRadius = 0,
      showValues = false, valueFontSize = 10,
      xAxisLabelAngle = -45
    } = this.config;
    
    logger.debug('Generating heatmap spec', {
      event: 'heatmap_generate',
      xField,
      yField,
      valueField
    });

    // Resolve field paths to actual data keys
    const resolvedXField = this.resolveFieldPath(xField, data);
    const resolvedYField = this.resolveFieldPath(yField, data);
    const resolvedValueField = this.resolveFieldPath(valueField, data);

    // Check if X-axis is temporal
    const isTemporal = this.isTemporalField(data, resolvedXField);
    const temporalDomain = isTemporal ? this.getTemporalDomain(data, resolvedXField) : null;

    // Check if data is already aggregated
    const combos = (data || []).map(d => `${d[resolvedXField]}_${d[resolvedYField]}`);
    const needsAggregation = combos.length !== new Set(combos).size;
    const valueRef = needsAggregation ? 'value' : resolvedValueField;

    const vegaAggOp = VegaGeneratorBase.getVegaAggregateOp(aggregation);
    const transforms = needsAggregation ? [
      {
        type: 'aggregate',
        groupby: [resolvedXField, resolvedYField],
        ops: [vegaAggOp],
        fields: [resolvedValueField],
        as: ['value']
      }
    ] : [];

    return {
      ...this.getBaseSpec(),
      data: [
        {
          name: 'source',
          values: data || [],
          transform: transforms
        }
      ],
      scales: [
        {
          name: 'xscale',
          type: 'band',
          domain: temporalDomain || { data: 'source', field: resolvedXField, sort: true },
          range: 'width',
          padding: cellPadding / 100
        },
        {
          name: 'yscale',
          type: 'band',
          domain: { data: 'source', field: resolvedYField, sort: true },
          range: 'height',
          padding: cellPadding / 100
        },
        {
          name: 'color',
          type: 'linear',
          domain: { data: 'source', field: valueRef },
          range: { scheme: heatmapScheme },
          reverse: reverseColors
        }
      ],
      axes: [
        { 
          orient: 'bottom', 
          scale: 'xscale', 
          title: this.getXLabel(xField), 
          labelAngle: xAxisLabelAngle, 
          labelAlign: xAxisLabelAngle !== 0 ? 'right' : 'center' 
        },
        { orient: 'left', scale: 'yscale', title: this.getYLabel(yField) }
      ],
      legends: [
        {
          fill: 'color',
          title: valueField,
          orient: 'right',
          type: 'gradient'
        }
      ],
      marks: [
        {
          type: 'rect',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: resolvedXField },
              width: { scale: 'xscale', band: 1 },
              y: { scale: 'yscale', field: resolvedYField },
              height: { scale: 'yscale', band: 1 },
              fill: { scale: 'color', field: valueRef },
              cornerRadius: { value: cornerRadius }
            },
            update: { fillOpacity: { value: 1 } },
            hover: { fillOpacity: { value: 0.8 } }
          }
        },
        ...(showValues ? [{
          type: 'text',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: resolvedXField, band: 0.5 },
              y: { scale: 'yscale', field: resolvedYField, band: 0.5 },
              text: { signal: `format(datum.${valueRef}, '.1f')` },
              align: { value: 'center' },
              baseline: { value: 'middle' },
              fontSize: { value: valueFontSize },
              fill: { value: 'white' }
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
      xField, yField, valueField,
      heatmapScheme = 'blues', reverseColors = false,
      cellPadding = 1, cornerRadius = 0,
      showValues = false, valueFontSize = 10, xAxisLabelAngle = -45
    } = this.config;

    // Use actual aggregation config structure (multi-level buckets)
    const bucketAggs = aggregation?.bucketAggs || [];
    const metrics = aggregation?.metrics || [];

    const xBucket = bucketAggs[0];
    const yBucket = bucketAggs[1];

    const xBucketField = xBucket?.field || xField;
    const xBucketType = xBucket?.type || 'terms';
    const xBucketOptions = xBucket?.options || {};

    const yBucketField = yBucket?.field || yField;
    const yBucketOptions = yBucket?.options || {};

    const metric = metrics[0];
    const metricType = metric?.type || 'count';
    const metricField = metric?.field || valueField;

    // Build X bucket aggregation config
    let xBucketConfig;
    if (xBucketType === 'date_histogram') {
      xBucketConfig = {
        field: xBucketField,
        calendar_interval: xBucketOptions.calendarInterval || xBucketOptions.interval || 'day',
        ...(xBucketOptions.timeZone && { time_zone: xBucketOptions.timeZone }),
        min_doc_count: 0
      };
    } else if (xBucketType === 'histogram') {
      xBucketConfig = {
        field: xBucketField,
        interval: xBucketOptions.interval || 1,
        min_doc_count: 0
      };
    } else {
      xBucketConfig = {
        field: xBucketField,
        size: xBucketOptions.size || 30
      };
    }

    // Build nested aggregation: X bucket -> Y bucket -> metric
    const aggs = {
      xbucket: {
        [xBucketType]: xBucketConfig,
        aggs: {
          ybucket: {
            terms: {
              field: yBucketField,
              size: yBucketOptions.size || 30
            },
            aggs: metricType !== 'count' && metricField ? {
              metric_value: { [metricType]: { field: metricField } }
            } : {}
          }
        }
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

    if (useContext || xBucketType === 'date_histogram') {
      urlConfig['%context%'] = true;
      urlConfig['%timefield%'] = timeField;
    }

    const transforms = [
      { flatten: ['ybucket.buckets'], as: ['yb'] },
      { calculate: 'datum.key_as_string || datum.key', as: 'x' },
      { calculate: 'datum.yb.key', as: 'y' },
      { calculate: metricType !== 'count' ? 'datum.yb.metric_value.value' : 'datum.yb.doc_count', as: 'value' }
    ];

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Heatmap',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.xbucket.buckets' }
      },
      transform: transforms,
      mark: { type: 'rect', cornerRadius: cornerRadius },
      encoding: {
        x: {
          field: 'x',
          type: xBucketType === 'date_histogram' ? 'temporal' : 'ordinal',
          axis: { title: this.getXLabel(xField), labelAngle: xAxisLabelAngle }
        },
        y: {
          field: 'y',
          type: 'ordinal',
          axis: { title: this.getYLabel(yField) }
        },
        color: {
          field: 'value',
          type: 'quantitative',
          scale: { scheme: heatmapScheme, reverse: reverseColors },
          legend: { title: valueField }
        }
      },
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig(),
        rect: { binSpacing: cellPadding }
      }
    };

    if (showValues) {
      spec.layer = [
        { mark: { type: 'rect', cornerRadius: cornerRadius } },
        {
          mark: { type: 'text', color: 'white', fontSize: valueFontSize },
          encoding: {
            text: { field: 'value', type: 'quantitative', format: '.1f' }
          }
        }
      ];
      delete spec.mark;
    }

    return spec;
  }
}

export default HeatmapGenerator;

