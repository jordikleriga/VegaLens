import { ref, computed } from 'vue'

/**
 * Multi-Level Buckets Composable
 *
 * Manages Kibana-style multi-level (nested) bucket aggregations.
 * Allows users to add sub-groupings to create hierarchical aggregations
 * (e.g., group by Country > City > Product).
 *
 * @param {Object} aggregationStore - Aggregation store instance
 * @param {Object} elasticStore - Elastic store instance
 * @param {Object} vegaStore - Vega store instance
 * @param {Function} onUpdate - Callback to trigger after changes
 * @returns {Object} Multi-level bucket management utilities
 */
export function useMultiLevelBuckets(aggregationStore, elasticStore, vegaStore, onUpdate) {
  // State for showing the "add sub-grouping" field picker
  const showSubGroupPicker = ref(false)
  const subGroupSearch = ref('')

  /**
   * Chart types that support multi-level (nested) bucket aggregations
   */
  const supportsMultiLevelBuckets = computed(() => {
    const supported = [
      // P1: High impact charts
      'bar', 'line', 'area', 'pie', 'donut', 'treemap', 'sunburst', 'scatter', 'bubble',
      // P2: Medium-high impact
      'heatmap', 'boxplot', 'histogram', 'funnel', 'sankey',
      // P3: Medium impact
      'radial', 'pareto', 'radar', 'violin', 'waterfall',
      // P4: Specialized charts
      'chord', 'streamgraph', 'circle_packing', 'gauge', 'dual_axis',
      'density', 'error_bars', 'bullet', 'metric', 'sparkline', 'table',
      'binned_heatmap', 'horizon', 'lasagna', 'heatlane', 'marimekko',
      'population_pyramid', 'ternary', 'trellis_area', 'rolling_average',
      'wordcloud', 'comet'
    ]
    return supported.includes(vegaStore.selectedType)
  })

  /**
   * Get additional bucket levels (beyond the primary one)
   */
  const additionalBucketLevels = computed(() => {
    return aggregationStore.currentConfig.bucketAggs?.slice(1) || []
  })

  /**
   * Filtered fields available for sub-grouping
   * Excludes fields already used in bucket aggregations
   */
  const subGroupFields = computed(() => {
    const search = subGroupSearch.value.toLowerCase()
    const fields = elasticStore.aggregatableFields || []

    // Exclude fields already used in bucket aggregations
    const usedFields = (aggregationStore.currentConfig.bucketAggs || []).map(b => b.field)
    const available = fields.filter(f => !usedFields.includes(f.name))

    if (search) {
      return available.filter(f => f.name.toLowerCase().includes(search))
    }
    return available
  })

  /**
   * Check if the given axis is the primary bucket axis for this chart type.
   * The primary bucket axis is where sub-groupings should be shown.
   *
   * @param {Object} axis - Axis configuration object
   * @param {Array} chartAxes - All axes for current chart type
   * @returns {boolean} True if this is the primary bucket axis
   */
  function isPrimaryBucketAxis(axis, chartAxes) {
    // Find the first bucket axis in the chart configuration
    const firstBucketAxis = chartAxes.find(a => a.fieldType === 'bucket' && a.required)
    // This axis is primary if it matches the first required bucket axis
    return firstBucketAxis && axis.id === firstBucketAxis.id
  }

  /**
   * Add a new bucket level (sub-grouping)
   *
   * @param {Object} field - Field to add as sub-grouping
   */
  function addBucketLevel(field) {
    aggregationStore.addBucketLevel({
      field: field.name,
      type: field.category === 'date' ? 'date_histogram' : 'terms',
      options: { size: 10 }
    })
    showSubGroupPicker.value = false
    subGroupSearch.value = ''
    if (onUpdate) onUpdate()
  }

  /**
   * Remove a bucket level
   *
   * @param {number} index - Index in the additional bucket levels array
   */
  function removeBucketLevel(index) {
    aggregationStore.removeBucketLevel(index + 1) // +1 because index 0 is primary
    if (onUpdate) onUpdate()
  }

  /**
   * Move a bucket level up (earlier in the aggregation order)
   *
   * @param {number} index - Index in the additional bucket levels array
   */
  function moveBucketLevelUp(index) {
    if (index === 0) return // Already at top
    aggregationStore.reorderBucketLevels(index + 1, index) // +1 because index 0 is primary
    if (onUpdate) onUpdate()
  }

  /**
   * Move a bucket level down (later in the aggregation order)
   *
   * @param {number} index - Index in the additional bucket levels array
   */
  function moveBucketLevelDown(index) {
    if (index >= additionalBucketLevels.value.length - 1) return // Already at bottom
    aggregationStore.reorderBucketLevels(index + 1, index + 2) // +1 because index 0 is primary
    if (onUpdate) onUpdate()
  }

  return {
    // State
    showSubGroupPicker,
    subGroupSearch,
    // Computed
    supportsMultiLevelBuckets,
    additionalBucketLevels,
    subGroupFields,
    // Methods
    isPrimaryBucketAxis,
    addBucketLevel,
    removeBucketLevel,
    moveBucketLevelUp,
    moveBucketLevelDown
  }
}
