/**
 * Violin Chart Generator
 * Generates Vega specs for violin plots showing distribution density
 * Combines a rotated kernel density plot with a box plot
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class ViolinGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'violin',
    name: 'Violin Plot',
    description: 'Show distribution shape with density estimation and quartiles',
    category: 'distribution',
    icon: 'activity'
  };

  static schema = {
    fields: [
      { name: 'categoryField', label: 'Category', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'orientation', label: 'Orientation', type: 'select', options: ['vertical', 'horizontal'], default: 'vertical' },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['split', 'grouped'], default: 'split', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'bandwidth', label: 'KDE Bandwidth', type: 'number', min: 0.1, max: 100, default: null },
      { name: 'resolution', label: 'Density Resolution', type: 'number', min: 50, max: 500, default: 100 },
      { name: 'showBoxplot', label: 'Show Box Plot', type: 'boolean', default: true },
      { name: 'showMedian', label: 'Show Median', type: 'boolean', default: true },
      { name: 'showMean', label: 'Show Mean', type: 'boolean', default: false },
      { name: 'violinWidth', label: 'Violin Width', type: 'number', min: 20, max: 200, default: 80 },
      { name: 'boxWidth', label: 'Box Width', type: 'number', min: 5, max: 40, default: 12 },
      { name: 'colorScheme', label: 'Color Scheme', type: 'select', options: ['category10', 'tableau10', 'set2', 'pastel1'], default: 'category10' }
    ]
  };

  static example = {
    config: {
      categoryField: 'species',
      valueField: 'sepal_length',
      title: 'Sepal Length Distribution by Species',
      showBoxplot: true,
      showMedian: true
    },
    data: [
      { species: 'setosa', sepal_length: 5.1 },
      { species: 'setosa', sepal_length: 4.9 },
      { species: 'setosa', sepal_length: 4.7 },
      { species: 'setosa', sepal_length: 5.0 },
      { species: 'setosa', sepal_length: 5.4 },
      { species: 'versicolor', sepal_length: 7.0 },
      { species: 'versicolor', sepal_length: 6.4 },
      { species: 'versicolor', sepal_length: 6.9 },
      { species: 'versicolor', sepal_length: 5.5 },
      { species: 'versicolor', sepal_length: 6.5 },
      { species: 'virginica', sepal_length: 6.3 },
      { species: 'virginica', sepal_length: 5.8 },
      { species: 'virginica', sepal_length: 7.1 },
      { species: 'virginica', sepal_length: 6.3 },
      { species: 'virginica', sepal_length: 6.5 }
    ]
  };

  generate(data) {
    const {
      categoryField,
      valueField,
      orientation = 'vertical',
      bandwidth = null,
      resolution = 100,
      showBoxplot = true,
      showMedian = true,
      showMean = false,
      violinWidth = 80,
      boxWidth = 12,
      colorScheme = 'category10'
    } = this.config;

    const isHorizontal = orientation === 'horizontal';

    logger.debug('Generating violin plot spec', {
      event: 'violin_generate',
      categoryField,
      valueField,
      orientation
    });

    // Resolve field paths
    const resolvedCategoryField = this.resolveFieldPath(categoryField, data);
    const resolvedValueField = this.resolveFieldPath(valueField, data);

    // Get unique categories
    const categories = [...new Set((data || []).map(d => d[resolvedCategoryField]))];

    // Calculate bandwidth if not provided (Silverman's rule of thumb)
    let calculatedBandwidth = bandwidth;
    if (!calculatedBandwidth && data && data.length > 0) {
      const values = data.map(d => d[resolvedValueField]).filter(v => typeof v === 'number');
      if (values.length > 0) {
        const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - values.reduce((a, b) => a + b, 0) / values.length, 2), 0) / values.length);
        const iqr = this.calculateIQR(values);
        calculatedBandwidth = 0.9 * Math.min(std, iqr / 1.34) * Math.pow(values.length, -0.2);
      }
    }
    calculatedBandwidth = calculatedBandwidth || 1;

    // Build density transforms for each category
    const densityTransforms = [
      {
        type: 'kde',
        field: resolvedValueField,
        groupby: [resolvedCategoryField],
        bandwidth: calculatedBandwidth,
        counts: true,
        as: ['value', 'density']
      }
    ];

    // Boxplot statistics transforms
    const statsTransforms = [
      {
        type: 'aggregate',
        groupby: [resolvedCategoryField],
        ops: ['min', 'q1', 'median', 'q3', 'max', 'mean', 'count'],
        fields: [resolvedValueField, resolvedValueField, resolvedValueField, resolvedValueField, resolvedValueField, resolvedValueField, resolvedValueField],
        as: ['min', 'q1', 'median', 'q3', 'max', 'mean', 'count']
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
    ];

    const marks = [];

    // Violin shapes (mirrored density plots)
    marks.push({
      type: 'group',
      from: {
        facet: {
          data: 'density',
          name: 'violin',
          groupby: [resolvedCategoryField]
        }
      },
      encode: {
        enter: isHorizontal ? {
          y: { scale: 'category', field: resolvedCategoryField, band: 0.5 }
        } : {
          x: { scale: 'category', field: resolvedCategoryField, band: 0.5 }
        }
      },
      marks: [
        {
          type: 'area',
          from: { data: 'violin' },
          encode: {
            enter: isHorizontal ? {
              x: { scale: 'value', field: 'value' },
              yc: { value: 0 },
              height: { scale: 'density', field: 'density' },
              fill: { scale: 'color', field: { parent: resolvedCategoryField } },
              fillOpacity: { value: 0.7 }
            } : {
              y: { scale: 'value', field: 'value' },
              xc: { value: 0 },
              width: { scale: 'density', field: 'density' },
              fill: { scale: 'color', field: { parent: resolvedCategoryField } },
              fillOpacity: { value: 0.7 }
            }
          }
        },
        // Mirror side
        {
          type: 'area',
          from: { data: 'violin' },
          encode: {
            enter: isHorizontal ? {
              x: { scale: 'value', field: 'value' },
              yc: { value: 0 },
              height: { scale: 'density', field: 'density', mult: -1 },
              fill: { scale: 'color', field: { parent: resolvedCategoryField } },
              fillOpacity: { value: 0.7 }
            } : {
              y: { scale: 'value', field: 'value' },
              xc: { value: 0 },
              width: { scale: 'density', field: 'density', mult: -1 },
              fill: { scale: 'color', field: { parent: resolvedCategoryField } },
              fillOpacity: { value: 0.7 }
            }
          }
        }
      ]
    });

    // Boxplot overlay
    if (showBoxplot) {
      // IQR box
      marks.push({
        type: 'rect',
        from: { data: 'stats' },
        encode: {
          enter: isHorizontal ? {
            yc: { scale: 'category', field: resolvedCategoryField, band: 0.5 },
            height: { value: boxWidth },
            x: { scale: 'value', field: 'q1' },
            x2: { scale: 'value', field: 'q3' },
            fill: { value: '#1e293b' },
            stroke: { value: '#444444' },
            strokeWidth: { value: 1 }
          } : {
            xc: { scale: 'category', field: resolvedCategoryField, band: 0.5 },
            width: { value: boxWidth },
            y: { scale: 'value', field: 'q1' },
            y2: { scale: 'value', field: 'q3' },
            fill: { value: '#1e293b' },
            stroke: { value: '#444444' },
            strokeWidth: { value: 1 }
          }
        }
      });

      // Whiskers
      marks.push({
        type: 'rule',
        from: { data: 'stats' },
        encode: {
          enter: isHorizontal ? {
            y: { scale: 'category', field: resolvedCategoryField, band: 0.5 },
            x: { scale: 'value', field: 'lower' },
            x2: { scale: 'value', field: 'upper' },
            stroke: { value: '#444444' },
            strokeWidth: { value: 1 }
          } : {
            x: { scale: 'category', field: resolvedCategoryField, band: 0.5 },
            y: { scale: 'value', field: 'lower' },
            y2: { scale: 'value', field: 'upper' },
            stroke: { value: '#444444' },
            strokeWidth: { value: 1 }
          }
        }
      });
    }

    // Median line
    if (showMedian) {
      marks.push({
        type: 'rule',
        from: { data: 'stats' },
        encode: {
          enter: isHorizontal ? {
            y: { scale: 'category', field: resolvedCategoryField, band: 0.5, offset: -boxWidth / 2 },
            y2: { scale: 'category', field: resolvedCategoryField, band: 0.5, offset: boxWidth / 2 },
            x: { scale: 'value', field: 'median' },
            stroke: { value: '#ffffff' },
            strokeWidth: { value: 2 }
          } : {
            x: { scale: 'category', field: resolvedCategoryField, band: 0.5, offset: -boxWidth / 2 },
            x2: { scale: 'category', field: resolvedCategoryField, band: 0.5, offset: boxWidth / 2 },
            y: { scale: 'value', field: 'median' },
            stroke: { value: '#ffffff' },
            strokeWidth: { value: 2 }
          }
        }
      });
    }

    // Mean point
    if (showMean) {
      marks.push({
        type: 'symbol',
        from: { data: 'stats' },
        encode: {
          enter: isHorizontal ? {
            y: { scale: 'category', field: resolvedCategoryField, band: 0.5 },
            x: { scale: 'value', field: 'mean' },
            shape: { value: 'diamond' },
            size: { value: 50 },
            fill: { value: '#f59e0b' },
            stroke: { value: '#ffffff' },
            strokeWidth: { value: 1 }
          } : {
            x: { scale: 'category', field: resolvedCategoryField, band: 0.5 },
            y: { scale: 'value', field: 'mean' },
            shape: { value: 'diamond' },
            size: { value: 50 },
            fill: { value: '#f59e0b' },
            stroke: { value: '#ffffff' },
            strokeWidth: { value: 1 }
          }
        }
      });
    }

    return {
      ...this.getBaseSpec(),
      data: [
        {
          name: 'source',
          values: data || []
        },
        {
          name: 'density',
          source: 'source',
          transform: densityTransforms
        },
        {
          name: 'stats',
          source: 'source',
          transform: statsTransforms
        }
      ],
      scales: [
        {
          name: 'category',
          type: 'band',
          domain: categories,
          range: isHorizontal ? 'height' : 'width',
          padding: 0.2
        },
        {
          name: 'value',
          type: 'linear',
          domain: { data: 'source', field: resolvedValueField },
          range: isHorizontal ? 'width' : 'height',
          nice: true,
          zero: false
        },
        {
          name: 'density',
          type: 'linear',
          domain: { data: 'density', field: 'density' },
          range: [0, violinWidth / 2]
        },
        {
          name: 'color',
          type: 'ordinal',
          domain: categories,
          range: { scheme: colorScheme }
        }
      ],
      axes: [
        {
          orient: isHorizontal ? 'left' : 'bottom',
          scale: 'category',
          title: this.getXLabel(categoryField)
        },
        {
          orient: isHorizontal ? 'bottom' : 'left',
          scale: 'value',
          title: this.getYLabel(valueField),
          grid: true
        }
      ],
      marks
    };
  }

  /**
   * Calculate interquartile range
   */
  calculateIQR(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const q1Idx = Math.floor(sorted.length * 0.25);
    const q3Idx = Math.floor(sorted.length * 0.75);
    return sorted[q3Idx] - sorted[q1Idx];
  }

  /**
   * Generate Kibana-compatible Vega spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      categoryField,
      valueField,
      orientation = 'vertical',
      showBoxplot = true,
      showMedian = true,
      showMean = false,
      violinWidth = 80,
      boxWidth = 12,
      colorScheme = 'category10'
    } = this.config;

    const isHorizontal = orientation === 'horizontal';

    // Use actual aggregation config structure
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || categoryField;
    const bucketOptions = bucketAgg?.options || {};

    const metric = metrics[0];
    const metricField = metric?.field || valueField;

    // Violin plots need percentile aggregation for accurate distribution
    const aggs = {
      categories: {
        terms: { field: bucketField, size: bucketOptions.size || 20 },
        aggs: {
          stats: {
            percentiles: {
              field: metricField,
              percents: [0, 5, 10, 25, 50, 75, 90, 95, 100]
            }
          },
          extended: {
            extended_stats: { field: metricField }
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

    // Build marks for Kibana spec (matching preview spec structure)
    const marks = [];

    // Violin shapes - simplified for Kibana (using box representation since KDE requires raw data)
    // We create a visual representation using the percentile data
    marks.push({
      type: 'group',
      from: {
        facet: {
          data: 'source',
          name: 'violin',
          groupby: [categoryField]
        }
      },
      encode: {
        enter: isHorizontal ? {
          y: { scale: 'category', field: categoryField, band: 0.5 }
        } : {
          x: { scale: 'category', field: categoryField, band: 0.5 }
        }
      },
      marks: [
        // Violin outline (using percentiles to approximate shape)
        {
          type: 'area',
          from: { data: 'violin' },
          encode: {
            enter: isHorizontal ? {
              x: { scale: 'value', field: 'median' },
              x2: { scale: 'value', field: 'q3' },
              yc: { value: 0 },
              height: { value: violinWidth * 0.7 },
              fill: { scale: 'color', field: categoryField },
              fillOpacity: { value: 0.7 }
            } : {
              y: { scale: 'value', field: 'median' },
              y2: { scale: 'value', field: 'q3' },
              xc: { value: 0 },
              width: { value: violinWidth * 0.7 },
              fill: { scale: 'color', field: categoryField },
              fillOpacity: { value: 0.7 }
            }
          }
        }
      ]
    });

    // IQR box (boxplot overlay)
    if (showBoxplot) {
      marks.push({
        type: 'rect',
        from: { data: 'source' },
        encode: {
          enter: isHorizontal ? {
            yc: { scale: 'category', field: categoryField, band: 0.5 },
            height: { value: boxWidth },
            x: { scale: 'value', field: 'q1' },
            x2: { scale: 'value', field: 'q3' },
            fill: { value: '#1e293b' },
            stroke: { value: '#444444' },
            strokeWidth: { value: 1 }
          } : {
            xc: { scale: 'category', field: categoryField, band: 0.5 },
            width: { value: boxWidth },
            y: { scale: 'value', field: 'q1' },
            y2: { scale: 'value', field: 'q3' },
            fill: { value: '#1e293b' },
            stroke: { value: '#444444' },
            strokeWidth: { value: 1 }
          }
        }
      });

      // Whiskers
      marks.push({
        type: 'rule',
        from: { data: 'source' },
        encode: {
          enter: isHorizontal ? {
            y: { scale: 'category', field: categoryField, band: 0.5 },
            x: { scale: 'value', field: 'min' },
            x2: { scale: 'value', field: 'max' },
            stroke: { value: '#444444' },
            strokeWidth: { value: 1 }
          } : {
            x: { scale: 'category', field: categoryField, band: 0.5 },
            y: { scale: 'value', field: 'min' },
            y2: { scale: 'value', field: 'max' },
            stroke: { value: '#444444' },
            strokeWidth: { value: 1 }
          }
        }
      });
    }

    // Median line
    if (showMedian) {
      marks.push({
        type: 'rule',
        from: { data: 'source' },
        encode: {
          enter: isHorizontal ? {
            y: { scale: 'category', field: categoryField, band: 0.5, offset: -boxWidth / 2 },
            y2: { scale: 'category', field: categoryField, band: 0.5, offset: boxWidth / 2 },
            x: { scale: 'value', field: 'median' },
            stroke: { value: '#ffffff' },
            strokeWidth: { value: 2 }
          } : {
            x: { scale: 'category', field: categoryField, band: 0.5, offset: -boxWidth / 2 },
            x2: { scale: 'category', field: categoryField, band: 0.5, offset: boxWidth / 2 },
            y: { scale: 'value', field: 'median' },
            stroke: { value: '#ffffff' },
            strokeWidth: { value: 2 }
          }
        }
      });
    }

    // Mean point
    if (showMean) {
      marks.push({
        type: 'symbol',
        from: { data: 'source' },
        encode: {
          enter: isHorizontal ? {
            y: { scale: 'category', field: categoryField, band: 0.5 },
            x: { scale: 'value', field: 'mean' },
            shape: { value: 'diamond' },
            size: { value: 50 },
            fill: { value: '#f59e0b' },
            stroke: { value: '#ffffff' },
            strokeWidth: { value: 1 }
          } : {
            x: { scale: 'category', field: categoryField, band: 0.5 },
            y: { scale: 'value', field: 'mean' },
            shape: { value: 'diamond' },
            size: { value: 50 },
            fill: { value: '#f59e0b' },
            stroke: { value: '#ffffff' },
            strokeWidth: { value: 1 }
          }
        }
      });
    }

    return {
      ...this.getKibanaBaseSpec(),
      description: 'Violin Plot with Elasticsearch data source',
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
            { type: 'formula', expr: 'datum.extended.avg', as: 'mean' },
            { type: 'formula', expr: 'datum.extended.std_deviation', as: 'std' },
            { type: 'formula', expr: 'datum.doc_count', as: 'count' },
            // Calculate IQR and whisker bounds
            { type: 'formula', expr: 'datum.q3 - datum.q1', as: 'iqr' },
            { type: 'formula', expr: 'max(datum.min, datum.q1 - 1.5 * datum.iqr)', as: 'lower' },
            { type: 'formula', expr: 'min(datum.max, datum.q3 + 1.5 * datum.iqr)', as: 'upper' }
          ]
        }
      ],
      scales: [
        {
          name: 'category',
          type: 'band',
          domain: { data: 'source', field: categoryField },
          range: isHorizontal ? 'height' : 'width',
          padding: 0.2
        },
        {
          name: 'value',
          type: 'linear',
          domain: { data: 'source', fields: ['min', 'max'] },
          range: isHorizontal ? 'width' : 'height',
          nice: true,
          zero: false
        },
        {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'source', field: categoryField },
          range: { scheme: colorScheme }
        }
      ],
      axes: [
        {
          orient: isHorizontal ? 'left' : 'bottom',
          scale: 'category',
          title: this.getXLabel(categoryField)
        },
        {
          orient: isHorizontal ? 'bottom' : 'left',
          scale: 'value',
          title: this.getYLabel(valueField),
          grid: true
        }
      ],
      marks
    };
  }
}

export default ViolinGenerator;

