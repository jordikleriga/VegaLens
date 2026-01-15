# Visualization Types Project Plan

This document tracks the implementation status of all visualization types, ensuring each has:
1. **Backend Generator** - Individual generator class with metadata, schema, and examples
2. **Backend Tests** - Unit tests for spec generation
3. **E2E Tests** - End-to-end rendering and interaction tests
4. **Frontend Handler** - Axis configuration in UnifiedDataPanel
5. **Documentation** - Entry in Help & Docs with usage guide

---

## Architecture Overview

### Modular Chart Generator System (v2.0+)

The chart generation system uses a **modular, plugin-based architecture**:

```
backend/src/services/vega/
├── VegaGeneratorBase.js    # Base class with shared utilities
├── registry.js             # ChartRegistry - central chart type management
├── index.js                # Module exports and chart registration
├── utils/
│   ├── errors.js           # Error handling utilities
│   ├── logger.js           # Logging utilities
│   └── colorScales.js      # Color scheme definitions
└── charts/
    ├── index.js            # Exports all chart generators
    ├── BarChartGenerator.js
    ├── LineChartGenerator.js
    ├── AreaChartGenerator.js
    └── ... (40 total generators)
```

#### Key Components

1. **VegaGeneratorBase** - Abstract base class providing:
   - Field path resolution (`resolveFieldPath`)
   - Temporal field detection (`isTemporalField`, `getTemporalDomain`)
   - Color scale generation (`getColorScale`, `getFillColor`)
   - Base spec generation (`getBaseSpec`, `getVegaLiteBaseSpec`)
   - Kibana spec generation (`generateForKibana`)
   - Configuration validation (`validateConfig`, `validateData`)

2. **ChartRegistry** - Central management for chart types:
   - `register(id, options)` - Register a new chart type
   - `generate(type, config, data)` - Generate a chart spec
   - `generateForKibana(type, config, elasticConfig)` - Generate Kibana-compatible spec
   - `getVisualizationTypes()` - List all registered chart types
   - `getSchema(type)` - Get configuration schema for a chart type
   - `getExample(type)` - Get example config and data

3. **Individual Generators** - Each chart type has its own class:
   - `static metadata` - Chart name, description, category, icon
   - `static schema` - Configuration fields with types and validation
   - `static example` - Sample config and data for demonstrations
   - `generate(data)` - Generate Vega/Vega-Lite spec
   - `generateForKibana(elasticConfig)` - Override for complex charts

---

## Styling Standards (v2.3+)

All generators MUST use centralized styling from `VegaGeneratorBase` to ensure consistency between preview and Kibana modes.

### Centralized Defaults

The `VegaGeneratorBase.DEFAULTS` object contains all standard color and style values:

```javascript
static DEFAULTS = {
  // Color schemes
  colorScheme: 'category10',
  singleColor: '#0ea5e9',

  // Stroke colors
  strokeColor: '#ffffff',           // Preview mode (light backgrounds)
  kibanaStrokeColor: '#1e293b',     // Kibana mode (dark backgrounds)

  // Gradients
  gradientStart: '#0ea5e9',
  gradientEnd: '#f97316',

  // General styling
  opacity: 1,
  strokeWidth: 1,
  cornerRadius: 3,

  // Axis styling (Kibana dark theme)
  axisColor: '#64748b',
  axisLabelColor: '#94a3b8',
  axisTitleColor: '#e2e8f0'
};
```

### Required Helper Methods

Use these helper methods instead of hardcoding values:

| Method | Purpose | When to Use |
|--------|---------|-------------|
| `getAxisStyleConfig()` | Returns axis color config | In `generateForKibana()` config.axis |
| `getKibanaStyleConfig()` | Returns all Kibana style values | Start of `generateForKibana()` |
| `getKibanaStrokeProps()` | Returns stroke color/width | Mark stroke properties in Kibana |
| `getKibanaColorScheme()` | Returns color scheme name | Color scale definitions |
| `getFillColor()` | Returns fill color config | Single-color fills |
| `getOpacity()` | Returns opacity value | Mark opacity |

### Axis Styling in generateForKibana()

**REQUIRED:** All `generateForKibana()` methods must use `this.getAxisStyleConfig()`:

```javascript
// ✅ CORRECT - Use helper method
generateForKibana(elasticConfig) {
  return {
    // ... spec ...
    config: {
      view: { stroke: null },
      axis: this.getAxisStyleConfig()
    }
  };
}

// ❌ WRONG - Hardcoded values
generateForKibana(elasticConfig) {
  return {
    config: {
      axis: {
        domainColor: '#64748b',  // Don't hardcode!
        tickColor: '#64748b',
        labelColor: '#94a3b8',
        titleColor: '#e2e8f0'
      }
    }
  };
}
```

### Color Fallback Pattern

**REQUIRED:** Always use `VegaGeneratorBase.DEFAULTS` for fallbacks:

```javascript
// ✅ CORRECT - Use centralized defaults
const lineColor = this.colorConfig.singleColor || VegaGeneratorBase.DEFAULTS.singleColor;
const strokeColor = styleConfig.strokeColor || VegaGeneratorBase.DEFAULTS.kibanaStrokeColor;

// ❌ WRONG - Hardcoded fallback
const lineColor = this.colorConfig.singleColor || '#0ea5e9';
```

### Stroke Colors by Context

| Context | Color | Helper |
|---------|-------|--------|
| Preview mode | `#ffffff` (white) | `getStrokeProps()` |
| Kibana mode | `#1e293b` (dark slate) | `getKibanaStrokeProps()` |

### Schema Options Parity

**IMPORTANT:** All schema options defined in `static schema` MUST be implemented in BOTH:
1. `generate(data)` - Preview mode
2. `generateForKibana(elasticConfig)` - Kibana mode

Common options that must work in both modes:
- `showGrid`, `showLabels`, `showLegend`
- `opacity`, `strokeWidth`, `cornerRadius`
- `xAxisLabelAngle`, `xAxisZero`, `yAxisZero`
- Chart-specific options (e.g., `showConnectors` for Waterfall)

### Kibana Spec Checklist

Before marking a generator complete, verify:

- [ ] Uses `this.getAxisStyleConfig()` for axis colors
- [ ] Uses `this.getKibanaStyleConfig()` for style values
- [ ] No hardcoded color values (use `DEFAULTS` fallbacks)
- [ ] All schema options implemented in `generateForKibana()`
- [ ] Marks array is complete (not empty)
- [ ] Transforms create all referenced fields
- [ ] Legend shows when `showLegend: true`

---

## Kibana Vega Coding Rules

### Aggregation Config Structure (v2.4+)

The standard aggregation configuration structure for `elasticConfig`:

```javascript
elasticConfig: {
  index: 'kibana_sample_data_ecommerce',
  timeField: '@timestamp',           // Optional: for time-based queries
  useContext: true,                  // Enable dashboard filters/time picker
  aggregation: {
    // Primary bucket aggregation
    bucketAgg: {
      type: 'date_histogram',        // or 'terms', 'histogram'
      field: '@timestamp',
      options: {
        calendarInterval: 'day',     // For date_histogram
        size: 10,                    // For terms
        interval: 10                 // For histogram
      }
    },
    // Split-by (series) aggregation - creates grouped/faceted data
    splitBy: {
      field: 'category.keyword',
      options: { size: 5 }
    },
    // Metric aggregations
    metrics: [
      { type: 'sum', field: 'taxful_total_price' },
      { type: 'avg', field: 'total_quantity' }
    ]
  }
}
```

### Transform Rules for Faceted/Layered Specs

**CRITICAL:** When building faceted or layered Vega-Lite specs for Kibana:

1. **`window` transforms inside layers DON'T WORK in Kibana faceted specs**
   - Window transforms with `sort` or `groupby` fail silently or cause errors

2. **Use `joinaggregate` at top-level instead of `window` in layers**
   ```javascript
   // ✅ CORRECT - joinaggregate at top-level transforms
   transforms: [
     // ... flatten/calculate transforms ...
     { joinaggregate: [{ op: 'max', field: 'x', as: '_maxX' }], groupby: ['category'] }
   ],
   // Then filter in layer:
   layers: [{
     transform: [{ filter: 'datum.x === datum._maxX' }],
     mark: { type: 'circle', ... }
   }]

   // ❌ WRONG - window transform inside layer (fails in Kibana)
   layers: [{
     transform: [
       { window: [{ op: 'row_number', as: '_row' }], sort: [...], groupby: [...] }
     ],
     mark: { type: 'circle', ... }
   }]
   ```

3. **Top-level transforms run BEFORE faceting, layer transforms run WITHIN each facet**
   - Use top-level transforms to compute derived fields (max values, rankings, etc.)
   - Use layer transforms only for simple filters that reference pre-computed fields

4. **For "last point" or "endpoint" markers:**
   ```javascript
   // Compute max x per group at top level
   transforms: [
     ...(showEndpoint ? [
       { joinaggregate: [{ op: 'max', field: 'x', as: '_maxX' }], groupby: ['category'] }
     ] : [])
   ],
   // Filter to endpoint in layer
   layers: [{
     transform: [{ filter: 'datum.x === datum._maxX' }],
     mark: { type: 'circle', ... }
   }]
   ```

### Valid Transform Types

Transforms that can have `as` without `calculate`:
- `flatten` - Flatten nested arrays
- `fold` - Pivot columns to rows
- `pivot` - Rows to columns
- `aggregate` - Group aggregations
- `window` - Window functions (use at top-level only!)
- `joinaggregate` - Aggregate without grouping (**preferred for Kibana**)
- `density` - Kernel density estimation
- `quantile` - Quantile calculations
- `regression` / `loess` - Regression transforms
- `lookup` - Data lookups

### Elasticsearch Aggregation Types

**Bucket Aggregations:**
- `terms` - Group by keyword/text field
- `date_histogram` - Time buckets
- `histogram` - Numeric buckets
- `multi_terms` - Multi-field grouping (for Sankey, Chord)
- `range` - Custom value ranges
- `composite` - Paginated composite buckets

**Metric Aggregations:**
- `count` - Document count (implicit, no field needed)
- `sum`, `avg`, `min`, `max` - Basic metrics
- `cardinality` - Unique count
- `percentiles` - For boxplot, violin
- `extended_stats` - For error bars
- `top_hits` - Sample documents

---

## Implementation Status Matrix

| # | Type | ID | Generator | Backend Tests | E2E Tests | Frontend | Docs |
|---|------|-----|:---------:|:-------------:|:---------:|:--------:|:----:|
| 1 | Bar Chart | `bar` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | Line Chart | `line` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3 | Area Chart | `area` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 4 | Pie Chart | `pie` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 5 | Donut Chart | `donut` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 6 | Scatter Plot | `scatter` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 7 | Bubble Chart | `bubble` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 8 | Heatmap | `heatmap` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 9 | Binned Heatmap | `binned_heatmap` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 10 | Histogram | `histogram` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 11 | Box Plot | `boxplot` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 12 | Density Plot | `density` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 13 | Treemap | `treemap` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 14 | Circle Packing | `circle_packing` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 15 | Gauge | `gauge` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 16 | Metric | `metric` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 17 | Radial Bar | `radial` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 18 | Radar Chart | `radar` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 19 | Sankey Diagram | `sankey` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 20 | Waterfall | `waterfall` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 21 | Funnel Chart | `funnel` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 22 | Word Cloud | `wordcloud` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 23 | Data Table | `table` | ✅ | ✅ | N/A | ✅ | ✅ |
| 24 | Rolling Average | `rolling_average` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 25 | Sparkline | `sparkline` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 26 | Horizon Chart | `horizon` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 27 | Streamgraph | `streamgraph` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 28 | Ternary Chart | `ternary` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 29 | Comet Chart | `comet` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 30 | Heat Lane | `heatlane` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 31 | Population Pyramid | `population_pyramid` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 32 | Lasagna Plot | `lasagna` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 33 | Dual-Axis Chart | `dual_axis` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 34 | Trellis Area | `trellis_area` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 35 | Bullet Chart | `bullet` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 36 | Error Bars | `error_bars` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 37 | Marimekko Chart | `marimekko` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 38 | Violin Plot | `violin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 39 | Chord Diagram | `chord` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 40 | Pareto Chart | `pareto` | ✅ | ✅ | ✅ | ✅ | ✅ |

**Total: 40 Chart Types**

---

## Test Coverage Summary

### Four-Tier Testing Framework (`backend/tests/`)

The project uses a comprehensive four-tier testing framework for chart validation:

| Tier | Name | Purpose | Speed | Requirements |
|------|------|---------|-------|--------------|
| **1** | Schema Validation | JSON schema + Vega-Lite compilation | ~2s | None |
| **2** | Query Validation | ES queries execute correctly | ~30s | Elasticsearch |
| **3** | Visual Regression | Headless rendering comparison | ~60s | None |
| **4** | E2E Render | Full pipeline with real ES data | ~5min | ES + Kibana |

#### Tier 1: Schema Validation
- **Location:** `backend/tests/spec-validation/`
- **Files:** `run.js`, `SchemaValidator.js`, `KibanaSpecAssertions.js`
- **Tests:** Validates all 40 chart types against Vega/Vega-Lite JSON schema
- **Assertions:**
  - Has valid `$schema` reference
  - Has data configuration (URL or inline)
  - Has Kibana data source (index, body, %context%, %timefield%)
  - Has encoding (Vega-Lite) or scales (Vega)
  - Has mark definition
  - No undefined fields in encoding
  - Valid aggregation structure
  - Valid color scheme

#### Tier 2: Query Validation
- **Location:** `backend/tests/query-validation/`
- **Files:** `run.js`, `QueryValidator.js`
- **Tests:** Executes generated ES queries against real Elasticsearch
- **Connection modes:**
  - MCP Server: Uses MCP protocol (`MCP_SERVER_URL`)
  - Direct ES: Uses official client (`ES_SERVERLESS_URL` + `ES_API_KEY`)

#### Tier 3: Visual Regression
- **Location:** `backend/tests/visual-regression/`
- **Files:** `run.js`, `HeadlessRenderer.js`, `BaselineManager.js`, `ScenarioGenerator.js`
- **Tests:** Renders charts headlessly and compares against baseline images
- **Scenarios:** 22 different data scenarios per chart type:
  - Core: `minimal`, `standard`, `large`, `empty`, `single`, `negatives`, `zeros`, `decimals`, `unicode`, `outliers`
  - Extended: `very_large`, `all_same`, `long_labels`, `many_categories`, `missing_periods`, `mixed_magnitude`, `nan_values`, `html_injection`, `circular_ref`, `rtl_text`, `sparse`, `deep_hierarchy`
- **Presets:** `quick`, `default`, `core`, `extended`, `full`, `edge`, `volume`, `display`, `security`, `numeric`, `structural`

#### Tier 4: E2E Render
- **Location:** `backend/tests/e2e-render/`
- **Tests:** Full pipeline validation (ES query → render → validate)

### Test Configurations

All test configurations are centralized in `TEST_CONFIGS` object (`tests/spec-validation/run.js`):

```javascript
// Example test config structure
const TEST_CONFIGS = {
  bar: {
    config: { xField: 'category', yField: 'taxful_total_price', title: 'Bar Chart' },
    elasticConfig: {
      index: 'test-index',
      aggregation: {
        bucketAgg: { type: 'terms', field: 'category.keyword', options: { size: 10 } },
        metrics: [{ type: 'sum', field: 'taxful_total_price' }]
      }
    }
  },
  // ... 40 chart types
};
```

### E2E Tests (`e2e/tests/`)

| Suite | File | Tests | Status |
|-------|------|-------|--------|
| Multi-Level Charts | multi-level-charts.spec.js | 41 | ✅ All Pass |
| Chart Alternatives | chart-alternatives.spec.js | 19 | ✅ All Pass |
| Multi-Level Aggregations | multi-level-aggregations.spec.js | 19 | ✅ All Pass |
| Chart Rendering | rendering.spec.js | 18 | ✅ All Pass |
| Aggregations | aggregations.spec.js | 16 | ✅ All Pass |
| Builder UI | builder.spec.js | 8 | ✅ All Pass |
| Library | library.spec.js | 6 | ✅ All Pass |
| Accessibility | accessibility.spec.js | 5 | ✅ All Pass |
| Navigation | navigation.spec.js | 4 | ✅ All Pass |
| Help | help.spec.js | 4 | ✅ All Pass |
| Home | home.spec.js | 3 | ✅ All Pass |
| Explore | explore.spec.js | 3 | ✅ All Pass |
| **Total** | **12 files** | **146** | ✅ |

*Last scan: January 11, 2026*

---

## Chart Categories

### Trend Charts (10)
Bar Chart, Line Chart, Area Chart, Rolling Average, Sparkline, Horizon Chart, Streamgraph, Lasagna Plot, Dual-Axis Chart, Trellis Area

### Composition Charts (3)
Pie Chart, Donut Chart, Marimekko Chart

### Point-Based Charts (2)
Scatter Plot, Bubble Chart

### Grid/Heatmap Charts (3)
Heatmap, Binned Heatmap, Heat Lane

### Distribution Charts (5)
Histogram, Box Plot, Density Plot, Error Bars, Violin Plot

### Hierarchical Charts (2)
Treemap, Circle Packing

### Gauge/Metric Charts (5)
Gauge, Metric, Radial Bar, Radar Chart, Bullet Chart

### Flow/Process Charts (4)
Sankey Diagram, Waterfall, Funnel Chart, Chord Diagram

### Text-Based Charts (2)
Word Cloud, Data Table

### Specialty Charts (4)
Ternary Chart, Comet Chart, Population Pyramid, Pareto Chart

---

## Generator Class Structure

Each chart generator follows this structure:

```javascript
import { VegaGeneratorBase } from '../VegaGeneratorBase.js';

export class ExampleChartGenerator extends VegaGeneratorBase {
  // Chart identification and description
  static metadata = {
    id: 'example',
    name: 'Example Chart',
    description: 'Description of the chart',
    category: 'comparison',
    icon: 'chart-icon'
  };

  // Configuration schema with field definitions
  static schema = {
    fields: [
      { name: 'xField', label: 'X-Axis', type: 'field', required: true,
        fieldTypes: ['keyword', 'text', 'date'] },
      { name: 'yField', label: 'Y-Axis', type: 'field', required: true,
        fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', default: true }
    ]
  };

  // Example config and data for demonstrations
  static example = {
    config: {
      xField: 'category',
      yField: 'value',
      title: 'Example Chart'
    },
    data: [
      { category: 'A', value: 100 },
      { category: 'B', value: 200 }
    ]
  };

  // Generate the Vega/Vega-Lite spec
  generate(data) {
    const { xField, yField, showGrid = true } = this.config;
    // ... implementation
    return { ...this.getBaseSpec(), /* spec */ };
  }

  // Optional: Override for complex Kibana specs
  generateForKibana(elasticConfig) {
    // Custom Elasticsearch aggregation handling
    return { /* kibana spec */ };
  }
}
```

---

## Frontend Handler Status

Frontend handlers are implemented in `frontend/src/components/builder/UnifiedDataPanel.vue`.

### Handler Type Legend
- **Standard**: Uses default x/y axis handling
- **Custom**: Has dedicated aggregation + field mapping handlers

### All Frontend Handlers (37 chart types)

| Chart Type | Axes | Field Mapping | Notes |
|------------|------|---------------|-------|
| `bar` | x, y, color | xField, yField, colorField | Standard |
| `line` | x, y, color | xField, yField, colorField | Standard |
| `area` | x, y, color | xField, yField, colorField | Standard |
| `pie` | x, y | categoryField, valueField | Pie slices |
| `donut` | x, y | categoryField, valueField | Donut slices |
| `scatter` | x, y, color, size | xField, yField, colorField, sizeField | 2 metrics + optional bucket |
| `bubble` | x, y, size, color | xField, yField, sizeField, colorField | 3 metrics + optional bucket |
| `heatmap` | x, y, color | xField, yField, valueField | 2 buckets + 1 metric |
| `binned_heatmap` | x, y | xField, yField | 2 numeric fields (auto-binned) |
| `histogram` | x | valueField | Single numeric field |
| `boxplot` | x, y | categoryField, valueField | 1 bucket + 1 numeric |
| `metric` | y | valueField | Single metric |
| `gauge` | y | valueField | Single metric |
| `treemap` | x, y, color | categoryField, valueField, colorField | Hierarchical |
| `radial` | x, y | categoryField, valueField | Circular bars |
| `radar` | key, value, category | keyField, valueField, categoryField | Spider/polar |
| `sankey` | source, target, value | sourceField, targetField, valueField | Two bucket fields |
| `chord` | source, target, value | sourceField, targetField, valueField | Circular flow |
| `wordcloud` | text, size | textField, sizeField | Text bucket + optional size |
| `waterfall` | x, y | labelField, valueField | Cumulative values |
| `rolling_average` | x, y | xField, yField | Time-series with smoothing |
| `ternary` | label, top, left, right | labelField, topField, leftField, rightField | 1 bucket + 3 metrics |
| `comet` | category, time, value | categoryField, timeField, valueField | 2 buckets + 1 metric |
| `heatlane` | value | valueField | Single numeric (distribution) |
| `table` | columns | columns[] | Multiple fields |
| `dual_axis` | x, y1, y2 | xField, yField1, yField2 | 1 bucket + 2 metrics |
| `population_pyramid` | category, value, group | categoryField, valueField, groupField | Diverging bars |
| `lasagna` | x, y, value | xField, yField, valueField | 2 buckets + 1 metric |
| `trellis_area` | x, y, facet | xField, yField, facetField | Faceted small multiples |
| `bullet` | title, measures, ranges | titleField, measuresField, rangesField | 1 bucket + 2 metrics |
| `funnel` | x, y | stageField, valueField | Conversion stages |
| `sparkline` | x, y, color | xField, yField, colorField | Compact inline trend |
| `error_bars` | x, y | categoryField, valueField | Mean/median with CI |
| `horizon` | x, y, color | xField, yField, colorField | Layered time-series |
| `circle_packing` | x, y, color | categoryField, valueField, parentField | Nested circles |
| `streamgraph` | x, y, color | xField, yField, colorField | Stacked stream |
| `density` | x, color | valueField, groupField | KDE plot |
| `marimekko` | x, y, color | xField, yField, colorField | Variable width bars |
| `violin` | x, y | categoryField, valueField | Distribution shape (KDE) |
| `pareto` | x, y | categoryField, valueField | Bar + cumulative % line |

---

## Testing Commands

### Four-Tier Test Framework

```bash
# Run all tiers (from backend directory)
cd backend && npm run test:all

# Or directly
cd backend && node tests/run-all-tiers.js

# Run with options
node tests/run-all-tiers.js -v                    # Verbose output
node tests/run-all-tiers.js --skip-tier2          # Skip query validation
node tests/run-all-tiers.js --skip-tier3          # Skip visual regression
node tests/run-all-tiers.js --skip-tier4          # Skip E2E render
node tests/run-all-tiers.js --chart=bar,line      # Test specific charts
node tests/run-all-tiers.js -u                    # Update baselines
```

### Individual Tier Commands

```bash
# Tier 1: Schema Validation (~2 seconds)
npm run test:schema
npm run test:schema -- --chart=bar,line           # Specific charts
npm run test:schema -- -v                         # Verbose

# Tier 2: Query Validation (requires ES connection)
npm run test:queries
npm run test:queries -- --index=kibana_sample_data_ecommerce

# Tier 3: Visual Regression
npm run test:visual                                # Default preset (5 scenarios)
npm run test:visual -- --preset=quick              # Single scenario (fastest)
npm run test:visual -- --preset=full               # All 22 scenarios
npm run test:visual -- --preset=edge               # Edge cases only
npm run test:visual -- --scenario=outliers         # Single scenario
npm run test:visual -- --chart=bar -v              # Specific chart, verbose
npm run test:visual:update                         # Update baseline images
npm run test:visual:update -- --preset=full        # Update all baselines

# Tier 4: E2E Render (requires ES + Kibana)
npm run test:e2e-render
```

### Kibana Integration Tests (Docker)

```bash
# Start Kibana Docker environment
npm run test:kibana:docker-up

# Run single chart in Kibana
npm run test:kibana:single -- --chart=bar

# Run full Kibana test suite
npm run test:kibana
```

### Legacy Unit Tests

```bash
# Backend unit tests
cd backend && npm test

# E2E tests with Playwright
cd e2e && npx playwright test

# E2E with parallel workers
cd e2e && npx playwright test --workers=8

# View E2E test report
cd e2e && npx playwright show-report
```

### Environment Variables

```bash
# Elasticsearch Serverless (direct connection)
export ES_SERVERLESS_URL="https://your-project.es.region.aws.elastic.cloud"
export ES_API_KEY="your-api-key"

# MCP Server (alternative connection)
export MCP_SERVER_URL="http://localhost:8080/mcp"

# Visual regression threshold
export VISUAL_DIFF_THRESHOLD=0.01  # 1% pixel difference allowed
```

---

## Adding a New Visualization Type

### 1. Create Generator Class

Create `backend/src/services/vega/charts/NewChartGenerator.js`:

```javascript
import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class NewChartGenerator extends VegaGeneratorBase {
  static metadata = { id: 'new_chart', name: 'New Chart', ... };
  static schema = { fields: [...] };
  static example = { config: {...}, data: [...] };

  generate(data) {
    // Implementation
  }
}

export default NewChartGenerator;
```

### 2. Register Generator

In `backend/src/services/vega/charts/index.js`:
```javascript
export { NewChartGenerator } from './NewChartGenerator.js';
```

In `backend/src/services/vega/index.js`:
```javascript
import { NewChartGenerator } from './charts/index.js';

registerChart('new_chart', NewChartGenerator);
```

### 3. Add Backend Tests

In `backend/tests/chartTypes.test.js`:
```javascript
async function testNewChart() {
  const { status, data } = await apiRequest('/vega/generate', 'POST', {
    type: 'new_chart',
    config: { /* required fields */ },
    data: SAMPLE_DATA
  });

  assert.strictEqual(status, 200);
  assert(data.$schema, 'Missing $schema');
}

async function testKibanaNewChartEncoding() {
  // Test Kibana spec generation
}
```

### 4. Add E2E Tests

In `e2e/tests/rendering.spec.js`:
- Add to `CHART_CONFIGS` with sample configuration
- Tests will auto-run for rendering and Kibana spec generation

### 5. Frontend Handlers

Add to `frontend/src/components/builder/UnifiedDataPanel.vue`:
- Add entry to `axisConfig` object for axis configuration
- Aggregation and field mapping will follow the defined axes

### 6. Documentation

Add documentation in `frontend/src/views/HelpView.vue`:
- Add to appropriate category in `chartCategories` array

---

## Charts with Custom Kibana Overrides

These charts have custom `generateForKibana()` implementations for complex Elasticsearch aggregations:

| Chart | Aggregation Type | Notes |
|-------|------------------|-------|
| Sankey | multi_terms | Source-target pairs |
| Chord | multi_terms | Circular flow relationships |
| Treemap | terms + treemap transform | Hierarchical layout |
| Wordcloud | terms + wordcloud transform | Text sizing |
| Radar | terms | Polar coordinates |
| Boxplot | percentiles + extended_stats | Statistical quartiles |
| Violin | percentiles + density | Distribution shape |
| Funnel | terms (ordered) | Stage progression |
| Circle Packing | terms + pack transform | Nested circles |
| Ternary | multi-metric avg | Three-component composition |
| Pareto | terms + cumulative | Bar + cumulative % line |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2024 | Initial project plan created |
| 1.1 | Dec 23, 2025 | Added Frontend Handler tracking |
| 1.2 | Dec 23, 2025 | Updated test count to 72 |
| 2.0 | Jan 2, 2026 | **Major refactor**: Modular generator architecture |
| 2.1 | Jan 2, 2026 | Added 9 new chart types (37 total), 151 E2E tests |
| 2.2 | Jan 5, 2026 | Added Violin, Chord, Pareto (40 total), 96 backend tests, 146 E2E tests |
| 2.3 | Jan 5, 2026 | **Styling standardization**: Centralized DEFAULTS, helper methods, Kibana parity |
| 2.4 | Jan 11, 2026 | **Testing framework overhaul**: Four-tier validation, Kibana coding rules |

---

## Changelog: v2.4 (January 11, 2026)

### Added
- **Four-Tier Testing Framework** documentation:
  - Tier 1: Schema Validation (JSON schema + Vega-Lite compilation)
  - Tier 2: Query Validation (ES query execution)
  - Tier 3: Visual Regression (22 data scenarios, headless rendering)
  - Tier 4: E2E Render (full pipeline with real ES data)
- **Kibana Vega Coding Rules** section with critical patterns:
  - Aggregation config structure (bucketAgg, splitBy, metrics)
  - Transform rules for faceted/layered specs
  - Valid transform types and ES aggregation types
- **Test command reference** for all tiers and presets
- **Environment variables** documentation for ES connections

### Fixed
- **SparklineGenerator** - Fixed endpoint dots not showing in Kibana faceted specs
  - Changed from `window` transform (fails in Kibana layers) to `joinaggregate` at top-level
  - Endpoint now correctly displays on last data point per series

### Technical Details
- `joinaggregate` is preferred over `window` for Kibana faceted specs
- Top-level transforms run before faceting; layer transforms run within each facet
- Window transforms with `sort`/`groupby` inside layers cause silent failures in Kibana
- Test framework now supports 22 data scenarios for comprehensive visual regression

---

## Changelog: v2.3 (January 5, 2026)

### Added
- **Styling Standards section** in documentation with required patterns
- `VegaGeneratorBase.DEFAULTS` - Centralized color/style defaults:
  - `axisColor`, `axisLabelColor`, `axisTitleColor` for Kibana dark theme
  - `kibanaStrokeColor` for dark background visibility
- `getAxisStyleConfig()` helper method for consistent axis styling
- **Kibana Spec Checklist** for generator validation

### Fixed
- **HistogramGenerator** - Added missing `series` field transform for split histograms
- **TrellisAreaGenerator** - Fixed legend logic (`showLegend ? null : null` → proper conditional)
- **WaterfallGenerator** - Added connector lines to `generateForKibana()`
- **Axis colors standardized** across 21 generators (replaced hardcoded values)
- **Stroke colors standardized** across 7 generators
- **Fallback patterns fixed** in SparklineGenerator, TernaryGenerator, CometGenerator

### Technical Details
- All generators now use `this.getAxisStyleConfig()` in Kibana specs
- Color fallbacks use `VegaGeneratorBase.DEFAULTS.singleColor` instead of hardcoded `#0ea5e9`
- Schema options parity requirement documented for preview/Kibana consistency

---

## Changelog: v2.2 (January 5, 2026)

### Added
- **Violin Plot** (`violin`) - Distribution shape visualization with kernel density estimation
- **Chord Diagram** (`chord`) - Circular flow visualization for relationships between entities
- **Pareto Chart** (`pareto`) - Combined bar chart and cumulative percentage line (80/20 analysis)

### Updated
- Backend test count: 76+ → 96 tests
- E2E test count: 151 → 146 tests (12 test files)
- Frontend handlers: Now covers all 40 chart types (37 with axisConfig)
- Chart categories reorganized to match `charts/index.js` groupings

### Technical Details
- All 40 generators now have `static metadata`, `static schema`, and `static example`
- Violin and Chord use custom `generateForKibana()` for complex aggregations
- Pareto uses layered Vega spec with bar + line marks

---

## Changelog: v2.0 Architecture Refactor

### Removed
- `backend/src/services/vegaGenerator.js` (~9000 lines monolithic file)
- `VegaSpecGenerator` class

### Added
- `VegaGeneratorBase` - Abstract base class with shared utilities
- `ChartRegistry` - Plugin-based chart type management
- 40 individual generator classes in `charts/` directory
- Static `example` property on all generators
- Static `validateConfig()` and `validateData()` methods
- Custom `generateForKibana()` for 11 complex chart types

---

*Last updated: January 11, 2026 (v2.4)*
