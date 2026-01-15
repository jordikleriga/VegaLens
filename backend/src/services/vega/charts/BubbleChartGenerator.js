/**
 * Bubble Chart Generator
 * Generates Vega-Lite specs for bubble plots (Gapminder style)
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class BubbleChartGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'bubble',
    name: 'Bubble Chart',
    description: 'Scatter plot with variable point sizes for third dimension',
    category: 'relationship',
    icon: 'circle'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'yField', label: 'Y-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'sizeField', label: 'Size', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'colorField', label: 'Color By', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'labelField', label: 'Label', type: 'field', required: false, fieldTypes: ['keyword', 'text'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['color', 'shape', 'faceted'], default: 'color', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'minSize', label: 'Min Bubble Size', type: 'number', min: 10, max: 100, default: 20 },
      { name: 'maxSize', label: 'Max Bubble Size', type: 'number', min: 100, max: 2000, default: 500 },
      { name: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.1, default: 0.7 },
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', default: true },
      { name: 'xAxisZero', label: 'X-Axis Start at Zero', type: 'boolean', default: false },
      { name: 'yAxisZero', label: 'Y-Axis Start at Zero', type: 'boolean', default: false }
    ]
  };

  static example = {
    config: {
      xField: 'gdp',
      yField: 'lifeExpectancy',
      sizeField: 'population',
      colorField: 'region',
      title: 'GDP vs Life Expectancy'
    },
    data: [
      { country: 'USA', gdp: 63000, lifeExpectancy: 78, population: 330, region: 'Americas' },
      { country: 'Germany', gdp: 46000, lifeExpectancy: 81, population: 83, region: 'Europe' },
      { country: 'Japan', gdp: 40000, lifeExpectancy: 84, population: 126, region: 'Asia' },
      { country: 'Brazil', gdp: 8900, lifeExpectancy: 76, population: 212, region: 'Americas' },
      { country: 'India', gdp: 2100, lifeExpectancy: 70, population: 1380, region: 'Asia' }
    ]
  };

  generate(data) {
    const {
      xField, yField, sizeField, colorField, labelField,
      minSize = 20, maxSize = 500, opacity,
      showGrid = true, xAxisZero = false, yAxisZero = false,
      xScaleType = 'linear', yScaleType = 'linear'
    } = this.config;

    logger.info('BubbleChart.generate() called', {
      event: 'bubble_chart_generate_start',
      xField,
      yField,
      sizeField,
      colorField,
      dataLength: data?.length || 0,
      sampleKeys: data?.[0] ? Object.keys(data[0]).slice(0, 10) : []
    });

    // Pre-process data to handle nested/array fields from raw ES documents
    // e.g., products.base_price where products is an array of objects
    const fieldsToFlatten = [xField, yField, sizeField, colorField, labelField].filter(Boolean);
    const processedData = this.flattenNestedFields(data, fieldsToFlatten);

    logger.info('BubbleChart data after flattening', {
      event: 'bubble_chart_flattened',
      originalLength: data?.length || 0,
      processedLength: processedData?.length || 0,
      sampleKeys: processedData?.[0] ? Object.keys(processedData[0]).slice(0, 15) : [],
      fieldsToFlatten
    });

    // Resolve field paths to actual data keys (after flattening)
    const resolvedXField = this.resolveFieldPath(xField, processedData);
    const resolvedYField = this.resolveFieldPath(yField, processedData);
    const resolvedSizeField = this.resolveFieldPath(sizeField, processedData);
    const resolvedColorField = colorField ? this.resolveFieldPath(colorField, processedData) : null;
    const resolvedLabelField = labelField ? this.resolveFieldPath(labelField, processedData) : null;

    logger.info('BubbleChart resolved fields', {
      event: 'bubble_chart_resolved',
      xField: `${xField} -> ${resolvedXField}`,
      yField: `${yField} -> ${resolvedYField}`,
      sizeField: `${sizeField} -> ${resolvedSizeField}`,
      sampleXValue: processedData?.[0]?.[resolvedXField],
      sampleYValue: processedData?.[0]?.[resolvedYField],
      sampleSizeValue: processedData?.[0]?.[resolvedSizeField]
    });

    const fillOpacity = opacity ?? 0.7;

    // Vega-Lite interprets dots in field names as nested path access.
    // If field names contain dots (common with flattened ES fields like "products.base_price"),
    // we need to escape dots with backslashes: "products.base_price" -> "products\\.base_price"
    // This tells Vega-Lite to treat dots as literal characters, not path separators.
    const escapeFieldName = (field) => {
      if (!field) return field;
      // If field contains dots and data has it as a literal key, escape the dots
      if (field.includes('.') && processedData?.[0]?.[field] !== undefined) {
        return field.replace(/\./g, '\\.');
      }
      return field;
    };

    const escapedXField = escapeFieldName(resolvedXField);
    const escapedYField = escapeFieldName(resolvedYField);
    const escapedSizeField = escapeFieldName(resolvedSizeField);
    const escapedColorField = resolvedColorField ? escapeFieldName(resolvedColorField) : null;
    const escapedLabelField = resolvedLabelField ? escapeFieldName(resolvedLabelField) : null;

    logger.info('BubbleChart escaped fields for Vega-Lite', {
      event: 'bubble_chart_escaped',
      escapedXField,
      escapedYField,
      escapedSizeField
    });

    // Use Vega-Lite for bubble charts as it handles sizing better
    return {
      ...this.getVegaLiteBaseSpec(),
      data: { values: processedData || [] },
      mark: 'circle',
      encoding: {
        x: {
          field: escapedXField,
          type: 'quantitative',
          scale: {
            type: xScaleType,
            zero: xAxisZero
          },
          axis: { grid: showGrid, title: this.getXLabel(xField) }
        },
        y: {
          field: escapedYField,
          type: 'quantitative',
          scale: {
            type: yScaleType,
            zero: yAxisZero
          },
          axis: { grid: showGrid, title: this.getYLabel(yField) }
        },
        size: {
          field: escapedSizeField,
          type: 'quantitative',
          scale: { range: [minSize, maxSize] },
          legend: { title: sizeField }
        },
        ...(fillOpacity !== 1 ? {
          opacity: { value: fillOpacity }
        } : {}),
        ...(escapedColorField ? {
          color: {
            field: escapedColorField,
            type: 'nominal',
            legend: { title: this.getLegendLabel(colorField) }
          }
        } : {}),
        ...(escapedLabelField ? {
          tooltip: [
            { field: escapedLabelField, type: 'nominal' },
            { field: escapedXField, type: 'quantitative' },
            { field: escapedYField, type: 'quantitative' },
            { field: escapedSizeField, type: 'quantitative' }
          ]
        } : {})
      }
    };
  }

  /**
   * Flatten nested/array fields from raw ES documents
   * Handles cases like products.base_price where products is an array
   * For numeric fields in arrays, computes the sum
   * Also handles top-level array fields like taxful_total_price
   */
  flattenNestedFields(data, fields) {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return data;
    }

    const sample = data[0];

    // Log available fields for debugging
    logger.info('BubbleChart flattenNestedFields - analyzing sample', {
      event: 'bubble_flatten_analyze',
      sampleKeys: Object.keys(sample).slice(0, 25),
      requestedFields: fields,
      productsType: sample.products ? (Array.isArray(sample.products) ? 'array' : typeof sample.products) : 'undefined',
      productsLength: Array.isArray(sample.products) ? sample.products.length : 0
    });

    // Process ALL requested fields - always create flattened versions
    return data.map((record, idx) => {
      const flattened = { ...record };

      for (const field of fields) {
        if (!field) continue;

        // Handle nested fields (e.g., products.base_price)
        if (field.includes('.')) {
          const parts = field.split('.');
          const firstPart = parts[0];
          const parent = record[firstPart];

          // Parent is an array (e.g., products is array of objects)
          if (Array.isArray(parent) && parent.length > 0) {
            const values = parent.map(item => {
              let value = item;
              for (const part of parts.slice(1)) {
                value = value?.[part];
              }
              return value;
            }).filter(v => v !== undefined && v !== null && (typeof v === 'number' ? !isNaN(v) : true));

            if (values.length > 0) {
              const sanitizedField = field.replace(/\./g, '_');
              if (typeof values[0] === 'number') {
                // Sum numeric values from nested arrays
                flattened[sanitizedField] = values.reduce((sum, v) => sum + (v || 0), 0);
              } else {
                flattened[sanitizedField] = values[0];
              }

              if (idx === 0) {
                logger.info('BubbleChart flattened nested array field', {
                  event: 'bubble_flatten_nested',
                  originalField: field,
                  sanitizedField,
                  extractedValues: values.slice(0, 3),
                  resultValue: flattened[sanitizedField]
                });
              }
            }
          }
          // Parent is a plain object (e.g., geoip.location)
          else if (parent && typeof parent === 'object' && !Array.isArray(parent)) {
            let value = parent;
            for (const part of parts.slice(1)) {
              value = value?.[part];
            }
            if (value !== undefined && value !== null) {
              const sanitizedField = field.replace(/\./g, '_');
              flattened[sanitizedField] = value;
            }
          }
        }
        // Handle top-level array fields (e.g., if a field itself is an array of numbers)
        else if (Array.isArray(record[field])) {
          const arr = record[field];
          if (arr.length > 0) {
            if (typeof arr[0] === 'number') {
              flattened[field] = arr.reduce((sum, v) => sum + (v || 0), 0);
            } else {
              flattened[field] = arr[0];
            }
          }
        }
        // Field doesn't exist or is a special field - skip
        else if (!(field in record)) {
          // Special fields like _count don't exist in raw data
          if (idx === 0 && !field.startsWith('_')) {
            logger.warn('BubbleChart field not found in record', {
              event: 'bubble_field_missing',
              field,
              availableKeys: Object.keys(record).slice(0, 20)
            });
          }
        }
      }

      return flattened;
    });
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   *
   * Bubble charts aggregate data by a bucket field (e.g., category) and compute
   * metric aggregations for x, y, and size dimensions.
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      xField, yField, sizeField, colorField, labelField,
      minSize = 20, maxSize = 500, opacity = 0.7, showGrid = true,
      xAxisZero = false, yAxisZero = false
    } = this.config;

    // Get bucket field - required for grouping data points
    const bucketField = aggregation?.bucketAgg?.field || labelField || colorField;

    if (!bucketField) {
      logger.warn('BubbleChart requires a bucket field for grouping', {
        event: 'bubble_missing_bucket'
      });
    }

    // Use actual aggregation config structure (NEW PATTERN)
    const metrics = aggregation?.metrics || [];
    const defaultMetricType = 'avg';

    // Map field names to their metric types
    const getMetricType = (field) => {
      const metric = metrics.find(m => m.field === field);
      return metric?.type || defaultMetricType;
    };

    const xMetricType = getMetricType(xField);
    const yMetricType = getMetricType(yField);
    const sizeMetricType = getMetricType(sizeField);

    // Check if size field is in metrics - if not, we'll use _count instead
    const sizeFieldInMetrics = metrics.some(m => m.field === sizeField);

    // Build aggregation with metric sub-aggregations for x, y, and size
    const aggs = {
      bubbles: {
        terms: {
          field: bucketField,
          size: aggregation?.bucketAgg?.options?.size || 50
        },
        aggs: {
          x_metric: { [xMetricType]: { field: xField } },
          y_metric: { [yMetricType]: { field: yField } },
          ...(sizeFieldInMetrics ? {
            size_metric: { [sizeMetricType]: { field: sizeField } }
          } : {})
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

    const colorScheme = this.config.colorScheme || 'tableau10';

    // Transform aggregation buckets to chart data
    // Create descriptive field names: {metricType}_{fieldName}
    const xTransformField = `${xMetricType}_${xField}`;
    const yTransformField = `${yMetricType}_${yField}`;
    const sizeTransformField = sizeFieldInMetrics ? `${sizeMetricType}_${sizeField}` : '_count';

    const transforms = [
      { calculate: 'datum.key', as: bucketField },
      { calculate: 'datum.doc_count', as: '_count' },
      { calculate: 'datum.x_metric.value', as: xTransformField },
      { calculate: 'datum.y_metric.value', as: yTransformField },
      ...(sizeFieldInMetrics ? [
        { calculate: 'datum.size_metric.value', as: sizeTransformField }
      ] : []),
      // Filter out buckets with null/undefined metrics
      { filter: `isValid(datum["${xTransformField}"]) && isValid(datum["${yTransformField}"]) && isValid(datum["${sizeTransformField}"])` }
    ];

    const encoding = {
      x: {
        field: xTransformField,
        type: 'quantitative',
        scale: { type: 'linear', zero: xAxisZero },
        axis: { title: this.getXLabel(xField), grid: showGrid }
      },
      y: {
        field: yTransformField,
        type: 'quantitative',
        scale: { type: 'linear', zero: yAxisZero },
        axis: { title: this.getYLabel(yField), grid: showGrid, minExtent: 30 }
      },
      size: {
        field: sizeTransformField,
        type: 'quantitative',
        scale: { range: [minSize, maxSize] },
        legend: { title: this.getLegendLabel(sizeField) }
      },
      color: {
        field: bucketField,
        type: 'nominal',
        scale: { scheme: colorScheme },
        legend: { title: this.getLegendLabel(bucketField) }
      },
      opacity: {
        value: opacity
      },
      tooltip: [
        { field: bucketField, type: 'nominal', title: bucketField },
        { field: xTransformField, type: 'quantitative', title: `${xMetricType}(${xField})`, format: ',.2f' },
        { field: yTransformField, type: 'quantitative', title: `${yMetricType}(${yField})`, format: ',.2f' },
        { field: sizeTransformField, type: 'quantitative', title: `${sizeMetricType}(${sizeField})`, format: ',.2f' }
      ]
    };

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Bubble Chart',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.bubbles.buckets' }
      },
      transform: transforms,
      mark: {
        type: 'circle',
        opacity: opacity
      },
      encoding,
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig(),
        legend: { orient: 'right', labelColor: '#000000', titleColor: '#000000' }
      },
      params: [
        {
          name: 'view',
          select: 'interval',
          bind: 'scales'
        }
      ]
    };
  }
}

export default BubbleChartGenerator;

