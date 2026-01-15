/**
 * Pareto Chart Generator
 * Generates Vega specs for Pareto charts (combined bar + cumulative line)
 * Follows the 80/20 principle visualization pattern
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class ParetoGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'pareto',
    name: 'Pareto Chart',
    description: 'Combined bar chart with cumulative percentage line (80/20 analysis)',
    category: 'comparison',
    icon: 'trending-up'
  };

  static schema = {
    fields: [
      { name: 'categoryField', label: 'Category', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'showLine', label: 'Show Cumulative Line', type: 'boolean', default: true },
      { name: 'showPoints', label: 'Show Points on Line', type: 'boolean', default: true },
      { name: 'show80Line', label: 'Show 80% Reference Line', type: 'boolean', default: true },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['stacked', 'composite'], default: 'stacked', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'barColor', label: 'Bar Color', type: 'color', default: '#0ea5e9' },
      { name: 'lineColor', label: 'Line Color', type: 'color', default: '#f97316' },
      { name: 'referenceLineColor', label: '80% Line Color', type: 'color', default: '#ef4444' },
      { name: 'barOpacity', label: 'Bar Opacity', type: 'number', min: 0.3, max: 1, step: 0.1, default: 0.8 },
      { name: 'sortDescending', label: 'Sort Descending', type: 'boolean', default: true }
    ]
  };

  static example = {
    config: {
      categoryField: 'defect_type',
      valueField: 'count',
      title: 'Defect Analysis - Pareto Chart',
      show80Line: true
    },
    data: [
      { defect_type: 'Scratches', count: 45 },
      { defect_type: 'Dents', count: 32 },
      { defect_type: 'Cracks', count: 28 },
      { defect_type: 'Misalignment', count: 18 },
      { defect_type: 'Color Mismatch', count: 12 },
      { defect_type: 'Missing Parts', count: 8 },
      { defect_type: 'Other', count: 5 }
    ]
  };

  generate(data) {
    const {
      categoryField,
      valueField,
      showLine = true,
      showPoints = true,
      show80Line = true,
      barColor = '#0ea5e9',
      lineColor = '#f97316',
      referenceLineColor = '#ef4444',
      barOpacity = 0.8,
      sortDescending = true
    } = this.config;

    logger.debug('Generating Pareto chart spec', {
      event: 'pareto_generate',
      categoryField,
      valueField
    });

    // Check if we have multi-level bucket data (via _composite_key)
    const hasCompositeKey = data && data.length > 0 && '_composite_key' in data[0];
    
    // For multi-level buckets, use _composite_key for X-axis to show combined labels
    // e.g., "Men's Clothing - MALE", "Women's Clothing - FEMALE"
    const effectiveCategoryField = hasCompositeKey ? '_composite_key' : categoryField;

    // Resolve field paths
    const resolvedCategoryField = this.resolveFieldPath(effectiveCategoryField, data);
    const resolvedValueField = this.resolveFieldPath(valueField, data);

    // For Pareto charts, we need to aggregate by category first if there are splits
    // Group by category and sum the values
    const categoryMap = new Map();
    (data || []).forEach(d => {
      const cat = d[resolvedCategoryField];
      const val = d[resolvedValueField] || 0;
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + val);
    });

    // Convert map to array
    let sortedData = Array.from(categoryMap.entries()).map(([cat, val]) => ({
      [resolvedCategoryField]: cat,
      [resolvedValueField]: val
    }));

    // Sort by value
    if (sortDescending) {
      sortedData.sort((a, b) => (b[resolvedValueField] || 0) - (a[resolvedValueField] || 0));
    }

    // Calculate cumulative percentages
    const total = sortedData.reduce((sum, d) => sum + (d[resolvedValueField] || 0), 0);
    let cumulative = 0;

    const processedData = sortedData.map((d, i) => {
      cumulative += d[resolvedValueField] || 0;
      return {
        ...d,
        _order: i,
        _cumulative: cumulative,
        _cumulativePercent: total > 0 ? (cumulative / total) * 100 : 0
      };
    });

    // Get ordered categories for x-axis domain
    const orderedCategories = processedData.map(d => d[resolvedCategoryField]);

    const marks = [
      // Bars
      {
        type: 'rect',
        from: { data: 'source' },
        encode: {
          enter: {
            x: { scale: 'xscale', field: resolvedCategoryField },
            width: { scale: 'xscale', band: 1 },
            y: { scale: 'yscale', field: resolvedValueField },
            y2: { scale: 'yscale', value: 0 },
            fill: { value: barColor },
            fillOpacity: { value: barOpacity },
            cornerRadiusTopLeft: { value: 4 },
            cornerRadiusTopRight: { value: 4 }
          },
          update: {
            fillOpacity: { value: barOpacity }
          },
          hover: {
            fillOpacity: { value: 1 }
          }
        }
      }
    ];

    // 80% reference line
    if (show80Line) {
      marks.push({
        type: 'rule',
        encode: {
          enter: {
            x: { value: 0 },
            x2: { signal: 'width' },
            y: { scale: 'percentScale', value: 80 },
            stroke: { value: referenceLineColor },
            strokeWidth: { value: 1.5 },
            strokeDash: { value: [6, 4] },
            opacity: { value: 0.7 }
          }
        }
      });

      // 80% label
      marks.push({
        type: 'text',
        encode: {
          enter: {
            x: { signal: 'width' },
            y: { scale: 'percentScale', value: 80 },
            dx: { value: -5 },
            dy: { value: -5 },
            text: { value: '80%' },
            fill: { value: '#ffffff' },
            fontSize: { value: 12 },
            fontWeight: { value: 600 },
            align: { value: 'right' },
            stroke: { value: '#000000' },
            strokeWidth: { value: 0.3 }
          }
        }
      });
    }

    // Cumulative line
    if (showLine) {
      marks.push({
        type: 'line',
        from: { data: 'source' },
        encode: {
          enter: {
            x: { scale: 'xscale', field: resolvedCategoryField, band: 0.5 },
            y: { scale: 'percentScale', field: '_cumulativePercent' },
            stroke: { value: lineColor },
            strokeWidth: { value: 2.5 },
            interpolate: { value: 'monotone' }
          }
        }
      });

      // Points on line
      if (showPoints) {
        marks.push({
          type: 'symbol',
          from: { data: 'source' },
          encode: {
            enter: {
              x: { scale: 'xscale', field: resolvedCategoryField, band: 0.5 },
              y: { scale: 'percentScale', field: '_cumulativePercent' },
              size: { value: 60 },
              fill: { value: lineColor },
              stroke: { value: '#ffffff' },
              strokeWidth: { value: 2 }
            },
            update: {
              size: { value: 60 }
            },
            hover: {
              size: { value: 100 }
            }
          }
        });
      }

      // Cumulative percentage labels at each point with accessibility styling
      marks.push({
        type: 'text',
        from: { data: 'source' },
        encode: {
          enter: {
            x: { scale: 'xscale', field: resolvedCategoryField, band: 0.5 },
            y: { scale: 'percentScale', field: '_cumulativePercent' },
            dy: { value: -12 },
            text: { signal: "format(datum._cumulativePercent, '.0f') + '%'" },
            fill: { value: '#ffffff' },
            fontSize: { value: 12 },
            fontWeight: { value: 600 },
            align: { value: 'center' },
            stroke: { value: '#000000' },
            strokeWidth: { value: 0.3 }
          }
        }
      });
    }

    return {
      ...this.getBaseSpec(),
      data: [
        {
          name: 'source',
          values: processedData
        }
      ],
      scales: [
        {
          name: 'xscale',
          type: 'band',
          domain: orderedCategories,
          range: 'width',
          padding: 0.15
        },
        {
          name: 'yscale',
          type: 'linear',
          domain: { data: 'source', field: resolvedValueField },
          range: 'height',
          nice: true,
          zero: true
        },
        {
          name: 'percentScale',
          type: 'linear',
          domain: [0, 100],
          range: 'height',
          nice: true
        }
      ],
      axes: [
        {
          orient: 'bottom',
          scale: 'xscale',
          title: hasCompositeKey ? this.getXLabel(categoryField) + ' (Grouped)' : this.getXLabel(categoryField),
          labelAngle: -45,
          labelAlign: 'right',
          labelBaseline: 'top'
        },
        {
          orient: 'left',
          scale: 'yscale',
          title: this.getYLabel(valueField),
          grid: true
        },
        {
          orient: 'right',
          scale: 'percentScale',
          title: 'Cumulative %',
          format: '.0f',
          tickCount: 5,
          values: [0, 20, 40, 60, 80, 100]
        }
      ],
      marks
    };
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const { categoryField, valueField, show80Line = true, barColor = '#0ea5e9', lineColor = '#f97316' } = this.config;

    // Use actual aggregation config structure (NEW PATTERN)
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || categoryField;
    const metric = metrics[0];
    const metricField = metric?.field || valueField;
    const metricType = metric?.type || 'count';

    // Build aggregation - order by metric value descending for Pareto
    const orderBy = metricType !== 'count' ? { 'metric_0': 'desc' } : { '_count': 'desc' };
    const aggs = {
      primary: {
        terms: { 
          field: bucketField, 
          size: 20,
          order: orderBy
        },
        aggs: metricType !== 'count' ? {
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

    // For Kibana, we return a layered Vega-Lite spec (with container sizing)
    // Using shared x encoding at top level to avoid sort conflicts
    return {
      ...this.getKibanaVegaLiteBaseSpec(),
      data: {
        url: urlConfig,
        format: { property: 'aggregations.primary.buckets' }
      },
      transform: [
        { calculate: 'datum.key', as: 'category' },
        { calculate: 'datum.metric_0 ? datum.metric_0.value : datum.doc_count', as: 'value' },
        // First, calculate total before any sorting
        { joinaggregate: [{ op: 'sum', field: 'value', as: 'total' }] },
        // Sort by value descending and assign order number
        { window: [{ op: 'row_number', as: '_order' }], sort: [{ field: 'value', order: 'descending' }] },
        // Calculate cumulative sum following the sort order (ascending _order = descending value)
        { window: [{ op: 'sum', field: 'value', as: 'cumulative' }], sort: [{ field: '_order', order: 'ascending' }] },
        // Calculate cumulative percentage
        { calculate: '(datum.cumulative / datum.total) * 100', as: 'cumulative_percent' },
        { calculate: "format(datum.cumulative_percent, '.0f') + '%'", as: 'percent_label' }
      ],
      // Use quantitative x with order to avoid sort conflicts
      encoding: {
        x: {
          field: 'category',
          type: 'nominal',
          sort: null,
          axis: { 
            labelAngle: -45, 
            title: this.getXLabel(categoryField)
          }
        }
      },
      layer: [
        // Bars
        {
          mark: { type: 'bar', color: barColor, opacity: 0.8, cornerRadiusEnd: 4 },
          encoding: {
            y: {
              field: 'value',
              type: 'quantitative',
              axis: { title: this.getYLabel(valueField) }
            },
            order: { field: '_order' },
            tooltip: [
              { field: 'category', type: 'nominal', title: 'Category' },
              { field: 'value', type: 'quantitative', title: 'Value', format: ',.0f' },
              { field: 'cumulative_percent', type: 'quantitative', title: 'Cumulative %', format: '.1f' }
            ]
          }
        },
        // Cumulative line
        {
          mark: { type: 'line', color: lineColor, strokeWidth: 2.5, point: { color: lineColor, size: 60 } },
          encoding: {
            y: {
              field: 'cumulative_percent',
              type: 'quantitative',
              axis: { title: 'Cumulative %', orient: 'right' },
              scale: { domain: [0, 100] }
            },
            order: { field: '_order' }
          }
        },
        // Cumulative percentage labels at each point
        {
          mark: { 
            type: 'text', 
            dy: -12,
            fontSize: 11,
            fontWeight: 600,
            color: '#ffffff'
          },
          encoding: {
            y: {
              field: 'cumulative_percent',
              type: 'quantitative',
              scale: { domain: [0, 100] }
            },
            text: { field: 'percent_label', type: 'nominal' },
            order: { field: '_order' }
          }
        },
        // 80% reference line - calculate ref_80 field in data, filter to first row only
        ...(show80Line ? [
          {
            transform: [
              { filter: 'datum._order === 1' },
              { calculate: '80', as: 'ref_80' }
            ],
            mark: { type: 'rule', color: '#ef4444', strokeDash: [6, 4], strokeWidth: 1.5 },
            encoding: {
              y: { field: 'ref_80', type: 'quantitative', scale: { domain: [0, 100] } },
              x: null,
              x2: null
            }
          },
          // 80% label text
          {
            transform: [
              { filter: 'datum._order === 1' },
              { calculate: '80', as: 'ref_80' }
            ],
            mark: {
              type: 'text',
              align: 'right',
              baseline: 'bottom',
              dx: -5,
              dy: -3,
              fontSize: 11,
              fontWeight: 600,
              color: '#ef4444'
            },
            encoding: {
              y: { field: 'ref_80', type: 'quantitative', scale: { domain: [0, 100] } },
              x: null,
              text: { value: '80%' }
            }
          }
        ] : [])
      ],
      resolve: {
        scale: { y: 'independent' }
      },
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default ParetoGenerator;

