import { strict as assert } from 'assert';
import { describe, it } from 'node:test';
import { AreaChartGenerator } from '../AreaChartGenerator.js';

describe('AreaChartGenerator', () => {
  describe('Metadata', () => {
    it('should have valid metadata', () => {
      assert.ok(AreaChartGenerator.metadata);
      assert.ok(AreaChartGenerator.metadata.id);
      assert.ok(AreaChartGenerator.metadata.name);
      assert.ok(AreaChartGenerator.metadata.category);
    });

    it('should have correct ID format', () => {
      assert.match(AreaChartGenerator.metadata.id, /^[a-z_]+$/);
    });
  });

  describe('Schema Validation', () => {
    it('should have a valid schema', () => {
      assert.ok(AreaChartGenerator.schema);
      assert.ok(Array.isArray(AreaChartGenerator.schema.fields));
    });

    it('should have fields defined in schema', () => {
      assert.ok(AreaChartGenerator.schema.fields.length > 0, 'Should have at least one field');
    });

    it('should have valid field types', () => {
      AreaChartGenerator.schema.fields.forEach(field => {
        assert.ok(field.name, 'Field should have a name');
        assert.ok(field.label, 'Field should have a label');
        assert.ok(field.type, 'Field should have a type');
      });
    });
  });

  describe('Preview Generation', () => {
    it('should generate valid Vega-Lite spec', () => {
      const config = {};
      AreaChartGenerator.schema.fields
        .filter(f => f.required)
        .forEach(f => {
          if (f.type === 'field') {
            config[f.name] = f.name;
          }
        });

      const generator = new AreaChartGenerator(config);
      const data = AreaChartGenerator.example?.data || [];

      const spec = generator.generate(data);

      assert.ok(spec, 'Should generate a spec');
      assert.ok(spec.$schema, 'Should have $schema');
      assert.ok(spec.$schema.includes('vega'), 'Should be a Vega or Vega-Lite spec');
    });

    it('should handle empty data gracefully', () => {
      const config = {};
      AreaChartGenerator.schema.fields
        .filter(f => f.required)
        .forEach(f => {
          if (f.type === 'field') {
            config[f.name] = 'field';
          }
        });

      const generator = new AreaChartGenerator(config);
      const spec = generator.generate([]);

      assert.ok(spec, 'Should generate spec even with empty data');
    });
  });

  describe('Example Data', () => {
    it('should provide a working example', () => {
      const example = AreaChartGenerator.example;
      if (!example) {
        console.log('  ⚠ No example provided for AreaChartGenerator');
        return;
      }

      assert.ok(example.config, 'Example should have config');
      assert.ok(example.data, 'Example should have data');

      const generator = new AreaChartGenerator(example.config);
      const spec = generator.generate(example.data);

      assert.ok(spec, 'Example should generate valid spec');
    });
  });

  describe('Config Validation', () => {
    it('should accept valid config', () => {
      const config = { ...AreaChartGenerator.example?.config };
      assert.doesNotThrow(() => {
        new AreaChartGenerator(config);
      });
    });

    it('should handle missing optional fields', () => {
      const requiredFields = AreaChartGenerator.schema.fields.filter(f => f.required);
      const config = {};
      requiredFields.forEach(f => {
        if (f.type === 'field') {
          config[f.name] = 'test_field';
        }
      });

      assert.doesNotThrow(() => {
        new AreaChartGenerator(config);
      });
    });
  });

  describe('Field Resolution', () => {
    it('should resolve data fields correctly', () => {
      const config = {};
      AreaChartGenerator.schema.fields
        .filter(f => f.required && f.type === 'field')
        .forEach(f => {
          config[f.name] = 'test_field';
        });

      const generator = new AreaChartGenerator(config);
      const data = [{ test_field: 'value', other_field: 123 }];

      const spec = generator.generate(data);
      assert.ok(spec, 'Should handle field resolution');
    });
  });
});
