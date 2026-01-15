/**
 * Sparkline Generator
 * Generates Vega-Lite specs for compact inline trend visualizations
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class SparklineGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'sparkline',
    name: 'Sparkline',
    description: 'Compact inline trend visualization',
    category: 'trend',
    icon: 'activity'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true, fieldTypes: ['date', 'number', 'keyword'] },
      { name: 'yField', label: 'Y-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'colorField', label: 'Series', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['grid', 'stacked'], default: 'grid', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'showArea', label: 'Show Area Fill', type: 'boolean', default: false },
      { name: 'showEndpoint', label: 'Show Endpoint', type: 'boolean', default: true },
      { name: 'strokeWidth', label: 'Stroke Width', type: 'number', min: 0.5, max: 5, default: 1.5 },
      { name: 'interpolate', label: 'Interpolation', type: 'select', options: ['linear', 'monotone', 'step'], default: 'monotone' },
      { name: 'sparkHeight', label: 'Height', type: 'number', min: 20, max: 100, default: 30 }
    ]
  };

  static example = {
    config: {
      xField: 'day',
      yField: 'visitors',
      showEndpoint: true
    },
    data: [
      { day: 1, visitors: 120 },
      { day: 2, visitors: 145 },
      { day: 3, visitors: 132 },
      { day: 4, visitors: 165 },
      { day: 5, visitors: 178 },
      { day: 6, visitors: 190 },
      { day: 7, visitors: 175 }
    ]
  };

  generate(data) {
    const { 
      xField, yField, colorField, showArea = false, showEndpoint = true,
      strokeWidth = 1.5, interpolate = 'monotone', sparkHeight = 30
    } = this.config;
    
    logger.debug('Generating sparkline spec', {
      event: 'sparkline_generate',
      xField,
      yField,
      colorField
    });

    const resolvedXField = this.resolveFieldPath(xField, data);
    const resolvedYField = this.resolveFieldPath(yField, data);
    const resolvedColorField = colorField ? this.resolveFieldPath(colorField, data) : null;

    const isTemporal = this.isTemporalField(data, resolvedXField);
    const sortedData = isTemporal ? this.sortDataByTemporalField(data, resolvedXField) : data;

    const lineColor = this.colorConfig.singleColor || VegaGeneratorBase.DEFAULTS.singleColor;
    const colorScheme = this.colorConfig.scheme || 'category10';

    const layers = [];
    
    // Area fill (optional)
    if (showArea) {
      layers.push({
        mark: {
          type: 'area',
          line: false,
          opacity: 0.2,
          interpolate: interpolate
        },
        encoding: {
          x: {
            field: resolvedXField,
            type: isTemporal ? 'temporal' : 'ordinal',
            axis: null
          },
          y: {
            field: resolvedYField,
            type: 'quantitative',
            axis: null,
            scale: { zero: false }
          },
          ...(resolvedColorField ? {
            color: {
              field: resolvedColorField,
              type: 'nominal',
              legend: null,
              scale: { scheme: colorScheme }
            }
          } : {
            color: { value: lineColor }
          })
        }
      });
    }
    
    // Main line
    layers.push({
      mark: {
        type: 'line',
        interpolate: interpolate,
        strokeWidth: strokeWidth
      },
      encoding: {
        x: {
          field: resolvedXField,
          type: isTemporal ? 'temporal' : 'ordinal',
          axis: null
        },
        y: {
          field: resolvedYField,
          type: 'quantitative',
          axis: null,
          scale: { zero: false }
        },
        ...(resolvedColorField ? {
          color: {
            field: resolvedColorField,
            type: 'nominal',
            legend: null,
            scale: { scheme: colorScheme }
          }
        } : {
          color: { value: lineColor }
        })
      }
    });
    
    // Endpoint dot
    if (showEndpoint) {
      layers.push({
        transform: [
          // When faceted by color field, group window by that field to get last point per series
          ...(resolvedColorField ? [
            { window: [{ op: 'row_number', as: '_row' }], groupby: [resolvedColorField], sort: [{ field: resolvedXField, order: 'descending' }] }
          ] : [
            { window: [{ op: 'row_number', as: '_row' }], sort: [{ field: resolvedXField, order: 'descending' }] }
          ]),
          { filter: 'datum._row === 1' }
        ],
        mark: {
          type: 'circle',
          size: 30,
          stroke: 'white',
          strokeWidth: 1
        },
        encoding: {
          x: {
            field: resolvedXField,
            type: isTemporal ? 'temporal' : 'ordinal'
          },
          y: {
            field: resolvedYField,
            type: 'quantitative'
          },
          ...(resolvedColorField ? {
            color: {
              field: resolvedColorField,
              type: 'nominal',
              legend: null,
              scale: { scheme: colorScheme }
            }
          } : {
            color: { value: lineColor }
          })
        }
      });
    }

    // If grouping by color, create small multiples
    if (resolvedColorField) {
      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        description: 'Spark Lines',
        title: this.config.title || '',
        data: { values: sortedData },
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
          width: this.config.width || 200,
          height: sparkHeight,
          layer: layers
        }
      };
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Spark Line',
      title: this.config.title || '',
      width: this.config.width || 200,
      height: sparkHeight,
      data: { values: sortedData },
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
      xField, yField, colorField, showArea = false, showEndpoint = true,
      strokeWidth = 1.5, interpolate = 'monotone', sparkHeight = 30
    } = this.config;

    // Use actual aggregation config structure
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const splitBy = aggregation?.splitBy;
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || xField;
    const bucketType = bucketAgg?.type || 'date_histogram';
    const bucketOptions = bucketAgg?.options || {};

    const splitField = splitBy?.field || colorField;
    const splitOptions = splitBy?.options || { size: 10 };

    const metric = metrics[0];
    const metricType = metric?.type || 'count';
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
    } else {
      bucketAggConfig = {
        field: bucketField,
        size: bucketOptions.size || 50
      };
    }

    // Build aggregation structure - with or without split
    let aggs;
    let formatProperty;
    let transforms;

    if (splitField) {
      // With split: nested aggregation structure
      aggs = {
        split: {
          terms: {
            field: splitField,
            size: splitOptions.size || 10
          },
          aggs: {
            timebucket: {
              [bucketType]: bucketAggConfig,
              aggs: metricType !== 'count' && metricField ? {
                metric_value: { [metricType]: { field: metricField } }
              } : {}
            }
          }
        }
      };
      formatProperty = 'aggregations.split.buckets';
      transforms = [
        // Flatten the nested time buckets
        { flatten: ['timebucket.buckets'], as: ['tb'] },
        // Extract category (split field value)
        { calculate: 'datum.key', as: 'category' },
        // Extract x value (time or bucket key)
        { calculate: 'datum.tb.key_as_string || datum.tb.key', as: 'x' },
        // Extract y value (metric)
        {
          calculate: metricType !== 'count'
            ? 'datum.tb.metric_value ? datum.tb.metric_value.value : 0'
            : 'datum.tb.doc_count || 0',
          as: 'y'
        },
        // Find max x per category for endpoint dot (joinaggregate works in faceted specs)
        ...(showEndpoint ? [
          { joinaggregate: [{ op: 'max', field: 'x', as: '_maxX' }], groupby: ['category'] }
        ] : [])
      ];
    } else {
      // Without split: simple aggregation
      aggs = {
        timebucket: {
          [bucketType]: bucketAggConfig,
          aggs: metricType !== 'count' && metricField ? {
            metric_value: { [metricType]: { field: metricField } }
          } : {}
        }
      };
      formatProperty = 'aggregations.timebucket.buckets';
      transforms = [
        { calculate: 'datum.key_as_string || datum.key', as: 'x' },
        {
          calculate: metricType !== 'count'
            ? 'datum.metric_value ? datum.metric_value.value : 0'
            : 'datum.doc_count || 0',
          as: 'y'
        },
        // Find max x for endpoint dot
        ...(showEndpoint ? [
          { joinaggregate: [{ op: 'max', field: 'x', as: '_maxX' }] }
        ] : [])
      ];
    }

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

    const lineColor = this.colorConfig.singleColor || VegaGeneratorBase.DEFAULTS.singleColor;
    const colorScheme = this.colorConfig.scheme || 'category10';
    const xType = bucketType === 'date_histogram' ? 'temporal' : 'ordinal';

    const layers = [];

    if (showArea) {
      layers.push({
        mark: { type: 'area', line: false, opacity: 0.2, interpolate },
        encoding: {
          x: { field: 'x', type: xType, axis: null },
          y: { field: 'y', type: 'quantitative', axis: null, scale: { zero: false } },
          ...(splitField ? {
            color: { field: 'category', type: 'nominal', legend: null, scale: { scheme: colorScheme } }
          } : {
            color: { value: lineColor }
          })
        }
      });
    }

    layers.push({
      mark: { type: 'line', interpolate, strokeWidth },
      encoding: {
        x: { field: 'x', type: xType, axis: null },
        y: { field: 'y', type: 'quantitative', axis: null, scale: { zero: false } },
        ...(splitField ? {
          color: { field: 'category', type: 'nominal', legend: null, scale: { scheme: colorScheme } }
        } : {
          color: { value: lineColor }
        })
      }
    });

    if (showEndpoint) {
      // Filter to only the point where x equals the max x (computed via joinaggregate in top-level transforms)
      // This works reliably in faceted specs unlike window transforms
      layers.push({
        transform: [
          { filter: 'datum.x === datum._maxX' }
        ],
        mark: { type: 'circle', size: 30, stroke: 'white', strokeWidth: 1 },
        encoding: {
          x: { field: 'x', type: xType },
          y: { field: 'y', type: 'quantitative' },
          ...(splitField ? {
            color: { field: 'category', type: 'nominal', legend: null, scale: { scheme: colorScheme } }
          } : {
            color: { value: lineColor }
          })
        }
      });
    }

    // If split field is present, use faceting for small multiples (like preview)
    if (splitField) {
      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        description: 'Spark Lines',
        title: this.config.title || undefined,
        data: {
          url: urlConfig,
          format: { property: formatProperty }
        },
        transform: transforms,
        facet: {
          row: {
            field: 'category',
            type: 'nominal',
            header: {
              labelAngle: 0,
              labelAlign: 'left',
              title: null
            }
          }
        },
        spec: {
          width: this.config.width || 200,
          height: sparkHeight,
          layer: layers
        },
        config: { view: { stroke: null }, axis: this.getAxisStyleConfig() }
      };
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Sparkline',
      title: this.config.title || undefined,
      height: sparkHeight,
      data: {
        url: urlConfig,
        format: { property: formatProperty }
      },
      transform: transforms,
      layer: layers,
      config: { view: { stroke: null }, axis: this.getAxisStyleConfig() }
    };
  }
}

export default SparklineGenerator;

