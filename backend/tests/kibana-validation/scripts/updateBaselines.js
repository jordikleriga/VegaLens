/**
 * Update Baselines Script
 * CLI tool for managing visual regression baselines
 */

import { BaselineManager } from '../visual-regression/BaselineManager.js';
import { KibanaTestEnvironment } from '../infrastructure/KibanaTestEnvironment.js';
import { KibanaClient } from '../infrastructure/KibanaClient.js';
import { ScreenshotCapture } from '../visual-regression/ScreenshotCapture.js';
import { testSuites } from '../test-runner/test-suites.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updateBaselines(options = {}) {
  console.log('='.repeat(60));
  console.log('Baseline Update Tool');
  console.log('='.repeat(60));

  const baselineManager = new BaselineManager();
  const env = new KibanaTestEnvironment();
  const kibanaClient = new KibanaClient();
  const screenshotCapture = new ScreenshotCapture();

  try {
    // Ensure infrastructure is running
    const isRunning = await env.isRunning();
    if (!isRunning) {
      console.log('\n⚠️  Docker Compose is not running');
      console.log('Start it with: npm run test:kibana:docker-up\n');
      process.exit(1);
    }

    // Filter test suites
    let suitesToUpdate = testSuites;
    if (options.chartType) {
      suitesToUpdate = testSuites.filter(s => s.chartType === options.chartType);
      if (suitesToUpdate.length === 0) {
        console.log(`\n✗ Chart type "${options.chartType}" not found\n`);
        process.exit(1);
      }
    }

    console.log(`\nUpdating baselines for ${suitesToUpdate.length} chart type(s)...\n`);

    let updated = 0;
    let failed = 0;

    for (const suite of suitesToUpdate) {
      for (const variant of suite.variants) {
        const testId = `${suite.chartType}-${variant.name}`;

        try {
          console.log(`  Updating: ${testId}...`);

          // Generate spec
          const GeneratorPath = path.join(
            __dirname,
            '../../../src/services/vega/charts',
            getGeneratorFileName(suite.chartType)
          );

          const module = await import(GeneratorPath);
          const GeneratorClass = module.default || module[Object.keys(module)[0]];
          const generator = new GeneratorClass(variant.config);
          const spec = generator.generateForKibana(variant.elasticConfig);

          // Upload to Kibana
          const vis = await kibanaClient.createVisualization(
            spec,
            `[BASELINE] ${testId}`,
            'Baseline generation'
          );

          // Capture screenshot
          const screenshot = await screenshotCapture.captureVisualization(vis.id);

          // Save as baseline
          await baselineManager.saveBaseline(suite.chartType, variant.name, screenshot);

          // Cleanup
          await kibanaClient.deleteVisualization(vis.id);

          console.log(`    ✓ Updated`);
          updated++;

        } catch (error) {
          console.log(`    ✗ Failed: ${error.message}`);
          failed++;
        }
      }
    }

    await screenshotCapture.close();

    console.log('\n' + '='.repeat(60));
    console.log('Update Summary');
    console.log('='.repeat(60));
    console.log(`\nUpdated: ${updated}`);
    console.log(`Failed: ${failed}\n`);

    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n✗ Update failed:', error.message);
    await screenshotCapture.close();
    process.exit(1);
  }
}

function getGeneratorFileName(chartType) {
  const parts = chartType.split('_');
  const className = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return `${className}Generator.js`;
}

// Parse CLI arguments
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--chart' && args[i + 1]) {
    options.chartType = args[i + 1];
    i++;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateBaselines(options);
}

export default updateBaselines;
