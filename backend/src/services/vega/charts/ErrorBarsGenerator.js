/**
 * Error Bars Generator
 * Generates Vega-Lite specs for error bar charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class ErrorBarsGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'error_bars',
    name: 'Error Bars',
    description: 'Show mean/median with confidence intervals',
    category: 'distribution',
    icon: 'git-commit'
  };

  static schema = {
    fields: [
      { name: 'categoryField', label: 'Category', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['grouped', 'faceted'], default: 'grouped', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'errorType', label: 'Error Type', type: 'select', options: ['stdev', 'stderr', 'ci95', 'iqr'], default: 'stdev' },
      { name: 'centerMark', label: 'Center Mark', type: 'select', options: ['mean', 'median'], default: 'mean' },
      { name: 'showPoints', label: 'Show Raw Points', type: 'boolean', default: true },
      { name: 'orientation', label: 'Orientation', type: 'select', options: ['vertical', 'horizontal'], default: 'vertical' }
    ]
  };

  static example = {
    config: {
      categoryField: 'treatment',
      valueField: 'response',
      title: 'Treatment Response',
      errorType: 'stdev',
      showPoints: true
    },
    data: [
      { treatment: 'Control', response: 45 },
      { treatment: 'Control', response: 52 },
      { treatment: 'Control', response: 48 },
      { treatment: 'Drug A', response: 72 },
      { treatment: 'Drug A', response: 68 },
      { treatment: 'Drug A', response: 75 },
      { treatment: 'Drug B', response: 58 },
      { treatment: 'Drug B', response: 62 },
      { treatment: 'Drug B', response: 55 }
    ]
  };

  generate(data) {
    const {
      categoryField, valueField,
      errorType = 'stdev', centerMark = 'mean',
      showPoints = true, orientation = 'vertical'
    } = this.config;

    const isHorizontal = orientation === 'horizontal';

    logger.debug('Generating error bars spec', {
      event: 'error_bars_generate',
      categoryField,
      valueField,
      errorType
    });

    const resolvedCategoryField = this.resolveFieldPath(categoryField, data);
    const resolvedValueField = this.resolveFieldPath(valueField, data);

    // Map error type to Vega-Lite extent
    let extentType = 'stdev';
    if (errorType === 'stderr') extentType = 'stderr';
    else if (errorType === 'ci95') extentType = 'ci';
    else if (errorType === 'iqr') extentType = 'iqr';

    const colorScheme = this.colorConfig.scheme || 'category10';
    const layers = [];

    // Raw data points
    if (showPoints) {
      layers.push({
        mark: { type: 'point', opacity: 0.3, size: 20 },
        encoding: {
          [isHorizontal ? 'x' : 'y']: {
            field: resolvedValueField,
            type: 'quantitative',
            title: this.getYLabel(valueField)
          },
          [isHorizontal ? 'y' : 'x']: {
            field: resolvedCategoryField,
            type: 'nominal',
            title: this.getXLabel(categoryField)
          },
          color: {
            field: resolvedCategoryField,
            type: 'nominal',
            legend: null,
            scale: { scheme: colorScheme }
          }
        }
      });
    }

    // Error bar layer
    layers.push({
      mark: { type: 'errorbar', extent: extentType, ticks: { size: 8 } },
      encoding: {
        [isHorizontal ? 'x' : 'y']: {
          field: resolvedValueField,
          type: 'quantitative',
          title: showPoints ? null : this.getYLabel(valueField),
          scale: { zero: false }
        },
        [isHorizontal ? 'y' : 'x']: {
          field: resolvedCategoryField,
          type: 'nominal',
          title: showPoints ? null : this.getXLabel(categoryField)
        },
        color: {
          field: resolvedCategoryField,
          type: 'nominal',
          legend: null,
          scale: { scheme: colorScheme }
        }
      }
    });

    // Center point
    layers.push({
      mark: { type: 'point', filled: true, size: 80 },
      encoding: {
        [isHorizontal ? 'x' : 'y']: {
          aggregate: centerMark === 'median' ? 'median' : 'mean',
          field: resolvedValueField,
          type: 'quantitative'
        },
        [isHorizontal ? 'y' : 'x']: {
          field: resolvedCategoryField,
          type: 'nominal'
        },
        color: {
          field: resolvedCategoryField,
          type: 'nominal',
          legend: null,
          scale: { scheme: colorScheme }
        }
      }
    });

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Error Bars Chart',
      title: this.config.title || '',
      width: this.config.width || 500,
      height: this.config.height || 300,
      data: { values: data },
      layer: layers
    };
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      categoryField, valueField,
      errorType = 'stdev', centerMark = 'mean',
      showPoints = true, orientation = 'vertical'
    } = this.config;

    const isHorizontal = orientation === 'horizontal';

    // Use actual aggregation config structure
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || categoryField;
    const bucketOptions = bucketAgg?.options || {};
    const metricField = metrics[0]?.field || valueField;

    // Error bars need raw data - use top_hits
    const aggs = {
      categories: {
        terms: { field: bucketField, size: bucketOptions.size || 20 },
        aggs: {
          hits: {
            top_hits: { size: bucketOptions.topHitsSize || 100, _source: [metricField] }
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

    const colorScheme = this.colorConfig.scheme || 'category10';

    // Map error type to Vega-Lite extent
    let extentType = 'stdev';
    if (errorType === 'stderr') extentType = 'stderr';
    else if (errorType === 'ci95') extentType = 'ci';
    else if (errorType === 'iqr') extentType = 'iqr';

    const transforms = [
      { flatten: ['hits.hits.hits'], as: ['hit'] },
      { calculate: 'datum.key', as: 'category' },
      { calculate: `datum.hit._source['${metricField.replace(/\./g, "']['")}']`, as: 'value' }
    ];

    const layers = [];

    if (showPoints) {
      layers.push({
        mark: { type: 'point', opacity: 0.3, size: 20 },
        encoding: {
          [isHorizontal ? 'x' : 'y']: { field: 'value', type: 'quantitative', title: valueField },
          [isHorizontal ? 'y' : 'x']: { field: 'category', type: 'nominal', title: categoryField },
          color: { field: 'category', type: 'nominal', legend: null, scale: { scheme: colorScheme } }
        }
      });
    }

    layers.push({
      mark: { type: 'errorbar', extent: extentType, ticks: { size: 8 } },
      encoding: {
        [isHorizontal ? 'x' : 'y']: { field: 'value', type: 'quantitative', scale: { zero: false } },
        [isHorizontal ? 'y' : 'x']: { field: 'category', type: 'nominal' },
        color: { field: 'category', type: 'nominal', legend: null, scale: { scheme: colorScheme } }
      }
    });

    layers.push({
      mark: { type: 'point', filled: true, size: 80 },
      encoding: {
        [isHorizontal ? 'x' : 'y']: { aggregate: centerMark === 'median' ? 'median' : 'mean', field: 'value', type: 'quantitative' },
        [isHorizontal ? 'y' : 'x']: { field: 'category', type: 'nominal' },
        color: { field: 'category', type: 'nominal', legend: null, scale: { scheme: colorScheme } }
      }
    });

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Error Bars',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.categories.buckets' }
      },
      transform: transforms,
      layer: layers,
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default ErrorBarsGenerator;

