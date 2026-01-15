/**
 * Heatlane Generator
 * Generates Vega-Lite specs for heatlane/histogram charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class HeatlaneGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'heatlane',
    name: 'Heat Lane',
    description: 'Distribution histogram with color intensity',
    category: 'distribution',
    icon: 'bar-chart'
  };

  static schema = {
    fields: [
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'binCount', label: 'Number of Bins', type: 'number', min: 5, max: 50, default: 10 },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['stacked_lanes', 'faceted'], default: 'stacked_lanes', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'colorScheme', label: 'Color Scheme', type: 'select', options: ['blues', 'greens', 'oranges', 'reds', 'purples', 'viridis'], default: 'blues' },
      { name: 'laneHeight', label: 'Lane Height', type: 'number', min: 60, max: 200, default: 120 }
    ]
  };

  static example = {
    config: {
      valueField: 'responseTime',
      title: 'Response Time Distribution',
      binCount: 15,
      colorScheme: 'viridis'
    },
    data: Array.from({ length: 200 }, () => ({
      responseTime: Math.random() * 500 + 50
    }))
  };

  generate(data) {
    const {
      valueField = 'value', binCount = 10,
      colorScheme = 'blues', laneHeight = 120
    } = this.config;

    logger.debug('Generating heatlane spec', {
      event: 'heatlane_generate',
      valueField,
      binCount
    });

    const resolvedValueField = this.resolveFieldPath(valueField, data);
    const values = (data || []).map(d => d[resolvedValueField]).filter(v => v != null && !isNaN(v));
    
    if (values.length === 0) {
      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        description: 'No data available',
        width: this.config.width || 400,
        height: laneHeight,
        data: { values: [] },
        mark: 'text',
        encoding: {}
      };
    }

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const binWidth = (maxVal - minVal) / binCount;
    
    const bins = {};
    for (let i = 0; i < binCount; i++) {
      const binStart = minVal + i * binWidth;
      const binEnd = binStart + binWidth;
      bins[i] = { bin_start: binStart, bin_end: binEnd, count: 0 };
    }
    
    values.forEach(v => {
      const binIndex = Math.min(Math.floor((v - minVal) / binWidth), binCount - 1);
      if (bins[binIndex]) bins[binIndex].count++;
    });
    
    const binnedData = Object.values(bins);

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Heat lane chart showing distribution',
      width: this.config.width || 400,
      height: laneHeight,
      title: {
        text: this.config.title || `Distribution of ${valueField}`,
        color: '#000000',
        fontSize: 14
      },
      data: { values: binnedData },
      mark: { type: 'bar', cornerRadius: 3 },
      encoding: {
        x: {
          field: 'bin_start',
          type: 'quantitative',
          title: valueField,
          axis: { grid: false, labelColor: '#000000', titleColor: '#000000' }
        },
        x2: { field: 'bin_end' },
        y: {
          field: 'count',
          type: 'quantitative',
          title: 'Count',
          axis: { labelColor: '#000000', titleColor: '#000000' }
        },
        color: {
          field: 'count',
          type: 'quantitative',
          scale: { scheme: colorScheme },
          legend: { title: 'Count', labelColor: '#000000', titleColor: '#000000' }
        },
        tooltip: [
          { field: 'bin_start', title: 'From', format: '.1f' },
          { field: 'bin_end', title: 'To', format: '.1f' },
          { field: 'count', title: 'Count' }
        ]
      },
      config: {
        view: { stroke: null },
        background: 'transparent'
      }
    };
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      valueField, binCount = 10,
      colorScheme = 'blues', laneHeight = 120
    } = this.config;

    // Use actual aggregation config structure (NEW PATTERN)
    const metrics = aggregation?.metrics || [];
    const metric = metrics[0];
    const metricField = metric?.field || valueField;

    // Use histogram aggregation for binning
    const aggs = {
      histogram: {
        histogram: { field: metricField, interval: 10, min_doc_count: 0 }
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
      { calculate: 'datum.key', as: 'bin_start' },
      { calculate: 'datum.key + 10', as: 'bin_end' },
      { calculate: 'datum.doc_count', as: 'count' }
    ];

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Heat Lane',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.histogram.buckets' }
      },
      transform: transforms,
      mark: { type: 'bar', cornerRadius: 3 },
      encoding: {
        x: {
          field: 'bin_start',
          type: 'quantitative',
          title: valueField,
          axis: { grid: false, labelColor: '#000000', titleColor: '#000000' }
        },
        x2: { field: 'bin_end' },
        y: {
          field: 'count',
          type: 'quantitative',
          title: 'Count',
          axis: { labelColor: '#000000', titleColor: '#000000' }
        },
        color: {
          field: 'count',
          type: 'quantitative',
          scale: { scheme: colorScheme },
          legend: { title: 'Count' }
        },
        tooltip: [
          { field: 'bin_start', type: 'quantitative', title: 'Range Start' },
          { field: 'bin_end', type: 'quantitative', title: 'Range End' },
          { field: 'count', type: 'quantitative', title: 'Count' }
        ]
      },
      config: {
        view: { stroke: null },
        background: 'transparent'
      }
    };
  }
}

export default HeatlaneGenerator;

