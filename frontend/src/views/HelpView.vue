<script setup>
import { ref } from 'vue'
import {
  BookOpen,
  BarChart3,
  Database,
  Layers,
  Palette,
  Clock,
  Zap,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Settings,
  FileJson,
  Lightbulb,
  Shield,
  Lock,
  Server,
  Cloud,
  Key,
  Github
} from 'lucide-vue-next'
import { useConnectionStore } from '@/stores/connection'

const connectionStore = useConnectionStore()

const expandedSections = ref({
  gettingStarted: true,
  connecting: false,
  chartTypes: false,
  aggregations: false,
  timeIntervals: false,
  colorConfig: false,
  kibanaExport: false
})

function toggleSection(section) {
  expandedSections.value[section] = !expandedSections.value[section]
}

const chartCategories = [
  {
    name: 'Comparison',
    charts: [
      { name: 'Bar Chart', fields: 'xField, yField', desc: 'Compare categories with bars' },
      { name: 'Grouped Bar', fields: 'xField, yField, groupField', desc: 'Multi-series bar comparison' },
      { name: 'Stacked Bar', fields: 'xField, yField, colorField', desc: 'Stacked category bars' },
      { name: 'Population Pyramid', fields: 'categoryField, valueField, groupField', desc: 'Diverging stacked bar for two groups' },
      { name: 'Comet Chart', fields: 'categoryField, timeField, valueField', desc: 'Show changes between two states' },
      { name: 'Radial Bar', fields: 'categoryField, valueField', desc: 'Circular bar chart' },
      { name: 'Lollipop Chart', fields: 'categoryField, valueField', desc: 'Bars with dot endpoints' },
      { name: 'Pareto Chart', fields: 'categoryField, valueField', desc: 'Combined bar and cumulative % line (80/20 analysis)' }
    ]
  },
  {
    name: 'Trend',
    charts: [
      { name: 'Line Chart', fields: 'xField, yField', desc: 'Show trends over time' },
      { name: 'Multi-Line Chart', fields: 'xField, yField, colorField', desc: 'Multiple series comparison' },
      { name: 'Area Chart', fields: 'xField, yField', desc: 'Show cumulative totals' },
      { name: 'Stacked Area', fields: 'xField, yField, colorField', desc: 'Layered area composition' },
      { name: 'Stream Graph', fields: 'xField, yField, categoryField', desc: 'Flowing stacked areas' },
      { name: 'Rolling Average', fields: 'xField, yField, windowSize', desc: 'Raw data with rolling mean line' },
      { name: 'Dual-Axis Chart', fields: 'xField, yField1, yField2', desc: 'Two independent Y-axis scales' },
      { name: 'Trellis Area', fields: 'xField, yField, facetField', desc: 'Small multiples of area charts' },
      { name: 'Lasagna Plot', fields: 'xField, yField, valueField', desc: 'Dense time-series heatmap' },
      { name: 'Bump Chart', fields: 'categoryField, timeField, rankField', desc: 'Ranking changes over time' },
      { name: 'Slope Chart', fields: 'categoryField, startValue, endValue', desc: 'Compare two time points' }
    ]
  },
  {
    name: 'Flow',
    charts: [
      { name: 'Sankey Diagram', fields: 'sourceField, targetField, valueField', desc: 'Flow between categories' },
      { name: 'Chord Diagram', fields: 'sourceField, targetField, valueField', desc: 'Circular relationship visualization' },
      { name: 'Waterfall Chart', fields: 'labelField, valueField', desc: 'Cumulative effect of sequential values' },
      { name: 'Funnel Chart', fields: 'stageField, valueField', desc: 'Conversion stages visualization' }
    ]
  },
  {
    name: 'Distribution',
    charts: [
      { name: 'Histogram', fields: 'field, bins', desc: 'Distribution of numerical data' },
      { name: 'Heatmap', fields: 'xField, yField, valueField', desc: 'Data density with color' },
      { name: '2D Histogram Heatmap', fields: 'xField, yField, xBins, yBins, aggregate', desc: 'Binned distribution of two quantitative variables' },
      { name: 'Heat Lane', fields: 'valueField, binCount', desc: '1D histogram as lane' },
      { name: 'Box Plot', fields: 'categoryField, valueField', desc: 'Statistical distribution with quartiles' },
      { name: 'Violin Plot', fields: 'categoryField, valueField', desc: 'Distribution shape with kernel density estimation' },
      { name: 'Density Plot', fields: 'valueField, groupField, bandwidth', desc: 'Smoothed distribution curves' },
      { name: 'Error Bars', fields: 'categoryField, valueField, errorType', desc: 'Statistical uncertainty visualization' }
    ]
  },
  {
    name: 'Composition',
    charts: [
      { name: 'Pie Chart', fields: 'categoryField, valueField', desc: 'Show proportions of a whole' },
      { name: 'Donut Chart', fields: 'categoryField, valueField', desc: 'Pie with center cutout' },
      { name: 'Ternary Chart', fields: 'labelField, topField, leftField, rightField', desc: 'Three variables summing to 100%' },
      { name: 'Funnel Chart', fields: 'stageField, valueField', desc: 'Conversion stages visualization' }
    ]
  },
  {
    name: 'Relationship',
    charts: [
      { name: 'Scatter Plot', fields: 'xField, yField', desc: 'Relationship between two variables' },
      { name: 'Bubble Plot', fields: 'xField, yField, sizeField, colorField', desc: 'Scatter plot with size encoding (Gapminder style)' },
      { name: 'Radar Chart', fields: 'categoryField, dimensionField, valueField', desc: 'Multi-dimensional comparison' }
    ]
  },
  {
    name: 'Hierarchy',
    charts: [
      { name: 'Treemap', fields: 'categoryField, valueField', desc: 'Nested rectangles for hierarchy' },
      { name: 'Circle Packing', fields: 'categoryField, valueField', desc: 'Nested circles for hierarchy' },
      { name: 'Sunburst', fields: 'categoryField, valueField, parentField', desc: 'Radial hierarchical layout' }
    ]
  },
  {
    name: 'Single-Value',
    charts: [
      { name: 'Metric', fields: 'valueField', desc: 'Single numeric value display' },
      { name: 'Gauge', fields: 'valueField, minValue, maxValue', desc: 'Value against a target range' },
      { name: 'Bullet Chart', fields: 'titleField, measuresField, rangesField', desc: 'Measures vs ranges and markers' },
      { name: 'Sparkline', fields: 'xField, yField', desc: 'Compact inline trend' }
    ]
  },
  {
    name: 'Text Analysis',
    charts: [
      { name: 'Word Cloud', fields: 'textField, sizeField', desc: 'Text frequency with sized words' }
    ]
  },
  {
    name: 'Raw Data',
    charts: [
      { name: 'Data Table', fields: 'columns', desc: 'Display raw data in tabular format' }
    ]
  }
]

const timeIntervals = [
  { category: 'Calendar', intervals: ['minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'] },
  { category: 'Fixed', intervals: ['1s', '5s', '30s', '1m', '5m', '15m', '30m', '1h', '3h', '6h', '12h', '1d', '7d'] }
]

// Count total charts
const totalCharts = chartCategories.reduce((sum, cat) => sum + cat.charts.length, 0)
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="max-w-5xl mx-auto space-y-8 pb-12">
      <!-- Header -->
      <div class="text-center py-8">
        <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-ocean-400 to-coral-500 rounded-2xl flex items-center justify-center shadow-glow">
          <BookOpen class="w-8 h-8 text-white" />
        </div>
        <h1 class="text-3xl font-display font-bold text-white mb-2">Help & Documentation</h1>
        <p class="text-slate-400 max-w-2xl mx-auto">
          Learn how to create stunning Vega visualizations connected to your Elasticsearch data
        </p>
      </div>

      <!-- Quick Links -->
      <div class="grid grid-cols-5 gap-4">
        <a href="#getting-started" class="card p-4 text-center hover:border-ocean-500/50 transition-colors group">
          <Zap class="w-6 h-6 mx-auto mb-2 text-amber-400 group-hover:scale-110 transition-transform" />
          <span class="text-sm font-medium text-white">Quick Start</span>
        </a>
        <a href="#connecting" class="card p-4 text-center hover:border-ocean-500/50 transition-colors group">
          <Shield class="w-6 h-6 mx-auto mb-2 text-emerald-400 group-hover:scale-110 transition-transform" />
          <span class="text-sm font-medium text-white">Connecting</span>
        </a>
        <a href="#chart-types" class="card p-4 text-center hover:border-ocean-500/50 transition-colors group">
          <BarChart3 class="w-6 h-6 mx-auto mb-2 text-ocean-400 group-hover:scale-110 transition-transform" />
          <span class="text-sm font-medium text-white">Chart Types</span>
        </a>
        <a href="#aggregations" class="card p-4 text-center hover:border-ocean-500/50 transition-colors group">
          <Layers class="w-6 h-6 mx-auto mb-2 text-purple-400 group-hover:scale-110 transition-transform" />
          <span class="text-sm font-medium text-white">Aggregations</span>
        </a>
        <a href="https://github.com/jordikleriga/VegaLens" target="_blank" rel="noopener noreferrer" class="card p-4 text-center hover:border-ocean-500/50 transition-colors group">
          <Github class="w-6 h-6 mx-auto mb-2 text-slate-300 group-hover:scale-110 transition-transform" />
          <span class="text-sm font-medium text-white">GitHub</span>
        </a>
      </div>

      <!-- Getting Started -->
      <section id="getting-started" class="card">
        <button 
          @click="toggleSection('gettingStarted')"
          class="w-full flex items-center justify-between p-6"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Zap class="w-5 h-5 text-amber-400" />
            </div>
            <div class="text-left">
              <h2 class="text-xl font-semibold text-white">Getting Started</h2>
              <p class="text-sm text-slate-400">Create your first visualization in 4 simple steps</p>
            </div>
          </div>
          <component :is="expandedSections.gettingStarted ? ChevronDown : ChevronRight" class="w-5 h-5 text-slate-400" />
        </button>
        
        <div v-if="expandedSections.gettingStarted" class="px-6 pb-6 space-y-6">
          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded-lg bg-ocean-500/20 flex items-center justify-center text-ocean-400 font-bold">1</div>
                <h3 class="font-medium text-white">Connect & Select Index</h3>
              </div>
              <p class="text-sm text-slate-400">
                Connect to your Elasticsearch instance (or use the default), then choose an index from the dropdown. The system will automatically fetch available fields.
              </p>
            </div>
            
            <div class="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded-lg bg-ocean-500/20 flex items-center justify-center text-ocean-400 font-bold">2</div>
                <h3 class="font-medium text-white">Choose Chart Type</h3>
              </div>
              <p class="text-sm text-slate-400">
                Pick from {{ totalCharts }} visualization types. Each type has specific field requirements shown in the configuration panel.
              </p>
            </div>
            
            <div class="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded-lg bg-ocean-500/20 flex items-center justify-center text-ocean-400 font-bold">3</div>
                <h3 class="font-medium text-white">Configure Fields</h3>
              </div>
              <p class="text-sm text-slate-400">
                Map your data fields to chart axes. Select bucket aggregations for grouping and metrics for values.
              </p>
            </div>
            
            <div class="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded-lg bg-ocean-500/20 flex items-center justify-center text-ocean-400 font-bold">4</div>
                <h3 class="font-medium text-white">Generate & Export</h3>
              </div>
              <p class="text-sm text-slate-400">
                Click "Generate Chart" to preview. Export as Kibana-compatible Vega spec or download the JSON directly.
              </p>
            </div>
          </div>

          <div class="p-4 bg-gradient-to-r from-ocean-500/10 to-coral-500/10 border border-ocean-500/30 rounded-xl">
            <div class="flex items-start gap-3">
              <Lightbulb class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="font-medium text-white mb-1">Pro Tip</h4>
                <p class="text-sm text-slate-300">
                  Check out the <RouterLink to="/library" class="text-ocean-400 hover:underline">Library</RouterLink> section for ready-to-use examples of each chart type. These demonstrate best practices and can be used as starting points for your own visualizations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Connecting to Elasticsearch -->
      <section id="connecting" class="card">
        <button 
          @click="toggleSection('connecting')"
          class="w-full flex items-center justify-between p-6"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Shield class="w-5 h-5 text-emerald-400" />
            </div>
            <div class="text-left">
              <h2 class="text-xl font-semibold text-white">Connecting to Elasticsearch</h2>
              <p class="text-sm text-slate-400">Securely connect your own Elasticsearch instance</p>
            </div>
          </div>
          <component :is="expandedSections.connecting ? ChevronDown : ChevronRight" class="w-5 h-5 text-slate-400" />
        </button>
        
        <div v-if="expandedSections.connecting" class="px-6 pb-6 space-y-6">
          <!-- Security Notice -->
          <div class="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <div class="flex items-start gap-3">
              <Lock class="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="font-medium text-emerald-300 mb-2">Your Credentials Are Secure</h4>
                <ul class="text-sm text-emerald-200/80 space-y-1">
                  <li>• Credentials are stored in <strong>session storage only</strong> — automatically cleared when you close the browser</li>
                  <li>• Your API keys are <strong>never saved permanently</strong> on our servers or in your browser</li>
                  <li>• All connections use <strong>encrypted HTTPS</strong> communication</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Connection Types -->
          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div class="flex items-center gap-3 mb-3">
                <Server class="w-5 h-5 text-slate-400" />
                <h3 class="font-medium text-white">Default Connection</h3>
              </div>
              <p class="text-sm text-slate-400">
                Uses the Elasticsearch instance configured on the server. Ideal for development or when an admin has pre-configured a shared cluster.
              </p>
            </div>
            
            <div class="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div class="flex items-center gap-3 mb-3">
                <Cloud class="w-5 h-5 text-sky-400" />
                <h3 class="font-medium text-white">Elastic Cloud / Serverless</h3>
              </div>
              <p class="text-sm text-slate-400">
                Connect to Elastic Cloud deployments or Serverless projects using your Cloud ID or endpoint URL with an API key.
              </p>
            </div>
            
            <div class="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div class="flex items-center gap-3 mb-3">
                <Database class="w-5 h-5 text-amber-400" />
                <h3 class="font-medium text-white">Self-Hosted</h3>
              </div>
              <p class="text-sm text-slate-400">
                Connect to your own Elasticsearch cluster using the endpoint URL. Supports API key or username/password authentication.
              </p>
            </div>
            
            <div class="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div class="flex items-center gap-3 mb-3">
                <Key class="w-5 h-5 text-purple-400" />
                <h3 class="font-medium text-white">Creating API Keys</h3>
              </div>
              <p class="text-sm text-slate-400">
                In Kibana: Stack Management → Security → API Keys. Grant minimal permissions (read access to required indices).
              </p>
            </div>
          </div>

          <!-- How to Connect -->
          <div class="p-4 bg-gradient-to-r from-ocean-500/10 to-coral-500/10 border border-ocean-500/30 rounded-xl">
            <div class="flex items-start gap-3">
              <Settings class="w-5 h-5 text-ocean-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="font-medium text-white mb-2">How to Connect</h4>
                <p class="text-sm text-slate-300 mb-3">
                  Click the connection status indicator in the sidebar (shows "Connected" or "Disconnected"), then click the settings icon or "Connect to Elasticsearch" button.
                </p>
                <button
                  @click="connectionStore.openSettings()"
                  class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-ocean-500/20 text-ocean-300 hover:bg-ocean-500/30 transition-colors"
                >
                  <Settings class="w-4 h-4" />
                  Open Connection Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Chart Types -->
      <section id="chart-types" class="card">
        <button 
          @click="toggleSection('chartTypes')"
          class="w-full flex items-center justify-between p-6"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-ocean-500/20 flex items-center justify-center">
              <BarChart3 class="w-5 h-5 text-ocean-400" />
            </div>
            <div class="text-left">
              <h2 class="text-xl font-semibold text-white">Chart Types</h2>
              <p class="text-sm text-slate-400">{{ totalCharts }} visualization types organized by category</p>
            </div>
          </div>
          <component :is="expandedSections.chartTypes ? ChevronDown : ChevronRight" class="w-5 h-5 text-slate-400" />
        </button>
        
        <div v-if="expandedSections.chartTypes" class="px-6 pb-6">
          <div class="grid grid-cols-2 gap-4">
            <div v-for="category in chartCategories" :key="category.name" class="p-4 bg-slate-800/50 rounded-xl">
              <h3 class="font-medium text-white mb-3 flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-ocean-400"></div>
                {{ category.name }}
                <span class="text-xs text-slate-500 font-normal">({{ category.charts.length }})</span>
              </h3>
              <div class="space-y-2">
                <div v-for="chart in category.charts" :key="chart.name" class="pl-4 border-l border-slate-700">
                  <div class="text-sm text-white font-medium">{{ chart.name }}</div>
                  <div class="text-xs text-slate-500">{{ chart.desc }}</div>
                  <div class="text-xs text-ocean-400 font-mono mt-0.5">{{ chart.fields }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Quick Tip -->
          <div class="mt-4 p-4 bg-gradient-to-r from-ocean-500/10 to-coral-500/10 border border-ocean-500/30 rounded-xl">
            <div class="flex items-start gap-3">
              <Lightbulb class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="font-medium text-white mb-1">Field Mapping</h4>
                <p class="text-sm text-slate-300">
                  Each chart type requires specific fields to be mapped. Check the <RouterLink to="/library" class="text-ocean-400 hover:underline">Library</RouterLink> section for working examples of each chart type with sample data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Aggregations -->
      <section id="aggregations" class="card">
        <button 
          @click="toggleSection('aggregations')"
          class="w-full flex items-center justify-between p-6"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Layers class="w-5 h-5 text-purple-400" />
            </div>
            <div class="text-left">
              <h2 class="text-xl font-semibold text-white">Aggregations</h2>
              <p class="text-sm text-slate-400">Bucket and metric aggregation types</p>
            </div>
          </div>
          <component :is="expandedSections.aggregations ? ChevronDown : ChevronRight" class="w-5 h-5 text-slate-400" />
        </button>
        
        <div v-if="expandedSections.aggregations" class="px-6 pb-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 bg-slate-800/50 rounded-xl">
              <h3 class="font-medium text-white mb-3 flex items-center gap-2">
                <Database class="w-4 h-4 text-ocean-400" />
                Bucket Aggregations
              </h3>
              <ul class="space-y-2 text-sm">
                <li class="text-slate-300"><code class="text-ocean-400">terms</code> - Group by field values</li>
                <li class="text-slate-300"><code class="text-ocean-400">date_histogram</code> - Group by time intervals</li>
                <li class="text-slate-300"><code class="text-ocean-400">histogram</code> - Group by numeric ranges</li>
                <li class="text-slate-300"><code class="text-ocean-400">range</code> - Custom numeric ranges</li>
                <li class="text-slate-300"><code class="text-ocean-400">date_range</code> - Custom date ranges</li>
                <li class="text-slate-300"><code class="text-ocean-400">multi_terms</code> - Group by multiple fields</li>
              </ul>
            </div>
            
            <div class="p-4 bg-slate-800/50 rounded-xl">
              <h3 class="font-medium text-white mb-3 flex items-center gap-2">
                <Settings class="w-4 h-4 text-coral-400" />
                Metric Aggregations
              </h3>
              <ul class="space-y-2 text-sm">
                <li class="text-slate-300"><code class="text-coral-400">count</code> - Document count</li>
                <li class="text-slate-300"><code class="text-coral-400">sum</code> - Sum of values</li>
                <li class="text-slate-300"><code class="text-coral-400">avg</code> - Average value</li>
                <li class="text-slate-300"><code class="text-coral-400">min</code> / <code class="text-coral-400">max</code> - Min/max values</li>
                <li class="text-slate-300"><code class="text-coral-400">median</code> - 50th percentile</li>
                <li class="text-slate-300"><code class="text-coral-400">cardinality</code> - Unique count</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- Time Intervals -->
      <section id="time-intervals" class="card">
        <button 
          @click="toggleSection('timeIntervals')"
          class="w-full flex items-center justify-between p-6"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
              <Clock class="w-5 h-5 text-pink-400" />
            </div>
            <div class="text-left">
              <h2 class="text-xl font-semibold text-white">Time Intervals</h2>
              <p class="text-sm text-slate-400">Calendar and fixed interval options for date histograms</p>
            </div>
          </div>
          <component :is="expandedSections.timeIntervals ? ChevronDown : ChevronRight" class="w-5 h-5 text-slate-400" />
        </button>
        
        <div v-if="expandedSections.timeIntervals" class="px-6 pb-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div v-for="group in timeIntervals" :key="group.category" class="p-4 bg-slate-800/50 rounded-xl">
              <h3 class="font-medium text-white mb-3">{{ group.category }} Intervals</h3>
              <div class="flex flex-wrap gap-2">
                <span 
                  v-for="interval in group.intervals" 
                  :key="interval"
                  class="px-2 py-1 bg-slate-700/50 rounded text-xs font-mono text-slate-300"
                >
                  {{ interval }}
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-3">
                {{ group.category === 'Calendar' ? 'Variable length based on calendar (e.g., months have different days)' : 'Exact duration intervals for precise time-based grouping' }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Color Configuration -->
      <section id="colors" class="card">
        <button 
          @click="toggleSection('colorConfig')"
          class="w-full flex items-center justify-between p-6"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
              <Palette class="w-5 h-5 text-rose-400" />
            </div>
            <div class="text-left">
              <h2 class="text-xl font-semibold text-white">Color Configuration</h2>
              <p class="text-sm text-slate-400">Color schemes, palettes, and styling options</p>
            </div>
          </div>
          <component :is="expandedSections.colorConfig ? ChevronDown : ChevronRight" class="w-5 h-5 text-slate-400" />
        </button>
        
        <div v-if="expandedSections.colorConfig" class="px-6 pb-6 space-y-4">
          <div class="grid grid-cols-3 gap-4">
            <div class="p-4 bg-slate-800/50 rounded-xl">
              <h3 class="font-medium text-white mb-2">Categorical</h3>
              <p class="text-xs text-slate-400 mb-2">For distinct categories</p>
              <div class="flex gap-1">
                <div class="w-4 h-4 rounded bg-blue-500"></div>
                <div class="w-4 h-4 rounded bg-orange-500"></div>
                <div class="w-4 h-4 rounded bg-green-500"></div>
                <div class="w-4 h-4 rounded bg-red-500"></div>
                <div class="w-4 h-4 rounded bg-purple-500"></div>
              </div>
            </div>
            <div class="p-4 bg-slate-800/50 rounded-xl">
              <h3 class="font-medium text-white mb-2">Sequential</h3>
              <p class="text-xs text-slate-400 mb-2">For continuous values</p>
              <div class="h-4 rounded bg-gradient-to-r from-blue-100 to-blue-600"></div>
            </div>
            <div class="p-4 bg-slate-800/50 rounded-xl">
              <h3 class="font-medium text-white mb-2">Diverging</h3>
              <p class="text-xs text-slate-400 mb-2">For values with midpoint</p>
              <div class="h-4 rounded bg-gradient-to-r from-red-500 via-white to-blue-500"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- Kibana Export -->
      <section id="kibana" class="card">
        <button 
          @click="toggleSection('kibanaExport')"
          class="w-full flex items-center justify-between p-6"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <FileJson class="w-5 h-5 text-cyan-400" />
            </div>
            <div class="text-left">
              <h2 class="text-xl font-semibold text-white">Kibana Export</h2>
              <p class="text-sm text-slate-400">Export visualizations for use in Kibana</p>
            </div>
          </div>
          <component :is="expandedSections.kibanaExport ? ChevronDown : ChevronRight" class="w-5 h-5 text-slate-400" />
        </button>
        
        <div v-if="expandedSections.kibanaExport" class="px-6 pb-6 space-y-4">
          <p class="text-slate-300">
            The Kibana export format embeds your Elasticsearch query directly in the Vega spec's <code class="text-ocean-400">data.url.body</code> property, 
            allowing Kibana to execute the aggregation when rendering the visualization.
          </p>
          
          <div class="p-4 bg-slate-800/50 rounded-xl font-mono text-sm">
            <pre class="text-slate-300 overflow-x-auto"><code>{
  "data": {
    "url": {
      "%context%": true,
      "%timefield%": "@timestamp",
      "index": "your-index-*",
      "body": {
        "aggs": { ... },
        "size": 0
      }
    }
  }
}</code></pre>
          </div>
        </div>
      </section>

      <!-- External Links -->
      <div class="grid grid-cols-2 gap-4">
        <a
          href="https://vega.github.io/vega-lite/"
          target="_blank"
          rel="noopener noreferrer"
          class="card p-4 flex items-center gap-4 hover:border-ocean-500/50 transition-colors group"
        >
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-ocean-400 to-ocean-600 flex items-center justify-center">
            <BarChart3 class="w-6 h-6 text-white" />
          </div>
          <div class="flex-1">
            <h3 class="font-medium text-white group-hover:text-ocean-400 transition-colors">Vega-Lite Docs</h3>
            <p class="text-sm text-slate-400">Official specification reference</p>
          </div>
          <ExternalLink class="w-5 h-5 text-slate-400" />
        </a>

        <a
          href="https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations.html"
          target="_blank"
          rel="noopener noreferrer"
          class="card p-4 flex items-center gap-4 hover:border-ocean-500/50 transition-colors group"
        >
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <Database class="w-6 h-6 text-white" />
          </div>
          <div class="flex-1">
            <h3 class="font-medium text-white group-hover:text-ocean-400 transition-colors">ES Aggregations</h3>
            <p class="text-sm text-slate-400">Learn about aggregation types</p>
          </div>
          <ExternalLink class="w-5 h-5 text-slate-400" />
        </a>
      </div>
    </div>
  </div>
</template>
