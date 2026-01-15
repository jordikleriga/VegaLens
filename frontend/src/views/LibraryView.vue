<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useVegaStore } from '@/stores/vega'
import { useElasticStore } from '@/stores/elastic'
import api from '@/services/api'
import {
  Plus,
  Search,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Grid3X3,
  TrendingUp,
  GitCompare,
  Thermometer,
  Box,
  Triangle,
  Droplets,
  Play,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Layers,
  Workflow,
  DollarSign,
  LayoutGrid,
  Radar,
  Filter,
  Zap,
  Waves,
  CircleDot,
  Mountain,
  X,
  Database,
  Target
} from 'lucide-vue-next'
import embed from 'vega-embed'

const vegaStore = useVegaStore()
const elasticStore = useElasticStore()
const router = useRouter()

const searchQuery = ref('')
const previewingTemplate = ref(null)
const previewContainer = ref(null)
const previewLoading = ref(false)
const previewError = ref(null)
const generatedSpec = ref(null)

// Index selection state
const showIndexPicker = ref(false)
const selectedTemplateForIndex = ref(null)

// Fetch indices on mount
onMounted(async () => {
  await elasticStore.checkConnection()
  if (elasticStore.connected) {
    await elasticStore.fetchIndices()
  }
})

// Expanded sections state - all collapsed by default
const expandedSections = ref({
  comparison: false,
  trend: false,
  composition: false,
  distribution: false,
  correlation: false,
  hierarchy: false,
  flow: false
})
const allExpanded = ref(false)

function toggleSection(categoryId) {
  expandedSections.value[categoryId] = !expandedSections.value[categoryId]
  updateAllExpandedState()
}

// Check if section is expanded (auto-expand when searching)
function isSectionExpanded(categoryId) {
  if (searchQuery.value) return true // Auto-expand when searching
  return expandedSections.value[categoryId] || false
}

// Toggle all sections
function toggleAllSections() {
  allExpanded.value = !allExpanded.value
  categoryDefinitions.forEach(cat => {
    expandedSections.value[cat.id] = allExpanded.value
  })
}

// Update allExpanded state based on current sections
function updateAllExpandedState() {
  const sections = Object.values(expandedSections.value)
  allExpanded.value = sections.length > 0 && sections.every(v => v)
}

// Clear search
function clearSearch() {
  searchQuery.value = ''
}

// Category definitions matching Dashboard Builder with same colors (ordered: Comparison, Trends, Flow, Distribution, Composition, then rest)
const categoryDefinitions = [
  { id: 'comparison', name: 'Comparison', icon: BarChart3, description: 'Compare values across categories', gradient: 'from-ocean-500 to-ocean-600', iconColor: 'text-ocean-400', bgColor: 'bg-ocean-500/20' },
  { id: 'trend', name: 'Trends', icon: TrendingUp, description: 'Show data changes over time', gradient: 'from-emerald-500 to-emerald-600', iconColor: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  { id: 'flow', name: 'Flow', icon: Workflow, description: 'Show movement and connections', gradient: 'from-rose-500 to-rose-600', iconColor: 'text-rose-400', bgColor: 'bg-rose-500/20' },
  { id: 'distribution', name: 'Distribution', icon: Layers, description: 'Show data spread and density', gradient: 'from-cyan-500 to-cyan-600', iconColor: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  { id: 'composition', name: 'Composition', icon: PieChart, description: 'Show parts of a whole', gradient: 'from-coral-500 to-coral-600', iconColor: 'text-coral-400', bgColor: 'bg-coral-500/20' },
  { id: 'correlation', name: 'Relationship', icon: Grid3X3, description: 'Show relationships between variables', gradient: 'from-purple-500 to-purple-600', iconColor: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  { id: 'hierarchy', name: 'Hierarchy', icon: LayoutGrid, description: 'Show nested data structures', gradient: 'from-amber-500 to-amber-600', iconColor: 'text-amber-400', bgColor: 'bg-amber-500/20' }
]

// Template definitions with fake data
const templates = ref([
  // COMPARISON
  {
    id: 'bar-chart',
    name: 'Bar Chart',
    description: 'Compare categories with horizontal or vertical bars',
    category: 'comparison',
    icon: BarChart3,
    type: 'bar',
    config: { xField: 'category', yField: 'sales', title: 'Monthly Sales by Region' },
    data: [
      { category: 'North', sales: 12500 },
      { category: 'South', sales: 9800 },
      { category: 'East', sales: 15200 },
      { category: 'West', sales: 11300 },
      { category: 'Central', sales: 8900 }
    ]
  },
  {
    id: 'radial',
    name: 'Radial Bar Chart',
    description: 'Circular bar chart for comparing categories',
    category: 'comparison',
    icon: Target,
    type: 'radial',
    config: { categoryField: 'skill', valueField: 'proficiency', title: 'Skills Assessment' },
    data: [
      { skill: 'JavaScript', proficiency: 90 },
      { skill: 'Python', proficiency: 75 },
      { skill: 'SQL', proficiency: 85 },
      { skill: 'React', proficiency: 88 },
      { skill: 'Docker', proficiency: 60 }
    ]
  },
  {
    id: 'comet',
    name: 'Comet Chart',
    description: 'Show changes between two states with trail marks',
    category: 'comparison',
    icon: GitCompare,
    type: 'comet',
    config: { categoryField: 'product', timeField: 'year', valueField: 'sales', title: 'Sales Change 2023 vs 2024' },
    data: [
      { product: 'Laptops', year: '2023', sales: 45000 },
      { product: 'Laptops', year: '2024', sales: 62000 },
      { product: 'Phones', year: '2023', sales: 78000 },
      { product: 'Phones', year: '2024', sales: 71000 },
      { product: 'Tablets', year: '2023', sales: 23000 },
      { product: 'Tablets', year: '2024', sales: 35000 },
      { product: 'Accessories', year: '2023', sales: 15000 },
      { product: 'Accessories', year: '2024', sales: 28000 }
    ]
  },
  {
    id: 'population-pyramid',
    name: 'Population Pyramid',
    description: 'Diverging stacked bar chart comparing two groups',
    category: 'comparison',
    icon: BarChart3,
    type: 'population_pyramid',
    config: { 
      categoryField: 'age', 
      valueField: 'population', 
      groupField: 'gender',
      leftGroup: 'Male',
      rightGroup: 'Female',
      leftColor: '#675193',
      rightColor: '#ca8861',
      title: 'US Population by Age & Gender' 
    },
    data: [
      { age: '0-9', population: 10200, gender: 'Male' },
      { age: '0-9', population: 9800, gender: 'Female' },
      { age: '10-19', population: 10500, gender: 'Male' },
      { age: '10-19', population: 10100, gender: 'Female' },
      { age: '20-29', population: 11200, gender: 'Male' },
      { age: '20-29', population: 10800, gender: 'Female' },
      { age: '30-39', population: 10800, gender: 'Male' },
      { age: '30-39', population: 10600, gender: 'Female' }
    ]
  },
  {
    id: 'radar-chart',
    name: 'Radar Chart',
    description: 'Compare multiple dimensions on a radial grid',
    category: 'comparison',
    icon: Radar,
    type: 'radar',
    config: { 
      keyField: 'attribute', 
      valueField: 'value', 
      categoryField: 'team',
      colorScheme: 'category10',
      fillOpacity: 0.2,
      strokeWidth: 2,
      title: 'Team Skills Comparison' 
    },
    data: [
      { attribute: 'Communication', value: 85, team: 'Team Alpha' },
      { attribute: 'Technical', value: 92, team: 'Team Alpha' },
      { attribute: 'Leadership', value: 78, team: 'Team Alpha' },
      { attribute: 'Creativity', value: 88, team: 'Team Alpha' },
      { attribute: 'Problem Solving', value: 95, team: 'Team Alpha' },
      { attribute: 'Teamwork', value: 82, team: 'Team Alpha' },
      { attribute: 'Communication', value: 90, team: 'Team Beta' },
      { attribute: 'Technical', value: 75, team: 'Team Beta' },
      { attribute: 'Leadership', value: 88, team: 'Team Beta' },
      { attribute: 'Creativity', value: 70, team: 'Team Beta' },
      { attribute: 'Problem Solving', value: 80, team: 'Team Beta' },
      { attribute: 'Teamwork', value: 95, team: 'Team Beta' }
    ]
  },
  {
    id: 'pareto-chart',
    name: 'Pareto Chart',
    description: 'Combined bar and cumulative line for 80/20 analysis',
    category: 'comparison',
    icon: TrendingUp,
    type: 'pareto',
    config: { 
      categoryField: 'defect_type', 
      valueField: 'count',
      show80Line: true,
      showLine: true,
      showPoints: true,
      title: 'Defect Analysis - Pareto' 
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
  },
  // TRENDS
  {
    id: 'line-chart',
    name: 'Line Chart',
    description: 'Show trends over time or continuous data',
    category: 'trend',
    icon: LineChart,
    type: 'line',
    config: { xField: 'month', yField: 'revenue', title: 'Revenue Trend 2024' },
    data: [
      { month: 'Jan', revenue: 45000 },
      { month: 'Feb', revenue: 52000 },
      { month: 'Mar', revenue: 48000 },
      { month: 'Apr', revenue: 61000 },
      { month: 'May', revenue: 55000 },
      { month: 'Jun', revenue: 67000 }
    ]
  },
  {
    id: 'area-chart',
    name: 'Area Chart',
    description: 'Show cumulative totals over time',
    category: 'trend',
    icon: Activity,
    type: 'area',
    config: { xField: 'month', yField: 'users', title: 'Daily Active Users' },
    data: [
      { month: 'Jan', users: 1200 },
      { month: 'Feb', users: 1450 },
      { month: 'Mar', users: 1380 },
      { month: 'Apr', users: 1620 },
      { month: 'May', users: 1890 },
      { month: 'Jun', users: 2100 }
    ]
  },
  {
    id: 'rolling-average',
    name: 'Rolling Average',
    description: 'Show raw values with rolling average trend line',
    category: 'trend',
    icon: TrendingUp,
    type: 'rolling_average',
    config: { xField: 'date', yField: 'temp', windowSize: 3, title: 'Temperature with Rolling Average' },
    data: [
      { date: '2024-01-01', temp: 12 },
      { date: '2024-01-02', temp: 15 },
      { date: '2024-01-03', temp: 10 },
      { date: '2024-01-04', temp: 18 },
      { date: '2024-01-05', temp: 14 },
      { date: '2024-01-06', temp: 11 },
      { date: '2024-01-07', temp: 16 }
    ]
  },
  {
    id: 'dual-axis',
    name: 'Dual-Axis Chart',
    description: 'Layered chart with two independent Y-axis scales',
    category: 'trend',
    icon: LineChart,
    type: 'dual_axis',
    config: { 
      xField: 'month', 
      yField1: 'temperature', 
      yField2: 'precipitation',
      y1Label: 'Avg Temperature (°C)',
      y2Label: 'Precipitation (mm)',
      y1Color: '#85C5A6',
      y2Color: '#85A9C5',
      title: 'Seattle Weather Patterns' 
    },
    data: [
      { month: '2024-01', temperature: 6, precipitation: 140 },
      { month: '2024-02', temperature: 8, precipitation: 110 },
      { month: '2024-03', temperature: 10, precipitation: 100 },
      { month: '2024-04', temperature: 12, precipitation: 70 },
      { month: '2024-05', temperature: 16, precipitation: 50 },
      { month: '2024-06', temperature: 19, precipitation: 40 }
    ]
  },
  {
    id: 'trellis-area',
    name: 'Trellis Area',
    description: 'Small multiples of area charts faceted by field',
    category: 'trend',
    icon: Activity,
    type: 'trellis_area',
    config: { 
      xField: 'date', 
      yField: 'price', 
      facetField: 'symbol',
      panelHeight: 60,
      panelWidth: 300,
      title: 'Stock Price Trends' 
    },
    data: [
      { date: '2024-01', price: 185, symbol: 'AAPL' },
      { date: '2024-02', price: 182, symbol: 'AAPL' },
      { date: '2024-03', price: 171, symbol: 'AAPL' },
      { date: '2024-01', price: 376, symbol: 'MSFT' },
      { date: '2024-02', price: 411, symbol: 'MSFT' },
      { date: '2024-03', price: 420, symbol: 'MSFT' }
    ]
  },
  {
    id: 'lasagna-plot',
    name: 'Lasagna Plot',
    description: 'Dense time-series heatmap for multiple series',
    category: 'trend',
    icon: Grid3X3,
    type: 'lasagna',
    config: { 
      xField: 'date', 
      yField: 'symbol', 
      valueField: 'price',
      colorScheme: 'blues',
      title: 'Stock Prices Over Time' 
    },
    data: [
      { date: '2024-01-01', symbol: 'AAPL', price: 185 },
      { date: '2024-02-01', symbol: 'AAPL', price: 182 },
      { date: '2024-03-01', symbol: 'AAPL', price: 171 },
      { date: '2024-01-01', symbol: 'MSFT', price: 376 },
      { date: '2024-02-01', symbol: 'MSFT', price: 411 },
      { date: '2024-03-01', symbol: 'MSFT', price: 420 }
    ]
  },
  // COMPOSITION
  {
    id: 'ternary',
    name: 'Ternary Chart',
    description: 'Plot three variables that sum to 100% on a triangle',
    category: 'composition',
    icon: Triangle,
    type: 'ternary',
    config: { 
      labelField: 'city', 
      topField: 'high', 
      leftField: 'medium', 
      rightField: 'low',
      title: 'Income Distribution by City' 
    },
    data: [
      { city: 'San Francisco', high: 45, medium: 35, low: 20 },
      { city: 'Austin', high: 30, medium: 45, low: 25 },
      { city: 'Detroit', high: 15, medium: 35, low: 50 },
      { city: 'Miami', high: 35, medium: 40, low: 25 }
    ]
  },
  // DISTRIBUTION
  {
    id: 'histogram',
    name: 'Histogram',
    description: 'Show distribution of numerical data',
    category: 'distribution',
    icon: BarChart3,
    type: 'histogram',
    config: { field: 'age', bins: 10, title: 'Customer Age Distribution' },
    data: [
      { age: 22 }, { age: 25 }, { age: 28 }, { age: 31 }, { age: 35 },
      { age: 38 }, { age: 42 }, { age: 45 }, { age: 48 }, { age: 52 }
    ]
  },
  {
    id: 'heatmap',
    name: 'Heatmap',
    description: 'Show data density with color intensity',
    category: 'distribution',
    icon: Grid3X3,
    type: 'heatmap',
    config: { xField: 'hour', yField: 'day', valueField: 'traffic', colorScheme: 'blues', title: 'Website Traffic Heatmap' },
    data: [
      { hour: '9AM', day: 'Mon', traffic: 120 },
      { hour: '12PM', day: 'Mon', traffic: 250 },
      { hour: '3PM', day: 'Mon', traffic: 180 },
      { hour: '9AM', day: 'Tue', traffic: 140 },
      { hour: '12PM', day: 'Tue', traffic: 280 },
      { hour: '3PM', day: 'Tue', traffic: 200 }
    ]
  },
  {
    id: 'binned-heatmap',
    name: '2D Histogram Heatmap',
    description: 'Show distribution of two quantitative variables with binning',
    category: 'distribution',
    icon: Grid3X3,
    type: 'binned_heatmap',
    config: { 
      xField: 'imdb_rating', 
      yField: 'rt_rating', 
      xBins: 30, 
      yBins: 20, 
      colorScheme: 'viridis',
      aggregate: 'count',
      filterInvalid: true,
      title: 'Movie Ratings Distribution' 
    },
    data: [
      { imdb_rating: 6.5, rt_rating: 75 }, { imdb_rating: 7.2, rt_rating: 82 },
      { imdb_rating: 8.1, rt_rating: 91 }, { imdb_rating: 5.8, rt_rating: 62 },
      { imdb_rating: 7.8, rt_rating: 88 }, { imdb_rating: 6.9, rt_rating: 71 },
      { imdb_rating: 8.5, rt_rating: 95 }, { imdb_rating: 4.2, rt_rating: 38 },
      { imdb_rating: 7.5, rt_rating: 80 }, { imdb_rating: 6.1, rt_rating: 65 },
      { imdb_rating: 8.8, rt_rating: 97 }, { imdb_rating: 5.5, rt_rating: 55 },
      { imdb_rating: 7.0, rt_rating: 75 }, { imdb_rating: 6.3, rt_rating: 68 },
      { imdb_rating: 8.3, rt_rating: 92 }, { imdb_rating: 4.8, rt_rating: 42 },
      { imdb_rating: 7.6, rt_rating: 83 }, { imdb_rating: 6.7, rt_rating: 72 },
      { imdb_rating: 8.0, rt_rating: 89 }, { imdb_rating: 5.2, rt_rating: 48 },
      { imdb_rating: 7.3, rt_rating: 78 }, { imdb_rating: 6.0, rt_rating: 63 },
      { imdb_rating: 8.6, rt_rating: 94 }, { imdb_rating: 4.5, rt_rating: 40 },
      { imdb_rating: 7.9, rt_rating: 86 }, { imdb_rating: 6.4, rt_rating: 69 }
    ]
  },
  {
    id: 'boxplot',
    name: 'Box Plot',
    description: 'Show statistical distribution with quartiles',
    category: 'distribution',
    icon: Box,
    type: 'boxplot',
    config: { categoryField: 'department', valueField: 'salary', title: 'Salary Distribution by Department' },
    data: [
      { department: 'Engineering', salary: 85000 },
      { department: 'Engineering', salary: 92000 },
      { department: 'Engineering', salary: 105000 },
      { department: 'Engineering', salary: 78000 },
      { department: 'Engineering', salary: 115000 },
      { department: 'Sales', salary: 55000 },
      { department: 'Sales', salary: 62000 },
      { department: 'Sales', salary: 72000 }
    ]
  },
  {
    id: 'heatlane',
    name: 'Heat Lane Chart',
    description: 'Show distribution as a lane with varying thickness',
    category: 'distribution',
    icon: Thermometer,
    type: 'heatlane',
    config: { valueField: 'score', binCount: 8, title: 'Test Score Distribution' },
    data: [
      { score: 45 }, { score: 52 }, { score: 58 }, { score: 62 }, { score: 68 },
      { score: 72 }, { score: 75 }, { score: 78 }, { score: 82 }, { score: 85 }
    ]
  },
  // CORRELATION
  {
    id: 'scatter-plot',
    name: 'Scatter Plot',
    description: 'Show relationships between two variables',
    category: 'correlation',
    icon: Grid3X3,
    type: 'scatter',
    config: { xField: 'experience', yField: 'salary', opacity: 0.7, title: 'Experience vs Salary' },
    data: [
      { experience: 1, salary: 45000 },
      { experience: 2, salary: 52000 },
      { experience: 3, salary: 58000 },
      { experience: 5, salary: 72000 },
      { experience: 7, salary: 85000 },
      { experience: 10, salary: 105000 }
    ]
  },
  // Bubble chart disabled - use scatter with size field instead
  // {
  //   id: 'bubble-plot',
  //   name: 'Bubble Plot',
  //   description: 'Scatter plot with size encoding for a third variable (Gapminder style)',
  //   category: 'correlation',
  //   icon: Grid3X3,
  //   type: 'bubble',
  //   config: {
  //     xField: 'income',
  //     yField: 'health',
  //     sizeField: 'population',
  //     colorField: 'region',
  //     xScaleType: 'log',
  //     yZero: false,
  //     enableZoom: true,
  //     opacity: 0.7,
  //     title: 'Health vs Income (Gapminder Style)'
  //   },
  //   data: [
  //     { country: 'USA', income: 55000, health: 78.5, population: 320, region: 'Americas' },
  //     { country: 'China', income: 12000, health: 76.1, population: 1400, region: 'Asia' },
  //     { country: 'India', income: 6000, health: 68.8, population: 1300, region: 'Asia' },
  //     { country: 'Japan', income: 40000, health: 84.2, population: 126, region: 'Asia' },
  //     { country: 'Germany', income: 48000, health: 81.0, population: 83, region: 'Europe' },
  //     { country: 'Brazil', income: 15000, health: 75.5, population: 210, region: 'Americas' },
  //     { country: 'UK', income: 42000, health: 81.2, population: 67, region: 'Europe' },
  //     { country: 'France', income: 43000, health: 82.5, population: 67, region: 'Europe' },
  //     { country: 'Nigeria', income: 5000, health: 54.3, population: 200, region: 'Africa' },
  //     { country: 'Australia', income: 50000, health: 82.9, population: 25, region: 'Oceania' }
  //   ]
  // },
  // FLOW
  {
    id: 'sankey',
    name: 'Sankey Diagram',
    description: 'Show flow between categories',
    category: 'flow',
    icon: GitCompare,
    type: 'sankey',
    config: { sourceField: 'source', targetField: 'target', valueField: 'value', title: 'User Journey Flow' },
    data: [
      { source: 'Homepage', target: 'Products', value: 500 },
      { source: 'Homepage', target: 'About', value: 150 },
      { source: 'Products', target: 'Cart', value: 300 },
      { source: 'Products', target: 'Wishlist', value: 100 },
      { source: 'Cart', target: 'Checkout', value: 200 }
    ]
  },
  {
    id: 'chord-diagram',
    name: 'Chord Diagram',
    description: 'Show relationships in a circular layout',
    category: 'flow',
    icon: CircleDot,
    type: 'chord',
    config: { 
      sourceField: 'from', 
      targetField: 'to', 
      valueField: 'value',
      showLabels: true,
      title: 'Trade Flow Between Regions' 
    },
    data: [
      { from: 'North America', to: 'Europe', value: 45 },
      { from: 'North America', to: 'Asia', value: 62 },
      { from: 'Europe', to: 'North America', value: 38 },
      { from: 'Europe', to: 'Asia', value: 55 },
      { from: 'Asia', to: 'North America', value: 78 },
      { from: 'Asia', to: 'Europe', value: 42 },
      { from: 'Europe', to: 'Africa', value: 25 },
      { from: 'Asia', to: 'Africa', value: 18 }
    ]
  },
  {
    id: 'waterfall',
    name: 'Waterfall Chart',
    description: 'Show cumulative effect of sequential values',
    category: 'flow',
    icon: Droplets,
    type: 'waterfall',
    config: { labelField: 'category', valueField: 'amount', title: 'Quarterly Profit Analysis' },
    data: [
      { category: 'Revenue', amount: 500000 },
      { category: 'Cost of Sales', amount: -180000 },
      { category: 'Operating', amount: -120000 },
      { category: 'Marketing', amount: -45000 },
      { category: 'Tax', amount: -35000 }
    ]
  },
  // NEW CHARTS - FLOW
  {
    id: 'funnel-chart',
    name: 'Funnel Chart',
    description: 'Show conversion stages with trapezoidal shapes',
    category: 'flow',
    icon: Filter,
    type: 'funnel',
    config: { 
      stageField: 'stage', 
      valueField: 'count', 
      showLabels: true,
      showPercentage: false,
      title: 'Sales Conversion Funnel' 
    },
    data: [
      { stage: 'Visitors', count: 12000 },
      { stage: 'Leads', count: 6500 },
      { stage: 'Opportunities', count: 3200 },
      { stage: 'Proposals', count: 1800 },
      { stage: 'Negotiation', count: 950 },
      { stage: 'Closed Won', count: 480 }
    ]
  },
  // NEW CHARTS - TRENDS
  {
    id: 'sparkline-chart',
    name: 'Sparkline',
    description: 'Compact inline trend visualization',
    category: 'trend',
    icon: Zap,
    type: 'sparkline',
    config: { 
      xField: 'date', 
      yField: 'value',
      showArea: true,
      showEndpoint: true,
      height: 50,
      title: 'Weekly Activity Sparklines' 
    },
    data: [
      { date: '2024-01-01', value: 45 },
      { date: '2024-01-02', value: 52 },
      { date: '2024-01-03', value: 48 },
      { date: '2024-01-04', value: 61 },
      { date: '2024-01-05', value: 55 },
      { date: '2024-01-06', value: 72 },
      { date: '2024-01-07', value: 68 }
    ]
  },
  {
    id: 'horizon-chart',
    name: 'Horizon Chart',
    description: 'Compact layered area chart for time series',
    category: 'trend',
    icon: Waves,
    type: 'horizon',
    config: { 
      xField: 'date', 
      yField: 'value',
      bands: 3,
      positiveColor: '#4c78a8',
      negativeColor: '#e45756',
      title: 'Stock Price Movement' 
    },
    data: [
      { date: '2024-01-01', value: 10 },
      { date: '2024-01-02', value: 25 },
      { date: '2024-01-03', value: -5 },
      { date: '2024-01-04', value: 35 },
      { date: '2024-01-05', value: -15 },
      { date: '2024-01-06', value: 20 },
      { date: '2024-01-07', value: 45 }
    ]
  },
  {
    id: 'streamgraph-chart',
    name: 'Streamgraph',
    description: 'Flowing stacked area chart with organic shape',
    category: 'trend',
    icon: Waves,
    type: 'streamgraph',
    config: { 
      xField: 'month', 
      yField: 'value',
      colorField: 'genre',
      interpolate: 'basis',
      offset: 'silhouette',
      title: 'Music Streaming by Genre' 
    },
    data: [
      { month: 'Jan', genre: 'Pop', value: 4500 },
      { month: 'Feb', genre: 'Pop', value: 5200 },
      { month: 'Mar', genre: 'Pop', value: 4800 },
      { month: 'Apr', genre: 'Pop', value: 6100 },
      { month: 'Jan', genre: 'Rock', value: 3200 },
      { month: 'Feb', genre: 'Rock', value: 2800 },
      { month: 'Mar', genre: 'Rock', value: 3500 },
      { month: 'Apr', genre: 'Rock', value: 3100 },
      { month: 'Jan', genre: 'Hip Hop', value: 5100 },
      { month: 'Feb', genre: 'Hip Hop', value: 5800 },
      { month: 'Mar', genre: 'Hip Hop', value: 6200 },
      { month: 'Apr', genre: 'Hip Hop', value: 7000 },
      { month: 'Jan', genre: 'Electronic', value: 2800 },
      { month: 'Feb', genre: 'Electronic', value: 3200 },
      { month: 'Mar', genre: 'Electronic', value: 3600 },
      { month: 'Apr', genre: 'Electronic', value: 3900 }
    ]
  },
  // NEW CHARTS - DISTRIBUTION
  {
    id: 'error-bars-chart',
    name: 'Error Bars',
    description: 'Show statistical uncertainty with confidence intervals',
    category: 'distribution',
    icon: BarChart3,
    type: 'error_bars',
    config: { 
      categoryField: 'treatment', 
      valueField: 'effect',
      errorType: 'stdev',
      centerMark: 'mean',
      showRawPoints: true,
      title: 'Treatment Effects with Error Bars' 
    },
    data: [
      { treatment: 'Control', effect: 2.1 },
      { treatment: 'Control', effect: 2.5 },
      { treatment: 'Control', effect: 1.8 },
      { treatment: 'Control', effect: 2.3 },
      { treatment: 'Drug A', effect: 4.2 },
      { treatment: 'Drug A', effect: 4.8 },
      { treatment: 'Drug A', effect: 3.9 },
      { treatment: 'Drug A', effect: 5.1 },
      { treatment: 'Drug B', effect: 3.5 },
      { treatment: 'Drug B', effect: 3.8 },
      { treatment: 'Drug B', effect: 3.2 },
      { treatment: 'Drug B', effect: 4.0 }
    ]
  },
  {
    id: 'density-plot-chart',
    name: 'Density Plot',
    description: 'Smoothed distribution curve for continuous data',
    category: 'distribution',
    icon: Mountain,
    type: 'density',
    config: { 
      valueField: 'score',
      groupField: 'group',
      bandwidth: 5,
      showRug: false,
      filled: true,
      title: 'Test Score Distribution by Group' 
    },
    data: [
      { score: 65, group: 'Class A' }, { score: 72, group: 'Class A' }, { score: 78, group: 'Class A' },
      { score: 82, group: 'Class A' }, { score: 85, group: 'Class A' }, { score: 88, group: 'Class A' },
      { score: 70, group: 'Class B' }, { score: 75, group: 'Class B' }, { score: 80, group: 'Class B' },
      { score: 85, group: 'Class B' }, { score: 90, group: 'Class B' }, { score: 95, group: 'Class B' }
    ]
  },
  {
    id: 'violin-chart',
    name: 'Violin Plot',
    description: 'Show distribution shape with density and quartiles',
    category: 'distribution',
    icon: Activity,
    type: 'violin',
    config: { 
      categoryField: 'species',
      valueField: 'sepal_length',
      showBoxplot: true,
      showMedian: true,
      title: 'Sepal Length by Iris Species' 
    },
    data: [
      { species: 'setosa', sepal_length: 5.1 }, { species: 'setosa', sepal_length: 4.9 },
      { species: 'setosa', sepal_length: 4.7 }, { species: 'setosa', sepal_length: 5.0 },
      { species: 'setosa', sepal_length: 5.4 }, { species: 'setosa', sepal_length: 4.6 },
      { species: 'versicolor', sepal_length: 7.0 }, { species: 'versicolor', sepal_length: 6.4 },
      { species: 'versicolor', sepal_length: 6.9 }, { species: 'versicolor', sepal_length: 5.5 },
      { species: 'versicolor', sepal_length: 6.5 }, { species: 'versicolor', sepal_length: 5.7 },
      { species: 'virginica', sepal_length: 6.3 }, { species: 'virginica', sepal_length: 5.8 },
      { species: 'virginica', sepal_length: 7.1 }, { species: 'virginica', sepal_length: 6.3 },
      { species: 'virginica', sepal_length: 6.5 }, { species: 'virginica', sepal_length: 7.6 }
    ]
  },
  // NEW CHARTS - HIERARCHY
  {
    id: 'circle-packing-chart',
    name: 'Circle Packing',
    description: 'Nested circles showing hierarchical relationships',
    category: 'hierarchy',
    icon: CircleDot,
    type: 'circle_packing',
    config: { 
      categoryField: 'name', 
      valueField: 'size',
      parentField: 'category',
      showLabels: true,
      title: 'Product Portfolio by Category' 
    },
    data: [
      { name: 'Laptop Pro', size: 45000, category: 'Electronics' },
      { name: 'Smartphone X', size: 62000, category: 'Electronics' },
      { name: 'Tablet Mini', size: 28000, category: 'Electronics' },
      { name: 'Running Shoes', size: 35000, category: 'Sports' },
      { name: 'Yoga Mat', size: 12000, category: 'Sports' },
      { name: 'Winter Jacket', size: 25000, category: 'Clothing' },
      { name: 'Casual Shirt', size: 18000, category: 'Clothing' },
      { name: 'Jeans', size: 22000, category: 'Clothing' }
    ]
  },
  // NEW CHARTS - COMPOSITION
  {
    id: 'marimekko-chart',
    name: 'Marimekko Chart',
    description: 'Variable-width stacked bar chart for market share',
    category: 'composition',
    icon: LayoutGrid,
    type: 'marimekko',
    config: { 
      xField: 'region', 
      yField: 'revenue',
      colorField: 'segment',
      showLabels: true,
      showLegend: true,
      title: 'Market Share by Region & Segment' 
    },
    data: [
      { region: 'North America', segment: 'Enterprise', revenue: 45000 },
      { region: 'North America', segment: 'SMB', revenue: 32000 },
      { region: 'North America', segment: 'Consumer', revenue: 18000 },
      { region: 'Europe', segment: 'Enterprise', revenue: 38000 },
      { region: 'Europe', segment: 'SMB', revenue: 28000 },
      { region: 'Europe', segment: 'Consumer', revenue: 22000 },
      { region: 'Asia Pacific', segment: 'Enterprise', revenue: 52000 },
      { region: 'Asia Pacific', segment: 'SMB', revenue: 41000 },
      { region: 'Asia Pacific', segment: 'Consumer', revenue: 35000 }
    ]
  }
])

// Group templates by category
const templatesByCategory = computed(() => {
  const grouped = {}
  categoryDefinitions.forEach(cat => {
    grouped[cat.id] = templates.value.filter(t => t.category === cat.id)
  })
  return grouped
})

// Filtered templates for search
const filteredTemplatesByCategory = computed(() => {
  if (!searchQuery.value) return templatesByCategory.value
  
  const query = searchQuery.value.toLowerCase()
  const filtered = {}
  
  categoryDefinitions.forEach(cat => {
    filtered[cat.id] = templates.value.filter(t => 
      t.category === cat.id && (
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      )
    )
  })
  
  return filtered
})

// Check if any results exist
const hasResults = computed(() => {
  return Object.values(filteredTemplatesByCategory.value).some(arr => arr.length > 0)
})

async function previewTemplate(template) {
  previewingTemplate.value = template
  previewLoading.value = true
  previewError.value = null
  generatedSpec.value = null
  
  await nextTick()
  
  try {
    const response = await api.post('/vega/generate', {
      type: template.type,
      config: { ...template.config, width: 500, height: 300 },
      data: template.data
    })
    
    const spec = response.data
    
    if (spec.error || spec._error) {
      throw new Error(spec.error || spec._error || 'Failed to generate spec')
    }
    
    generatedSpec.value = spec
    previewLoading.value = false
    
    await nextTick()
    
    if (previewContainer.value && generatedSpec.value) {
      const plainSpec = JSON.parse(JSON.stringify(generatedSpec.value))
      await embed(previewContainer.value, plainSpec, {
        actions: false,
        theme: 'dark',
        config: { background: 'transparent' },
        renderer: 'canvas'
      })
    }
  } catch (err) {
    console.error('Preview error:', err)
    previewError.value = err.message || 'Failed to load preview'
    previewLoading.value = false
  }
}

// Show index picker for the selected template
function selectChart(template) {
  selectedTemplateForIndex.value = template
  showIndexPicker.value = true
}

// Use template with selected index and go to step 3
async function useTemplateWithIndex(indexName) {
  const template = selectedTemplateForIndex.value
  if (!template || !indexName) return
  
  // Select the index
  elasticStore.selectIndex(indexName)
  
  // Apply template config (exclude title - user should set their own)
  vegaStore.selectType(template.type)
  Object.entries(template.config).forEach(([key, value]) => {
    if (key !== 'title') {
      vegaStore.updateConfig(key, value)
    }
  })
  
  // Close modals
  showIndexPicker.value = false
  selectedTemplateForIndex.value = null
  previewingTemplate.value = null
  
  // Navigate to builder - it will auto-advance to step 3 since index is loaded
  router.push('/builder?step=3')
}

function closeIndexPicker() {
  showIndexPicker.value = false
  selectedTemplateForIndex.value = null
}

function closePreview() {
  previewingTemplate.value = null
  previewError.value = null
  generatedSpec.value = null
}

function retryPreview() {
  if (previewingTemplate.value) {
    previewTemplate(previewingTemplate.value)
  }
}

</script>

<template>
  <div class="h-full flex flex-col space-y-6 animate-fade-in overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between flex-shrink-0">
      <div>
        <h1 class="text-2xl font-display font-semibold text-white">Library</h1>
        <p class="text-slate-400 mt-1">Pre-built visualization templates with sample data</p>
      </div>
      <RouterLink to="/builder" class="btn-primary flex items-center gap-2">
        <Plus class="w-5 h-5" />
        New from Scratch
      </RouterLink>
    </div>

    <!-- Search and Controls -->
    <div class="flex items-center gap-4 flex-shrink-0">
      <!-- Search with Toggle -->
      <div class="flex items-center gap-2 flex-1 max-w-lg">
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search templates..."
            class="form-input pl-10 pr-10"
          />
          <button 
            v-if="searchQuery"
            @click="clearSearch"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
        <!-- Expand/Collapse Toggle -->
        <button
          @click="toggleAllSections"
          :disabled="!!searchQuery"
          class="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border transition-all duration-200 whitespace-nowrap"
          :class="searchQuery 
            ? 'border-slate-700 bg-slate-800/30 text-slate-500 cursor-not-allowed' 
            : allExpanded 
              ? 'border-ocean-500/50 bg-ocean-500/10 text-ocean-300 hover:bg-ocean-500/20' 
              : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'"
          :title="allExpanded ? 'Collapse All' : 'Expand All'"
        >
          <component :is="allExpanded ? ChevronDown : ChevronRight" class="w-3.5 h-3.5" />
          <span>{{ allExpanded ? 'Collapse' : 'Expand' }}</span>
        </button>
      </div>
    </div>

    <!-- Categories with Collapsible Sections -->
    <div class="space-y-4 overflow-y-auto flex-1 min-h-0 pr-2">
      <template v-for="category in categoryDefinitions" :key="category.id">
        <div 
          v-if="filteredTemplatesByCategory[category.id]?.length > 0"
          class="card overflow-hidden"
        >
          <!-- Category Header (Clickable) -->
          <button
            @click="toggleSection(category.id)"
            class="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
          >
            <div class="flex items-center gap-3">
              <div 
                class="w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center"
                :class="category.gradient"
              >
                <component :is="category.icon" class="w-5 h-5 text-white" />
              </div>
              <div class="text-left">
                <h2 class="font-semibold text-white">{{ category.name }}</h2>
                <p class="text-xs text-slate-400">{{ filteredTemplatesByCategory[category.id]?.length }} templates</p>
              </div>
            </div>
            <component 
              :is="isSectionExpanded(category.id) ? ChevronDown : ChevronRight" 
              class="w-5 h-5 text-slate-400 transition-transform"
            />
          </button>

          <!-- Category Content -->
          <Transition name="collapse">
            <div v-if="isSectionExpanded(category.id)" class="border-t border-slate-700/50">
              <div class="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <button
                  v-for="template in filteredTemplatesByCategory[category.id]"
                  :key="template.id"
                  @click="previewTemplate(template)"
                  class="p-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-500/50 rounded-xl text-left transition-all duration-200 group"
                >
                  <div class="flex items-center gap-3 mb-2">
                    <div 
                      class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                      :class="[category.bgColor]"
                    >
                      <component :is="template.icon" class="w-4 h-4" :class="category.iconColor" />
                    </div>
                    <h3 class="font-medium text-white text-sm group-hover:text-slate-200 transition-colors truncate">
                      {{ template.name }}
                    </h3>
                  </div>
                  <p class="text-xs text-slate-500 line-clamp-2">
                    {{ template.description }}
                  </p>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </template>
    </div>

    <!-- Empty State -->
    <div v-if="!hasResults" class="card p-12 text-center">
      <Sparkles class="w-16 h-16 text-slate-600 mx-auto mb-4" />
      <h3 class="text-xl font-semibold text-white mb-2">No Templates Found</h3>
      <p class="text-slate-400">Try adjusting your search criteria</p>
    </div>

    <!-- Preview Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="previewingTemplate" 
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div 
            class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            @click="closePreview"
          ></div>

          <!-- Modal -->
          <div class="relative bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b border-slate-700/50">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-ocean-500/20 to-coral-500/20 flex items-center justify-center">
                  <component :is="previewingTemplate.icon" class="w-6 h-6 text-ocean-400" />
                </div>
                <div>
                  <h2 class="text-xl font-semibold text-white">{{ previewingTemplate.name }}</h2>
                  <p class="text-sm text-slate-400">{{ previewingTemplate.description }}</p>
                </div>
              </div>
              <button 
                @click="closePreview"
                class="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <span class="text-slate-400 text-2xl">&times;</span>
              </button>
            </div>

            <!-- Preview -->
            <div class="p-6 bg-slate-800/30 min-h-[320px] flex items-center justify-center">
              <!-- Loading -->
              <div v-if="previewLoading" class="text-center">
                <RefreshCw class="w-8 h-8 text-ocean-400 animate-spin mx-auto mb-3" />
                <p class="text-sm text-slate-400">Generating preview...</p>
              </div>
              
              <!-- Error -->
              <div v-else-if="previewError" class="text-center max-w-md">
                <AlertCircle class="w-12 h-12 text-red-400 mx-auto mb-3" />
                <h4 class="font-medium text-white mb-2">Preview Failed</h4>
                <p class="text-sm text-slate-400 mb-4">{{ previewError }}</p>
                <button @click="retryPreview" class="btn-secondary text-sm">
                  <RefreshCw class="w-4 h-4 mr-2" />
                  Retry
                </button>
              </div>
              
              <!-- Chart Container -->
              <div v-else ref="previewContainer" class="w-full"></div>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-end p-6 border-t border-slate-700/50 gap-3">
              <button 
                @click="closePreview"
                class="btn-secondary"
              >
                Close
              </button>
              <button 
                @click="selectChart(previewingTemplate)"
                class="btn-primary flex items-center gap-2"
              >
                <BarChart3 class="w-4 h-4" />
                Select Chart
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Index Picker Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showIndexPicker" 
          class="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div 
            class="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"
            @click="closeIndexPicker"
          ></div>

          <!-- Modal -->
          <div class="relative bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between p-5 border-b border-slate-700/50">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-ocean-500/20 flex items-center justify-center">
                  <Database class="w-5 h-5 text-ocean-400" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-white">Select Data Source</h2>
                  <p class="text-xs text-slate-400">Choose an index to build your chart</p>
                </div>
              </div>
              <button 
                @click="closeIndexPicker"
                class="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X class="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <!-- Index List -->
            <div class="p-4 max-h-80 overflow-y-auto">
              <div v-if="elasticStore.loading.indices" class="flex items-center justify-center py-8">
                <RefreshCw class="w-6 h-6 text-ocean-400 animate-spin" />
              </div>
              <div v-else-if="elasticStore.indices.length === 0" class="text-center py-8 text-slate-400">
                <Database class="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p class="text-sm">No indices available</p>
              </div>
              <div v-else class="space-y-2">
                <button
                  v-for="index in elasticStore.indices"
                  :key="index.name"
                  @click="useTemplateWithIndex(index.name)"
                  class="w-full text-left p-3 rounded-xl border transition-all duration-200 hover:border-ocean-500/50 hover:bg-ocean-500/10"
                  :class="[
                    index.health === 'green' ? 'border-emerald-500/30' :
                    index.health === 'yellow' ? 'border-amber-500/30' : 'border-red-500/30'
                  ]"
                >
                  <div class="flex items-center gap-3">
                    <div 
                      class="w-8 h-8 rounded-lg flex items-center justify-center"
                      :class="[
                        index.health === 'green' ? 'bg-emerald-500/20' :
                        index.health === 'yellow' ? 'bg-amber-500/20' : 'bg-red-500/20'
                      ]"
                    >
                      <Database 
                        class="w-4 h-4"
                        :class="[
                          index.health === 'green' ? 'text-emerald-400' :
                          index.health === 'yellow' ? 'text-amber-400' : 'text-red-400'
                        ]"
                      />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-white truncate">{{ index.name }}</p>
                      <p class="text-xs text-slate-400">{{ index.docsCount?.toLocaleString() || 0 }} docs</p>
                    </div>
                    <ChevronRight class="w-4 h-4 text-slate-500" />
                  </div>
                </button>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-end p-4 border-t border-slate-700/50">
              <button @click="closeIndexPicker" class="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
