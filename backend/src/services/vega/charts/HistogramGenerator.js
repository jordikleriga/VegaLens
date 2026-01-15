/**
 * Histogram Generator
 * Generates Vega specs for histograms
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class HistogramGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'histogram',
    name: 'Histogram',
    description: 'Show distribution of a numeric variable',
    category: 'distribution',
    icon: 'bar-chart'
  };

  static schema = {
    fields: [
      { name: 'valueField', label: 'Value', type: 'field', required: false, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'field', label: 'Field (deprecated, use valueField)', type: 'field', required: false, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'bins', label: 'Number of Bins', type: 'number', min: 5, max: 100, default: 20 },
      { name: 'colorField', label: 'Color By', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['stacked', 'overlapping', 'faceted'], default: 'stacked', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'showDensity', label: 'Show Density Curve', type: 'boolean', default: false },
      { name: 'cornerRadius', label: 'Corner Radius', type: 'number', min: 0, max: 10, default: 2 },
      { name: 'barPadding', label: 'Bar Padding', type: 'number', min: 0, max: 0.5, step: 0.05, default: 0.05 },
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', default: true }
    ]
  };

  static example = {
    config: {
      valueField: 'age',
      title: 'Age Distribution',
      bins: 15,
      cornerRadius: 2
    },
    data: Array.from({ length: 100 }, () => ({
      age: Math.floor(Math.random() * 60) + 18
    }))
  };

  generate(data) {
    const {
      valueField, field, bins = 20, colorField,
      showDensity = false, cornerRadius = 2, barPadding = 0.05,
      showGrid = true
    } = this.config;

    // Support both 'field' and 'valueField' for backwards compatibility
    const targetField = valueField || field;

    logger.debug('Generating histogram spec', {
      event: 'histogram_generate',
      valueField: targetField,
      bins
    });

    // Resolve field paths to actual data keys
    const resolvedValueField = this.resolveFieldPath(targetField, data);
    const resolvedColorField = colorField ? this.resolveFieldPath(colorField, data) : null;

    return {
      ...this.getBaseSpec(),
      data: [
        {
          name: 'source',
          values: data || [],
          transform: [
            {
              type: 'bin',
              field: resolvedValueField,
              maxbins: bins,
              as: ['bin0', 'bin1']
            },
            {
              type: 'aggregate',
              groupby: resolvedColorField ? ['bin0', 'bin1', resolvedColorField] : ['bin0', 'bin1'],
              ops: ['count'],
              as: ['count']
            }
          ]
        }
      ],
      scales: [
        {
          name: 'xscale',
          type: 'linear',
          domain: { data: 'source', fields: ['bin0', 'bin1'] },
          range: 'width',
          nice: true
        },
        {
          name: 'yscale',
          type: 'linear',
          domain: { data: 'source', field: 'count' },
          range: 'height',
          nice: true,
          zero: true
        },
        ...(resolvedColorField ? [this.getColorScale(resolvedColorField)] : [])
      ],
      axes: [
        { orient: 'bottom', scale: 'xscale', title: this.getXLabel(valueField), grid: showGrid },
        { orient: 'left', scale: 'yscale', title: 'Count', grid: showGrid }
      ],
      ...(resolvedColorField ? {
        legends: [{ fill: 'color', title: this.getLegendLabel(colorField), orient: 'right' }]
      } : {}),
      marks: [
        {
          type: 'rect',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: 'bin0', offset: 1 },
              x2: { scale: 'xscale', field: 'bin1' },
              y: { scale: 'yscale', field: 'count' },
              y2: { scale: 'yscale', value: 0 },
              fill: resolvedColorField 
                ? { scale: 'color', field: resolvedColorField }
                : this.getFillColor(),
              cornerRadiusTopLeft: { value: cornerRadius },
              cornerRadiusTopRight: { value: cornerRadius },
              ...this.getStrokeProps()
            },
            update: { fillOpacity: { value: this.getOpacity() } },
            hover: { fillOpacity: { value: Math.max(0.5, this.getOpacity() - 0.2) } }
          }
        }
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
      valueField, bins = 20, colorField,
      cornerRadius = 2, barPadding = 0.05, showGrid = true
    } = this.config;

    // Use actual aggregation config structure
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const splitBy = aggregation?.splitBy;
    const metrics = aggregation?.metrics || [];

    const metricField = bucketAgg?.field || valueField;
    const bucketOptions = bucketAgg?.options || {};
    const splitField = splitBy?.field || colorField;

    // For histogram, we use histogram aggregation in ES
    const aggs = {
      histogram: {
        histogram: {
          field: metricField,
          interval: bucketOptions.interval || 10,
          min_doc_count: 0
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

    if (useContext) {
      urlConfig['%context%'] = true;
      urlConfig['%timefield%'] = timeField;
    }

    const colorScheme = this.config.colorScheme || 'tableau10';

    const transforms = [
      { calculate: 'datum.key', as: 'bin_start' },
      { calculate: 'datum.doc_count', as: 'count' }
    ];

    // Add series field transform if split field is configured
    // Note: For full split histogram support, nested aggregations would be needed
    if (splitField) {
      transforms.push({ calculate: `'${splitField}'`, as: 'series' });
    }

    const encoding = {
      x: {
        field: 'bin_start',
        type: 'quantitative',
        axis: { title: this.getXLabel(valueField), grid: showGrid },
        bin: { binned: true }
      },
      x2: { field: 'bin_start' },
      y: {
        field: 'count',
        type: 'quantitative',
        axis: { title: 'Count', grid: showGrid }
      }
    };

    if (splitField) {
      encoding.color = {
        field: 'series',
        type: 'nominal',
        scale: { scheme: colorScheme }
      };
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Histogram',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.histogram.buckets' }
      },
      transform: transforms,
      mark: {
        type: 'bar',
        cornerRadiusEnd: cornerRadius
      },
      encoding,
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig(),
        bar: { discreteBandSize: { band: 1 - barPadding } }
      }
    };
  }
}

export default HistogramGenerator;

