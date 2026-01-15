# Testing Guide

Complete testing infrastructure for projectFlow with 90%+ code coverage goal.

## Quick Start

### Frontend Unit Tests (Vitest)
```bash
cd frontend

# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Debug tests
npm run test:debug
```

### Backend Tests
```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
node --test src/services/vega/charts/__tests__/BarChartGenerator.spec.js

# Watch mode
npm run test:watch
```

### E2E Tests (Playwright)
```bash
cd e2e

# Run all E2E tests
npm test

# Run in UI mode
npm run test:ui

# Run specific tests
npm test -- rendering

# Run accessibility tests
npm run test:a11y
```

## Test Structure

### Frontend Tests

```
frontend/
├── src/
│   ├── stores/__tests__/
│   │   ├── aggregation.spec.js      # ✅ 28 tests
│   │   ├── vega.spec.js
│   │   ├── elastic.spec.js
│   │   └── connection.spec.js
│   ├── composables/__tests__/
│   │   ├── useAggregationConfig.spec.js
│   │   ├── useMultiLevelBuckets.spec.js
│   │   └── useResizablePanel.spec.js
│   ├── services/__tests__/
│   │   ├── api.spec.js
│   │   └── chartMappers/
│   │       ├── BaseChartMapper.spec.js
│   │       ├── UnifiedChartMapper.spec.js
│   │       ├── FlowChartMapper.spec.js
│   │       └── SingleValueMapper.spec.js
│   └── components/builder/__tests__/
│       ├── UnifiedDataPanel.spec.js
│       ├── AggregationPanel.spec.js
│       └── VegaPreview.spec.js
└── tests/
    ├── setup.js                      # Global test setup
    ├── fixtures/
    │   ├── elasticsearch.js          # Mock ES data
    │   └── aggregations.js          # Mock aggregation responses
    └── mocks/
        ├── api.js                    # API mock helpers
        ├── stores.js                 # Pinia test helpers
        └── vega-embed.js             # Vega-embed mock
```

### Backend Tests

```
backend/
├── src/services/
│   ├── vega/charts/__tests__/
│   │   ├── BarChartGenerator.spec.js  # ✅ Example test
│   │   ├── LineChartGenerator.spec.js
│   │   └── ... (40+ chart types)
│   └── __tests__/
│       ├── aggregationService.spec.js
│       └── vegaLiteGenerator.spec.js
└── tests/
    ├── runTests.js                    # Test runner
    ├── chartTypes.test.js             # ✅ Existing tests
    └── integration/
        ├── dashboard-api.spec.js
        └── vega-api.spec.js
```

## Writing Tests

### Unit Test Example (Pinia Store)

```javascript
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAggregationStore } from '../aggregation'

describe('Aggregation Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should add a new bucket level', () => {
    const store = useAggregationStore()

    store.addBucketLevel({
      field: 'category',
      type: 'terms',
      options: { size: 10 }
    })

    expect(store.currentConfig.bucketAggs).toHaveLength(1)
    expect(store.currentConfig.bucketAggs[0].field).toBe('category')
  })
})
```

### Component Test Example

```javascript
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import UnifiedDataPanel from '../UnifiedDataPanel.vue'

describe('UnifiedDataPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should render all required axes', () => {
    const wrapper = mount(UnifiedDataPanel)

    expect(wrapper.find('[data-axis="x"]').exists()).toBe(true)
    expect(wrapper.find('[data-axis="y"]').exists()).toBe(true)
  })
})
```

### Backend Test Example

```javascript
import { describe, it } from 'node:test'
import assert from 'assert'
import { BarChartGenerator } from '../BarChartGenerator.js'

describe('BarChartGenerator', () => {
  it('should have correct metadata', () => {
    assert.strictEqual(BarChartGenerator.metadata.id, 'bar')
    assert.strictEqual(BarChartGenerator.metadata.category, 'comparison')
  })

  it('should generate valid Vega spec', () => {
    const generator = new BarChartGenerator({
      xField: 'category',
      yField: 'value'
    })

    const spec = generator.generate([
      { category: 'A', value: 100 }
    ])

    assert.ok(spec.$schema)
    assert.ok(spec.data)
    assert.ok(spec.marks)
  })
})
```

## Test Patterns

### AAA Pattern (Arrange-Act-Assert)

```javascript
it('should calculate total correctly', () => {
  // Arrange
  const cart = new ShoppingCart()
  const item = { id: 1, price: 10 }

  // Act
  cart.addItem(item)

  // Assert
  expect(cart.total).toBe(10)
})
```

### Mocking API Calls

```javascript
import { vi } from 'vitest'
import api from '@/services/api'

vi.mock('@/services/api')

it('should fetch data', async () => {
  api.get.mockResolvedValue({ data: mockData })

  const result = await store.fetchData()

  expect(api.get).toHaveBeenCalledWith('/endpoint')
  expect(result).toEqual(mockData)
})
```

### Testing Async Operations

```javascript
it('should handle async operations', async () => {
  const store = useAggregationStore()

  api.post.mockResolvedValue({ data: { data: mockAggregation } })

  await store.executeAggregation('test_index')

  expect(store.aggregatedData).toEqual(mockAggregation)
  expect(store.loading).toBe(false)
})
```

### Testing Error Handling

```javascript
it('should handle errors gracefully', async () => {
  api.post.mockRejectedValue({
    response: { data: { message: 'Error message' } }
  })

  await expect(store.executeAggregation('test_index')).rejects.toThrow()
  expect(store.error).toBe('Error message')
})
```

## Coverage Requirements

- **Overall**: 90%+
- **Critical paths** (stores, services): 95%+
- **UI components**: 85%+

### Viewing Coverage Reports

```bash
# Frontend
cd frontend
npm run test:coverage
# Open coverage/index.html in browser

# Backend
cd backend
npm run test:coverage
# Open coverage/index.html in browser
```

## Test Fixtures & Mocks

### Using Mock Elasticsearch Data

```javascript
import { mockIndices, mockMapping, mockSampleData } from '@/tests/fixtures/elasticsearch'

it('should load indices', () => {
  elasticStore.indices = mockIndices
  expect(elasticStore.indices).toHaveLength(2)
})
```

### Using Mock Aggregation Responses

```javascript
import { mockTermsAggregationResponse } from '@/tests/fixtures/aggregations'

api.post.mockResolvedValue({ data: mockTermsAggregationResponse })
```

### Creating Test Pinia Instance

```javascript
import { createTestingPinia } from '@/tests/mocks/stores'

beforeEach(() => {
  createTestingPinia()
})
```

## Debugging Tests

### VS Code Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test:debug"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Using Console Logs

```javascript
it('should debug test', () => {
  console.log('Debug info:', store.currentConfig)
  expect(store.hasAggregation).toBe(true)
})
```

### Isolating Tests

```javascript
// Run only this test
it.only('should run only this test', () => {
  // test code
})

// Skip this test
it.skip('should skip this test', () => {
  // test code
})
```

## Best Practices

### ✅ DO

- Write tests for new features before implementation (TDD)
- Test edge cases and error conditions
- Keep tests simple and focused
- Use descriptive test names
- Mock external dependencies
- Clean up after tests (use `beforeEach`/`afterEach`)
- Test behavior, not implementation details

### ❌ DON'T

- Test implementation details
- Write tests dependent on execution order
- Share state between tests
- Mock what you're testing
- Write overly complex test setup
- Forget to test error paths

## Continuous Testing

### Watch Mode

Frontend tests automatically re-run on file changes:

```bash
npm run test:watch
```

### Pre-commit Hooks

Tests run automatically before commits (if configured with Husky):

```bash
# Install Husky (optional)
npm install --save-dev husky
npx husky init
```

## Troubleshooting

### Common Issues

#### Tests fail with "Cannot find module"

```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
```

#### Coverage thresholds not met

```bash
# See which files need more coverage
npm run test:coverage
# Check the HTML report for details
```

#### Mocks not working

```javascript
// Ensure vi.mock is at the top of the file
vi.mock('@/services/api')

// Clear mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})
```

#### Tests timeout

```javascript
// Increase timeout for specific test
it('slow test', async () => {
  // test code
}, 10000) // 10 second timeout
```

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vue Test Utils](https://test-utils.vuejs.org/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Test Examples

See comprehensive test examples in:

- [frontend/src/stores/__tests__/aggregation.spec.js](../../frontend/src/stores/__tests__/aggregation.spec.js) - Complete store testing (28 tests)
- [backend/src/services/vega/charts/__tests__/BarChartGenerator.spec.js](../../backend/src/services/vega/charts/__tests__/BarChartGenerator.spec.js) - Chart generator testing
- [e2e/tests/rendering.spec.js](../../e2e/tests/rendering.spec.js) - E2E chart rendering tests
