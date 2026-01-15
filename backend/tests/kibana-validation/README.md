# Kibana Visual Regression Testing

Automated visual regression testing system for validating Vega chart specifications in actual Kibana.

## Features

- ✅ **Full Kibana Rendering**: Tests charts in real Kibana instance, not just structure validation
- 📸 **Visual Regression**: Captures and compares screenshots against baselines
- 🔧 **Auto-Fix**: Automatically fixes common spec issues (missing transforms, invalid schemes, etc.)
- ⚡ **Parallel Execution**: Runs tests concurrently based on complexity
- 📊 **Rich Reports**: Generates HTML reports with side-by-side comparisons
- 🚀 **CI/CD Ready**: GitHub Actions workflow included

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
npx playwright install chromium
```

### 2. Start Infrastructure

```bash
npm run test:kibana:docker-up
```

This starts Kibana (port 5601) and Elasticsearch (port 9200) in Docker.

### 3. Seed Test Data

```bash
npm run test:kibana:seed
```

Populates 5 test indices with realistic data for all chart types.

### 4. Run Tests

```bash
# Run all tests
npm run test:kibana

# Run single chart type
npm run test:kibana:single -- --chart=bar

# Keep infrastructure running after tests
npm run test:kibana -- --keep-running
```

### 5. View Results

After tests complete, open the HTML report:

```bash
open artifacts/latest/report.html
```

## Architecture

```
tests/kibana-validation/
├── infrastructure/
│   ├── KibanaTestEnvironment.js    # Docker orchestration
│   ├── DataSeeder.js               # ES data seeding
│   ├── KibanaClient.js             # Kibana API client
│   └── testInfrastructure.js       # Infrastructure test script
├── visual-regression/
│   ├── ScreenshotCapture.js        # Playwright screenshot capture
│   ├── ImageComparator.js          # Pixelmatch comparison
│   └── BaselineManager.js          # Baseline CRUD
├── auto-fix/
│   ├── SpecValidator.js            # 20+ validation rules
│   ├── SpecFixer.js                # Auto-fix orchestrator
│   └── FixPatterns.js              # Fix catalog
├── test-runner/
│   ├── KibanaTestRunner.js         # Main orchestrator
│   ├── ParallelExecutor.js         # Concurrent execution
│   └── test-suites.js              # Test configurations
├── reporting/
│   └── HTMLReporter.js             # HTML report generator
└── fixtures/
    ├── baseline-screenshots/       # Golden images (Git LFS)
    └── test-data/                  # ES seed data definitions
```

## Test Organization

Tests are organized by complexity:

| Group | Charts | Concurrency | Timeout |
|-------|--------|-------------|---------|
| **Simple** | Bar, Line, Pie, Area, Metric | 6 | 30s |
| **Medium** | Scatter, Bubble, Heatmap, Treemap | 4 | 45s |
| **Complex** | Circle Packing, Sankey, Chord, Sunburst | 2 | 60s |
| **Specialized** | Dual-Axis, Waterfall, Streamgraph, Violin | 1 | 60s |

## Auto-Fix System

The validator detects and auto-fixes:

1. ✅ Missing schema properties
2. ✅ Missing format.property for ES aggregations
3. ✅ Text fields without .keyword
4. ✅ Invalid flatten transform structure
5. ✅ Missing key mapping transforms
6. ✅ Invalid color schemes
7. ✅ Missing axis styling for Kibana theme
8. ✅ Fixed dimensions (should be 'container')
9. ✅ Missing Kibana context for time queries
10. ✅ Unmapped encoding fields

## Baseline Management

### View Current Baselines

```bash
# List all baselines
ls -R backend/tests/kibana-validation/fixtures/baseline-screenshots/
```

### Update Baselines

```bash
# Update all baselines
npm run test:kibana:update-baselines

# Update specific chart
npm run test:kibana:update-baselines -- --chart=bar
```

### Baseline Structure

```
baseline-screenshots/
└── 8.11.0/                    # Kibana version
    ├── bar/
    │   ├── basic.png
    │   └── horizontal.png
    ├── line/
    │   └── timeseries.png
    └── ...
```

## CI/CD Integration

### GitHub Actions

The workflow runs automatically on:
- Pull requests that modify chart generators
- Manual trigger with optional chart filter

```yaml
# .github/workflows/kibana-visual-regression.yml
on:
  pull_request:
    paths:
      - 'backend/src/services/vega/charts/**'
  workflow_dispatch:
```

### Artifacts

Test artifacts are uploaded and include:
- HTML report with visual comparisons
- Screenshots (baseline, current, diff)
- Vega specs
- Validation logs

## Development Workflow

### Adding a New Chart Type

1. Create generator in `src/services/vega/charts/`
2. Add test suite to `test-runner/test-suites.js`:

```javascript
{
  chartType: 'my_chart',
  group: 'medium',
  timeout: 45000,
  variants: [
    {
      name: 'basic',
      config: { /* chart config */ },
      elasticConfig: {
        index: 'test-categorical',
        aggregation: { /* agg config */ }
      }
    }
  ]
}
```

3. Run test to generate baseline:
```bash
npm run test:kibana:single -- --chart=my_chart
```

4. Verify screenshot in `artifacts/latest/current/`
5. Commit baseline to Git LFS

### Debugging Failed Tests

1. Check HTML report: `artifacts/latest/report.html`
2. Review side-by-side comparison
3. Check spec: `artifacts/latest/specs/{testId}.json`
4. View logs: `artifacts/latest/logs/{testId}.log`
5. Access Kibana: `http://localhost:5601`

### Local Development

```bash
# Start infrastructure
npm run test:kibana:docker-up

# Run infrastructure test
npm run test:kibana:infra-test

# Access services
curl http://localhost:9200/_cluster/health  # Elasticsearch
curl http://localhost:5601/api/status       # Kibana

# Stop infrastructure
npm run test:kibana:docker-down

# Full cleanup (removes volumes)
npm run test:kibana:docker-cleanup
```

## Configuration

### Test Options

```javascript
const runner = new KibanaTestRunner({
  keepRunning: true,      // Don't stop Docker after tests
  stopDocker: true,       // Stop Docker in cleanup
  skipSeeding: false,     // Skip data seeding
  artifactsDir: './artifacts'
});
```

### Screenshot Options

```javascript
const capture = new ScreenshotCapture({
  viewport: { width: 1280, height: 800 },
  timeout: 30000,
  waitForAnimation: 2000
});
```

### Comparison Options

```javascript
const comparator = new ImageComparator({
  threshold: 0.1,         // 10% diff tolerance
  includeAA: true,        // Include anti-aliasing
  diffColor: [255, 0, 0]  // Red highlights
});
```

## Troubleshooting

### Docker Issues

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs elasticsearch
docker-compose logs kibana

# Restart services
npm run test:kibana:docker-down
npm run test:kibana:docker-up
```

### Playwright Issues

```bash
# Reinstall browsers
npx playwright install --with-deps chromium

# Test browser
npx playwright open http://localhost:5601
```

### Baseline Drift

If many tests fail after Kibana upgrade:

```bash
# Copy baselines from old version
cd tests/kibana-validation/fixtures/baseline-screenshots/
cp -r 8.11.0/ 8.12.0/

# Update baselines
npm run test:kibana:update-baselines
```

## Performance

- **Full suite (20 charts)**: ~15 minutes
- **Simple charts**: ~30s per chart
- **Complex charts**: ~60s per chart
- **Parallel execution**: Up to 6 concurrent

## Dependencies

- **playwright**: Headless browser automation
- **pixelmatch**: Image comparison
- **pngjs**: PNG manipulation
- **sharp**: Image processing
- **Docker**: Kibana + Elasticsearch

## License

MIT
