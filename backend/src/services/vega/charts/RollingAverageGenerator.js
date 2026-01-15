/**
 * Rolling Average Generator
 * Generates Vega-Lite specs for rolling average visualizations
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class RollingAverageGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'rolling_average',
    name: 'Rolling Average',
    description: 'Show raw data with rolling mean line overlay',
    category: 'trend',
    icon: 'trending-up'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true, fieldTypes: ['date', 'number', 'keyword'] },
      { name: 'yField', label: 'Y-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['series', 'faceted'], default: 'series', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'windowSize', label: 'Window Size', type: 'number', min: 2, max: 365, default: 30 },
      { name: 'showPoints', label: 'Show Raw Points', type: 'boolean', default: true },
      { name: 'pointOpacity', label: 'Point Opacity', type: 'number', min: 0.1, max: 1, step: 0.1, default: 0.3 },
      { name: 'lineColor', label: 'Rolling Line Color', type: 'color', default: '#ef4444' },
      { name: 'lineWidth', label: 'Line Width', type: 'number', min: 1, max: 8, default: 3 }
    ]
  };

  static example = {
    config: {
      xField: 'date',
      yField: 'value',
      title: 'Daily Sales with 7-Day Average',
      windowSize: 7,
      showPoints: true
    },
    data: Array.from({ length: 30 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      value: 100 + Math.random() * 50
    }))
  };

  generate(data) {
    const { 
      xField, yField, windowSize = 30,
      showPoints = true, pointOpacity = 0.3,
      lineColor = '#ef4444', lineWidth = 3
    } = this.config;
    
    logger.debug('Generating rolling average spec', {
      event: 'rolling_average_generate',
      xField,
      yField,
      windowSize
    });

    const resolvedXField = this.resolveFieldPath(xField, data);
    const resolvedYField = this.resolveFieldPath(yField, data);

    // Calculate the frame for rolling window
    const halfWindow = Math.floor(windowSize / 2);

    // Check if X-axis is temporal
    const isTemporal = this.isTemporalField(data, resolvedXField);
    const sortedData = isTemporal ? this.sortDataByTemporalField(data, resolvedXField) : data;

    const layers = [];

    // Raw data points
    if (showPoints) {
      layers.push({
        mark: { type: 'point', opacity: pointOpacity },
        encoding: {
          y: { field: resolvedYField, title: yField }
        }
      });
    }

    // Rolling average line
    layers.push({
      mark: { type: 'line', color: lineColor, size: lineWidth },
      encoding: {
        y: { field: 'rolling_mean', title: `Rolling Mean of ${yField}` }
      }
    });

    // Determine field type
    let fieldType = 'nominal';
    if (isTemporal) {
      fieldType = 'temporal';
    } else if (sortedData && sortedData.length > 0 && typeof sortedData[0][resolvedXField] === 'number') {
      fieldType = 'quantitative';
    }

    const xEncoding = { 
      field: resolvedXField, 
      type: fieldType,
      title: this.getXLabel(xField)
    };
    
    if (isTemporal) {
      xEncoding.sort = 'ascending';
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: `Plot showing a ${windowSize} period rolling average with raw values.`,
      width: this.config.width || 600,
      height: this.config.height || 400,
      title: this.config.title || `${windowSize}-Period Rolling Average`,
      data: { values: sortedData || [] },
      transform: [
        {
          window: [
            {
              field: resolvedYField,
              op: 'mean',
              as: 'rolling_mean'
            }
          ],
          frame: [-halfWindow, halfWindow]
        }
      ],
      encoding: {
        x: xEncoding,
        y: { 
          type: 'quantitative', 
          axis: { title: `${yField} and Rolling Mean` }
        }
      },
      layer: layers,
      config: {
        view: { stroke: null },
        axis: {
          labelColor: '#000000',
          titleColor: '#000000',
          gridColor: '#cccccc',
          domainColor: '#666666'
        }
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
      xField, yField, windowSize = 30,
      showPoints = true, pointOpacity = 0.3,
      lineColor = '#ef4444', lineWidth = 3
    } = this.config;

    // Use actual aggregation config structure
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || xField;
    const bucketType = bucketAgg?.type || 'date_histogram';
    const bucketOptions = bucketAgg?.options || {};

    const metric = metrics[0];
    const metricType = metric?.type || 'avg';
    const metricField = metric?.field || yField;

    // Build bucket aggregation config
    let bucketAggConfig;
    if (bucketType === 'date_histogram') {
      bucketAggConfig = {
        field: bucketField,
        calendar_interval: bucketOptions.calendarInterval || bucketOptions.interval || 'day',
        ...(bucketOptions.timeZone && { time_zone: bucketOptions.timeZone }),
        min_doc_count: 0
      };
    } else if (bucketType === 'histogram') {
      bucketAggConfig = {
        field: bucketField,
        interval: bucketOptions.interval || 1,
        min_doc_count: 0
      };
    } else {
      bucketAggConfig = {
        field: bucketField,
        size: bucketOptions.size || 100
      };
    }

    const aggs = {
      timebucket: {
        [bucketType]: bucketAggConfig,
        aggs: metricType !== 'count' && metricField ? {
          value: { [metricType]: { field: metricField } }
        } : {}
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

    const halfWindow = Math.floor(windowSize / 2);

    const transforms = [
      { calculate: 'datum.key_as_string || datum.key', as: 'x' },
      { calculate: metricType !== 'count' ? 'datum.value.value' : 'datum.doc_count', as: 'y' },
      { window: [{ field: 'y', op: 'mean', as: 'rolling_mean' }], frame: [-halfWindow, halfWindow] }
    ];

    const layers = [];

    if (showPoints) {
      layers.push({
        mark: { type: 'point', opacity: pointOpacity },
        encoding: { y: { field: 'y', title: yField } }
      });
    }

    layers.push({
      mark: { type: 'line', color: lineColor, size: lineWidth },
      encoding: { y: { field: 'rolling_mean', title: `Rolling Mean of ${yField}` } }
    });

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: `${windowSize}-Period Rolling Average`,
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.timebucket.buckets' }
      },
      transform: transforms,
      encoding: {
        x: {
          field: 'x',
          type: bucketType === 'date_histogram' ? 'temporal' : 'ordinal',
          title: this.getXLabel(xField)
        },
        y: { field: 'y', type: 'quantitative', axis: { title: `${yField} and Rolling Mean` } }
      },
      layer: layers,
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default RollingAverageGenerator;

