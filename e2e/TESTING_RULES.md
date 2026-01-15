# E2E Testing Rules for ProjectFlow

## Overview

This document defines the rules and requirements for UI testing in ProjectFlow. All new features MUST include corresponding E2E tests.

## Core Rules

### 1. Every New Feature Requires a UI Test

When implementing a new feature, you MUST:

1. **Create or update a test file** in `e2e/tests/` that covers the feature
2. **Run the test** to verify it passes
3. **Check console logs** for any errors during the test
4. **Fix any detected errors** before considering the feature complete

### 2. Console Error Detection

All tests automatically detect and report:

- **Console errors** (`console.error`)
- **Console warnings** (`console.warning`) - optional
- **JavaScript exceptions** (uncaught errors)
- **Network failures** (failed requests)
- **HTTP errors** (4xx, 5xx responses)

Tests will **FAIL** if any console errors or network errors are detected.

### 3. Test Structure

Each test MUST:

```javascript
import { test, expect } from '../utils/fixtures.js';
import { waitForPageStable } from '../utils/testHelpers.js';

test.describe('Feature Name', () => {
  
  test('loads without console errors', async ({ page, errorCollector }) => {
    // Navigate to feature
    await page.goto('/feature-path');
    await waitForPageStable(page);
    
    // Test functionality
    // ...
    
    // Assert no errors (automatic via errorCollector)
    errorCollector.assertNoErrors();
  });
});
```

### 4. Required Tests for New Chart Types

**MANDATORY**: When adding a new chart type, you MUST add it to the `ALL_CHART_TYPES` array in `e2e/tests/rendering.spec.js`:

```javascript
// In e2e/tests/rendering.spec.js - add your new chart type:
const ALL_CHART_TYPES = [
  // ... existing charts ...
  { name: 'Your New Chart', type: 'your_new_chart' },
];
```

This automatically creates tests that verify:

1. Chart type appears in the picker
2. Selecting the chart type doesn't cause errors
3. Vega preview renders without console errors
4. Kibana spec generation works without errors

**Every chart type MUST pass both Vega rendering and Kibana spec tests.**

The rendering tests are in `e2e/tests/rendering.spec.js` and include:
- `${chartName} chart renders without errors` - Tests Vega preview
- `Kibana spec for ${chartName} chart is valid` - Tests Kibana spec generation

### 5. Required Tests for New Pages/Views

When adding a new page, create tests that verify:

1. Page loads without errors
2. All key elements are visible
3. Navigation to/from the page works
4. Any interactive elements function correctly

### 6. Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with visual UI
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
cd e2e && npm run test:builder

# Debug a failing test
npm run test:e2e:debug
```

### 7. Test Workflow

Before completing any feature:

1. **Write the test** for the feature
2. **Run the test**: `npm run test:e2e`
3. **Check results**: Look for any failures
4. **Fix errors**: If console errors are detected, fix them
5. **Re-run test**: Verify the fix works
6. **Commit**: Include both feature and test changes

### 8. Error Handling in Tests

The `ConsoleErrorCollector` automatically:

- Attaches to each page
- Collects all console messages
- Reports errors at the end of each test
- Fails the test if critical errors are found

To manually check errors during a test:

```javascript
// Check current error count
expect(errorCollector.errors.length).toBe(0);

// Get detailed error report
const report = errorCollector.generateReport();
console.log(report);

// Allow specific HTTP errors (e.g., 404 for optional resources)
errorCollector.assertNoErrors({ 
  allowedHttpErrors: [404] 
});
```

### 9. Page Object Model

Use page objects for reusable page interactions:

```javascript
import { BuilderPage } from '../pages/index.js';

test('example', async ({ page, errorCollector }) => {
  const builderPage = new BuilderPage(page);
  await builderPage.goto();
  await builderPage.selectChartType('bar');
  await builderPage.configureField('X-Axis', 'category');
  await builderPage.waitForPreview();
  
  errorCollector.assertNoErrors();
});
```

### 10. CI/CD Integration

In CI environments:

- Tests run in headless mode
- Failed tests are retried twice
- Screenshots are captured on failure
- Video is recorded on failure
- HTML report is generated

## File Structure

```
e2e/
├── playwright.config.js    # Playwright configuration
├── package.json            # Dependencies and scripts
├── TESTING_RULES.md        # This file
├── pages/                  # Page Object Models
│   ├── BasePage.js
│   ├── BuilderPage.js
│   ├── HomePage.js
│   ├── LibraryPage.js
│   └── index.js
├── utils/                  # Test utilities
│   ├── fixtures.js         # Custom test fixtures
│   └── testHelpers.js      # Helper functions
├── tests/                  # Test files
│   ├── home.spec.js
│   ├── builder.spec.js
│   ├── library.spec.js
│   ├── explore.spec.js
│   ├── help.spec.js
│   ├── navigation.spec.js
│   └── accessibility.spec.js
└── test-results/           # Test output (gitignored)
    ├── html-report/
    ├── artifacts/
    └── screenshots/
```

## Checklist for New Features

- [ ] Feature implemented
- [ ] Test file created/updated in `e2e/tests/`
- [ ] Test covers main functionality
- [ ] Test checks for console errors
- [ ] All tests pass locally
- [ ] No console errors detected
- [ ] Test committed with feature


