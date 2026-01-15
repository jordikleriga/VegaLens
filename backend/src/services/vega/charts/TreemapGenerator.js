/**
 * Treemap Generator
 * Generates Vega specs for treemaps
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class TreemapGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'treemap',
    name: 'Treemap',
    description: 'Show hierarchical data as nested rectangles',
    category: 'hierarchy',
    icon: 'layout-grid'
  };

  static schema = {
    fields: [
      { name: 'categoryField', label: 'Category', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'parentField', label: 'Parent', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'aggregation', label: 'Aggregation', type: 'select', options: ['sum', 'count', 'avg', 'min', 'max'], default: 'sum' },
      { name: 'orderBy', label: 'Order By', type: 'select', options: ['_count', '_key', 'custom'], default: '_count', advanced: true },
      { name: 'orderDirection', label: 'Order Direction', type: 'select', options: ['desc', 'asc'], default: 'desc', advanced: true },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['nested'], default: 'nested', advanced: true, description: 'Automatically creates nested hierarchy from bucket levels' },
      { name: 'showLabels', label: 'Show Labels', type: 'boolean', default: true },
      { name: 'showValues', label: 'Show Values', type: 'boolean', default: true },
      { name: 'treemapLayout', label: 'Layout', type: 'select', options: ['squarify', 'binary', 'slice', 'dice', 'slicedice'], default: 'squarify' },
      { name: 'padding', label: 'Padding', type: 'number', min: 0, max: 10, default: 2 },
      { name: 'cornerRadius', label: 'Corner Radius', type: 'number', min: 0, max: 20, default: 3 },
      { name: 'labelFontSize', label: 'Label Font Size', type: 'number', min: 8, max: 20, default: 12 },
      { name: 'labelColor', label: 'Label Color', type: 'color', default: '#ffffff' }
    ]
  };

  static example = {
    config: {
      categoryField: 'name',
      valueField: 'value',
      title: 'Storage Usage',
      showLabels: true
    },
    data: [
      { name: 'Documents', value: 2500 },
      { name: 'Photos', value: 4200 },
      { name: 'Videos', value: 8100 },
      { name: 'Music', value: 1800 },
      { name: 'Apps', value: 3200 },
      { name: 'Other', value: 900 }
    ]
  };

  generate(data) {
    const { 
      categoryField, valueField, parentField, showLabels = true, showValues = true,
      treemapLayout = 'squarify', padding = 2, cornerRadius = 3,
      labelFontSize = 12, labelColor = '#ffffff'
    } = this.config;
    
    logger.debug('Generating treemap spec', {
      event: 'treemap_generate',
      categoryField,
      valueField,
      parentField
    });

    // Resolve field paths to actual data keys
    const resolvedCategoryField = this.resolveFieldPath(categoryField, data);
    const resolvedValueField = this.resolveFieldPath(valueField, data);
    const resolvedParentField = parentField ? this.resolveFieldPath(parentField, data) : null;

    // Check if we have a proper hierarchy
    const hasParentField = resolvedParentField && (data || []).some(d => d[resolvedParentField] != null);
    
    // Build the data with proper hierarchy structure
    const hierarchyData = hasParentField ? data : [
      { id: 'root', [resolvedValueField]: 0 },
      ...(data || []).map(d => ({
        ...d,
        id: d[resolvedCategoryField],
        parent: 'root'
      }))
    ];

    const colorScheme = this.config.colorScheme || this.colorConfig.scheme || 'category10';

    return {
      ...this.getBaseSpec(),
      data: [
        {
          name: 'source',
          values: hierarchyData,
          transform: [
            {
              type: 'stratify',
              key: hasParentField ? resolvedCategoryField : 'id',
              parentKey: hasParentField ? resolvedParentField : 'parent'
            },
            {
              type: 'treemap',
              field: resolvedValueField,
              method: treemapLayout,
              size: [{ signal: 'width' }, { signal: 'height' }],
              round: true,
              paddingInner: padding,
              paddingOuter: 1
            },
            {
              type: 'filter',
              expr: 'datum.depth > 0'
            }
          ]
        }
      ],
      scales: [
        {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'source', field: resolvedCategoryField },
          range: { scheme: colorScheme }
        }
      ],
      marks: [
        {
          type: 'rect',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { field: 'x0' },
              x2: { field: 'x1' },
              y: { field: 'y0' },
              y2: { field: 'y1' },
              fill: { scale: 'color', field: resolvedCategoryField },
              stroke: { value: '#1e293b' },
              strokeWidth: { value: 1 },
              cornerRadius: { value: cornerRadius }
            },
            update: { fillOpacity: { value: 0.9 } },
            hover: { fillOpacity: { value: 1 } }
          }
        },
        // Category labels with accessibility-compliant styling
        ...(showLabels ? [{
          type: 'text',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { signal: '(datum.x0 + datum.x1) / 2' },
              y: { signal: `(datum.y0 + datum.y1) / 2${showValues ? ' - 6' : ''}` },
              text: { field: resolvedCategoryField },
              align: { value: 'center' },
              baseline: { value: 'middle' },
              fontSize: { value: Math.max(labelFontSize, 13) },
              fontWeight: { value: 700 },
              fill: { value: '#ffffff' },
              stroke: { value: '#1e293b' },
              strokeWidth: { value: 0.5 }
            }
          }
        }] : []),
        // Value labels with accessibility-compliant styling
        ...(showValues ? [{
          type: 'text',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { signal: '(datum.x0 + datum.x1) / 2' },
              y: { signal: '(datum.y0 + datum.y1) / 2 + 10' },
              text: { signal: `format(datum['${resolvedValueField}'], ',.0f')` },
              align: { value: 'center' },
              baseline: { value: 'middle' },
              fontSize: { value: 12 },
              fontWeight: { value: 600 },
              fill: { value: '#ffffff' },
              stroke: { value: '#1e293b' },
              strokeWidth: { value: 0.4 }
            }
          }
        }] : [])
      ]
    };
  }

  /**
   * Generate Kibana-compatible Vega spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      categoryField, valueField, showLabels = true, showValues = true,
      treemapLayout = 'squarify', padding = 2, cornerRadius = 3,
      labelFontSize = 12, labelColor = '#ffffff'
    } = this.config;

    // Use actual aggregation config structure (NEW PATTERN)
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || categoryField;
    const metric = metrics[0];
    const metricField = metric?.field || valueField;
    const metricType = metric?.type; // Don't default - leave undefined if no metric

    // Get consistent style configuration
    const styleConfig = this.getKibanaStyleConfig();
    const strokeProps = this.getKibanaStrokeProps();

    const aggs = {
      primary: {
        terms: { field: bucketField, size: 50 },
        aggs: (metrics.length > 0 && metricType && metricType !== 'count') ? {
          metric_0: { [metricType]: { field: metricField } }
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

    // Build marks array with conditional labels and consistent styling
    const marks = [
      {
        type: 'rect',
        from: { data: 'source' },
        encode: {
          enter: {
            x: { field: 'x0' },
            x2: { field: 'x1' },
            y: { field: 'y0' },
            y2: { field: 'y1' },
            fill: { scale: 'color', field: 'category' },
            ...strokeProps,
            cornerRadius: { value: styleConfig.cornerRadius }
          },
          update: { fillOpacity: { value: styleConfig.opacity } },
          hover: { fillOpacity: { value: Math.min(1, styleConfig.opacity + 0.1) } }
        }
      }
    ];

    // Category labels with accessibility styling
    if (showLabels) {
      marks.push({
        type: 'text',
        from: { data: 'source' },
        encode: {
          enter: {
            x: { signal: '(datum.x0 + datum.x1) / 2' },
            y: { signal: `(datum.y0 + datum.y1) / 2${showValues ? ' - 6' : ''}` },
            text: { field: 'category' },
            align: { value: 'center' },
            baseline: { value: 'middle' },
            fontSize: { value: Math.max(labelFontSize, 13) },
            fontWeight: { value: 700 },
            fill: { value: '#ffffff' },
            stroke: { value: '#1e293b' },
            strokeWidth: { value: 0.5 }
          }
        }
      });
    }

    // Value labels with accessibility styling
    if (showValues) {
      marks.push({
        type: 'text',
        from: { data: 'source' },
        encode: {
          enter: {
            x: { signal: '(datum.x0 + datum.x1) / 2' },
            y: { signal: '(datum.y0 + datum.y1) / 2 + 10' },
            text: { signal: "format(datum.value, ',.0f')" },
            align: { value: 'center' },
            baseline: { value: 'middle' },
            fontSize: { value: 12 },
            fontWeight: { value: 600 },
            fill: { value: '#ffffff' },
            stroke: { value: '#1e293b' },
            strokeWidth: { value: 0.4 }
          }
        }
      });
    }

    return {
      ...this.getKibanaBaseSpec(),
      data: [
        {
          name: 'source',
          url: urlConfig,
          format: { property: 'aggregations.primary.buckets' },
          transform: [
            { type: 'formula', expr: 'datum.key', as: 'category' },
            { type: 'formula', expr: 'datum.metric_0 ? datum.metric_0.value : datum.doc_count', as: 'value' },
            {
              type: 'treemap',
              field: 'value',
              method: treemapLayout,
              padding: padding,
              size: [{ signal: 'width' }, { signal: 'height' }]
            }
          ]
        }
      ],
      scales: [
        {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'source', field: 'category' },
          range: { scheme: styleConfig.colorScheme }
        }
      ],
      marks
    };
  }
}

export default TreemapGenerator;

