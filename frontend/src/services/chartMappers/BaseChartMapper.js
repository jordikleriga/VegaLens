/**
 * Base Chart Mapper
 *
 * Base class for all chart type mappers. Provides common utilities for:
 * - Field name resolution and sanitization
 * - Aggregation configuration building
 * - Field mapping to Vega config
 *
 * Subclasses should implement:
 * - buildAggregationConfig() - Build Elasticsearch aggregation for this chart type
 * - mapFieldsToConfig() - Map aggregation results to Vega config
 */
export class BaseChartMapper {
  /**
   * @param {Object} axisState - Ref to axis state
   * @param {Object} vegaStore - Vega store instance
   * @param {string} chartType - Chart type identifier
   */
  constructor(axisState, vegaStore, chartType) {
    this.axisState = axisState
    this.vegaStore = vegaStore
    this.chartType = chartType
  }

  /**
   * Resolve field name from aggregation results
   * Handles Elasticsearch field name transformations (dots to underscores)
   *
   * @param {string} fieldName - Original field name
   * @param {Array<string>} availableFields - Fields in aggregation result
   * @returns {string|null} Resolved field name or null
   */
  resolveDataField(fieldName, availableFields) {
    if (!fieldName) return null

    // Direct match
    if (availableFields.includes(fieldName)) {
      return fieldName
    }

    // Try sanitized version (dots → underscores)
    const sanitized = fieldName.replace(/\./g, '_')
    if (availableFields.includes(sanitized)) {
      return sanitized
    }

    // Try with numeric prefix (for flattened data: 0products.base_price)
    const withPrefix = availableFields.find(f => f.endsWith(fieldName))
    if (withPrefix) {
      return withPrefix
    }

    // Try finding partial match
    const partial = availableFields.find(f =>
      f.includes(sanitized) || sanitized.includes(f)
    )
    if (partial) {
      return partial
    }

    console.warn(`[BaseChartMapper] Could not resolve field: ${fieldName}`)
    return null
  }

  /**
   * Convert field name to safe format (dots to underscores)
   * @param {string} field - Field name
   * @returns {string} Sanitized field name
   */
  toSafeFieldName(field) {
    return field ? field.replace(/\./g, '_') : ''
  }

  /**
   * Check if a value is numeric
   * @param {*} value - Value to check
   * @returns {boolean} True if numeric
   */
  isNumericValue(value) {
    if (Array.isArray(value)) {
      return value.length > 0 && value.every(v => typeof v === 'number' && !isNaN(v))
    }
    return typeof value === 'number' && !isNaN(value)
  }

  /**
   * Map metric field to aggregated field name
   * Handles patterns like: avg_products_base_price, sum_total_amount
   *
   * @param {string} metricType - Metric type (avg, sum, max, min, median)
   * @param {string} fieldName - Original field name
   * @param {Array<string>} availableFields - Fields in aggregation result
   * @returns {string|null} Mapped field name
   */
  mapMetricField(metricType, fieldName, availableFields) {
    if (!fieldName) return null

    // Build expected aggregated field name
    const safeField = this.toSafeFieldName(fieldName)
    const expectedName = `${metricType}_${safeField}`

    // Try direct match
    if (availableFields.includes(expectedName)) {
      return expectedName
    }

    // Try finding partial match
    const partial = availableFields.find(f => f.includes(safeField))
    return partial || null
  }

  /**
   * Build aggregation configuration for this chart type
   * Must be implemented by subclasses
   *
   * @param {Object} aggregationStore - Aggregation store instance
   * @param {Object} elasticStore - Elastic store instance
   * @param {Function} buildBucketAggConfig - Bucket config builder function
   * @returns {Promise<void>}
   */
  async buildAggregationConfig(aggregationStore, elasticStore, buildBucketAggConfig) {
    throw new Error('buildAggregationConfig() must be implemented by subclass')
  }

  /**
   * Map aggregation result fields to Vega configuration
   * Must be implemented by subclasses
   *
   * @param {Array<Object>} data - Aggregation result data
   * @param {Array<string>} fields - Available field names
   * @returns {void}
   */
  mapFieldsToConfig(data, fields) {
    throw new Error('mapFieldsToConfig() must be implemented by subclass')
  }
}
