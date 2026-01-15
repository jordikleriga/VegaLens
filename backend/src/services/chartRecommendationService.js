/**
 * Chart Recommendation Engine
 * Analyzes data structure and suggests appropriate chart types
 */

import { logger } from './vega/utils/logger.js';

// Chart data pattern definitions
// Defines what data shapes map to which chart types
const CHART_DATA_PATTERNS = {
  // Time series: Date field + Numeric value
  time_series: {
    requires: { date: 1, numeric: 1 },
    suggests: ['line', 'area', 'bar', 'streamgraph', 'horizon', 'rolling_average'],
    weights: { line: 95, area: 88, bar: 80, streamgraph: 65, horizon: 60, rolling_average: 75 }
  },

  // Time series with categories
  time_series_grouped: {
    requires: { date: 1, numeric: 1, categorical: 1 },
    suggests: ['line', 'area', 'streamgraph', 'trellis_area', 'lasagna'],
    weights: { line: 92, area: 85, streamgraph: 78, trellis_area: 70, lasagna: 68 }
  },

  // Categorical comparison: Category + Single metric
  categorical_comparison: {
    requires: { categorical: 1, numeric: 1 },
    suggests: ['bar', 'pie', 'donut', 'treemap', 'radial', 'funnel'],
    weights: { bar: 95, pie: 70, donut: 70, treemap: 65, radial: 60, funnel: 55 }
  },

  // Categorical with grouping
  categorical_grouped: {
    requires: { categorical: 2, numeric: 1 },
    suggests: ['bar', 'heatmap', 'marimekko', 'population_pyramid'],
    weights: { bar: 90, heatmap: 75, marimekko: 65, population_pyramid: 60 }
  },

  // Correlation: Two numeric fields
  correlation: {
    requires: { numeric: 2 },
    suggests: ['scatter', 'heatmap', 'binned_heatmap'],
    weights: { scatter: 92, heatmap: 72, binned_heatmap: 70 }
  },

  // Multi-dimensional: 3+ numeric fields
  multi_dimensional: {
    requires: { numeric: 3 },
    suggests: ['scatter', 'radar', 'ternary'],  // scatter with size field replaces bubble
    weights: { scatter: 88, radar: 75, ternary: 65 }
  },

  // Flow data: Source + Target + Value
  flow_data: {
    requires: { categorical: 2, numeric: 1 },
    hasFlowPattern: true,
    suggests: ['sankey'],
    weights: { sankey: 95 }
  },

  // Text analysis
  text_analysis: {
    requires: { text: 1 },
    suggests: ['wordcloud', 'table'],
    weights: { wordcloud: 90, table: 65 }
  },

  // Single metric (KPI/Gauge)
  single_metric: {
    requires: { numeric: 1 },
    maxTotalFields: 2,
    suggests: ['metric', 'gauge', 'bullet'],
    weights: { metric: 95, gauge: 80, bullet: 70 }
  },

  // Distribution analysis
  distribution: {
    requires: { numeric: 1 },
    minRecords: 20,
    suggests: ['histogram', 'density', 'boxplot', 'heatlane'],
    weights: { histogram: 90, density: 80, boxplot: 75, heatlane: 65 }
  },

  // Distribution by category
  distribution_grouped: {
    requires: { categorical: 1, numeric: 1 },
    minRecords: 20,
    suggests: ['boxplot', 'histogram', 'density'],
    weights: { boxplot: 90, histogram: 75, density: 70 }
  },

  // Part-to-whole composition
  composition: {
    requires: { categorical: 1, numeric: 1 },
    suggests: ['pie', 'donut', 'treemap', 'radial'],
    weights: { pie: 85, donut: 85, treemap: 75, radial: 70 }
  },

  // Change over time (start/end values)
  change_comparison: {
    requires: { categorical: 1, numeric: 2 },
    suggests: ['comet', 'waterfall', 'bullet', 'dual_axis'],
    weights: { comet: 80, waterfall: 75, bullet: 70, dual_axis: 85 }
  },

  // Raw tabular data
  tabular: {
    requires: {},
    fallback: true,
    suggests: ['table', 'bar'],
    weights: { table: 85, bar: 60 }
  }
};

// Chart metadata for recommendations
const CHART_INFO = {
  bar: { name: 'Bar Chart', description: 'Compare categories', category: 'comparison' },
  line: { name: 'Line Chart', description: 'Show trends over time', category: 'trend' },
  area: { name: 'Area Chart', description: 'Visualize cumulative trends', category: 'trend' },
  pie: { name: 'Pie Chart', description: 'Show proportions', category: 'composition' },
  donut: { name: 'Donut Chart', description: 'Proportions with center space', category: 'composition' },
  scatter: { name: 'Scatter Plot', description: 'Explore correlations (supports size encoding)', category: 'correlation' },
  // bubble disabled - use scatter with size field
  heatmap: { name: 'Heatmap', description: 'Dense value matrix', category: 'distribution' },
  binned_heatmap: { name: 'Binned Heatmap', description: 'Density distribution', category: 'distribution' },
  histogram: { name: 'Histogram', description: 'Value distribution', category: 'distribution' },
  treemap: { name: 'Treemap', description: 'Hierarchical proportions', category: 'hierarchy' },
  gauge: { name: 'Gauge', description: 'Progress indicator', category: 'kpi' },
  metric: { name: 'Metric', description: 'Single value display', category: 'kpi' },
  boxplot: { name: 'Box Plot', description: 'Statistical distribution', category: 'distribution' },
  wordcloud: { name: 'Word Cloud', description: 'Text frequency', category: 'text' },
  sankey: { name: 'Sankey Diagram', description: 'Flow between nodes', category: 'flow' },
  radial: { name: 'Radial Chart', description: 'Circular bar chart', category: 'composition' },
  radar: { name: 'Radar Chart', description: 'Multi-axis comparison', category: 'comparison' },
  funnel: { name: 'Funnel Chart', description: 'Stage conversion', category: 'flow' },
  streamgraph: { name: 'Streamgraph', description: 'Stacked area flow', category: 'trend' },
  density: { name: 'Density Plot', description: 'Continuous distribution', category: 'distribution' },
  waterfall: { name: 'Waterfall Chart', description: 'Cumulative effect', category: 'comparison' },
  rolling_average: { name: 'Rolling Average', description: 'Smoothed trends', category: 'trend' },
  dual_axis: { name: 'Dual Axis', description: 'Two scale comparison', category: 'comparison' },
  bullet: { name: 'Bullet Chart', description: 'Target vs actual', category: 'kpi' },
  population_pyramid: { name: 'Population Pyramid', description: 'Bidirectional comparison', category: 'comparison' },
  lasagna: { name: 'Lasagna Plot', description: 'Time-based heatmap', category: 'trend' },
  trellis_area: { name: 'Trellis Area', description: 'Faceted area charts', category: 'trend' },
  comet: { name: 'Comet Chart', description: 'Change visualization', category: 'comparison' },
  heatlane: { name: 'Heat Lane', description: 'Single-row heatmap', category: 'distribution' },
  ternary: { name: 'Ternary Plot', description: 'Three-variable composition', category: 'composition' },
  sparkline: { name: 'Sparkline', description: 'Inline trend', category: 'trend' },
  error_bars: { name: 'Error Bars', description: 'Uncertainty visualization', category: 'distribution' },
  horizon: { name: 'Horizon Chart', description: 'Compact time series', category: 'trend' },
  circle_packing: { name: 'Circle Packing', description: 'Nested circles', category: 'hierarchy' },
  marimekko: { name: 'Marimekko', description: 'Variable-width bars', category: 'composition' },
  table: { name: 'Table', description: 'Raw data display', category: 'raw' }
};

/**
 * Classify fields by their data type
 * @param {Object} fieldMappings - Elasticsearch field mappings
 * @returns {Object} Fields grouped by type
 */
export function classifyFields(fieldMappings) {
  const classified = {
    date: [],
    numeric: [],
    categorical: [],
    text: [],
    geo: [],
    boolean: [],
    other: []
  };

  for (const [fieldName, fieldInfo] of Object.entries(fieldMappings)) {
    const type = fieldInfo.type || fieldInfo;
    
    // Skip internal fields
    if (fieldName.startsWith('_')) continue;

    if (['date', 'datetime'].includes(type)) {
      classified.date.push(fieldName);
    } else if (['long', 'integer', 'short', 'byte', 'double', 'float', 'half_float', 'scaled_float', 'number'].includes(type)) {
      classified.numeric.push(fieldName);
    } else if (['keyword', 'constant_keyword'].includes(type)) {
      classified.categorical.push(fieldName);
    } else if (type === 'text') {
      classified.text.push(fieldName);
      // Text fields often have keyword subfields
      if (fieldMappings[`${fieldName}.keyword`]) {
        classified.categorical.push(`${fieldName}.keyword`);
      }
    } else if (['geo_point', 'geo_shape'].includes(type)) {
      classified.geo.push(fieldName);
    } else if (type === 'boolean') {
      classified.boolean.push(fieldName);
    } else {
      classified.other.push(fieldName);
    }
  }

  return classified;
}

/**
 * Analyze sample data to detect patterns
 * @param {Array} sampleData - Sample data records
 * @returns {Object} Detected patterns
 */
export function analyzeDataPatterns(sampleData) {
  if (!sampleData || sampleData.length === 0) {
    return { recordCount: 0 };
  }

  const sample = sampleData[0];
  const fields = Object.keys(sample);
  
  // Analyze field types from actual data
  const fieldAnalysis = {};
  for (const field of fields) {
    const values = sampleData.map(d => d[field]).filter(v => v != null);
    const types = values.map(v => typeof v);
    const uniqueTypes = [...new Set(types)];
    
    fieldAnalysis[field] = {
      primaryType: uniqueTypes[0] || 'unknown',
      isNumeric: uniqueTypes.every(t => t === 'number'),
      isString: uniqueTypes.every(t => t === 'string'),
      uniqueValues: new Set(values).size,
      hasNulls: values.length < sampleData.length,
      sampleValues: values.slice(0, 3)
    };

    // Check if string field looks like a date
    if (fieldAnalysis[field].isString && values.length > 0) {
      const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}/;
      fieldAnalysis[field].looksLikeDate = values.some(v => datePattern.test(String(v)));
    }
  }

  // Detect potential flow data (source-target pattern)
  const potentialFlowFields = fields.filter(f => 
    /source|from|origin|start/i.test(f) || /target|to|dest|end/i.test(f)
  );
  const hasFlowPattern = potentialFlowFields.length >= 2;

  return {
    recordCount: sampleData.length,
    fieldCount: fields.length,
    fieldAnalysis,
    hasFlowPattern,
    fields
  };
}

/**
 * Match data characteristics against chart patterns
 * @param {Object} fieldTypes - Classified field types
 * @param {Object} dataPatterns - Analyzed data patterns
 * @returns {Array} Matched patterns with scores
 */
function matchPatterns(fieldTypes, dataPatterns) {
  const matches = [];

  for (const [patternName, pattern] of Object.entries(CHART_DATA_PATTERNS)) {
    let score = 0;
    let matchedRequirements = 0;
    let totalRequirements = Object.keys(pattern.requires).length;

    // Check requirements
    for (const [fieldType, minCount] of Object.entries(pattern.requires)) {
      const available = fieldTypes[fieldType]?.length || 0;
      if (available >= minCount) {
        matchedRequirements++;
        // Bonus for having exactly the right amount
        score += available === minCount ? 15 : 10;
      }
    }

    // Skip if not all requirements met
    if (totalRequirements > 0 && matchedRequirements < totalRequirements) {
      continue;
    }

    // Check optional constraints
    if (pattern.maxTotalFields) {
      const totalFields = Object.values(fieldTypes).flat().length;
      if (totalFields > pattern.maxTotalFields) {
        score -= 20;
      }
    }

    if (pattern.minRecords && dataPatterns.recordCount < pattern.minRecords) {
      score -= 30;
    }

    if (pattern.hasFlowPattern && !dataPatterns.hasFlowPattern) {
      continue;
    }

    // Base score for matching
    score += 50;

    matches.push({
      pattern: patternName,
      score,
      charts: pattern.suggests,
      weights: pattern.weights
    });
  }

  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Generate chart recommendations from matched patterns
 * @param {Array} patternMatches - Matched patterns
 * @param {Object} fieldTypes - Field type classification
 * @returns {Array} Scored chart recommendations
 */
function generateRecommendations(patternMatches, fieldTypes) {
  const chartScores = new Map();
  const chartReasons = new Map();

  for (const match of patternMatches) {
    for (const chartType of match.charts) {
      const weight = match.weights[chartType] || 50;
      const combinedScore = (match.score * weight) / 100;

      if (!chartScores.has(chartType) || chartScores.get(chartType) < combinedScore) {
        chartScores.set(chartType, combinedScore);
        chartReasons.set(chartType, generateReason(chartType, fieldTypes, match.pattern));
      }
    }
  }

  // Convert to array and sort by score
  const recommendations = Array.from(chartScores.entries())
    .map(([type, score]) => ({
      type,
      name: CHART_INFO[type]?.name || type,
      description: CHART_INFO[type]?.description || '',
      category: CHART_INFO[type]?.category || 'other',
      score: Math.min(99, Math.round(score)),
      reason: chartReasons.get(type)
    }))
    .sort((a, b) => b.score - a.score);

  return recommendations;
}

/**
 * Generate human-readable reason for recommendation
 */
function generateReason(chartType, fieldTypes, pattern) {
  const dateFields = fieldTypes.date?.slice(0, 2).join(', ') || '';
  const numericFields = fieldTypes.numeric?.slice(0, 2).join(', ') || '';
  const categoricalFields = fieldTypes.categorical?.slice(0, 2).join(', ') || '';

  const reasons = {
    line: `You have date field${fieldTypes.date?.length > 1 ? 's' : ''} (${dateFields}) and numeric data → ideal for trends`,
    area: `Time-based data with numeric values → visualize cumulative trends`,
    bar: `${fieldTypes.categorical?.length || 0} categorical field${(fieldTypes.categorical?.length || 0) > 1 ? 's' : ''} to compare`,
    pie: `Single category with values → show proportional breakdown`,
    donut: `Proportional data with center space for metrics`,
    scatter: `Two numeric fields (${numericFields}) → explore correlation (add size field for 3D)`,
    // bubble disabled - use scatter with size field
    heatmap: `Category-value pairs → visualize as density matrix`,
    histogram: `Numeric distribution → bin and count values`,
    sankey: `Source/target fields detected → visualize flow`,
    wordcloud: `Text field available → show word frequency`,
    metric: `Single value focus → prominent number display`,
    gauge: `Progress/percentage value → circular indicator`,
    boxplot: `Numeric values by category → show statistical spread`,
    streamgraph: `Multiple categories over time → stacked flowing areas`,
    treemap: `Hierarchical values → nested rectangles`,
    radar: `Multiple metrics → multi-axis comparison`,
    dual_axis: `Two different metrics → compare on separate scales`
  };

  return reasons[chartType] || `Good match for your data structure (${pattern})`;
}

/**
 * Main recommendation function
 * @param {Object} fieldMappings - Elasticsearch field mappings
 * @param {Array} sampleData - Sample data records
 * @param {Object} aggregationConfig - Current aggregation configuration
 * @returns {Object} Recommendations and analysis
 */
export function analyzeDataAndRecommend(fieldMappings, sampleData = [], aggregationConfig = null) {
  const startTime = Date.now();

  try {
    // Classify fields by type
    const fieldTypes = classifyFields(fieldMappings);

    // Analyze data patterns
    const dataPatterns = analyzeDataPatterns(sampleData);

    // If we have aggregation config, enhance field classification
    if (aggregationConfig?.bucketAgg) {
      const bucketField = aggregationConfig.bucketAgg.field;
      const bucketType = aggregationConfig.bucketAgg.type;

      // Date histogram implies time series
      if (bucketType === 'date_histogram' && !fieldTypes.date.includes(bucketField)) {
        fieldTypes.date.push(bucketField);
      }
    }

    // Match patterns
    const patternMatches = matchPatterns(fieldTypes, dataPatterns);

    // Generate recommendations
    const recommendations = generateRecommendations(patternMatches, fieldTypes);

    const duration = Date.now() - startTime;
    logger.debug('Chart recommendations generated', {
      event: 'recommendations_generated',
      duration,
      fieldCounts: {
        date: fieldTypes.date.length,
        numeric: fieldTypes.numeric.length,
        categorical: fieldTypes.categorical.length,
        text: fieldTypes.text.length
      },
      topRecommendation: recommendations[0]?.type,
      totalRecommendations: recommendations.length
    });

    return {
      recommendations: recommendations.slice(0, 8), // Return top 8
      analyzedFields: fieldTypes,
      dataPatterns: {
        recordCount: dataPatterns.recordCount,
        fieldCount: dataPatterns.fieldCount,
        hasFlowPattern: dataPatterns.hasFlowPattern
      },
      matchedPatterns: patternMatches.slice(0, 3).map(m => m.pattern)
    };
  } catch (error) {
    logger.error('Chart recommendation failed', {
      event: 'recommendations_error',
      error: error.message
    });

    // Return fallback recommendations
    return {
      recommendations: [
        { type: 'bar', name: 'Bar Chart', score: 70, reason: 'Default recommendation' },
        { type: 'line', name: 'Line Chart', score: 65, reason: 'Good for most data' },
        { type: 'table', name: 'Table', score: 60, reason: 'View raw data' }
      ],
      analyzedFields: {},
      error: error.message
    };
  }
}

export default {
  analyzeDataAndRecommend,
  classifyFields,
  analyzeDataPatterns
};

