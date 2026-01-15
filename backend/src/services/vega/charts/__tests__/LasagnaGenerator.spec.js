import { strict as assert } from 'assert';
import { describe, it } from 'node:test';
import { LasagnaGenerator } from '../LasagnaGenerator.js';

describe('LasagnaGenerator', () => {
  describe('Metadata', () => {
    it('should have valid metadata', () => {
      assert.ok(LasagnaGenerator.metadata);
      assert.ok(LasagnaGenerator.metadata.id);
      assert.ok(LasagnaGenerator.metadata.name);
      assert.ok(LasagnaGenerator.metadata.category);
    });

    it('should have correct ID format', () => {
      assert.match(LasagnaGenerator.metadata.id, /^[a-z_]+$/);
    });
  });

  describe('Schema Validation', () => {
    it('should have a valid schema', () => {
      assert.ok(LasagnaGenerator.schema);
      assert.ok(Array.isArray(LasagnaGenerator.schema.fields));
    });

    it('should have fields defined in schema', () => {
      assert.ok(LasagnaGenerator.schema.fields.length > 0, 'Should have at least one field');
    });

    it('should have valid field types', () => {
      LasagnaGenerator.schema.fields.forEach(field => {
        assert.ok(field.name, 'Field should have a name');
        assert.ok(field.label, 'Field should have a label');
        assert.ok(field.type, 'Field should have a type');
      });
    });
  });

  describe('Preview Generation', () => {
    it('should generate valid Vega-Lite spec', () => {
      const config = {};
      LasagnaGenerator.schema.fields
        .filter(f => f.required)
        .forEach(f => {
          if (f.type === 'field') {
            config[f.name] = f.name;
          }
        });

      const generator = new LasagnaGenerator(config);
      const data = LasagnaGenerator.example?.data || [];

      const spec = generator.generate(data);

      assert.ok(spec, 'Should generate a spec');
      assert.ok(spec.$schema, 'Should have $schema');
      assert.ok(spec.$schema.includes('vega'), 'Should be a Vega or Vega-Lite spec');
    });

    it('should handle empty data gracefully', () => {
      const config = {};
      LasagnaGenerator.schema.fields
        .filter(f => f.required)
        .forEach(f => {
          if (f.type === 'field') {
            config[f.name] = 'field';
          }
        });

      const generator = new LasagnaGenerator(config);
      const spec = generator.generate([]);

      assert.ok(spec, 'Should generate spec even with empty data');
    });
  });

  describe('Example Data', () => {
    it('should provide a working example', () => {
      const example = LasagnaGenerator.example;
      if (!example) {
        console.log('  ⚠ No example provided for LasagnaGenerator');
        return;
      }

      assert.ok(example.config, 'Example should have config');
      assert.ok(example.data, 'Example should have data');

      const generator = new LasagnaGenerator(example.config);
      const spec = generator.generate(example.data);

      assert.ok(spec, 'Example should generate valid spec');
    });
  });

  describe('Config Validation', () => {
    it('should accept valid config', () => {
      const config = { ...LasagnaGenerator.example?.config };
      assert.doesNotThrow(() => {
        new LasagnaGenerator(config);
      });
    });

    it('should handle missing optional fields', () => {
      const requiredFields = LasagnaGenerator.schema.fields.filter(f => f.required);
      const config = {};
      requiredFields.forEach(f => {
        if (f.type === 'field') {
          config[f.name] = 'test_field';
        }
      });

      assert.doesNotThrow(() => {
        new LasagnaGenerator(config);
      });
    });
  });

  describe('Field Resolution', () => {
    it('should resolve data fields correctly', () => {
      const config = {};
      LasagnaGenerator.schema.fields
        .filter(f => f.required && f.type === 'field')
        .forEach(f => {
          config[f.name] = 'test_field';
        });

      const generator = new LasagnaGenerator(config);
      const data = [{ test_field: 'value', other_field: 123 }];

      const spec = generator.generate(data);
      assert.ok(spec, 'Should handle field resolution');
    });
  });
});
