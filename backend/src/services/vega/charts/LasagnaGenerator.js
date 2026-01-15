/**
 * Lasagna Plot Generator
 * Generates Vega-Lite specs for lasagna (dense time-series heatmap) charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class LasagnaGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'lasagna',
    name: 'Lasagna Plot',
    description: 'Dense time-series heatmap with categories as rows',
    category: 'trend',
    icon: 'grid'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'Time/X-Axis', type: 'field', required: true, fieldTypes: ['date', 'keyword', 'text'] },
      { name: 'yField', label: 'Category/Y-Axis', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['nested_rows', 'faceted'], default: 'nested_rows', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'timeUnit', label: 'Time Unit', type: 'select', options: ['yearmonthdate', 'yearmonth', 'yearweek', 'month', 'date'], default: 'yearmonthdate' },
      { name: 'colorScheme', label: 'Color Scheme', type: 'select', options: ['blues', 'greens', 'oranges', 'reds', 'viridis', 'inferno'], default: 'blues' },
      { name: 'aggregation', label: 'Aggregation', type: 'select', options: ['sum', 'count', 'avg', 'min', 'max'], default: 'sum' }
    ]
  };

  static example = {
    config: {
      xField: 'date',
      yField: 'category',
      valueField: 'value',
      title: 'Activity Over Time',
      colorScheme: 'blues'
    },
    data: [
      { date: '2024-01-01', category: 'Email', value: 45 },
      { date: '2024-01-01', category: 'Slack', value: 120 },
      { date: '2024-01-01', category: 'Meetings', value: 30 },
      { date: '2024-01-02', category: 'Email', value: 52 },
      { date: '2024-01-02', category: 'Slack', value: 95 },
      { date: '2024-01-02', category: 'Meetings', value: 45 }
    ]
  };

  generate(data) {
    const {
      xField, yField, valueField,
      timeUnit = 'yearmonthdate', colorScheme = 'blues', aggregation = 'sum'
    } = this.config;

    logger.debug('Generating lasagna plot spec', {
      event: 'lasagna_generate',
      xField,
      yField,
      valueField,
      dataLength: data?.length,
      sampleRecord: data?.[0],
      availableFields: data?.[0] ? Object.keys(data[0]) : []
    });

    const resolvedXField = this.resolveFieldPath(xField, data);
    const resolvedYField = this.resolveFieldPath(yField, data);
    const resolvedValueField = this.resolveFieldPath(valueField, data);

    logger.debug('Lasagna field resolution', {
      xField,
      resolvedXField,
      yField,
      resolvedYField,
      valueField,
      resolvedValueField
    });

    const isTemporal = this.isTemporalField(data, resolvedXField);
    const sortedData = isTemporal ? this.sortDataByTemporalField(data, resolvedXField) : data;

    // Build x encoding - only use timeUnit for temporal data
    const xEncoding = {
      field: resolvedXField,
      type: isTemporal ? 'temporal' : 'ordinal',
      title: this.getXLabel(xField),
      axis: {
        labelAngle: -45,
        labelOverlap: false
      }
    };

    // Only add timeUnit for temporal data
    if (isTemporal) {
      xEncoding.timeUnit = timeUnit;
      xEncoding.axis.format = '%Y-%m-%d';
    }

    // Check if data is already aggregated (has metric fields like sum_*, avg_*, etc.)
    // or has _count field indicating pre-aggregated data
    const isPreAggregated = data?.length > 0 && (
      data[0]._count !== undefined ||
      data[0]._split_count !== undefined ||
      Object.keys(data[0]).some(k => /^(sum|avg|min|max|count)_/.test(k))
    );

    logger.debug('Lasagna aggregation check', {
      isPreAggregated,
      sampleKeys: data?.[0] ? Object.keys(data[0]) : []
    });

    // Build color encoding - only aggregate if data is raw (not pre-aggregated)
    const colorEncoding = {
      field: resolvedValueField,
      type: 'quantitative',
      title: valueField,
      scale: { scheme: colorScheme }
    };

    // Only add aggregate if data is NOT pre-aggregated
    if (!isPreAggregated) {
      colorEncoding.aggregate = aggregation;
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Lasagna Plot - Dense Time-Series Heatmap',
      title: this.config.title || '',
      width: this.config.width || 400,
      height: this.config.height || 150,
      data: { values: sortedData },
      mark: 'rect',
      encoding: {
        x: xEncoding,
        y: {
          field: resolvedYField,
          type: 'nominal',
          title: this.getYLabel(yField)
        },
        color: colorEncoding
      },
      config: {
        view: { stroke: null },
        axis: {
          labelColor: '#000000',
          titleColor: '#000000'
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
      xField, yField, valueField,
      timeUnit = 'yearmonthdate', colorScheme = 'blues', aggregation: aggType = 'sum'
    } = this.config;

    // Use actual aggregation config structure (NEW PATTERN)
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const splitBy = aggregation?.splitBy;
    const metrics = aggregation?.metrics || [];

    const xBucketField = bucketAgg?.field || xField;
    const xBucketType = bucketAgg?.type || 'date_histogram';
    // Y-axis comes from splitBy in the aggregation config, fallback to config.yField
    const yBucketField = splitBy?.field || yField;
    const metric = metrics[0];
    const metricType = metric?.type || aggType;
    const metricField = metric?.field || valueField;

    // Build nested aggregation: X bucket -> Y bucket -> metric
    const aggs = {
      xbucket: {
        [xBucketType]: xBucketType === 'date_histogram'
          ? { field: xBucketField, calendar_interval: 'day' }
          : { field: xBucketField, size: 50 },
        aggs: {
          ybucket: {
            terms: { field: yBucketField, size: 20 },
            aggs: metricType !== 'count' ? {
              metric_value: { [metricType]: { field: metricField } }
            } : {}
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

    // Always add Kibana context placeholders for dashboard filter integration
    urlConfig['%context%'] = true;
    urlConfig['%timefield%'] = timeField;

    const transforms = [
      { flatten: ['ybucket.buckets'], as: ['yb'] },
      { calculate: 'datum.key_as_string || datum.key', as: 'x' },
      { calculate: 'datum.yb.key', as: 'y' },
      { calculate: metricType !== 'count' ? 'datum.yb.metric_value.value' : 'datum.yb.doc_count', as: 'value' }
    ];

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Lasagna Plot',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.xbucket.buckets' }
      },
      transform: transforms,
      mark: 'rect',
      encoding: {
        x: {
          field: 'x',
          type: xBucketType === 'date_histogram' ? 'temporal' : 'ordinal',
          title: this.getXLabel(xField),
          axis: { labelAngle: 0, labelOverlap: false }
        },
        y: {
          field: 'y',
          type: 'nominal',
          title: this.getYLabel(yField)
        },
        color: {
          field: 'value',
          type: 'quantitative',
          title: valueField,
          scale: { scheme: colorScheme }
        }
      },
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default LasagnaGenerator;

