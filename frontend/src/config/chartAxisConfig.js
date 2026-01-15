import {
  Hash,
  TrendingUp
} from 'lucide-vue-next'

/**
 * Chart Axis Configuration
 *
 * Defines the axes/fields required for each chart type in the visualization builder.
 * Each chart type has an array of axis definitions with:
 * - id: Unique identifier for the axis
 * - name: Display name shown to users
 * - description: Help text explaining the axis purpose
 * - fieldType: Type of field expected ('bucket', 'metric', 'numeric', 'any')
 * - required: Whether the field must be configured
 * - configKey: Key used in vega config store
 */
export const axisConfig = {
  bar: [
    { id: 'x', name: 'Categories (X-Axis)', description: 'What to group by', fieldType: 'bucket', required: true, configKey: 'xField' },
    { id: 'y', name: 'Values (Y-Axis)', description: 'What to measure', fieldType: 'metric', required: true, configKey: 'yField' },
    { id: 'color', name: 'Color', description: 'Split by color', fieldType: 'bucket', required: false, configKey: 'colorField' }
  ],
  line: [
    { id: 'x', name: 'Time/Categories (X-Axis)', description: 'Timeline or categories', fieldType: 'bucket', required: true, configKey: 'xField' },
    { id: 'y', name: 'Values (Y-Axis)', description: 'What to measure', fieldType: 'metric', required: true, configKey: 'yField' },
    { id: 'color', name: 'Series', description: 'Split into lines', fieldType: 'bucket', required: false, configKey: 'colorField' }
  ],
  area: [
    { id: 'x', name: 'Time/Categories (X-Axis)', description: 'Timeline or categories', fieldType: 'bucket', required: true, configKey: 'xField' },
    { id: 'y', name: 'Values (Y-Axis)', description: 'What to measure', fieldType: 'metric', required: true, configKey: 'yField' },
    { id: 'color', name: 'Stacked By', description: 'Stack by category', fieldType: 'bucket', required: false, configKey: 'colorField' }
  ],
  pie: [
    { id: 'x', name: 'Slices', description: 'What to slice by', fieldType: 'bucket', required: true, configKey: 'categoryField' },
    { id: 'y', name: 'Size', description: 'Slice size', fieldType: 'metric', required: true, configKey: 'valueField' }
  ],
  donut: [
    { id: 'x', name: 'Slices', description: 'What to slice by', fieldType: 'bucket', required: true, configKey: 'categoryField' },
    { id: 'y', name: 'Size', description: 'Slice size', fieldType: 'metric', required: true, configKey: 'valueField' }
  ],
  scatter: [
    { id: 'x', name: 'X-Axis', description: 'Horizontal position', fieldType: 'metric', required: true, configKey: 'xField' },
    { id: 'y', name: 'Y-Axis', description: 'Vertical position', fieldType: 'metric', required: true, configKey: 'yField' },
    { id: 'color', name: 'Color', description: 'Color by category', fieldType: 'bucket', required: true, configKey: 'colorField' },
    { id: 'size', name: 'Size', description: 'Point size', fieldType: 'metric', required: false, configKey: 'sizeField' }
  ],
  // bubble disabled - use scatter with size field instead
  // bubble: [
  //   { id: 'x', name: 'X-Axis', description: 'Horizontal position (quantitative)', fieldType: 'metric', required: true, configKey: 'xField' },
  //   { id: 'y', name: 'Y-Axis', description: 'Vertical position (quantitative)', fieldType: 'metric', required: true, configKey: 'yField' },
  //   { id: 'size', name: 'Bubble Size', description: 'Size encoding (quantitative)', fieldType: 'metric', required: true, configKey: 'sizeField' },
  //   { id: 'color', name: 'Color', description: 'Color by category', fieldType: 'bucket', required: false, configKey: 'colorField' }
  // ],
  binned_heatmap: [
    { id: 'x', name: 'X-Axis', description: 'Horizontal values (quantitative)', fieldType: 'metric', required: true, configKey: 'xField' },
    { id: 'y', name: 'Y-Axis', description: 'Vertical values (quantitative)', fieldType: 'metric', required: true, configKey: 'yField' }
  ],
  heatmap: [
    { id: 'x', name: 'Columns', description: 'Horizontal categories', fieldType: 'bucket', required: true, configKey: 'xField' },
    { id: 'y', name: 'Rows', description: 'Vertical categories', fieldType: 'bucket', required: true, configKey: 'yField' },
    { id: 'color', name: 'Intensity', description: 'Cell value', fieldType: 'metric', required: true, configKey: 'valueField' }
  ],
  histogram: [
    { id: 'x', name: 'Values', description: 'Distribution of values', fieldType: 'numeric', required: true, configKey: 'valueField' }
  ],
  boxplot: [
    { id: 'x', name: 'Categories', description: 'Group by category', fieldType: 'bucket', required: true, configKey: 'categoryField' },
    { id: 'y', name: 'Values', description: 'Value distribution', fieldType: 'numeric', required: true, configKey: 'valueField' }
  ],
  treemap: [
    { id: 'x', name: 'Categories', description: 'What to group by', fieldType: 'bucket', required: true, configKey: 'categoryField' },
    { id: 'y', name: 'Size', description: 'Rectangle size', fieldType: 'metric', required: true, configKey: 'valueField' },
    { id: 'color', name: 'Color', description: 'Color intensity', fieldType: 'metric', required: false, configKey: 'colorField' }
  ],
  radial: [
    { id: 'x', name: 'Categories', description: 'Radial segments', fieldType: 'bucket', required: true, configKey: 'categoryField' },
    { id: 'y', name: 'Values', description: 'Segment size', fieldType: 'metric', required: true, configKey: 'valueField' }
  ],
  radar: [
    { id: 'key', name: 'Dimensions', description: 'Axes around the radar (e.g., skills, attributes)', fieldType: 'bucket', required: true, configKey: 'keyField' },
    { id: 'value', name: 'Value', description: 'Numeric value for each dimension', fieldType: 'metric', required: true, configKey: 'valueField' },
    { id: 'category', name: 'Series (optional)', description: 'Compare multiple series', fieldType: 'bucket', required: false, configKey: 'categoryField' }
  ],
  sankey: [
    { id: 'source', name: 'Stage 1 (Source)', description: 'Starting node', fieldType: 'bucket', required: true, configKey: 'sourceField' },
    { id: 'target', name: 'Stage 2 (Target)', description: 'Second stage', fieldType: 'bucket', required: true, configKey: 'targetField' },
    { id: 'stage3', name: 'Stage 3 (Optional)', description: 'Third stage', fieldType: 'bucket', required: false, configKey: 'stage3Field' },
    { id: 'stage4', name: 'Stage 4 (Optional)', description: 'Fourth stage', fieldType: 'bucket', required: false, configKey: 'stage4Field' },
    { id: 'value', name: 'Flow Value', description: 'Flow amount/weight', fieldType: 'metric', required: true, configKey: 'valueField' }
  ],
  wordcloud: [
    { id: 'text', name: 'Text', description: 'Words to display', fieldType: 'bucket', required: true, configKey: 'textField' },
    { id: 'size', name: 'Size By', description: 'Word size (optional)', fieldType: 'metric', required: false, configKey: 'sizeField' }
  ],
  waterfall: [
    { id: 'x', name: 'Labels', description: 'Category labels', fieldType: 'bucket', required: true, configKey: 'labelField' },
    { id: 'y', name: 'Amount', description: 'Value changes (+/-)', fieldType: 'metric', required: true, configKey: 'valueField' }
  ],
  rolling_average: [
    { id: 'x', name: 'Time/Sequence (X-Axis)', description: 'Date or sequential field', fieldType: 'bucket', required: true, configKey: 'xField' },
    { id: 'y', name: 'Values (Y-Axis)', description: 'Values to average', fieldType: 'metric', required: true, configKey: 'yField' }
  ],
  ternary: [
    { id: 'label', name: 'Label', description: 'Point labels', fieldType: 'bucket', required: true, configKey: 'labelField' },
    { id: 'top', name: 'Top Vertex', description: 'Top component value', fieldType: 'metric', required: true, configKey: 'topField' },
    { id: 'left', name: 'Bottom-Left', description: 'Left component value', fieldType: 'metric', required: true, configKey: 'leftField' },
    { id: 'right', name: 'Bottom-Right', description: 'Right component value', fieldType: 'metric', required: true, configKey: 'rightField' }
  ],
  comet: [
    { id: 'category', name: 'Category (Y-Axis)', description: 'Items to compare (e.g., product names, countries)', fieldType: 'bucket', required: true, configKey: 'categoryField' },
    { id: 'time', name: 'State Field', description: 'Field with 2 distinct values (e.g., Before/After, Q1/Q4, gender)', fieldType: 'bucket', required: true, configKey: 'timeField' },
    { id: 'value', name: 'Value', description: 'Numeric value to track change', fieldType: 'metric', required: true, configKey: 'valueField' }
  ],
  heatlane: [
    { id: 'value', name: 'Value Field', description: 'Numeric field to show distribution', fieldType: 'numeric', required: true, configKey: 'valueField' }
  ],
  // Dual Axis Chart - two Y-axes with shared X
  dual_axis: [
    { id: 'x', name: 'Shared X-Axis', description: 'Time or category axis', fieldType: 'bucket', required: true, configKey: 'xField' },
    { id: 'y1', name: 'Y-Axis 1 (Left)', description: 'First metric', fieldType: 'metric', required: true, configKey: 'yField1' },
    { id: 'y2', name: 'Y-Axis 2 (Right)', description: 'Second metric', fieldType: 'metric', required: true, configKey: 'yField2' }
  ],
  // Population Pyramid - diverging bars
  population_pyramid: [
    { id: 'category', name: 'Categories (Y-Axis)', description: 'Category field (e.g., age groups)', fieldType: 'bucket', required: true, configKey: 'categoryField' },
    { id: 'value', name: 'Value', description: 'Numeric value', fieldType: 'metric', required: true, configKey: 'valueField' },
    { id: 'group', name: 'Group (Left/Right)', description: 'Field to split left/right', fieldType: 'bucket', required: true, configKey: 'groupField' }
  ],
  // Lasagna Plot - dense time-series heatmap
  lasagna: [
    { id: 'x', name: 'Time (X-Axis)', description: 'Time field', fieldType: 'bucket', required: true, configKey: 'xField' },
    { id: 'y', name: 'Series (Y-Axis)', description: 'Category for rows', fieldType: 'bucket', required: true, configKey: 'yField' },
    { id: 'value', name: 'Value (Color)', description: 'Intensity value', fieldType: 'metric', required: true, configKey: 'valueField' }
  ],
  // Trellis Area - small multiples
  trellis_area: [
    { id: 'x', name: 'X-Axis (Time)', description: 'Time or sequence', fieldType: 'bucket', required: true, configKey: 'xField' },
    { id: 'y', name: 'Y-Axis (Value)', description: 'Numeric value', fieldType: 'metric', required: true, configKey: 'yField' },
    { id: 'facet', name: 'Facet By', description: 'Split into panels', fieldType: 'bucket', required: true, configKey: 'facetField' }
  ],
  // Bullet Chart - KPI visualization
  bullet: [
    { id: 'title', name: 'Title', description: 'KPI title', fieldType: 'bucket', required: true, configKey: 'titleField' },
    { id: 'measures', name: 'Measures', description: 'Actual values', fieldType: 'metric', required: true, configKey: 'measuresField' },
    { id: 'ranges', name: 'Ranges', description: 'Target ranges', fieldType: 'metric', required: true, configKey: 'rangesField' }
  ],
  // Funnel Chart - conversion stages
  funnel: [
    { id: 'x', name: 'Stage/Category', description: 'Funnel stages', fieldType: 'bucket', required: true, configKey: 'stageField' },
    { id: 'y', name: 'Value', description: 'Stage value', fieldType: 'metric', required: true, configKey: 'valueField' }
  ],
  // Spark Lines - compact trend visualization
  sparkline: [
    { id: 'x', name: 'Time/Sequence', description: 'X-axis (typically time)', fieldType: 'bucket', required: true, configKey: 'xField' },
    { id: 'y', name: 'Value', description: 'Y-axis value', fieldType: 'metric', required: true, configKey: 'yField' },
    { id: 'color', name: 'Group By', description: 'Split into multiple sparklines', fieldType: 'bucket', required: false, configKey: 'colorField' }
  ],
  // Error Bars - statistical visualization
  error_bars: [
    { id: 'x', name: 'Category', description: 'Category axis', fieldType: 'bucket', required: true, configKey: 'categoryField' },
    { id: 'y', name: 'Value', description: 'Numeric value to analyze', fieldType: 'metric', required: true, configKey: 'valueField' }
  ],
  // Horizon Chart - dense time series or categories
  horizon: [
    { id: 'x', name: 'X-Axis', description: 'Time or category axis', fieldType: 'bucket', required: true, configKey: 'xField' },
    { id: 'y', name: 'Value', description: 'Metric value', fieldType: 'metric', required: true, configKey: 'yField' },
    { id: 'color', name: 'Series', description: 'Split into multiple horizons', fieldType: 'bucket', required: false, configKey: 'colorField' }
  ],
  // Circle Packing - hierarchical circles
  circle_packing: [
    { id: 'x', name: 'Category', description: 'Category for circles', fieldType: 'bucket', required: true, configKey: 'categoryField' },
    { id: 'y', name: 'Size Value', description: 'Circle size', fieldType: 'metric', required: true, configKey: 'valueField' },
    { id: 'color', name: 'Parent Category', description: 'Optional hierarchy', fieldType: 'bucket', required: false, configKey: 'parentField' }
  ],
  // Streamgraph - flowing stacked area
  streamgraph: [
    { id: 'x', name: 'Time/Sequence', description: 'X-axis (typically time)', fieldType: 'bucket', required: true, configKey: 'xField' },
    { id: 'y', name: 'Value', description: 'Y-axis value', fieldType: 'metric', required: true, configKey: 'yField' },
    { id: 'color', name: 'Stack By', description: 'Series to stack', fieldType: 'bucket', required: true, configKey: 'colorField' }
  ],
  // Density Plot - distribution curve
  density: [
    { id: 'x', name: 'Value Field', description: 'Continuous value to analyze', fieldType: 'metric', required: true, configKey: 'valueField' },
    { id: 'color', name: 'Group By', description: 'Optional grouping', fieldType: 'bucket', required: false, configKey: 'groupField' }
  ],
  // Marimekko - variable width stacked bars
  marimekko: [
    { id: 'x', name: 'Width Category', description: 'Categories (variable width)', fieldType: 'bucket', required: true, configKey: 'xField' },
    { id: 'y', name: 'Height Value', description: 'Stacked value', fieldType: 'metric', required: true, configKey: 'yField' },
    { id: 'color', name: 'Segment', description: 'Stack segments', fieldType: 'bucket', required: true, configKey: 'colorField' }
  ],
  // Chord Diagram - circular flow visualization
  chord: [
    { id: 'source', name: 'Source', description: 'Starting node', fieldType: 'bucket', required: true, configKey: 'sourceField' },
    { id: 'target', name: 'Target', description: 'Ending node', fieldType: 'bucket', required: true, configKey: 'targetField' },
    { id: 'value', name: 'Flow Value', description: 'Flow amount/weight', fieldType: 'metric', required: true, configKey: 'valueField' }
  ],
  // Violin Plot - distribution visualization
  violin: [
    { id: 'x', name: 'Categories', description: 'Group by category', fieldType: 'bucket', required: true, configKey: 'categoryField' },
    { id: 'y', name: 'Values', description: 'Value distribution', fieldType: 'numeric', required: true, configKey: 'valueField' }
  ],
  // Pareto Chart - bar + cumulative line
  pareto: [
    { id: 'x', name: 'Categories', description: 'What to analyze', fieldType: 'bucket', required: true, configKey: 'categoryField' },
    { id: 'y', name: 'Values', description: 'What to measure', fieldType: 'metric', required: true, configKey: 'valueField' }
  ]
}

/**
 * Metric Types
 *
 * Available aggregation metrics for numeric fields.
 * - count: Document count (no field needed)
 * - sum, avg, median, min, max: Numeric aggregations (require field selection)
 */
export const metricTypes = [
  { id: 'count', name: 'Count', icon: Hash, needsField: false },
  { id: 'sum', name: 'Sum', icon: TrendingUp, needsField: true },
  { id: 'avg', name: 'Average', icon: TrendingUp, needsField: true },
  { id: 'median', name: 'Median', icon: TrendingUp, needsField: true },
  { id: 'min', name: 'Min', icon: TrendingUp, needsField: true },
  { id: 'max', name: 'Max', icon: TrendingUp, needsField: true }
]
