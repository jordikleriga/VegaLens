/**
 * Radar Chart Generator
 * Generates Vega specs for radar/spider charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class RadarGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'radar',
    name: 'Radar Chart',
    description: 'Show multiple dimensions on a radial grid with polygon shapes',
    category: 'comparison',
    icon: 'radar'
  };

  static schema = {
    fields: [
      { name: 'keyField', label: 'Dimension Key', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'categoryField', label: 'Series/Category', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['overlapping', 'faceted'], default: 'overlapping', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'fillOpacity', label: 'Fill Opacity', type: 'number', min: 0, max: 1, step: 0.1, default: 0.1 },
      { name: 'strokeWidth', label: 'Stroke Width', type: 'number', min: 1, max: 5, default: 2 },
      { name: 'showValues', label: 'Show Values', type: 'boolean', default: true }
    ]
  };

  static example = {
    config: {
      keyField: 'skill',
      valueField: 'score',
      categoryField: 'person',
      title: 'Skill Comparison'
    },
    data: [
      { skill: 'JavaScript', score: 90, person: 'Alice' },
      { skill: 'Python', score: 75, person: 'Alice' },
      { skill: 'Design', score: 60, person: 'Alice' },
      { skill: 'Communication', score: 85, person: 'Alice' },
      { skill: 'JavaScript', score: 70, person: 'Bob' },
      { skill: 'Python', score: 95, person: 'Bob' },
      { skill: 'Design', score: 80, person: 'Bob' },
      { skill: 'Communication', score: 65, person: 'Bob' }
    ]
  };

  generate(data) {
    const { 
      keyField = 'key', valueField = 'value', categoryField,
      fillOpacity = 0.1, strokeWidth = 2, showValues = true
    } = this.config;
    
    logger.debug('Generating radar chart spec', {
      event: 'radar_generate',
      keyField,
      valueField,
      categoryField
    });

    const colorScheme = this.config.colorScheme || this.colorConfig.scheme || 'category10';
    const rawData = data || [];
    
    // Get unique keys (dimensions) and categories (series)
    const uniqueKeys = [...new Set(rawData.map(d => d[keyField]))];
    const hasCategories = categoryField && rawData.some(d => d[categoryField] !== undefined);
    const uniqueCategories = hasCategories 
      ? [...new Set(rawData.map(d => d[categoryField]))]
      : ['default'];

    // Pre-process data: ensure each category has all keys in the same order
    const processedData = [];
    uniqueCategories.forEach(cat => {
      uniqueKeys.forEach((key, keyIndex) => {
        const dataPoint = rawData.find(d => 
          d[keyField] === key && 
          (hasCategories ? d[categoryField] === cat : true)
        );
        processedData.push({
          key: key,
          value: dataPoint ? parseFloat(dataPoint[valueField]) || 0 : 0,
          category: cat,
          keyIndex: keyIndex
        });
      });
    });

    return {
      $schema: 'https://vega.github.io/schema/vega/v5.json',
      description: 'A radar chart showing multiple dimensions in a radial layout.',
      width: this.config.width || 400,
      height: this.config.height || 400,
      padding: 50,
      autosize: { type: 'none', contains: 'padding' },
      title: {
        text: this.config.title || '',
        color: '#000000',
        fontSize: 16
      },
      background: 'transparent',
      signals: [
        { name: 'radius', update: 'min(width, height) / 2' }
      ],
      data: [
        {
          name: 'table',
          values: processedData
        },
        {
          name: 'keys',
          source: 'table',
          transform: [
            { type: 'aggregate', groupby: ['key', 'keyIndex'] },
            { type: 'collect', sort: { field: 'keyIndex' } }
          ]
        }
      ],
      scales: [
        {
          name: 'angular',
          type: 'point',
          range: { signal: '[-PI, PI]' },
          padding: 0.5,
          domain: uniqueKeys
        },
        {
          name: 'radial',
          type: 'linear',
          range: { signal: '[0, radius]' },
          zero: true,
          nice: false,
          domain: { data: 'table', field: 'value' },
          domainMin: 0
        },
        {
          name: 'color',
          type: 'ordinal',
          domain: uniqueCategories,
          range: { scheme: colorScheme }
        }
      ],
      encode: {
        enter: {
          x: { signal: 'radius' },
          y: { signal: 'radius' }
        }
      },
      marks: [
        // Radial grid lines (spokes)
        {
          type: 'rule',
          name: 'radial-grid',
          from: { data: 'keys' },
          zindex: 0,
          encode: {
            enter: {
              x: { value: 0 },
              y: { value: 0 },
              x2: { signal: "radius * cos(scale('angular', datum.key))" },
              y2: { signal: "radius * sin(scale('angular', datum.key))" },
              stroke: { value: '#475569' },
              strokeWidth: { value: 1 }
            }
          }
        },
        // Outer polygon boundary
        {
          type: 'line',
          name: 'outer-line',
          from: { data: 'radial-grid' },
          encode: {
            enter: {
              interpolate: { value: 'linear-closed' },
              x: { field: 'x2' },
              y: { field: 'y2' },
              stroke: { value: '#334155' },
              strokeWidth: { value: 1 }
            }
          }
        },
        // Key labels (dimension names)
        {
          type: 'text',
          name: 'key-label',
          from: { data: 'keys' },
          zindex: 1,
          encode: {
            enter: {
              x: { signal: "(radius + 15) * cos(scale('angular', datum.key))" },
              y: { signal: "(radius + 15) * sin(scale('angular', datum.key))" },
              text: { field: 'key' },
              align: [
                { test: "abs(scale('angular', datum.key)) > PI / 2", value: 'right' },
                { value: 'left' }
              ],
              baseline: [
                { test: "scale('angular', datum.key) > 0", value: 'top' },
                { test: "scale('angular', datum.key) == 0", value: 'middle' },
                { value: 'bottom' }
              ],
              fill: { value: '#ffffff' },
              fontSize: { value: 13 },
              fontWeight: { value: 600 },
              stroke: { value: '#000000' },
              strokeWidth: { value: 0.3 }
            }
          }
        },
        // Category polygon lines
        {
          type: 'group',
          name: 'categories',
          zindex: 1,
          from: {
            facet: { 
              data: 'table', 
              name: 'facet', 
              groupby: ['category']
            }
          },
          marks: [
            {
              type: 'line',
              name: 'category-line',
              from: { data: 'facet' },
              encode: {
                enter: {
                  interpolate: { value: 'linear-closed' },
                  x: { signal: "scale('radial', datum.value) * cos(scale('angular', datum.key))" },
                  y: { signal: "scale('radial', datum.value) * sin(scale('angular', datum.key))" },
                  stroke: { scale: 'color', field: 'category' },
                  strokeWidth: { value: strokeWidth },
                  fill: { scale: 'color', field: 'category' },
                  fillOpacity: { value: fillOpacity }
                }
              }
            },
            ...(showValues ? [{
              type: 'text',
              name: 'value-text',
              from: { data: 'category-line' },
              encode: {
                enter: {
                  x: { signal: 'datum.x' },
                  y: { signal: 'datum.y' },
                  text: { signal: "format(datum.datum.value, '.1f')" },
                  align: { value: 'center' },
                  baseline: { value: 'bottom' },
                  fill: { value: '#000000' },
                  fontSize: { value: 9 }
                }
              }
            }] : [])
          ]
        }
      ],
      legends: hasCategories ? [
        {
          fill: 'color',
          title: categoryField || 'Series',
          orient: 'right',
          encode: {
            labels: { update: { fill: { value: '#000000' } } },
            title: { update: { fill: { value: '#ffffff' } } }
          }
        }
      ] : []
    };
  }

  /**
   * Generate Kibana-compatible full Vega spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, aggregation } = elasticConfig;
    const idx = index || '_all';
    const { keyField, valueField, categoryField, fillOpacity = 0.1, strokeWidth = 2, showValues = true } = this.config;

    // Use actual aggregation config structure
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const splitBy = aggregation?.splitBy;
    const metrics = aggregation?.metrics || [];

    const keyBucketField = bucketAgg?.field || keyField;
    const keyBucketOptions = bucketAgg?.options || {};
    const categoryBucketField = splitBy?.field || categoryField;
    const categoryOptions = splitBy?.options || {};

    const metric = metrics[0];
    const metricField = metric?.field || valueField;
    const metricType = metric?.type; // Don't default - leave undefined if no metric

    // Clean field names for display
    const cleanFieldName = (field) => field ? field.replace(/\.keyword$/, '').replace(/_/g, ' ') : '';
    const safeKeyField = keyBucketField.replace(/\./g, '_').replace(/\.keyword$/, '');
    const safeCategoryField = categoryBucketField ? categoryBucketField.replace(/\./g, '_').replace(/\.keyword$/, '') : null;
    const safeMetricField = metricField ? `${metricType}_${metricField.replace(/\./g, '_')}` : '_count';

    // Build aggregation - use multi_terms if we have a category field
    let aggs;
    if (categoryBucketField) {
      aggs = {
        primary: {
          multi_terms: {
            terms: [
              { field: keyBucketField },
              { field: categoryBucketField }
            ],
            size: keyBucketOptions.size || 50
          },
          aggs: (metrics.length > 0 && metricType && metricType !== 'count' && metricField) ? {
            metric_0: { [metricType]: { field: metricField } }
          } : {}
        }
      };
    } else {
      aggs = {
        primary: {
          terms: { field: keyBucketField, size: keyBucketOptions.size || 20 },
          aggs: (metrics.length > 0 && metricType && metricType !== 'count' && metricField) ? {
            metric_0: { [metricType]: { field: metricField } }
          } : {}
        }
      };
    }

    // Build transforms based on whether we have categories
    const transforms = categoryBucketField ? [
      { type: 'formula', expr: 'datum.key[0]', as: safeKeyField },
      { type: 'formula', expr: 'datum.key[1]', as: safeCategoryField },
      { type: 'formula', expr: 'datum.doc_count', as: '_count' },
      { type: 'formula', expr: metricType !== 'count' ? 'datum.metric_0.value' : 'datum.doc_count', as: safeMetricField },
      { type: 'formula', expr: `datum['${safeKeyField}']`, as: 'key' },
      { type: 'formula', expr: `datum['${safeMetricField}']`, as: 'value' },
      { type: 'formula', expr: `datum['${safeCategoryField}']`, as: 'category' },
      { type: 'collect', sort: { field: ['category', 'key'] } }
    ] : [
      { type: 'formula', expr: 'datum.key', as: safeKeyField },
      { type: 'formula', expr: 'datum.doc_count', as: '_count' },
      { type: 'formula', expr: metricType !== 'count' ? 'datum.metric_0.value' : 'datum.doc_count', as: safeMetricField },
      { type: 'formula', expr: `datum['${safeKeyField}']`, as: 'key' },
      { type: 'formula', expr: `datum['${safeMetricField}']`, as: 'value' },
      { type: 'formula', expr: "'default'", as: 'category' },
      { type: 'collect', sort: { field: 'key' } }
    ];

    return {
      $schema: 'https://vega.github.io/schema/vega/v5.json',
      description: 'Radar Chart',
      background: 'transparent',
      config: {
        kibana: { hideWarnings: true },
        legend: {
          labelColor: '#000000',
          titleColor: '#000000'
        }
      },

      signals: [
        { name: 'radius', update: 'min(width, height) / 2 - 40' },
        { name: 'centerX', update: 'width / 2' },
        { name: 'centerY', update: 'height / 2' }
      ],

      data: [
        {
          name: 'rawData',
          url: {
            index: idx,
            body: {
              size: 0,
              ...(query && Object.keys(query).length > 0 ? { query } : {}),
              aggs
            }
          },
          format: { property: 'aggregations.primary.buckets' },
          transform: transforms
        },
        {
          name: 'keys',
          source: 'rawData',
          transform: [
            { type: 'aggregate', groupby: ['key'] },
            { type: 'collect', sort: { field: 'key' } }
          ]
        },
        {
          name: 'table',
          source: 'rawData',
          transform: [
            { type: 'collect', sort: { field: ['category', 'key'] } }
          ]
        }
      ],

      scales: [
        {
          name: 'angular',
          type: 'point',
          range: { signal: '[-PI, PI]' },
          padding: 0.5,
          domain: { data: 'keys', field: 'key' }
        },
        {
          name: 'radial',
          type: 'linear',
          range: { signal: '[0, radius]' },
          zero: true,
          nice: false,
          domain: { data: 'table', field: 'value' },
          domainMin: 0
        },
        {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'table', field: 'category' },
          range: { scheme: 'category10' }
        }
      ],

      marks: [
        // Grid lines (spokes)
        {
          type: 'rule',
          from: { data: 'keys' },
          zindex: 0,
          encode: {
            enter: {
              x: { signal: 'centerX' },
              y: { signal: 'centerY' },
              x2: { signal: "centerX + radius * cos(scale('angular', datum.key))" },
              y2: { signal: "centerY + radius * sin(scale('angular', datum.key))" },
              stroke: { value: '#666666' },
              strokeWidth: { value: 1 }
            }
          }
        },
        // Outer boundary line
        {
          type: 'line',
          name: 'outer-line',
          from: { data: 'keys' },
          zindex: 0,
          encode: {
            enter: {
              interpolate: { value: 'linear-closed' },
              x: { signal: "centerX + radius * cos(scale('angular', datum.key))" },
              y: { signal: "centerY + radius * sin(scale('angular', datum.key))" },
              stroke: { value: '#444444' },
              strokeWidth: { value: 1 }
            }
          }
        },
        // Axis labels
        {
          type: 'text',
          from: { data: 'keys' },
          zindex: 2,
          encode: {
            enter: {
              x: { signal: "centerX + (radius + 20) * cos(scale('angular', datum.key))" },
              y: { signal: "centerY + (radius + 20) * sin(scale('angular', datum.key))" },
              text: { field: 'key' },
              align: [
                { test: "abs(scale('angular', datum.key)) > PI / 2", value: 'right' },
                { value: 'left' }
              ],
              baseline: [
                { test: "scale('angular', datum.key) > 0", value: 'top' },
                { test: "scale('angular', datum.key) == 0", value: 'middle' },
                { value: 'bottom' }
              ],
              fill: { value: '#000000' },
              fontSize: { value: 12 },
              fontWeight: { value: 'bold' }
            }
          }
        },
        // Data lines (grouped by category)
        {
          type: 'group',
          zindex: 1,
          from: {
            facet: {
              data: 'table',
              name: 'facet',
              groupby: ['category']
            }
          },
          marks: [
            {
              type: 'line',
              name: 'category-line',
              from: { data: 'facet' },
              encode: {
                enter: {
                  interpolate: { value: 'linear-closed' },
                  x: { signal: "centerX + scale('radial', datum.value) * cos(scale('angular', datum.key))" },
                  y: { signal: "centerY + scale('radial', datum.value) * sin(scale('angular', datum.key))" },
                  stroke: { scale: 'color', field: 'category' },
                  strokeWidth: { value: strokeWidth },
                  fill: { scale: 'color', field: 'category' },
                  fillOpacity: { value: fillOpacity }
                }
              }
            },
            ...(showValues ? [{
              type: 'text',
              name: 'value-text',
              from: { data: 'category-line' },
              encode: {
                enter: {
                  x: { signal: 'datum.x' },
                  y: { signal: 'datum.y' },
                  text: { signal: "format(datum.datum.value, '.1f')" },
                  align: { value: 'center' },
                  baseline: { value: 'bottom' },
                  fill: { value: '#000000' },
                  fontSize: { value: 9 }
                }
              }
            }] : [])
          ]
        }
      ],

      legends: categoryBucketField ? [
        {
          fill: 'color',
          title: cleanFieldName(categoryBucketField),
          orient: 'top',
          direction: 'horizontal',
          symbolType: 'square',
          symbolSize: 100,
          padding: 40,
          encode: {
            labels: { update: { fill: { value: '#000000' } } },
            title: { update: { fill: { value: '#000000' } } },
            symbols: { update: { fill: { scale: 'color', field: 'value' } } }
          }
        }
      ] : []
    };
  }
}

export default RadarGenerator;

