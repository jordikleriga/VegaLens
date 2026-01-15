/**
 * Radial Bar Generator
 * Generates Vega specs for radial bar charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class RadialGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'radial',
    name: 'Radial Bar',
    description: 'Circular bar chart showing categories in a radial layout',
    category: 'comparison',
    icon: 'circle-dot'
  };

  static schema = {
    fields: [
      { name: 'categoryField', label: 'Category', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'innerRadius', label: 'Inner Radius %', type: 'number', min: 0, max: 80, default: 20 },
      { name: 'aggregation', label: 'Aggregation', type: 'select', options: ['sum', 'count', 'avg', 'min', 'max'], default: 'sum' },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['nested', 'composite'], default: 'nested', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'showLabels', label: 'Show Labels', type: 'boolean', default: true },
      { name: 'padAngle', label: 'Pad Angle', type: 'number', min: 0, max: 0.2, step: 0.01, default: 0 }
    ]
  };

  static example = {
    config: {
      categoryField: 'browser',
      valueField: 'share',
      title: 'Browser Usage',
      innerRadius: 30
    },
    data: [
      { browser: 'Chrome', share: 65 },
      { browser: 'Firefox', share: 12 },
      { browser: 'Safari', share: 18 },
      { browser: 'Edge', share: 4 },
      { browser: 'Other', share: 1 }
    ]
  };

  generate(data) {
    const { 
      categoryField, valueField, innerRadius = 20, aggregation,
      showLabels = true, padAngle = 0
    } = this.config;
    
    const inner = innerRadius / 100;
    
    logger.debug('Generating radial bar spec', {
      event: 'radial_generate',
      categoryField,
      valueField,
      innerRadius
    });

    // Resolve field paths to actual data keys
    // For multi-level aggregations, use _composite_key if available
    const hasCompositeKey = data && data.length > 0 && '_composite_key' in data[0];
    const resolvedCategoryField = hasCompositeKey ? '_composite_key' : this.resolveFieldPath(categoryField, data);
    const resolvedValueField = this.resolveFieldPath(valueField, data);

    // Check if data is already aggregated
    const categoryValues = (data || []).map(d => d[resolvedCategoryField]);
    const needsAggregation = categoryValues.length !== new Set(categoryValues).size;
    const valField = needsAggregation ? 'value' : resolvedValueField;
    const vegaAggOp = VegaGeneratorBase.getVegaAggregateOp(aggregation);

    // Sort data by value descending for better visual presentation
    const sortedData = [...(data || [])].sort((a, b) => {
      const aVal = a[resolvedValueField] || a['_count'] || 0;
      const bVal = b[resolvedValueField] || b['_count'] || 0;
      return bVal - aVal; // Descending order
    });

    // Build transforms - aggregate if needed, then sort
    const transforms = [];
    
    if (needsAggregation) {
      transforms.push({
        type: 'aggregate',
        groupby: [resolvedCategoryField],
        ops: [vegaAggOp],
        fields: [resolvedValueField],
        as: ['value']
      });
    }
    
    // Always sort by value descending
    transforms.push({
      type: 'collect',
      sort: { field: valField, order: 'descending' }
    });

    return {
      ...this.getBaseSpec(),
      data: [
        {
          name: 'source',
          values: sortedData,
          transform: transforms
        }
      ],
      signals: [
        { name: 'radius', update: 'min(width, height) / 2 - 20' }
      ],
      scales: [
        {
          name: 'angular',
          type: 'band',
          domain: { data: 'source', field: resolvedCategoryField },
          range: [0, { signal: '2 * PI' }],
          padding: padAngle
        },
        {
          name: 'radial',
          type: 'sqrt',
          domain: { data: 'source', field: valField },
          range: [{ signal: `radius * ${inner}` }, { signal: 'radius' }],
          zero: true
        },
        this.getColorScale(resolvedCategoryField)
      ],
      marks: [
        {
          type: 'arc',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { signal: 'width / 2' },
              y: { signal: 'height / 2' },
              startAngle: { scale: 'angular', field: resolvedCategoryField },
              endAngle: { signal: `scale('angular', datum['${resolvedCategoryField}']) + bandwidth('angular')` },
              innerRadius: { signal: `radius * ${inner}` },
              outerRadius: { scale: 'radial', field: valField },
              fill: { scale: 'color', field: resolvedCategoryField },
              ...this.getStrokeProps()
            },
            update: { fillOpacity: { value: 0.9 } },
            hover: { fillOpacity: { value: 1 } }
          }
        },
        ...(showLabels ? [{
          type: 'text',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { signal: 'width / 2' },
              y: { signal: 'height / 2' },
              theta: { signal: `scale('angular', datum['${resolvedCategoryField}']) + bandwidth('angular') / 2` },
              radius: { signal: 'radius + 15' },
              text: { field: resolvedCategoryField },
              align: { value: 'center' },
              baseline: { value: 'middle' },
              fontSize: { value: 13 },
              fill: { value: '#ffffff' },
              fontWeight: { value: 600 },
              stroke: { value: '#000000' },
              strokeWidth: { value: 0.3 }
            }
          }
        }] : [])
      ],
      legends: [
        { 
          fill: 'color', 
          title: hasCompositeKey ? this.getLegendLabel(categoryField) + ' (Grouped)' : this.getLegendLabel(categoryField), 
          orient: 'right' 
        }
      ]
    };
  }

  /**
   * Generate Kibana-compatible full Vega spec with Elasticsearch data source
   * Uses full Vega (not Vega-Lite) for proper radial bar support
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      categoryField, valueField, innerRadius = 20, showLabels = true, padAngle = 0.02
    } = this.config;

    // Get consistent style configuration
    const styleConfig = this.getKibanaStyleConfig();

    // Use actual aggregation config structure (NEW PATTERN)
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || categoryField;
    const metric = metrics[0];
    const metricType = metric?.type || 'count';
    const metricField = metric?.field || valueField;

    // Build the Elasticsearch aggregation
    const aggs = {
      categories: {
        terms: { field: bucketField, size: 20, order: { _count: 'desc' } },
        aggs: metricType !== 'count' ? {
          metric_value: { [metricType]: { field: metricField } }
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

    if (useContext) {
      urlConfig['%context%'] = true;
      urlConfig['%timefield%'] = timeField;
    }

    // Build Vega-Lite spec for Kibana (radial bar = arc with theta and radius)
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Radial Bar Chart',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.categories.buckets' }
      },
      transform: [
        { calculate: 'datum.key', as: 'category' },
        { calculate: metricType !== 'count' ? 'datum.metric_value.value' : 'datum.doc_count', as: 'value' }
      ],
      mark: {
        type: 'arc',
        innerRadius: innerRadius,
        outerRadius: 150,
        padAngle: padAngle,
        tooltip: true
      },
      encoding: {
        theta: {
          field: 'category',
          type: 'nominal',
          stack: false
        },
        radius: {
          field: 'value',
          type: 'quantitative',
          scale: { type: 'sqrt', zero: true, range: [innerRadius, 150] }
        },
        color: {
          field: 'category',
          type: 'nominal',
          scale: { scheme: styleConfig.colorScheme },
          legend: { title: this.getLegendLabel(categoryField) }
        },
        tooltip: [
          { field: 'category', type: 'nominal' },
          { field: 'value', type: 'quantitative' }
        ]
      }
    };
  }
}

export default RadialGenerator;

