import { BaseChartMapper } from './BaseChartMapper.js'

/**
 * Flow Chart Mapper
 *
 * Handles flow/network diagrams that use source → target relationships:
 * - Sankey diagrams (supports up to 4 stages)
 * - Chord diagrams
 *
 * These use multi_terms aggregation to get source-target pairs.
 */
export class FlowChartMapper extends BaseChartMapper {
  /**
   * Build aggregation using multi_terms for source→target pairs
   * For sankey, supports up to 4 stages (source, target, stage3, stage4)
   */
  async buildAggregationConfig(aggregationStore, elasticStore, buildBucketAggConfig) {
    const sourceState = this.axisState.value.source
    const targetState = this.axisState.value.target
    const sourceField = sourceState?.field
    const targetField = targetState?.field

    if (!sourceField || !targetField) return

    // Build list of all stage fields (for multi-stage sankey)
    const stageFields = [sourceField, targetField]

    // Add optional stage3 and stage4 if configured (sankey only)
    if (this.chartType === 'sankey') {
      const stage3State = this.axisState.value.stage3
      const stage4State = this.axisState.value.stage4

      if (stage3State?.field) {
        stageFields.push(stage3State.field)
      }
      if (stage4State?.field) {
        stageFields.push(stage4State.field)
      }
    }

    // Uses source's size for the number of combinations
    const size = sourceState?.options?.size || 25

    aggregationStore.setBucketAggregation({
      type: 'multi_terms',
      field: sourceField, // Primary field (for compatibility)
      options: {
        fields: stageFields,
        size: size
      }
    })

    // Handle value metric
    const metricState = this.axisState.value.value
    if (metricState?.metric && metricState.metric !== 'count') {
      if (metricState.metricField) {
        aggregationStore.currentConfig.metrics = [{
          type: metricState.metric,
          field: metricState.metricField,
          alias: ''
        }]
      }
    }
  }

  /**
   * Map fields for flow charts
   */
  mapFieldsToConfig(data, fields) {
    console.log(`[FlowChartMapper] Mapping ${this.chartType}`)

    // Source field (Stage 1)
    const sourceState = this.axisState.value.source
    if (sourceState?.field) {
      const sourceField = this.resolveDataField(sourceState.field, fields)
      if (sourceField) {
        this.vegaStore.updateConfig('sourceField', sourceField)
      }
    }

    // Target field (Stage 2)
    const targetState = this.axisState.value.target
    if (targetState?.field) {
      const targetField = this.resolveDataField(targetState.field, fields)
      if (targetField) {
        this.vegaStore.updateConfig('targetField', targetField)
      }
    }

    // Stage 3 field (optional, sankey only)
    if (this.chartType === 'sankey') {
      const stage3State = this.axisState.value.stage3
      if (stage3State?.field) {
        const stage3Field = this.resolveDataField(stage3State.field, fields)
        if (stage3Field) {
          this.vegaStore.updateConfig('stage3Field', stage3Field)
        }
      } else {
        // Clear stage3 if not set
        this.vegaStore.updateConfig('stage3Field', null)
      }

      // Stage 4 field (optional)
      const stage4State = this.axisState.value.stage4
      if (stage4State?.field) {
        const stage4Field = this.resolveDataField(stage4State.field, fields)
        if (stage4Field) {
          this.vegaStore.updateConfig('stage4Field', stage4Field)
        }
      } else {
        // Clear stage4 if not set
        this.vegaStore.updateConfig('stage4Field', null)
      }
    }

    // Value field
    const valueState = this.axisState.value.value
    if (valueState?.metric === 'count') {
      this.vegaStore.updateConfig('valueField', '_count')
    } else if (valueState?.metricField) {
      const valueField = this.mapMetricField(valueState.metric, valueState.metricField, fields)
      if (valueField) {
        this.vegaStore.updateConfig('valueField', valueField)
      }
    }
  }
}
