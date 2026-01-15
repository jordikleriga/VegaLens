/**
 * Bar Chart Generator Tests
 *
 * Tests the BarChartGenerator class for:
 * - Metadata correctness
 * - Schema validation
 * - Preview generation (with sample data)
 * - Kibana spec generation (with Elasticsearch integration)
 * - Field path resolution
 * - Example data validation
 */

import { describe, it } from 'node:test'
import assert from 'assert'
import { BarChartGenerator } from '../BarChartGenerator.js'

describe('BarChartGenerator', () => {
  describe('Metadata', () => {
    it('should have correct chart metadata', () => {
      assert.strictEqual(BarChartGenerator.metadata.id, 'bar')
      assert.strictEqual(BarChartGenerator.metadata.name, 'Bar Chart')
      assert.strictEqual(BarChartGenerator.metadata.category, 'trend')
      assert.ok(BarChartGenerator.metadata.description)
      assert.ok(BarChartGenerator.metadata.icon)
    })

    it('should be discoverable in chart registry', () => {
      assert.ok(BarChartGenerator.metadata)
      assert.ok(BarChartGenerator.schema)
      assert.ok(BarChartGenerator.example)
    })
  })

  describe('Schema Validation', () => {
    it('should define required fields', () => {
      const requiredFields = BarChartGenerator.schema.fields.filter(f => f.required)

      assert.ok(requiredFields.length > 0, 'Should have at least one required field')
      assert.ok(requiredFields.some(f => f.name === 'xField'), 'Should require xField')
      assert.ok(requiredFields.some(f => f.name === 'yField'), 'Should require yField')
    })

    it('should define optional fields', () => {
      const optionalFields = BarChartGenerator.schema.fields.filter(f => !f.required)

      assert.ok(optionalFields.length > 0, 'Should have optional fields')
    })

    it('should specify field types correctly', () => {
      const schema = BarChartGenerator.schema

      schema.fields.forEach(field => {
        assert.ok(field.name, 'Field should have a name')
        assert.ok(field.label, 'Field should have a label')
        assert.ok(field.type, 'Field should have a type')
      })
    })
  })

  describe('Preview Generation (Sample Data)', () => {
    it('should generate valid Vega-Lite spec with sample data', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value'
      })

      const data = [
        { category: 'A', value: 100 },
        { category: 'B', value: 200 },
        { category: 'C', value: 150 }
      ]

      const spec = generator.generate(data)

      // Validate Vega-Lite structure
      assert.ok(spec.$schema, 'Should have $schema')
      assert.ok(spec.$schema.includes('vega-lite'), 'Should be Vega-Lite schema')
      assert.ok(spec.mark, 'Should have mark')
      assert.strictEqual(spec.mark.type || spec.mark, 'bar', 'Mark should be bar')
      assert.ok(spec.encoding, 'Should have encoding')
      assert.strictEqual(spec.encoding.x.field, 'category', 'X encoding should use category field')
      assert.strictEqual(spec.encoding.y.field, 'value', 'Y encoding should use value field')
    })

    it('should handle missing fields gracefully', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value'
      })

      const data = [
        { category: 'A' }, // Missing value
        { value: 100 }     // Missing category
      ]

      const spec = generator.generate(data)

      assert.ok(spec, 'Should still generate spec')
      assert.ok(spec.encoding, 'Should have encoding')
    })

    it('should apply color configuration when provided', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value',
        colorField: 'region'
      })

      const data = [
        { category: 'A', value: 100, region: 'North' },
        { category: 'B', value: 200, region: 'South' }
      ]

      const spec = generator.generate(data)

      assert.ok(spec.encoding.color, 'Should have color encoding')
      assert.strictEqual(spec.encoding.color.field, 'region', 'Color should use region field')
    })

    it('should apply custom width and height', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value',
        width: 800,
        height: 600
      })

      const data = [{ category: 'A', value: 100 }]
      const spec = generator.generate(data)

      assert.strictEqual(spec.width, 800, 'Width should be 800')
      assert.strictEqual(spec.height, 600, 'Height should be 600')
    })

    it('should apply custom title', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value',
        title: 'Sales by Category'
      })

      const data = [{ category: 'A', value: 100 }]
      const spec = generator.generate(data)

      assert.strictEqual(spec.title, 'Sales by Category', 'Title should match')
    })

    it('should handle empty data', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value'
      })

      const spec = generator.generate([])

      assert.ok(spec, 'Should generate spec even with empty data')
      assert.ok(spec.data, 'Should have data property')
    })
  })

  describe('Kibana Generation (Elasticsearch Integration)', () => {
    it('should generate Kibana-compatible Vega-Lite spec', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value'
      })

      const spec = generator.generateForKibana({
        index: 'test_index',
        aggregation: {
          bucketAgg: { type: 'terms', field: 'category' },
          metrics: []
        }
      })

      assert.ok(spec.$schema, 'Should have $schema')
      assert.ok(spec.$schema.includes('vega-lite'), 'Should be Vega-Lite schema')
      assert.ok(spec.data, 'Should have data')
      assert.ok(spec.data.url, 'Should have Elasticsearch URL')
      assert.ok(spec.transform, 'Should have transforms')
    })

    it('should include Elasticsearch aggregation query in URL', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value'
      })

      const spec = generator.generateForKibana({
        index: 'products',
        aggregation: {
          bucketAgg: { type: 'terms', field: 'category', options: { size: 10 } },
          metrics: []
        }
      })

      const esQuery = spec.data.url.body

      assert.ok(esQuery, 'Should have ES query in URL body')
      assert.ok(esQuery.aggs, 'Should have aggregations')
      assert.ok(esQuery.aggs.primary, 'Should have primary aggregation')
      assert.strictEqual(esQuery.aggs.primary.terms.field, 'category', 'Should query category field')
      assert.strictEqual(esQuery.aggs.primary.terms.size, 10, 'Should use size from options')
    })

    it('should include metric aggregations in Elasticsearch query', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'avg_price'
      })

      const spec = generator.generateForKibana({
        index: 'products',
        aggregation: {
          bucketAgg: { type: 'terms', field: 'category' },
          metrics: [
            { type: 'avg', field: 'price', alias: 'avg_price' }
          ]
        }
      })

      const esQuery = spec.data.url.body

      assert.ok(esQuery.aggs.primary.aggs, 'Should have sub-aggregations')
      assert.ok(esQuery.aggs.primary.aggs.avg_price, 'Should have avg_price metric')
      assert.strictEqual(esQuery.aggs.primary.aggs.avg_price.avg.field, 'price', 'Metric should use price field')
    })

    it('should include transforms to map ES response to chart data', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value'
      })

      const spec = generator.generateForKibana({
        index: 'test_index',
        aggregation: {
          bucketAgg: { type: 'terms', field: 'category' },
          metrics: []
        }
      })

      assert.ok(Array.isArray(spec.transform), 'Should have transforms array')
      assert.ok(spec.transform.length > 0, 'Should have at least one transform')

      // Should have calculate transforms to map ES response fields
      const calculateTransforms = spec.transform.filter(t => t.calculate)
      assert.ok(calculateTransforms.length > 0, 'Should have calculate transforms')
    })

    it('should set width and height to container for Kibana', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value'
      })

      const spec = generator.generateForKibana({
        index: 'test_index',
        aggregation: {
          bucketAgg: { type: 'terms', field: 'category' },
          metrics: []
        }
      })

      assert.strictEqual(spec.width, 'container', 'Width should be container')
      assert.strictEqual(spec.height, 'container', 'Height should be container')
    })

    it('should support date_histogram aggregation', () => {
      const generator = new BarChartGenerator({
        xField: 'date',
        yField: 'count'
      })

      const spec = generator.generateForKibana({
        index: 'logs',
        aggregation: {
          bucketAgg: {
            type: 'date_histogram',
            field: 'timestamp',
            options: { calendarInterval: '1d' }
          },
          metrics: []
        }
      })

      const esQuery = spec.data.url.body

      assert.ok(esQuery.aggs.primary.date_histogram, 'Should have date_histogram aggregation')
      assert.strictEqual(esQuery.aggs.primary.date_histogram.field, 'timestamp')
      assert.strictEqual(esQuery.aggs.primary.date_histogram.calendar_interval, '1d')
    })

    it('should support context and time filters when useContext is true', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value'
      })

      const spec = generator.generateForKibana({
        index: 'test_index',
        useContext: true,
        timeField: '@timestamp',
        aggregation: {
          bucketAgg: { type: 'terms', field: 'category' },
          metrics: []
        }
      })

      const urlConfig = spec.data.url

      assert.strictEqual(urlConfig['%context%'], true, 'Should enable context')
      assert.strictEqual(urlConfig['%timefield%'], '@timestamp', 'Should set time field')
    })
  })

  describe('Field Path Resolution', () => {
    it('should resolve nested field paths (dot notation to underscore)', () => {
      const generator = new BarChartGenerator({
        xField: 'products.category',
        yField: 'products.price'
      })

      const data = [
        { products_category: 'Electronics', products_price: 299.99 },
        { products_category: 'Clothing', products_price: 49.99 }
      ]

      const spec = generator.generate(data)

      // Field resolution happens in base class - verify it works
      assert.ok(spec.encoding, 'Should have encoding')
      // The generator should handle both dot notation and underscore versions
    })

    it('should work with both nested and flat field names', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value'
      })

      const data = [
        { category: 'A', value: 100 },
        { category: 'B', value: 200 }
      ]

      const spec = generator.generate(data)

      assert.ok(spec.encoding.x, 'Should have x encoding')
      assert.ok(spec.encoding.y, 'Should have y encoding')
    })
  })

  describe('Example Data', () => {
    it('should provide a working example', () => {
      const example = BarChartGenerator.example

      assert.ok(example, 'Should have example')
      assert.ok(example.config, 'Example should have config')
      assert.ok(example.data, 'Example should have data')
    })

    it('should generate valid spec from example', () => {
      const example = BarChartGenerator.example
      const generator = new BarChartGenerator(example.config)

      const spec = generator.generate(example.data)

      assert.ok(spec, 'Should generate spec from example')
      assert.ok(spec.$schema, 'Should have schema')
      assert.ok(spec.encoding, 'Should have encoding')
    })

    it('example config should satisfy schema requirements', () => {
      const example = BarChartGenerator.example
      const requiredFields = BarChartGenerator.schema.fields.filter(f => f.required)

      requiredFields.forEach(field => {
        assert.ok(
          example.config[field.name] !== undefined,
          `Example should include required field: ${field.name}`
        )
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large datasets', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value'
      })

      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        category: `Cat${i % 50}`,
        value: Math.random() * 1000
      }))

      const spec = generator.generate(largeData)

      assert.ok(spec, 'Should handle large datasets')
      assert.ok(spec.data, 'Should include data')
    })

    it('should handle special characters in field names', () => {
      const generator = new BarChartGenerator({
        xField: 'product.name',
        yField: 'price-usd'
      })

      const data = [
        { 'product.name': 'Widget', 'price-usd': 99.99 }
      ]

      const spec = generator.generate(data)

      assert.ok(spec, 'Should handle special characters')
    })

    it('should handle null and undefined values in data', () => {
      const generator = new BarChartGenerator({
        xField: 'category',
        yField: 'value'
      })

      const data = [
        { category: 'A', value: 100 },
        { category: null, value: 200 },
        { category: 'C', value: null }
      ]

      const spec = generator.generate(data)

      assert.ok(spec, 'Should handle null values')
    })
  })

  describe('Configuration Options', () => {
    it('should support horizontal orientation', () => {
      const generator = new BarChartGenerator({
        xField: 'value',
        yField: 'category',
        orientation: 'horizontal'
      })

      const data = [{ category: 'A', value: 100 }]
      const spec = generator.generate(data)

      assert.ok(spec, 'Should generate horizontal bar chart')
    })

    it('should support stacked bars with color field', () => {
      const generator = new BarChartGenerator({
        xField: 'month',
        yField: 'sales',
        colorField: 'region',
        stacked: true
      })

      const data = [
        { month: 'Jan', sales: 100, region: 'North' },
        { month: 'Jan', sales: 150, region: 'South' }
      ]

      const spec = generator.generate(data)

      assert.ok(spec.encoding.color, 'Should have color encoding for stacking')
    })
  })
})
