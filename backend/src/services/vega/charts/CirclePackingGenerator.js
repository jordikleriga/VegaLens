/**
 * Circle Packing Generator
 * Generates Vega specs for circle packing visualizations
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class CirclePackingGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'circle_packing',
    name: 'Circle Packing',
    description: 'Show hierarchical data as nested circles',
    category: 'hierarchy',
    icon: 'circle'
  };

  static schema = {
    fields: [
      { name: 'categoryField', label: 'Category', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'parentField', label: 'Parent/Group', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['nested'], default: 'nested', advanced: true, description: 'Auto-creates nested circles from bucket hierarchy' },
      { name: 'showLabels', label: 'Show Labels', type: 'boolean', default: true },
      { name: 'showLegend', label: 'Show Legend', type: 'boolean', default: true },
      { name: 'padding', label: 'Circle Padding', type: 'number', min: 0, max: 20, default: 2 }
    ]
  };

  static example = {
    config: {
      categoryField: 'name',
      valueField: 'value',
      parentField: 'group',
      title: 'Team Capacity'
    },
    data: [
      { name: 'Alice', value: 35, group: 'Frontend' },
      { name: 'Bob', value: 28, group: 'Frontend' },
      { name: 'Carol', value: 42, group: 'Backend' },
      { name: 'David', value: 38, group: 'Backend' },
      { name: 'Eve', value: 25, group: 'Design' }
    ]
  };

  generate(data) {
    const { 
      categoryField, valueField, parentField,
      showLabels = true, showLegend = true, padding = 2
    } = this.config;
    
    logger.debug('Generating circle packing spec', {
      event: 'circle_packing_generate',
      categoryField,
      valueField,
      parentField
    });

    // Resolve field paths
    const resolvedCategoryField = this.resolveFieldPath(categoryField, data);
    const resolvedValueField = this.resolveFieldPath(valueField, data);
    const resolvedParentField = parentField ? this.resolveFieldPath(parentField, data) : null;

    const colorScheme = this.config.colorScheme || this.colorConfig.scheme || 'category10';
    const records = [...(data || [])];

    // Build hierarchical data structure
    let hierarchyData = [];
    
    if (resolvedParentField) {
      // Get unique parents
      const parents = [...new Set(records.map(d => d[resolvedParentField]).filter(Boolean))];
      
      // Add root node
      hierarchyData.push({ id: 'root', parent: null, name: 'All', size: 0 });
      
      // Add parent nodes
      parents.forEach(p => {
        hierarchyData.push({ 
          id: `parent_${p}`, 
          parent: 'root', 
          name: String(p), 
          size: 0,
          isParent: true
        });
      });
      
      // Add leaf nodes
      records.forEach((d, i) => {
        const parentId = d[resolvedParentField] ? `parent_${d[resolvedParentField]}` : 'root';
        hierarchyData.push({
          id: `leaf_${i}`,
          parent: parentId,
          name: String(d[resolvedCategoryField] || `Item ${i}`),
          size: d[resolvedValueField] || 1,
          isParent: false
        });
      });
    } else {
      // Simple flat hierarchy: root -> all items
      hierarchyData.push({ id: 'root', parent: null, name: 'All', size: 0 });
      
      records.forEach((d, i) => {
        hierarchyData.push({
          id: `leaf_${i}`,
          parent: 'root',
          name: String(d[resolvedCategoryField] || `Item ${i}`),
          size: d[resolvedValueField] || 1,
          isParent: false
        });
      });
    }

    return {
      ...this.getBaseSpec(),
      autosize: 'none',
      data: [
        {
          name: 'tree',
          values: hierarchyData,
          transform: [
            {
              type: 'stratify',
              key: 'id',
              parentKey: 'parent'
            },
            {
              type: 'pack',
              field: 'size',
              sort: { field: 'size' },
              size: [{ signal: 'width' }, { signal: 'height' }],
              padding: padding
            }
          ]
        },
        {
          name: 'leaves',
          source: 'tree',
          transform: [
            { type: 'filter', expr: '!datum.children' }
          ]
        },
        {
          name: 'parents',
          source: 'tree',
          transform: [
            { type: 'filter', expr: 'datum.children && datum.depth > 0' }
          ]
        }
      ],
      scales: [
        {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'tree', field: 'name' },
          range: { scheme: colorScheme }
        }
      ],
      marks: [
        // Parent circles (outer containers)
        {
          type: 'symbol',
          from: { data: 'parents' },
          encode: {
            enter: {
              shape: { value: 'circle' },
              fill: { scale: 'color', field: 'name' },
              fillOpacity: { value: 0.15 },
              stroke: { scale: 'color', field: 'name' },
              strokeWidth: { value: 2 },
              strokeOpacity: { value: 0.6 }
            },
            update: {
              x: { field: 'x' },
              y: { field: 'y' },
              size: { signal: '4 * datum.r * datum.r' }
            }
          }
        },
        // Leaf circles (inner items)
        {
          type: 'symbol',
          from: { data: 'leaves' },
          encode: {
            enter: {
              shape: { value: 'circle' },
              fill: { scale: 'color', field: 'parent.name' },
              fillOpacity: { value: this.getOpacity() || 0.85 },
              stroke: { value: 'white' },
              strokeWidth: { value: 1.5 }
            },
            update: {
              x: { field: 'x' },
              y: { field: 'y' },
              size: { signal: '4 * datum.r * datum.r' }
            },
            hover: {
              fillOpacity: { value: 1 }
            }
          }
        },
        // Labels for leaf nodes with accessibility styling
        ...(showLabels ? [{
          type: 'text',
          from: { data: 'leaves' },
          encode: {
            enter: {
              fill: { value: '#ffffff' },
              fontSize: { value: 12 },
              fontWeight: { value: 700 },
              align: { value: 'center' },
              baseline: { value: 'middle' },
              stroke: { value: '#1e293b' },
              strokeWidth: { value: 0.5 }
            },
            update: {
              x: { field: 'x' },
              y: { field: 'y' },
              text: { signal: 'datum.r > 20 ? datum.name : ""' },
              opacity: { signal: 'datum.r > 15 ? 1 : 0' }
            }
          }
        }] : []),
        // Labels for parent nodes with accessibility styling
        ...(showLabels && resolvedParentField ? [{
          type: 'text',
          from: { data: 'parents' },
          encode: {
            enter: {
              fill: { value: '#ffffff' },
              fontSize: { value: 13 },
              fontWeight: { value: 600 },
              align: { value: 'center' },
              baseline: { value: 'top' },
              stroke: { value: '#000000' },
              strokeWidth: { value: 0.3 }
            },
            update: {
              x: { field: 'x' },
              y: { signal: 'datum.y - datum.r + 5' },
              text: { field: 'name' },
              opacity: { signal: 'datum.r > 40 ? 1 : 0' }
            }
          }
        }] : [])
      ],
      ...(showLegend && resolvedParentField ? {
        legends: [{
          fill: 'color',
          title: this.getLegendLabel(parentField) || 'Group',
          orient: 'right'
        }]
      } : {})
    };
  }

  /**
   * Generate Kibana-compatible Vega spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const { categoryField, valueField, parentField } = this.config;

    // Use actual aggregation config structure
    const bucketAggs = aggregation?.bucketAggs || (aggregation?.bucketAgg ? [aggregation.bucketAgg] : []);
    const metrics = aggregation?.metrics || [];

    // Check if we have multi-level buckets (parent + child hierarchy)
    const hasMultiLevel = bucketAggs.length > 1;
    const primaryBucket = bucketAggs[0];
    const secondaryBucket = bucketAggs[1];

    const metric = metrics[0];
    const metricField = metric?.field || valueField;
    const metricType = metric?.type; // Don't default - leave undefined if no metric

    let aggs;

    if (hasMultiLevel) {
      // Multi-level: parent (outer circle) -> children (inner circles)
      aggs = {
        parent: {
          terms: {
            field: primaryBucket?.field || parentField,
            size: primaryBucket?.options?.size || 20
          },
          aggs: {
            children: {
              terms: {
                field: secondaryBucket?.field || categoryField,
                size: secondaryBucket?.options?.size || 50
              },
              aggs: (metrics.length > 0 && metricType && metricType !== 'count' && metricField) ? {
                metric_0: { [metricType]: { field: metricField } }
              } : {}
            }
          }
        }
      };
    } else {
      // Single level: flat structure
      aggs = {
        primary: {
          terms: {
            field: primaryBucket?.field || categoryField,
            size: primaryBucket?.options?.size || 50,
            ...(primaryBucket?.options?.orderBy && { order: { [primaryBucket.options.orderBy]: primaryBucket.options.orderDirection || 'desc' } })
          },
          aggs: (metrics.length > 0 && metricType && metricType !== 'count' && metricField) ? {
            metric_0: { [metricType]: { field: metricField } }
          } : {}
        }
      };
    }

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

    const { showLabels = true, showLegend = true, padding = 2 } = this.config;

    // Get consistent style configuration
    const styleConfig = this.getKibanaStyleConfig();

    // Build marks array based on hierarchy level
    const marks = hasMultiLevel ? [
      // Parent circles (outer containers) for multi-level
      {
        type: 'symbol',
        from: { data: 'parents' },
        encode: {
          enter: {
            shape: { value: 'circle' },
            fill: { scale: 'color', field: 'name' },
            fillOpacity: { value: 0.15 },
            stroke: { scale: 'color', field: 'name' },
            strokeWidth: { value: 2 },
            strokeOpacity: { value: 0.6 }
          },
          update: {
            x: { field: 'x' },
            y: { field: 'y' },
            size: { signal: '4 * datum.r * datum.r' }
          }
        }
      },
      // Leaf circles (inner items)
      {
        type: 'symbol',
        from: { data: 'leaves' },
        encode: {
          enter: {
            shape: { value: 'circle' },
            fill: { scale: 'color', field: 'parent.name' },
            fillOpacity: { value: styleConfig.opacity },
            stroke: { value: 'white' },
            strokeWidth: { value: 1.5 }
          },
          update: {
            x: { field: 'x' },
            y: { field: 'y' },
            size: { signal: '4 * datum.r * datum.r' }
          },
          hover: {
            fillOpacity: { value: 1 }
          }
        }
      }
    ] : [
      // Single-level circles
      {
        type: 'symbol',
        from: { data: 'source' },
        encode: {
          enter: {
            shape: { value: 'circle' },
            fill: { scale: 'color', field: 'name' },
            fillOpacity: { value: styleConfig.opacity },
            stroke: { value: styleConfig.strokeColor },
            strokeWidth: { value: styleConfig.strokeWidth }
          },
          update: {
            x: { field: 'x' },
            y: { field: 'y' },
            size: { signal: '4 * datum.r * datum.r' }
          },
          hover: { fillOpacity: { value: Math.min(1, styleConfig.opacity + 0.15) } }
        }
      }
    ];

    // Labels with accessibility styling (Kibana)
    if (showLabels) {
      if (hasMultiLevel) {
        // Leaf labels
        marks.push({
          type: 'text',
          from: { data: 'leaves' },
          encode: {
            enter: {
              fill: { value: '#ffffff' },
              fontSize: { value: 12 },
              fontWeight: { value: 700 },
              align: { value: 'center' },
              baseline: { value: 'middle' },
              stroke: { value: '#1e293b' },
              strokeWidth: { value: 0.5 }
            },
            update: {
              x: { field: 'x' },
              y: { field: 'y' },
              text: { signal: 'datum.r > 20 ? datum.name : ""' },
              opacity: { signal: 'datum.r > 15 ? 1 : 0' }
            }
          }
        });
        // Parent labels
        marks.push({
          type: 'text',
          from: { data: 'parents' },
          encode: {
            enter: {
              fill: { value: '#ffffff' },
              fontSize: { value: 13 },
              fontWeight: { value: 600 },
              align: { value: 'center' },
              baseline: { value: 'top' },
              stroke: { value: '#000000' },
              strokeWidth: { value: 0.3 }
            },
            update: {
              x: { field: 'x' },
              y: { signal: 'datum.y - datum.r + 5' },
              text: { field: 'name' },
              opacity: { signal: 'datum.r > 40 ? 1 : 0' }
            }
          }
        });
      } else {
        // Single-level labels
        marks.push({
          type: 'text',
          from: { data: 'source' },
          encode: {
            enter: {
              fill: { value: '#ffffff' },
              fontSize: { value: 12 },
              fontWeight: { value: 700 },
              align: { value: 'center' },
              baseline: { value: 'middle' },
              stroke: { value: '#1e293b' },
              strokeWidth: { value: 0.5 }
            },
            update: {
              x: { field: 'x' },
              y: { field: 'y' },
              text: { signal: 'datum.r > 20 ? datum.name : ""' },
              opacity: { signal: 'datum.r > 15 ? 1 : 0' }
            }
          }
        });
      }
    }

    // Build data pipeline based on whether we have multi-level hierarchy
    const dataConfig = hasMultiLevel ? [
      // Multi-level hierarchy: transform nested buckets into flat parent-child structure
      {
        name: 'parentBuckets',
        url: urlConfig,
        format: { property: 'aggregations.parent.buckets' },
        transform: [
          { type: 'formula', expr: 'datum.key', as: 'name' },
          { type: 'formula', expr: '"parent_" + datum.key', as: 'id' },
          { type: 'formula', expr: '"root"', as: 'parent' },
          { type: 'formula', expr: '0', as: 'size' }
        ]
      },
      {
        name: 'childBuckets',
        url: urlConfig,
        format: { property: 'aggregations.parent.buckets' },
        transform: [
          { type: 'flatten', fields: ['children.buckets'], as: ['child'] },
          { type: 'formula', expr: 'datum.child.key', as: 'name' },
          { type: 'formula', expr: 'datum.child.metric_0 ? datum.child.metric_0.value : datum.child.doc_count', as: 'size' },
          { type: 'formula', expr: '"leaf_" + datum.key + "_" + datum.child.key', as: 'id' },
          { type: 'formula', expr: '"parent_" + datum.key', as: 'parent' }
        ]
      },
      {
        name: 'rootNode',
        values: [{ id: 'root', parent: null, name: 'All', size: 0 }]
      },
      {
        name: 'allNodes',
        source: ['rootNode', 'parentBuckets', 'childBuckets']
      },
      {
        name: 'tree',
        source: 'allNodes',
        transform: [
          {
            type: 'stratify',
            key: 'id',
            parentKey: 'parent'
          },
          {
            type: 'pack',
            field: 'size',
            padding: padding,
            size: [{ signal: 'width' }, { signal: 'height' }]
          }
        ]
      },
      {
        name: 'leaves',
        source: 'tree',
        transform: [
          { type: 'filter', expr: '!datum.children' }
        ]
      },
      {
        name: 'parents',
        source: 'tree',
        transform: [
          { type: 'filter', expr: 'datum.children && datum.depth > 0' }
        ]
      },
      {
        name: 'source',
        source: 'tree',
        transform: [
          { type: 'filter', expr: 'datum.depth > 0' }
        ]
      }
    ] : [
      // Single-level: flat structure with only leaf nodes
      {
        name: 'table',
        url: urlConfig,
        format: { property: 'aggregations.primary.buckets' },
        transform: [
          { type: 'formula', expr: 'datum.key', as: 'name' },
          { type: 'formula', expr: 'datum.metric_0 ? datum.metric_0.value : datum.doc_count', as: 'size' },
          { type: 'formula', expr: '"leaf_" + datum.key', as: 'id' },
          { type: 'formula', expr: '"root"', as: 'parent' }
        ]
      },
      {
        name: 'rootNode',
        values: [{ id: 'root', parent: null, name: 'All', size: 0 }]
      },
      {
        name: 'hierarchy',
        source: ['rootNode', 'table']
      },
      {
        name: 'tree',
        source: 'hierarchy',
        transform: [
          {
            type: 'stratify',
            key: 'id',
            parentKey: 'parent'
          },
          {
            type: 'pack',
            field: 'size',
            padding: padding,
            size: [{ signal: 'width' }, { signal: 'height' }]
          }
        ]
      },
      {
        name: 'source',
        source: 'tree',
        transform: [
          { type: 'filter', expr: '!datum.children' }
        ]
      }
    ];

    return {
      ...this.getKibanaBaseSpec(),
      data: dataConfig,
      scales: [
        {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'source', field: 'name' },
          range: { scheme: styleConfig.colorScheme }
        }
      ],
      marks,
      ...(showLegend ? {
        legends: [{
          fill: 'color',
          title: this.getLegendLabel(categoryField) || 'Category',
          orient: 'right'
        }]
      } : {})
    };
  }
}

export default CirclePackingGenerator;

