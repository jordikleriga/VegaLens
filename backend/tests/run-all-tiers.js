#!/usr/bin/env node
/**
 * Unified Test Runner - All Tiers
 *
 * Runs all testing tiers in sequence:
 * - Tier 1: Schema Validation (fast, always runs)
 * - Tier 2: Query Validation (requires ES connection)
 * - Tier 3: Visual Regression (headless rendering)
 * - Tier 4: End-to-End Render (full pipeline with real ES data)
 */

import { runTier1Tests } from './spec-validation/run.js';
import { runTier2Tests } from './query-validation/run.js';
import { runTier3Tests } from './visual-regression/run.js';
import { runE2ETests as runTier4Tests } from './e2e-render/run.js';

async function runAllTiers(options = {}) {
  const {
    verbose = false,
    chartTypes = null,
    skipTier2 = false,
    skipTier3 = false,
    skipTier4 = false,
    updateBaselines = false
  } = options;

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║       VEGATOOL VALIDATION TEST SUITE               ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  const results = {
    tier1: null,
    tier2: null,
    tier3: null,
    tier4: null,
    overall: {
      success: true,
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalSkipped: 0
    }
  };

  const startTime = Date.now();

  // ═══════════════════════════════════════════════════════════
  // TIER 1: Schema Validation
  // ═══════════════════════════════════════════════════════════
  console.log('┌────────────────────────────────────────────────────┐');
  console.log('│  TIER 1: Schema Validation                         │');
  console.log('└────────────────────────────────────────────────────┘');

  results.tier1 = await runTier1Tests({ verbose, chartTypes });

  results.overall.totalTests += results.tier1.total;
  results.overall.totalPassed += results.tier1.passed;
  results.overall.totalFailed += results.tier1.failed;
  results.overall.totalSkipped += results.tier1.skipped;

  if (!results.tier1.success) {
    results.overall.success = false;
  }

  // ═══════════════════════════════════════════════════════════
  // TIER 2: Query Validation
  // ═══════════════════════════════════════════════════════════
  if (!skipTier2) {
    console.log('┌────────────────────────────────────────────────────┐');
    console.log('│  TIER 2: Query Validation (Elasticsearch)          │');
    console.log('└────────────────────────────────────────────────────┘');

    results.tier2 = await runTier2Tests({ verbose, chartTypes });

    results.overall.totalTests += results.tier2.total;
    results.overall.totalPassed += results.tier2.passed;
    results.overall.totalFailed += results.tier2.failed;
    results.overall.totalSkipped += results.tier2.skipped;

    // Only fail overall if Tier 2 was configured and failed
    if (results.tier2.reason !== 'MCP not configured' && !results.tier2.success) {
      results.overall.success = false;
    }
  } else {
    console.log('\n  [SKIP] Tier 2 skipped (--skip-tier2)\n');
  }

  // ═══════════════════════════════════════════════════════════
  // TIER 3: Visual Regression
  // ═══════════════════════════════════════════════════════════
  if (!skipTier3) {
    console.log('┌────────────────────────────────────────────────────┐');
    console.log('│  TIER 3: Visual Regression (Headless)              │');
    console.log('└────────────────────────────────────────────────────┘');

    results.tier3 = await runTier3Tests({ verbose, chartTypes, updateBaselines });

    results.overall.totalTests += results.tier3.total;
    results.overall.totalPassed += results.tier3.passed;
    results.overall.totalFailed += results.tier3.failed;
    results.overall.totalSkipped += results.tier3.skipped;

    if (!results.tier3.success) {
      results.overall.success = false;
    }
  } else {
    console.log('\n  [SKIP] Tier 3 skipped (--skip-tier3)\n');
  }

  // ═══════════════════════════════════════════════════════════
  // TIER 4: End-to-End Render Validation
  // ═══════════════════════════════════════════════════════════
  if (!skipTier4) {
    console.log('┌────────────────────────────────────────────────────┐');
    console.log('│  TIER 4: End-to-End Render (Full Pipeline)         │');
    console.log('└────────────────────────────────────────────────────┘');

    results.tier4 = await runTier4Tests({ verbose, chartTypes, saveOutput: true });

    results.overall.totalTests += results.tier4.total;
    results.overall.totalPassed += results.tier4.passed;
    results.overall.totalFailed += results.tier4.failed;
    results.overall.totalSkipped += results.tier4.skipped;

    // Only fail overall if Tier 4 was configured and failed
    if (results.tier4.reason !== 'No ES connection configured' && !results.tier4.success) {
      results.overall.success = false;
    }
  } else {
    console.log('\n  [SKIP] Tier 4 skipped (--skip-tier4)\n');
  }

  const totalDuration = Date.now() - startTime;

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY                         ║');
  console.log('╠════════════════════════════════════════════════════╣');

  const { overall } = results;
  const passRate = overall.totalTests > 0
    ? ((overall.totalPassed / overall.totalTests) * 100).toFixed(1)
    : 'N/A';

  console.log(`║  Total Tests:  ${String(overall.totalTests).padEnd(35)}║`);
  console.log(`║  Passed:       ${String(overall.totalPassed).padEnd(35)}║`);
  console.log(`║  Failed:       ${String(overall.totalFailed).padEnd(35)}║`);
  console.log(`║  Skipped:      ${String(overall.totalSkipped).padEnd(35)}║`);
  console.log(`║  Pass Rate:    ${String(passRate + '%').padEnd(35)}║`);
  console.log(`║  Duration:     ${String(totalDuration + 'ms').padEnd(35)}║`);
  console.log('╠════════════════════════════════════════════════════╣');

  if (overall.success) {
    console.log('║  Status:       ✓ ALL TESTS PASSED                  ║');
  } else {
    console.log('║  Status:       ✗ TESTS FAILED                      ║');
  }

  console.log('╚════════════════════════════════════════════════════╝\n');

  return results;
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  const options = {
    verbose: args.includes('-v') || args.includes('--verbose'),
    skipTier2: args.includes('--skip-tier2'),
    skipTier3: args.includes('--skip-tier3'),
    skipTier4: args.includes('--skip-tier4'),
    updateBaselines: args.includes('--update-baselines') || args.includes('-u'),
    chartTypes: null
  };

  const chartArg = args.find(a => a.startsWith('--chart='));
  if (chartArg) {
    options.chartTypes = chartArg.split('=')[1].split(',');
  }

  // Help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
VegaTool Validation Test Suite

Usage: node tests/run-all-tiers.js [options]

Options:
  -v, --verbose         Show detailed output
  --skip-tier2          Skip query validation
  --skip-tier3          Skip visual regression tests
  --skip-tier4          Skip end-to-end render tests
  --update-baselines    Update visual regression baselines
  --chart=<types>       Test specific chart types (comma-separated)
  -h, --help            Show this help

Tiers:
  1. Schema Validation   - Validates Vega/Vega-Lite spec structure
  2. Query Validation    - Tests ES queries execute correctly
  3. Visual Regression   - Compares rendered charts to baselines
  4. E2E Render          - Full pipeline: ES query → render → validate

Examples:
  node tests/run-all-tiers.js                    # Run all tiers
  node tests/run-all-tiers.js --skip-tier3       # Skip visual regression
  node tests/run-all-tiers.js --chart=bar,line   # Test specific charts
  node tests/run-all-tiers.js -u                 # Update baselines

Environment Variables:
  ES_SERVERLESS_URL     Elasticsearch Serverless URL
  ES_API_KEY            API key for authentication
  MCP_SERVER_URL        MCP server endpoint (optional)
  VISUAL_DIFF_THRESHOLD Pixel diff threshold (default: 0.01 = 1%)
`);
    process.exit(0);
  }

  runAllTiers(options).then(results => {
    process.exit(results.overall.success ? 0 : 1);
  });
}

export { runAllTiers };
