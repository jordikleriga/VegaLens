/**
 * Dual Axis Chart Generator
 * Generates Vega-Lite specs for dual-axis charts with independent Y scales
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class DualAxisGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'dual_axis',
    name: 'Dual-Axis Chart',
    description: 'Show two metrics with independent Y-axis scales',
    category: 'trend',
    icon: 'activity'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true, fieldTypes: ['date', 'keyword', 'text'] },
      { name: 'yField1', label: 'Y-Axis 1', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'yField2', label: 'Y-Axis 2', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['series', 'faceted'], default: 'series', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'y1Label', label: 'Y1 Label', type: 'text', default: '' },
      { name: 'y2Label', label: 'Y2 Label', type: 'text', default: '' },
      { name: 'y1Color', label: 'Y1 Color', type: 'color', default: '#85C5A6' },
      { name: 'y2Color', label: 'Y2 Color', type: 'color', default: '#85A9C5' },
      { name: 'y1MarkType', label: 'Y1 Mark Type', type: 'select', options: ['area', 'line', 'bar'], default: 'area' },
      { name: 'y2MarkType', label: 'Y2 Mark Type', type: 'select', options: ['line', 'point', 'bar'], default: 'line' },
      { name: 'y1Aggregation', label: 'Y1 Aggregation', type: 'select', options: ['sum', 'mean', 'count', 'min', 'max'], default: 'mean' },
      { name: 'y2Aggregation', label: 'Y2 Aggregation', type: 'select', options: ['sum', 'mean', 'count', 'min', 'max'], default: 'mean' }
    ]
  };

  static example = {
    config: {
      xField: 'month',
      yField1: 'revenue',
      yField2: 'customers',
      y1Label: 'Revenue ($)',
      y2Label: 'Customers',
      title: 'Revenue vs Customer Growth'
    },
    data: [
      { month: 'Jan', revenue: 12000, customers: 150 },
      { month: 'Feb', revenue: 14500, customers: 165 },
      { month: 'Mar', revenue: 13800, customers: 180 },
      { month: 'Apr', revenue: 16200, customers: 195 },
      { month: 'May', revenue: 18500, customers: 220 }
    ]
  };

  generate(data) {
    const {
      xField, yField1, yField2, y1Label, y2Label,
      y1Color = '#85C5A6', y2Color = '#85A9C5',
      y1MarkType = 'area', y2MarkType = 'line',
      y1Aggregation = 'mean', y2Aggregation = 'mean'
    } = this.config;

    logger.debug('Generating dual-axis chart spec', {
      event: 'dual_axis_generate',
      xField,
      yField1,
      yField2
    });

    const resolvedXField = this.resolveFieldPath(xField, data);
    const resolvedYField1 = this.resolveFieldPath(yField1, data);
    const resolvedYField2 = this.resolveFieldPath(yField2, data);

    // Normalize aggregation operators
    const normalizeAgg = (agg) => {
      if (!agg) return 'mean';
      const aggLower = agg.toLowerCase();
      if (aggLower === 'avg' || aggLower === 'average') return 'mean';
      return aggLower;
    };

    const agg1 = normalizeAgg(y1Aggregation);
    const agg2 = normalizeAgg(y2Aggregation);

    // Check temporal type
    const isTemporal = this.isTemporalField(data, resolvedXField);
    const sortedData = isTemporal ? this.sortDataByTemporalField(data, resolvedXField) : data;

    const sampleValue = sortedData && sortedData.length > 0 ? sortedData[0][resolvedXField] : null;
    const isDate = sampleValue && typeof sampleValue === 'string' && 
      (sampleValue.includes('-') || sampleValue.includes('/'));

    let xEncoding;
    if (isDate) {
      xEncoding = {
        timeUnit: 'month',
        field: resolvedXField,
        type: 'temporal',
        axis: { format: '%b', title: null },
        sort: 'ascending'
      };
    } else if (isTemporal) {
      xEncoding = {
        field: resolvedXField,
        type: 'ordinal',
        axis: { title: null },
        sort: this.getTemporalDomain(sortedData, resolvedXField)
      };
    } else {
      xEncoding = {
        field: resolvedXField,
        type: 'ordinal',
        axis: { title: null }
      };
    }

    // Build Y1 layer
    const y1Layer = {
      mark: { 
        type: y1MarkType, 
        color: y1Color,
        opacity: y1MarkType === 'area' ? 0.3 : 1
      },
      encoding: {
        y: {
          aggregate: agg1,
          field: resolvedYField1,
          type: 'quantitative',
          title: y1Label || yField1,
          axis: { titleColor: y1Color }
        }
      }
    };

    // Build Y2 layer
    const y2MarkConfig = y2MarkType === 'line' 
      ? { type: 'line', stroke: y2Color, interpolate: 'monotone' }
      : { type: y2MarkType, color: y2Color, interpolate: 'monotone' };

    const y2Layer = {
      mark: y2MarkConfig,
      encoding: {
        y: {
          aggregate: agg2,
          field: resolvedYField2,
          type: 'quantitative',
          title: y2Label || yField2,
          axis: { titleColor: y2Color }
        }
      }
    };

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Dual Axis Chart with independent Y scales',
      title: this.config.title || '',
      width: this.config.width || 400,
      height: this.config.height || 300,
      data: { values: sortedData },
      encoding: { x: xEncoding },
      layer: [y1Layer, y2Layer],
      resolve: { scale: { y: 'independent' } }
    };
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      xField, yField1, yField2, y1Label, y2Label,
      y1Color = '#85C5A6', y2Color = '#85A9C5',
      y1MarkType = 'area', y2MarkType = 'line'
    } = this.config;

    // Use actual aggregation config structure
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || xField;
    const bucketType = bucketAgg?.type || 'date_histogram';
    const bucketOptions = bucketAgg?.options || {};

    // Get metrics (dual axis expects two metrics)
    const metric1 = metrics[0] || { type: 'avg', field: yField1 };
    const metric2 = metrics[1] || { type: 'avg', field: yField2 };

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
        size: bucketOptions.size || 50
      };
    }

    const aggs = {
      timebucket: {
        [bucketType]: bucketAggConfig,
        aggs: {
          metric1: { [metric1.type]: { field: metric1.field } },
          metric2: { [metric2.type]: { field: metric2.field } }
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

    if (useContext || bucketType === 'date_histogram') {
      urlConfig['%context%'] = true;
      urlConfig['%timefield%'] = timeField;
    }

    const transforms = [
      { calculate: 'datum.key_as_string || datum.key', as: 'x' },
      { calculate: 'datum.metric1.value', as: 'y1' },
      { calculate: 'datum.metric2.value', as: 'y2' }
    ];

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Dual Axis Chart',
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
          axis: { title: null },
          scale: bucketType === 'date_histogram' || bucketType === 'terms' ? { padding: 0 } : undefined
        }
      },
      layer: [
        {
          mark: { type: y1MarkType, color: y1Color, opacity: y1MarkType === 'area' ? 0.3 : 1 },
          encoding: {
            y: {
              field: 'y1',
              type: 'quantitative',
              title: y1Label || yField1,
              axis: { titleColor: y1Color }
            }
          }
        },
        {
          mark: { type: y2MarkType, stroke: y2Color, interpolate: 'monotone' },
          encoding: {
            y: {
              field: 'y2',
              type: 'quantitative',
              title: y2Label || yField2,
              axis: { titleColor: y2Color }
            }
          }
        }
      ],
      resolve: { scale: { y: 'independent' } },
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default DualAxisGenerator;

