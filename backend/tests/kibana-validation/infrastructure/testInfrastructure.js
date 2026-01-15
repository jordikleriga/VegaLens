/**
 * Infrastructure Test Script
 * Verifies Docker Compose, Elasticsearch, Kibana, and data seeding
 */

import { KibanaTestEnvironment } from './KibanaTestEnvironment.js';
import { KibanaClient } from './KibanaClient.js';
import { DataSeeder } from './DataSeeder.js';

async function testInfrastructure() {
  console.log('='.repeat(60));
  console.log('Kibana Infrastructure Test');
  console.log('='.repeat(60));

  const env = new KibanaTestEnvironment();
  const kibanaClient = new KibanaClient();
  const dataSeeder = new DataSeeder();

  try {
    // Step 1: Start Docker Compose
    console.log('\n[Step 1] Starting Docker Compose...');
    const isRunning = await env.isRunning();

    if (!isRunning) {
      await env.start();
      console.log('✓ Docker Compose started successfully');
    } else {
      console.log('✓ Docker Compose already running');
    }

    // Step 2: Verify Elasticsearch
    console.log('\n[Step 2] Verifying Elasticsearch...');
    const esHealthy = await dataSeeder.isHealthy();
    if (esHealthy) {
      console.log('✓ Elasticsearch is healthy');
    } else {
      throw new Error('Elasticsearch is not healthy');
    }

    // Step 3: Verify Kibana
    console.log('\n[Step 3] Verifying Kibana...');
    const kibanaHealthy = await kibanaClient.isHealthy();
    if (kibanaHealthy) {
      const version = await kibanaClient.getVersion();
      console.log(`✓ Kibana is healthy (version: ${version})`);
    } else {
      throw new Error('Kibana is not healthy');
    }

    // Step 4: Seed test data
    console.log('\n[Step 4] Seeding test data...');
    await dataSeeder.seedAll();
    console.log('✓ Test data seeded successfully');

    // Step 5: Test Kibana API
    console.log('\n[Step 5] Testing Kibana API...');

    // Create a simple test visualization
    const testSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      data: {
        url: {
          index: 'test-categorical',
          body: {
            size: 0,
            aggs: {
              categories: {
                terms: { field: 'category', size: 10 }
              }
            }
          }
        },
        format: { property: 'aggregations.categories.buckets' }
      },
      mark: 'bar',
      encoding: {
        x: { field: 'key', type: 'nominal' },
        y: { field: 'doc_count', type: 'quantitative' }
      }
    };

    const vis = await kibanaClient.createVisualization(
      testSpec,
      '[TEST] Infrastructure Test',
      'Test visualization for infrastructure validation'
    );

    console.log(`✓ Created test visualization: ${vis.id}`);
    console.log(`  View at: ${kibanaClient.getVisualizationUrl(vis.id)}`);

    // Clean up test visualization
    await kibanaClient.deleteVisualization(vis.id);
    console.log('✓ Cleaned up test visualization');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✓ All infrastructure tests passed!');
    console.log('='.repeat(60));
    console.log('\nYou can now:');
    console.log('  - Access Kibana at: http://localhost:5601');
    console.log('  - Access Elasticsearch at: http://localhost:9200');
    console.log('  - Run full test suite: npm run test:kibana');
    console.log('  - Stop Docker: npm run test:kibana:docker-down');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Infrastructure test failed:', error.message);
    console.error('\nDebug steps:');
    console.error('  1. Check Docker logs: docker-compose logs');
    console.error('  2. Check services: docker-compose ps');
    console.error('  3. Restart: npm run test:kibana:docker-cleanup && npm run test:kibana:docker-up');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testInfrastructure();
}

export default testInfrastructure;
