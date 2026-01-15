/**
 * Bullet Chart Generator
 * Generates Vega-Lite specs for bullet charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class BulletGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'bullet',
    name: 'Bullet Chart',
    description: 'Show progress against targets with range indicators',
    category: 'comparison',
    icon: 'target'
  };

  static schema = {
    fields: [
      { name: 'titleField', label: 'Title/Category', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'measuresField', label: 'Measures', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'rangesField', label: 'Ranges', type: 'field', required: false, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['grouped', 'composite'], default: 'grouped', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'rangeColors', label: 'Range Colors (comma-separated)', type: 'text', default: '#eee,#ddd,#ccc' },
      { name: 'measureColor', label: 'Measure Color', type: 'color', default: 'steelblue' },
      { name: 'markerColor', label: 'Marker Color', type: 'color', default: 'black' },
      { name: 'barHeight', label: 'Bar Height', type: 'number', min: 5, max: 30, default: 10 }
    ]
  };

  static example = {
    config: {
      titleField: 'metric',
      measuresField: 'actual',
      title: 'KPI Progress'
    },
    data: [
      { metric: 'Revenue', actual: 275, target: 300 },
      { metric: 'Profit', actual: 92, target: 100 },
      { metric: 'Customers', actual: 1850, target: 2000 }
    ]
  };

  generate(data) {
    const {
      titleField, measuresField, rangesField,
      rangeColors = '#eee,#ddd,#ccc', measureColor = 'steelblue',
      markerColor = 'black', barHeight = 10
    } = this.config;

    logger.debug('Generating bullet chart spec', {
      event: 'bullet_generate',
      titleField,
      measuresField
    });

    const resolvedTitleField = this.resolveFieldPath(titleField, data);
    const resolvedMeasuresField = this.resolveFieldPath(measuresField, data);
    const resolvedRangesField = rangesField ? this.resolveFieldPath(rangesField, data) : null;

    // Check if data has proper bullet chart structure
    const sampleRecord = (data && data.length > 0) ? data[0] : {};
    const hasArrayRanges = Array.isArray(sampleRecord[resolvedRangesField]);
    const hasArrayMeasures = Array.isArray(sampleRecord[resolvedMeasuresField]);

    // Transform aggregated data into bullet chart format if needed
    let bulletData = data;
    if (!hasArrayRanges || !hasArrayMeasures) {
      const valueField = resolvedMeasuresField || '_count';
      bulletData = (data || []).map(d => {
        const value = d[valueField] || d['_count'] || 0;
        const maxValue = value * 1.5;
        return {
          [resolvedTitleField]: d[resolvedTitleField] || 'Unknown',
          measures: [value, value * 0.8],
          ranges: [maxValue * 0.3, maxValue * 0.6, maxValue],
          markers: [value * 0.9]
        };
      });
    }

    const colors = rangeColors.split(',').map(c => c.trim());

    const layers = [];
    
    // Range bars (background)
    for (let i = 2; i >= 0; i--) {
      layers.push({
        mark: { type: 'bar', color: colors[2 - i] || '#ccc' },
        encoding: { x: { field: `ranges[${i}]`, type: 'quantitative' } }
      });
    }

    // Measure bars
    layers.push({
      mark: { type: 'bar', color: 'lightsteelblue', size: barHeight },
      encoding: { x: { field: 'measures[1]', type: 'quantitative' } }
    });
    layers.push({
      mark: { type: 'bar', color: measureColor, size: barHeight },
      encoding: { x: { field: 'measures[0]', type: 'quantitative' } }
    });

    // Marker tick
    layers.push({
      mark: { type: 'tick', color: markerColor },
      encoding: { x: { field: 'markers[0]', type: 'quantitative' } }
    });

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Bullet Chart',
      title: this.config.title || '',
      data: { values: bulletData },
      facet: {
        row: {
          field: resolvedTitleField,
          type: 'ordinal',
          header: { labelAngle: 0, title: '', labelAlign: 'left' }
        }
      },
      spacing: 10,
      spec: {
        width: this.config.width || 300,
        encoding: {
          x: { type: 'quantitative', scale: { nice: false }, title: null }
        },
        layer: layers
      },
      resolve: { scale: { x: 'independent' } },
      config: { tick: { thickness: 2 }, scale: { barBandPaddingInner: 0 } }
    };
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      titleField, measuresField,
      rangeColors = '#eee,#ddd,#ccc', measureColor = 'steelblue',
      markerColor = 'black', barHeight = 10
    } = this.config;

    // Use actual aggregation config structure (NEW PATTERN)
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || titleField;
    const metric = metrics[0];
    const metricType = metric?.type || 'avg';
    const metricField = metric?.field || measuresField;

    const aggs = {
      categories: {
        terms: { field: bucketField, size: 10 },
        aggs: {
          value: { [metricType]: { field: metricField } },
          max_value: { max: { field: metricField } }
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

    // Parse range colors
    const colors = rangeColors.split(',').map(c => c.trim());

    // Transforms to compute bullet chart data from ES aggregation
    const transforms = [
      { calculate: 'datum.key', as: 'category' },
      { calculate: 'datum.value.value', as: 'measure' },
      { calculate: 'datum.max_value.value', as: 'maxVal' },
      // Create range values (poor, satisfactory, good) based on max
      { calculate: 'datum.maxVal * 1.5', as: 'range3' },  // Full range (background)
      { calculate: 'datum.maxVal * 1.0', as: 'range2' },  // Satisfactory
      { calculate: 'datum.maxVal * 0.6', as: 'range1' },  // Poor
      // Target marker (slightly above measure for visual reference)
      { calculate: 'datum.maxVal * 1.1', as: 'target' }
    ];

    // Common y encoding for all layers
    const yEncoding = {
      field: 'category',
      type: 'nominal',
      axis: { title: null, labelAngle: 0 }
    };

    // Build layered bullet chart spec for Kibana
    // Layers from back to front: range3 (widest), range2, range1, measure bar, target tick
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Bullet Chart',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.categories.buckets' }
      },
      transform: transforms,
      layer: [
        // Range 3 - outermost background (full range) - semi-transparent
        {
          mark: { type: 'bar', color: colors[2] || '#ccc', height: barHeight * 3, opacity: 0.85 },
          encoding: {
            x: { field: 'range3', type: 'quantitative', axis: null },
            y: yEncoding
          }
        },
        // Range 2 - middle background (satisfactory zone) - semi-transparent
        {
          mark: { type: 'bar', color: colors[1] || '#ddd', height: barHeight * 3, opacity: 0.85 },
          encoding: {
            x: { field: 'range2', type: 'quantitative', axis: null },
            y: yEncoding
          }
        },
        // Range 1 - innermost background (good zone) - semi-transparent
        {
          mark: { type: 'bar', color: colors[0] || '#eee', height: barHeight * 3, opacity: 0.85 },
          encoding: {
            x: { field: 'range1', type: 'quantitative', axis: null },
            y: yEncoding
          }
        },
        // Measure bar - the actual value (narrower, in front)
        {
          mark: { type: 'bar', color: measureColor, height: barHeight },
          encoding: {
            x: {
              field: 'measure',
              type: 'quantitative',
              axis: {
                title: this.config.xLabel || 'Value',
                grid: true,
                gridColor: '#64748b',
                gridOpacity: 0.5,
                gridDash: [2, 2]
              }
            },
            y: yEncoding,
            tooltip: [
              { field: 'category', type: 'nominal', title: 'Category' },
              { field: 'measure', type: 'quantitative', title: 'Actual', format: ',.0f' },
              { field: 'target', type: 'quantitative', title: 'Target', format: ',.0f' }
            ]
          }
        },
        // Target marker tick
        {
          mark: { type: 'tick', color: markerColor, thickness: 3, size: barHeight * 2.5 },
          encoding: {
            x: { field: 'target', type: 'quantitative' },
            y: yEncoding
          }
        }
      ],
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig(),
        tick: { thickness: 3 }
      }
    };
  }
}

export default BulletGenerator;

