/**
 * Pie Chart Generator
 * Generates Vega specs for pie charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class PieChartGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'pie',
    name: 'Pie Chart',
    description: 'Show proportions of a whole with circular slices',
    category: 'composition',
    icon: 'pie-chart'
  };

  static schema = {
    fields: [
      { name: 'categoryField', label: 'Category', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'showLabels', label: 'Show Labels', type: 'boolean', default: false },
      { name: 'showLegend', label: 'Show Legend', type: 'boolean', default: true },
      { name: 'aggregation', label: 'Aggregation', type: 'select', options: ['sum', 'count', 'avg', 'min', 'max'], default: 'sum' },
      { name: 'orderBy', label: 'Order By', type: 'select', options: ['_count', '_key', 'custom'], default: '_count', advanced: true },
      { name: 'orderDirection', label: 'Order Direction', type: 'select', options: ['desc', 'asc'], default: 'desc', advanced: true },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['sunburst', 'concentric'], default: 'sunburst', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'outerRadius', label: 'Outer Radius %', type: 'number', min: 50, max: 100, default: 80 },
      { name: 'padAngle', label: 'Pad Angle', type: 'number', min: 0, max: 0.1, step: 0.01, default: 0 },
      { name: 'cornerRadius', label: 'Corner Radius', type: 'number', min: 0, max: 20, default: 0 },
      { name: 'startAngle', label: 'Start Angle', type: 'number', min: 0, max: 360, default: 0 },
      { name: 'labelRadius', label: 'Label Radius %', type: 'number', min: 80, max: 150, default: 100 },
      { name: 'sortSlices', label: 'Sort Slices', type: 'select', options: ['none', 'ascending', 'descending'], default: 'none' }
    ]
  };

  static example = {
    config: {
      categoryField: 'category',
      valueField: 'value',
      title: 'Market Share',
      showLabels: true,
      showLegend: true
    },
    data: [
      { category: 'Product A', value: 35 },
      { category: 'Product B', value: 25 },
      { category: 'Product C', value: 20 },
      { category: 'Product D', value: 12 },
      { category: 'Other', value: 8 }
    ]
  };

  generate(data) {
    const { 
      categoryField, valueField, showLabels, showLegend, aggregation,
      outerRadius = 80, padAngle = 0, cornerRadius = 0,
      startAngle = 0, labelRadius = 100, sortSlices = 'none',
      multiLevelMode = 'sunburst'
    } = this.config;
    
    const radius = Math.min(this.config.width, this.config.height) / 2 * (outerRadius / 100);
    
    // Detect multi-level bucket data
    const hasMultiLevel = data?.[0]?.hasOwnProperty('_composite_key');
    const bucketFields = this.detectBucketFields(data);
    
    logger.debug('Generating pie chart spec', {
      event: 'pie_chart_generate',
      categoryField,
      valueField,
      showLabels,
      hasMultiLevel,
      multiLevelMode
    });

    // For multi-level data, generate appropriate visualization
    if (hasMultiLevel && bucketFields.length > 1) {
      if (multiLevelMode === 'sunburst') {
        return this.generateSunburstSpec(data, bucketFields);
      } else if (multiLevelMode === 'concentric') {
        const radius = Math.min(this.config.width, this.config.height) / 2 * (outerRadius / 100);
        return this.generateConcentricSpec(data, bucketFields, 0, radius);
      }
    }

    // Resolve field paths to actual data keys
    const resolvedCategoryField = this.resolveFieldPath(categoryField, data);
    const resolvedValueField = this.resolveFieldPath(valueField, data);

    // Check if data is already aggregated
    const categoryValues = (data || []).map(d => d[resolvedCategoryField]);
    const needsAggregation = categoryValues.length !== new Set(categoryValues).size;
    const valField = needsAggregation ? 'value' : resolvedValueField;

    // Build transforms based on whether aggregation is needed
    const transforms = [];
    const vegaAggOp = VegaGeneratorBase.getVegaAggregateOp(aggregation);
    
    if (needsAggregation) {
      transforms.push({
        type: 'aggregate',
        groupby: [resolvedCategoryField],
        ops: [vegaAggOp],
        fields: [resolvedValueField],
        as: ['value']
      });
    }
    
    transforms.push({
      type: 'pie',
      field: valField,
      startAngle: startAngle * (Math.PI / 180),
      ...(sortSlices === 'ascending' ? { sort: true } : 
          sortSlices === 'descending' ? { sort: { field: valField, order: 'descending' } } : {})
    });

    const strokeProps = this.getStrokeProps();

    return {
      ...this.getBaseSpec(),
      data: [
        {
          name: 'source',
          values: data || [],
          transform: transforms
        }
      ],
      scales: [
        this.getColorScale(resolvedCategoryField)
      ],
      ...(showLegend !== false ? {
        legends: [{ fill: 'color', title: this.getLegendLabel(categoryField), orient: 'right' }]
      } : {}),
      marks: [
        {
          type: 'arc',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { signal: 'width / 2' },
              y: { signal: 'height / 2' },
              startAngle: { field: 'startAngle' },
              endAngle: { field: 'endAngle' },
              padAngle: { value: padAngle },
              innerRadius: { value: 0 },
              outerRadius: { value: radius },
              cornerRadius: { value: cornerRadius },
              fill: { scale: 'color', field: resolvedCategoryField },
              ...strokeProps
            },
            update: { fillOpacity: { value: this.getOpacity() } },
            hover: { fillOpacity: { value: Math.max(0.5, this.getOpacity() - 0.2) } }
          }
        },
        // Labels with accessibility styling
        ...(showLabels ? [{
          type: 'text',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { signal: `width / 2 + ${radius * (labelRadius / 100)} * cos((datum.startAngle + datum.endAngle) / 2 - PI / 2)` },
              y: { signal: `height / 2 + ${radius * (labelRadius / 100)} * sin((datum.startAngle + datum.endAngle) / 2 - PI / 2)` },
              text: { field: resolvedCategoryField },
              align: { value: 'center' },
              baseline: { value: 'middle' },
              fontSize: { value: 13 },
              fontWeight: { value: 700 },
              fill: { value: '#ffffff' },
              stroke: { value: '#1e293b' },
              strokeWidth: { value: 0.5 }
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
      categoryField, valueField, showLabels = false, showLegend = true,
      outerRadius = 80, padAngle = 0, cornerRadius = 0, labelRadius = 100,
      startAngle = 0, sortSlices = 'none'
    } = this.config;

    // Get consistent style configuration
    const styleConfig = this.getKibanaStyleConfig();

    // Use actual aggregation config structure (NEW PATTERN)
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || categoryField;
    const metric = metrics[0];
    const metricField = metric?.field || valueField;
    const metricType = metric?.type; // Don't default - leave undefined if no metric

    const aggs = {
      primary: {
        terms: { field: bucketField, size: 20 },
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

    // Build Vega-Lite spec for Kibana
    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Pie Chart',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.primary.buckets' }
      },
      transform: [
        { calculate: 'datum.key', as: 'category' },
        { calculate: metricType !== 'count' ? 'datum.metric_0.value' : 'datum.doc_count', as: 'value' }
      ],
      mark: {
        type: 'arc',
        innerRadius: 0,
        outerRadius: outerRadius,
        padAngle: padAngle,
        cornerRadius: cornerRadius,
        tooltip: true
      },
      encoding: {
        theta: {
          field: 'value',
          type: 'quantitative',
          stack: { offset: 'normalize' },
          sort: sortSlices === 'ascending' ? 'ascending' : sortSlices === 'descending' ? 'descending' : null,
          scale: { range: [startAngle * Math.PI / 180, startAngle * Math.PI / 180 + 2 * Math.PI] }
        },
        color: {
          field: 'category',
          type: 'nominal',
          scale: { scheme: styleConfig.colorScheme },
          legend: showLegend ? { title: this.getLegendLabel(categoryField) } : null
        }
      }
    };

    // Add text labels layer if requested
    if (showLabels) {
      return {
        ...spec,
        layer: [
          {
            mark: spec.mark,
            encoding: spec.encoding
          },
          {
            mark: { type: 'text', radiusOffset: labelRadius - 100, fontSize: 13, fontWeight: 700 },
            encoding: {
              text: { field: 'category', type: 'nominal' },
              theta: spec.encoding.theta,
              color: spec.encoding.color
            }
          }
        ],
        encoding: undefined,
        mark: undefined
      };
    }

    return spec;
  }

  /**
   * Detect bucket fields from multi-level aggregated data
   */
  detectBucketFields(data) {
    if (!data || data.length === 0) return [];
    const sample = data[0];
    return Object.keys(sample).filter(k => 
      !['_count', '_composite_key', '_split_count'].includes(k) && 
      typeof sample[k] === 'string'
    );
  }

  /**
   * Generate sunburst spec for multi-level hierarchical data
   * Creates nested rings where each level of bucket becomes a ring
   */
  generateSunburstSpec(data, bucketFields) {
    const { outerRadius = 80, padAngle = 0, cornerRadius = 0, showLabels = false, showLegend = true } = this.config;
    const radius = Math.min(this.config.width, this.config.height) / 2 * (outerRadius / 100);
    
    // Build hierarchical data structure from flat multi-level data
    const hierarchy = this.buildHierarchy(data, bucketFields);
    
    return {
      ...this.getBaseSpec(),
      data: [
        {
          name: 'tree',
          values: hierarchy,
          transform: [
            {
              type: 'stratify',
              key: 'id',
              parentKey: 'parent'
            },
            {
              type: 'partition',
              field: 'value',
              sort: { field: 'value' },
              size: [{ signal: '2 * PI' }, { signal: `${radius}` }],
              as: ['a0', 'r0', 'a1', 'r1', 'depth', 'children']
            }
          ]
        }
      ],
      scales: [
        {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'tree', field: 'name' },
          range: { scheme: this.colorConfig.scheme || 'category10' }
        }
      ],
      marks: [
        {
          type: 'arc',
          from: { data: 'tree' },
          encode: {
            enter: {
              x: { signal: `${this.config.width / 2}` },
              y: { signal: `${this.config.height / 2}` },
              fill: { scale: 'color', field: 'name' },
              stroke: { value: '#ffffff' },
              strokeWidth: { value: 1 }
            },
            update: {
              startAngle: { field: 'a0' },
              endAngle: { field: 'a1' },
              innerRadius: { field: 'r0' },
              outerRadius: { field: 'r1' },
              padAngle: { value: padAngle },
              cornerRadius: { value: cornerRadius },
              tooltip: { signal: `datum.name + ': ' + datum.value` }
            }
          }
        },
        ...(showLabels ? [{
          type: 'text',
          from: { data: 'tree' },
          encode: {
            enter: {
              x: { signal: `${this.config.width / 2}` },
              y: { signal: `${this.config.height / 2}` },
              fill: { value: '#333' },
              fontSize: { value: 10 },
              align: { value: 'center' },
              baseline: { value: 'middle' }
            },
            update: {
              theta: { signal: '(datum.a0 + datum.a1) / 2' },
              radius: { signal: '(datum.r0 + datum.r1) / 2' },
              text: { signal: 'datum.depth > 0 && datum.r1 - datum.r0 > 20 ? datum.name : ""' }
            }
          }
        }] : [])
      ],
      ...(showLegend ? {
        legends: [{
          fill: 'color',
          title: 'Categories',
          orient: 'right',
          encode: {
            symbols: { update: { shape: { value: 'square' } } }
          }
        }]
      } : {})
    };
  }

  /**
   * Generate concentric rings for multi-level data
   * Each bucket level becomes a separate ring (like Donut)
   */
  generateConcentricSpec(data, bucketFields, innerRadius, outerRadius) {
    const { padAngle = 0, cornerRadius = 0, showLegend = true, showLabels = false } = this.config;
    
    // Calculate ring dimensions
    const numLevels = bucketFields.length;
    const ringWidth = (outerRadius - innerRadius) / numLevels;
    
    // Aggregate data by each level
    const levelData = bucketFields.map((field, idx) => {
      const aggregated = new Map();
      for (const row of data) {
        const key = row[field];
        aggregated.set(key, (aggregated.get(key) || 0) + (row._count || 1));
      }
      return Array.from(aggregated.entries()).map(([key, value]) => ({
        category: key,
        value,
        level: idx
      }));
    });

    // Create marks for each ring
    const marks = levelData.map((ringData, idx) => {
      const ringInner = innerRadius + idx * ringWidth;
      const ringOuter = innerRadius + (idx + 1) * ringWidth - 2;
      
      return {
        type: 'arc',
        from: { data: `level_${idx}` },
        encode: {
          enter: {
            x: { signal: `${this.config.width / 2}` },
            y: { signal: `${this.config.height / 2}` },
            fill: { scale: 'color', field: 'category' },
            stroke: { value: '#ffffff' },
            strokeWidth: { value: 1 }
          },
          update: {
            startAngle: { field: 'startAngle' },
            endAngle: { field: 'endAngle' },
            innerRadius: { value: ringInner },
            outerRadius: { value: ringOuter },
            padAngle: { value: padAngle },
            cornerRadius: { value: cornerRadius },
            tooltip: { signal: `datum.category + ': ' + datum.value` }
          }
        }
      };
    });

    // Create data sources for each level
    const dataSources = levelData.map((ringData, idx) => ({
      name: `level_${idx}`,
      values: ringData,
      transform: [
        { type: 'pie', field: 'value' }
      ]
    }));

    // Collect all unique categories for the color scale
    const allCategories = [...new Set(levelData.flat().map(d => d.category))];

    return {
      ...this.getBaseSpec(),
      data: dataSources,
      scales: [
        {
          name: 'color',
          type: 'ordinal',
          domain: allCategories,
          range: { scheme: this.colorConfig.scheme || 'category10' }
        }
      ],
      marks,
      ...(showLegend ? {
        legends: [{
          fill: 'color',
          title: 'Categories',
          orient: 'right'
        }]
      } : {})
    };
  }

  /**
   * Build hierarchical structure from flat multi-level bucket data
   */
  buildHierarchy(data, bucketFields) {
    const nodes = [{ id: 'root', name: 'Root', parent: null, value: 0 }];
    const nodeMap = new Map([['root', nodes[0]]]);
    
    for (const row of data) {
      let parentId = 'root';
      let currentPath = '';
      
      for (let i = 0; i < bucketFields.length; i++) {
        const field = bucketFields[i];
        const value = row[field];
        currentPath = currentPath ? `${currentPath}/${value}` : value;
        
        if (!nodeMap.has(currentPath)) {
          const node = {
            id: currentPath,
            name: value,
            parent: parentId,
            value: 0
          };
          nodes.push(node);
          nodeMap.set(currentPath, node);
        }
        
        parentId = currentPath;
      }
      
      // Add the value to the leaf node
      const leafNode = nodeMap.get(currentPath);
      if (leafNode) {
        leafNode.value += row._count || row.value || 1;
      }
    }
    
    // Calculate parent values (sum of children)
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.parent) {
        const parent = nodeMap.get(node.parent);
        if (parent && node.value > 0) {
          // Parent value is max of sum of children or its own value
          parent.value = Math.max(parent.value, 0);
        }
      }
    }
    
    return nodes;
  }
}

export default PieChartGenerator;

