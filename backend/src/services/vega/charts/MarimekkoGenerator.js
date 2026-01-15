/**
 * Marimekko Chart Generator
 * Generates Vega-Lite specs for Marimekko (mosaic) charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class MarimekkoGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'marimekko',
    name: 'Marimekko Chart',
    description: 'Mosaic chart with variable width and stacked proportions',
    category: 'composition',
    icon: 'layout-grid'
  };

  static schema = {
    fields: [
      // Data fields
      { name: 'xField', label: 'X-Axis (Width)', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'yField', label: 'Y-Axis (Value)', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'colorField', label: 'Color/Stack By', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'widthField', label: 'Width By', type: 'field', required: false, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['nested', 'faceted'], default: 'nested', advanced: true, description: 'How to display multi-level bucket data' },
      
      // Display options
      { name: 'showLabels', label: 'Show Category Labels', type: 'boolean', default: true },
      { name: 'showLegend', label: 'Show Legend', type: 'boolean', default: true },
      { name: 'legendOrient', label: 'Legend Position', type: 'select', options: ['right', 'left', 'top', 'bottom'], default: 'right' },
      
      // Bar styling
      { name: 'strokeColor', label: 'Border Color', type: 'color', default: '#ffffff', description: 'Color of borders between segments' },
      { name: 'strokeWidth', label: 'Border Width', type: 'number', min: 0, max: 5, step: 0.5, default: 1 },
      { name: 'cornerRadius', label: 'Corner Radius', type: 'number', min: 0, max: 10, step: 1, default: 0 },
      { name: 'opacity', label: 'Opacity', type: 'number', min: 0.1, max: 1, step: 0.1, default: 0.9 },
      
      // Axis options
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', default: false },
      { name: 'yAxisFormat', label: 'Y-Axis Format', type: 'select', options: ['percent', 'number'], default: 'percent', description: 'Display as percentage or raw values' },
      { name: 'labelFontSize', label: 'Label Font Size', type: 'number', min: 8, max: 18, default: 11 },
      { name: 'labelAngle', label: 'Label Angle', type: 'number', min: -90, max: 0, default: -45 },
      
      // Sorting
      { name: 'sortOrder', label: 'Sort Order', type: 'select', options: ['descending', 'ascending', 'none'], default: 'descending', description: 'How to sort categories by total value' }
    ]
  };

  static example = {
    config: {
      xField: 'region',
      yField: 'sales',
      colorField: 'product',
      title: 'Market Composition'
    },
    data: [
      { region: 'North', product: 'A', sales: 1200 },
      { region: 'North', product: 'B', sales: 800 },
      { region: 'North', product: 'C', sales: 500 },
      { region: 'South', product: 'A', sales: 900 },
      { region: 'South', product: 'B', sales: 1100 },
      { region: 'South', product: 'C', sales: 400 },
      { region: 'East', product: 'A', sales: 1500 },
      { region: 'East', product: 'B', sales: 600 },
      { region: 'East', product: 'C', sales: 800 }
    ]
  };

  generate(data) {
    const {
      xField, yField, colorField, widthField,
      showLabels = true, showLegend = true, legendOrient = 'right',
      strokeColor = '#ffffff', strokeWidth = 1, cornerRadius = 0,
      opacity = 0.9, showGrid = false, yAxisFormat = 'percent',
      labelFontSize = 11, labelAngle = -45, sortOrder = 'descending'
    } = this.config;

    logger.debug('Generating marimekko chart spec', {
      event: 'marimekko_generate',
      xField,
      yField,
      colorField
    });

    const resolvedXField = this.resolveFieldPath(xField, data);
    const resolvedYField = this.resolveFieldPath(yField, data);
    const resolvedColorField = this.resolveFieldPath(colorField, data);
    const resolvedWidthField = widthField ? this.resolveFieldPath(widthField, data) : null;

    const colorScheme = this.colorConfig.scheme || 'category10';
    const width = this.config.width || 600;
    const height = this.config.height || 400;

    // Get unique X categories
    let xCategories = [...new Set((data || []).map(d => d[resolvedXField]))];
    
    // Sort categories if requested
    if (sortOrder !== 'none') {
      // Calculate totals for sorting
      const catTotals = {};
      xCategories.forEach(cat => {
        const catData = (data || []).filter(d => d[resolvedXField] === cat);
        catTotals[cat] = catData.reduce((sum, d) => sum + (d[resolvedYField] || 0), 0);
      });
      
      xCategories.sort((a, b) => {
        if (sortOrder === 'descending') {
          return catTotals[b] - catTotals[a];
        } else {
          return catTotals[a] - catTotals[b];
        }
      });
    }

    // Calculate width proportions
    const categoryTotals = {};
    xCategories.forEach(cat => {
      const catData = (data || []).filter(d => d[resolvedXField] === cat);
      categoryTotals[cat] = catData.reduce((sum, d) => {
        return sum + (resolvedWidthField ? (d[resolvedWidthField] || 0) : (d[resolvedYField] || 0));
      }, 0);
    });

    const grandTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0) || 1;

    // Calculate cumulative positions
    const categoryWidths = {};
    let cumX = 0;
    xCategories.forEach(cat => {
      const proportion = categoryTotals[cat] / grandTotal;
      categoryWidths[cat] = { x0: cumX, x1: cumX + proportion, width: proportion };
      cumX += proportion;
    });

    // Get unique color categories
    const colorCategories = [...new Set((data || []).map(d => d[resolvedColorField]))];

    // Build Marimekko data
    const marimekkoData = [];
    xCategories.forEach(xCat => {
      const catData = (data || []).filter(d => d[resolvedXField] === xCat);
      const yTotal = catData.reduce((sum, d) => sum + (d[resolvedYField] || 0), 0) || 1;

      let cumY = 0;
      colorCategories.forEach(colorCat => {
        const matchingRecords = catData.filter(d => d[resolvedColorField] === colorCat);
        const yValue = matchingRecords.reduce((sum, d) => sum + (d[resolvedYField] || 0), 0);
        const yProportion = yValue / yTotal;

        if (yValue > 0) {
          marimekkoData.push({
            [resolvedXField]: xCat,
            [resolvedColorField]: colorCat,
            [resolvedYField]: yValue,
            _x0: categoryWidths[xCat].x0 * width,
            _x1: categoryWidths[xCat].x1 * width,
            _y0: cumY,
            _y1: cumY + yProportion,
            _centerX: (categoryWidths[xCat].x0 + categoryWidths[xCat].x1) / 2 * width,
            _centerY: (cumY + cumY + yProportion) / 2
          });
          cumY += yProportion;
        }
      });
    });

    // Y-axis configuration based on format option
    const yAxisConfig = {
      title: yAxisFormat === 'percent' ? 'Proportion' : this.getYLabel(yField),
      format: yAxisFormat === 'percent' ? '.0%' : ',.0f',
      grid: showGrid,
      gridColor: showGrid ? '#475569' : undefined,
      gridOpacity: showGrid ? 0.3 : undefined
    };

    const layers = [
      // Main bars
      {
        mark: { 
          type: 'rect', 
          stroke: strokeColor, 
          strokeWidth: strokeWidth,
          cornerRadius: cornerRadius,
          tooltip: true 
        },
        encoding: {
          x: { field: '_x0', type: 'quantitative', axis: null, scale: { domain: [0, width] } },
          x2: { field: '_x1' },
          y: { field: '_y0', type: 'quantitative', axis: yAxisConfig, scale: { domain: [0, 1] } },
          y2: { field: '_y1' },
          color: {
            field: resolvedColorField,
            type: 'nominal',
            scale: { scheme: colorScheme },
            legend: showLegend ? { title: this.getLegendLabel(colorField), orient: legendOrient } : null
          },
          opacity: { value: opacity },
          tooltip: [
            { field: resolvedXField, type: 'nominal', title: xField },
            { field: resolvedColorField, type: 'nominal', title: colorField },
            { field: resolvedYField, type: 'quantitative', title: yField, format: ',.0f' }
          ]
        }
      }
    ];

    // X-axis labels at bottom
    if (showLabels) {
      const labelData = xCategories.map(cat => ({
        label: cat,
        x: (categoryWidths[cat].x0 + categoryWidths[cat].x1) / 2 * width
      }));

      layers.push({
        data: { values: labelData },
        mark: { 
          type: 'text', 
          baseline: 'top', 
          dy: 5, 
          fontSize: labelFontSize,
          angle: labelAngle
        },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null },
          y: { value: height },
          text: { field: 'label', type: 'nominal' },
          color: { value: '#000000' }
        }
      });
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Marimekko Chart',
      title: this.config.title || '',
      width: width,
      height: height,
      data: { values: marimekkoData },
      layer: layers,
      config: {
        view: { stroke: null },
        background: 'transparent'
      }
    };
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   * True Marimekko with variable bar widths using rect marks with x/x2 positioning
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      xField, yField, colorField,
      showLabels = true, showLegend = true, legendOrient = 'right',
      strokeColor = '#ffffff', strokeWidth = 1, cornerRadius = 0,
      opacity = 0.9, showGrid = false, yAxisFormat = 'percent',
      labelFontSize = 11, labelAngle = -45, sortOrder = 'descending'
    } = this.config;

    // Get original ES field names from aggregation config
    const bucketAggs = aggregation?.bucketAggs || [];
    const primaryBucket = bucketAggs[0] || aggregation?.bucketAgg;
    const splitBy = aggregation?.splitBy;

    const xBucketField = primaryBucket?.field || xField;
    const colorBucketField = splitBy?.field || colorField;

    // Use actual aggregation config structure
    const metrics = aggregation?.metrics || [];
    const primaryMetric = metrics[0];
    const metricType = primaryMetric?.type || 'count';
    const metricField = primaryMetric?.field || yField;

    // Build nested aggregation: category -> color segment -> metric
    const innerAggs = metricType !== 'count' && metricField ? {
      metric_value: { [metricType]: { field: metricField } }
    } : {};

    const aggs = {
      xbucket: {
        terms: { field: xBucketField, size: 20 },
        aggs: {
          colorbucket: {
            terms: { field: colorBucketField, size: 10 },
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

    const colorScheme = this.colorConfig.scheme || 'category10';

    // Helper to clean up field names for display
    const cleanFieldName = (field) => {
      if (!field) return '';
      return field.replace(/\.keyword$/, '').replace(/_/g, ' ');
    };

    const xLabel = this.config.xLabel || cleanFieldName(xBucketField);
    const yLabel = metricType === 'count' ? 'Count' : `${metricType} of ${cleanFieldName(metricField)}`;
    const colorLabel = this.config.legendLabel || cleanFieldName(colorBucketField);

    // Transforms to build true Marimekko with variable bar widths using rect marks
    // Step 1: Flatten and extract basic values
    const transforms = [
      { flatten: ['colorbucket.buckets'], as: ['cb'] },
      { calculate: 'datum.key', as: 'category' },
      { calculate: 'datum.cb.key', as: 'segment' },
      { calculate: metricType !== 'count' && metricField ? 'datum.cb.metric_value.value' : 'datum.cb.doc_count', as: 'value' },

      // Step 2: Calculate category totals (for both width and y-stacking)
      {
        joinaggregate: [{ op: 'sum', field: 'value', as: 'categoryTotal' }],
        groupby: ['category']
      },

      // Step 3: Calculate grand total across all categories
      {
        joinaggregate: [{ op: 'sum', field: 'value', as: 'grandTotal' }]
      },

      // Step 4: Calculate width proportion for each category
      { calculate: 'datum.categoryTotal / datum.grandTotal', as: 'widthProportion' },

      // Step 5: Calculate cumulative x position for each category
      // First, get unique category totals and sort them
      {
        window: [
          { op: 'dense_rank', as: 'categoryRank' }
        ],
        sort: sortOrder === 'descending'
          ? [{ field: 'categoryTotal', order: 'descending' }, { field: 'category', order: 'ascending' }]
          : sortOrder === 'ascending'
            ? [{ field: 'categoryTotal', order: 'ascending' }, { field: 'category', order: 'ascending' }]
            : [{ field: 'category', order: 'ascending' }]
      },

      // Step 6: Calculate cumulative width based on category rank
      // Use window to sum widthProportion for categories with lower rank
      {
        joinaggregate: [
          { op: 'min', field: 'categoryRank', as: 'minRank' }
        ],
        groupby: ['category']
      },

      // Step 7: Calculate y positions within each category (stacked proportions)
      {
        window: [
          { op: 'sum', field: 'value', as: 'cumValue' }
        ],
        groupby: ['category'],
        sort: [{ field: 'segment', order: 'ascending' }]
      },
      { calculate: '(datum.cumValue - datum.value) / datum.categoryTotal', as: 'y0' },
      { calculate: 'datum.cumValue / datum.categoryTotal', as: 'y1' },

      // Step 8: Calculate x0 and x1 for rect marks
      // We need cumulative sum of widthProportion for all categories with lower rank
      {
        window: [
          { op: 'sum', field: 'widthProportion', as: 'cumWidth' }
        ],
        sort: sortOrder === 'descending'
          ? [{ field: 'categoryTotal', order: 'descending' }, { field: 'category', order: 'ascending' }]
          : sortOrder === 'ascending'
            ? [{ field: 'categoryTotal', order: 'ascending' }, { field: 'category', order: 'ascending' }]
            : [{ field: 'category', order: 'ascending' }],
        frame: [null, 0],
        groupby: ['segment']
      },

      // x1 is cumulative width, x0 is cumulative width minus current category's width
      { calculate: 'datum.cumWidth', as: 'x1' },
      { calculate: 'datum.cumWidth - datum.widthProportion', as: 'x0' }
    ];

    // Use layered spec with rect marks for true variable-width bars
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Marimekko Chart',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.xbucket.buckets' }
      },
      transform: transforms,
      mark: {
        type: 'rect',
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        cornerRadius: cornerRadius
      },
      encoding: {
        x: {
          field: 'x0',
          type: 'quantitative',
          scale: { domain: [0, 1] },
          axis: { title: xLabel, format: '.0%', grid: false }
        },
        x2: { field: 'x1' },
        y: {
          field: 'y0',
          type: 'quantitative',
          scale: { domain: [0, 1] },
          axis: { title: 'Proportion', format: '.0%', grid: showGrid }
        },
        y2: { field: 'y1' },
        color: {
          field: 'segment',
          type: 'nominal',
          scale: { scheme: colorScheme },
          legend: showLegend ? { title: colorLabel, orient: legendOrient } : null
        },
        opacity: { value: opacity },
        tooltip: [
          { field: 'category', type: 'nominal', title: xLabel },
          { field: 'segment', type: 'nominal', title: colorLabel },
          { field: 'value', type: 'quantitative', title: yLabel, format: ',.0f' },
          { field: 'widthProportion', type: 'quantitative', title: 'Width %', format: '.1%' }
        ]
      },
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default MarimekkoGenerator;

