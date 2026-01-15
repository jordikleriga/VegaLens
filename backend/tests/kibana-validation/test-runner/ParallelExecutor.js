/**
 * Parallel Executor
 * Executes test cases in parallel with configurable concurrency
 */

export class ParallelExecutor {
  constructor(options = {}) {
    this.defaultConcurrency = options.concurrency || 4;
    this.maxRetries = options.maxRetries || 2;
    this.retryDelay = options.retryDelay || 2000;
  }

  /**
   * Execute tasks in parallel with concurrency limit
   * @param {Array} tasks - Array of async task functions
   * @param {Object} options - Execution options
   * @returns {Promise<Array>} Array of results
   */
  async execute(tasks, options = {}) {
    const concurrency = options.concurrency || this.defaultConcurrency;
    const results = [];
    const queue = [...tasks];
    const running = new Set();

    console.log(`[ParallelExecutor] Executing ${tasks.length} tasks with concurrency ${concurrency}`);

    let completed = 0;
    let failed = 0;

    const executeTask = async (task, index) => {
      const startTime = Date.now();

      try {
        const result = await task();
        const duration = Date.now() - startTime;

        completed++;
        console.log(`[ParallelExecutor] Task ${index + 1}/${tasks.length} completed (${duration}ms)`);

        return {
          index,
          success: true,
          result,
          duration,
          error: null
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        failed++;
        console.error(`[ParallelExecutor] Task ${index + 1}/${tasks.length} failed:`, error.message);

        return {
          index,
          success: false,
          result: null,
          duration,
          error: error.message,
          stack: error.stack
        };
      }
    };

    // Process queue
    let taskIndex = 0;

    while (queue.length > 0 || running.size > 0) {
      // Start new tasks up to concurrency limit
      while (running.size < concurrency && queue.length > 0) {
        const task = queue.shift();
        const index = taskIndex++;

        const promise = executeTask(task, index);
        running.add(promise);

        // Remove from running set when complete
        promise.then(() => running.delete(promise));
      }

      // Wait for at least one task to complete
      if (running.size > 0) {
        const completed = await Promise.race(running);
        results[completed.index] = completed;
      }
    }

    console.log(`[ParallelExecutor] Execution complete: ${completed} succeeded, ${failed} failed`);

    return results;
  }

  /**
   * Execute with retries
   * @param {Array} tasks - Array of task functions
   * @param {Object} options - Execution options
   * @returns {Promise<Array>} Array of results
   */
  async executeWithRetries(tasks, options = {}) {
    const maxRetries = options.maxRetries || this.maxRetries;

    // Wrap tasks with retry logic
    const retriableTasks = tasks.map((task, index) => async () => {
      let lastError;
      let attempt = 0;

      while (attempt <= maxRetries) {
        try {
          if (attempt > 0) {
            console.log(`[ParallelExecutor] Retrying task ${index + 1} (attempt ${attempt + 1}/${maxRetries + 1})`);
            await this.sleep(this.retryDelay * attempt); // Exponential backoff
          }

          const result = await task();
          return { success: true, result, attempts: attempt + 1 };
        } catch (error) {
          lastError = error;
          attempt++;
        }
      }

      return { success: false, error: lastError, attempts: attempt };
    });

    return this.execute(retriableTasks, options);
  }

  /**
   * Execute tasks in batches
   * @param {Array} tasks - Array of task functions
   * @param {number} batchSize - Size of each batch
   * @param {Object} options - Execution options
   * @returns {Promise<Array>} Array of results
   */
  async executeBatches(tasks, batchSize, options = {}) {
    const batches = [];
    const allResults = [];

    // Split into batches
    for (let i = 0; i < tasks.length; i += batchSize) {
      batches.push(tasks.slice(i, i + batchSize));
    }

    console.log(`[ParallelExecutor] Executing ${batches.length} batches of ${batchSize} tasks`);

    // Execute batches sequentially
    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`[ParallelExecutor] Executing batch ${batchIndex + 1}/${batches.length}`);

      const batchResults = await this.execute(batch, options);
      allResults.push(...batchResults);

      // Optional delay between batches
      if (options.batchDelay && batchIndex < batches.length - 1) {
        await this.sleep(options.batchDelay);
      }
    }

    return allResults;
  }

  /**
   * Execute with progress callback
   * @param {Array} tasks - Array of task functions
   * @param {Function} onProgress - Progress callback (completed, total)
   * @param {Object} options - Execution options
   * @returns {Promise<Array>} Array of results
   */
  async executeWithProgress(tasks, onProgress, options = {}) {
    const concurrency = options.concurrency || this.defaultConcurrency;
    const results = [];
    const queue = [...tasks];

    let completed = 0;
    const total = tasks.length;

    // Wrap tasks to report progress
    const wrappedTasks = tasks.map(task => async () => {
      try {
        const result = await task();
        completed++;
        onProgress(completed, total);
        return result;
      } catch (error) {
        completed++;
        onProgress(completed, total);
        throw error;
      }
    });

    return this.execute(wrappedTasks, { concurrency });
  }

  /**
   * Execute with timeout
   * @param {Function} task - Task function
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Task result or timeout error
   */
  async executeWithTimeout(task, timeout) {
    return Promise.race([
      task(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Task timeout after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Get execution statistics
   */
  getStats(results) {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const durations = results.map(r => r.duration || 0);

    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const avgDuration = totalDuration / results.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    return {
      total: results.length,
      successful,
      failed,
      successRate: (successful / results.length) * 100,
      totalDuration,
      avgDuration,
      minDuration,
      maxDuration
    };
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create task pool
   */
  createTaskPool(tasks, concurrency) {
    const pool = {
      tasks: [...tasks],
      concurrency,
      running: 0,
      completed: 0,
      results: []
    };

    return pool;
  }

  /**
   * Group tasks by priority
   */
  groupByPriority(tasks, priorities) {
    const groups = { high: [], medium: [], low: [] };

    tasks.forEach((task, index) => {
      const priority = priorities[index] || 'medium';
      groups[priority].push(task);
    });

    return groups;
  }

  /**
   * Execute with priority (high priority tasks first)
   */
  async executeWithPriority(tasks, priorities, options = {}) {
    const groups = this.groupByPriority(tasks, priorities);

    console.log('[ParallelExecutor] Executing with priority:', {
      high: groups.high.length,
      medium: groups.medium.length,
      low: groups.low.length
    });

    const results = [];

    // Execute high priority first
    if (groups.high.length > 0) {
      const highResults = await this.execute(groups.high, options);
      results.push(...highResults);
    }

    // Then medium priority
    if (groups.medium.length > 0) {
      const mediumResults = await this.execute(groups.medium, options);
      results.push(...mediumResults);
    }

    // Finally low priority
    if (groups.low.length > 0) {
      const lowResults = await this.execute(groups.low, options);
      results.push(...lowResults);
    }

    return results;
  }
}

export default ParallelExecutor;
