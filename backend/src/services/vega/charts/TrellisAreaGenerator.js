/**
 * Trellis Area Chart Generator
 * Generates Vega-Lite specs for small multiples area charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class TrellisAreaGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'trellis_area',
    name: 'Trellis Area',
    description: 'Small multiples of area charts faceted by category',
    category: 'trend',
    icon: 'layout-grid'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true, fieldTypes: ['date', 'number', 'keyword'] },
      { name: 'yField', label: 'Y-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'facetField', label: 'Facet By', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'colorField', label: 'Color By', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['series', 'faceted'], default: 'series', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'panelHeight', label: 'Panel Height', type: 'number', min: 30, max: 200, default: 80 },
      { name: 'panelWidth', label: 'Panel Width', type: 'number', min: 100, max: 800, default: 500 },
      { name: 'showLegend', label: 'Show Legend', type: 'boolean', default: true }
    ]
  };

  static example = {
    config: {
      xField: 'month',
      yField: 'value',
      facetField: 'region',
      title: 'Regional Performance'
    },
    data: [
      { month: 'Jan', value: 100, region: 'North' },
      { month: 'Feb', value: 120, region: 'North' },
      { month: 'Mar', value: 115, region: 'North' },
      { month: 'Jan', value: 80, region: 'South' },
      { month: 'Feb', value: 95, region: 'South' },
      { month: 'Mar', value: 110, region: 'South' },
      { month: 'Jan', value: 150, region: 'East' },
      { month: 'Feb', value: 160, region: 'East' },
      { month: 'Mar', value: 175, region: 'East' }
    ]
  };

  generate(data) {
    const {
      xField, yField, facetField, colorField,
      panelHeight = 60, panelWidth = 300, showLegend = true
    } = this.config;

    logger.debug('Generating trellis area chart spec', {
      event: 'trellis_area_generate',
      xField,
      yField,
      facetField
    });

    const resolvedXField = this.resolveFieldPath(xField, data);
    const resolvedYField = this.resolveFieldPath(yField, data);
    const resolvedFacetField = this.resolveFieldPath(facetField, data);
    const resolvedColorField = colorField ? this.resolveFieldPath(colorField, data) : null;

    const isTemporal = this.isTemporalField(data, resolvedXField);
    const sortedData = isTemporal ? this.sortDataByTemporalField(data, resolvedXField) : data;

    const sampleValue = sortedData && sortedData.length > 0 ? sortedData[0][resolvedXField] : null;
    const isDate = sampleValue && typeof sampleValue === 'string' && 
      (sampleValue.includes('-') || sampleValue.includes('/')) &&
      !isNaN(Date.parse(sampleValue));
    const isNumeric = typeof sampleValue === 'number';

    let xEncoding;
    if (isDate) {
      xEncoding = {
        field: resolvedXField,
        type: 'temporal',
        title: this.getXLabel(xField),
        axis: { grid: false },
        sort: 'ascending'
      };
    } else if (isTemporal) {
      xEncoding = {
        field: resolvedXField,
        type: 'ordinal',
        title: this.getXLabel(xField),
        axis: { grid: false },
        sort: this.getTemporalDomain(sortedData, resolvedXField)
      };
    } else if (isNumeric) {
      xEncoding = {
        field: resolvedXField,
        type: 'quantitative',
        title: this.getXLabel(xField),
        axis: { grid: false }
      };
    } else {
      xEncoding = {
        field: resolvedXField,
        type: 'nominal',
        title: this.getXLabel(xField),
        axis: { grid: false, labelAngle: -45, labelLimit: 100 }
      };
    }

    const colorScheme = this.config.colorScheme || this.colorConfig.scheme || 'category10';

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Trellis Area Chart - Small multiples',
      title: this.config.title || '',
      width: panelWidth,
      height: panelHeight,
      data: { values: sortedData },
      mark: {
        type: 'area',
        line: true,
        opacity: this.getOpacity() || 0.7
      },
      encoding: {
        x: xEncoding,
        y: {
          field: resolvedYField,
          type: 'quantitative',
          title: this.getYLabel(yField),
          axis: { grid: true, gridOpacity: 0.3 }
        },
        row: {
          field: resolvedFacetField,
          type: 'nominal',
          title: this.getLegendLabel(facetField),
          header: {
            labelAngle: 0,
            labelAlign: 'left',
            labelPadding: 2,
            titlePadding: 2
          }
        },
        color: resolvedColorField ? {
          field: resolvedColorField,
          type: 'nominal',
          scale: { scheme: colorScheme },
          legend: showLegend ? {} : null
        } : {
          field: resolvedFacetField,
          type: 'nominal',
          scale: { scheme: colorScheme },
          legend: null
        }
      },
      config: {
        view: { stroke: null },
        facet: { spacing: 5 }
      }
    };

    return spec;
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      xField, yField, facetField, colorField,
      panelHeight = 60, panelWidth = 300, showLegend = true
    } = this.config;

    // Use actual aggregation config structure
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const splitBy = aggregation?.splitBy;
    const metrics = aggregation?.metrics || [];

    const xBucketField = bucketAgg?.field || xField;
    const xBucketType = bucketAgg?.type || 'date_histogram';
    const xBucketOptions = bucketAgg?.options || {};

    const facetBucketField = splitBy?.field || facetField;
    const facetOptions = splitBy?.options || { size: 10 };

    const metric = metrics[0];
    const metricType = metric?.type; // Don't default - leave undefined if no metric
    const metricField = metric?.field || yField;

    // Build X bucket aggregation config
    let xBucketConfig;
    if (xBucketType === 'date_histogram') {
      xBucketConfig = {
        field: xBucketField,
        calendar_interval: xBucketOptions.calendarInterval || xBucketOptions.interval || 'day',
        ...(xBucketOptions.timeZone && { time_zone: xBucketOptions.timeZone }),
        min_doc_count: 0
      };
    } else if (xBucketType === 'histogram') {
      xBucketConfig = {
        field: xBucketField,
        interval: xBucketOptions.interval || 1,
        min_doc_count: 0
      };
    } else {
      xBucketConfig = {
        field: xBucketField,
        size: xBucketOptions.size || 50
      };
    }

    // Nested aggregation: facet -> x bucket -> metric
    const aggs = {
      facets: {
        terms: { field: facetBucketField, size: facetOptions.size || 10 },
        aggs: {
          xbucket: {
            [xBucketType]: xBucketConfig,
            aggs: (metrics.length > 0 && metricType && metricType !== 'count' && metricField) ? {
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

    const colorScheme = this.config.colorScheme || 'category10';

    const transforms = [
      { flatten: ['xbucket.buckets'], as: ['xb'] },
      { calculate: 'datum.key', as: 'facet' },
      { calculate: 'datum.xb.key_as_string || datum.xb.key', as: 'x' },
      { calculate: metricType !== 'count' ? 'datum.xb.metric_value.value' : 'datum.xb.doc_count', as: 'y' }
    ];

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Trellis Area Chart',
      title: this.config.title || undefined,
      width: { step: 80 },
      height: 100,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.facets.buckets' }
      },
      transform: transforms,
      mark: { type: 'area', line: true, opacity: 0.7 },
      encoding: {
        x: {
          field: 'x',
          type: xBucketType === 'date_histogram' ? 'temporal' : 'ordinal',
          title: this.getXLabel(xField),
          axis: { grid: false },
          scale: xBucketType === 'date_histogram' || xBucketType === 'terms' ? { padding: 0 } : undefined
        },
        y: {
          field: 'y',
          type: 'quantitative',
          title: this.getYLabel(yField),
          axis: { grid: true, gridOpacity: 0.3 }
        },
        row: {
          field: 'facet',
          type: 'nominal',
          title: this.getLegendLabel(facetField),
          header: {
            labelAngle: 0,
            labelAlign: 'left',
            labelPadding: 2,
            titlePadding: 2
          }
        },
        color: {
          field: 'facet',
          type: 'nominal',
          scale: { scheme: colorScheme },
          legend: showLegend ? {} : null
        }
      },
      config: {
        view: { stroke: null },
        facet: { spacing: 10 },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default TrellisAreaGenerator;

