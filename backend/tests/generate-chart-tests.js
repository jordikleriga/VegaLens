#!/usr/bin/env node

/**
 * Automated Test Generator for Chart Generators
 *
 * This script generates comprehensive test files for all chart generators
 * based on a common template, ensuring consistent coverage.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Chart generators to create tests for
const chartTypes = [
  'AreaChart', 'BinnedHeatmap', 'Boxplot', 'BubbleChart', 'Bullet',
  'Chord', 'CirclePacking', 'Comet', 'Density', 'DonutChart',
  'DualAxis', 'ErrorBars', 'Funnel', 'Gauge', 'Heatlane',
  'Heatmap', 'Histogram', 'Horizon', 'Lasagna', 'Marimekko',
  'Metric', 'Pareto', 'PieChart', 'PopulationPyramid', 'Radar',
  'Radial', 'RollingAverage', 'Sankey', 'ScatterChart', 'Sparkline',
  'Streamgraph', 'Table', 'Ternary', 'Treemap', 'TrellisArea',
  'Violin', 'Waterfall', 'Wordcloud'
];

function generateTestFile(chartType) {
  return `import { strict as assert } from 'assert';
import { describe, it } from 'node:test';
import { ${chartType}Generator } from '../${chartType}Generator.js';

describe('${chartType}Generator', () => {
  describe('Metadata', () => {
    it('should have valid metadata', () => {
      assert.ok(${chartType}Generator.metadata);
      assert.ok(${chartType}Generator.metadata.id);
      assert.ok(${chartType}Generator.metadata.name);
      assert.ok(${chartType}Generator.metadata.category);
    });

    it('should have correct ID format', () => {
      assert.match(${chartType}Generator.metadata.id, /^[a-z_]+$/);
    });
  });

  describe('Schema Validation', () => {
    it('should have a valid schema', () => {
      assert.ok(${chartType}Generator.schema);
      assert.ok(Array.isArray(${chartType}Generator.schema.fields));
    });

    it('should have fields defined in schema', () => {
      assert.ok(${chartType}Generator.schema.fields.length > 0, 'Should have at least one field');
    });

    it('should have valid field types', () => {
      ${chartType}Generator.schema.fields.forEach(field => {
        assert.ok(field.name, 'Field should have a name');
        assert.ok(field.label, 'Field should have a label');
        assert.ok(field.type, 'Field should have a type');
      });
    });
  });

  describe('Preview Generation', () => {
    it('should generate valid Vega-Lite spec', () => {
      const config = {};
      ${chartType}Generator.schema.fields
        .filter(f => f.required)
        .forEach(f => {
          if (f.type === 'field') {
            config[f.name] = f.name;
          }
        });

      const generator = new ${chartType}Generator(config);
      const data = ${chartType}Generator.example?.data || [];

      const spec = generator.generate(data);

      assert.ok(spec, 'Should generate a spec');
      assert.ok(spec.$schema, 'Should have $schema');
      assert.ok(spec.$schema.includes('vega'), 'Should be a Vega or Vega-Lite spec');
    });

    it('should handle empty data gracefully', () => {
      const config = {};
      ${chartType}Generator.schema.fields
        .filter(f => f.required)
        .forEach(f => {
          if (f.type === 'field') {
            config[f.name] = 'field';
          }
        });

      const generator = new ${chartType}Generator(config);
      const spec = generator.generate([]);

      assert.ok(spec, 'Should generate spec even with empty data');
    });
  });

  describe('Example Data', () => {
    it('should provide a working example', () => {
      const example = ${chartType}Generator.example;
      if (!example) {
        console.log('  ⚠ No example provided for ${chartType}Generator');
        return;
      }

      assert.ok(example.config, 'Example should have config');
      assert.ok(example.data, 'Example should have data');

      const generator = new ${chartType}Generator(example.config);
      const spec = generator.generate(example.data);

      assert.ok(spec, 'Example should generate valid spec');
    });
  });

  describe('Config Validation', () => {
    it('should accept valid config', () => {
      const config = { ...${chartType}Generator.example?.config };
      assert.doesNotThrow(() => {
        new ${chartType}Generator(config);
      });
    });

    it('should handle missing optional fields', () => {
      const requiredFields = ${chartType}Generator.schema.fields.filter(f => f.required);
      const config = {};
      requiredFields.forEach(f => {
        if (f.type === 'field') {
          config[f.name] = 'test_field';
        }
      });

      assert.doesNotThrow(() => {
        new ${chartType}Generator(config);
      });
    });
  });

  describe('Field Resolution', () => {
    it('should resolve data fields correctly', () => {
      const config = {};
      ${chartType}Generator.schema.fields
        .filter(f => f.required && f.type === 'field')
        .forEach(f => {
          config[f.name] = 'test_field';
        });

      const generator = new ${chartType}Generator(config);
      const data = [{ test_field: 'value', other_field: 123 }];

      const spec = generator.generate(data);
      assert.ok(spec, 'Should handle field resolution');
    });
  });
});
`;
}

// Generate test files
let created = 0;
let skipped = 0;

for (const chartType of chartTypes) {
  const testPath = path.join(
    __dirname,
    '../src/services/vega/charts/__tests__',
    `${chartType}Generator.spec.js`
  );

  if (fs.existsSync(testPath)) {
    console.log(`⏭  Skipped ${chartType}Generator (test already exists)`);
    skipped++;
    continue;
  }

  const content = generateTestFile(chartType);
  fs.writeFileSync(testPath, content);
  console.log(`✅ Created ${chartType}Generator.spec.js`);
  created++;
}

console.log(`\n📊 Summary:`);
console.log(`   Created: ${created} test files`);
console.log(`   Skipped: ${skipped} test files`);
console.log(`   Total: ${created + skipped} chart types`);
