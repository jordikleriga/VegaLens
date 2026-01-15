#!/usr/bin/env node
/**
 * Tier 2 Test Runner - Query Validation
 *
 * Validates generated Elasticsearch queries against a real Elasticsearch instance.
 * Supports two connection modes:
 * - MCP Server: Uses MCP protocol (requires MCP_SERVER_URL)
 * - Direct ES: Uses official ES client (requires ES_SERVERLESS_URL + ES_API_KEY)
 */

import 'dotenv/config';
import { chartRegistry } from '../../src/services/vega/index.js';
import { QueryValidator } from './QueryValidator.js';
import { TEST_CONFIGS } from '../spec-validation/run.js';
import { config, isMCPConfigured, isServerlessConfigured, getConnectionInfo } from '../config/elastic-cloud.js';

async function runTier2Tests(options = {}) {
  const { verbose = false, chartTypes = null, index = null } = options;

  console.log('\n====================================================');
  console.log('  TIER 2: QUERY VALIDATION');
  console.log('====================================================\n');

  // Check if any ES connection is available
  const hasMCP = isMCPConfigured();
  const hasServerless = isServerlessConfigured();

  if (!hasMCP && !hasServerless) {
    console.log('  [SKIP] No Elasticsearch connection configured\n');
    console.log('  For Elastic Serverless (direct connection):');
    console.log('    export ES_SERVERLESS_URL="https://your-project.es.region.aws.elastic.cloud"');
    console.log('    export ES_API_KEY="your-api-key"\n');
    console.log('  Or for MCP server:');
    console.log('    export MCP_SERVER_URL="http://localhost:8080/mcp"\n');

    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: Object.keys(TEST_CONFIGS).length,
      success: true, // Not a failure, just skipped
      reason: 'No ES connection configured'
    };
  }

  // Show connection info
  if (verbose) {
    const connInfo = getConnectionInfo();
    console.log('  Connection Info:');
    console.log(`    Elasticsearch: ${connInfo.elasticsearch}`);
    console.log(`    Kibana: ${connInfo.kibana}`);
    console.log(`    MCP: ${connInfo.mcp}`);
    console.log(`    Test Index: ${connInfo.testIndex}`);
    console.log(`    Serverless: ${connInfo.isServerless ? 'Yes' : 'No'}\n`);
  }

  const validator = new QueryValidator();

  // Initialize connection
  try {
    await validator.init();
    const connInfo = validator.getConnectionInfo();
    console.log(`  Connected via ${connInfo.type === 'mcp' ? 'MCP server' : 'direct Elasticsearch client'}\n`);
  } catch (error) {
    console.log(`  [ERROR] Could not connect: ${error.message}\n`);

    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: Object.keys(TEST_CONFIGS).length,
      success: false,
      reason: error.message
    };
  }

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    details: []
  };

  // Get chart types to test
  const typesToTest = chartTypes || Object.keys(TEST_CONFIGS);

  console.log(`Testing ${typesToTest.length} chart types...\n`);

  const startTime = Date.now();

  for (const chartType of typesToTest) {
    const testConfig = TEST_CONFIGS[chartType];

    if (!testConfig) {
      if (verbose) {
        console.log(`  [SKIP] ${chartType} - no test config`);
      }
      results.skipped++;
      continue;
    }

    results.total++;

    try {
      // Use configured test index instead of the placeholder 'test-index'
      const elasticConfig = {
        ...testConfig.elasticConfig,
        index: index || config.testIndex.name,
        timeField: testConfig.elasticConfig.timeField || config.testIndex.timeField
      };

      // Generate Kibana spec
      const spec = chartRegistry.generateForKibana(
        chartType,
        testConfig.config,
        elasticConfig
      );

      // Validate the query
      const result = await validator.validateSpec(spec, { index: elasticConfig.index });

      if (result.valid) {
        results.passed++;
        if (verbose) {
          console.log(`  [PASS] ${chartType} (${result.details.queryExecution.duration}ms)`);
        }
      } else {
        results.failed++;
        console.log(`  [FAIL] ${chartType}`);

        if (!result.queryExtracted) {
          console.log('         Could not extract query from spec');
        } else if (!result.queryValid) {
          console.log(`         Query error: ${result.details.queryExecution.error}`);
        } else if (!result.responseValid) {
          result.details.responseShape.issues.forEach(issue => {
            console.log(`         Response: ${issue}`);
          });
        } else if (!result.transformsValid) {
          result.details.transforms.issues.forEach(issue => {
            console.log(`         Transform: ${issue}`);
          });
        }
      }

      results.details.push({
        chartType,
        ...result
      });

    } catch (error) {
      results.failed++;
      console.log(`  [ERROR] ${chartType}: ${error.message}`);

      results.details.push({
        chartType,
        valid: false,
        error: error.message
      });
    }
  }

  await validator.close();

  const duration = Date.now() - startTime;

  // Summary
  console.log('\n----------------------------------------------------');
  console.log(`  Results: ${results.passed}/${results.total} passed`);
  if (results.skipped > 0) {
    console.log(`  Skipped: ${results.skipped}`);
  }
  console.log(`  Duration: ${duration}ms`);
  console.log('----------------------------------------------------\n');

  return {
    ...results,
    duration,
    success: results.failed === 0
  };
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const verbose = args.includes('-v') || args.includes('--verbose');
  const chartArg = args.find(a => a.startsWith('--chart='));
  const chartTypes = chartArg ? chartArg.split('=')[1].split(',') : null;
  const indexArg = args.find(a => a.startsWith('--index='));
  const index = indexArg ? indexArg.split('=')[1] : null;

  runTier2Tests({ verbose, chartTypes, index }).then(results => {
    process.exit(results.success ? 0 : 1);
  });
}

export { runTier2Tests };
