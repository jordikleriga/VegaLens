/**
 * Bar Chart Generator
 * Generates Vega specs for bar/column charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class BarChartGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'bar',
    name: 'Bar Chart',
    description: 'Compare categories with horizontal or vertical bars',
    category: 'comparison',
    icon: 'bar-chart'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true, fieldTypes: ['keyword', 'text', 'date'] },
      { name: 'yField', label: 'Y-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'colorField', label: 'Color By', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'orientation', label: 'Orientation', type: 'select', options: ['vertical', 'horizontal'], default: 'vertical' },
      { name: 'stacked', label: 'Stacked', type: 'boolean', default: false },
      { name: 'showLabels', label: 'Show Labels', type: 'boolean', default: false },
      { name: 'aggregation', label: 'Aggregation', type: 'select', options: ['sum', 'count', 'avg', 'min', 'max'], default: 'sum' },
      { name: 'orderBy', label: 'Order By', type: 'select', options: ['_count', '_key', 'custom'], default: '_count', advanced: true },
      { name: 'orderDirection', label: 'Order Direction', type: 'select', options: ['desc', 'asc'], default: 'desc', advanced: true },
      { name: 'cornerRadius', label: 'Corner Radius', type: 'number', min: 0, max: 20, default: 4 },
      { name: 'barOpacity', label: 'Bar Opacity', type: 'number', min: 0, max: 1, step: 0.1, default: 1 },
      { name: 'barPadding', label: 'Bar Padding', type: 'number', min: 0, max: 0.9, step: 0.1, default: 0.2 },
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', default: true },
      { name: 'xAxisLabelAngle', label: 'X-Axis Label Angle', type: 'number', min: -90, max: 90, default: -45 }
    ]
  };

  static example = {
    config: {
      xField: 'category',
      yField: 'value',
      title: 'Sales by Category',
      orientation: 'vertical',
      cornerRadius: 4
    },
    data: [
      { category: 'Electronics', value: 1200 },
      { category: 'Clothing', value: 800 },
      { category: 'Food', value: 950 },
      { category: 'Books', value: 400 },
      { category: 'Home', value: 650 }
    ]
  };

  generate(data) {
    const { 
      xField, yField, colorField, orientation, stacked, showLabels, aggregation,
      cornerRadius = 4, barOpacity, barPadding = 0.2, showGrid = true, xAxisLabelAngle = -45
    } = this.config;
    
    const isHorizontal = orientation === 'horizontal';
    const opacity = barOpacity ?? this.getOpacity();
    
    logger.debug('Generating bar chart spec', {
      event: 'bar_chart_generate',
      xField,
      yField,
      colorField,
      isHorizontal,
      stacked
    });

    // Resolve field paths to actual data keys
    const resolvedXField = this.resolveFieldPath(xField, data);
    const resolvedYField = this.resolveFieldPath(yField, data);
    const resolvedColorField = colorField ? this.resolveFieldPath(colorField, data) : null;

    // Check if X-axis is temporal and get sorted domain
    const isTemporal = this.isTemporalField(data, resolvedXField);
    const temporalDomain = isTemporal ? this.getTemporalDomain(data, resolvedXField) : null;

    // Check if data is already aggregated
    const groupKey = resolvedColorField 
      ? (data || []).map(d => `${d[resolvedXField]}_${d[resolvedColorField]}`)
      : (data || []).map(d => d[resolvedXField]);
    const needsAggregation = groupKey.length !== new Set(groupKey).size;
    const valField = needsAggregation ? 'value' : resolvedYField;

    // Only add aggregate transform if needed
    const vegaAggOp = VegaGeneratorBase.getVegaAggregateOp(aggregation);
    const transforms = needsAggregation ? [
      {
        type: 'aggregate',
        groupby: resolvedColorField ? [resolvedXField, resolvedColorField] : [resolvedXField],
        ops: [vegaAggOp],
        fields: [resolvedYField],
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
        },
        ...(stacked && resolvedColorField ? [{
          name: 'stacked',
          source: 'source',
          transform: [
            {
              type: 'stack',
              groupby: [resolvedXField],
              sort: { field: resolvedColorField },
              field: valField
            }
          ]
        }] : [])
      ],
      scales: [
        {
          name: 'xscale',
          type: 'band',
          domain: temporalDomain || { data: 'source', field: resolvedXField },
          range: isHorizontal ? 'height' : 'width',
          padding: barPadding
        },
        {
          name: 'yscale',
          type: 'linear',
          domain: { data: stacked ? 'stacked' : 'source', field: stacked ? 'y1' : valField },
          range: isHorizontal ? 'width' : 'height',
          nice: true,
          zero: true
        },
        ...(resolvedColorField ? [this.getColorScale(resolvedColorField)] : [])
      ],
      axes: [
        {
          orient: isHorizontal ? 'left' : 'bottom',
          scale: 'xscale',
          title: this.getXLabel(xField),
          labelAngle: isHorizontal ? 0 : xAxisLabelAngle,
          labelAlign: isHorizontal ? 'right' : 'right'
        },
        {
          orient: isHorizontal ? 'bottom' : 'left',
          scale: 'yscale',
          title: this.getYLabel(yField),
          grid: showGrid
        }
      ],
      ...(resolvedColorField ? {
        legends: [{
          fill: 'color',
          title: this.getLegendLabel(colorField),
          orient: 'right'
        }]
      } : {}),
      marks: [
        {
          type: 'rect',
          from: { data: stacked ? 'stacked' : 'source' },
          encode: {
            enter: {
              ...(isHorizontal ? {
                y: { scale: 'xscale', field: resolvedXField },
                height: { scale: 'xscale', band: 1 },
                x: stacked ? { scale: 'yscale', field: 'y0' } : { scale: 'yscale', value: 0 },
                x2: { scale: 'yscale', field: stacked ? 'y1' : valField }
              } : {
                x: { scale: 'xscale', field: resolvedXField },
                width: { scale: 'xscale', band: 1 },
                y: stacked ? { scale: 'yscale', field: 'y0' } : { scale: 'yscale', value: 0 },
                y2: { scale: 'yscale', field: stacked ? 'y1' : valField }
              }),
              fill: resolvedColorField 
                ? { scale: 'color', field: resolvedColorField }
                : this.getFillColor(),
              ...this.getStrokeProps(),
              cornerRadius: { value: cornerRadius }
            },
            update: {
              fillOpacity: { value: opacity }
            },
            hover: {
              fillOpacity: { value: Math.max(0.5, opacity - 0.2) }
            }
          }
        },
        ...(showLabels ? [{
          type: 'text',
          from: { data: stacked ? 'stacked' : 'source' },
          encode: {
            enter: {
              ...(isHorizontal ? {
                y: { scale: 'xscale', field: resolvedXField, band: 0.5 },
                x: { scale: 'yscale', field: stacked ? 'y1' : valField, offset: 3 }
              } : {
                x: { scale: 'xscale', field: resolvedXField, band: 0.5 },
                y: { scale: 'yscale', field: stacked ? 'y1' : valField, offset: -5 }
              }),
              text: { field: valField },
              align: { value: 'center' },
              baseline: { value: isHorizontal ? 'middle' : 'bottom' },
              fontSize: { value: 12 },
              fontWeight: { value: 600 },
              fill: { value: '#ffffff' },
              stroke: { value: '#000000' },
              strokeWidth: { value: 0.3 }
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
      xField, yField, colorField, orientation = 'vertical', stacked,
      showLabels, showGrid = true, cornerRadius = 4, barOpacity = 1,
      barPadding = 0.2, xAxisLabelAngle = -45
    } = this.config;

    // Use actual aggregation config structure
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const splitBy = aggregation?.splitBy;
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || xField;
    const bucketType = bucketAgg?.type || 'terms';
    const bucketOptions = bucketAgg?.options || {};

    const splitField = splitBy?.field || colorField;
    const splitOptions = splitBy?.options || { size: 10 };

    const metric = metrics[0];
    const metricType = metric?.type || 'count';
    const metricField = metric?.field || yField;

    const isHorizontal = orientation === 'horizontal';

    // Build bucket aggregation config
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
      bucketAggConfig = {
        field: bucketField,
        size: bucketOptions.size || 25,
        order: bucketOptions.orderBy ? { [bucketOptions.orderBy]: bucketOptions.orderDirection || 'desc' } : { '_count': 'desc' }
      };
    }

    // Build aggregation
    let aggs = {};
    if (splitField) {
      aggs = {
        primary: {
          [bucketType]: bucketAggConfig,
          aggs: {
            split: {
              terms: { field: splitField, size: splitOptions.size || 10 },
              aggs: metricType !== 'count' && metricField ? {
                metric_value: { [metricType]: { field: metricField } }
              } : {}
            }
          }
        }
      };
    } else {
      aggs = {
        primary: {
          [bucketType]: bucketAggConfig,
          aggs: metricType !== 'count' && metricField ? {
            metric_value: { [metricType]: { field: metricField } }
          } : {}
        }
      };
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

    const transforms = splitField ? [
      { flatten: ['split.buckets'], as: ['splitBucket'] },
      { calculate: 'datum.key_as_string || datum.key', as: 'category' },
      { calculate: 'datum.splitBucket.key', as: 'series' },
      { calculate: metricType !== 'count' ? 'datum.splitBucket.metric_value.value' : 'datum.splitBucket.doc_count', as: 'value' }
    ] : [
      { calculate: 'datum.key_as_string || datum.key', as: 'category' },
      { calculate: metricType !== 'count' ? 'datum.metric_value.value' : 'datum.doc_count', as: 'value' }
    ];

    const encoding = isHorizontal ? {
      y: {
        field: 'category',
        type: 'nominal',
        axis: { title: this.getXLabel(xField) },
        sort: '-x'
      },
      x: {
        field: 'value',
        type: 'quantitative',
        axis: { title: this.getYLabel(yField), grid: showGrid }
      }
    } : {
      x: {
        field: 'category',
        type: 'nominal',
        axis: { title: this.getXLabel(xField), labelAngle: xAxisLabelAngle },
        sort: '-y'
      },
      y: {
        field: 'value',
        type: 'quantitative',
        axis: { title: this.getYLabel(yField), grid: showGrid }
      }
    };

    if (splitField) {
      encoding.color = {
        field: 'series',
        type: 'nominal',
        scale: { scheme: colorScheme },
        legend: { title: this.getLegendLabel(colorField) }
      };
      if (stacked) {
        encoding[isHorizontal ? 'x' : 'y'].stack = 'zero';
      } else {
        encoding.xOffset = { field: 'series' };
      }
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Bar Chart',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.primary.buckets' }
      },
      transform: transforms,
      mark: {
        type: 'bar',
        cornerRadiusEnd: cornerRadius,
        opacity: barOpacity,
        tooltip: true
      },
      encoding,
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig(),
        bar: { discreteBandSize: { band: 1 - barPadding } },
        ...(this.config.backgroundColor && { background: this.config.backgroundColor }),
        ...(this.config.legendPosition && { legend: { orient: this.config.legendPosition } })
      }
    };
  }
}

export default BarChartGenerator;

