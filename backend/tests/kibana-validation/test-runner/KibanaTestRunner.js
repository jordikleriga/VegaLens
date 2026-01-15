/**
 * Kibana Test Runner
 * Main orchestrator for visual regression testing of Kibana chart specs
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { KibanaTestEnvironment } from '../infrastructure/KibanaTestEnvironment.js';
import { KibanaClient } from '../infrastructure/KibanaClient.js';
import { DataSeeder } from '../infrastructure/DataSeeder.js';
import { ScreenshotCapture } from '../visual-regression/ScreenshotCapture.js';
import { ImageComparator } from '../visual-regression/ImageComparator.js';
import { BaselineManager } from '../visual-regression/BaselineManager.js';
import { SpecFixer } from '../auto-fix/SpecFixer.js';
import { ParallelExecutor } from './ParallelExecutor.js';
import { HTMLReporter } from '../reporting/HTMLReporter.js';
import { testSuites, getConcurrencySettings } from './test-suites.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class KibanaTestRunner {
  constructor(options = {}) {
    this.options = options;
    this.env = new KibanaTestEnvironment();
    this.kibanaClient = new KibanaClient();
    this.dataSeeder = new DataSeeder();
    this.screenshotCapture = new ScreenshotCapture();
    this.imageComparator = new ImageComparator();
    this.baselineManager = new BaselineManager();
    this.specFixer = new SpecFixer({ autoFix: true });
    this.executor = new ParallelExecutor();
    this.htmlReporter = new HTMLReporter();

    this.artifactsDir = options.artifactsDir || path.join(__dirname, '../../../artifacts');
    this.runId = `run-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    this.runDir = path.join(this.artifactsDir, this.runId);

    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Run all tests
   */
  async run() {
    console.log('='.repeat(80));
    console.log('Kibana Visual Regression Test Suite');
    console.log('='.repeat(80));

    this.startTime = Date.now();

    try {
      // Step 1: Setup infrastructure
      await this.setupInfrastructure();

      // Step 2: Prepare artifacts directory
      await this.prepareArtifacts();

      // Step 3: Run tests by group
      await this.runTestsByGroup();

      // Step 4: Generate reports
      await this.generateReports();

      // Step 5: Cleanup
      if (!this.options.keepRunning) {
        await this.cleanup();
      }

      this.endTime = Date.now();

      // Print summary
      this.printSummary();

      return this.getTestResults();
    } catch (error) {
      console.error('\n✗ Test run failed:', error.message);
      console.error(error.stack);

      if (!this.options.keepRunning) {
        await this.cleanup();
      }

      throw error;
    }
  }

  /**
   * Setup infrastructure (Docker, data seeding)
   */
  async setupInfrastructure() {
    console.log('\n[1/5] Setting up infrastructure...');

    // Start Docker if not running
    const isRunning = await this.env.isRunning();
    if (!isRunning) {
      console.log('Starting Docker Compose...');
      await this.env.start();
    } else {
      console.log('Docker Compose already running');
    }

    // Seed data if needed
    if (!this.options.skipSeeding) {
      console.log('Seeding test data...');
      await this.dataSeeder.seedAll();
    } else {
      console.log('Skipping data seeding');
    }

    console.log('✓ Infrastructure ready');
  }

  /**
   * Prepare artifacts directory
   */
  async prepareArtifacts() {
    console.log('\n[2/5] Preparing artifacts...');

    await fs.mkdir(this.runDir, { recursive: true });
    await fs.mkdir(path.join(this.runDir, 'baseline'), { recursive: true });
    await fs.mkdir(path.join(this.runDir, 'current'), { recursive: true });
    await fs.mkdir(path.join(this.runDir, 'diff'), { recursive: true });
    await fs.mkdir(path.join(this.runDir, 'specs'), { recursive: true });
    await fs.mkdir(path.join(this.runDir, 'logs'), { recursive: true });

    // Create symlink to latest
    const latestLink = path.join(this.artifactsDir, 'latest');
    try {
      await fs.unlink(latestLink);
    } catch (error) {
      // Ignore if doesn't exist
    }
    await fs.symlink(this.runId, latestLink, 'dir');

    console.log(`✓ Artifacts directory: ${this.runDir}`);
  }

  /**
   * Run tests organized by group
   */
  async runTestsByGroup() {
    console.log('\n[3/5] Running visual regression tests...\n');

    const concurrencySettings = getConcurrencySettings();
    const groups = ['simple', 'medium', 'complex', 'specialized'];

    for (const group of groups) {
      const groupSuites = testSuites.filter(s => s.group === group);
      if (groupSuites.length === 0) continue;

      const settings = concurrencySettings[group];

      console.log(`\n--- ${group.toUpperCase()} Charts (${groupSuites.length} types, concurrency: ${settings.concurrency}) ---\n`);

      // Create test tasks for this group
      const tasks = [];
      for (const suite of groupSuites) {
        for (const variant of suite.variants) {
          tasks.push(() => this.runSingleTest(suite, variant));
        }
      }

      // Execute with group-specific concurrency
      const groupResults = await this.executor.execute(tasks, {
        concurrency: settings.concurrency
      });

      this.results.push(...groupResults.map(r => r.result).filter(Boolean));
    }
  }

  /**
   * Run a single test case
   */
  async runSingleTest(suite, variant) {
    const testId = `${suite.chartType}-${variant.name}`;
    const startTime = Date.now();

    console.log(`  Testing: ${testId}...`);

    const result = {
      chartType: suite.chartType,
      variant: variant.name,
      testId,
      passed: false,
      duration: 0,
      spec: null,
      validation: null,
      fixes: [],
      comparison: null,
      error: null,
      visualizationId: null
    };

    try {
      // Step 1: Generate spec (using generator from src/services/vega/charts/)
      const spec = await this.generateSpec(suite.chartType, variant);
      result.spec = spec;

      // Save spec
      await this.saveSpec(testId, spec);

      // Step 2: Validate and fix spec
      const fixResult = await this.specFixer.validateAndFix(spec);
      result.validation = fixResult.validation;
      result.fixes = fixResult.fixes;

      if (!fixResult.success) {
        const criticalIssues = this.specFixer.validator.getCriticalIssues(fixResult.validation.issues);
        if (criticalIssues.length > 0) {
          throw new Error(`Spec validation failed with ${criticalIssues.length} critical issues`);
        }
      }

      const finalSpec = fixResult.fixedSpec || spec;

      // Step 3: Upload to Kibana
      const vis = await this.kibanaClient.createVisualization(
        finalSpec,
        `[TEST] ${testId}`,
        `Visual regression test for ${suite.chartType}`
      );
      result.visualizationId = vis.id;

      // Step 4: Capture screenshot
      const screenshot = await this.screenshotCapture.captureVisualization(vis.id);
      await this.saveScreenshot(testId, 'current', screenshot);

      // Step 5: Compare with baseline
      const hasBaseline = await this.baselineManager.hasBaseline(suite.chartType, variant.name);

      if (hasBaseline) {
        const baseline = await this.baselineManager.getBaseline(suite.chartType, variant.name);
        await this.saveScreenshot(testId, 'baseline', baseline);

        const comparison = await this.imageComparator.compare(baseline, screenshot);
        result.comparison = comparison;
        result.passed = comparison.passed;

        // Save diff image
        if (comparison.diffImage) {
          await this.saveScreenshot(testId, 'diff', comparison.diffImage);
        }

        console.log(`    ${result.passed ? '✓' : '✗'} Diff: ${comparison.diffPercentage.toFixed(2)}%`);
      } else {
        // No baseline - save as new baseline
        console.log(`    ℹ No baseline found, saving current as baseline`);
        await this.baselineManager.saveBaseline(suite.chartType, variant.name, screenshot);
        result.passed = true;
        result.comparison = { isNewBaseline: true };
      }

      // Cleanup visualization
      await this.kibanaClient.deleteVisualization(vis.id);

    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
      result.error = error.message;
      result.passed = false;

      // Save error log
      await this.saveLog(testId, error);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Generate Vega spec for a chart type
   */
  async generateSpec(chartType, variant) {
    // Import the generator dynamically
    const generatorPath = path.join(
      __dirname,
      '../../../src/services/vega/charts',
      this.getGeneratorFileName(chartType)
    );

    try {
      const module = await import(generatorPath);
      const GeneratorClass = module.default || module[Object.keys(module)[0]];
      const generator = new GeneratorClass(variant.config);

      // Generate Kibana spec
      const spec = generator.generateForKibana(variant.elasticConfig);

      return spec;
    } catch (error) {
      throw new Error(`Failed to generate spec: ${error.message}`);
    }
  }

  /**
   * Get generator file name from chart type
   */
  getGeneratorFileName(chartType) {
    // Convert chart_type -> ChartTypeGenerator.js
    const parts = chartType.split('_');
    const className = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    return `${className}Generator.js`;
  }

  /**
   * Save spec to artifacts
   */
  async saveSpec(testId, spec) {
    const specPath = path.join(this.runDir, 'specs', `${testId}.json`);
    await fs.writeFile(specPath, JSON.stringify(spec, null, 2));
  }

  /**
   * Save screenshot to artifacts
   */
  async saveScreenshot(testId, type, buffer) {
    const screenshotPath = path.join(this.runDir, type, `${testId}.png`);
    await fs.writeFile(screenshotPath, buffer);
  }

  /**
   * Save error log
   */
  async saveLog(testId, error) {
    const logPath = path.join(this.runDir, 'logs', `${testId}.log`);
    const logContent = `Error: ${error.message}\n\nStack:\n${error.stack}`;
    await fs.writeFile(logPath, logContent);
  }

  /**
   * Generate reports
   */
  async generateReports() {
    console.log('\n[4/5] Generating reports...');

    const summary = this.getTestResults();

    // Save summary JSON
    const summaryPath = path.join(this.runDir, 'summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    // Generate HTML report
    const reportPath = path.join(this.runDir, 'report.html');
    await this.htmlReporter.generate(summary, reportPath);

    console.log(`✓ Summary saved to: ${summaryPath}`);
    console.log(`✓ HTML report saved to: ${reportPath}`);
  }

  /**
   * Cleanup
   */
  async cleanup() {
    console.log('\n[5/5] Cleaning up...');

    // Close screenshot capture browser
    await this.screenshotCapture.close();

    // Optionally stop Docker
    if (this.options.stopDocker) {
      await this.env.stop();
    }

    console.log('✓ Cleanup complete');
  }

  /**
   * Get test results
   */
  getTestResults() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    return {
      runId: this.runId,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime - this.startTime,
      total,
      passed,
      failed,
      passRate: (passed / total) * 100,
      results: this.results,
      artifactsDir: this.runDir
    };
  }

  /**
   * Print summary
   */
  printSummary() {
    const summary = this.getTestResults();

    console.log('\n' + '='.repeat(80));
    console.log('Test Summary');
    console.log('='.repeat(80));
    console.log(`\nTotal Tests: ${summary.total}`);
    console.log(`Passed: ${summary.passed} (${summary.passRate.toFixed(1)}%)`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Duration: ${(summary.duration / 1000).toFixed(1)}s`);
    console.log(`\nArtifacts: ${summary.artifactsDir}`);
    console.log('\n');
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    keepRunning: args.includes('--keep-running'),
    stopDocker: args.includes('--stop-docker'),
    skipSeeding: args.includes('--skip-seeding')
  };

  const runner = new KibanaTestRunner(options);

  try {
    await runner.run();
    process.exit(0);
  } catch (error) {
    console.error('Test run failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default KibanaTestRunner;
