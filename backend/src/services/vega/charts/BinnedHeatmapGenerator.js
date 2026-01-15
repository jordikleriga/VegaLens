/**
 * Binned Heatmap Generator
 * Generates Vega-Lite specs for 2D histogram heatmaps
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class BinnedHeatmapGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'binned_heatmap',
    name: 'Binned Heatmap',
    description: '2D histogram heatmap for continuous data',
    category: 'distribution',
    icon: 'grid'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'yField', label: 'Y-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'xBins', label: 'X Bins', type: 'number', min: 5, max: 100, default: 20 },
      { name: 'yBins', label: 'Y Bins', type: 'number', min: 5, max: 100, default: 20 },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['faceted'], default: 'faceted', advanced: true, description: 'Creates small multiples for each sub-group' },
      { name: 'colorScheme', label: 'Color Scheme', type: 'select', options: ['blues', 'greens', 'oranges', 'reds', 'purples', 'viridis', 'inferno', 'magma', 'plasma'], default: 'blues' },
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', default: true }
    ]
  };

  static example = {
    config: {
      xField: 'x',
      yField: 'y',
      title: 'Density Distribution',
      xBins: 20,
      yBins: 20,
      colorScheme: 'viridis'
    },
    data: Array.from({ length: 500 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100
    }))
  };

  generate(data) {
    const { 
      xField, yField,
      xBins = 20, yBins = 20,
      colorScheme = 'blues', showGrid = true
    } = this.config;
    
    logger.debug('Generating binned heatmap spec', {
      event: 'binned_heatmap_generate',
      xField,
      yField,
      xBins,
      yBins
    });

    // Resolve field paths to actual data keys
    const resolvedXField = this.resolveFieldPath(xField, data);
    const resolvedYField = this.resolveFieldPath(yField, data);

    // Use Vega-Lite for binned heatmaps
    return {
      ...this.getVegaLiteBaseSpec(),
      data: { values: data || [] },
      mark: 'rect',
      encoding: {
        x: {
          bin: { maxbins: xBins },
          field: resolvedXField,
          type: 'quantitative',
          axis: { grid: showGrid, title: this.getXLabel(xField) }
        },
        y: {
          bin: { maxbins: yBins },
          field: resolvedYField,
          type: 'quantitative',
          axis: { grid: showGrid, title: this.getYLabel(yField) }
        },
        color: {
          aggregate: 'count',
          type: 'quantitative',
          scale: { scheme: colorScheme },
          legend: { title: 'Count' }
        }
      },
      config: {
        view: {
          stroke: 'transparent'
        }
      }
    };
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', useContext } = elasticConfig;
    const idx = index || '_all';
    const { 
      xField, yField, xBins = 20, yBins = 20,
      colorScheme = 'blues', showGrid = true
    } = this.config;

    // Binned heatmaps need raw data - use top_hits
    // Serverless limits top_hits to 100, so use a configurable size
    const size = elasticConfig.sampleSize || 100; // Default to 100 for Serverless compatibility

    const aggs = {
      hits: {
        top_hits: {
          size: size,
          _source: [xField, yField]
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

    const transforms = [
      { calculate: `datum._source['${xField.replace(/\./g, "']['")}']`, as: 'x' },
      { calculate: `datum._source['${yField.replace(/\./g, "']['")}']`, as: 'y' }
    ];

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Binned Heatmap',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.hits.hits.hits' }
      },
      transform: transforms,
      mark: 'rect',
      encoding: {
        x: {
          bin: { maxbins: xBins },
          field: 'x',
          type: 'quantitative',
          axis: { grid: showGrid, title: this.getXLabel(xField) }
        },
        y: {
          bin: { maxbins: yBins },
          field: 'y',
          type: 'quantitative',
          axis: { grid: showGrid, title: this.getYLabel(yField) }
        },
        color: {
          aggregate: 'count',
          type: 'quantitative',
          scale: { scheme: colorScheme },
          legend: { title: 'Count' }
        }
      },
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default BinnedHeatmapGenerator;

