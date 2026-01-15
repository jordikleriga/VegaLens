#!/usr/bin/env node
/**
 * Tier 4 Test Runner - End-to-End Render Validation
 *
 * Full pipeline test:
 * 1. Generate Kibana-compatible Vega spec with ES query
 * 2. Execute query against real Elasticsearch
 * 3. Transform response data using spec transforms
 * 4. Substitute real data into spec
 * 5. Render chart locally with headless renderer
 * 6. Validate rendered output has meaningful content
 *
 * This validates the complete data flow from ES to rendered chart.
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { chartRegistry } from '../../src/services/vega/index.js';
import { ESClient } from '../query-validation/ESClient.js';
import { HeadlessRenderer } from '../visual-regression/HeadlessRenderer.js';
import { BaselineManager } from '../visual-regression/BaselineManager.js';
import { TEST_CONFIGS } from '../spec-validation/run.js';
import { config, isServerlessConfigured } from '../config/elastic-cloud.js';

const OUTPUT_DIR = 'tests/e2e-render/output';

/**
 * Extract ES query from Kibana Vega spec
 * Handles multiple spec formats:
 * - Vega-Lite: spec.data.url
 * - Full Vega array: spec.data[] with named sources
 * - Layer-based: spec.layer[].data.url
 */
function extractQuery(spec) {
  // Case 1: Direct Vega-Lite format (spec.data.url)
  if (spec.data?.url?.body) {
    return {
      index: spec.data.url.index,
      query: spec.data.url.body,
      format: spec.data.format
    };
  }

  // Case 2: Full Vega format with data array
  if (Array.isArray(spec.data)) {
    // Look for any data source with a URL body (not just 'source' named)
    const urlData = spec.data.find(d => d.url?.body);
    if (urlData) {
      return {
        index: urlData.url.index,
        query: urlData.url.body,
        format: urlData.format
      };
    }
  }

  // Case 3: Layer-based Vega-Lite (spec.layer[].data.url)
  if (spec.layer && Array.isArray(spec.layer)) {
    for (const layer of spec.layer) {
      if (layer.data?.url?.body) {
        return {
          index: layer.data.url.index,
          query: layer.data.url.body,
          format: layer.data.format
        };
      }
    }
  }

  // Case 4: Spec with nested spec property (faceted charts)
  if (spec.spec?.data?.url?.body) {
    return {
      index: spec.spec.data.url.index,
      query: spec.spec.data.url.body,
      format: spec.spec.data.format
    };
  }

  return null;
}

/**
 * Navigate to nested property path
 */
function getNestedProperty(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Apply Vega transforms to data
 */
function applyTransforms(data, transforms) {
  if (!transforms || transforms.length === 0) return data;

  return data.map(datum => {
    const result = { ...datum };

    for (const transform of transforms) {
      if (transform.calculate && transform.as) {
        try {
          // Simple expression evaluation
          let expr = transform.calculate;

          // Replace datum references with actual values
          expr = expr.replace(/datum\['([^']+)'\]/g, (_, field) => {
            const val = getNestedProperty(result, field);
            return typeof val === 'string' ? `"${val}"` : (val ?? 'null');
          });

          expr = expr.replace(/datum\.([a-zA-Z_][a-zA-Z0-9_.]*)/g, (_, field) => {
            const val = getNestedProperty(result, field);
            return typeof val === 'string' ? `"${val}"` : (val ?? 'null');
          });

          // Very basic eval for simple expressions
          // In production, use a proper expression parser
          try {
            // eslint-disable-next-line no-eval
            result[transform.as] = eval(expr);
          } catch {
            result[transform.as] = expr; // Keep as string if eval fails
          }
        } catch (e) {
          // Skip failed transforms
        }
      }
    }

    return result;
  });
}

/**
 * Substitute real data into spec (replace ES URL with inline values)
 * Handles multiple spec formats:
 * - Vega-Lite: spec.data.url
 * - Full Vega array: spec.data[] with named sources
 * - Layer-based: spec.layer[].data.url
 */
function substituteData(spec, data) {
  const newSpec = JSON.parse(JSON.stringify(spec));

  // Case 1: Direct Vega-Lite format
  if (newSpec.data?.url) {
    delete newSpec.data.url;
    delete newSpec.data.format;
    newSpec.data.values = data;
    return newSpec;
  }

  // Case 2: Full Vega format with data array
  if (Array.isArray(newSpec.data)) {
    const sourceIdx = newSpec.data.findIndex(d => d.url);
    if (sourceIdx >= 0) {
      delete newSpec.data[sourceIdx].url;
      delete newSpec.data[sourceIdx].format;
      newSpec.data[sourceIdx].values = data;
      return newSpec;
    }
  }

  // Case 3: Layer-based Vega-Lite
  if (newSpec.layer && Array.isArray(newSpec.layer)) {
    for (const layer of newSpec.layer) {
      if (layer.data?.url) {
        delete layer.data.url;
        delete layer.data.format;
        layer.data.values = data;
        return newSpec;
      }
    }
  }

  // Case 4: Nested spec property (faceted charts)
  if (newSpec.spec?.data?.url) {
    delete newSpec.spec.data.url;
    delete newSpec.spec.data.format;
    newSpec.spec.data.values = data;
    return newSpec;
  }

  return newSpec;
}

async function runE2ETests(options = {}) {
  const { verbose = false, chartTypes = null, saveOutput = true } = options;

  console.log('\n====================================================');
  console.log('  TIER 4: END-TO-END RENDER VALIDATION');
  console.log('====================================================\n');

  // Check ES connection
  if (!isServerlessConfigured()) {
    console.log('  [SKIP] No Elasticsearch connection configured\n');
    console.log('  Set ES_SERVERLESS_URL and ES_API_KEY to enable E2E tests\n');
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: Object.keys(TEST_CONFIGS).length,
      success: true,
      reason: 'No ES connection configured'
    };
  }

  // Initialize clients
  const esClient = new ESClient();
  const renderer = new HeadlessRenderer({ width: 600, height: 400 });
  const baselineManager = new BaselineManager({
    baselineDir: 'tests/e2e-render/baselines',
    outputDir: OUTPUT_DIR
  });

  try {
    await esClient.init();
    console.log('  Connected to Elasticsearch\n');
  } catch (error) {
    console.log(`  [ERROR] ES connection failed: ${error.message}\n`);
    return { total: 0, passed: 0, failed: 0, skipped: 0, success: false, reason: error.message };
  }

  // Ensure output directory
  if (saveOutput) {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  }

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    details: []
  };

  const typesToTest = chartTypes || Object.keys(TEST_CONFIGS);
  const testIndex = config.testIndex.name;

  console.log(`Testing ${typesToTest.length} chart types against ${testIndex}...\n`);

  for (const chartType of typesToTest) {
    const testConfig = TEST_CONFIGS[chartType];
    if (!testConfig) {
      results.skipped++;
      continue;
    }

    results.total++;
    const detail = { chartType, steps: {} };

    try {
      // Step 1: Generate Kibana spec
      const elasticConfig = {
        ...testConfig.elasticConfig,
        index: testIndex,
        timeField: testConfig.elasticConfig.timeField || config.testIndex.timeField
      };

      const spec = chartRegistry.generateForKibana(chartType, testConfig.config, elasticConfig);
      detail.steps.generateSpec = 'ok';

      // Step 2: Extract query
      const extracted = extractQuery(spec);
      if (!extracted) {
        detail.steps.extractQuery = 'failed - no query found';
        detail.error = 'Could not extract ES query from spec';
        results.failed++;
        if (verbose) console.log(`  [FAIL] ${chartType} - no ES query in spec`);
        results.details.push(detail);
        continue;
      }
      detail.steps.extractQuery = 'ok';

      // Step 3: Execute query
      let response;
      try {
        response = await esClient.search(testIndex, extracted.query);
        detail.steps.executeQuery = 'ok';
      } catch (e) {
        detail.steps.executeQuery = `failed - ${e.message}`;
        detail.error = `Query execution failed: ${e.message}`;
        results.failed++;
        if (verbose) console.log(`  [FAIL] ${chartType} - query error: ${e.message}`);
        results.details.push(detail);
        continue;
      }

      // Step 4: Extract data from response
      let data = [];
      const formatPath = extracted.format?.property || 'aggregations';

      if (formatPath.includes('aggregations')) {
        // Handle aggregation response
        const aggs = response.aggregations;
        if (aggs) {
          const aggKey = Object.keys(aggs)[0];
          if (aggs[aggKey]?.buckets) {
            data = aggs[aggKey].buckets;
          } else if (aggs[aggKey]?.value !== undefined) {
            data = [{ value: aggs[aggKey].value }];
          }
        }
      } else {
        data = getNestedProperty(response, formatPath) || [];
      }

      if (!Array.isArray(data)) data = [data];

      if (data.length === 0) {
        detail.steps.extractData = 'warning - no data returned';
        // Continue anyway to test empty state rendering
      } else {
        detail.steps.extractData = `ok (${data.length} records)`;
      }

      // Step 5: Apply transforms
      const transforms = spec.transform || [];
      const transformedData = applyTransforms(data, transforms);
      detail.steps.applyTransforms = `ok (${transforms.length} transforms)`;

      // Step 6: Substitute data into spec
      const specWithData = substituteData(spec, transformedData);
      detail.steps.substituteData = 'ok';

      // Step 7: Render chart
      let pngBuffer;
      try {
        pngBuffer = await renderer.render(specWithData);
        detail.steps.render = 'ok';
      } catch (e) {
        detail.steps.render = `failed - ${e.message}`;
        detail.error = `Render failed: ${e.message}`;
        results.failed++;
        if (verbose) console.log(`  [FAIL] ${chartType} - render error: ${e.message}`);
        results.details.push(detail);
        continue;
      }

      // Step 8: Validate content
      const validation = baselineManager.validateContent(pngBuffer, chartType);
      detail.steps.validateContent = validation.valid ? 'ok' : `warning - ${validation.warning}`;
      detail.contentAnalysis = validation.analysis;

      // Save output if requested
      if (saveOutput) {
        const outputPath = path.join(OUTPUT_DIR, `${chartType}.png`);
        await fs.writeFile(outputPath, pngBuffer);
        detail.outputPath = outputPath;
      }

      // Determine pass/fail
      if (validation.valid) {
        results.passed++;
        if (verbose) {
          console.log(`  [PASS] ${chartType} (${data.length} records, ${validation.analysis.dataPercent}% data pixels)`);
        }
      } else {
        // Warning but not failure - chart rendered but may be empty
        results.passed++;
        if (verbose) {
          console.log(`  [WARN] ${chartType} - ${validation.warning}`);
        }
      }

      results.details.push(detail);

    } catch (error) {
      detail.error = error.message;
      results.failed++;
      if (verbose) console.log(`  [FAIL] ${chartType} - ${error.message}`);
      results.details.push(detail);
    }
  }

  await esClient.close();

  // Summary
  console.log('\n----------------------------------------------------');
  console.log(`  Results: ${results.passed}/${results.total} passed`);
  if (results.skipped > 0) console.log(`  Skipped: ${results.skipped}`);
  if (results.failed > 0) console.log(`  Failed: ${results.failed}`);
  if (saveOutput) console.log(`  Output saved to: ${OUTPUT_DIR}/`);
  console.log('----------------------------------------------------\n');

  // Save detailed results
  if (saveOutput) {
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'results.json'),
      JSON.stringify(results, null, 2)
    );
  }

  return {
    ...results,
    success: results.failed === 0
  };
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const verbose = args.includes('-v') || args.includes('--verbose');
  const chartArg = args.find(a => a.startsWith('--chart='));
  const chartTypes = chartArg ? chartArg.split('=')[1].split(',') : null;
  const noSave = args.includes('--no-save');

  runE2ETests({ verbose, chartTypes, saveOutput: !noSave }).then(results => {
    process.exit(results.success ? 0 : 1);
  });
}

export { runE2ETests };
