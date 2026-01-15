/**
 * Funnel Chart Generator
 * Generates Vega specs for funnel visualizations
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class FunnelGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'funnel',
    name: 'Funnel Chart',
    description: 'Show conversion or attrition through stages',
    category: 'flow',
    icon: 'filter'
  };

  static schema = {
    fields: [
      { name: 'stageField', label: 'Stage', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'aggregation', label: 'Aggregation', type: 'select', options: ['sum', 'count', 'avg', 'min', 'max'], default: 'sum' },
      { name: 'orderBy', label: 'Order By', type: 'select', options: ['_count', '_key', 'custom'], default: '_count', advanced: true },
      { name: 'orderDirection', label: 'Order Direction', type: 'select', options: ['desc', 'asc'], default: 'desc', advanced: true },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['split', 'faceted'], default: 'split', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'showLabels', label: 'Show Labels', type: 'boolean', default: true },
      { name: 'showPercentage', label: 'Show Percentage', type: 'boolean', default: false },
      { name: 'stageGap', label: 'Stage Gap', type: 'number', min: 0, max: 20, default: 2 }
    ]
  };

  static example = {
    config: {
      stageField: 'stage',
      valueField: 'users',
      title: 'Sales Funnel',
      showLabels: true,
      showPercentage: true
    },
    data: [
      { stage: 'Visitors', users: 10000 },
      { stage: 'Leads', users: 3000 },
      { stage: 'Qualified', users: 1200 },
      { stage: 'Proposal', users: 600 },
      { stage: 'Closed', users: 180 }
    ]
  };

  generate(data) {
    const { 
      stageField, valueField,
      showLabels = true, showPercentage = false
    } = this.config;
    
    logger.debug('Generating funnel chart spec', {
      event: 'funnel_generate',
      stageField,
      valueField
    });

    const resolvedStageField = this.resolveFieldPath(stageField, data);
    const resolvedValueField = this.resolveFieldPath(valueField, data);
    
    // Check if data is already aggregated (1 row per stage = pre-aggregated from Elasticsearch)
    const stageKeys = (data || []).map(d => d[resolvedStageField]);
    const needsAggregation = stageKeys.length !== new Set(stageKeys).size;
    
    let processedData;
    
    if (needsAggregation) {
      // Data has duplicate stages - need to aggregate
      const aggregationType = this.config.aggregation || 'count';
      const aggregatedMap = new Map();
      (data || []).forEach(d => {
        const stage = d[resolvedStageField];
        if (stage === undefined || stage === null) return;
        
        if (!aggregatedMap.has(stage)) {
          aggregatedMap.set(stage, { stage, count: 0, sum: 0, values: [] });
        }
        const agg = aggregatedMap.get(stage);
        agg.count += 1;
        const val = parseFloat(d[resolvedValueField]) || 0;
        agg.sum += val;
        agg.values.push(val);
      });
      
      // Calculate final value based on aggregation type
      processedData = Array.from(aggregatedMap.values()).map(agg => {
        let value;
        switch (aggregationType) {
          case 'sum':
            value = agg.sum;
            break;
          case 'avg':
          case 'average':
            value = agg.values.length > 0 ? agg.sum / agg.values.length : 0;
            break;
          case 'min':
            value = agg.values.length > 0 ? Math.min(...agg.values) : 0;
            break;
          case 'max':
            value = agg.values.length > 0 ? Math.max(...agg.values) : 0;
            break;
          case 'count':
          default:
            value = agg.count;
            break;
        }
        return {
          [resolvedStageField]: agg.stage,
          [resolvedValueField]: value
        };
      });
    } else {
      // Data is already aggregated (1 row per stage) - use as-is
      processedData = (data || []).map(d => ({
        [resolvedStageField]: d[resolvedStageField],
        [resolvedValueField]: parseFloat(d[resolvedValueField]) || 0
      }));
    }
    
    // Sort data by value descending
    const sortedData = processedData.sort((a, b) => 
      (b[resolvedValueField] || 0) - (a[resolvedValueField] || 0)
    );
    
    const maxValue = sortedData.length > 0 ? sortedData[0][resolvedValueField] || 1 : 1;
    const width = this.config.width || 500;
    const height = this.config.height || 400;
    const xCenter = width / 2;
    
    const segmentHeight = height / sortedData.length;
    
    const colorSchemes = {
      tableau10: ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'],
      category10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
      blues: ['#3182bd', '#6baed6', '#9ecae1', '#c6dbef', '#deebf7'],
      viridis: ['#440154', '#482878', '#3e4a89', '#31688e', '#26838e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725']
    };
    
    const schemeColors = colorSchemes[this.colorConfig.scheme] || colorSchemes.tableau10;
    
    const funnelData = sortedData.map((d, i) => {
      const value = d[resolvedValueField] || 0;
      const proportion = value / maxValue;
      const currentWidth = proportion * (width * 0.9);
      
      const nextValue = i < sortedData.length - 1 ? sortedData[i + 1][resolvedValueField] || 0 : value * 0.3;
      const nextProportion = nextValue / maxValue;
      const nextWidth = nextProportion * (width * 0.9);
      
      const topY = i * segmentHeight;
      const bottomY = (i + 1) * segmentHeight;
      const topLeft = xCenter - currentWidth / 2;
      const topRight = xCenter + currentWidth / 2;
      const bottomLeft = xCenter - nextWidth / 2;
      const bottomRight = xCenter + nextWidth / 2;
      
      return {
        _stage: d[resolvedStageField],
        _value: value,
        _percentage: Math.round(proportion * 100),
        _index: i,
        _path: `M ${topLeft} ${topY} L ${topRight} ${topY} L ${bottomRight} ${bottomY} L ${bottomLeft} ${bottomY} Z`,
        _centerX: xCenter,
        _centerY: topY + segmentHeight / 2,
        _color: schemeColors[i % schemeColors.length]
      };
    });

    const marks = [
      // Trapezoid segments
      {
        type: 'path',
        from: { data: 'funnel' },
        encode: {
          enter: {
            path: { field: '_path' },
            fill: { field: '_color' },
            stroke: { value: 'rgba(0,0,0,0.3)' },
            strokeWidth: { value: 1 }
          },
          update: {
            fillOpacity: { value: 1 }
          },
          hover: {
            fillOpacity: { value: 0.85 }
          }
        }
      }
    ];

    // Labels with accessibility styling
    if (showLabels) {
      // Value labels
      marks.push({
        type: 'text',
        from: { data: 'funnel' },
        encode: {
          enter: {
            x: { field: '_centerX' },
            y: { field: '_centerY' },
            text: { signal: showPercentage ? `datum._percentage + '%'` : `format(datum._value, ',')` },
            align: { value: 'center' },
            baseline: { value: 'middle' },
            fill: { value: '#ffffff' },
            fontSize: { value: 16 },
            fontWeight: { value: 700 },
            stroke: { value: '#1e293b' },
            strokeWidth: { value: 0.5 }
          }
        }
      });
      
      // Stage labels
      marks.push({
        type: 'text',
        from: { data: 'funnel' },
        encode: {
          enter: {
            x: { field: '_centerX' },
            y: { signal: 'datum._centerY + 18' },
            text: { field: '_stage' },
            align: { value: 'center' },
            baseline: { value: 'middle' },
            fill: { value: '#ffffff' },
            fontSize: { value: 13 },
            fontWeight: { value: 600 },
            stroke: { value: '#1e293b' },
            strokeWidth: { value: 0.4 }
          }
        }
      });
    }

    return {
      $schema: 'https://vega.github.io/schema/vega/v5.json',
      description: 'Funnel Chart',
      title: { text: this.config.title || '', color: '#e0e0e0' },
      width: width,
      height: height,
      padding: 20,
      background: 'transparent',
      data: [
        {
          name: 'funnel',
          values: funnelData
        }
      ],
      marks
    };
  }

  /**
   * Generate Kibana-compatible Vega spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const { stageField, valueField, showLabels = true, showPercentage = false, stageGap = 2 } = this.config;

    // Use actual aggregation config structure (NEW PATTERN)
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || stageField;
    const metric = metrics[0];
    const metricField = metric?.field || valueField;
    const metricType = metric?.type; // Don't default - leave undefined if no metric

    // Get consistent style configuration
    const styleConfig = this.getKibanaStyleConfig();

    const aggs = {
      primary: {
        terms: { field: bucketField, size: 20, order: { _count: 'desc' } },
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

    // Build marks array with consistent styling
    const marks = [
      // Trapezoid segments
      {
        type: 'rect',
        from: { data: 'funnel' },
        encode: {
          enter: {
            x: { signal: 'width/2 - datum.barWidth/2' },
            width: { signal: 'datum.barWidth' },
            y: { field: 'y0' },
            y2: { field: 'y1' },
            fill: { scale: 'color', field: 'stage' },
            cornerRadius: { value: styleConfig.cornerRadius },
            stroke: { value: styleConfig.strokeColor },
            strokeWidth: { value: styleConfig.strokeWidth }
          },
          update: { fillOpacity: { value: styleConfig.opacity } },
          hover: { fillOpacity: { value: Math.min(1, styleConfig.opacity + 0.1) } }
        }
      }
    ];

    // Labels with accessibility styling (Kibana)
    if (showLabels) {
      // Value labels
      marks.push({
        type: 'text',
        from: { data: 'funnel' },
        encode: {
          enter: {
            x: { signal: 'width/2' },
            y: { signal: '(datum.y0 + datum.y1) / 2' },
            text: { signal: showPercentage ? "datum.percentage + '%'" : "format(datum.value, ',')" },
            align: { value: 'center' },
            baseline: { value: 'middle' },
            fill: { value: '#ffffff' },
            fontSize: { value: 14 },
            fontWeight: { value: 700 },
            stroke: { value: '#1e293b' },
            strokeWidth: { value: 0.5 }
          }
        }
      });

      // Stage labels (on the right side)
      marks.push({
        type: 'text',
        from: { data: 'funnel' },
        encode: {
          enter: {
            x: { signal: 'width/2 + datum.barWidth/2 + 10' },
            y: { signal: '(datum.y0 + datum.y1) / 2' },
            text: { field: 'stage' },
            align: { value: 'left' },
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
      ...this.getKibanaBaseSpec(),
      data: [
        {
          name: 'source',
          url: urlConfig,
          format: { property: 'aggregations.primary.buckets' },
          transform: [
            { type: 'formula', expr: 'datum.key', as: 'stage' },
            { type: 'formula', expr: 'datum.metric_0 ? datum.metric_0.value : datum.doc_count', as: 'value' }
          ]
        },
        {
          name: 'funnel',
          source: 'source',
          transform: [
            // Sort by value descending
            { type: 'collect', sort: { field: 'value', order: 'descending' } },
            // Calculate max value for proportional widths
            { type: 'joinaggregate', ops: ['max'], fields: ['value'], as: ['maxValue'] },
            // Calculate positions
            { type: 'window', ops: ['row_number'], as: ['index'] },
            { type: 'formula', expr: 'datum.value / datum.maxValue * 100', as: 'percentage' },
            { type: 'formula', expr: 'datum.value / datum.maxValue * width * 0.8', as: 'barWidth' },
            { type: 'formula', expr: '(datum.index - 1) * (height / data("funnel").length)', as: 'y0' },
            { type: 'formula', expr: `datum.y0 + (height / data("funnel").length) - ${stageGap}`, as: 'y1' }
          ]
        }
      ],
      scales: [
        {
          name: 'color',
          type: 'ordinal',
          domain: { data: 'funnel', field: 'stage' },
          range: { scheme: styleConfig.colorScheme }
        }
      ],
      marks
    };
  }
}

export default FunnelGenerator;

