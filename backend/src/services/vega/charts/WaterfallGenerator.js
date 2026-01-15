/**
 * Waterfall Chart Generator
 * Generates Vega-Lite specs for waterfall charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class WaterfallGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'waterfall',
    name: 'Waterfall Chart',
    description: 'Show cumulative effect of positive and negative values',
    category: 'flow',
    icon: 'git-commit'
  };

  static schema = {
    fields: [
      { name: 'labelField', label: 'Label', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['grouped', 'composite'], default: 'grouped', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'showTotal', label: 'Show Total', type: 'boolean', default: true },
      { name: 'showConnectors', label: 'Show Connectors', type: 'boolean', default: true },
      { name: 'positiveColor', label: 'Positive Color', type: 'color', default: '#93c4aa' },
      { name: 'negativeColor', label: 'Negative Color', type: 'color', default: '#f78a64' },
      { name: 'totalColor', label: 'Total Color', type: 'color', default: '#f7e0b6' }
    ]
  };

  static example = {
    config: {
      labelField: 'item',
      valueField: 'amount',
      title: 'Profit Breakdown',
      showTotal: true
    },
    data: [
      { item: 'Revenue', amount: 5000 },
      { item: 'Cost of Goods', amount: -2000 },
      { item: 'Marketing', amount: -500 },
      { item: 'Operations', amount: -800 },
      { item: 'Tax', amount: -400 }
    ]
  };

  generate(data) {
    const { 
      labelField, valueField,
      showTotal = true, showConnectors = true,
      positiveColor = '#93c4aa', negativeColor = '#f78a64', totalColor = '#f7e0b6'
    } = this.config;
    
    logger.debug('Generating waterfall chart spec', {
      event: 'waterfall_generate',
      labelField,
      valueField
    });

    const lblField = this.resolveFieldPath(labelField, data) || 'label';
    const valField = this.resolveFieldPath(valueField, data) || '_count';
    
    // Sort input data by temporal label field if applicable
    const isTemporal = this.isTemporalField(data, lblField);
    const sortedData = isTemporal ? this.sortDataByTemporalField(data, lblField) : data;
    
    let processedInput = sortedData || [];
    
    // Calculate running totals
    let runningTotal = 0;
    const processedData = processedInput.map((d, idx) => {
      const amount = d[valField] || 0;
      const previousSum = runningTotal;
      runningTotal += amount;
      
      return {
        label: d[lblField] || `Item ${idx + 1}`,
        amount: amount,
        sum: runningTotal,
        previous_sum: previousSum,
        isTotal: false,
        index: idx
      };
    });
    
    if (showTotal && processedData.length > 0) {
      processedData.push({
        label: 'End',
        amount: runningTotal,
        sum: runningTotal,
        previous_sum: 0,
        isTotal: true,
        index: processedData.length
      });
    }

    const layers = [
      // Main bars
      {
        mark: { type: 'bar', size: 40 },
        encoding: {
          x: {
            field: 'label',
            type: 'ordinal',
            sort: { field: 'index' },
            axis: { labelAngle: -45, title: null }
          },
          y: {
            field: 'previous_sum',
            type: 'quantitative',
            title: 'Amount'
          },
          y2: { field: 'sum' },
          color: {
            condition: [
              { test: 'datum.isTotal', value: totalColor },
              { test: 'datum.amount < 0', value: negativeColor }
            ],
            value: positiveColor
          }
        }
      },
      // Running total labels
      {
        mark: {
          type: 'text',
          dy: -8,
          fontSize: 10,
          fontWeight: 'bold'
        },
        encoding: {
          x: { field: 'label', type: 'ordinal', sort: { field: 'index' } },
          y: { field: 'sum', type: 'quantitative' },
          text: { field: 'sum', type: 'quantitative', format: ',.0f' },
          color: { value: '#000000' }
        }
      },
      // Amount labels inside bars
      {
        mark: {
          type: 'text',
          fontWeight: 'bold',
          fontSize: 11
        },
        encoding: {
          x: { field: 'label', type: 'ordinal', sort: { field: 'index' } },
          y: { field: 'center', type: 'quantitative' },
          text: { field: 'text_amount', type: 'nominal' },
          color: {
            condition: [
              { test: 'datum.isTotal', value: '#725a30' }
            ],
            value: 'white'
          }
        }
      }
    ];

    if (showConnectors) {
      layers.splice(1, 0, {
        mark: {
          type: 'rule',
          color: '#666666',
          strokeWidth: 1,
          strokeDash: [4, 2]
        },
        transform: [
          { filter: '!datum.isTotal' }
        ],
        encoding: {
          x: { field: 'label', type: 'ordinal', sort: { field: 'index' } },
          y: { field: 'sum', type: 'quantitative' }
        }
      });
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: this.config.width || 600,
      height: this.config.height || 400,
      title: this.config.title || '',
      data: { values: processedData },
      transform: [
        { calculate: '(datum.sum + datum.previous_sum) / 2', as: 'center' },
        { 
          calculate: "(datum.isTotal ? '' : (datum.amount > 0 ? '+' : '')) + format(datum.amount, ',.0f')", 
          as: 'text_amount' 
        }
      ],
      layer: layers,
      config: {
        view: { stroke: null },
        axis: {
          labelColor: '#000000',
          titleColor: '#000000',
          gridColor: '#334155',
          domainColor: '#475569'
        }
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
      labelField, valueField,
      showTotal = true, showConnectors = true,
      positiveColor = '#93c4aa', negativeColor = '#f78a64', totalColor = '#f7e0b6'
    } = this.config;

    // Use actual aggregation config structure
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || labelField;
    const bucketOptions = bucketAgg?.options || {};

    const metric = metrics[0];
    const metricType = metric?.type; // Don't default - leave undefined if no metric
    const metricField = metric?.field || valueField;

    const aggs = {
      categories: {
        terms: {
          field: bucketField,
          size: bucketOptions.size || 20,
          order: { '_key': 'asc' }
        },
        aggs: (metrics.length > 0 && metricType && metricType !== 'count' && metricField) ? {
          value: { [metricType]: { field: metricField } }
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

    const transforms = [
      { calculate: 'datum.key', as: 'label' },
      { calculate: metricType !== 'count' ? 'datum.value.value' : 'datum.doc_count', as: 'amount' },
      { window: [{ op: 'sum', field: 'amount', as: 'sum' }], sort: [{ field: 'label' }] },
      { calculate: 'datum.sum - datum.amount', as: 'previous_sum' },
      { calculate: 'datum.previous_sum', as: 'start' },
      { calculate: 'datum.sum', as: 'end' },
      { calculate: '(datum.sum + datum.previous_sum) / 2', as: 'center' },
      { calculate: "(datum.amount > 0 ? '+' : '') + format(datum.amount, ',.0f')", as: 'text_amount' },
      { calculate: 'false', as: 'isTotal' }
    ];

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Waterfall Chart',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.categories.buckets' }
      },
      transform: transforms,
      layer: [
        // Main bars
        {
          mark: { type: 'bar', size: 40 },
          encoding: {
            x: { field: 'label', type: 'ordinal', axis: { labelAngle: -45, title: null } },
            y: { field: 'previous_sum', type: 'quantitative', title: 'Amount' },
            y2: { field: 'sum' },
            color: {
              condition: [
                { test: 'datum.isTotal', value: totalColor },
                { test: 'datum.amount < 0', value: negativeColor }
              ],
              value: positiveColor
            }
          }
        },
        // Connector lines between bars
        ...(showConnectors ? [{
          mark: {
            type: 'rule',
            color: '#666666',
            strokeWidth: 1,
            strokeDash: [4, 2]
          },
          transform: [
            { filter: '!datum.isTotal' }
          ],
          encoding: {
            x: { field: 'label', type: 'ordinal' },
            y: { field: 'sum', type: 'quantitative' }
          }
        }] : []),
        // Running total labels
        {
          mark: { type: 'text', dy: -8, fontSize: 10, fontWeight: 'bold' },
          encoding: {
            x: { field: 'label', type: 'ordinal' },
            y: { field: 'sum', type: 'quantitative' },
            text: { field: 'sum', type: 'quantitative', format: ',.0f' },
            color: { value: '#000000' }
          }
        }
      ],
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default WaterfallGenerator;

