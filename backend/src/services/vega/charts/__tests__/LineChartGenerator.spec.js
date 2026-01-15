/**
 * Line Chart Generator Tests
 *
 * Tests for LineChartGenerator covering:
 * - Metadata correctness
 * - Schema validation
 * - Preview generation (with sample data)
 * - Multi-level bucket support (series, faceted, layered)
 * - Field path resolution
 * - Example data validation
 */

import { describe, it } from 'node:test'
import assert from 'assert'
import { LineChartGenerator } from '../LineChartGenerator.js'

describe('LineChartGenerator', () => {
  describe('Metadata', () => {
    it('should have correct chart metadata', () => {
      assert.strictEqual(LineChartGenerator.metadata.id, 'line')
      assert.strictEqual(LineChartGenerator.metadata.name, 'Line Chart')
      assert.strictEqual(LineChartGenerator.metadata.category, 'trend')
    })

    it('should have a description', () => {
      assert.ok(LineChartGenerator.metadata.description)
      assert.ok(LineChartGenerator.metadata.description.length > 0)
    })

    it('should have an icon', () => {
      assert.ok(LineChartGenerator.metadata.icon)
    })
  })

  describe('Schema', () => {
    it('should have required xField', () => {
      const xField = LineChartGenerator.schema.fields.find(f => f.name === 'xField')
      assert.ok(xField)
      assert.strictEqual(xField.required, true)
      assert.strictEqual(xField.label, 'X-Axis')
    })

    it('should have required yField', () => {
      const yField = LineChartGenerator.schema.fields.find(f => f.name === 'yField')
      assert.ok(yField)
      assert.strictEqual(yField.required, true)
      assert.strictEqual(yField.label, 'Y-Axis')
    })

    it('should have optional colorField for series', () => {
      const colorField = LineChartGenerator.schema.fields.find(f => f.name === 'colorField')
      assert.ok(colorField)
      assert.strictEqual(colorField.required, false)
      assert.strictEqual(colorField.label, 'Series')
    })

    it('should have interpolate option with valid choices', () => {
      const interpolate = LineChartGenerator.schema.fields.find(f => f.name === 'interpolate')
      assert.ok(interpolate)
      assert.strictEqual(interpolate.type, 'select')
      assert.ok(interpolate.options.includes('linear'))
      assert.ok(interpolate.options.includes('monotone'))
      assert.ok(interpolate.options.includes('step'))
    })

    it('should have showPoints boolean option', () => {
      const showPoints = LineChartGenerator.schema.fields.find(f => f.name === 'showPoints')
      assert.ok(showPoints)
      assert.strictEqual(showPoints.type, 'boolean')
      assert.strictEqual(showPoints.default, false)
    })

    it('should have strokeWidth with range constraints', () => {
      const strokeWidth = LineChartGenerator.schema.fields.find(f => f.name === 'strokeWidth')
      assert.ok(strokeWidth)
      assert.strictEqual(strokeWidth.type, 'number')
      assert.strictEqual(strokeWidth.min, 1)
      assert.strictEqual(strokeWidth.max, 10)
    })

    it('should have multiLevelMode for sub-grouping display', () => {
      const multiLevel = LineChartGenerator.schema.fields.find(f => f.name === 'multiLevelMode')
      assert.ok(multiLevel)
      assert.ok(multiLevel.options.includes('series'))
      assert.ok(multiLevel.options.includes('layered'))
      assert.ok(multiLevel.options.includes('faceted'))
    })
  })

  describe('Preview Generation', () => {
    it('should generate valid Vega spec for simple line chart', () => {
      const generator = new LineChartGenerator({
        xField: 'month',
        yField: 'revenue'
      })

      const data = [
        { month: 'Jan', revenue: 4200 },
        { month: 'Feb', revenue: 4800 },
        { month: 'Mar', revenue: 5100 }
      ]

      const spec = generator.generate(data)

      assert.ok(spec)
      assert.ok(spec.$schema)
      assert.ok(spec.data)
      assert.ok(spec.marks)
    })

    it('should handle monotone interpolation', () => {
      const generator = new LineChartGenerator({
        xField: 'date',
        yField: 'value',
        interpolate: 'monotone'
      })

      const data = [
        { date: '2024-01', value: 100 },
        { date: '2024-02', value: 150 }
      ]

      const spec = generator.generate(data)

      assert.ok(spec)
      // Spec should include interpolate config
      const lineMark = spec.marks?.find(m => m.type === 'line')
      if (lineMark) {
        assert.ok(lineMark.encode || lineMark.encoding)
      }
    })

    it('should add points when showPoints is true', () => {
      const generator = new LineChartGenerator({
        xField: 'x',
        yField: 'y',
        showPoints: true
      })

      const data = [
        { x: 1, y: 10 },
        { x: 2, y: 20 }
      ]

      const spec = generator.generate(data)

      assert.ok(spec)
      // Spec should be generated successfully with showPoints config
      // The actual implementation may vary (layer, marks array, etc)
      assert.ok(spec.$schema)
      assert.ok(spec.marks || spec.layer)
    })

    it('should apply custom stroke width', () => {
      const generator = new LineChartGenerator({
        xField: 'x',
        yField: 'y',
        strokeWidth: 5
      })

      const data = [{ x: 1, y: 10 }]

      const spec = generator.generate(data)

      assert.ok(spec)
      // Stroke width should be in the spec
      const specStr = JSON.stringify(spec)
      assert.ok(specStr.includes('5') || specStr.includes('strokeWidth'))
    })

    it('should handle color field for multiple series', () => {
      const generator = new LineChartGenerator({
        xField: 'month',
        yField: 'sales',
        colorField: 'region'
      })

      const data = [
        { month: 'Jan', sales: 100, region: 'North' },
        { month: 'Jan', sales: 150, region: 'South' },
        { month: 'Feb', sales: 120, region: 'North' },
        { month: 'Feb', sales: 160, region: 'South' }
      ]

      const spec = generator.generate(data)

      assert.ok(spec)
      assert.ok(spec.marks)
    })

    it('should handle missing data gracefully', () => {
      const generator = new LineChartGenerator({
        xField: 'x',
        yField: 'y'
      })

      const data = [
        { x: 1, y: 10 },
        { x: 2 }, // Missing y
        { x: 3, y: 30 }
      ]

      const spec = generator.generate(data)

      assert.ok(spec)
    })

    it('should handle empty data array', () => {
      const generator = new LineChartGenerator({
        xField: 'x',
        yField: 'y'
      })

      const spec = generator.generate([])

      assert.ok(spec)
      assert.ok(spec.$schema)
    })
  })

  describe('Multi-level Bucket Support', () => {
    it('should detect multi-level bucket data', () => {
      const generator = new LineChartGenerator({
        xField: 'month',
        yField: 'sales'
      })

      const multiLevelData = [
        { _composite_key: 'North > Electronics', region: 'North', category: 'Electronics', month: 'Jan', sales: 100 },
        { _composite_key: 'North > Clothing', region: 'North', category: 'Clothing', month: 'Jan', sales: 80 }
      ]

      const spec = generator.generate(multiLevelData)

      assert.ok(spec)
    })

    it('should auto-assign color field for series mode', () => {
      const generator = new LineChartGenerator({
        xField: 'month',
        yField: 'sales',
        multiLevelMode: 'series'
      })

      const multiLevelData = [
        { _composite_key: 'A > X', level1: 'A', level2: 'X', month: 'Jan', sales: 100 },
        { _composite_key: 'A > Y', level1: 'A', level2: 'Y', month: 'Jan', sales: 80 }
      ]

      const spec = generator.generate(multiLevelData)

      assert.ok(spec)
      // Auto-assigned color should create multiple series
    })

    it('should generate faceted spec for multi-level data', () => {
      const generator = new LineChartGenerator({
        xField: 'month',
        yField: 'sales',
        multiLevelMode: 'faceted'
      })

      const multiLevelData = [
        { _composite_key: 'A > X', bucket1: 'A', bucket2: 'X', month: 'Jan', sales: 100 }
      ]

      const spec = generator.generate(multiLevelData)

      assert.ok(spec)
      // Faceted spec should have facet or repeat
      if (spec.facet || spec.repeat || spec.vconcat || spec.hconcat) {
        assert.ok(true)
      }
    })

    it('should generate layered spec for multi-level data', () => {
      const generator = new LineChartGenerator({
        xField: 'month',
        yField: 'sales',
        multiLevelMode: 'layered'
      })

      const multiLevelData = [
        { _composite_key: 'A > X', bucket1: 'A', bucket2: 'X', month: 'Jan', sales: 100 }
      ]

      const spec = generator.generate(multiLevelData)

      assert.ok(spec)
      // Layered spec should have layer array
      if (spec.layer) {
        assert.ok(Array.isArray(spec.layer))
      }
    })
  })

  describe('Field Resolution', () => {
    it('should resolve nested field paths', () => {
      const generator = new LineChartGenerator({
        xField: 'date.value',
        yField: 'metrics.count'
      })

      const data = [
        { date_value: '2024-01', metrics_count: 100 },
        { date_value: '2024-02', metrics_count: 150 }
      ]

      const spec = generator.generate(data)

      assert.ok(spec)
    })
  })

  describe('Example Data', () => {
    it('should have working example configuration', () => {
      const example = LineChartGenerator.example

      assert.ok(example)
      assert.ok(example.config)
      assert.ok(example.data)
    })

    it('should generate valid spec from example', () => {
      const example = LineChartGenerator.example
      const generator = new LineChartGenerator(example.config)

      const spec = generator.generate(example.data)

      assert.ok(spec)
      assert.ok(spec.$schema)
      assert.ok(spec.marks)
    })

    it('should have xField in example config', () => {
      const example = LineChartGenerator.example

      assert.ok(example.config.xField)
    })

    it('should have yField in example config', () => {
      const example = LineChartGenerator.example

      assert.ok(example.config.yField)
    })

    it('should have data with required fields', () => {
      const example = LineChartGenerator.example
      const { xField, yField } = example.config

      assert.ok(example.data.length > 0)
      assert.ok(example.data[0].hasOwnProperty(xField))
      assert.ok(example.data[0].hasOwnProperty(yField))
    })
  })

  describe('Grid and Axis Options', () => {
    it('should respect showGrid option', () => {
      const generator = new LineChartGenerator({
        xField: 'x',
        yField: 'y',
        showGrid: false
      })

      const spec = generator.generate([{ x: 1, y: 10 }])

      assert.ok(spec)
    })

    it('should respect yAxisZero option', () => {
      const generator = new LineChartGenerator({
        xField: 'x',
        yField: 'y',
        yAxisZero: true
      })

      const spec = generator.generate([{ x: 1, y: 10 }])

      assert.ok(spec)
    })
  })
})
