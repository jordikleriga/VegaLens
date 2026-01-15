import { UnifiedChartMapper } from './UnifiedChartMapper.js'
import { FlowChartMapper } from './FlowChartMapper.js'
import { axisConfig } from '@/config/chartAxisConfig.js'

/**
 * Chart Mapper Registry
 *
 * Maps chart types to their appropriate mapper classes.
 * Most charts use UnifiedChartMapper with configKey-based mapping.
 * Special cases use dedicated mappers.
 */

/**
 * Get the appropriate mapper instance for a chart type
 *
 * @param {string} chartType - Chart type identifier
 * @param {Object} axisState - Ref to axis state
 * @param {Object} vegaStore - Vega store instance
 * @returns {BaseChartMapper} Mapper instance
 */
export function getChartMapper(chartType, axisState, vegaStore) {
  // Flow/network charts
  if (chartType === 'sankey' || chartType === 'chord') {
    return new FlowChartMapper(axisState, vegaStore, chartType)
  }

  // All other charts use unified mapping with configKeys
  return new UnifiedChartMapper(axisState, vegaStore, chartType, axisConfig)
}

/**
 * Check if a chart type uses configKey-based mapping
 * (Most charts do, except special cases like gauge/metric/sankey/chord)
 *
 * @param {string} chartType - Chart type identifier
 * @returns {boolean} True if uses configKeys
 */
export function usesConfigKeyMapping(chartType) {
  const axes = axisConfig[chartType]
  return axes?.some(a => a.configKey) || false
}
