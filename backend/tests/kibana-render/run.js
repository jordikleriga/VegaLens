#!/usr/bin/env node
/**
 * Kibana Render Test - Create Visualizations in Kibana Serverless
 *
 * Creates Vega visualizations in Kibana for manual validation:
 * 1. Generates Kibana-compatible Vega specs
 * 2. Creates visualizations via saved objects import API
 * 3. Outputs URLs for manual verification
 *
 * Requires:
 * - ES_SERVERLESS_URL or KIBANA_URL: Your Kibana Serverless endpoint
 * - ES_API_KEY or ELASTIC_API_KEY: API key for authentication
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { chartRegistry } from '../../src/services/vega/index.js';
import { TEST_CONFIGS } from '../spec-validation/run.js';
import { config, isKibanaConfigured, getKibanaHeaders } from '../config/elastic-cloud.js';

const OUTPUT_DIR = 'tests/kibana-render/output';

/**
 * Kibana API Client for Serverless
 * Uses import API since individual saved object creation is not available in Serverless
 */
class KibanaClient {
  constructor() {
    this.baseUrl = config.kibana.url;
    this.headers = getKibanaHeaders();
  }

  async request(method, path, body = null, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const fetchOptions = {
      method,
      headers: { ...this.headers }
    };

    if (options.formData) {
      // For multipart/form-data, remove Content-Type to let browser set boundary
      delete fetchOptions.headers['Content-Type'];
      fetchOptions.body = body;
    } else if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Kibana API error ${response.status}: ${text}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  /**
   * Create a Vega visualization in Kibana using import API
   * Serverless Kibana doesn't expose individual saved object creation,
   * so we use the import API with NDJSON format
   */
  async createVisualization(vegaSpec, title) {
    const id = `test-vis-${Date.now()}`;

    const visState = {
      title,
      type: 'vega',
      params: {
        spec: JSON.stringify(vegaSpec, null, 2)
      }
    };

    // Create NDJSON format for import
    const savedObject = {
      id,
      type: 'visualization',
      attributes: {
        title,
        visState: JSON.stringify(visState),
        uiStateJSON: '{}',
        description: 'Test visualization',
        version: 1,
        kibanaSavedObjectMeta: {
          searchSourceJSON: '{}'
        }
      },
      references: []
    };

    const ndjson = JSON.stringify(savedObject);

    // Create form data with the NDJSON file
    const formData = new FormData();
    const blob = new Blob([ndjson], { type: 'application/ndjson' });
    formData.append('file', blob, 'import.ndjson');

    const response = await this.request(
      'POST',
      '/api/saved_objects/_import?overwrite=true',
      formData,
      { formData: true }
    );

    if (response.errors && response.errors.length > 0) {
      throw new Error(`Import failed: ${JSON.stringify(response.errors)}`);
    }

    return { id, ...response };
  }

  /**
   * Delete a visualization using export/find then bulk delete
   */
  async deleteVisualization(id) {
    try {
      // Try direct delete first
      await this.request('DELETE', `/api/saved_objects/visualization/${id}`);
    } catch (e) {
      // Serverless may not support direct delete either, ignore errors
    }
  }

  /**
   * Get visualization URL for screenshot
   */
  getVisualizationUrl(id) {
    return `${this.baseUrl}/app/visualize#/edit/${id}?embed=true`;
  }
}


async function runKibanaTests(options = {}) {
  const { verbose = false, chartTypes = null, cleanup = false } = options;

  console.log('\n====================================================');
  console.log('  KIBANA VISUALIZATION CREATOR');
  console.log('====================================================\n');

  // Check Kibana configuration
  if (!isKibanaConfigured()) {
    console.log('  [SKIP] Kibana not configured\n');
    console.log('  Set ES_SERVERLESS_URL and ES_API_KEY to enable Kibana tests\n');
    console.log('  Example:');
    console.log('    export ES_SERVERLESS_URL="https://your-project.es.region.aws.elastic.cloud"');
    console.log('    export ES_API_KEY="your-api-key"\n');

    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: Object.keys(TEST_CONFIGS).length,
      success: true,
      reason: 'Kibana not configured'
    };
  }

  console.log(`  Kibana URL: ${config.kibana.url}\n`);

  // Initialize client
  const kibanaClient = new KibanaClient();

  // Ensure output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Test Kibana connection
  try {
    console.log('  Testing Kibana connection...');
    await kibanaClient.request('GET', '/api/status');
    console.log('  Connected to Kibana\n');
  } catch (error) {
    console.log(`  [ERROR] Cannot connect to Kibana: ${error.message}\n`);
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      success: false,
      reason: error.message
    };
  }

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    details: [],
    visualizations: []
  };

  const typesToTest = chartTypes || Object.keys(TEST_CONFIGS);
  const testIndex = config.testIndex.name;

  console.log(`Creating ${typesToTest.length} visualizations...\n`);

  for (const chartType of typesToTest) {
    const testConfig = TEST_CONFIGS[chartType];
    if (!testConfig) {
      results.skipped++;
      continue;
    }

    results.total++;
    const detail = { chartType, steps: {} };

    try {
      // Step 1: Generate spec
      const elasticConfig = {
        ...testConfig.elasticConfig,
        index: testIndex,
        timeField: testConfig.elasticConfig.timeField || config.testIndex.timeField,
        useContext: true // Use Kibana time picker context
      };

      const spec = chartRegistry.generateForKibana(chartType, testConfig.config, elasticConfig);
      detail.steps.generateSpec = 'ok';

      // Step 2: Create visualization in Kibana
      let visId;
      try {
        const vis = await kibanaClient.createVisualization(spec, `[TEST] ${chartType}`);
        visId = vis.id;
        detail.steps.createVis = 'ok';
        detail.visId = visId;
      } catch (e) {
        detail.steps.createVis = `failed - ${e.message}`;
        throw e;
      }

      // Get the visualization URL for manual viewing
      const visUrl = kibanaClient.getVisualizationUrl(visId);
      detail.url = visUrl;

      results.passed++;
      results.visualizations.push({
        chartType,
        id: visId,
        title: `[TEST] ${chartType}`,
        url: visUrl
      });

      if (verbose) {
        console.log(`  [OK] ${chartType}`);
        console.log(`       ID: ${visId}`);
      } else {
        console.log(`  [OK] ${chartType} -> ${visId}`);
      }

      // Cleanup if requested
      if (cleanup) {
        await kibanaClient.deleteVisualization(visId);
        if (verbose) console.log(`       (deleted)`);
      }

      results.details.push(detail);

    } catch (error) {
      detail.error = error.message;
      results.failed++;
      console.log(`  [FAIL] ${chartType} - ${error.message}`);
      results.details.push(detail);
    }
  }

  // Summary
  console.log('\n----------------------------------------------------');
  console.log(`  Created: ${results.passed}/${results.total} visualizations`);
  if (results.skipped > 0) console.log(`  Skipped: ${results.skipped}`);
  if (results.failed > 0) console.log(`  Failed: ${results.failed}`);
  console.log('----------------------------------------------------\n');

  if (results.visualizations.length > 0 && !cleanup) {
    console.log('  View visualizations in Kibana:');
    console.log(`  ${config.kibana.url}/app/visualize\n`);
    console.log('  Or view individual charts:');
    for (const vis of results.visualizations.slice(0, 5)) {
      console.log(`    - ${vis.chartType}: ${vis.url}`);
    }
    if (results.visualizations.length > 5) {
      console.log(`    ... and ${results.visualizations.length - 5} more\n`);
    }
    console.log('\n  To clean up test visualizations, run with --cleanup\n');
  }

  // Save results
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'results.json'),
    JSON.stringify(results, null, 2)
  );

  return {
    ...results,
    success: results.failed === 0
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const verbose = args.includes('-v') || args.includes('--verbose');
  const cleanup = args.includes('--cleanup');
  const chartArg = args.find(a => a.startsWith('--chart='));
  const chartTypes = chartArg ? chartArg.split('=')[1].split(',') : null;

  if (args.includes('--help')) {
    console.log(`
Usage: node tests/kibana-render/run.js [options]

Creates Vega visualizations in Kibana Serverless for manual validation.

Options:
  --chart=type1,type2   Only create specified chart types
  --cleanup             Delete visualizations after creating (for testing import)
  -v, --verbose         Show detailed output
  --help                Show this help

Examples:
  node tests/kibana-render/run.js                    # Create all visualizations
  node tests/kibana-render/run.js --chart=bar,line  # Create specific charts
  node tests/kibana-render/run.js --cleanup         # Create then delete (test mode)
`);
    process.exit(0);
  }

  runKibanaTests({ verbose, chartTypes, cleanup }).then(results => {
    process.exit(results.success ? 0 : 1);
  });
}

export { runKibanaTests };
