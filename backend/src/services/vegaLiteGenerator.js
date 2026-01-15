/**
 * Vega-Lite v5 Specification Generator
 * Generates Vega-Lite specs compatible with Elasticsearch/Kibana
 * Reference: https://vega.github.io/schema/vega-lite/v5.json
 */

export class VegaLiteGenerator {
  constructor(config = {}) {
    this.config = {
      width: 'container',
      height: 400,
      title: '',
      description: '',
      ...config
    };
    
    // Color configuration (matches VegaSpecGenerator for consistency)
    this.colorConfig = config.colorConfig || {
      scheme: 'category10',
      singleColor: '#0ea5e9',
      opacity: 1,
      strokeColor: '#ffffff',
      strokeWidth: 1,
      useGradient: false,
      gradientStart: '#0ea5e9',
      gradientEnd: '#f97316',
      customColors: null
    };
  }
  
  // Get color scheme for encoding
  getColorScheme() {
    const { scheme, customColors } = this.colorConfig;
    if (customColors && customColors.length > 0) {
      return { range: customColors };
    }
    return { scheme: scheme || 'category10' };
  }
  
  // Get mark properties with color config applied
  getMarkProperties(markType = 'bar') {
    const { singleColor, opacity, strokeColor, strokeWidth, useGradient, gradientStart, gradientEnd } = this.colorConfig;
    
    const props = {
      opacity: opacity ?? 1,
      stroke: strokeColor || null,
      strokeWidth: strokeWidth || 0
    };
    
    // Apply fill color for marks that support it
    if (['bar', 'area', 'rect', 'arc', 'circle', 'square', 'point'].includes(markType)) {
      if (useGradient) {
        props.color = {
          gradient: 'linear',
          stops: [
            { offset: 0, color: gradientStart || '#0ea5e9' },
            { offset: 1, color: gradientEnd || '#f97316' }
          ]
        };
      } else {
        props.color = singleColor || '#0ea5e9';
      }
    }
    
    return props;
  }

  // Mark types from Vega-Lite v5 schema
  static getMarkTypes() {
    return [
      { id: 'bar', name: 'Bar', description: 'Bar chart for categorical comparisons', category: 'basic' },
      { id: 'line', name: 'Line', description: 'Line chart for trends over time', category: 'basic' },
      { id: 'area', name: 'Area', description: 'Area chart for cumulative values', category: 'basic' },
      { id: 'point', name: 'Point', description: 'Scatter plot for correlations', category: 'basic' },
      { id: 'circle', name: 'Circle', description: 'Circle marks for bubble charts', category: 'basic' },
      { id: 'square', name: 'Square', description: 'Square marks', category: 'basic' },
      { id: 'rect', name: 'Rectangle', description: 'Heatmaps and 2D histograms', category: 'basic' },
      { id: 'tick', name: 'Tick', description: 'Strip plot marks', category: 'basic' },
      { id: 'rule', name: 'Rule', description: 'Lines or reference marks', category: 'basic' },
      { id: 'text', name: 'Text', description: 'Text labels', category: 'basic' },
      { id: 'arc', name: 'Arc', description: 'Pie and donut charts', category: 'basic' },
      { id: 'boxplot', name: 'Box Plot', description: 'Statistical distribution', category: 'composite' },
      { id: 'errorband', name: 'Error Band', description: 'Uncertainty visualization', category: 'composite' },
      { id: 'errorbar', name: 'Error Bar', description: 'Error bars', category: 'composite' }
    ];
  }

  // Aggregate operations from Vega-Lite v5 schema AggregateOp
  static getAggregateOps() {
    return [
      { id: 'count', name: 'Count', description: 'Number of records' },
      { id: 'sum', name: 'Sum', description: 'Sum of values' },
      { id: 'average', name: 'Average', description: 'Mean value' },
      { id: 'mean', name: 'Mean', description: 'Arithmetic mean' },
      { id: 'median', name: 'Median', description: 'Median value' },
      { id: 'min', name: 'Minimum', description: 'Minimum value' },
      { id: 'max', name: 'Maximum', description: 'Maximum value' },
      { id: 'distinct', name: 'Distinct', description: 'Count of distinct values' },
      { id: 'variance', name: 'Variance', description: 'Sample variance' },
      { id: 'stdev', name: 'Std Dev', description: 'Sample standard deviation' },
      { id: 'q1', name: 'Q1', description: 'First quartile' },
      { id: 'q3', name: 'Q3', description: 'Third quartile' }
    ];
  }

  // Time units for temporal data
  static getTimeUnits() {
    return [
      { id: 'year', name: 'Year' },
      { id: 'quarter', name: 'Quarter' },
      { id: 'month', name: 'Month' },
      { id: 'week', name: 'Week' },
      { id: 'day', name: 'Day' },
      { id: 'dayofweek', name: 'Day of Week' },
      { id: 'date', name: 'Date' },
      { id: 'hours', name: 'Hours' },
      { id: 'minutes', name: 'Minutes' },
      { id: 'seconds', name: 'Seconds' },
      { id: 'yearmonth', name: 'Year-Month' },
      { id: 'yearmonthdate', name: 'Year-Month-Date' },
      { id: 'monthdate', name: 'Month-Date' },
      { id: 'hoursminutes', name: 'Hours-Minutes' }
    ];
  }

  // Scale types
  static getScaleTypes() {
    return [
      { id: 'linear', name: 'Linear', forTypes: ['quantitative'] },
      { id: 'log', name: 'Logarithmic', forTypes: ['quantitative'] },
      { id: 'pow', name: 'Power', forTypes: ['quantitative'] },
      { id: 'sqrt', name: 'Square Root', forTypes: ['quantitative'] },
      { id: 'symlog', name: 'Symmetric Log', forTypes: ['quantitative'] },
      { id: 'time', name: 'Time', forTypes: ['temporal'] },
      { id: 'utc', name: 'UTC', forTypes: ['temporal'] },
      { id: 'ordinal', name: 'Ordinal', forTypes: ['ordinal', 'nominal'] },
      { id: 'band', name: 'Band', forTypes: ['ordinal', 'nominal'] },
      { id: 'point', name: 'Point', forTypes: ['ordinal', 'nominal'] }
    ];
  }

  // Color schemes from Vega
  static getColorSchemes() {
    return {
      categorical: [
        'category10', 'category20', 'category20b', 'category20c',
        'tableau10', 'tableau20',
        'set1', 'set2', 'set3',
        'pastel1', 'pastel2',
        'paired', 'dark2', 'accent'
      ],
      sequential: [
        'blues', 'greens', 'greys', 'oranges', 'purples', 'reds',
        'viridis', 'magma', 'inferno', 'plasma', 'cividis', 'turbo',
        'bluegreen', 'bluepurple', 'greenblue', 'orangered', 
        'purpleblue', 'purplebluegreen', 'purplered', 'redpurple',
        'yellowgreen', 'yelloworangebrown', 'yelloworangered'
      ],
      diverging: [
        'blueorange', 'brownbluegreen', 'purplegreen', 'pinkyellowgreen',
        'purpleorange', 'redblue', 'redgrey', 'redyellowblue',
        'redyellowgreen', 'spectral'
      ]
    };
  }

  /**
   * Generate a complete Vega-Lite specification
   */
  generate(options) {
    const {
      mark,
      encoding,
      data,
      transform,
      selection,
      layer,
      ...rest
    } = options;

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      ...(this.config.title && { title: this.config.title }),
      ...(this.config.description && { description: this.config.description }),
      width: this.config.width,
      height: this.config.height,
      data: this.formatData(data),
      ...(transform && { transform }),
      ...(layer ? { layer } : { mark: this.formatMark(mark), encoding: this.formatEncoding(encoding) }),
      ...(selection && { selection }),
      ...rest
    };

    return spec;
  }

  /**
   * Generate spec for Kibana/Elasticsearch integration
   * Following the pattern from Kibana's Vega documentation
   */
  generateForElasticsearch(options) {
    const {
      index,
      timeField = '@timestamp',
      aggregation,
      mark,
      encoding,
      ...rest
    } = options;

    // Build Elasticsearch aggregation query
    const esQuery = this.buildElasticsearchQuery(index, timeField, aggregation);

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      ...(this.config.title && { title: this.config.title }),
      width: this.config.width,
      height: this.config.height,
      data: {
        url: esQuery,
        format: { property: aggregation.formatProperty || 'aggregations.buckets.buckets' }
      },
      mark: this.formatMark(mark),
      encoding: this.formatEncoding(encoding),
      ...rest
    };

    return spec;
  }

  /**
   * Build Elasticsearch query for Kibana Vega
   */
  buildElasticsearchQuery(index, timeField, aggregation) {
    return {
      '%context%': true,
      '%timefield%': timeField,
      index: index,
      body: {
        aggs: this.buildAggregation(aggregation),
        size: 0
      }
    };
  }

  /**
   * Build Elasticsearch aggregation
   */
  buildAggregation(aggConfig) {
    const { type, field, options = {} } = aggConfig;

    switch (type) {
      case 'date_histogram':
        return {
          buckets: {
            date_histogram: {
              field: field,
              calendar_interval: options.interval || '1d',
              extended_bounds: {
                min: { '%timefilter%': 'min' },
                max: { '%timefilter%': 'max' }
              },
              min_doc_count: options.min_doc_count ?? 0
            }
          }
        };

      case 'terms':
        return {
          buckets: {
            terms: {
              field: field,
              size: options.size || 25,
              order: { _count: options.order || 'desc' }
            }
          }
        };

      case 'histogram':
        return {
          buckets: {
            histogram: {
              field: field,
              interval: options.interval || 10
            }
          }
        };

      default:
        return {
          buckets: {
            terms: { field, size: 25 }
          }
        };
    }
  }

  /**
   * Format data for Vega-Lite
   */
  formatData(data) {
    if (!data) return { values: [] };
    if (Array.isArray(data)) return { values: data };
    if (typeof data === 'object' && data.url) return data;
    return { values: data };
  }

  /**
   * Format mark specification
   */
  formatMark(mark) {
    if (typeof mark === 'string') {
      return { type: mark };
    }
    return mark || { type: 'bar' };
  }

  /**
   * Format encoding channels
   */
  formatEncoding(encoding) {
    if (!encoding) return {};
    
    const formatted = {};
    
    for (const [channel, config] of Object.entries(encoding)) {
      if (!config) continue;
      
      // Handle shorthand notation
      if (typeof config === 'string') {
        formatted[channel] = this.parseFieldShorthand(config);
      } else {
        formatted[channel] = this.formatEncodingChannel(config);
      }
    }
    
    return formatted;
  }

  /**
   * Parse field shorthand (e.g., "sum(sales):Q" or "date:T")
   */
  parseFieldShorthand(shorthand) {
    const typeMap = { Q: 'quantitative', N: 'nominal', O: 'ordinal', T: 'temporal', G: 'geojson' };
    
    // Check for aggregate(field):type pattern
    const aggMatch = shorthand.match(/^(\w+)\((\w+)\):?(\w)?$/);
    if (aggMatch) {
      return {
        aggregate: aggMatch[1],
        field: aggMatch[2],
        type: typeMap[aggMatch[3]] || 'quantitative'
      };
    }
    
    // Check for field:type pattern
    const fieldMatch = shorthand.match(/^(\w+):(\w)$/);
    if (fieldMatch) {
      return {
        field: fieldMatch[1],
        type: typeMap[fieldMatch[2]] || 'nominal'
      };
    }
    
    // Just a field name
    return { field: shorthand };
  }

  /**
   * Format a single encoding channel
   */
  formatEncodingChannel(config) {
    const result = {};
    
    // Required field
    if (config.field) result.field = config.field;
    
    // Type (quantitative, nominal, ordinal, temporal, geojson)
    if (config.type) result.type = config.type;
    
    // Aggregation
    if (config.aggregate) result.aggregate = config.aggregate;
    
    // Time unit for temporal fields
    if (config.timeUnit) result.timeUnit = config.timeUnit;
    
    // Binning
    if (config.bin) result.bin = config.bin === true ? true : config.bin;
    
    // Scale configuration
    if (config.scale) {
      result.scale = {};
      if (config.scale.type) result.scale.type = config.scale.type;
      if (config.scale.domain) result.scale.domain = config.scale.domain;
      if (config.scale.range) result.scale.range = config.scale.range;
      if (config.scale.scheme) result.scale.scheme = config.scale.scheme;
      if (config.scale.zero !== undefined) result.scale.zero = config.scale.zero;
    }
    
    // Axis configuration
    if (config.axis) {
      result.axis = {};
      if (config.axis.title) result.axis.title = config.axis.title;
      if (config.axis.titleFontSize) result.axis.titleFontSize = config.axis.titleFontSize;
      if (config.axis.labelAngle !== undefined) result.axis.labelAngle = config.axis.labelAngle;
      if (config.axis.format) result.axis.format = config.axis.format;
      if (config.axis.grid !== undefined) result.axis.grid = config.axis.grid;
      if (config.axis === false) result.axis = null;
    }
    
    // Legend configuration
    if (config.legend) {
      result.legend = {};
      if (config.legend.title) result.legend.title = config.legend.title;
      if (config.legend.orient) result.legend.orient = config.legend.orient;
      if (config.legend === false) result.legend = null;
    }
    
    // Sorting
    if (config.sort) result.sort = config.sort;
    
    // Title override
    if (config.title) result.title = config.title;
    
    // Stack configuration
    if (config.stack) result.stack = config.stack;
    
    // Value (for constant values)
    if (config.value !== undefined) result.value = config.value;
    
    return result;
  }

  /**
   * Create a bar chart spec
   */
  barChart(options) {
    const { xField, yField, colorField, horizontal = false, stacked = false } = options;
    const markProps = this.getMarkProperties('bar');
    
    // Build mark configuration
    const mark = {
      type: 'bar',
      cornerRadiusEnd: 4,
      ...(markProps.opacity && { opacity: markProps.opacity }),
      ...(markProps.stroke && { stroke: markProps.stroke }),
      ...(markProps.strokeWidth && { strokeWidth: markProps.strokeWidth }),
      // Apply single color only if no colorField is used
      ...(!colorField && markProps.color && typeof markProps.color === 'string' && { color: markProps.color })
    };
    
    return this.generate({
      mark,
      encoding: {
        [horizontal ? 'y' : 'x']: {
          field: xField,
          type: 'nominal',
          axis: { labelAngle: horizontal ? 0 : -45 }
        },
        [horizontal ? 'x' : 'y']: {
          field: yField,
          type: 'quantitative',
          aggregate: options.aggregate || 'sum'
        },
        ...(colorField && {
          color: {
            field: colorField,
            type: 'nominal',
            scale: this.getColorScheme()
          }
        }),
        ...(stacked && colorField && {
          [horizontal ? 'x' : 'y']: {
            field: yField,
            type: 'quantitative',
            aggregate: options.aggregate || 'sum',
            stack: 'zero'
          }
        })
      },
      data: options.data
    });
  }

  /**
   * Create a line chart spec
   */
  lineChart(options) {
    const { xField, yField, colorField, showPoints = true } = options;
    const markProps = this.getMarkProperties('line');
    
    const lineMark = {
      type: 'line',
      interpolate: options.interpolate || 'linear',
      ...(markProps.stroke && { stroke: markProps.stroke }),
      ...(markProps.strokeWidth && { strokeWidth: markProps.strokeWidth }),
      ...(!colorField && markProps.color && typeof markProps.color === 'string' && { color: markProps.color })
    };
    
    const marks = [
      {
        mark: lineMark,
        encoding: {
          x: {
            field: xField,
            type: options.xType || 'temporal',
            axis: { title: options.xTitle }
          },
          y: {
            field: yField,
            type: 'quantitative',
            aggregate: options.aggregate,
            axis: { title: options.yTitle }
          },
          ...(colorField && {
            color: {
              field: colorField,
              type: 'nominal',
              scale: this.getColorScheme()
            }
          })
        }
      }
    ];
    
    if (showPoints) {
      marks.push({
        mark: { 
          type: 'point', 
          filled: true,
          ...(!colorField && markProps.color && typeof markProps.color === 'string' && { color: markProps.color })
        },
        encoding: {
          x: { field: xField, type: options.xType || 'temporal' },
          y: { field: yField, type: 'quantitative', aggregate: options.aggregate },
          ...(colorField && {
            color: { field: colorField, type: 'nominal', scale: this.getColorScheme() }
          })
        }
      });
    }
    
    return this.generate({
      layer: marks,
      data: options.data
    });
  }

  /**
   * Create an area chart spec
   */
  areaChart(options) {
    const { xField, yField, colorField, stacked = true } = options;
    const markProps = this.getMarkProperties('area');
    
    const mark = {
      type: 'area',
      opacity: markProps.opacity ?? options.opacity ?? 0.7,
      ...(markProps.stroke && { stroke: markProps.stroke }),
      ...(markProps.strokeWidth && { strokeWidth: markProps.strokeWidth }),
      ...(!colorField && markProps.color && typeof markProps.color === 'string' && { color: markProps.color })
    };
    
    return this.generate({
      mark,
      encoding: {
        x: {
          field: xField,
          type: options.xType || 'temporal',
          axis: { title: options.xTitle }
        },
        y: {
          field: yField,
          type: 'quantitative',
          aggregate: options.aggregate,
          stack: stacked ? 'zero' : null,
          axis: { title: options.yTitle }
        },
        ...(colorField && {
          color: {
            field: colorField,
            type: 'nominal',
            scale: this.getColorScheme()
          }
        })
      },
      data: options.data
    });
  }

  /**
   * Create a pie/donut chart spec
   */
  pieChart(options) {
    const { categoryField, valueField, donut = false, innerRadius = 50 } = options;
    const markProps = this.getMarkProperties('arc');
    
    return this.generate({
      mark: {
        type: 'arc',
        ...(donut && { innerRadius }),
        ...(markProps.stroke && { stroke: markProps.stroke }),
        ...(markProps.strokeWidth && { strokeWidth: markProps.strokeWidth })
      },
      encoding: {
        theta: {
          field: valueField,
          type: 'quantitative',
          aggregate: options.aggregate || 'sum'
        },
        color: {
          field: categoryField,
          type: 'nominal',
          scale: this.getColorScheme()
        }
      },
      data: options.data
    });
  }

  /**
   * Create a scatter plot spec
   */
  scatterPlot(options) {
    const { xField, yField, colorField, sizeField } = options;
    const markProps = this.getMarkProperties('point');
    
    return this.generate({
      mark: { 
        type: 'point', 
        filled: true, 
        opacity: markProps.opacity ?? options.opacity ?? 0.7,
        ...(markProps.stroke && { stroke: markProps.stroke }),
        ...(markProps.strokeWidth && { strokeWidth: markProps.strokeWidth }),
        ...(!colorField && markProps.color && typeof markProps.color === 'string' && { color: markProps.color })
      },
      encoding: {
        x: {
          field: xField,
          type: 'quantitative',
          axis: { title: options.xTitle }
        },
        y: {
          field: yField,
          type: 'quantitative',
          axis: { title: options.yTitle }
        },
        ...(colorField && {
          color: {
            field: colorField,
            type: options.colorType || 'nominal',
            scale: this.getColorScheme()
          }
        }),
        ...(sizeField && {
          size: {
            field: sizeField,
            type: 'quantitative'
          }
        })
      },
      data: options.data
    });
  }

  /**
   * Create a heatmap spec
   */
  heatmap(options) {
    const { xField, yField, valueField } = options;
    const markProps = this.getMarkProperties('rect');
    
    // For heatmaps, prefer sequential color schemes
    const colorScheme = this.colorConfig.scheme || 'blues';
    const sequentialSchemes = ['blues', 'greens', 'reds', 'oranges', 'purples', 'greys', 'viridis', 'magma', 'plasma', 'inferno'];
    const useSequential = sequentialSchemes.includes(colorScheme);
    
    return this.generate({
      mark: {
        type: 'rect',
        ...(markProps.stroke && { stroke: markProps.stroke }),
        ...(markProps.strokeWidth && { strokeWidth: markProps.strokeWidth })
      },
      encoding: {
        x: {
          field: xField,
          type: 'ordinal',
          axis: { labelAngle: -45 }
        },
        y: {
          field: yField,
          type: 'ordinal'
        },
        color: {
          field: valueField,
          type: 'quantitative',
          aggregate: options.aggregate || 'sum',
          scale: { scheme: useSequential ? colorScheme : 'blues' }
        }
      },
      data: options.data
    });
  }

  /**
   * Create histogram spec
   */
  histogram(options) {
    const { field, maxbins = 20 } = options;
    const markProps = this.getMarkProperties('bar');
    
    return this.generate({
      mark: {
        type: 'bar',
        ...(markProps.opacity && { opacity: markProps.opacity }),
        ...(markProps.stroke && { stroke: markProps.stroke }),
        ...(markProps.strokeWidth && { strokeWidth: markProps.strokeWidth }),
        ...(markProps.color && typeof markProps.color === 'string' && { color: markProps.color })
      },
      encoding: {
        x: {
          field: field,
          type: 'quantitative',
          bin: { maxbins }
        },
        y: {
          aggregate: 'count',
          type: 'quantitative'
        }
      },
      data: options.data
    });
  }

  /**
   * Create box plot spec
   */
  boxPlot(options) {
    const { categoryField, valueField } = options;
    const markProps = this.getMarkProperties('boxplot');
    
    return this.generate({
      mark: { 
        type: 'boxplot', 
        extent: 'min-max',
        ...(this.colorConfig.singleColor && { color: this.colorConfig.singleColor })
      },
      encoding: {
        x: {
          field: categoryField,
          type: 'nominal'
        },
        y: {
          field: valueField,
          type: 'quantitative'
        }
      },
      data: options.data
    });
  }

  /**
   * Generate from aggregated Elasticsearch data
   * Transforms ES aggregation bucket format to Vega-Lite
   */
  fromAggregatedData(options) {
    const {
      data,
      bucketField = 'key',
      valueField = '_count',
      mark = 'bar',
      colorField,
      ...rest
    } = options;
    
    const markProps = this.getMarkProperties(mark);
    
    // Build mark with color properties
    const markConfig = this.formatMark(mark);
    if (typeof markConfig === 'object') {
      if (markProps.opacity) markConfig.opacity = markProps.opacity;
      if (markProps.stroke) markConfig.stroke = markProps.stroke;
      if (markProps.strokeWidth) markConfig.strokeWidth = markProps.strokeWidth;
      if (!colorField && markProps.color && typeof markProps.color === 'string') {
        markConfig.color = markProps.color;
      }
    }

    return this.generate({
      mark: markConfig,
      encoding: {
        x: {
          field: bucketField,
          type: this.inferType(data, bucketField),
          axis: { title: rest.xTitle || bucketField, labelAngle: -45 }
        },
        y: {
          field: valueField,
          type: 'quantitative',
          axis: { title: rest.yTitle || valueField }
        },
        ...(colorField && {
          color: {
            field: colorField,
            type: 'nominal',
            scale: this.getColorScheme()
          }
        })
      },
      data
    });
  }

  /**
   * Infer field type from data
   */
  inferType(data, field) {
    if (!Array.isArray(data) || data.length === 0) return 'nominal';
    
    const sample = data[0][field];
    
    if (sample instanceof Date) return 'temporal';
    if (typeof sample === 'number') return 'quantitative';
    if (typeof sample === 'string') {
      // Check if it looks like a date
      if (/^\d{4}-\d{2}-\d{2}/.test(sample)) return 'temporal';
      return 'nominal';
    }
    
    return 'nominal';
  }

  /**
   * Validate a Vega-Lite specification
   */
  static validate(spec) {
    const errors = [];
    const warnings = [];

    if (!spec.$schema || !spec.$schema.includes('vega-lite')) {
      errors.push('Missing or invalid $schema. Should use https://vega.github.io/schema/vega-lite/v5.json');
    }

    if (!spec.data) {
      errors.push('Missing data property');
    }

    if (!spec.mark && !spec.layer && !spec.concat && !spec.hconcat && !spec.vconcat) {
      errors.push('Missing mark, layer, or composition property');
    }

    if (spec.mark && !spec.encoding) {
      warnings.push('Mark specified without encoding');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export default VegaLiteGenerator;

