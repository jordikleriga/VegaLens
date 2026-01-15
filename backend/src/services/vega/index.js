/**
 * Vega Generator Module
 * 
 * Provides a modular, plugin-based architecture for chart generation.
 * All chart types are registered with the chartRegistry and can be accessed
 * via chartRegistry.generate(), chartRegistry.generateForKibana(), etc.
 */

import { VegaGeneratorBase } from './VegaGeneratorBase.js';
import { chartRegistry } from './registry.js';
import { logger, Logger } from './utils/logger.js';
import { 
  ErrorCodes, 
  ChartError, 
  withRetry, 
  parseElasticsearchError, 
  parseVegaError 
} from './utils/errors.js';

// Import all chart generators
import {
  // Trend charts
  BarChartGenerator,
  LineChartGenerator,
  AreaChartGenerator,
  RollingAverageGenerator,
  SparklineGenerator,
  HorizonGenerator,
  StreamgraphGenerator,
  LasagnaGenerator,
  DualAxisGenerator,
  TrellisAreaGenerator,

  // Composition charts
  MarimekkoGenerator,

  // Point-based charts
  ScatterChartGenerator,

  // Grid/Heatmap charts
  HeatmapGenerator,
  BinnedHeatmapGenerator,
  HeatlaneGenerator,

  // Distribution charts
  HistogramGenerator,
  BoxplotGenerator,
  DensityGenerator,
  ErrorBarsGenerator,
  ViolinGenerator,

  // Hierarchical charts
  CirclePackingGenerator,

  // Gauge/Radial charts
  RadialGenerator,
  RadarGenerator,
  BulletGenerator,

  // Flow/Process charts
  SankeyGenerator,
  WaterfallGenerator,
  FunnelGenerator,
  ChordGenerator,

  // Specialty charts
  TernaryGenerator,
  CometGenerator,
  PopulationPyramidGenerator,
  ParetoGenerator
} from './charts/index.js';

// Helper function to register a generator
function registerGenerator(type, GeneratorClass) {
  chartRegistry.register(type, {
    generator: GeneratorClass,
    metadata: GeneratorClass.metadata,
    schema: GeneratorClass.schema
  });
}

// Register all built-in chart types
// Trend charts
registerGenerator('bar', BarChartGenerator);
registerGenerator('line', LineChartGenerator);
registerGenerator('area', AreaChartGenerator);
registerGenerator('rolling_average', RollingAverageGenerator);
registerGenerator('sparkline', SparklineGenerator);
registerGenerator('horizon', HorizonGenerator);
registerGenerator('streamgraph', StreamgraphGenerator);
registerGenerator('lasagna', LasagnaGenerator);
registerGenerator('dual_axis', DualAxisGenerator);
registerGenerator('trellis_area', TrellisAreaGenerator);

// Composition charts
registerGenerator('marimekko', MarimekkoGenerator);

// Point-based charts
registerGenerator('scatter', ScatterChartGenerator);
// registerGenerator('bubble', BubbleChartGenerator); // Disabled - use Scatter with size field

// Grid/Heatmap charts
registerGenerator('heatmap', HeatmapGenerator);
registerGenerator('binned_heatmap', BinnedHeatmapGenerator);
registerGenerator('heatlane', HeatlaneGenerator);

// Distribution charts
registerGenerator('histogram', HistogramGenerator);
registerGenerator('boxplot', BoxplotGenerator);
registerGenerator('density', DensityGenerator);
registerGenerator('error_bars', ErrorBarsGenerator);
registerGenerator('violin', ViolinGenerator);

// Hierarchical charts
registerGenerator('circle_packing', CirclePackingGenerator);

// Gauge/Radial charts
registerGenerator('radial', RadialGenerator);
registerGenerator('radar', RadarGenerator);
registerGenerator('bullet', BulletGenerator);

// Flow/Process charts
registerGenerator('sankey', SankeyGenerator);
registerGenerator('waterfall', WaterfallGenerator);
registerGenerator('funnel', FunnelGenerator);
registerGenerator('chord', ChordGenerator);

// Specialty charts
registerGenerator('ternary', TernaryGenerator);
registerGenerator('comet', CometGenerator);
registerGenerator('population_pyramid', PopulationPyramidGenerator);
registerGenerator('pareto', ParetoGenerator);

// Export for external use
export {
  // Core
  VegaGeneratorBase,
  chartRegistry,
  
  // Logging
  logger,
  Logger,
  
  // Error handling
  ErrorCodes,
  ChartError,
  withRetry,
  parseElasticsearchError,
  parseVegaError,
  
  // Trend charts
  BarChartGenerator,
  LineChartGenerator,
  AreaChartGenerator,
  RollingAverageGenerator,
  SparklineGenerator,
  HorizonGenerator,
  StreamgraphGenerator,
  LasagnaGenerator,
  DualAxisGenerator,
  TrellisAreaGenerator,
  
  // Composition charts
  MarimekkoGenerator,

  // Point-based charts
  ScatterChartGenerator,

  // Grid/Heatmap charts
  HeatmapGenerator,
  BinnedHeatmapGenerator,
  HeatlaneGenerator,

  // Distribution charts
  HistogramGenerator,
  BoxplotGenerator,
  DensityGenerator,
  ErrorBarsGenerator,
  ViolinGenerator,

  // Hierarchical charts
  CirclePackingGenerator,

  // Gauge/Radial charts
  RadialGenerator,
  RadarGenerator,
  BulletGenerator,

  // Flow/Process charts
  SankeyGenerator,
  WaterfallGenerator,
  FunnelGenerator,
  ChordGenerator,

  // Specialty charts
  TernaryGenerator,
  CometGenerator,
  PopulationPyramidGenerator,
  ParetoGenerator
};

export default chartRegistry;
