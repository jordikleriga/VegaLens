import { BaseChartMapper } from './BaseChartMapper.js'

/**
 * Unified Chart Mapper
 *
 * Uses the configKey approach to map fields for all charts that have
 * configKeys defined in their axis configuration. This handles the majority
 * of chart types with a single unified mapping strategy.
 *
 * Supports: bar, line, area, pie, donut, heatmap, treemap, radial, radar,
 * and all other charts with configKeys in axisConfig.
 */
export class UnifiedChartMapper extends BaseChartMapper {
  constructor(axisState, vegaStore, chartType, axisConfig) {
    super(axisState, vegaStore, chartType)
    this.axisConfig = axisConfig
  }

  /**
   * Build aggregation configuration
   * Uses the standard bucket + metric pattern for most charts
   */
  async buildAggregationConfig(aggregationStore, elasticStore, buildBucketAggConfig) {
    const axes = this.axisConfig[this.chartType]
    if (!axes) return

    // Find ALL required bucket axes (for charts like heatmap with multiple bucket dimensions)
    const requiredBucketAxes = axes.filter(a => a.fieldType === 'bucket' && a.required)

    // Charts that use splitBy for the secondary bucket axis instead of nested bucket aggregation
    // These charts have X as primary bucket and Y as splitBy
    const splitBySecondaryBucketCharts = ['lasagna', 'heatlane']
    const usesSplitByForSecondary = splitBySecondaryBucketCharts.includes(this.chartType)

    if (requiredBucketAxes.length > 0) {
      // Set primary bucket (first required bucket axis)
      const primaryBucketAxis = requiredBucketAxes[0]
      const primaryBucketState = this.axisState.value[primaryBucketAxis.id]
      const primaryAggConfig = buildBucketAggConfig(primaryBucketState)

      if (primaryAggConfig) {
        aggregationStore.setBucketAggregation(primaryAggConfig)

        // Handle secondary bucket axes
        for (let i = 1; i < requiredBucketAxes.length; i++) {
          const bucketAxis = requiredBucketAxes[i]
          const bucketState = this.axisState.value[bucketAxis.id]
          const aggConfig = buildBucketAggConfig(bucketState)

          if (aggConfig) {
            if (usesSplitByForSecondary) {
              // Use splitBy for the secondary bucket (lasagna, heatlane)
              const splitByConfig = {
                field: aggConfig.field,
                type: aggConfig.type || 'terms',
                options: aggConfig.options || { size: 20 }
              }
              console.log(`[UnifiedChartMapper] Setting splitBy for ${this.chartType} secondary bucket:`, splitByConfig)
              aggregationStore.setSplitBy(splitByConfig)
            } else {
              // Add as additional bucket level for multi-dimensional charts (e.g., heatmap Y-axis)
              const currentBuckets = aggregationStore.currentConfig.bucketAggs || []
              const alreadyExists = currentBuckets.some(b => b.field === aggConfig.field)

              if (!alreadyExists) {
                aggregationStore.addBucketLevel(aggConfig)
              }
            }
          }
        }
      }
    }

    // Find metric axes and configure metrics
    const metricAxes = axes.filter(a => a.fieldType === 'metric')
    const metrics = []

    for (const axis of metricAxes) {
      const state = this.axisState.value[axis.id]
      if (state?.metric && state.metric !== 'count') {
        if (state.metricField) {
          metrics.push({
            type: state.metric,
            field: state.metricField,
            alias: ''
          })
        }
      }
    }

    if (metrics.length > 0) {
      aggregationStore.currentConfig.metrics = metrics
    }

    // Handle optional color splits (tertiary bucket for charts that support it)
    const colorAxis = axes.find(a => a.id === 'color' && a.fieldType === 'bucket' && !a.required)
    if (colorAxis) {
      const colorState = this.axisState.value.color
      if (colorState?.field) {
        // Charts that use series/splitBy instead of multi-level buckets
        const seriesBasedCharts = ['area', 'line', 'streamgraph']
        const usesSplitBy = seriesBasedCharts.includes(this.chartType)

        if (usesSplitBy) {
          // Use splitBy for series-based charts (area, line, streamgraph)
          const splitByConfig = {
            field: colorState.field,
            type: colorState.aggregation || 'terms',
            options: colorState.options || { size: 10 }
          }
          console.log(`[UnifiedChartMapper] Setting splitBy for ${this.chartType}:`, splitByConfig)
          aggregationStore.setSplitBy(splitByConfig)
        } else {
          // Add as additional bucket level for multi-dimensional charts (heatmap, etc.)
          const currentBuckets = aggregationStore.currentConfig.bucketAggs || []
          const alreadyExists = currentBuckets.some(b => b.field === colorState.field)

          // Only add color split if:
          // - Not already exists
          // - We have exactly the required buckets (no optional splits added yet)
          // This prevents stacking multiple optional splits
          const expectedRequiredBuckets = requiredBucketAxes.length
          const hasOnlyRequiredBuckets = currentBuckets.length === expectedRequiredBuckets

          if (!alreadyExists && hasOnlyRequiredBuckets) {
            aggregationStore.addBucketLevel({
              field: colorState.field,
              type: colorState.aggregation || 'terms',
              options: colorState.options || { size: 10 }
            })
          }
        }
      }
    }
  }

  /**
   * Map aggregation fields to Vega config using configKeys
   * This is the unified mapping strategy that works for most charts
   * @param {Array<Object>} data - Aggregation result data
   * @param {Array<string>} fields - Available field names
   * @param {Object} aggregationStore - Aggregation store for checking multi-level buckets
   */
  mapFieldsToConfig(data, fields, aggregationStore) {
    const axes = this.axisConfig[this.chartType]
    if (!axes) return

    console.log(`[UnifiedChartMapper] Mapping ${this.chartType} with axes:`, axes.map(a => a.id))

    for (const axis of axes) {
      if (!axis.configKey) continue // Skip axes without configKey

      const configValue = this.vegaStore.config?.[axis.configKey]
      const state = this.axisState.value[axis.id]

      // Skip if no state
      if (!state) continue

      // For metric axes, always re-map since the metric can change (count → avg → sum, etc.)
      // For bucket axes, only map if not already set (preserve user selections)
      // EXCEPT for optional fields - allow re-mapping when user changes selection
      // ALSO EXCEPT for special axes like facet, color - these are user-changeable even if required
      // IMPORTANT: Only skip if the configured field actually exists in current data
      const changeableAxes = ['facet', 'color', 'splitBy', 'series']
      const isChangeableAxis = changeableAxes.includes(axis.id)
      const configuredFieldExists = fields.includes(configValue)
      const shouldSkip = axis.fieldType !== 'metric' && configValue && axis.required && !isChangeableAxis && configuredFieldExists
      if (shouldSkip) {
        console.log(`[UnifiedChartMapper] Skipping ${axis.id} - already mapped to:`, configValue)
        continue
      }

      // If configured field no longer exists in data, log it
      if (configValue && !configuredFieldExists && axis.fieldType !== 'metric') {
        console.log(`[UnifiedChartMapper] Remapping ${axis.id} - configured field '${configValue}' not found in available fields:`, fields)
      }

      let mappedValue = null

      if (axis.fieldType === 'bucket' || axis.fieldType === 'numeric' || axis.fieldType === 'any') {
        // Bucket/category axes use direct field names
        if (state.field) {
          const bucketAggs = aggregationStore?.currentConfig.bucketAggs || []
          const hasMultipleBuckets = bucketAggs.length > 1
          const primaryBucket = bucketAggs[0]
          const splitBy = aggregationStore?.currentConfig.splitBy

          // Check if using multi_terms aggregation (e.g., Comet, Population Pyramid)
          const isMultiTerms = primaryBucket?.type === 'multi_terms'

          // For charts with multiple required bucket axes (like heatmap), map each bucket to its own field
          // For charts with optional color splits, use composite key for the primary axis
          const axes = this.axisConfig[this.chartType]
          const requiredBucketAxes = axes?.filter(a => a.fieldType === 'bucket' && a.required) || []
          const hasMultipleRequiredBuckets = requiredBucketAxes.length > 1

          // Check for splitBy first (e.g., streamgraph color axis, trellis area facet axis, lasagna y axis)
          // Axes that commonly use splitBy: color, facet, y (for lasagna/heatlane)
          const splitByAxes = ['color', 'facet', 'y']
          // Charts where secondary bucket uses splitBy instead of nested buckets
          const splitBySecondaryBucketCharts = ['lasagna', 'heatlane']
          const isSplitBySecondaryChart = splitBySecondaryBucketCharts.includes(this.chartType)

          // For splitBy secondary bucket charts, the Y axis should ALWAYS use splitBy field
          // regardless of whether splitBy.field exactly matches state.field
          const shouldUseSplitBy = splitBy && splitByAxes.includes(axis.id) && (
            splitBy.field === state.field ||
            (isSplitBySecondaryChart && axis.id === 'y')
          )

          if (shouldUseSplitBy) {
            // Special case: Axis using splitBy (e.g., streamgraph color, trellis area facet, lasagna y)
            // The splitBy field is in the data directly, not as a composite key
            mappedValue = this.resolveDataField(splitBy.field, fields)
            console.log(`[UnifiedChartMapper] SplitBy chart - mapping ${axis.id} to splitBy field:`, mappedValue)
          } else if (isMultiTerms && hasMultipleRequiredBuckets) {
            // Special case: multi_terms aggregation with multiple bucket axes
            // The aggregation returns individual field columns, not a composite key
            // Example: Comet chart with category + time fields
            const bucketIndex = requiredBucketAxes.findIndex(a => a.id === axis.id)
            if (bucketIndex !== -1 && primaryBucket.options?.fields?.[bucketIndex]) {
              // Map to the individual field column from multi_terms result
              mappedValue = this.resolveDataField(primaryBucket.options.fields[bucketIndex], fields)
              console.log(`[UnifiedChartMapper] Multi-terms chart - mapping ${axis.id} to field[${bucketIndex}]:`, mappedValue)
            }
          } else if (hasMultipleRequiredBuckets && !isMultiTerms && !isSplitBySecondaryChart) {
            // Charts like heatmap with separate bucket levels (not multi_terms, not splitBy secondary)
            // Map each axis to its individual bucket field
            const bucketIndex = requiredBucketAxes.findIndex(a => a.id === axis.id)
            if (bucketIndex !== -1 && bucketIndex < bucketAggs.length) {
              mappedValue = this.resolveDataField(bucketAggs[bucketIndex].field, fields)
              console.log(`[UnifiedChartMapper] Multi-dimensional chart - mapping ${axis.id} to bucket[${bucketIndex}]:`, mappedValue)
            }
          } else {
            // Charts with single required bucket + optional color split
            const isPrimaryBucket = axis.required && axis.fieldType === 'bucket'

            if (isPrimaryBucket && hasMultipleBuckets && fields.includes('_composite_key')) {
              mappedValue = '_composite_key'
              console.log('[UnifiedChartMapper] Using composite key for multi-level bucket')
            } else {
              mappedValue = this.resolveDataField(state.field, fields)
            }
          }
        }
      } else if (axis.fieldType === 'metric') {
        // Metric axes
        if (state.metric === 'count') {
          // Prefer _split_count when available (split aggregation)
          mappedValue = fields.includes('_split_count') ? '_split_count' : '_count'
        } else if (state.metricField) {
          // For charts using raw sample data (scatter, binned_heatmap),
          // map directly to the field name instead of looking for aggregated metric fields
          const rawDataCharts = ['scatter', 'binned_heatmap']
          const isRawDataChart = rawDataCharts.includes(this.chartType)

          if (isRawDataChart) {
            // Direct field mapping for raw data charts
            mappedValue = this.resolveDataField(state.metricField, fields)
            console.log(`[UnifiedChartMapper] Raw data chart - mapping ${axis.id} directly to:`, mappedValue)
          } else {
            // Aggregated metric field mapping for other charts
            mappedValue = this.mapMetricField(state.metric, state.metricField, fields)
          }
        }
      }

      if (mappedValue) {
        console.log(`[UnifiedChartMapper] Mapping ${axis.id} (${axis.configKey}):`, mappedValue)
        this.vegaStore.updateConfig(axis.configKey, mappedValue)
      }
    }
  }
}
