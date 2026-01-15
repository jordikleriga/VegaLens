/**
 * Boxplot Generator
 * Generates Vega specs for box plots
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class BoxplotGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'boxplot',
    name: 'Box Plot',
    description: 'Show statistical distribution with quartiles and outliers',
    category: 'distribution',
    icon: 'box'
  };

  static schema = {
    fields: [
      { name: 'categoryField', label: 'Category', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'orientation', label: 'Orientation', type: 'select', options: ['vertical', 'horizontal'], default: 'vertical' },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['grouped', 'faceted'], default: 'grouped', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'showOutliers', label: 'Show Outliers', type: 'boolean', default: true },
      { name: 'boxWidth', label: 'Box Width', type: 'number', min: 10, max: 100, default: 40 },
      { name: 'whiskerWidth', label: 'Whisker Width', type: 'number', min: 5, max: 50, default: 20 },
      { name: 'showMean', label: 'Show Mean', type: 'boolean', default: false },
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', default: true }
    ]
  };

  static example = {
    config: {
      categoryField: 'department',
      valueField: 'salary',
      title: 'Salary Distribution by Department',
      showOutliers: true
    },
    data: [
      { department: 'Engineering', salary: 85000 },
      { department: 'Engineering', salary: 92000 },
      { department: 'Engineering', salary: 78000 },
      { department: 'Engineering', salary: 105000 },
      { department: 'Sales', salary: 65000 },
      { department: 'Sales', salary: 72000 },
      { department: 'Sales', salary: 58000 },
      { department: 'Marketing', salary: 62000 },
      { department: 'Marketing', salary: 68000 },
      { department: 'Marketing', salary: 55000 }
    ]
  };

  generate(data) {
    const { 
      categoryField, valueField, orientation = 'vertical',
      showOutliers = true, boxWidth = 40, whiskerWidth = 20,
      showMean = false, showGrid = true
    } = this.config;
    
    const isHorizontal = orientation === 'horizontal';
    
    logger.debug('Generating boxplot spec', {
      event: 'boxplot_generate',
      categoryField,
      valueField,
      orientation
    });

    // Resolve field paths to actual data keys
    const resolvedCategoryField = this.resolveFieldPath(categoryField, data);
    const resolvedValueField = this.resolveFieldPath(valueField, data);

    return {
      ...this.getBaseSpec(),
      data: [
        {
          name: 'source',
          values: data || [],
          transform: [
            {
              type: 'aggregate',
              groupby: [resolvedCategoryField],
              ops: ['min', 'q1', 'median', 'q3', 'max', 'mean'],
              fields: [resolvedValueField, resolvedValueField, resolvedValueField, resolvedValueField, resolvedValueField, resolvedValueField],
              as: ['min', 'q1', 'median', 'q3', 'max', 'mean']
            },
            {
              type: 'formula',
              as: 'iqr',
              expr: 'datum.q3 - datum.q1'
            },
            {
              type: 'formula',
              as: 'lower',
              expr: 'max(datum.min, datum.q1 - 1.5 * datum.iqr)'
            },
            {
              type: 'formula',
              as: 'upper',
              expr: 'min(datum.max, datum.q3 + 1.5 * datum.iqr)'
            }
          ]
        }
      ],
      scales: [
        {
          name: 'xscale',
          type: 'band',
          domain: { data: 'source', field: resolvedCategoryField },
          range: isHorizontal ? 'height' : 'width',
          padding: 0.3
        },
        {
          name: 'yscale',
          type: 'linear',
          domain: { data: 'source', fields: ['min', 'max'] },
          range: isHorizontal ? 'width' : 'height',
          nice: true,
          zero: false
        }
      ],
      axes: [
        { 
          orient: isHorizontal ? 'left' : 'bottom', 
          scale: 'xscale', 
          title: this.getXLabel(categoryField)
        },
        { 
          orient: isHorizontal ? 'bottom' : 'left', 
          scale: 'yscale', 
          title: this.getYLabel(valueField),
          grid: showGrid
        }
      ],
      marks: [
        // Whiskers (vertical lines from lower to upper)
        {
          type: 'rule',
          from: { data: 'source' },
          encode: {
            enter: isHorizontal ? {
              y: { scale: 'xscale', field: resolvedCategoryField, band: 0.5 },
              x: { scale: 'yscale', field: 'lower' },
              x2: { scale: 'yscale', field: 'upper' },
              stroke: { value: '#444444' },
              strokeWidth: { value: 1 }
            } : {
              x: { scale: 'xscale', field: resolvedCategoryField, band: 0.5 },
              y: { scale: 'yscale', field: 'lower' },
              y2: { scale: 'yscale', field: 'upper' },
              stroke: { value: '#444444' },
              strokeWidth: { value: 1 }
            }
          }
        },
        // Lower whisker cap
        {
          type: 'rule',
          from: { data: 'source' },
          encode: {
            enter: isHorizontal ? {
              y: { scale: 'xscale', field: resolvedCategoryField, band: 0.5, offset: -whiskerWidth / 2 },
              y2: { scale: 'xscale', field: resolvedCategoryField, band: 0.5, offset: whiskerWidth / 2 },
              x: { scale: 'yscale', field: 'lower' },
              stroke: { value: '#444444' },
              strokeWidth: { value: 1 }
            } : {
              x: { scale: 'xscale', field: resolvedCategoryField, band: 0.5, offset: -whiskerWidth / 2 },
              x2: { scale: 'xscale', field: resolvedCategoryField, band: 0.5, offset: whiskerWidth / 2 },
              y: { scale: 'yscale', field: 'lower' },
              stroke: { value: '#444444' },
              strokeWidth: { value: 1 }
            }
          }
        },
        // Upper whisker cap
        {
          type: 'rule',
          from: { data: 'source' },
          encode: {
            enter: isHorizontal ? {
              y: { scale: 'xscale', field: resolvedCategoryField, band: 0.5, offset: -whiskerWidth / 2 },
              y2: { scale: 'xscale', field: resolvedCategoryField, band: 0.5, offset: whiskerWidth / 2 },
              x: { scale: 'yscale', field: 'upper' },
              stroke: { value: '#444444' },
              strokeWidth: { value: 1 }
            } : {
              x: { scale: 'xscale', field: resolvedCategoryField, band: 0.5, offset: -whiskerWidth / 2 },
              x2: { scale: 'xscale', field: resolvedCategoryField, band: 0.5, offset: whiskerWidth / 2 },
              y: { scale: 'yscale', field: 'upper' },
              stroke: { value: '#444444' },
              strokeWidth: { value: 1 }
            }
          }
        },
        // Box (IQR)
        {
          type: 'rect',
          from: { data: 'source' },
          encode: {
            enter: isHorizontal ? {
              yc: { scale: 'xscale', field: resolvedCategoryField, band: 0.5 },
              height: { value: boxWidth },
              x: { scale: 'yscale', field: 'q1' },
              x2: { scale: 'yscale', field: 'q3' },
              fill: this.getFillColor(),
              stroke: { value: '#333333' },
              strokeWidth: { value: 1 }
            } : {
              xc: { scale: 'xscale', field: resolvedCategoryField, band: 0.5 },
              width: { value: boxWidth },
              y: { scale: 'yscale', field: 'q1' },
              y2: { scale: 'yscale', field: 'q3' },
              fill: this.getFillColor(),
              stroke: { value: '#333333' },
              strokeWidth: { value: 1 }
            }
          }
        },
        // Median line
        {
          type: 'rule',
          from: { data: 'source' },
          encode: {
            enter: isHorizontal ? {
              y: { scale: 'xscale', field: resolvedCategoryField, band: 0.5, offset: -boxWidth / 2 },
              y2: { scale: 'xscale', field: resolvedCategoryField, band: 0.5, offset: boxWidth / 2 },
              x: { scale: 'yscale', field: 'median' },
              stroke: { value: '#ffffff' },
              strokeWidth: { value: 2 }
            } : {
              x: { scale: 'xscale', field: resolvedCategoryField, band: 0.5, offset: -boxWidth / 2 },
              x2: { scale: 'xscale', field: resolvedCategoryField, band: 0.5, offset: boxWidth / 2 },
              y: { scale: 'yscale', field: 'median' },
              stroke: { value: '#ffffff' },
              strokeWidth: { value: 2 }
            }
          }
        },
        // Mean point (optional)
        ...(showMean ? [{
          type: 'symbol',
          from: { data: 'source' },
          encode: {
            enter: isHorizontal ? {
              y: { scale: 'xscale', field: resolvedCategoryField, band: 0.5 },
              x: { scale: 'yscale', field: 'mean' },
              shape: { value: 'diamond' },
              size: { value: 60 },
              fill: { value: '#f59e0b' },
              stroke: { value: '#ffffff' },
              strokeWidth: { value: 1 }
            } : {
              x: { scale: 'xscale', field: resolvedCategoryField, band: 0.5 },
              y: { scale: 'yscale', field: 'mean' },
              shape: { value: 'diamond' },
              size: { value: 60 },
              fill: { value: '#f59e0b' },
              stroke: { value: '#ffffff' },
              strokeWidth: { value: 1 }
            }
          }
        }] : [])
      ]
    };
  }

  /**
   * Generate Kibana-compatible Vega spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const { categoryField, valueField } = this.config;

    // Use actual aggregation config structure (NEW PATTERN)
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || categoryField;
    const metric = metrics[0];
    const metricField = metric?.field || valueField;

    // Box plots need percentile aggregation
    const aggs = {
      categories: {
        terms: { field: bucketField, size: 20 },
        aggs: {
          stats: {
            percentiles: {
              field: metricField,
              percents: [0, 25, 50, 75, 100]
            }
          },
          avg_val: {
            avg: { field: metricField }
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

    if (useContext) {
      urlConfig['%context%'] = true;
      urlConfig['%timefield%'] = timeField;
    }

    const orientation = this.config.orientation || 'vertical';
    const isHorizontal = orientation === 'horizontal';
    const boxWidth = this.config.boxWidth || 40;
    const whiskerWidth = this.config.whiskerWidth || 20;
    const showGrid = this.config.showGrid !== false;
    const showMean = this.config.showMean || false;

    return {
      ...this.getKibanaBaseSpec(),
      data: [
        {
          name: 'source',
          url: urlConfig,
          format: { property: 'aggregations.categories.buckets' },
          transform: [
            { type: 'formula', expr: 'datum.key', as: categoryField },
            { type: 'formula', expr: "datum.stats.values['0.0']", as: 'min' },
            { type: 'formula', expr: "datum.stats.values['25.0']", as: 'q1' },
            { type: 'formula', expr: "datum.stats.values['50.0']", as: 'median' },
            { type: 'formula', expr: "datum.stats.values['75.0']", as: 'q3' },
            { type: 'formula', expr: "datum.stats.values['100.0']", as: 'max' },
            { type: 'formula', expr: 'datum.q3 - datum.q1', as: 'iqr' },
            { type: 'formula', expr: 'max(datum.min, datum.q1 - 1.5 * datum.iqr)', as: 'lower' },
            { type: 'formula', expr: 'min(datum.max, datum.q3 + 1.5 * datum.iqr)', as: 'upper' },
            { type: 'formula', expr: 'datum.avg_val.value', as: 'mean' }
          ]
        }
      ],
      scales: [
        {
          name: 'xscale',
          type: 'band',
          domain: { data: 'source', field: categoryField },
          range: isHorizontal ? 'height' : 'width',
          padding: 0.3
        },
        {
          name: 'yscale',
          type: 'linear',
          domain: { data: 'source', fields: ['min', 'max'] },
          range: isHorizontal ? 'width' : 'height',
          nice: true,
          zero: false
        }
      ],
      axes: [
        {
          orient: isHorizontal ? 'left' : 'bottom',
          scale: 'xscale',
          title: this.getXLabel(categoryField)
        },
        {
          orient: isHorizontal ? 'bottom' : 'left',
          scale: 'yscale',
          title: this.getYLabel(valueField),
          grid: showGrid
        }
      ],
      marks: [
        // Whiskers (vertical lines from lower to upper)
        {
          type: 'rule',
          from: { data: 'source' },
          encode: {
            enter: isHorizontal ? {
              y: { scale: 'xscale', field: categoryField, band: 0.5 },
              x: { scale: 'yscale', field: 'lower' },
              x2: { scale: 'yscale', field: 'upper' },
              stroke: { value: '#444444' },
              strokeWidth: { value: 1 }
            } : {
              x: { scale: 'xscale', field: categoryField, band: 0.5 },
              y: { scale: 'yscale', field: 'lower' },
              y2: { scale: 'yscale', field: 'upper' },
              stroke: { value: '#444444' },
              strokeWidth: { value: 1 }
            }
          }
        },
        // Lower whisker cap
        {
          type: 'rule',
          from: { data: 'source' },
          encode: {
            enter: isHorizontal ? {
              y: { scale: 'xscale', field: categoryField, band: 0.5, offset: -whiskerWidth / 2 },
              y2: { scale: 'xscale', field: categoryField, band: 0.5, offset: whiskerWidth / 2 },
              x: { scale: 'yscale', field: 'lower' },
              stroke: { value: '#444444' },
              strokeWidth: { value: 1 }
            } : {
              x: { scale: 'xscale', field: categoryField, band: 0.5, offset: -whiskerWidth / 2 },
              x2: { scale: 'xscale', field: categoryField, band: 0.5, offset: whiskerWidth / 2 },
              y: { scale: 'yscale', field: 'lower' },
              stroke: { value: '#444444' },
              strokeWidth: { value: 1 }
            }
          }
        },
        // Upper whisker cap
        {
          type: 'rule',
          from: { data: 'source' },
          encode: {
            enter: isHorizontal ? {
              y: { scale: 'xscale', field: categoryField, band: 0.5, offset: -whiskerWidth / 2 },
              y2: { scale: 'xscale', field: categoryField, band: 0.5, offset: whiskerWidth / 2 },
              x: { scale: 'yscale', field: 'upper' },
              stroke: { value: '#444444' },
              strokeWidth: { value: 1 }
            } : {
              x: { scale: 'xscale', field: categoryField, band: 0.5, offset: -whiskerWidth / 2 },
              x2: { scale: 'xscale', field: categoryField, band: 0.5, offset: whiskerWidth / 2 },
              y: { scale: 'yscale', field: 'upper' },
              stroke: { value: '#444444' },
              strokeWidth: { value: 1 }
            }
          }
        },
        // Box (from q1 to q3)
        {
          type: 'rect',
          from: { data: 'source' },
          encode: {
            enter: isHorizontal ? {
              y: { scale: 'xscale', field: categoryField, band: 0.5, offset: -boxWidth / 2 },
              y2: { scale: 'xscale', field: categoryField, band: 0.5, offset: boxWidth / 2 },
              x: { scale: 'yscale', field: 'q1' },
              x2: { scale: 'yscale', field: 'q3' },
              fill: { value: '#3b82f6' },
              stroke: { value: '#444444' }
            } : {
              x: { scale: 'xscale', field: categoryField, band: 0.5, offset: -boxWidth / 2 },
              x2: { scale: 'xscale', field: categoryField, band: 0.5, offset: boxWidth / 2 },
              y: { scale: 'yscale', field: 'q1' },
              y2: { scale: 'yscale', field: 'q3' },
              fill: { value: '#3b82f6' },
              stroke: { value: '#444444' }
            }
          }
        },
        // Median line
        {
          type: 'rule',
          from: { data: 'source' },
          encode: {
            enter: isHorizontal ? {
              y: { scale: 'xscale', field: categoryField, band: 0.5, offset: -boxWidth / 2 },
              y2: { scale: 'xscale', field: categoryField, band: 0.5, offset: boxWidth / 2 },
              x: { scale: 'yscale', field: 'median' },
              stroke: { value: '#ffffff' },
              strokeWidth: { value: 2 }
            } : {
              x: { scale: 'xscale', field: categoryField, band: 0.5, offset: -boxWidth / 2 },
              x2: { scale: 'xscale', field: categoryField, band: 0.5, offset: boxWidth / 2 },
              y: { scale: 'yscale', field: 'median' },
              stroke: { value: '#ffffff' },
              strokeWidth: { value: 2 }
            }
          }
        },
        // Mean point (optional)
        ...(showMean ? [{
          type: 'symbol',
          from: { data: 'source' },
          encode: {
            enter: isHorizontal ? {
              y: { scale: 'xscale', field: categoryField, band: 0.5 },
              x: { scale: 'yscale', field: 'mean' },
              shape: { value: 'diamond' },
              size: { value: 60 },
              fill: { value: '#f59e0b' },
              stroke: { value: '#ffffff' },
              strokeWidth: { value: 1 }
            } : {
              x: { scale: 'xscale', field: categoryField, band: 0.5 },
              y: { scale: 'yscale', field: 'mean' },
              shape: { value: 'diamond' },
              size: { value: 60 },
              fill: { value: '#f59e0b' },
              stroke: { value: '#ffffff' },
              strokeWidth: { value: 1 }
            }
          }
        }] : [])
      ],
      description: 'Box Plot with Elasticsearch data source'
    };
  }
}

export default BoxplotGenerator;

