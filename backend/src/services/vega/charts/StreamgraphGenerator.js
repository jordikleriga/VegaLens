/**
 * Streamgraph Generator
 * Generates Vega-Lite specs for streamgraph visualizations
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class StreamgraphGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'streamgraph',
    name: 'Streamgraph',
    description: 'Stacked area chart with flowing organic shape',
    category: 'trend',
    icon: 'waves'
  };

  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true, fieldTypes: ['date', 'number', 'keyword'] },
      { name: 'yField', label: 'Y-Axis', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'colorField', label: 'Category', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['stacked', 'faceted'], default: 'stacked', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'interpolate', label: 'Curve Style', type: 'select', options: ['cardinal', 'basis', 'catmull-rom', 'monotone', 'natural'], default: 'cardinal' },
      { name: 'offset', label: 'Stream Layout', type: 'select', options: ['center', 'silhouette', 'wiggle', 'zero', 'normalize'], default: 'center' },
      { name: 'fillOpacity', label: 'Fill Opacity', type: 'number', min: 0.3, max: 1, step: 0.1, default: 0.8 },
      { name: 'showLegend', label: 'Show Legend', type: 'boolean', default: true },
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', default: true }
    ]
  };

  static example = {
    config: {
      xField: 'year',
      yField: 'value',
      colorField: 'genre',
      title: 'Music Trends'
    },
    data: [
      { year: 2018, genre: 'Pop', value: 45 },
      { year: 2018, genre: 'Rock', value: 30 },
      { year: 2018, genre: 'Hip-Hop', value: 25 },
      { year: 2019, genre: 'Pop', value: 48 },
      { year: 2019, genre: 'Rock', value: 25 },
      { year: 2019, genre: 'Hip-Hop', value: 35 },
      { year: 2020, genre: 'Pop', value: 50 },
      { year: 2020, genre: 'Rock', value: 22 },
      { year: 2020, genre: 'Hip-Hop', value: 40 }
    ]
  };

  generate(data) {
    const { 
      xField, yField, colorField,
      interpolate = 'cardinal', offset = 'center',
      fillOpacity = 0.8, showLegend = true, showGrid = true
    } = this.config;
    
    logger.debug('Generating streamgraph spec', {
      event: 'streamgraph_generate',
      xField,
      yField,
      colorField
    });

    const resolvedXField = this.resolveFieldPath(xField, data);
    const resolvedYField = this.resolveFieldPath(yField, data);
    const resolvedColorField = this.resolveFieldPath(colorField, data);

    // Check if data has actual date values (ISO strings or Date objects)
    const isTemporal = this.isTemporalField(data, resolvedXField);
    
    // Get unique categories and x-values
    const categories = [...new Set((data || []).map(d => d[resolvedColorField]))].filter(Boolean);
    const xValues = [...new Set((data || []).map(d => d[resolvedXField]))];
    
    // Sort x-values (try as dates first, then as strings)
    xValues.sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return dateA - dateB;
      }
      return String(a).localeCompare(String(b));
    });
    
    // Create ordered index for x-values (for proper area interpolation)
    const xIndex = {};
    xValues.forEach((v, i) => xIndex[v] = i);
    
    // Add numeric index to data and ensure all category/x combinations exist
    const dataMap = {};
    (data || []).forEach(d => {
      const key = `${d[resolvedXField]}_${d[resolvedColorField]}`;
      dataMap[key] = d;
    });
    
    // Build complete dataset with index and fill missing values with 0
    const processedData = [];
    xValues.forEach((xVal, xIdx) => {
      categories.forEach(cat => {
        const key = `${xVal}_${cat}`;
        const existing = dataMap[key];
        processedData.push({
          ...existing,
          [resolvedXField]: xVal,
          [resolvedColorField]: cat,
          [resolvedYField]: existing ? (existing[resolvedYField] || 0) : 0,
          _xIndex: xIdx
        });
      });
    });

    const colorScheme = this.config.colorScheme || this.colorConfig.scheme || 'tableau20';

    // Map offset names to Vega-Lite stack offsets
    let stackOffset = offset;
    if (offset === 'silhouette' || offset === 'wiggle') {
      stackOffset = 'center';
    }

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Streamgraph',
      title: this.config.title || '',
      width: this.config.width || 600,
      height: this.config.height || 400,
      data: { values: processedData },
      mark: {
        type: 'area',
        interpolate: interpolate,
        tooltip: true,
        opacity: fillOpacity,
        line: false
      },
      encoding: {
        x: {
          field: '_xIndex',
          type: 'quantitative',
          scale: { domain: [0, xValues.length - 1] },
          axis: {
            title: this.getXLabel(xField),
            domain: false,
            ticks: true,
            grid: showGrid,
            gridColor: '#475569',
            gridOpacity: 0.3,
            labelAngle: -45,
            values: xValues.map((_, i) => i),
            labelExpr: `${JSON.stringify(xValues)}[datum.value] || ''`
          }
        },
        y: {
          field: resolvedYField,
          type: 'quantitative',
          stack: stackOffset,
          axis: {
            title: this.getYLabel(yField),
            grid: showGrid,
            gridColor: '#475569',
            gridOpacity: 0.3,
            format: ','
          }
        },
        color: {
          field: resolvedColorField,
          type: 'nominal',
          scale: { scheme: colorScheme },
          legend: showLegend ? {
            title: this.getLegendLabel(colorField),
            orient: 'right'
          } : null
        },
        order: {
          field: resolvedColorField,
          sort: 'ascending'
        },
        tooltip: [
          { field: resolvedXField, type: 'nominal', title: this.getXLabel(xField) },
          { field: resolvedColorField, type: 'nominal', title: 'Series' },
          { field: resolvedYField, type: 'quantitative', title: this.getYLabel(yField), format: ',' }
        ]
      },
      config: {
        view: { stroke: null },
        area: { 
          fillOpacity: this.getOpacity() || 0.8,
          stroke: null,
          strokeWidth: 0
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
      xField, yField, colorField,
      interpolate = 'cardinal', offset = 'center',
      fillOpacity = 0.8, showLegend = true, showGrid = true
    } = this.config;

    // Use actual aggregation config structure
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const splitBy = aggregation?.splitBy;
    const metrics = aggregation?.metrics || [];

    const bucketField = bucketAgg?.field || xField;
    const bucketType = bucketAgg?.type || 'date_histogram';
    const bucketOptions = bucketAgg?.options || {};

    const splitField = splitBy?.field || colorField;
    const splitOptions = splitBy?.options || { size: 10 };

    const metric = metrics[0];
    const metricType = metric?.type || 'count';
    const metricField = metric?.field || yField;

    // Build bucket aggregation options
    let bucketAggConfig;
    if (bucketType === 'date_histogram') {
      bucketAggConfig = {
        field: bucketField,
        calendar_interval: bucketOptions.calendarInterval || bucketOptions.interval || 'day',
        ...(bucketOptions.timeZone && { time_zone: bucketOptions.timeZone }),
        min_doc_count: 0
      };
    } else if (bucketType === 'histogram') {
      bucketAggConfig = {
        field: bucketField,
        interval: bucketOptions.interval || 1,
        min_doc_count: 0
      };
    } else {
      // terms or other
      bucketAggConfig = {
        field: bucketField,
        size: bucketOptions.size || 50,
        ...(bucketOptions.orderBy && { order: { [bucketOptions.orderBy]: bucketOptions.orderDirection || 'desc' } })
      };
    }

    // Build aggregation structure
    const aggs = {
      primary: {
        [bucketType]: bucketAggConfig,
        aggs: {}
      }
    };

    // Add split-by (series) aggregation
    if (splitField) {
      aggs.primary.aggs.split = {
        terms: {
          field: splitField,
          size: splitOptions.size || 10
        },
        aggs: {}
      };

      // Add metric to split aggregation
      if (metricType !== 'count' && metricField) {
        aggs.primary.aggs.split.aggs.metric_value = {
          [metricType]: { field: metricField }
        };
      }
    }

    const urlConfig = {
      index: idx,
      body: {
        size: 0,
        ...(query && Object.keys(query).length > 0 ? { query } : {}),
        aggs
      }
    };

    if (useContext || bucketType === 'date_histogram') {
      urlConfig['%context%'] = true;
      urlConfig['%timefield%'] = timeField;
    }

    // Map offset to Vega-Lite stack value
    let stackOffset = offset;
    if (offset === 'silhouette' || offset === 'wiggle') {
      stackOffset = 'center';
    }

    const colorScheme = this.config.colorScheme || 'tableau20';

    // Determine X-axis type
    const xType = bucketType === 'date_histogram' ? 'temporal' :
                  bucketType === 'histogram' ? 'quantitative' : 'ordinal';

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Streamgraph',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.primary.buckets' }
      },
      transform: [
        // Flatten the nested split buckets (matches AreaChartGenerator pattern)
        { flatten: ['split.buckets'], as: ['series'] },
        // Extract x-axis value (date or key)
        { calculate: 'datum.key_as_string || datum.key', as: 'xValue' },
        // Extract category from the flattened series
        { calculate: 'datum.series.key', as: 'category' },
        // Extract metric value - handle both count and explicit metrics
        {
          calculate: metricType !== 'count'
            ? 'datum.series.metric_value ? datum.series.metric_value.value : 0'
            : 'datum.series.doc_count || 0',
          as: 'value'
        }
      ],
      mark: {
        type: 'area',
        interpolate: interpolate,
        tooltip: true,
        opacity: fillOpacity,
        line: false
      },
      encoding: {
        x: {
          field: 'xValue',
          type: xType,
          axis: {
            title: this.getXLabel(xField),
            grid: showGrid,
            gridColor: '#475569',
            gridOpacity: 0.3,
            labelAngle: -45
          }
        },
        y: {
          field: 'value',
          type: 'quantitative',
          stack: stackOffset,
          axis: {
            title: this.getYLabel(yField),
            grid: showGrid,
            gridColor: '#475569',
            gridOpacity: 0.3,
            format: ','
          }
        },
        color: {
          field: 'category',
          type: 'nominal',
          scale: { scheme: colorScheme },
          legend: showLegend ? {
            title: this.getLegendLabel(colorField),
            orient: 'right'
          } : null
        },
        order: {
          field: 'category',
          sort: 'ascending'
        },
        tooltip: [
          { field: 'xValue', type: xType, title: this.getXLabel(xField) },
          { field: 'category', type: 'nominal', title: this.getLegendLabel(colorField) },
          { field: 'value', type: 'quantitative', title: this.getYLabel(yField), format: ',' }
        ]
      },
      config: {
        view: { stroke: null },
        area: {
          fillOpacity: fillOpacity,
          stroke: null,
          strokeWidth: 0
        },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default StreamgraphGenerator;

