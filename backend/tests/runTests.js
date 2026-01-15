#!/usr/bin/env node
/**
 * Test Runner - Starts server, runs tests, stops server
 * This allows tests to run without requiring a pre-started server
 */

import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let server = null;
let serverWasAlreadyRunning = false;

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('✅ Server is ready');
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.error('❌ Server failed to start');
  return false;
}

async function checkServerRunning() {
  try {
    const response = await fetch('http://localhost:3001/health');
    return response.ok;
  } catch (e) {
    return false;
  }
}

async function startServer() {
  // Check if server is already running
  const alreadyRunning = await checkServerRunning();
  if (alreadyRunning) {
    console.log('✅ Server already running');
    serverWasAlreadyRunning = true;
    return true;
  }

  console.log('🚀 Starting server...');
  
  server = spawn('node', ['src/server.js'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '3001' }
  });

  server.stdout.on('data', (data) => {
    // Suppress server output during tests
  });

  server.stderr.on('data', (data) => {
    // Only show errors
    if (data.toString().includes('Error')) {
      console.error(`Server error: ${data}`);
    }
  });

  // Wait for server to be ready
  const ready = await waitForServer('http://localhost:3001/health');
  return ready;
}

function stopServer() {
  // Don't stop if the server was already running before tests
  if (serverWasAlreadyRunning) {
    return;
  }
  if (server) {
    console.log('🛑 Stopping server...');
    server.kill('SIGTERM');
    server = null;
  }
}

async function runTests() {
  return new Promise((resolve, reject) => {
    const testProcess = spawn('node', ['tests/chartTypes.test.js'], {
      cwd: rootDir,
      stdio: 'inherit'
    });

    testProcess.on('close', (code) => {
      resolve(code);
    });

    testProcess.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  let exitCode = 1;

  try {
    // Start server
    const serverReady = await startServer();
    if (!serverReady) {
      console.error('Failed to start server');
      process.exit(1);
    }

    // Run tests
    exitCode = await runTests();

  } catch (error) {
    console.error('Test runner error:', error);
  } finally {
    // Always stop server
    stopServer();
  }

  process.exit(exitCode);
}

// Handle interrupts
process.on('SIGINT', () => {
  stopServer();
  process.exit(130);
});

process.on('SIGTERM', () => {
  stopServer();
  process.exit(143);
});

main();

