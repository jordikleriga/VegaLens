/**
 * Chord Diagram Generator
 * Generates Vega specs for chord diagrams showing relationships between entities
 * Visualizes flow or connections in a circular layout
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class ChordGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'chord',
    name: 'Chord Diagram',
    description: 'Show relationships and flow between entities in a circular layout',
    category: 'flow',
    icon: 'circle'
  };

  static schema = {
    fields: [
      { name: 'sourceField', label: 'Source', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'targetField', label: 'Target', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['multi_hop'], default: 'multi_hop', advanced: true, description: 'Third bucket becomes intermediate connection' },
      { name: 'padAngle', label: 'Arc Padding', type: 'number', min: 0, max: 0.2, step: 0.01, default: 0.05 },
      { name: 'innerRadius', label: 'Inner Radius Ratio', type: 'number', min: 0.5, max: 0.95, step: 0.05, default: 0.85 },
      { name: 'arcOpacity', label: 'Arc Opacity', type: 'number', min: 0.3, max: 1, step: 0.1, default: 0.8 },
      { name: 'chordOpacity', label: 'Chord Opacity', type: 'number', min: 0.2, max: 0.9, step: 0.1, default: 0.5 },
      { name: 'showLabels', label: 'Show Labels', type: 'boolean', default: true },
      { name: 'colorScheme', label: 'Color Scheme', type: 'select', options: ['category10', 'tableau10', 'set2', 'dark2', 'paired'], default: 'category10' }
    ]
  };

  static example = {
    config: {
      sourceField: 'from',
      targetField: 'to',
      valueField: 'value',
      title: 'Trade Flow Between Regions'
    },
    data: [
      { from: 'North America', to: 'Europe', value: 45 },
      { from: 'North America', to: 'Asia', value: 62 },
      { from: 'Europe', to: 'North America', value: 38 },
      { from: 'Europe', to: 'Asia', value: 55 },
      { from: 'Asia', to: 'North America', value: 78 },
      { from: 'Asia', to: 'Europe', value: 42 },
      { from: 'Europe', to: 'Africa', value: 25 },
      { from: 'Asia', to: 'Africa', value: 18 },
      { from: 'Africa', to: 'Europe', value: 12 }
    ]
  };

  generate(data) {
    const {
      sourceField,
      targetField,
      valueField,
      padAngle = 0.05,
      innerRadius = 0.85,
      arcOpacity = 0.8,
      chordOpacity = 0.5,
      showLabels = true,
      colorScheme = 'category10'
    } = this.config;

    logger.debug('Generating chord diagram spec', {
      event: 'chord_generate',
      sourceField,
      targetField,
      valueField
    });

    // Resolve field paths
    const srcField = this.resolveFieldPath(sourceField, data) || 'source';
    const tgtField = this.resolveFieldPath(targetField, data) || 'target';
    const valField = this.resolveFieldPath(valueField, data) || '_count';

    // Build matrix from data
    const nodes = new Set();
    (data || []).forEach(d => {
      nodes.add(d[srcField]);
      nodes.add(d[tgtField]);
    });
    const nodeList = Array.from(nodes);
    const nodeIndex = new Map(nodeList.map((n, i) => [n, i]));

    // Create matrix
    const n = nodeList.length;
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
    (data || []).forEach(d => {
      const si = nodeIndex.get(d[srcField]);
      const ti = nodeIndex.get(d[tgtField]);
      if (si !== undefined && ti !== undefined) {
        matrix[si][ti] = d[valField] || 0;
      }
    });

    // Flatten matrix for Vega
    const matrixData = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (matrix[i][j] > 0) {
          matrixData.push({
            source: i,
            target: j,
            value: matrix[i][j],
            sourceName: nodeList[i],
            targetName: nodeList[j]
          });
        }
      }
    }

    // Calculate arc data (sum of outgoing + incoming for each node)
    const arcData = nodeList.map((name, i) => {
      const outgoing = matrix[i].reduce((sum, v) => sum + v, 0);
      const incoming = matrix.reduce((sum, row) => sum + row[i], 0);
      return { index: i, name, value: outgoing + incoming, outgoing, incoming };
    });

    // Calculate angles for each arc
    const totalValue = arcData.reduce((sum, d) => sum + d.value, 0);
    const angleScale = (2 * Math.PI - padAngle * n) / (totalValue || 1);
    let currentAngle = 0;

    arcData.forEach(arc => {
      arc.startAngle = currentAngle;
      arc.endAngle = currentAngle + arc.value * angleScale;
      currentAngle = arc.endAngle + padAngle;
    });

    // Track the current angle position for each node (for sequential chord placement)
    const nodeAngleTrackers = arcData.map(arc => ({
      currentAngle: arc.startAngle,
      anglePerValue: (arc.endAngle - arc.startAngle) / (arc.value || 1)
    }));

    // Sort chords by source then target for consistent ordering
    matrixData.sort((a, b) => a.source - b.source || a.target - b.target);

    // Calculate chord angles (but NOT the pixel coordinates - those will be computed by Vega signals)
    const chordData = matrixData.map(d => {
      const sourceTracker = nodeAngleTrackers[d.source];
      const targetTracker = nodeAngleTrackers[d.target];
      
      // Calculate the angular size of this chord on each arc
      const sourceAngleSize = d.value * sourceTracker.anglePerValue;
      const targetAngleSize = d.value * targetTracker.anglePerValue;
      
      // Source ribbon position (sequential from current position)
      const sourceStartAngle = sourceTracker.currentAngle;
      const sourceEndAngle = sourceStartAngle + sourceAngleSize;
      sourceTracker.currentAngle = sourceEndAngle;
      
      // Target ribbon position (sequential from current position)
      const targetStartAngle = targetTracker.currentAngle;
      const targetEndAngle = targetStartAngle + targetAngleSize;
      targetTracker.currentAngle = targetEndAngle;
      
      // Store angle data - the actual path will be computed dynamically via Vega signals
      // Offset by -PI/2 to start from top (12 o'clock position)
      return {
        ...d,
        sa1: sourceStartAngle - Math.PI / 2,
        sa2: sourceEndAngle - Math.PI / 2,
        ta1: targetStartAngle - Math.PI / 2,
        ta2: targetEndAngle - Math.PI / 2
      };
    });

    const marks = [
      // Outer arcs
      {
        type: 'arc',
        from: { data: 'arcs' },
        encode: {
          enter: {
            x: { signal: 'width / 2' },
            y: { signal: 'height / 2' },
            startAngle: { field: 'startAngle' },
            endAngle: { field: 'endAngle' },
            innerRadius: { signal: `min(width, height) / 2 * ${innerRadius}` },
            outerRadius: { signal: 'min(width, height) / 2' },
            fill: { scale: 'color', field: 'name' },
            fillOpacity: { value: arcOpacity },
            stroke: { value: '#1e293b' },
            strokeWidth: { value: 1 }
          },
          update: {
            fillOpacity: { value: arcOpacity }
          },
          hover: {
            fillOpacity: { value: 1 }
          }
        }
      },
      // Chords (ribbons) - paths computed dynamically using signals for responsiveness
      {
        type: 'path',
        from: { data: 'chords' },
        encode: {
          enter: {
            fill: { scale: 'color', field: 'sourceName' },
            fillOpacity: { value: chordOpacity },
            stroke: { value: '#0f172a' },
            strokeWidth: { value: 0.5 }
          },
          update: {
            // Compute path dynamically based on current width/height
            path: {
              signal: `'M' + (width/2 + chordRadius * cos(datum.sa1)) + ',' + (height/2 + chordRadius * sin(datum.sa1)) + 'A' + chordRadius + ',' + chordRadius + ' 0 0,1 ' + (width/2 + chordRadius * cos(datum.sa2)) + ',' + (height/2 + chordRadius * sin(datum.sa2)) + 'Q' + (width/2) + ',' + (height/2) + ' ' + (width/2 + chordRadius * cos(datum.ta1)) + ',' + (height/2 + chordRadius * sin(datum.ta1)) + 'A' + chordRadius + ',' + chordRadius + ' 0 0,1 ' + (width/2 + chordRadius * cos(datum.ta2)) + ',' + (height/2 + chordRadius * sin(datum.ta2)) + 'Q' + (width/2) + ',' + (height/2) + ' ' + (width/2 + chordRadius * cos(datum.sa1)) + ',' + (height/2 + chordRadius * sin(datum.sa1)) + 'Z'`
            },
            fillOpacity: { value: chordOpacity }
          },
          hover: {
            fillOpacity: { value: 0.8 }
          }
        }
      }
    ];

    // Add labels with accessibility-compliant styling
    if (showLabels) {
      marks.push({
        type: 'text',
        from: { data: 'arcs' },
        encode: {
          enter: {
            x: { signal: `width/2 + (min(width, height)/2 + 12) * cos((datum.startAngle + datum.endAngle) / 2 - PI/2)` },
            y: { signal: `height/2 + (min(width, height)/2 + 12) * sin((datum.startAngle + datum.endAngle) / 2 - PI/2)` },
            text: { field: 'name' },
            align: { signal: `((datum.startAngle + datum.endAngle) / 2) > PI ? 'right' : 'left'` },
            baseline: { value: 'middle' },
            fill: { value: '#ffffff' },
            fontSize: { value: 13 },
            fontWeight: { value: 600 },
            stroke: { value: '#000000' },
            strokeWidth: { value: 0.3 }
          }
        }
      });
    }

    return {
      ...this.getBaseSpec(),
      // Signal for chord inner radius - computed dynamically for responsiveness
      signals: [
        {
          name: 'chordRadius',
          update: `min(width, height) / 2 * ${innerRadius} - 2`
        }
      ],
      data: [
        { name: 'arcs', values: arcData },
        { name: 'chords', values: chordData }
      ],
      scales: [
        {
          name: 'color',
          type: 'ordinal',
          domain: nodeList,
          range: { scheme: colorScheme }
        }
      ],
      legends: showLabels ? [] : [
        {
          fill: 'color',
          title: 'Entities',
          orient: 'right'
        }
      ],
      marks
    };
  }

  /**
   * Generate Kibana-compatible Vega spec with Elasticsearch data source
   * Uses a simplified arc-link visualization since full chord layout requires 
   * complex pre-computation that's unreliable in pure Vega transforms.
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const { 
      innerRadius = 0.85,
      showLabels = true
    } = this.config;
    
    // Get consistent style configuration
    const styleConfig = this.getKibanaStyleConfig();
    // Use config opacity or style default, with sensible chord-specific defaults
    const arcOpacity = this.config.arcOpacity ?? styleConfig.opacity;
    const chordOpacity = this.config.chordOpacity ?? (styleConfig.opacity * 0.5);

    // Extract ORIGINAL ES field names from elasticConfig
    // Support both multi_terms (bucketAggs array) and legacy single bucketAgg
    const { sourceField, targetField } = this.config;

    // For multi_terms aggregations, use bucketAggs array
    const bucketAggs = aggregation?.bucketAggs || [];
    const esSourceField = bucketAggs[0]?.field || aggregation?.bucketAgg?.field || sourceField;
    const esTargetField = bucketAggs[1]?.field || targetField;
    
    // Get the original metric field from elasticConfig.metrics (not the alias)
    const esMetricField = aggregation?.metrics?.[0]?.field;
    const metricType = aggregation?.metrics?.[0]?.type || 'sum';
    
    // Build multi-terms aggregation for source-target pairs using ORIGINAL ES field names
    const aggs = {
      connections: {
        multi_terms: {
          terms: [
            { field: esSourceField },
            { field: esTargetField }
          ],
          size: 100
        },
        // Include metric aggregation if we have a metric field and it's not just count
        ...(esMetricField && metricType !== 'count' ? {
          aggs: {
            metric_0: { [metricType]: { field: esMetricField } }
          }
        } : {})
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

    return {
      ...this.getKibanaBaseSpec(),
      description: 'Chord Diagram with Elasticsearch data source',
      
      signals: [
        { name: 'cx', update: 'width / 2' },
        { name: 'cy', update: 'height / 2' },
        { name: 'outerRadius', update: 'min(width, height) / 2 - 30' },
        { name: 'innerRadius', update: `outerRadius * ${innerRadius}` },
        { name: 'chordRadius', update: 'innerRadius - 2' }
      ],

      data: [
        // Raw connection data from Elasticsearch
        {
          name: 'connections',
          url: urlConfig,
          format: { property: 'aggregations.connections.buckets' },
          transform: [
            { type: 'formula', expr: 'datum.key[0]', as: 'source' },
            { type: 'formula', expr: 'datum.key[1]', as: 'target' },
            { type: 'formula', expr: 'datum.metric_0 ? datum.metric_0.value : datum.doc_count', as: 'value' }
          ]
        },
        // Get source nodes with totals
        {
          name: 'sourceAgg',
          source: 'connections',
          transform: [
            { type: 'aggregate', groupby: ['source'], ops: ['sum'], fields: ['value'], as: ['total'] },
            { type: 'formula', expr: 'datum.source', as: 'name' }
          ]
        },
        // Get target nodes with totals
        {
          name: 'targetAgg',
          source: 'connections',
          transform: [
            { type: 'aggregate', groupby: ['target'], ops: ['sum'], fields: ['value'], as: ['total'] },
            { type: 'formula', expr: 'datum.target', as: 'name' }
          ]
        },
        // Union source and target into single nodes list
        {
          name: 'allNodes',
          source: ['sourceAgg', 'targetAgg']
        },
        // Aggregate to get unique nodes
        {
          name: 'uniqueNodes',
          source: 'allNodes',
          transform: [
            { type: 'aggregate', groupby: ['name'], ops: ['sum'], fields: ['total'], as: ['total'] }
          ]
        },
        // Create nodes with pie angles (2*PI = 6.283185307179586)
        {
          name: 'nodes',
          source: 'uniqueNodes',
          transform: [
            { type: 'pie', field: 'total', startAngle: 0, endAngle: 6.283185307179586 }
          ]
        },
        // Create links with sequential positions along arcs
        {
          name: 'linksWithLookup',
          source: 'connections',
          transform: [
            // Get source node position and total
            { 
              type: 'lookup', 
              from: 'nodes', 
              key: 'name', 
              fields: ['source'], 
              values: ['startAngle', 'endAngle', 'total'],
              as: ['srcStart', 'srcEnd', 'srcTotal']
            },
            // Get target node position and total
            { 
              type: 'lookup', 
              from: 'nodes', 
              key: 'name', 
              fields: ['target'], 
              values: ['startAngle', 'endAngle', 'total'],
              as: ['tgtStart', 'tgtEnd', 'tgtTotal']
            },
            // Filter out failed lookups
            { type: 'filter', expr: 'datum.srcStart != null && datum.tgtStart != null' },
            // Calculate angle span per value unit for source and target arcs
            { type: 'formula', expr: '(datum.srcEnd - datum.srcStart) / datum.srcTotal', as: 'srcAnglePerValue' },
            { type: 'formula', expr: '(datum.tgtEnd - datum.tgtStart) / datum.tgtTotal', as: 'tgtAnglePerValue' }
          ]
        },
        // Calculate cumulative positions for source side
        {
          name: 'linksWithSrcPos',
          source: 'linksWithLookup',
          transform: [
            { type: 'window', groupby: ['source'], sort: { field: 'target' }, ops: ['sum'], fields: ['value'], as: ['srcCumSum'] },
            // srcCumSum is sum including current, so subtract current value to get start position
            { type: 'formula', expr: 'datum.srcStart + (datum.srcCumSum - datum.value) * datum.srcAnglePerValue', as: 'srcPosStart' },
            { type: 'formula', expr: 'datum.srcStart + datum.srcCumSum * datum.srcAnglePerValue', as: 'srcPosEnd' }
          ]
        },
        // Calculate cumulative positions for target side
        {
          name: 'links',
          source: 'linksWithSrcPos',
          transform: [
            { type: 'window', groupby: ['target'], sort: { field: 'source' }, ops: ['sum'], fields: ['value'], as: ['tgtCumSum'] },
            // tgtCumSum is sum including current, so subtract current value to get start position
            { type: 'formula', expr: 'datum.tgtStart + (datum.tgtCumSum - datum.value) * datum.tgtAnglePerValue', as: 'tgtPosStart' },
            { type: 'formula', expr: 'datum.tgtStart + datum.tgtCumSum * datum.tgtAnglePerValue', as: 'tgtPosEnd' },
            // Convert to math angles (offset by -PI/2 for 12 o'clock start)
            { type: 'formula', expr: 'datum.srcPosStart - PI/2', as: 'srcAngle1' },
            { type: 'formula', expr: 'datum.srcPosEnd - PI/2', as: 'srcAngle2' },
            { type: 'formula', expr: 'datum.tgtPosStart - PI/2', as: 'tgtAngle1' },
            { type: 'formula', expr: 'datum.tgtPosEnd - PI/2', as: 'tgtAngle2' }
          ]
        }
      ],

      scales: [
        {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'nodes', field: 'name' },
          range: { scheme: styleConfig.colorScheme }
        }
      ],

      marks: this._buildKibanaChordMarks(arcOpacity, chordOpacity, showLabels, styleConfig)
    };
  }
  /**
   * Build marks array for Kibana chord diagram with consistent styling
   */
  _buildKibanaChordMarks(arcOpacity, chordOpacity, showLabels, styleConfig) {
    const marks = [
      // Outer arcs for nodes with consistent styling
      {
        type: 'arc',
        from: { data: 'nodes' },
        encode: {
          enter: {
            x: { signal: 'cx' },
            y: { signal: 'cy' },
            startAngle: { field: 'startAngle' },
            endAngle: { field: 'endAngle' },
            innerRadius: { signal: 'innerRadius' },
            outerRadius: { signal: 'outerRadius' },
            fill: { scale: 'color', field: 'name' },
            fillOpacity: { value: arcOpacity },
            stroke: { value: styleConfig.strokeColor },
            strokeWidth: { value: styleConfig.strokeWidth },
            tooltip: { signal: "datum.name + ': ' + format(datum.total, ',')" }
          },
          update: { fillOpacity: { value: arcOpacity } },
          hover: { fillOpacity: { value: Math.min(1, arcOpacity + 0.2) } }
        }
      },
      // Chord ribbons between nodes (matching preview spec path structure exactly)
      {
        type: 'path',
        from: { data: 'links' },
        encode: {
          enter: {
            fill: { scale: 'color', field: 'source' },
            fillOpacity: { value: chordOpacity },
            stroke: { value: styleConfig.strokeColor },
            strokeWidth: { value: 0.5 },
            tooltip: { signal: "datum.source + ' → ' + datum.target + ': ' + format(datum.value, ',')" }
          },
          update: {
            // Path structure matches preview: M → A(source arc) → Q(to target) → A(target arc) → Q(back) → Z
            path: {
              signal: "'M' + (cx + chordRadius * cos(datum.srcAngle1)) + ',' + (cy + chordRadius * sin(datum.srcAngle1)) + 'A' + chordRadius + ',' + chordRadius + ' 0 0,1 ' + (cx + chordRadius * cos(datum.srcAngle2)) + ',' + (cy + chordRadius * sin(datum.srcAngle2)) + 'Q' + cx + ',' + cy + ' ' + (cx + chordRadius * cos(datum.tgtAngle1)) + ',' + (cy + chordRadius * sin(datum.tgtAngle1)) + 'A' + chordRadius + ',' + chordRadius + ' 0 0,1 ' + (cx + chordRadius * cos(datum.tgtAngle2)) + ',' + (cy + chordRadius * sin(datum.tgtAngle2)) + 'Q' + cx + ',' + cy + ' ' + (cx + chordRadius * cos(datum.srcAngle1)) + ',' + (cy + chordRadius * sin(datum.srcAngle1)) + 'Z'"
            }
          },
          hover: { fillOpacity: { value: Math.min(0.9, chordOpacity + 0.3) } }
        }
      }
    ];

    // Add labels if enabled - with accessibility-compliant styling
    if (showLabels) {
      marks.push({
        type: 'text',
        from: { data: 'nodes' },
        encode: {
          enter: {
            x: { signal: 'cx + (outerRadius + 10) * cos((datum.startAngle + datum.endAngle) / 2 - PI/2)' },
            y: { signal: 'cy + (outerRadius + 10) * sin((datum.startAngle + datum.endAngle) / 2 - PI/2)' },
            text: { field: 'name' },
            align: { signal: '((datum.startAngle + datum.endAngle) / 2) > PI ? "right" : "left"' },
            baseline: { value: 'middle' },
            fill: { value: '#ffffff' },
            fontSize: { value: 13 },
            fontWeight: { value: 600 },
            stroke: { value: '#000000' },
            strokeWidth: { value: 0.3 }
          }
        }
      });
    }

    return marks;
  }
}

export default ChordGenerator;

