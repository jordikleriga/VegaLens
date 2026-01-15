/**
 * Comet Chart Generator
 * Generates Vega-Lite specs for comet/trail charts showing changes between states
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class CometGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'comet',
    name: 'Comet Chart',
    description: 'Show changes between two states with trail marks',
    category: 'comparison',
    icon: 'git-commit'
  };

  static schema = {
    fields: [
      { name: 'categoryField', label: 'Category', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'timeField', label: 'Time/State Field', type: 'field', required: true, fieldTypes: ['keyword', 'text', 'date'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['color', 'faceted'], default: 'color', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'trailSizeMin', label: 'Min Trail Size', type: 'number', min: 0, max: 10, default: 0 },
      { name: 'trailSizeMax', label: 'Max Trail Size', type: 'number', min: 5, max: 30, default: 12 },
      { name: 'colorByDelta', label: 'Color by Change', type: 'boolean', default: true },
      { name: 'positiveColor', label: 'Positive Color', type: 'color', default: '#22c55e' },
      { name: 'negativeColor', label: 'Negative Color', type: 'color', default: '#ef4444' }
    ]
  };

  static example = {
    config: {
      categoryField: 'country',
      timeField: 'year',
      valueField: 'gdp',
      title: 'GDP Change 2020-2023'
    },
    data: [
      { country: 'USA', year: '2020', gdp: 21000 },
      { country: 'USA', year: '2023', gdp: 25500 },
      { country: 'China', year: '2020', gdp: 14700 },
      { country: 'China', year: '2023', gdp: 17900 },
      { country: 'Germany', year: '2020', gdp: 3800 },
      { country: 'Germany', year: '2023', gdp: 4200 }
    ]
  };

  generate(data) {
    const {
      categoryField = 'category', timeField = 'year', valueField = 'value',
      trailSizeMin = 0, trailSizeMax = 12,
      colorByDelta = true, positiveColor = '#22c55e', negativeColor = '#ef4444'
    } = this.config;

    logger.debug('Generating comet chart spec', {
      event: 'comet_generate',
      categoryField,
      timeField,
      valueField
    });

    const formatStateLabel = (value) => {
      if (value === null || value === undefined) return 'Unknown';
      const str = String(value);
      if (str.match(/^\d{4}-\d{2}-\d{2}/) || str.match(/^\d{13}$/)) {
        try {
          const date = new Date(str);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          }
        } catch (e) { /* ignore */ }
      }
      return str.replace(/'/g, "\\'");
    };

    const rawData = data || [];
    const uniqueStates = [...new Set(rawData.map(d => d[timeField]))]
      .filter(v => v !== null && v !== undefined)
      .sort();

    const detectedState1 = uniqueStates[0] || null;
    const detectedState2 = uniqueStates.length > 1 ? uniqueStates[uniqueStates.length - 1] : detectedState1;

    const state1Label = formatStateLabel(detectedState1);
    const state2Label = formatStateLabel(detectedState2);

    // Pre-process data
    const categoryMap = new Map();
    
    rawData.forEach(d => {
      const category = d[categoryField];
      const state = d[timeField];
      const value = parseFloat(d[valueField]) || 0;
      
      if (!category) return;
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { category, state1Value: null, state2Value: null });
      }
      
      const entry = categoryMap.get(category);
      const stateStr = String(state);
      const state1Str = String(detectedState1);
      const state2Str = String(detectedState2);
      
      if (stateStr === state1Str) entry.state1Value = value;
      else if (stateStr === state2Str) entry.state2Value = value;
    });

    const processedData = [];
    categoryMap.forEach((entry) => {
      const val1 = entry.state1Value !== null ? entry.state1Value : 0;
      const val2 = entry.state2Value !== null ? entry.state2Value : 0;
      const delta = val2 - val1;
      const pctChange = val1 !== 0 ? (delta / val1) * 100 : 0;
      
      processedData.push({
        category: entry.category,
        state: state1Label,
        stateOrder: 0,
        value: val1,
        delta,
        pct_change: pctChange
      });
      
      processedData.push({
        category: entry.category,
        state: state2Label,
        stateOrder: 1,
        value: val2,
        delta,
        pct_change: pctChange
      });
    });

    if (processedData.length === 0) {
      return {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        description: 'No valid data for comet chart',
        width: this.config.width || 400,
        height: this.config.height || 300,
        title: { text: 'No Data', color: '#000000' },
        data: { values: [] },
        mark: 'text',
        encoding: {}
      };
    }

    const encoding = {
      x: { 
        field: 'stateOrder', 
        type: 'ordinal',
        title: null,
        axis: {
          labelExpr: `datum.value == 0 ? '${state1Label}' : '${state2Label}'`,
          labelAngle: 0,
          labelColor: '#000000'
        }
      },
      y: { 
        field: 'category', 
        type: 'nominal',
        title: categoryField,
        axis: { labelColor: '#000000', titleColor: '#000000' }
      },
      size: {
        field: 'value',
        type: 'quantitative',
        scale: { range: [trailSizeMin, trailSizeMax] },
        legend: { title: valueField, labelColor: '#000000', titleColor: '#000000' }
      },
      detail: { field: 'category' },
      tooltip: [
        { field: 'category', type: 'nominal', title: 'Category' },
        { field: 'state', type: 'ordinal', title: 'State' },
        { field: 'value', type: 'quantitative', title: valueField, format: ',.2f' },
        { field: 'delta', type: 'quantitative', title: 'Change', format: '+,.2f' }
      ]
    };

    if (colorByDelta) {
      encoding.color = {
        field: 'delta',
        type: 'quantitative',
        scale: { domainMid: 0, range: [negativeColor, '#000000', positiveColor] },
        legend: { title: 'Change', labelColor: '#000000', titleColor: '#000000' }
      };
    } else {
      encoding.color = { value: this.colorConfig.singleColor || VegaGeneratorBase.DEFAULTS.singleColor };
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: `Comet chart showing changes between ${state1Label} and ${state2Label}`,
      width: this.config.width || 400,
      height: this.config.height || 300,
      title: { text: this.config.title || `${state1Label} vs ${state2Label}`, color: '#000000' },
      data: { values: processedData },
      mark: { type: 'trail' },
      encoding,
      config: {
        background: 'transparent',
        legend: { orient: 'bottom', direction: 'horizontal', labelColor: '#000000', titleColor: '#000000' },
        axis: { gridColor: '#334155' }
      }
    };
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      categoryField, timeField: stateField, valueField,
      trailSizeMin = 0, trailSizeMax = 12,
      colorByDelta = true, positiveColor = '#22c55e', negativeColor = '#ef4444'
    } = this.config;

    // Extract actual ES field names from aggregation config
    const bucketAggs = aggregation?.bucketAggs || [];
    const primaryBucket = bucketAggs[0] || aggregation?.bucketAgg;
    const secondaryBucket = bucketAggs[1] || aggregation?.splitBy;

    const metrics = aggregation?.metrics || [];
    const metric = metrics[0];
    const metricType = metric?.type || 'count';
    const metricField = metric?.field || valueField;

    // Use nested terms aggregation (more compatible than multi_terms)
    const categoryBucketField = primaryBucket?.field || categoryField;
    const stateBucketField = secondaryBucket?.field || stateField;

    const innerAggs = metricType !== 'count' && metricField ? {
      metric_0: { [metricType]: { field: metricField } }
    } : {};

    const aggs = {
      categories: {
        terms: { field: categoryBucketField, size: 50 },
        aggs: {
          states: {
            terms: { field: stateBucketField, size: 10 },
            aggs: innerAggs
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

    if (useContext) {
      urlConfig['%context%'] = true;
      urlConfig['%timefield%'] = timeField;
    }

    // Helper to clean up field names for display
    const cleanFieldName = (field) => {
      if (!field) return '';
      return field.replace(/\.keyword$/, '').replace(/_/g, ' ');
    };

    const transforms = [
      // Flatten nested aggregation structure
      { flatten: ['states.buckets'], as: ['stateData'] },
      // Extract fields
      { calculate: 'datum.key', as: 'category' },
      { calculate: 'datum.stateData.key', as: 'state' },
      {
        calculate: metricType !== 'count'
          ? 'datum.stateData.metric_0 ? datum.stateData.metric_0.value : 0'
          : 'datum.stateData.doc_count || 0',
        as: 'value'
      },
      // Ensure value is valid number, default to 0
      { calculate: 'isValid(datum.value) ? max(datum.value, 0) : 0', as: 'value' },
      // Add state ordering for trail mark (like preview spec)
      {
        window: [{ op: 'row_number', as: 'stateOrder' }],
        groupby: ['category'],
        sort: [{ field: 'state', order: 'ascending' }]
      },
      // Convert to 0-based index
      { calculate: 'datum.stateOrder - 1', as: 'stateOrder' },
      // Calculate delta (change) per category for color encoding
      {
        joinaggregate: [
          { op: 'min', field: 'value', as: 'minVal' },
          { op: 'max', field: 'value', as: 'maxVal' }
        ],
        groupby: ['category']
      },
      { calculate: 'datum.maxVal - datum.minVal', as: 'delta' }
    ];

    // Build comet chart with trail mark (matches preview spec)
    // X-axis: state order (ordinal), Y-axis: category (nominal)
    // Size encodes value, color encodes delta (change)
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Comet Chart',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.categories.buckets' }
      },
      transform: transforms,
      mark: { type: 'trail' },
      encoding: {
        x: {
          field: 'stateOrder',
          type: 'ordinal',
          title: cleanFieldName(stateBucketField),
          axis: { labelAngle: 0 }
        },
        y: {
          field: 'category',
          type: 'nominal',
          title: cleanFieldName(categoryBucketField)
        },
        size: {
          field: 'value',
          type: 'quantitative',
          scale: { range: [trailSizeMin, trailSizeMax] },
          legend: { title: metricType === 'count' ? 'Count' : cleanFieldName(metricField) }
        },
        color: colorByDelta ? {
          field: 'delta',
          type: 'quantitative',
          scale: { domainMid: 0, range: [negativeColor, '#888888', positiveColor] },
          legend: { title: 'Change' }
        } : {
          field: 'category',
          type: 'nominal',
          scale: { scheme: 'category10' }
        },
        detail: { field: 'category' },
        tooltip: [
          { field: 'category', type: 'nominal', title: 'Category' },
          { field: 'state', type: 'nominal', title: 'State' },
          { field: 'value', type: 'quantitative', title: 'Value', format: ',.2f' },
          { field: 'delta', type: 'quantitative', title: 'Change', format: '+,.2f' }
        ]
      },
      config: {
        view: { stroke: null },
        legend: { orient: 'bottom', direction: 'horizontal' },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default CometGenerator;

