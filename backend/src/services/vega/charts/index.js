/**
 * Chart Generators Index
 * Exports all chart generator classes
 */

// Trend charts
export { BarChartGenerator } from './BarChartGenerator.js';
export { LineChartGenerator } from './LineChartGenerator.js';
export { AreaChartGenerator } from './AreaChartGenerator.js';
export { RollingAverageGenerator } from './RollingAverageGenerator.js';
export { SparklineGenerator } from './SparklineGenerator.js';
export { HorizonGenerator } from './HorizonGenerator.js';
export { StreamgraphGenerator } from './StreamgraphGenerator.js';
export { LasagnaGenerator } from './LasagnaGenerator.js';
export { DualAxisGenerator } from './DualAxisGenerator.js';
export { TrellisAreaGenerator } from './TrellisAreaGenerator.js';

// Composition charts
export { MarimekkoGenerator } from './MarimekkoGenerator.js';

// Point-based charts
export { ScatterChartGenerator } from './ScatterChartGenerator.js';
// BubbleChartGenerator disabled - Scatter with size field provides same functionality
// export { BubbleChartGenerator } from './BubbleChartGenerator.js';

// Grid/Heatmap charts
export { HeatmapGenerator } from './HeatmapGenerator.js';
export { BinnedHeatmapGenerator } from './BinnedHeatmapGenerator.js';
export { HeatlaneGenerator } from './HeatlaneGenerator.js';

// Distribution charts
export { HistogramGenerator } from './HistogramGenerator.js';
export { BoxplotGenerator } from './BoxplotGenerator.js';
export { DensityGenerator } from './DensityGenerator.js';
export { ErrorBarsGenerator } from './ErrorBarsGenerator.js';
export { ViolinGenerator } from './ViolinGenerator.js';

// Hierarchical charts
export { CirclePackingGenerator } from './CirclePackingGenerator.js';

// Gauge/Radial charts
export { RadialGenerator } from './RadialGenerator.js';
export { RadarGenerator } from './RadarGenerator.js';
export { BulletGenerator } from './BulletGenerator.js';

// Flow/Process charts
export { SankeyGenerator } from './SankeyGenerator.js';
export { WaterfallGenerator } from './WaterfallGenerator.js';
export { FunnelGenerator } from './FunnelGenerator.js';
export { ChordGenerator } from './ChordGenerator.js';

// Specialty charts
export { TernaryGenerator } from './TernaryGenerator.js';
export { CometGenerator } from './CometGenerator.js';
export { PopulationPyramidGenerator } from './PopulationPyramidGenerator.js';
export { ParetoGenerator } from './ParetoGenerator.js';
