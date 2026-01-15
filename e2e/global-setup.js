/**
 * Global Setup for Playwright Tests
 * Runs once before all tests start
 */
import * as fs from 'fs';
import * as path from 'path';

export default async function globalSetup() {
  console.log('\n🧹 Clearing previous test results...');
  
  const summaryFile = path.join(process.cwd(), 'test-results', 'rendering-summary.json');
  
  try {
    if (fs.existsSync(summaryFile)) {
      fs.unlinkSync(summaryFile);
      console.log('   Cleared rendering-summary.json');
    }
  } catch (err) {
    console.log('   Note: Could not clear summary file:', err.message);
  }
  
  console.log('✅ Global setup complete\n');
}

