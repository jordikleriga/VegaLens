import {
  Hash,
  Type,
  Calendar,
  MapPin,
  ToggleLeft,
  Box
} from 'lucide-vue-next'

/**
 * Field Selection Composable
 *
 * Provides utilities for working with Elasticsearch fields in the visualization builder:
 * - Field type detection and visual styling (icons, colors)
 * - Field filtering based on axis requirements
 * - Field categorization (bucket, metric, numeric)
 *
 * @returns {Object} Field selection utilities
 */
export function useFieldSelection() {

  /**
   * Get icon component for a field based on its type
   * @param {Object} field - Field object with category property
   * @returns {Component} Lucide icon component
   */
  function getFieldIcon(field) {
    const icons = {
      number: Hash,
      string: Type,
      date: Calendar,
      geo: MapPin,
      boolean: ToggleLeft,
      other: Box
    }
    return icons[field.category] || Box
  }

  /**
   * Get Tailwind color class for a field based on its type
   * @param {Object} field - Field object with category property
   * @returns {string} Tailwind CSS color class
   */
  function getFieldTypeColor(field) {
    const colors = {
      number: 'text-blue-400',
      string: 'text-emerald-400',
      date: 'text-amber-400',
      geo: 'text-purple-400',
      boolean: 'text-pink-400',
      other: 'text-slate-400'
    }
    return colors[field.category] || 'text-slate-400'
  }

  /**
   * Filter fields based on axis configuration and search term
   * @param {Object} axisConfig - Axis configuration object
   * @param {Object} elasticStore - Elastic store instance with field lists
   * @param {string} searchTerm - Optional search filter
   * @returns {Array} Filtered field list
   */
  function getFieldsForAxis(axisConfig, elasticStore, searchTerm = '') {
    const search = searchTerm.toLowerCase()

    let fields = []

    if (axisConfig.fieldType === 'bucket') {
      fields = elasticStore.aggregatableFields
    } else if (axisConfig.fieldType === 'metric' || axisConfig.fieldType === 'numeric') {
      fields = elasticStore.aggregatableNumericFields
    } else {
      fields = elasticStore.fields
    }

    if (search) {
      fields = fields.filter(f => f.name.toLowerCase().includes(search))
    }

    return fields
  }

  /**
   * Determine aggregation type based on field type and chart type
   * @param {Object} field - Selected field
   * @param {string} chartType - Current chart type
   * @param {string} axisFieldType - Axis field type (bucket, metric, etc.)
   * @returns {string} Aggregation type (terms, date_histogram, histogram)
   */
  function determineAggregationType(field, chartType, axisFieldType) {
    if (axisFieldType !== 'bucket') {
      return null // Only bucket axes need aggregation types
    }

    // For histogram chart type, use histogram aggregation for numeric fields
    if (chartType === 'histogram') {
      return 'histogram'
    }

    // Dates typically need date_histogram
    if (field.category === 'date') {
      return 'date_histogram'
    }

    // Heatmaps can use histogram for numeric axes
    if (field.category === 'number' && chartType === 'heatmap') {
      return 'histogram'
    }

    // For all other cases (bar, pie, waterfall, sankey, etc.), use terms
    return 'terms'
  }

  return {
    getFieldIcon,
    getFieldTypeColor,
    getFieldsForAxis,
    determineAggregationType
  }
}
