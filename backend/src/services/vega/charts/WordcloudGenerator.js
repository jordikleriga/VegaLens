/**
 * Word Cloud Generator
 * Generates Vega specs for word cloud visualizations
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class WordcloudGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'wordcloud',
    name: 'Word Cloud',
    description: 'Display text with size based on frequency or value',
    category: 'text',
    icon: 'cloud'
  };

  static schema = {
    fields: [
      { name: 'textField', label: 'Text', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'sizeField', label: 'Size By', type: 'field', required: false, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['color', 'faceted'], default: 'color', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'maxWords', label: 'Max Words', type: 'number', min: 10, max: 500, default: 100 },
      { name: 'fontFamily', label: 'Font Family', type: 'select', options: ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana', 'Impact'], default: 'Arial' },
      { name: 'minFontSize', label: 'Min Font Size', type: 'number', min: 8, max: 24, default: 12 },
      { name: 'maxFontSize', label: 'Max Font Size', type: 'number', min: 24, max: 100, default: 56 },
      { name: 'spiral', label: 'Layout', type: 'select', options: ['archimedean', 'rectangular'], default: 'archimedean' },
      { name: 'rotations', label: 'Allow Rotations', type: 'boolean', default: true }
    ]
  };

  static example = {
    config: {
      textField: 'word',
      sizeField: 'count',
      title: 'Popular Topics'
    },
    data: [
      { word: 'JavaScript', count: 150 },
      { word: 'Python', count: 130 },
      { word: 'React', count: 100 },
      { word: 'Node.js', count: 90 },
      { word: 'TypeScript', count: 85 },
      { word: 'Docker', count: 70 },
      { word: 'Kubernetes', count: 60 },
      { word: 'GraphQL', count: 55 }
    ]
  };

  generate(data) {
    const { 
      textField, sizeField, maxWords = 100, fontFamily = 'Arial',
      minFontSize = 12, maxFontSize = 56, spiral = 'archimedean', rotations = true
    } = this.config;
    
    logger.debug('Generating wordcloud spec', {
      event: 'wordcloud_generate',
      textField,
      sizeField,
      maxWords
    });

    const colorScheme = this.config.colorScheme || this.colorConfig.scheme || 'category10';

    // Resolve field paths to actual data keys
    const resolvedTextField = this.resolveFieldPath(textField, data);
    const resolvedSizeField = sizeField ? this.resolveFieldPath(sizeField, data) : null;

    // Build aggregate transform based on whether sizeField exists
    const aggregateTransform = resolvedSizeField ? {
      type: 'aggregate',
      groupby: [resolvedTextField],
      ops: ['sum'],
      fields: [resolvedSizeField],
      as: ['count']
    } : {
      type: 'aggregate',
      groupby: [resolvedTextField],
      ops: ['count'],
      as: ['count']
    };

    return {
      ...this.getBaseSpec(),
      data: [
        {
          name: 'source',
          values: data || [],
          transform: [
            aggregateTransform,
            {
              type: 'window',
              sort: { field: 'count', order: 'descending' },
              ops: ['row_number'],
              as: ['rank']
            },
            {
              type: 'filter',
              expr: `datum.rank <= ${maxWords}`
            },
            {
              type: 'wordcloud',
              size: [{ signal: 'width' }, { signal: 'height' }],
              text: { field: resolvedTextField },
              fontSize: { field: 'count' },
              fontSizeRange: [minFontSize, maxFontSize],
              padding: 2,
              rotate: rotations ? { signal: '~~(random() * 3) * 30 - 30' } : { value: 0 },
              spiral: spiral
            }
          ]
        }
      ],
      scales: [
        {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'source', field: resolvedTextField },
          range: { scheme: colorScheme }
        }
      ],
      marks: [
        {
          type: 'text',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { field: 'x' },
              y: { field: 'y' },
              angle: { field: 'angle' },
              fontSize: { field: 'fontSize' },
              font: { value: fontFamily },
              text: { field: resolvedTextField },
              fill: { scale: 'color', field: resolvedTextField },
              align: { value: 'center' },
              baseline: { value: 'alphabetic' }
            },
            update: { fillOpacity: { value: 1 } },
            hover: { fillOpacity: { value: 0.7 } }
          }
        }
      ]
    };
  }

  /**
   * Generate Kibana-compatible Vega spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const { textField, sizeField, maxWords = 100, fontFamily = 'Arial', minFontSize = 12, maxFontSize = 56 } = this.config;

    // Use actual aggregation config structure (NEW PATTERN)
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || textField;
    const metric = metrics[0];
    const sizeBy = metric?.field || sizeField || '_count';

    const aggs = {
      primary: {
        terms: { field: bucketField, size: maxWords }
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

    const colorScheme = this.config.colorScheme || this.colorConfig?.scheme || 'category10';

    return {
      ...this.getKibanaBaseSpec(),
      data: [
        {
          name: 'source',
          url: urlConfig,
          format: { property: 'aggregations.primary.buckets' },
          transform: [
            { type: 'formula', expr: 'datum.key', as: textField },
            { type: 'formula', expr: 'datum.doc_count', as: 'size' },
            {
              type: 'wordcloud',
              size: [{ signal: 'width' }, { signal: 'height' }],
              text: { field: textField },
              fontSize: { field: 'size' },
              fontSizeRange: [minFontSize, maxFontSize],
              font: fontFamily,
              padding: 2
            }
          ]
        }
      ],
      scales: [
        {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'source', field: textField },
          range: { scheme: colorScheme }
        }
      ],
      marks: [
        {
          type: 'text',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { field: 'x' },
              y: { field: 'y' },
              angle: { field: 'angle' },
              fontSize: { field: 'fontSize' },
              font: { value: fontFamily },
              text: { field: textField },
              fill: { scale: 'color', field: textField },
              align: { value: 'center' },
              baseline: { value: 'alphabetic' }
            }
          }
        }
      ],
      description: 'Word Cloud with Elasticsearch data source'
    };
  }
}

export default WordcloudGenerator;

