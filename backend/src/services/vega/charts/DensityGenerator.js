/**
 * Density Generator
 * Generates Vega specs for density/KDE plots
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class DensityGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'density',
    name: 'Density Plot',
    description: 'Show probability density of a continuous variable',
    category: 'distribution',
    icon: 'activity'
  };

  static schema = {
    fields: [
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'colorField', label: 'Group By', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['overlapping', 'faceted'], default: 'overlapping', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'bandwidth', label: 'Bandwidth', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1 },
      { name: 'steps', label: 'Resolution', type: 'number', min: 50, max: 500, default: 100 },
      { name: 'showFill', label: 'Show Fill', type: 'boolean', default: true },
      { name: 'fillOpacity', label: 'Fill Opacity', type: 'number', min: 0, max: 1, step: 0.1, default: 0.3 },
      { name: 'lineWidth', label: 'Line Width', type: 'number', min: 1, max: 5, default: 2 },
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', default: true }
    ]
  };

  static example = {
    config: {
      valueField: 'score',
      colorField: 'group',
      title: 'Score Distribution',
      showFill: true
    },
    data: Array.from({ length: 200 }, (_, i) => ({
      score: 50 + Math.random() * 50 + (i % 2 === 0 ? 10 : -10),
      group: i % 2 === 0 ? 'A' : 'B'
    }))
  };

  generate(data) {
    const {
      valueField, colorField, groupField, bandwidth = 1, steps = 100,
      showFill = true, filled, fillOpacity = 0.3, lineWidth = 2,
      showGrid = true, showRug = false
    } = this.config;

    // Support both colorField and groupField (alias)
    const groupByField = groupField || colorField;
    // Support both showFill and filled (alias)
    const shouldFill = filled !== undefined ? filled : showFill;

    logger.debug('Generating density plot spec', {
      event: 'density_generate',
      valueField,
      groupByField,
      bandwidth
    });

    // Resolve field paths to actual data keys
    const resolvedValueField = this.resolveFieldPath(valueField, data);
    const resolvedGroupField = groupByField ? this.resolveFieldPath(groupByField, data) : null;

    // Build layer array
    const layers = [];

    // Density transform for the data
    const densityTransform = {
      density: resolvedValueField,
      bandwidth: bandwidth,
      ...(resolvedGroupField && { groupby: [resolvedGroupField] })
    };

    // Filled area layer
    if (shouldFill) {
      layers.push({
        mark: {
          type: 'area',
          opacity: fillOpacity,
          tooltip: true
        },
        transform: [densityTransform],
        encoding: {
          x: {
            field: 'value',
            type: 'quantitative',
            title: this.getXLabel(valueField)
          },
          y: {
            field: 'density',
            type: 'quantitative',
            title: 'Density'
          },
          ...(resolvedGroupField && {
            fill: {
              field: resolvedGroupField,
              type: 'nominal',
              legend: { title: this.getLegendLabel(groupByField) }
            }
          })
        }
      });
    }

    // Line layer
    layers.push({
      mark: {
        type: 'line',
        strokeWidth: lineWidth,
        tooltip: true
      },
      transform: [densityTransform],
      encoding: {
        x: {
          field: 'value',
          type: 'quantitative',
          title: this.getXLabel(valueField)
        },
        y: {
          field: 'density',
          type: 'quantitative',
          title: 'Density'
        },
        ...(resolvedGroupField && {
          color: {
            field: resolvedGroupField,
            type: 'nominal',
            legend: { title: this.getLegendLabel(groupByField) }
          }
        })
      }
    });

    // Rug plot layer (if requested)
    if (showRug) {
      layers.push({
        mark: {
          type: 'tick',
          thickness: 2,
          opacity: 0.5,
          tooltip: true
        },
        encoding: {
          x: {
            field: resolvedValueField,
            type: 'quantitative'
          },
          ...(resolvedGroupField && {
            color: {
              field: resolvedGroupField,
              type: 'nominal'
            }
          })
        }
      });
    }

    return {
      ...this.getVegaLiteBaseSpec(),
      data: { values: data || [] },
      layer: layers,
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig()
      }
    };
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   * Note: Density/KDE requires raw data - uses top_hits aggregation
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      valueField, colorField,
      bandwidth = 0.5, steps = 100,
      showFill = true, fillOpacity = 0.3, lineWidth = 2, showGrid = true
    } = this.config;

    // Use actual aggregation config structure (NEW PATTERN)
    const metrics = aggregation?.metrics || [];
    const metric = metrics[0];
    const metricField = metric?.field || valueField;
    const splitField = aggregation?.splitBy?.field || colorField;
    // Serverless limits top_hits to 100, so use a configurable size
    const size = elasticConfig.sampleSize || 100;

    const sourceFields = [metricField, splitField].filter(Boolean);

    const aggs = splitField ? {
      groups: {
        terms: { field: splitField, size: 10 },
        aggs: {
          hits: { top_hits: { size, _source: sourceFields } }
        }
      }
    } : {
      hits: { top_hits: { size, _source: sourceFields } }
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

    const colorScheme = this.config.colorScheme || 'category10';
    const formatProperty = splitField 
      ? 'aggregations.groups.buckets' 
      : 'aggregations.hits.hits.hits';

    const transforms = splitField ? [
      { flatten: ['hits.hits.hits'], as: ['hit'] },
      { calculate: 'datum.key', as: 'group' },
      { calculate: `datum.hit._source['${metricField.replace(/\./g, "']['")}']`, as: 'value' }
    ] : [
      { calculate: `datum._source['${metricField.replace(/\./g, "']['")}']`, as: 'value' }
    ];

    // Add density transform
    transforms.push({ density: 'value', bandwidth: bandwidth, steps: steps, as: ['value', 'density'] });

    // If no split field and only showing fill (area), use simple spec
    if (!splitField && showFill && !this.config.showLine) {
      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        description: 'Density Plot',
        title: this.config.title || undefined,
        data: {
          url: urlConfig,
          format: { property: formatProperty }
        },
        transform: transforms,
        mark: { type: 'area', line: false, opacity: fillOpacity, tooltip: true },
        encoding: {
          x: { field: 'value', type: 'quantitative', title: valueField, axis: { grid: showGrid } },
          y: { field: 'density', type: 'quantitative', title: 'Density', axis: { grid: showGrid } }
        },
        config: {
          view: { stroke: null },
          axis: this.getAxisStyleConfig()
        }
      };
    }

    // Otherwise use layered spec for multiple marks or groups
    const layers = [];

    if (showFill) {
      layers.push({
        mark: { type: 'area', line: false, opacity: fillOpacity },
        encoding: {
          x: { field: 'value', type: 'quantitative', title: valueField, axis: { grid: showGrid } },
          y: { field: 'density', type: 'quantitative', title: 'Density', axis: { grid: showGrid } },
          ...(splitField ? { color: { field: 'group', type: 'nominal', scale: { scheme: colorScheme } } } : {})
        }
      });
    }

    layers.push({
      mark: { type: 'line', strokeWidth: lineWidth },
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'density', type: 'quantitative' },
        ...(splitField ? { color: { field: 'group', type: 'nominal', scale: { scheme: colorScheme } } } : {})
      }
    });

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Density Plot',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: formatProperty }
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

export default DensityGenerator;

