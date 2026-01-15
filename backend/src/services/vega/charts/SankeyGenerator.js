/**
 * Sankey Diagram Generator
 * Generates Vega specs for sankey flow diagrams
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class SankeyGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'sankey',
    name: 'Sankey Diagram',
    description: 'Show flow quantities between nodes',
    category: 'flow',
    icon: 'arrow-right-left',
    helpLink: 'docs/how-to/kibana-quirks.md#leave-site-popup-on-complex-visualizations',
    helpText: 'Kibana may show a "Leave site?" popup when rendering. Click Cancel to continue.'
  };

  static schema = {
    fields: [
      { name: 'sourceField', label: 'Source (Stage 1)', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'targetField', label: 'Target (Stage 2)', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'stage3Field', label: 'Stage 3 (Optional)', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'stage4Field', label: 'Stage 4 (Optional)', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'nodeWidth', label: 'Node Width', type: 'number', min: 10, max: 50, default: 20 },
      { name: 'nodePadding', label: 'Node Padding', type: 'number', min: 0, max: 30, default: 8 },
      { name: 'nodeCornerRadius', label: 'Node Corner Radius', type: 'number', min: 0, max: 10, default: 3 },
      { name: 'linkColorMode', label: 'Link Color', type: 'select', options: ['fixed', 'source', 'target'], default: 'fixed' },
      { name: 'linkOpacity', label: 'Link Opacity', type: 'number', min: 0.1, max: 1, step: 0.1, default: 0.4 },
      { name: 'showLabels', label: 'Show Labels', type: 'boolean', default: true },
      { name: 'showValues', label: 'Show Values', type: 'boolean', default: false }
    ]
  };

  static example = {
    config: {
      sourceField: 'source',
      targetField: 'target',
      valueField: 'value',
      title: 'Energy Flow'
    },
    data: [
      { source: 'Coal', target: 'Electricity', value: 100 },
      { source: 'Gas', target: 'Electricity', value: 80 },
      { source: 'Nuclear', target: 'Electricity', value: 60 },
      { source: 'Electricity', target: 'Residential', value: 120 },
      { source: 'Electricity', target: 'Industrial', value: 90 },
      { source: 'Electricity', target: 'Commercial', value: 30 }
    ]
  };

  generate(data) {
    const {
      sourceField, targetField, stage3Field, stage4Field, valueField,
      nodeWidth = 20, nodePadding = 8, nodeCornerRadius = 3,
      linkColorMode = 'fixed', linkOpacity = 0.4,
      showLabels = true, showValues = true
    } = this.config;

    // Build list of stages (fields that define the flow path)
    const stageFields = [sourceField, targetField, stage3Field, stage4Field].filter(Boolean);
    const numStages = stageFields.length;

    logger.debug('Generating sankey diagram spec', {
      event: 'sankey_generate',
      stageFields,
      numStages,
      valueField
    });

    const colorScheme = this.config.colorScheme || this.colorConfig.scheme || 'category10';
    const valField = valueField || '_count';

    // For multi-stage Sankey, we need to:
    // 1. Create nodes for each unique value at each stage
    // 2. Create links between consecutive stages

    // Collect nodes per stage with their total values
    const stageNodes = stageFields.map(() => new Map());

    // For each data row, accumulate values at each stage
    (data || []).forEach(d => {
      const val = d[valField] || 0;
      stageFields.forEach((field, stageIdx) => {
        const nodeName = d[field];
        if (nodeName !== undefined && nodeName !== null) {
          const nodeMap = stageNodes[stageIdx];
          nodeMap.set(nodeName, (nodeMap.get(nodeName) || 0) + val);
        }
      });
    });

    // Calculate max total across all stages for consistent scaling
    const stageTotals = stageNodes.map(nodeMap =>
      Array.from(nodeMap.values()).reduce((a, b) => a + b, 0)
    );
    const maxTotal = Math.max(...stageTotals, 1);

    // Build node lists for each stage with y positions
    const allNodes = [];
    const nodeMaps = [];
    let maxYHeight = 0;

    stageFields.forEach((field, stageIdx) => {
      const nodeMap = stageNodes[stageIdx];
      const sortedEntries = Array.from(nodeMap.entries()).sort((a, b) =>
        String(a[0]).localeCompare(String(b[0]))
      );

      let yPos = 0;
      const nodeList = sortedEntries.map(([name, value], idx) => {
        const node = {
          name,
          value,
          y0: yPos,
          y1: yPos + value,
          stack: stageIdx,
          index: idx
        };
        yPos += value + (idx < sortedEntries.length - 1 ? nodePadding : 0);
        return node;
      });

      maxYHeight = Math.max(maxYHeight, yPos);
      allNodes.push(...nodeList);
      nodeMaps.push(new Map(nodeList.map(n => [n.name, n])));
    });

    // Build links between consecutive stages
    const allLinks = [];

    for (let linkStage = 0; linkStage < numStages - 1; linkStage++) {
      const srcField = stageFields[linkStage];
      const tgtField = stageFields[linkStage + 1];
      const sourceNodeMap = nodeMaps[linkStage];
      const targetNodeMap = nodeMaps[linkStage + 1];

      // Aggregate values for each source-target pair at this link stage
      const linkValues = new Map();
      (data || []).forEach(d => {
        const src = d[srcField];
        const tgt = d[tgtField];
        const val = d[valField] || 0;
        if (src !== undefined && tgt !== undefined) {
          const key = `${src}|||${tgt}`;
          linkValues.set(key, (linkValues.get(key) || 0) + val);
        }
      });

      // Track cumulative positions for stacking within nodes
      const sourceCumulative = new Map();
      const targetCumulative = new Map();

      // Sort links for consistent ordering
      const sortedLinkEntries = Array.from(linkValues.entries()).sort((a, b) => {
        const [srcA, tgtA] = a[0].split('|||');
        const [srcB, tgtB] = b[0].split('|||');
        const srcCompare = String(srcA).localeCompare(String(srcB));
        if (srcCompare !== 0) return srcCompare;
        return String(tgtA).localeCompare(String(tgtB));
      });

      // First pass: calculate source positions
      const linksWithSourcePos = sortedLinkEntries.map(([key, val]) => {
        const [srcName, tgtName] = key.split('|||');
        const srcNode = sourceNodeMap.get(srcName);

        if (!srcNode) return null;

        const linkHeight = (srcNode.y1 - srcNode.y0) * (val / srcNode.value);
        const cumPos = sourceCumulative.get(srcName) || 0;
        const sourceY = srcNode.y0 + cumPos + linkHeight / 2;
        sourceCumulative.set(srcName, cumPos + linkHeight);

        return {
          source: srcName,
          target: tgtName,
          value: val,
          sourceY,
          linkHeight,
          sourceStack: linkStage,
          targetStack: linkStage + 1
        };
      }).filter(Boolean);

      // Sort by target for target stacking
      linksWithSourcePos.sort((a, b) => {
        const tgtCompare = String(a.target).localeCompare(String(b.target));
        if (tgtCompare !== 0) return tgtCompare;
        return String(a.source).localeCompare(String(b.source));
      });

      // Second pass: calculate target positions
      const stageLinks = linksWithSourcePos.map(link => {
        const tgtNode = targetNodeMap.get(link.target);

        if (!tgtNode) return { ...link, targetY: 0 };

        const tgtLinkHeight = (tgtNode.y1 - tgtNode.y0) * (link.value / tgtNode.value);
        const cumPos = targetCumulative.get(link.target) || 0;
        const targetY = tgtNode.y0 + cumPos + tgtLinkHeight / 2;
        targetCumulative.set(link.target, cumPos + tgtLinkHeight);

        return { ...link, targetY };
      });

      allLinks.push(...stageLinks);
    }

    const effectiveMax = maxYHeight || 1;

    // Build link stroke encoding based on color mode
    let linkStrokeEncode;
    if (linkColorMode === 'source') {
      linkStrokeEncode = { scale: 'color', field: 'source' };
    } else if (linkColorMode === 'target') {
      linkStrokeEncode = { scale: 'color', field: 'target' };
    } else {
      linkStrokeEncode = { value: '#666666' };
    }

    const marks = [
      // Link paths (bezier curves between consecutive stages)
      {
        type: 'path',
        from: { data: 'links' },
        encode: {
          enter: {
            path: {
              // Bezier curve from sourceStack to targetStack positions
              signal: `'M' + scale('x', datum.sourceStack) + ',' + scale('y', datum.sourceY) + ' C' + (scale('x', datum.sourceStack) + scale('x', datum.targetStack)) / 2 + ',' + scale('y', datum.sourceY) + ' ' + (scale('x', datum.sourceStack) + scale('x', datum.targetStack)) / 2 + ',' + scale('y', datum.targetY) + ' ' + scale('x', datum.targetStack) + ',' + scale('y', datum.targetY)`
            },
            stroke: linkStrokeEncode,
            strokeWidth: { signal: 'max(3, (datum.value / maxValue) * (height - 60) * 0.3)' },
            strokeOpacity: { value: linkOpacity },
            tooltip: { signal: "{'Source': datum.source, 'Target': datum.target, 'Value': format(datum.value, ',')}" }
          },
          update: {
            strokeOpacity: { value: linkOpacity }
          },
          hover: {
            strokeOpacity: { value: 0.8 },
            stroke: { value: '#0ea5e9' }
          }
        }
      },
      // Node rectangles
      {
        type: 'rect',
        from: { data: 'nodes' },
        encode: {
          enter: {
            x: { signal: "scale('x', datum.stack) - nodeWidth/2" },
            width: { signal: 'nodeWidth' },
            y: { scale: 'y', field: 'y0' },
            y2: { scale: 'y', field: 'y1' },
            fill: { scale: 'color', field: 'name' },
            cornerRadius: { value: nodeCornerRadius }
          },
          update: {
            fillOpacity: { value: 1 }
          },
          hover: {
            fillOpacity: { value: 0.8 }
          }
        }
      }
    ];

    // Node labels - position based on stage (first stage: left, last stage: right, middle: above)
    const lastStage = numStages - 1;
    if (showLabels && showValues) {
      marks.push({
        type: 'text',
        from: { data: 'nodes' },
        encode: {
          enter: {
            x: { signal: `datum.stack === 0 ? scale('x', 0) - nodeWidth/2 - 8 : datum.stack === ${lastStage} ? scale('x', ${lastStage}) + nodeWidth/2 + 8 : scale('x', datum.stack)` },
            y: { signal: `datum.stack === 0 || datum.stack === ${lastStage} ? scale('y', (datum.y0 + datum.y1) / 2) : scale('y', datum.y0) - 8` },
            text: { field: 'name' },
            align: { signal: `datum.stack === 0 ? 'right' : datum.stack === ${lastStage} ? 'left' : 'center'` },
            baseline: { value: 'middle' },
            fontSize: { value: 13 },
            fontWeight: { value: 600 },
            fill: { value: '#ffffff' },
            stroke: { value: '#000000' },
            strokeWidth: { value: 0.3 }
          }
        }
      });
      marks.push({
        type: 'text',
        from: { data: 'nodes' },
        encode: {
          enter: {
            x: { signal: "scale('x', datum.stack)" },
            y: { signal: "scale('y', (datum.y0 + datum.y1) / 2)" },
            text: { signal: "format(datum.value, ',')" },
            align: { value: 'center' },
            baseline: { value: 'middle' },
            fontSize: { value: 10 },
            fontWeight: { value: 700 },
            fill: { value: '#0ea5e9' },
            stroke: { value: '#1e293b' },
            strokeWidth: { value: 0.3 }
          }
        }
      });
    } else if (showLabels) {
      marks.push({
        type: 'text',
        from: { data: 'nodes' },
        encode: {
          enter: {
            x: { signal: `datum.stack === 0 ? scale('x', 0) - nodeWidth/2 - 8 : datum.stack === ${lastStage} ? scale('x', ${lastStage}) + nodeWidth/2 + 8 : scale('x', datum.stack)` },
            y: { signal: `datum.stack === 0 || datum.stack === ${lastStage} ? scale('y', (datum.y0 + datum.y1) / 2) : scale('y', datum.y0) - 8` },
            text: { field: 'name' },
            align: { signal: `datum.stack === 0 ? 'right' : datum.stack === ${lastStage} ? 'left' : 'center'` },
            baseline: { value: 'middle' },
            fontSize: { value: 13 },
            fontWeight: { value: 600 },
            fill: { value: '#ffffff' },
            stroke: { value: '#000000' },
            strokeWidth: { value: 0.3 }
          }
        }
      });
    } else if (showValues) {
      marks.push({
        type: 'text',
        from: { data: 'nodes' },
        encode: {
          enter: {
            x: { signal: "scale('x', datum.stack)" },
            y: { signal: "scale('y', (datum.y0 + datum.y1) / 2)" },
            text: { signal: "format(datum.value, ',')" },
            align: { value: 'center' },
            baseline: { value: 'middle' },
            fontSize: { value: 12 },
            fontWeight: { value: 700 },
            fill: { value: '#ffffff' },
            stroke: { value: '#1e293b' },
            strokeWidth: { value: 0.4 }
          }
        }
      });
    }

    return {
      ...this.getBaseSpec(),
      data: [
        { name: 'nodes', values: allNodes },
        { name: 'links', values: allLinks }
      ],
      signals: [
        { name: 'nodeWidth', value: nodeWidth },
        { name: 'maxValue', value: maxTotal }
      ],
      scales: [
        {
          name: 'x',
          type: 'linear',
          domain: [0, numStages - 1],
          range: [100, { signal: 'width - 100' }]
        },
        {
          name: 'y',
          type: 'linear',
          domain: [0, effectiveMax],
          range: [30, { signal: 'height - 30' }]
        },
        {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'nodes', field: 'name' },
          range: { scheme: colorScheme }
        }
      ],
      marks
    };
  }

  /**
   * Generate Kibana-compatible Vega spec with Elasticsearch data source
   * Supports 2-4 stage Sankey diagrams using multi_terms aggregation
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      sourceField, targetField, stage3Field, stage4Field, valueField,
      nodeWidth = 20, nodePadding = 8, nodeCornerRadius = 3,
      linkColorMode = 'fixed', linkOpacity = 0.4,
      showLabels = true, showValues = true
    } = this.config;

    // Get consistent style configuration
    const styleConfig = this.getKibanaStyleConfig();

    // Extract fields from aggregation config
    // multi_terms aggregation passes fields array in bucketAgg.options.fields
    const bucketAgg = aggregation?.bucketAgg;
    const metrics = aggregation?.metrics || [];

    // Get stage fields from multi_terms options or fall back to config
    let stageFields = [];
    if (bucketAgg?.options?.fields && Array.isArray(bucketAgg.options.fields)) {
      stageFields = bucketAgg.options.fields;
    } else {
      // Fall back to config fields
      stageFields = [sourceField, targetField, stage3Field, stage4Field].filter(Boolean);
    }

    const numStages = stageFields.length;

    logger.debug('Sankey Kibana aggregation config', {
      event: 'sankey_kibana_agg_config',
      stageFields,
      numStages,
      bucketAgg: bucketAgg?.type
    });

    // Metric configuration
    const metric = metrics[0];
    const metricType = metric?.type || 'count';
    const metricField = metric?.field || valueField;

    // Build multi_terms aggregation for all stages
    const innerAggs = metricType && metricType !== 'count' && metricField ? {
      metric_0: { [metricType]: { field: metricField } }
    } : {};

    const aggs = {
      stages: {
        multi_terms: {
          terms: stageFields.map(f => ({ field: f })),
          size: 100
        },
        aggs: innerAggs
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

    // Build link stroke encoding based on color mode
    let linkStrokeEncode;
    if (linkColorMode === 'source') {
      linkStrokeEncode = { scale: 'color', field: 'source' };
    } else if (linkColorMode === 'target') {
      linkStrokeEncode = { scale: 'color', field: 'target' };
    } else {
      linkStrokeEncode = { value: '#666666' };
    }

    const lastStage = numStages - 1;

    const marks = [
      // Link paths (bezier curves between consecutive stages)
      {
        type: 'path',
        from: { data: 'links' },
        encode: {
          enter: {
            path: {
              signal: `'M' + scale('x', datum.sourceStack) + ',' + scale('y', datum.sourceY) + ' C' + (scale('x', datum.sourceStack) + scale('x', datum.targetStack)) / 2 + ',' + scale('y', datum.sourceY) + ' ' + (scale('x', datum.sourceStack) + scale('x', datum.targetStack)) / 2 + ',' + scale('y', datum.targetY) + ' ' + scale('x', datum.targetStack) + ',' + scale('y', datum.targetY)`
            },
            stroke: linkStrokeEncode,
            strokeWidth: { signal: 'max(3, (datum.value / totalLinkValue) * flowHeight * 0.3)' },
            strokeOpacity: { value: linkOpacity },
            tooltip: { signal: "{'Source': datum.source, 'Target': datum.target, 'Value': format(datum.value, ',')}" }
          },
          update: {
            strokeOpacity: { value: linkOpacity }
          },
          hover: { strokeOpacity: { value: 0.8 }, stroke: { value: '#0ea5e9' } }
        }
      },
      // Node rectangles
      {
        type: 'rect',
        from: { data: 'nodes' },
        encode: {
          enter: {
            x: { signal: "scale('x', datum.stack) - nodeWidth/2" },
            width: { signal: 'nodeWidth' },
            y: { scale: 'y', field: 'y0' },
            y2: { scale: 'y', field: 'y1' },
            fill: { scale: 'color', field: 'name' },
            cornerRadius: { value: nodeCornerRadius },
            stroke: { value: styleConfig.strokeColor },
            strokeWidth: { value: styleConfig.strokeWidth }
          },
          update: { fillOpacity: { value: styleConfig.opacity } },
          hover: { fillOpacity: { value: styleConfig.hoverOpacity } }
        }
      }
    ];

    // Node labels - position based on stage (first: left, last: right, middle: above)
    if (showLabels && showValues) {
      marks.push({
        type: 'text',
        from: { data: 'nodes' },
        encode: {
          enter: {
            x: { signal: `datum.stack === 0 ? scale('x', 0) - nodeWidth/2 - 8 : datum.stack === ${lastStage} ? scale('x', ${lastStage}) + nodeWidth/2 + 8 : scale('x', datum.stack)` },
            y: { signal: `datum.stack === 0 || datum.stack === ${lastStage} ? scale('y', (datum.y0 + datum.y1) / 2) : scale('y', datum.y0) - 8` },
            text: { field: 'name' },
            align: { signal: `datum.stack === 0 ? 'right' : datum.stack === ${lastStage} ? 'left' : 'center'` },
            baseline: { value: 'middle' },
            fontSize: { value: 13 },
            fontWeight: { value: 600 },
            fill: { value: '#ffffff' },
            stroke: { value: '#000000' },
            strokeWidth: { value: 0.3 }
          }
        }
      });
      marks.push({
        type: 'text',
        from: { data: 'nodes' },
        encode: {
          enter: {
            x: { signal: "scale('x', datum.stack)" },
            y: { signal: "scale('y', (datum.y0 + datum.y1) / 2)" },
            text: { signal: "format(datum.value, ',')" },
            align: { value: 'center' },
            baseline: { value: 'middle' },
            fontSize: { value: 10 },
            fontWeight: { value: 700 },
            fill: { value: '#0ea5e9' },
            stroke: { value: '#1e293b' },
            strokeWidth: { value: 0.3 }
          }
        }
      });
    } else if (showLabels) {
      marks.push({
        type: 'text',
        from: { data: 'nodes' },
        encode: {
          enter: {
            x: { signal: `datum.stack === 0 ? scale('x', 0) - nodeWidth/2 - 8 : datum.stack === ${lastStage} ? scale('x', ${lastStage}) + nodeWidth/2 + 8 : scale('x', datum.stack)` },
            y: { signal: `datum.stack === 0 || datum.stack === ${lastStage} ? scale('y', (datum.y0 + datum.y1) / 2) : scale('y', datum.y0) - 8` },
            text: { field: 'name' },
            align: { signal: `datum.stack === 0 ? 'right' : datum.stack === ${lastStage} ? 'left' : 'center'` },
            baseline: { value: 'middle' },
            fontSize: { value: 13 },
            fontWeight: { value: 600 },
            fill: { value: '#ffffff' },
            stroke: { value: '#000000' },
            strokeWidth: { value: 0.3 }
          }
        }
      });
    } else if (showValues) {
      marks.push({
        type: 'text',
        from: { data: 'nodes' },
        encode: {
          enter: {
            x: { signal: "scale('x', datum.stack)" },
            y: { signal: "scale('y', (datum.y0 + datum.y1) / 2)" },
            text: { signal: "format(datum.value, ',')" },
            align: { value: 'center' },
            baseline: { value: 'middle' },
            fontSize: { value: 12 },
            fontWeight: { value: 700 },
            fill: { value: '#ffffff' },
            stroke: { value: '#1e293b' },
            strokeWidth: { value: 0.4 }
          }
        }
      });
    }

    // Build data transforms for multi-stage Sankey
    // Each stage field is extracted from the multi_terms key array
    const stageExtracts = stageFields.map((_, idx) =>
      ({ type: 'formula', expr: `datum.key[${idx}]`, as: `stage${idx}` })
    );

    // Build node datasets for each stage
    const nodeDatasets = stageFields.map((_, stageIdx) => ({
      name: `stage${stageIdx}Nodes`,
      source: 'rawData',
      transform: [
        { type: 'aggregate', groupby: [`stage${stageIdx}`], ops: ['sum'], fields: ['value'], as: ['value'] },
        { type: 'formula', expr: `datum.stage${stageIdx}`, as: 'name' },
        { type: 'formula', expr: String(stageIdx), as: 'stack' },
        { type: 'collect', sort: { field: 'name' } },
        { type: 'window', ops: ['row_number'], as: ['rowIndex'] },
        { type: 'formula', expr: 'datum.rowIndex - 1', as: 'index' },
        { type: 'window', ops: ['sum'], fields: ['value'], as: ['cumValue'], frame: [null, 0] },
        { type: 'formula', expr: `(datum.cumValue - datum.value) + datum.index * ${nodePadding}`, as: 'y0' },
        { type: 'formula', expr: `datum.cumValue + datum.index * ${nodePadding}`, as: 'y1' }
      ]
    }));

    // Build link datasets between consecutive stages
    const linkDatasets = [];
    for (let linkStage = 0; linkStage < numStages - 1; linkStage++) {
      const srcStage = `stage${linkStage}`;
      const tgtStage = `stage${linkStage + 1}`;

      linkDatasets.push(
        // Aggregate links for this stage pair
        {
          name: `links${linkStage}Agg`,
          source: 'rawData',
          transform: [
            { type: 'aggregate', groupby: [srcStage, tgtStage], ops: ['sum'], fields: ['value'], as: ['value'] },
            { type: 'formula', expr: `datum.${srcStage}`, as: 'source' },
            { type: 'formula', expr: `datum.${tgtStage}`, as: 'target' },
            { type: 'formula', expr: String(linkStage), as: 'sourceStack' },
            { type: 'formula', expr: String(linkStage + 1), as: 'targetStack' }
          ]
        },
        // Add node positions
        {
          name: `links${linkStage}WithNodes`,
          source: `links${linkStage}Agg`,
          transform: [
            { type: 'lookup', from: `stage${linkStage}Nodes`, key: 'name', fields: ['source'], values: ['y0', 'y1', 'value'], as: ['srcNodeY0', 'srcNodeY1', 'srcNodeValue'] },
            { type: 'lookup', from: `stage${linkStage + 1}Nodes`, key: 'name', fields: ['target'], values: ['y0', 'y1', 'value'], as: ['tgtNodeY0', 'tgtNodeY1', 'tgtNodeValue'] },
            { type: 'filter', expr: 'isValid(datum.srcNodeY0) && isValid(datum.tgtNodeY0) && datum.srcNodeValue > 0 && datum.tgtNodeValue > 0' },
            { type: 'formula', expr: '(datum.srcNodeY1 - datum.srcNodeY0) * (datum.value / datum.srcNodeValue)', as: 'srcLinkHeight' },
            { type: 'formula', expr: '(datum.tgtNodeY1 - datum.tgtNodeY0) * (datum.value / datum.tgtNodeValue)', as: 'tgtLinkHeight' },
            { type: 'identifier', as: '_linkIdx' }
          ]
        },
        // Source-side stacking
        {
          name: `links${linkStage}SrcSorted`,
          source: `links${linkStage}WithNodes`,
          transform: [
            { type: 'collect', sort: { field: ['source', 'target'], order: ['ascending', 'ascending'] } },
            { type: 'window', groupby: ['source'], ops: ['sum'], fields: ['srcLinkHeight'], as: ['srcCumHeight'], frame: [null, 0] },
            { type: 'formula', expr: 'datum.srcNodeY0 + (datum.srcCumHeight - datum.srcLinkHeight) + datum.srcLinkHeight / 2', as: 'sourceY' }
          ]
        },
        // Target-side stacking
        {
          name: `links${linkStage}TgtSorted`,
          source: `links${linkStage}WithNodes`,
          transform: [
            { type: 'collect', sort: { field: ['target', 'source'], order: ['ascending', 'ascending'] } },
            { type: 'window', groupby: ['target'], ops: ['sum'], fields: ['tgtLinkHeight'], as: ['tgtCumHeight'], frame: [null, 0] },
            { type: 'formula', expr: 'datum.tgtNodeY0 + (datum.tgtCumHeight - datum.tgtLinkHeight) + datum.tgtLinkHeight / 2', as: 'targetY' }
          ]
        },
        // Final links for this stage
        {
          name: `links${linkStage}Final`,
          source: `links${linkStage}SrcSorted`,
          transform: [
            { type: 'lookup', from: `links${linkStage}TgtSorted`, key: '_linkIdx', fields: ['_linkIdx'], values: ['targetY'], as: ['targetY'] }
          ]
        }
      );
    }

    // Combine all link datasets
    const linkSources = Array.from({ length: numStages - 1 }, (_, i) => `links${i}Final`);

    return {
      ...this.getKibanaBaseSpec(),
      data: [
        {
          name: 'rawData',
          url: urlConfig,
          format: { property: 'aggregations.stages.buckets' },
          transform: [
            ...stageExtracts,
            { type: 'formula', expr: 'datum.metric_0 ? datum.metric_0.value : datum.doc_count', as: 'value' },
            { type: 'filter', expr: 'isValid(datum.value) && datum.value > 0' }
          ]
        },
        ...nodeDatasets,
        {
          name: 'nodes',
          source: nodeDatasets.map(d => d.name)
        },
        ...linkDatasets,
        {
          name: 'links',
          source: linkSources
        },
        {
          name: 'linkTotals',
          source: 'links',
          transform: [
            { type: 'aggregate', ops: ['sum'], fields: ['value'], as: ['total'] }
          ]
        }
      ],
      signals: [
        { name: 'nodeWidth', value: nodeWidth },
        { name: 'numStages', value: numStages },
        { name: 'maxValue', update: "data('nodes').length > 0 ? max(pluck(data('nodes'), 'value')) : 1" },
        { name: 'totalLinkValue', update: "data('linkTotals').length > 0 ? data('linkTotals')[0].total : 1" },
        { name: 'flowHeight', update: 'height - 60' }
      ],
      scales: [
        {
          name: 'x',
          type: 'linear',
          domain: [0, numStages - 1],
          range: [100, { signal: 'width - 100' }]
        },
        {
          name: 'y',
          type: 'linear',
          domain: { data: 'nodes', fields: ['y0', 'y1'] },
          range: [30, { signal: 'height - 30' }]
        },
        {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'nodes', field: 'name' },
          range: { scheme: styleConfig.colorScheme }
        }
      ],
      marks
    };
  }
}

export default SankeyGenerator;

