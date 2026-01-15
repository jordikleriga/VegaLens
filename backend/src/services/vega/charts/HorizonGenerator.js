/**
 * Horizon Chart Generator
 * Generates Vega-Lite specs for horizon charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class HorizonGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'horizon',
    name: 'Horizon Chart',
    description: 'Compact time-series with layered bands',
    category: 'trend',
    icon: 'waves'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true, fieldTypes: ['date', 'number', 'keyword'] },
      { name: 'yField', label: 'Y-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'colorField', label: 'Series', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['stacked_bands', 'faceted'], default: 'stacked_bands', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'bands', label: 'Number of Bands', type: 'number', min: 2, max: 6, default: 3 },
      { name: 'positiveColor', label: 'Positive Color', type: 'color', default: '#4c78a8' },
      { name: 'negativeColor', label: 'Negative Color', type: 'color', default: '#e45756' },
      { name: 'bandHeight', label: 'Band Height', type: 'number', min: 20, max: 100, default: 40 }
    ]
  };

  static example = {
    config: {
      xField: 'date',
      yField: 'change',
      title: 'Stock Price Change',
      bands: 3
    },
    data: Array.from({ length: 50 }, (_, i) => ({
      date: `2024-01-${String((i % 31) + 1).padStart(2, '0')}`,
      change: Math.sin(i * 0.3) * 50 + (Math.random() - 0.5) * 20
    }))
  };

  generate(data) {
    const { 
      xField, yField, colorField,
      bands = 3, positiveColor = '#4c78a8', negativeColor = '#e45756',
      bandHeight = 40
    } = this.config;
    
    logger.debug('Generating horizon chart spec', {
      event: 'horizon_generate',
      xField,
      yField,
      bands
    });

    const resolvedXField = this.resolveFieldPath(xField, data);
    const resolvedYField = this.resolveFieldPath(yField, data);
    const resolvedColorField = colorField ? this.resolveFieldPath(colorField, data) : null;

    const isTemporal = this.isTemporalField(data, resolvedXField);
    const sortedData = isTemporal ? this.sortDataByTemporalField(data, resolvedXField) : data;
    
    // Detect field type for X-axis
    const sampleXValue = sortedData && sortedData.length > 0 ? sortedData[0][resolvedXField] : null;
    const isNumericX = typeof sampleXValue === 'number';
    const xType = isTemporal ? 'temporal' : (isNumericX ? 'quantitative' : 'ordinal');

    // Calculate value range
    const values = (sortedData || []).map(d => d[resolvedYField] || 0);
    const maxAbs = Math.max(...values.map(Math.abs), 1);
    const bandSize = maxAbs / bands;

    // Create band data transforms
    const transforms = [];
    for (let i = 0; i < bands; i++) {
      transforms.push({
        calculate: `max(0, min(${bandSize}, datum['${resolvedYField}'] - ${i * bandSize}))`,
        as: `_band_pos_${i}`
      });
      transforms.push({
        calculate: `max(0, min(${bandSize}, -datum['${resolvedYField}'] - ${i * bandSize}))`,
        as: `_band_neg_${i}`
      });
    }

    // Build layers
    const layers = [];

    // Positive bands (increasingly opaque)
    for (let i = bands - 1; i >= 0; i--) {
      const opacity = (i + 1) / bands;
      layers.push({
        mark: {
          type: 'area',
          interpolate: 'monotone',
          opacity: opacity
        },
        encoding: {
          x: {
            field: resolvedXField,
            type: xType,
            axis: i === 0 ? { title: this.getXLabel(xField), grid: false } : null
          },
          y: {
            field: `_band_pos_${i}`,
            type: 'quantitative',
            axis: null,
            scale: { domain: [0, bandSize] }
          },
          color: { value: positiveColor }
        }
      });
    }

    // Negative bands
    for (let i = bands - 1; i >= 0; i--) {
      const opacity = (i + 1) / bands;
      layers.push({
        mark: {
          type: 'area',
          interpolate: 'monotone',
          opacity: opacity
        },
        encoding: {
          x: {
            field: resolvedXField,
            type: xType
          },
          y: {
            field: `_band_neg_${i}`,
            type: 'quantitative',
            scale: { domain: [0, bandSize] }
          },
          color: { value: negativeColor }
        }
      });
    }

    // If grouping by series, use faceting
    if (resolvedColorField) {
      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        description: 'Horizon Chart',
        title: this.config.title || '',
        data: { values: sortedData },
        transform: transforms,
        facet: {
          row: {
            field: resolvedColorField,
            type: 'nominal',
            header: { 
              labelAngle: 0,
              labelAlign: 'left',
              title: null
            }
          }
        },
        spec: {
          width: this.config.width || 600,
          height: bandHeight,
          layer: layers
        }
      };
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Horizon Chart',
      title: this.config.title || '',
      width: this.config.width || 600,
      height: bandHeight,
      data: { values: sortedData },
      transform: transforms,
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
      xField, yField,
      bands = 3, positiveColor = '#4c78a8', negativeColor = '#e45756',
      bandHeight = 40
    } = this.config;

    // Use actual aggregation config structure (NEW PATTERN)
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || xField;
    const bucketType = bucketAgg?.type || 'date_histogram';
    const metric = metrics[0];
    const metricType = metric?.type || 'avg';
    const metricField = metric?.field || yField;

    const aggs = {
      timebucket: {
        [bucketType]: bucketType === 'date_histogram'
          ? { field: bucketField, calendar_interval: 'day', min_doc_count: 0 }
          : { field: bucketField, size: 100 },
        aggs: {
          value: { [metricType]: { field: metricField } }
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

    // Always add Kibana context placeholders for dashboard filter integration
    urlConfig['%context%'] = true;
    urlConfig['%timefield%'] = timeField;

    const transforms = [
      { calculate: 'datum.key_as_string || datum.key', as: 'x' },
      { calculate: 'datum.value.value', as: 'y' }
    ];

    // Note: True horizon charts require complex transforms. This is a simplified version
    // that shows positive/negative with different colors
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Horizon Chart (Simplified)',
      title: this.config.title || undefined,
      height: bandHeight,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.timebucket.buckets' }
      },
      transform: transforms,
      layer: [
        {
          mark: { type: 'area', interpolate: 'monotone' },
          encoding: {
            x: { field: 'x', type: bucketType === 'date_histogram' ? 'temporal' : 'ordinal', axis: { title: null, grid: false } },
            y: { field: 'y', type: 'quantitative', axis: null },
            color: {
              condition: { test: 'datum.y >= 0', value: positiveColor },
              value: negativeColor
            },
            opacity: { value: 0.7 }
          }
        }
      ],
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default HorizonGenerator;

