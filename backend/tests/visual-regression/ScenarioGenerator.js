/**
 * Scenario Generator - Multi-Scenario Visual Regression Testing
 *
 * Generates 22 different test scenarios to catch edge cases:
 *
 * CORE SCENARIOS (1-10):
 * 1. minimal        - Minimum viable data (1-2 points)
 * 2. standard       - Normal data set (5-10 points)
 * 3. large          - Large data set (50+ points)
 * 4. empty          - Empty arrays/null values
 * 5. single         - Single data point
 * 6. negatives      - Negative values
 * 7. zeros          - Zero values mixed in
 * 8. decimals       - Floating point precision
 * 9. unicode        - Unicode/special characters in labels
 * 10. outliers      - Extreme outliers in data
 *
 * EXTENDED SCENARIOS (11-22):
 * 11. very_large    - Values in billions/trillions (number formatting)
 * 12. all_same      - All identical values (flat line handling)
 * 13. long_labels   - 50+ character labels (text truncation)
 * 14. many_categories - 100+ categories (color cycling, legend overflow)
 * 15. missing_periods - Time gaps (interpolation behavior)
 * 16. mixed_magnitude - 0.001 to 1M values (log scale needs)
 * 17. nan_values    - NaN values mixed in (error handling)
 * 18. html_injection - XSS test (<script> in labels)
 * 19. circular_ref  - A→B→C→A flow data (infinite loop prevention)
 * 20. rtl_text      - Arabic/Hebrew labels (text direction)
 * 21. sparse        - Many gaps/missing buckets
 * 22. deep_hierarchy - 5+ levels of nesting
 */

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const SCENARIOS = {
  // Scenario 1: Minimal data - tests boundary conditions
  minimal: {
    name: 'Minimal Data',
    description: 'Minimum viable data (1-2 points)',
    priority: 'high'
  },

  // Scenario 2: Standard data - the "happy path"
  standard: {
    name: 'Standard Data',
    description: 'Normal data set (5-10 points)',
    priority: 'high'
  },

  // Scenario 3: Large dataset - tests performance and overflow
  large: {
    name: 'Large Dataset',
    description: 'Large data set (50+ points)',
    priority: 'medium'
  },

  // Scenario 4: Empty data - tests null/empty handling
  empty: {
    name: 'Empty Data',
    description: 'Empty arrays and null values',
    priority: 'high'
  },

  // Scenario 5: Single point - edge case for aggregations
  single: {
    name: 'Single Point',
    description: 'Single data point only',
    priority: 'high'
  },

  // Scenario 6: Negative values - tests axis scaling
  negatives: {
    name: 'Negative Values',
    description: 'Mix of positive and negative values',
    priority: 'high'
  },

  // Scenario 7: Zero values - tests divide-by-zero, empty segments
  zeros: {
    name: 'Zero Values',
    description: 'Zero values mixed with non-zero',
    priority: 'high'
  },

  // Scenario 8: Decimal precision - tests floating point
  decimals: {
    name: 'Decimal Precision',
    description: 'High precision floating point values',
    priority: 'medium'
  },

  // Scenario 9: Unicode labels - tests text rendering
  unicode: {
    name: 'Unicode Labels',
    description: 'Unicode and special characters',
    priority: 'medium'
  },

  // Scenario 10: Outliers - tests scale adaptation
  outliers: {
    name: 'Outliers',
    description: 'Extreme outliers in data',
    priority: 'high'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTENDED SCENARIOS (11-22)
  // ═══════════════════════════════════════════════════════════════════════════

  // Scenario 11: Very large numbers - tests number formatting
  very_large: {
    name: 'Very Large Numbers',
    description: 'Billions/trillions (1.2B vs 1200000000)',
    priority: 'high'
  },

  // Scenario 12: All same values - tests flat line/zero range
  all_same: {
    name: 'All Same Values',
    description: 'All identical values (flat line handling)',
    priority: 'high'
  },

  // Scenario 13: Long labels - tests text truncation
  long_labels: {
    name: 'Long Labels',
    description: '50+ character category names',
    priority: 'high'
  },

  // Scenario 14: Many categories - tests color cycling and legend
  many_categories: {
    name: 'Many Categories',
    description: '100+ unique categories (legend overflow)',
    priority: 'high'
  },

  // Scenario 15: Missing time periods - tests gap handling
  missing_periods: {
    name: 'Missing Periods',
    description: 'Time gaps in data (interpolation)',
    priority: 'high'
  },

  // Scenario 16: Mixed magnitude - tests log scale needs
  mixed_magnitude: {
    name: 'Mixed Magnitude',
    description: '0.001 to 1,000,000 in same dataset',
    priority: 'medium'
  },

  // Scenario 17: NaN values - tests error handling
  nan_values: {
    name: 'NaN Values',
    description: 'NaN mixed with valid numbers',
    priority: 'medium'
  },

  // Scenario 18: HTML injection - tests XSS prevention
  html_injection: {
    name: 'HTML Injection',
    description: '<script> tags in labels (XSS test)',
    priority: 'medium'
  },

  // Scenario 19: Circular references - tests infinite loop prevention
  circular_ref: {
    name: 'Circular Reference',
    description: 'A→B→C→A in flow data',
    priority: 'medium'
  },

  // Scenario 20: RTL text - tests text direction
  rtl_text: {
    name: 'RTL Text',
    description: 'Arabic/Hebrew labels (right-to-left)',
    priority: 'low'
  },

  // Scenario 21: Sparse data - tests gap handling
  sparse: {
    name: 'Sparse Data',
    description: 'Many empty buckets/gaps',
    priority: 'medium'
  },

  // Scenario 22: Deep hierarchy - tests nesting depth
  deep_hierarchy: {
    name: 'Deep Hierarchy',
    description: '5+ levels of nesting',
    priority: 'low'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// BASE DATA GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

const generators = {
  // Generate categorical data
  categorical: (count, options = {}) => {
    const { valueRange = [10, 100], prefix = 'Category' } = options;
    return Array.from({ length: count }, (_, i) => ({
      category: `${prefix} ${String.fromCharCode(65 + i)}`,
      value: Math.round(valueRange[0] + Math.random() * (valueRange[1] - valueRange[0])),
      subcategory: `Sub ${(i % 3) + 1}`
    }));
  },

  // Generate time series data
  timeseries: (count, options = {}) => {
    const { valueRange = [50, 150], startDate = '2024-01-01', series = ['A'] } = options;
    const data = [];
    const start = new Date(startDate);

    for (const s of series) {
      for (let i = 0; i < count; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        data.push({
          category: `Series ${s}`,
          value: Math.round(valueRange[0] + Math.random() * (valueRange[1] - valueRange[0])),
          value1: Math.round(valueRange[0] + Math.random() * (valueRange[1] - valueRange[0])),
          value2: Math.round((valueRange[0] + Math.random() * (valueRange[1] - valueRange[0])) / 2),
          date: date.toISOString().split('T')[0]
        });
      }
    }
    return data;
  },

  // Generate scatter/bubble data
  scatter: (count, options = {}) => {
    const { xRange = [0, 100], yRange = [0, 100], sizeRange = [50, 300] } = options;
    return Array.from({ length: count }, (_, i) => ({
      category: `Point ${i + 1}`,
      x_value: Math.round(xRange[0] + Math.random() * (xRange[1] - xRange[0])),
      y_value: Math.round(yRange[0] + Math.random() * (yRange[1] - yRange[0])),
      size_value: Math.round(sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]))
    }));
  },

  // Generate heatmap data
  heatmap: (xCount, yCount, options = {}) => {
    const { xLabels, yLabels, valueRange = [0, 100] } = options;
    const xCats = xLabels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].slice(0, xCount);
    const yCats = yLabels || ['Morning', 'Afternoon', 'Evening'].slice(0, yCount);
    const data = [];

    for (const x of xCats) {
      for (const y of yCats) {
        data.push({
          x_cat: x,
          y_cat: y,
          value: Math.round(valueRange[0] + Math.random() * (valueRange[1] - valueRange[0]))
        });
      }
    }
    return data;
  },

  // Generate flow data (sankey/chord)
  flow: (nodeCount, options = {}) => {
    const { valueRange = [20, 200] } = options;
    const sources = Array.from({ length: nodeCount }, (_, i) => String.fromCharCode(65 + i));
    const targets = Array.from({ length: nodeCount }, (_, i) => String.fromCharCode(88 + i));
    const data = [];

    for (const source of sources) {
      for (const target of targets.slice(0, 2)) {
        data.push({
          source,
          target,
          value: Math.round(valueRange[0] + Math.random() * (valueRange[1] - valueRange[0]))
        });
      }
    }
    return data;
  },

  // Generate distribution data
  distribution: (count, options = {}) => {
    const { mean = 50, stdDev = 15 } = options;
    // Box-Muller transform for normal distribution
    return Array.from({ length: count }, () => {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return { value: Math.round(mean + z * stdDev) };
    });
  },

  // Generate funnel data
  funnel: (stages, options = {}) => {
    const { startValue = 1000, dropRate = 0.3 } = options;
    let value = startValue;
    return stages.map(stage => {
      const result = { stage, count: Math.round(value) };
      value *= (1 - dropRate);
      return result;
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO-SPECIFIC DATA
// ═══════════════════════════════════════════════════════════════════════════

export function generateScenarioData(chartType, scenario) {
  const scenarioGenerators = {
    // ─────────────────────────────────────────────────────────────────────────
    // MINIMAL: 1-2 data points
    // ─────────────────────────────────────────────────────────────────────────
    minimal: {
      default: [
        { category: 'A', value: 100, date: '2024-01-01', subcategory: 'Sub 1' },
        { category: 'B', value: 80, date: '2024-01-02', subcategory: 'Sub 2' }
      ],
      timeseries: [
        { category: 'Series A', value: 100, value1: 100, value2: 50, date: '2024-01-01' },
        { category: 'Series A', value: 120, value1: 120, value2: 60, date: '2024-01-02' }
      ],
      scatter: [
        { category: 'Point 1', x_value: 20, y_value: 30 },
        { category: 'Point 2', x_value: 80, y_value: 70 }
      ],
      bubble: [
        { category: 'Bubble 1', x_value: 20, y_value: 30, size_value: 100 },
        { category: 'Bubble 2', x_value: 80, y_value: 70, size_value: 200 }
      ],
      heatmap: [
        { x_cat: 'Mon', y_cat: 'Morning', value: 50 },
        { x_cat: 'Tue', y_cat: 'Afternoon', value: 75 }
      ],
      funnel: [
        { stage: 'Start', count: 1000 },
        { stage: 'End', count: 500 }
      ],
      sankey: [
        { source: 'A', target: 'X', value: 100 },
        { source: 'B', target: 'Y', value: 80 }
      ],
      chord: [
        { source: 'A', target: 'B', value: 100 },
        { source: 'B', target: 'A', value: 80 }
      ],
      waterfall: [
        { category: 'Start', value: 100 },
        { category: 'End', value: 150 }
      ],
      wordcloud: [
        { word: 'Hello', frequency: 100 },
        { word: 'World', frequency: 80 }
      ],
      histogram: [{ value: 25 }, { value: 75 }],
      boxplot: [
        { category: 'A', value: 50 },
        { category: 'A', value: 75 }
      ],
      ternary: [
        { category: 'P1', a_value: 0.5, b_value: 0.3, c_value: 0.2 }
      ],
      comet: [
        { category: 'Item 1', time_state: 'Before', value: 20 },
        { category: 'Item 1', time_state: 'After', value: 60 }
      ],
      population_pyramid: [
        { age_group: '0-9', gender: 'Male', population: 100 },
        { age_group: '0-9', gender: 'Female', population: 95 }
      ],
      metric: [{ value: 42 }],
      gauge: [{ value: 75 }],
      bullet: [{ value: 75, target: 90 }],
      radar: [
        { category: 'Speed', value: 80 },
        { category: 'Power', value: 60 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STANDARD: Normal dataset (5-10 points)
    // ─────────────────────────────────────────────────────────────────────────
    standard: {
      default: [
        { category: 'A', value: 120, subcategory: 'Sub 1' },
        { category: 'B', value: 95, subcategory: 'Sub 2' },
        { category: 'C', value: 80, subcategory: 'Sub 1' },
        { category: 'D', value: 110, subcategory: 'Sub 2' },
        { category: 'E', value: 65, subcategory: 'Sub 1' }
      ],
      timeseries: [
        { category: 'Series A', value: 85, value1: 85, value2: 42, date: '2024-01-01' },
        { category: 'Series A', value: 110, value1: 110, value2: 55, date: '2024-01-02' },
        { category: 'Series A', value: 95, value1: 95, value2: 48, date: '2024-01-03' },
        { category: 'Series A', value: 125, value1: 125, value2: 62, date: '2024-01-04' },
        { category: 'Series A', value: 100, value1: 100, value2: 50, date: '2024-01-05' },
        { category: 'Series B', value: 70, value1: 70, value2: 35, date: '2024-01-01' },
        { category: 'Series B', value: 90, value1: 90, value2: 45, date: '2024-01-02' },
        { category: 'Series B', value: 80, value1: 80, value2: 40, date: '2024-01-03' },
        { category: 'Series B', value: 105, value1: 105, value2: 52, date: '2024-01-04' },
        { category: 'Series B', value: 85, value1: 85, value2: 42, date: '2024-01-05' }
      ],
      scatter: [
        { category: 'Point 1', x_value: 15, y_value: 25, size_value: 80 },
        { category: 'Point 2', x_value: 35, y_value: 45, size_value: 120 },
        { category: 'Point 3', x_value: 55, y_value: 30, size_value: 90 },
        { category: 'Point 4', x_value: 25, y_value: 65, size_value: 150 },
        { category: 'Point 5', x_value: 70, y_value: 50, size_value: 110 },
        { category: 'Point 6', x_value: 45, y_value: 75, size_value: 100 },
        { category: 'Point 7', x_value: 85, y_value: 35, size_value: 130 },
        { category: 'Point 8', x_value: 60, y_value: 85, size_value: 95 }
      ],
      bubble: [
        { category: 'Point 1', x_value: 15, y_value: 25, size_value: 80 },
        { category: 'Point 2', x_value: 35, y_value: 45, size_value: 120 },
        { category: 'Point 3', x_value: 55, y_value: 30, size_value: 90 },
        { category: 'Point 4', x_value: 25, y_value: 65, size_value: 150 },
        { category: 'Point 5', x_value: 70, y_value: 50, size_value: 110 },
        { category: 'Point 6', x_value: 45, y_value: 75, size_value: 100 },
        { category: 'Point 7', x_value: 85, y_value: 35, size_value: 130 },
        { category: 'Point 8', x_value: 60, y_value: 85, size_value: 95 }
      ],
      heatmap: [
        { x_cat: 'Mon', y_cat: 'Morning', value: 45 },
        { x_cat: 'Mon', y_cat: 'Afternoon', value: 72 },
        { x_cat: 'Mon', y_cat: 'Evening', value: 58 },
        { x_cat: 'Tue', y_cat: 'Morning', value: 38 },
        { x_cat: 'Tue', y_cat: 'Afternoon', value: 85 },
        { x_cat: 'Tue', y_cat: 'Evening', value: 62 },
        { x_cat: 'Wed', y_cat: 'Morning', value: 52 },
        { x_cat: 'Wed', y_cat: 'Afternoon', value: 78 },
        { x_cat: 'Wed', y_cat: 'Evening', value: 48 },
        { x_cat: 'Thu', y_cat: 'Morning', value: 42 },
        { x_cat: 'Thu', y_cat: 'Afternoon', value: 90 },
        { x_cat: 'Thu', y_cat: 'Evening', value: 55 },
        { x_cat: 'Fri', y_cat: 'Morning', value: 35 },
        { x_cat: 'Fri', y_cat: 'Afternoon', value: 95 },
        { x_cat: 'Fri', y_cat: 'Evening', value: 68 }
      ],
      binned_heatmap: [
        { x_value: 10, y_value: 20 }, { x_value: 15, y_value: 25 }, { x_value: 12, y_value: 22 },
        { x_value: 35, y_value: 45 }, { x_value: 38, y_value: 42 }, { x_value: 40, y_value: 48 },
        { x_value: 55, y_value: 30 }, { x_value: 58, y_value: 35 }, { x_value: 52, y_value: 28 },
        { x_value: 25, y_value: 65 }, { x_value: 28, y_value: 68 }, { x_value: 22, y_value: 62 },
        { x_value: 70, y_value: 50 }, { x_value: 75, y_value: 55 }, { x_value: 68, y_value: 52 },
        { x_value: 45, y_value: 75 }, { x_value: 48, y_value: 78 }, { x_value: 42, y_value: 72 },
        { x_value: 85, y_value: 35 }, { x_value: 88, y_value: 38 }
      ],
      funnel: generators.funnel(['Awareness', 'Interest', 'Decision', 'Action', 'Purchase']),
      sankey: [
        { source: 'A', target: 'X', value: 80 },
        { source: 'A', target: 'Y', value: 50 },
        { source: 'B', target: 'X', value: 100 },
        { source: 'B', target: 'Y', value: 70 },
        { source: 'C', target: 'X', value: 60 },
        { source: 'C', target: 'Y', value: 120 }
      ],
      chord: [
        { source: 'A', target: 'B', value: 100 },
        { source: 'A', target: 'C', value: 50 },
        { source: 'B', target: 'C', value: 80 },
        { source: 'B', target: 'A', value: 60 },
        { source: 'C', target: 'A', value: 70 }
      ],
      waterfall: [
        { category: 'Start', value: 100 },
        { category: 'Revenue', value: 50 },
        { category: 'Costs', value: -30 },
        { category: 'Taxes', value: -10 },
        { category: 'End', value: 110 }
      ],
      wordcloud: [
        { word: 'JavaScript', frequency: 100 },
        { word: 'Python', frequency: 90 },
        { word: 'TypeScript', frequency: 80 },
        { word: 'Rust', frequency: 70 },
        { word: 'Go', frequency: 60 },
        { word: 'Java', frequency: 50 },
        { word: 'C++', frequency: 40 }
      ],
      histogram: generators.distribution(50),
      boxplot: [
        ...Array.from({ length: 10 }, (_, i) => ({ category: 'A', value: 20 + i * 5 })),
        ...Array.from({ length: 10 }, (_, i) => ({ category: 'B', value: 30 + i * 6 }))
      ],
      ternary: [
        { category: 'P1', a_value: 0.5, b_value: 0.3, c_value: 0.2 },
        { category: 'P2', a_value: 0.3, b_value: 0.5, c_value: 0.2 },
        { category: 'P3', a_value: 0.2, b_value: 0.2, c_value: 0.6 },
        { category: 'P4', a_value: 0.4, b_value: 0.4, c_value: 0.2 }
      ],
      comet: [
        { category: 'USA', time_state: '2020', value: 21000 },
        { category: 'USA', time_state: '2023', value: 25500 },
        { category: 'China', time_state: '2020', value: 14700 },
        { category: 'China', time_state: '2023', value: 17900 },
        { category: 'Germany', time_state: '2020', value: 3800 },
        { category: 'Germany', time_state: '2023', value: 4200 }
      ],
      population_pyramid: [
        { age_group: '0-9', gender: 'Male', population: 100 },
        { age_group: '0-9', gender: 'Female', population: 95 },
        { age_group: '10-19', gender: 'Male', population: 120 },
        { age_group: '10-19', gender: 'Female', population: 115 },
        { age_group: '20-29', gender: 'Male', population: 150 },
        { age_group: '20-29', gender: 'Female', population: 145 }
      ],
      metric: [{ value: 42 }],
      gauge: [{ value: 75 }],
      bullet: [{ value: 75, target: 90 }],
      radar: [
        { category: 'Speed', value: 80 },
        { category: 'Power', value: 65 },
        { category: 'Defense', value: 90 },
        { category: 'Agility', value: 70 },
        { category: 'Stamina', value: 85 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LARGE: 50+ data points
    // ─────────────────────────────────────────────────────────────────────────
    large: {
      default: generators.categorical(50),
      timeseries: generators.timeseries(30, { series: ['A', 'B', 'C'] }),
      scatter: generators.scatter(100),
      bubble: generators.scatter(100),
      heatmap: generators.heatmap(10, 10),
      binned_heatmap: generators.scatter(500).map(d => ({ x_value: d.x_value, y_value: d.y_value })),
      funnel: generators.funnel(['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5', 'Stage 6', 'Stage 7', 'Stage 8']),
      sankey: [
        { source: 'A', target: 'X', value: 80 },
        { source: 'A', target: 'Y', value: 120 },
        { source: 'B', target: 'X', value: 100 },
        { source: 'B', target: 'Y', value: 90 },
        { source: 'C', target: 'X', value: 150 },
        { source: 'C', target: 'Y', value: 70 }
      ],
      chord: generators.flow(5).map(d => ({ source: `Group ${d.source}`, target: `Group ${d.target}`, value: d.value })),
      waterfall: [
        { category: 'Opening', value: 1000 },
        ...Array.from({ length: 10 }, (_, i) => ({
          category: `Q${i + 1}`,
          value: Math.round((Math.random() - 0.3) * 200)
        })),
        { category: 'Closing', value: 0 }
      ],
      wordcloud: Array.from({ length: 50 }, (_, i) => ({
        word: `Word${i + 1}`,
        frequency: Math.round(100 - i * 1.5)
      })),
      histogram: generators.distribution(500),
      boxplot: [
        ...Array.from({ length: 50 }, () => ({ category: 'A', value: Math.round(50 + Math.random() * 30) })),
        ...Array.from({ length: 50 }, () => ({ category: 'B', value: Math.round(40 + Math.random() * 40) })),
        ...Array.from({ length: 50 }, () => ({ category: 'C', value: Math.round(60 + Math.random() * 20) }))
      ],
      ternary: Array.from({ length: 30 }, (_, i) => {
        const a = Math.random();
        const b = Math.random() * (1 - a);
        const c = 1 - a - b;
        return { category: `P${i}`, a_value: a, b_value: b, c_value: c };
      }),
      comet: Array.from({ length: 20 }, (_, i) => ({
        category: `Item ${i}`,
        x_start: Math.round(Math.random() * 50),
        y_start: Math.round(Math.random() * 50),
        x_end: Math.round(50 + Math.random() * 50),
        y_end: Math.round(50 + Math.random() * 50)
      })),
      population_pyramid: [
        ...['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80+'].flatMap(age => [
          { age_group: age, gender: 'Male', population: Math.round(50 + Math.random() * 100) },
          { age_group: age, gender: 'Female', population: Math.round(50 + Math.random() * 100) }
        ])
      ],
      metric: [{ value: 12345 }],
      gauge: [{ value: 87.5 }],
      bullet: [{ value: 85, target: 95 }],
      radar: Array.from({ length: 8 }, (_, i) => ({
        category: `Metric ${i + 1}`,
        value: Math.round(40 + Math.random() * 60)
      }))
    },

    // ─────────────────────────────────────────────────────────────────────────
    // EMPTY: Empty/null data
    // ─────────────────────────────────────────────────────────────────────────
    empty: {
      default: [],
      timeseries: [],
      scatter: [],
      bubble: [],
      heatmap: [],
      binned_heatmap: [],
      funnel: [],
      sankey: [],
      chord: [],
      waterfall: [],
      wordcloud: [],
      histogram: [],
      boxplot: [],
      ternary: [],
      comet: [],
      population_pyramid: [],
      metric: [],
      gauge: [],
      bullet: [],
      radar: []
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SINGLE: Single data point
    // ─────────────────────────────────────────────────────────────────────────
    single: {
      default: [{ category: 'Only One', value: 100, date: '2024-01-01', subcategory: 'Sub 1' }],
      timeseries: [{ category: 'Series A', value: 100, value1: 100, value2: 50, date: '2024-01-01' }],
      scatter: [{ category: 'Single Point', x_value: 50, y_value: 50 }],
      bubble: [{ category: 'Single Bubble', x_value: 50, y_value: 50, size_value: 200 }],
      heatmap: [{ x_cat: 'Only', y_cat: 'One', value: 75 }],
      binned_heatmap: [{ x_value: 50, y_value: 50 }],
      funnel: [{ stage: 'Single Stage', count: 500 }],
      sankey: [{ source: 'A', target: 'B', value: 100 }],
      chord: [{ source: 'A', target: 'B', value: 100 }],
      waterfall: [{ category: 'Single', value: 100 }],
      wordcloud: [{ word: 'Solitude', frequency: 100 }],
      histogram: [{ value: 50 }],
      boxplot: [{ category: 'A', value: 50 }],
      ternary: [{ category: 'Center', a_value: 0.33, b_value: 0.33, c_value: 0.34 }],
      comet: [{ category: 'Solo', x_start: 20, y_start: 20, x_end: 80, y_end: 80 }],
      population_pyramid: [
        { age_group: '25-34', gender: 'Male', population: 100 },
        { age_group: '25-34', gender: 'Female', population: 100 }
      ],
      metric: [{ value: 1 }],
      gauge: [{ value: 50 }],
      bullet: [{ value: 50, target: 100 }],
      radar: [{ category: 'Single Metric', value: 75 }]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // NEGATIVES: Negative values
    // ─────────────────────────────────────────────────────────────────────────
    negatives: {
      default: [
        { category: 'Positive', value: 100, date: '2024-01-01', subcategory: 'Sub 1' },
        { category: 'Negative', value: -50, date: '2024-01-02', subcategory: 'Sub 2' },
        { category: 'More Neg', value: -80, date: '2024-01-03', subcategory: 'Sub 1' },
        { category: 'Recovery', value: 30, date: '2024-01-04', subcategory: 'Sub 2' },
        { category: 'Deep Neg', value: -120, date: '2024-01-05', subcategory: 'Sub 1' }
      ],
      timeseries: [
        { category: 'Series A', value: 100, value1: 100, value2: -50, date: '2024-01-01' },
        { category: 'Series A', value: -20, value1: -20, value2: 60, date: '2024-01-02' },
        { category: 'Series A', value: 50, value1: 50, value2: -30, date: '2024-01-03' },
        { category: 'Series B', value: -40, value1: -40, value2: 40, date: '2024-01-01' },
        { category: 'Series B', value: 80, value1: 80, value2: -55, date: '2024-01-02' }
      ],
      scatter: [
        { category: 'Q1', x_value: -50, y_value: 50 },
        { category: 'Q2', x_value: 50, y_value: 50 },
        { category: 'Q3', x_value: -50, y_value: -50 },
        { category: 'Q4', x_value: 50, y_value: -50 },
        { category: 'Origin', x_value: 0, y_value: 0 }
      ],
      bubble: [
        { category: 'Q1', x_value: -50, y_value: 50, size_value: 100 },
        { category: 'Q2', x_value: 50, y_value: 50, size_value: 150 },
        { category: 'Q3', x_value: -50, y_value: -50, size_value: 200 },
        { category: 'Q4', x_value: 50, y_value: -50, size_value: 120 }
      ],
      heatmap: [
        { x_cat: 'A', y_cat: 'X', value: -50 },
        { x_cat: 'A', y_cat: 'Y', value: 30 },
        { x_cat: 'B', y_cat: 'X', value: 20 },
        { x_cat: 'B', y_cat: 'Y', value: -80 }
      ],
      waterfall: [
        { category: 'Start', value: 0 },
        { category: 'Loss 1', value: -100 },
        { category: 'Gain 1', value: 150 },
        { category: 'Loss 2', value: -75 },
        { category: 'End', value: -25 }
      ],
      histogram: [
        { value: -50 }, { value: -30 }, { value: -10 }, { value: 0 },
        { value: 10 }, { value: 30 }, { value: 50 }, { value: 70 }
      ],
      boxplot: [
        { category: 'Mixed', value: -50 },
        { category: 'Mixed', value: -20 },
        { category: 'Mixed', value: 0 },
        { category: 'Mixed', value: 30 },
        { category: 'Mixed', value: 60 }
      ],
      metric: [{ value: -42 }],
      gauge: [{ value: -25 }],
      bullet: [{ value: -30, target: 50 }],
      radar: [
        { category: 'Metric A', value: 80 },
        { category: 'Metric B', value: -20 },
        { category: 'Metric C', value: 60 },
        { category: 'Metric D', value: -40 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ZEROS: Zero values mixed in
    // ─────────────────────────────────────────────────────────────────────────
    zeros: {
      default: [
        { category: 'Has Value', value: 100, date: '2024-01-01', subcategory: 'Sub 1' },
        { category: 'Zero', value: 0, date: '2024-01-02', subcategory: 'Sub 2' },
        { category: 'Another', value: 50, date: '2024-01-03', subcategory: 'Sub 1' },
        { category: 'Also Zero', value: 0, date: '2024-01-04', subcategory: 'Sub 2' },
        { category: 'Final', value: 75, date: '2024-01-05', subcategory: 'Sub 1' }
      ],
      timeseries: [
        { category: 'Series A', value: 100, value1: 100, value2: 0, date: '2024-01-01' },
        { category: 'Series A', value: 0, value1: 0, value2: 60, date: '2024-01-02' },
        { category: 'Series A', value: 50, value1: 50, value2: 0, date: '2024-01-03' }
      ],
      scatter: [
        { category: 'Origin', x_value: 0, y_value: 0 },
        { category: 'X-axis', x_value: 50, y_value: 0 },
        { category: 'Y-axis', x_value: 0, y_value: 50 },
        { category: 'Normal', x_value: 50, y_value: 50 }
      ],
      bubble: [
        { category: 'Zero Size', x_value: 25, y_value: 25, size_value: 0 },
        { category: 'Normal', x_value: 75, y_value: 75, size_value: 200 }
      ],
      heatmap: [
        { x_cat: 'A', y_cat: 'X', value: 0 },
        { x_cat: 'A', y_cat: 'Y', value: 50 },
        { x_cat: 'B', y_cat: 'X', value: 75 },
        { x_cat: 'B', y_cat: 'Y', value: 0 }
      ],
      funnel: [
        { stage: 'Start', count: 1000 },
        { stage: 'Zero Drop', count: 0 },
        { stage: 'Recovery', count: 500 },
        { stage: 'End', count: 200 }
      ],
      sankey: [
        { source: 'A', target: 'X', value: 100 },
        { source: 'A', target: 'Y', value: 0 },
        { source: 'B', target: 'X', value: 0 },
        { source: 'B', target: 'Y', value: 80 }
      ],
      waterfall: [
        { category: 'Start', value: 100 },
        { category: 'No Change', value: 0 },
        { category: 'Increase', value: 50 },
        { category: 'Zero Again', value: 0 },
        { category: 'End', value: 150 }
      ],
      wordcloud: [
        { word: 'Popular', frequency: 100 },
        { word: 'Zero', frequency: 0 },
        { word: 'Medium', frequency: 50 },
        { word: 'AlsoZero', frequency: 0 }
      ],
      metric: [{ value: 0 }],
      gauge: [{ value: 0 }],
      bullet: [{ value: 0, target: 100 }],
      radar: [
        { category: 'Full', value: 100 },
        { category: 'Zero', value: 0 },
        { category: 'Half', value: 50 },
        { category: 'AlsoZero', value: 0 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // DECIMALS: Floating point precision
    // ─────────────────────────────────────────────────────────────────────────
    decimals: {
      default: [
        { category: 'Pi', value: 3.14159265359, date: '2024-01-01', subcategory: 'Math' },
        { category: 'E', value: 2.71828182846, date: '2024-01-02', subcategory: 'Math' },
        { category: 'Phi', value: 1.61803398875, date: '2024-01-03', subcategory: 'Math' },
        { category: 'Sqrt2', value: 1.41421356237, date: '2024-01-04', subcategory: 'Math' },
        { category: 'Tiny', value: 0.00000001, date: '2024-01-05', subcategory: 'Small' }
      ],
      timeseries: [
        { category: 'Series A', value: 99.99999, value1: 0.001, value2: 0.0001, date: '2024-01-01' },
        { category: 'Series A', value: 100.00001, value1: 0.002, value2: 0.0002, date: '2024-01-02' },
        { category: 'Series A', value: 99.99998, value1: 0.0015, value2: 0.00015, date: '2024-01-03' }
      ],
      scatter: [
        { category: 'P1', x_value: 0.123456789, y_value: 0.987654321 },
        { category: 'P2', x_value: 0.111111111, y_value: 0.222222222 },
        { category: 'P3', x_value: 0.333333333, y_value: 0.666666666 }
      ],
      bubble: [
        { category: 'B1', x_value: 0.1, y_value: 0.2, size_value: 0.001 },
        { category: 'B2', x_value: 0.5, y_value: 0.5, size_value: 0.005 }
      ],
      heatmap: [
        { x_cat: 'A', y_cat: 'X', value: 0.123 },
        { x_cat: 'A', y_cat: 'Y', value: 0.456 },
        { x_cat: 'B', y_cat: 'X', value: 0.789 },
        { x_cat: 'B', y_cat: 'Y', value: 0.012 }
      ],
      ternary: [
        { category: 'Precise', a_value: 0.333333333, b_value: 0.333333333, c_value: 0.333333334 }
      ],
      metric: [{ value: 0.123456789 }],
      gauge: [{ value: 33.333333 }],
      bullet: [{ value: 66.666666, target: 99.999999 }],
      radar: [
        { category: 'A', value: 0.1 },
        { category: 'B', value: 0.01 },
        { category: 'C', value: 0.001 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // UNICODE: Unicode and special characters
    // ─────────────────────────────────────────────────────────────────────────
    unicode: {
      default: [
        { category: '日本語', value: 100, date: '2024-01-01', subcategory: 'アジア' },
        { category: '中文', value: 80, date: '2024-01-02', subcategory: 'アジア' },
        { category: 'Émojis 🎉', value: 60, date: '2024-01-03', subcategory: '特殊' },
        { category: 'Ñoño', value: 40, date: '2024-01-04', subcategory: 'España' },
        { category: 'Ελληνικά', value: 20, date: '2024-01-05', subcategory: 'Ευρώπη' }
      ],
      timeseries: [
        { category: '系列 A', value: 100, value1: 100, value2: 50, date: '2024-01-01' },
        { category: '系列 A', value: 120, value1: 120, value2: 60, date: '2024-01-02' },
        { category: '系列 B 📈', value: 80, value1: 80, value2: 40, date: '2024-01-01' }
      ],
      scatter: [
        { category: 'Точка 1', x_value: 20, y_value: 30 },
        { category: 'نقطة 2', x_value: 50, y_value: 60 },
        { category: '点 3 🔵', x_value: 80, y_value: 40 }
      ],
      heatmap: [
        { x_cat: '月曜日', y_cat: '朝', value: 50 },
        { x_cat: '月曜日', y_cat: '午後', value: 75 },
        { x_cat: '火曜日', y_cat: '朝', value: 60 },
        { x_cat: '火曜日', y_cat: '午後', value: 85 }
      ],
      funnel: [
        { stage: '認知 👀', count: 1000 },
        { stage: '興味 💡', count: 700 },
        { stage: '検討 🤔', count: 400 },
        { stage: '購入 💰', count: 200 }
      ],
      wordcloud: [
        { word: 'プログラミング', frequency: 100 },
        { word: '开发', frequency: 90 },
        { word: 'Código', frequency: 80 },
        { word: 'Программирование', frequency: 70 },
        { word: '🚀 Rocket', frequency: 60 }
      ],
      radar: [
        { category: '速度 ⚡', value: 80 },
        { category: '力 💪', value: 65 },
        { category: '防御 🛡️', value: 90 },
        { category: '敏捷', value: 70 }
      ],
      metric: [{ value: 42 }],
      gauge: [{ value: 75 }],
      bullet: [{ value: 75, target: 90 }]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // OUTLIERS: Extreme outliers
    // ─────────────────────────────────────────────────────────────────────────
    outliers: {
      default: [
        { category: 'Normal 1', value: 100, date: '2024-01-01', subcategory: 'Normal' },
        { category: 'Normal 2', value: 95, date: '2024-01-02', subcategory: 'Normal' },
        { category: 'Normal 3', value: 105, date: '2024-01-03', subcategory: 'Normal' },
        { category: 'OUTLIER', value: 10000, date: '2024-01-04', subcategory: 'Extreme' },
        { category: 'Normal 4', value: 98, date: '2024-01-05', subcategory: 'Normal' }
      ],
      timeseries: [
        { category: 'Series A', value: 100, value1: 100, value2: 50, date: '2024-01-01' },
        { category: 'Series A', value: 105, value1: 105, value2: 52, date: '2024-01-02' },
        { category: 'Series A', value: 5000, value1: 5000, value2: 2500, date: '2024-01-03' },
        { category: 'Series A', value: 98, value1: 98, value2: 49, date: '2024-01-04' }
      ],
      scatter: [
        { category: 'Cluster', x_value: 50, y_value: 50 },
        { category: 'Cluster', x_value: 52, y_value: 48 },
        { category: 'Cluster', x_value: 48, y_value: 52 },
        { category: 'FAR OUT', x_value: 500, y_value: 500 },
        { category: 'OPPOSITE', x_value: -200, y_value: -200 }
      ],
      bubble: [
        { category: 'Normal', x_value: 50, y_value: 50, size_value: 100 },
        { category: 'Huge', x_value: 60, y_value: 60, size_value: 10000 },
        { category: 'Tiny', x_value: 40, y_value: 40, size_value: 1 }
      ],
      heatmap: [
        { x_cat: 'A', y_cat: 'X', value: 50 },
        { x_cat: 'A', y_cat: 'Y', value: 55 },
        { x_cat: 'B', y_cat: 'X', value: 10000 },
        { x_cat: 'B', y_cat: 'Y', value: 52 }
      ],
      histogram: [
        { value: 50 }, { value: 52 }, { value: 48 }, { value: 51 },
        { value: 49 }, { value: 53 }, { value: 47 }, { value: 1000 }
      ],
      boxplot: [
        { category: 'A', value: 50 },
        { category: 'A', value: 52 },
        { category: 'A', value: 48 },
        { category: 'A', value: 500 },
        { category: 'A', value: 51 },
        { category: 'A', value: -100 }
      ],
      waterfall: [
        { category: 'Start', value: 100 },
        { category: 'Normal', value: 10 },
        { category: 'SPIKE', value: 5000 },
        { category: 'Normal', value: -15 },
        { category: 'End', value: 5095 }
      ],
      metric: [{ value: 999999999 }],
      gauge: [{ value: 150 }],
      bullet: [{ value: 200, target: 100 }],
      radar: [
        { category: 'Normal', value: 50 },
        { category: 'SPIKE', value: 1000 },
        { category: 'Normal', value: 55 },
        { category: 'Normal', value: 48 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // VERY_LARGE: Billions/trillions - number formatting
    // ─────────────────────────────────────────────────────────────────────────
    very_large: {
      default: [
        { category: 'Revenue', value: 1234567890123, date: '2024-01-01', subcategory: 'Finance' },
        { category: 'Users', value: 987654321000, date: '2024-01-02', subcategory: 'Metrics' },
        { category: 'Transactions', value: 5678901234567, date: '2024-01-03', subcategory: 'Finance' },
        { category: 'Events', value: 2345678901234, date: '2024-01-04', subcategory: 'Metrics' },
        { category: 'Requests', value: 8901234567890, date: '2024-01-05', subcategory: 'Tech' }
      ],
      timeseries: [
        { category: 'Series A', value: 1500000000000, value1: 1500000000000, value2: 750000000000, date: '2024-01-01' },
        { category: 'Series A', value: 2300000000000, value1: 2300000000000, value2: 1150000000000, date: '2024-01-02' },
        { category: 'Series A', value: 1800000000000, value1: 1800000000000, value2: 900000000000, date: '2024-01-03' }
      ],
      scatter: [
        { category: 'P1', x_value: 1000000000, y_value: 2000000000 },
        { category: 'P2', x_value: 5000000000, y_value: 3000000000 },
        { category: 'P3', x_value: 8000000000, y_value: 9000000000 }
      ],
      metric: [{ value: 12345678901234 }],
      gauge: [{ value: 999999999999 }],
      bullet: [{ value: 750000000000, target: 1000000000000 }],
      radar: [
        { category: 'Metric A', value: 1000000000 },
        { category: 'Metric B', value: 5000000000 },
        { category: 'Metric C', value: 2500000000 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ALL_SAME: All identical values - flat line/zero range handling
    // ─────────────────────────────────────────────────────────────────────────
    all_same: {
      default: [
        { category: 'A', value: 50, date: '2024-01-01', subcategory: 'Same' },
        { category: 'B', value: 50, date: '2024-01-02', subcategory: 'Same' },
        { category: 'C', value: 50, date: '2024-01-03', subcategory: 'Same' },
        { category: 'D', value: 50, date: '2024-01-04', subcategory: 'Same' },
        { category: 'E', value: 50, date: '2024-01-05', subcategory: 'Same' }
      ],
      timeseries: [
        { category: 'Series A', value: 100, value1: 100, value2: 50, date: '2024-01-01' },
        { category: 'Series A', value: 100, value1: 100, value2: 50, date: '2024-01-02' },
        { category: 'Series A', value: 100, value1: 100, value2: 50, date: '2024-01-03' },
        { category: 'Series A', value: 100, value1: 100, value2: 50, date: '2024-01-04' },
        { category: 'Series A', value: 100, value1: 100, value2: 50, date: '2024-01-05' }
      ],
      scatter: [
        { category: 'P1', x_value: 50, y_value: 50 },
        { category: 'P2', x_value: 50, y_value: 50 },
        { category: 'P3', x_value: 50, y_value: 50 },
        { category: 'P4', x_value: 50, y_value: 50 }
      ],
      heatmap: [
        { x_cat: 'A', y_cat: 'X', value: 75 },
        { x_cat: 'A', y_cat: 'Y', value: 75 },
        { x_cat: 'B', y_cat: 'X', value: 75 },
        { x_cat: 'B', y_cat: 'Y', value: 75 }
      ],
      histogram: Array.from({ length: 20 }, () => ({ value: 50 })),
      boxplot: Array.from({ length: 10 }, () => ({ category: 'A', value: 50 })),
      metric: [{ value: 42 }],
      gauge: [{ value: 50 }],
      bullet: [{ value: 50, target: 50 }],
      radar: [
        { category: 'A', value: 75 },
        { category: 'B', value: 75 },
        { category: 'C', value: 75 },
        { category: 'D', value: 75 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LONG_LABELS: 50+ character category names - text truncation
    // ─────────────────────────────────────────────────────────────────────────
    long_labels: {
      default: [
        { category: 'This is an extremely long category name that should definitely be truncated somewhere', value: 100, date: '2024-01-01', subcategory: 'Long Subcategory Name Here Too' },
        { category: 'Another very long category name with lots of words and characters to test truncation behavior', value: 80, date: '2024-01-02', subcategory: 'More Long Text' },
        { category: 'Yet another unnecessarily verbose category label for testing purposes only', value: 60, date: '2024-01-03', subcategory: 'Testing' },
        { category: 'Short', value: 40, date: '2024-01-04', subcategory: 'OK' },
        { category: 'The final long category name that goes on and on and on without stopping', value: 20, date: '2024-01-05', subcategory: 'End' }
      ],
      timeseries: [
        { category: 'Series with an incredibly long name that needs to be handled gracefully', value: 100, value1: 100, value2: 50, date: '2024-01-01' },
        { category: 'Series with an incredibly long name that needs to be handled gracefully', value: 120, value1: 120, value2: 60, date: '2024-01-02' }
      ],
      funnel: [
        { stage: 'Initial Awareness and Discovery Phase of Customer Journey', count: 1000 },
        { stage: 'Consideration and Evaluation of Multiple Options', count: 700 },
        { stage: 'Final Decision Making Process After Careful Review', count: 400 },
        { stage: 'Purchase Completion and Transaction Finalization', count: 200 }
      ],
      wordcloud: [
        { word: 'SupercalifragilisticexpialidociousAndEvenMore', frequency: 100 },
        { word: 'AnotherExtremelyLongWordThatShouldNotExist', frequency: 80 },
        { word: 'ThisIsAVeryLongCompoundWordForTesting', frequency: 60 }
      ],
      radar: [
        { category: 'Customer Satisfaction Score Over Long Period', value: 80 },
        { category: 'Employee Engagement and Retention Metrics', value: 65 },
        { category: 'Net Promoter Score Quarterly Average', value: 90 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // MANY_CATEGORIES: 100+ categories - color cycling, legend overflow
    // ─────────────────────────────────────────────────────────────────────────
    many_categories: {
      default: Array.from({ length: 100 }, (_, i) => ({
        category: `Category ${String(i + 1).padStart(3, '0')}`,
        value: Math.round(50 + Math.random() * 100),
        date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
        subcategory: `Group ${Math.floor(i / 10) + 1}`
      })),
      scatter: Array.from({ length: 100 }, (_, i) => ({
        category: `Point ${i + 1}`,
        x_value: Math.round(Math.random() * 100),
        y_value: Math.round(Math.random() * 100)
      })),
      funnel: Array.from({ length: 20 }, (_, i) => ({
        stage: `Stage ${i + 1}`,
        count: Math.round(1000 * Math.pow(0.85, i))
      })),
      wordcloud: Array.from({ length: 100 }, (_, i) => ({
        word: `Word${i + 1}`,
        frequency: Math.round(100 - i * 0.8)
      })),
      radar: Array.from({ length: 12 }, (_, i) => ({
        category: `Metric ${i + 1}`,
        value: Math.round(40 + Math.random() * 60)
      }))
    },

    // ─────────────────────────────────────────────────────────────────────────
    // MISSING_PERIODS: Time gaps in data - interpolation behavior
    // ─────────────────────────────────────────────────────────────────────────
    missing_periods: {
      default: [
        { category: 'A', value: 100, date: '2024-01-01', subcategory: 'Sub' },
        { category: 'B', value: 80, date: '2024-01-05', subcategory: 'Sub' },
        { category: 'C', value: 120, date: '2024-01-15', subcategory: 'Sub' },
        { category: 'D', value: 90, date: '2024-01-25', subcategory: 'Sub' },
        { category: 'E', value: 110, date: '2024-02-10', subcategory: 'Sub' }
      ],
      timeseries: [
        { category: 'Series A', value: 100, value1: 100, value2: 50, date: '2024-01-01' },
        { category: 'Series A', value: 120, value1: 120, value2: 60, date: '2024-01-02' },
        // Gap: Jan 3-9 missing
        { category: 'Series A', value: 90, value1: 90, value2: 45, date: '2024-01-10' },
        { category: 'Series A', value: 110, value1: 110, value2: 55, date: '2024-01-11' },
        // Gap: Jan 12-19 missing
        { category: 'Series A', value: 130, value1: 130, value2: 65, date: '2024-01-20' }
      ],
      heatmap: [
        { x_cat: 'Mon', y_cat: 'Morning', value: 50 },
        // Missing: Mon Afternoon, Mon Evening
        { x_cat: 'Tue', y_cat: 'Morning', value: 60 },
        { x_cat: 'Tue', y_cat: 'Evening', value: 70 },
        // Missing: Wed entirely
        { x_cat: 'Thu', y_cat: 'Afternoon', value: 80 },
        { x_cat: 'Fri', y_cat: 'Morning', value: 55 },
        { x_cat: 'Fri', y_cat: 'Evening', value: 65 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // MIXED_MAGNITUDE: 0.001 to 1M in same dataset - log scale needs
    // ─────────────────────────────────────────────────────────────────────────
    mixed_magnitude: {
      default: [
        { category: 'Tiny', value: 0.0001, date: '2024-01-01', subcategory: 'Small' },
        { category: 'Small', value: 0.1, date: '2024-01-02', subcategory: 'Small' },
        { category: 'Medium', value: 100, date: '2024-01-03', subcategory: 'Mid' },
        { category: 'Large', value: 100000, date: '2024-01-04', subcategory: 'Big' },
        { category: 'Huge', value: 10000000, date: '2024-01-05', subcategory: 'Big' }
      ],
      timeseries: [
        { category: 'Series A', value: 0.001, value1: 0.001, value2: 0.0005, date: '2024-01-01' },
        { category: 'Series A', value: 10, value1: 10, value2: 5, date: '2024-01-02' },
        { category: 'Series A', value: 10000, value1: 10000, value2: 5000, date: '2024-01-03' },
        { category: 'Series A', value: 1000000, value1: 1000000, value2: 500000, date: '2024-01-04' }
      ],
      scatter: [
        { category: 'Micro', x_value: 0.001, y_value: 0.002 },
        { category: 'Small', x_value: 1, y_value: 2 },
        { category: 'Medium', x_value: 1000, y_value: 2000 },
        { category: 'Large', x_value: 1000000, y_value: 2000000 }
      ],
      histogram: [
        { value: 0.001 }, { value: 0.01 }, { value: 0.1 }, { value: 1 },
        { value: 10 }, { value: 100 }, { value: 1000 }, { value: 10000 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // NAN_VALUES: NaN mixed with valid numbers - error handling
    // ─────────────────────────────────────────────────────────────────────────
    nan_values: {
      default: [
        { category: 'Valid 1', value: 100, date: '2024-01-01', subcategory: 'OK' },
        { category: 'NaN Entry', value: NaN, date: '2024-01-02', subcategory: 'Bad' },
        { category: 'Valid 2', value: 80, date: '2024-01-03', subcategory: 'OK' },
        { category: 'Another NaN', value: NaN, date: '2024-01-04', subcategory: 'Bad' },
        { category: 'Valid 3', value: 60, date: '2024-01-05', subcategory: 'OK' }
      ],
      timeseries: [
        { category: 'Series A', value: 100, value1: 100, value2: NaN, date: '2024-01-01' },
        { category: 'Series A', value: NaN, value1: NaN, value2: 60, date: '2024-01-02' },
        { category: 'Series A', value: 90, value1: 90, value2: 45, date: '2024-01-03' }
      ],
      scatter: [
        { category: 'Valid', x_value: 50, y_value: 50 },
        { category: 'X NaN', x_value: NaN, y_value: 60 },
        { category: 'Y NaN', x_value: 70, y_value: NaN },
        { category: 'Both NaN', x_value: NaN, y_value: NaN }
      ],
      metric: [{ value: NaN }],
      gauge: [{ value: NaN }]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // HTML_INJECTION: XSS test - <script> in labels
    // ─────────────────────────────────────────────────────────────────────────
    html_injection: {
      default: [
        { category: '<script>alert("XSS")</script>', value: 100, date: '2024-01-01', subcategory: '<b>Bold</b>' },
        { category: '<img src=x onerror=alert(1)>', value: 80, date: '2024-01-02', subcategory: '<i>Italic</i>' },
        { category: '"><script>evil()</script>', value: 60, date: '2024-01-03', subcategory: 'Normal' },
        { category: "javascript:alert('XSS')", value: 40, date: '2024-01-04', subcategory: '<div onclick="bad()">' },
        { category: '<iframe src="evil.com">', value: 20, date: '2024-01-05', subcategory: '</div><script>' }
      ],
      timeseries: [
        { category: '<script>alert(1)</script>', value: 100, value1: 100, value2: 50, date: '2024-01-01' },
        { category: '<script>alert(1)</script>', value: 120, value1: 120, value2: 60, date: '2024-01-02' }
      ],
      wordcloud: [
        { word: '<script>alert(1)</script>', frequency: 100 },
        { word: '<img src=x onerror=alert(1)>', frequency: 80 },
        { word: '"><svg onload=alert(1)>', frequency: 60 }
      ],
      funnel: [
        { stage: '<script>document.cookie</script>', count: 1000 },
        { stage: '<img src=x onerror=fetch("evil")>', count: 500 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CIRCULAR_REF: A→B→C→A in flow data - infinite loop prevention
    // ─────────────────────────────────────────────────────────────────────────
    circular_ref: {
      sankey: [
        { source: 'A', target: 'B', value: 100 },
        { source: 'B', target: 'C', value: 80 },
        { source: 'C', target: 'A', value: 60 },  // Creates cycle
        { source: 'A', target: 'C', value: 40 },  // Additional edge
        { source: 'B', target: 'A', value: 30 }   // Another back-edge
      ],
      chord: [
        { source: 'Group A', target: 'Group B', value: 100 },
        { source: 'Group B', target: 'Group C', value: 80 },
        { source: 'Group C', target: 'Group A', value: 60 },
        { source: 'Group A', target: 'Group C', value: 50 },
        { source: 'Group B', target: 'Group A', value: 40 },
        { source: 'Group C', target: 'Group B', value: 30 }
      ],
      default: [
        { category: 'Node A', value: 100, date: '2024-01-01', subcategory: 'Cycle' },
        { category: 'Node B', value: 80, date: '2024-01-02', subcategory: 'Cycle' },
        { category: 'Node C', value: 60, date: '2024-01-03', subcategory: 'Cycle' }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // RTL_TEXT: Arabic/Hebrew labels - right-to-left text direction
    // ─────────────────────────────────────────────────────────────────────────
    rtl_text: {
      default: [
        { category: 'مرحبا بالعالم', value: 100, date: '2024-01-01', subcategory: 'عربي' },
        { category: 'שלום עולם', value: 80, date: '2024-01-02', subcategory: 'עברית' },
        { category: 'فارسی متن', value: 60, date: '2024-01-03', subcategory: 'فارسی' },
        { category: 'Mixed مختلط Text', value: 40, date: '2024-01-04', subcategory: 'Mixed' },
        { category: '123 ערבוב 456', value: 20, date: '2024-01-05', subcategory: 'Numbers' }
      ],
      timeseries: [
        { category: 'سلسلة أ', value: 100, value1: 100, value2: 50, date: '2024-01-01' },
        { category: 'سلسلة أ', value: 120, value1: 120, value2: 60, date: '2024-01-02' },
        { category: 'סדרה ב', value: 80, value1: 80, value2: 40, date: '2024-01-01' }
      ],
      funnel: [
        { stage: 'الوعي', count: 1000 },
        { stage: 'الاهتمام', count: 700 },
        { stage: 'القرار', count: 400 },
        { stage: 'الشراء', count: 200 }
      ],
      wordcloud: [
        { word: 'برمجة', frequency: 100 },
        { word: 'תכנות', frequency: 90 },
        { word: 'کدنویسی', frequency: 80 },
        { word: 'تطوير', frequency: 70 }
      ],
      radar: [
        { category: 'السرعة', value: 80 },
        { category: 'הכוח', value: 65 },
        { category: 'الدفاع', value: 90 },
        { category: 'זריזות', value: 70 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SPARSE: Many empty buckets/gaps in categorical data
    // ─────────────────────────────────────────────────────────────────────────
    sparse: {
      default: [
        { category: 'A', value: 100, date: '2024-01-01', subcategory: 'Has Data' },
        // B, C, D, E missing
        { category: 'F', value: 80, date: '2024-01-06', subcategory: 'Has Data' },
        // G, H, I missing
        { category: 'J', value: 60, date: '2024-01-10', subcategory: 'Has Data' },
        // K through O missing
        { category: 'P', value: 40, date: '2024-01-16', subcategory: 'Has Data' }
      ],
      timeseries: [
        { category: 'Series A', value: 100, value1: 100, value2: 50, date: '2024-01-01' },
        // Long gap
        { category: 'Series A', value: 110, value1: 110, value2: 55, date: '2024-02-15' },
        // Another long gap
        { category: 'Series A', value: 90, value1: 90, value2: 45, date: '2024-04-01' }
      ],
      heatmap: [
        { x_cat: 'Mon', y_cat: 'Morning', value: 50 },
        // Most cells empty
        { x_cat: 'Wed', y_cat: 'Afternoon', value: 75 },
        { x_cat: 'Fri', y_cat: 'Evening', value: 60 }
      ],
      histogram: [
        { value: 10 },
        // Gap from 10-40
        { value: 45 },
        // Gap from 45-80
        { value: 85 },
        { value: 87 }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────────
    // DEEP_HIERARCHY: 5+ levels of nesting
    // ─────────────────────────────────────────────────────────────────────────
    deep_hierarchy: {
      default: [
        { category: 'L1/L2/L3/L4/L5/Leaf1', value: 100, date: '2024-01-01', subcategory: 'Deep' },
        { category: 'L1/L2/L3/L4/L5/Leaf2', value: 80, date: '2024-01-02', subcategory: 'Deep' },
        { category: 'L1/L2/L3/L4/Leaf3', value: 60, date: '2024-01-03', subcategory: 'Level4' },
        { category: 'L1/L2/L3/Leaf4', value: 40, date: '2024-01-04', subcategory: 'Level3' },
        { category: 'L1/L2/Leaf5', value: 20, date: '2024-01-05', subcategory: 'Level2' }
      ],
      // Treemap/sunburst hierarchical data
      treemap: [
        { category: 'Root', parent: null, value: null },
        { category: 'Branch A', parent: 'Root', value: null },
        { category: 'Branch B', parent: 'Root', value: null },
        { category: 'Sub A1', parent: 'Branch A', value: null },
        { category: 'Sub A2', parent: 'Branch A', value: null },
        { category: 'Sub B1', parent: 'Branch B', value: null },
        { category: 'Deep A1a', parent: 'Sub A1', value: null },
        { category: 'Deep A1b', parent: 'Sub A1', value: null },
        { category: 'Deeper A1a1', parent: 'Deep A1a', value: null },
        { category: 'Leaf 1', parent: 'Deeper A1a1', value: 100 },
        { category: 'Leaf 2', parent: 'Deeper A1a1', value: 80 },
        { category: 'Leaf 3', parent: 'Deep A1b', value: 60 },
        { category: 'Leaf 4', parent: 'Sub A2', value: 90 },
        { category: 'Leaf 5', parent: 'Sub B1', value: 70 }
      ],
      sankey: [
        { source: 'Level 1', target: 'Level 2a', value: 100 },
        { source: 'Level 1', target: 'Level 2b', value: 80 },
        { source: 'Level 2a', target: 'Level 3a', value: 60 },
        { source: 'Level 2a', target: 'Level 3b', value: 40 },
        { source: 'Level 2b', target: 'Level 3c', value: 80 },
        { source: 'Level 3a', target: 'Level 4a', value: 60 },
        { source: 'Level 3b', target: 'Level 4b', value: 40 },
        { source: 'Level 3c', target: 'Level 4c', value: 80 },
        { source: 'Level 4a', target: 'Level 5', value: 60 },
        { source: 'Level 4b', target: 'Level 5', value: 40 },
        { source: 'Level 4c', target: 'Level 5', value: 80 }
      ]
    }
  };

  // Get scenario data
  const scenarioData = scenarioGenerators[scenario];
  if (!scenarioData) {
    throw new Error(`Unknown scenario: ${scenario}`);
  }

  // Get chart-specific data or fall back to default
  return scenarioData[chartType] || scenarioData.default || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO CONFIG OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════

export function getScenarioConfig(baseConfig, scenario) {
  // Some scenarios need config adjustments
  const configOverrides = {
    empty: {
      // Empty data might need special handling
    },
    large: {
      // Large datasets might need pagination hints
    },
    unicode: {
      // Unicode might need font specification
    }
  };

  return { ...baseConfig, ...(configOverrides[scenario] || {}) };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHART TYPE TO DATA TYPE MAPPING
// ═══════════════════════════════════════════════════════════════════════════

export const CHART_DATA_TYPES = {
  // Categorical charts
  bar: 'default',
  pie: 'default',
  donut: 'default',
  marimekko: 'default',
  treemap: 'default',
  circle_packing: 'default',
  radial: 'default',
  pareto: 'default',

  // Time series charts
  line: 'timeseries',
  area: 'timeseries',
  rolling_average: 'timeseries',
  sparkline: 'timeseries',
  horizon: 'timeseries',
  streamgraph: 'timeseries',
  lasagna: 'timeseries',
  dual_axis: 'timeseries',
  trellis_area: 'timeseries',
  heatlane: 'timeseries',

  // Point-based charts
  scatter: 'scatter',
  bubble: 'bubble',

  // Heatmap charts
  heatmap: 'heatmap',
  binned_heatmap: 'binned_heatmap',

  // Flow charts
  funnel: 'funnel',
  sankey: 'sankey',
  chord: 'chord',
  waterfall: 'waterfall',

  // Distribution charts
  histogram: 'histogram',
  boxplot: 'boxplot',
  density: 'histogram',
  error_bars: 'default',
  violin: 'boxplot',

  // Text charts
  wordcloud: 'wordcloud',
  table: 'default',

  // Specialty charts
  ternary: 'ternary',
  comet: 'comet',
  population_pyramid: 'population_pyramid',

  // Gauge/metric charts
  metric: 'metric',
  gauge: 'gauge',
  bullet: 'bullet',
  radar: 'radar'
};

export default {
  SCENARIOS,
  generateScenarioData,
  getScenarioConfig,
  CHART_DATA_TYPES
};
