/**
 * Ternary Chart Generator
 * Generates Vega-Lite specs for ternary/triangle charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class TernaryGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'ternary',
    name: 'Ternary Chart',
    description: 'Plot three variables that sum to 100% on a triangular coordinate system',
    category: 'composition',
    icon: 'triangle'
  };

  static schema = {
    fields: [
      { name: 'labelField', label: 'Label', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'topField', label: 'Top Variable', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'leftField', label: 'Left Variable', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'rightField', label: 'Right Variable', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'sizeField', label: 'Size By', type: 'field', required: false, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['color', 'shape', 'faceted'], default: 'color', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'topLabel', label: 'Top Label', type: 'text', default: 'Top 100%' },
      { name: 'leftLabel', label: 'Left Label', type: 'text', default: 'Left 100%' },
      { name: 'rightLabel', label: 'Right Label', type: 'text', default: 'Right 100%' },
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', default: true },
      { name: 'showLabels', label: 'Show Point Labels', type: 'boolean', default: true }
    ]
  };

  static example = {
    config: {
      labelField: 'soil',
      topField: 'clay',
      leftField: 'sand',
      rightField: 'silt',
      topLabel: 'Clay',
      leftLabel: 'Sand',
      rightLabel: 'Silt',
      title: 'Soil Composition'
    },
    data: [
      { soil: 'Sample A', clay: 40, sand: 30, silt: 30 },
      { soil: 'Sample B', clay: 20, sand: 50, silt: 30 },
      { soil: 'Sample C', clay: 30, sand: 40, silt: 30 },
      { soil: 'Sample D', clay: 15, sand: 25, silt: 60 }
    ]
  };

  generate(data) {
    const {
      labelField = 'label', topField = 'top', leftField = 'left', rightField = 'right',
      sizeField, topLabel = 'Top 100%', leftLabel = 'Left 100%', rightLabel = 'Right 100%',
      showGrid = true, showLabels = true
    } = this.config;

    logger.debug('Generating ternary chart spec', {
      event: 'ternary_generate',
      labelField,
      topField,
      leftField,
      rightField
    });

    const pointColor = this.colorConfig.singleColor || VegaGeneratorBase.DEFAULTS.singleColor;

    const layers = [];

    // Triangle background
    layers.push({
      data: {
        values: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 0.866 }
        ]
      },
      mark: { 
        type: 'line', 
        fill: '#c8edf1', 
        fillOpacity: 0.3,
        interpolate: 'linear-closed',
        stroke: '#444444', 
        strokeWidth: 2 
      },
      encoding: {
        x: { field: 'x', type: 'quantitative', scale: { domain: [-0.1, 1.1] }, axis: null },
        y: { field: 'y', type: 'quantitative', scale: { domain: [-0.1, 0.97] }, axis: null }
      }
    });

    // Vertex labels
    layers.push({
      data: {
        values: [
          { x: -0.05, y: -0.05, label: leftLabel },
          { x: 1.05, y: -0.05, label: rightLabel },
          { x: 0.5, y: 0.92, label: topLabel }
        ]
      },
      mark: { type: 'text', fontSize: 13, fontWeight: 'bold' },
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
        text: { field: 'label', type: 'nominal' },
        color: { value: '#000000' }
      }
    });

    // Grid lines
    if (showGrid) {
      const gridLines = [];
      for (let i = 1; i <= 9; i++) {
        const t = i * 0.1;
        gridLines.push({ x: t * 0.5, y: t * 0.866, x2: 1 - t * 0.5, y2: t * 0.866 });
        gridLines.push({ x: t, y: 0, x2: 0.5 + t * 0.5, y2: 0.866 - t * 0.866 });
        gridLines.push({ x: t, y: 0, x2: t * 0.5, y2: t * 0.866 });
      }
      
      layers.push({
        data: { values: gridLines },
        mark: { type: 'rule', stroke: '#696969', strokeDash: [2, 2], strokeOpacity: 0.5 },
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
          x2: { field: 'x2' },
          y2: { field: 'y2' }
        }
      });
    }

    // Data point transforms
    const dataTransforms = [
      { calculate: `datum['${topField}'] + datum['${leftField}'] + datum['${rightField}']`, as: 'total' },
      { calculate: `datum['${topField}'] / datum.total`, as: 'top_pct' },
      { calculate: `datum['${leftField}'] / datum.total`, as: 'left_pct' },
      { calculate: `datum['${rightField}'] / datum.total`, as: 'right_pct' },
      { calculate: '0.5 * (2 * datum.right_pct + datum.top_pct)', as: 'x' },
      { calculate: '0.866 * datum.top_pct', as: 'y' },
      { calculate: `format(datum.top_pct * 100, '.1f') + '%'`, as: 'top_tooltip' },
      { calculate: `format(datum.left_pct * 100, '.1f') + '%'`, as: 'left_tooltip' },
      { calculate: `format(datum.right_pct * 100, '.1f') + '%'`, as: 'right_tooltip' }
    ];

    const pointEncoding = {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      fill: { value: pointColor },
      tooltip: [
        { field: labelField, type: 'nominal', title: 'Name' },
        { field: 'top_tooltip', type: 'nominal', title: topLabel.replace(' 100%', '') },
        { field: 'left_tooltip', type: 'nominal', title: leftLabel.replace(' 100%', '') },
        { field: 'right_tooltip', type: 'nominal', title: rightLabel.replace(' 100%', '') }
      ]
    };

    if (sizeField) {
      pointEncoding.size = {
        field: sizeField,
        type: 'quantitative',
        scale: { range: [50, 500] },
        legend: { title: sizeField }
      };
    }

    layers.push({
      data: { values: data || [] },
      transform: dataTransforms,
      mark: { 
        type: 'point', 
        filled: true,
        size: sizeField ? undefined : 150,
        stroke: '#1e293b',
        strokeWidth: 1.5,
        opacity: 0.9
      },
      encoding: pointEncoding
    });

    // Point labels
    if (showLabels) {
      layers.push({
        data: { values: data || [] },
        transform: dataTransforms,
        mark: { type: 'text', dy: -15, fontSize: 11, fontWeight: 500 },
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
          text: { field: labelField, type: 'nominal' },
          color: { value: '#000000' }
        }
      });
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Ternary chart showing three-component composition',
      width: this.config.width || 600,
      height: this.config.height || 520,
      padding: 50,
      title: this.config.title || '',
      layer: layers,
      config: {
        view: { stroke: null },
        background: 'transparent',
        axis: { disable: true, grid: false }
      }
    };
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const { labelField, topField, leftField, rightField } = this.config;

    // Use actual aggregation config structure (NEW PATTERN)
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || labelField;

    // Get the metric fields from aggregation config
    // Ternary charts have 3 metrics: top, left, right (in order)
    // Fall back to config fields if aggregation metrics not available
    const topMetric = metrics[0] || {};
    const leftMetric = metrics[1] || {};
    const rightMetric = metrics[2] || {};

    const topMetricType = topMetric.type || 'avg';
    const leftMetricType = leftMetric.type || 'avg';
    const rightMetricType = rightMetric.type || 'avg';

    // Use ES field names from aggregation config, fall back to config fields
    const topEsField = topMetric.field || topField;
    const leftEsField = leftMetric.field || leftField;
    const rightEsField = rightMetric.field || rightField;

    // Ternary needs three metrics - each can have its own type
    const aggs = {
      primary: {
        terms: { field: bucketField, size: 20 },
        aggs: {
          top_metric: { [topMetricType]: { field: topEsField } },
          left_metric: { [leftMetricType]: { field: leftEsField } },
          right_metric: { [rightMetricType]: { field: rightEsField } }
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

    const {
      topLabel = 'Top 100%', leftLabel = 'Left 100%', rightLabel = 'Right 100%',
      showGrid = true, showLabels = true
    } = this.config;
    const pointColor = this.colorConfig?.singleColor || VegaGeneratorBase.DEFAULTS.singleColor;

    // Build grid line data
    const gridLines = [];
    if (showGrid) {
      for (let i = 1; i <= 9; i++) {
        const t = i * 0.1;
        gridLines.push({ x: t * 0.5, y: t * 0.866, x2: 1 - t * 0.5, y2: t * 0.866 });
        gridLines.push({ x: t, y: 0, x2: 0.5 + t * 0.5, y2: 0.866 - t * 0.866 });
        gridLines.push({ x: t, y: 0, x2: t * 0.5, y2: t * 0.866 });
      }
    }

    // Use full Vega spec for Kibana (better handling of multiple data sources)
    return {
      $schema: 'https://vega.github.io/schema/vega/v5.json',
      description: 'Ternary Chart with Elasticsearch data source',
      padding: 50,
      background: 'transparent',
      config: {
        kibana: { hideWarnings: true }
      },

      signals: [
        { name: 'width', value: 500 },
        { name: 'height', value: 450 }
      ],

      data: [
        // Triangle path (single value for path mark)
        {
          name: 'trianglePath',
          values: [{}]
        },
        // Vertex labels
        {
          name: 'labels',
          values: [
            { x: -0.05, y: -0.05, label: leftLabel },
            { x: 1.05, y: -0.05, label: rightLabel },
            { x: 0.5, y: 0.92, label: topLabel }
          ]
        },
        // Grid lines
        {
          name: 'grid',
          values: gridLines
        },
        // ES data
        {
          name: 'esData',
          url: urlConfig,
          format: { property: 'aggregations.primary.buckets' },
          transform: [
            { type: 'formula', expr: 'datum.key', as: 'category' },
            { type: 'formula', expr: 'datum.top_metric.value', as: 'top_val' },
            { type: 'formula', expr: 'datum.left_metric.value', as: 'left_val' },
            { type: 'formula', expr: 'datum.right_metric.value', as: 'right_val' },
            { type: 'formula', expr: 'datum.top_val + datum.left_val + datum.right_val', as: 'total' },
            { type: 'formula', expr: 'datum.top_val / datum.total', as: 'top_pct' },
            { type: 'formula', expr: 'datum.left_val / datum.total', as: 'left_pct' },
            { type: 'formula', expr: 'datum.right_val / datum.total', as: 'right_pct' },
            { type: 'formula', expr: '0.5 * (2 * datum.right_pct + datum.top_pct)', as: 'x' },
            { type: 'formula', expr: '0.866 * datum.top_pct', as: 'y' }
          ]
        }
      ],

      scales: [
        {
          name: 'xscale',
          type: 'linear',
          domain: [-0.1, 1.1],
          range: 'width'
        },
        {
          name: 'yscale',
          type: 'linear',
          domain: [-0.1, 0.97],
          range: 'height'
        }
      ],

      marks: [
        // Triangle background using path mark
        {
          type: 'path',
          from: { data: 'trianglePath' },
          encode: {
            enter: {
              path: { signal: "'M' + scale('xscale', 0) + ',' + scale('yscale', 0) + 'L' + scale('xscale', 1) + ',' + scale('yscale', 0) + 'L' + scale('xscale', 0.5) + ',' + scale('yscale', 0.866) + 'Z'" },
              stroke: { value: '#444444' },
              strokeWidth: { value: 2 },
              fill: { value: '#c8edf1' },
              fillOpacity: { value: 0.3 }
            }
          }
        },
        // Vertex labels
        {
          type: 'text',
          from: { data: 'labels' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: 'x' },
              y: { scale: 'yscale', field: 'y' },
              text: { field: 'label' },
              fontSize: { value: 13 },
              fontWeight: { value: 'bold' },
              fill: { value: '#000000' },
              align: { value: 'center' },
              baseline: { value: 'middle' }
            }
          }
        },
        // Grid lines
        ...(showGrid ? [{
          type: 'rule',
          from: { data: 'grid' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: 'x' },
              y: { scale: 'yscale', field: 'y' },
              x2: { scale: 'xscale', field: 'x2' },
              y2: { scale: 'yscale', field: 'y2' },
              stroke: { value: '#696969' },
              strokeDash: { value: [2, 2] },
              strokeOpacity: { value: 0.5 }
            }
          }
        }] : []),
        // Data points
        {
          type: 'symbol',
          from: { data: 'esData' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: 'x' },
              y: { scale: 'yscale', field: 'y' },
              size: { value: 150 },
              fill: { value: pointColor },
              stroke: { value: '#1e293b' },
              strokeWidth: { value: 1.5 },
              fillOpacity: { value: 0.9 },
              tooltip: {
                signal: `{'Category': datum.category, '${topLabel.replace(' 100%', '')}': format(datum.top_pct * 100, '.1f') + '%', '${leftLabel.replace(' 100%', '')}': format(datum.left_pct * 100, '.1f') + '%', '${rightLabel.replace(' 100%', '')}': format(datum.right_pct * 100, '.1f') + '%'}`
              }
            }
          }
        },
        // Point labels
        ...(showLabels ? [{
          type: 'text',
          from: { data: 'esData' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: 'x' },
              y: { scale: 'yscale', field: 'y', offset: -15 },
              text: { field: 'category' },
              fontSize: { value: 11 },
              fontWeight: { value: 500 },
              fill: { value: '#000000' },
              align: { value: 'center' },
              baseline: { value: 'bottom' }
            }
          }
        }] : [])
      ]
    };
  }
}

export default TernaryGenerator;

