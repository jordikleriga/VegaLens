/**
 * Baseline Manager
 * Manages baseline screenshots for visual regression testing
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BaselineManager {
  constructor(options = {}) {
    this.baselineDir = options.baselineDir || path.join(__dirname, '../fixtures/baseline-screenshots');
    this.kibanaVersion = options.kibanaVersion || '8.11.0';
  }

  /**
   * Get baseline image path for a chart
   * @param {string} chartType - Chart type (e.g., 'bar', 'line')
   * @param {string} variant - Variant name (e.g., 'basic', 'stacked')
   * @returns {string} Full path to baseline image
   */
  getBaselinePath(chartType, variant = 'default') {
    return path.join(
      this.baselineDir,
      this.kibanaVersion,
      chartType,
      `${variant}.png`
    );
  }

  /**
   * Check if baseline exists
   */
  async hasBaseline(chartType, variant = 'default') {
    const baselinePath = this.getBaselinePath(chartType, variant);
    try {
      await fs.access(baselinePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get baseline image
   * @returns {Promise<Buffer>} Baseline image buffer
   */
  async getBaseline(chartType, variant = 'default') {
    const baselinePath = this.getBaselinePath(chartType, variant);

    try {
      const buffer = await fs.readFile(baselinePath);
      console.log(`[BaselineManager] Loaded baseline: ${chartType}/${variant}`);
      return buffer;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Baseline not found: ${chartType}/${variant}`);
      }
      throw error;
    }
  }

  /**
   * Save baseline image
   */
  async saveBaseline(chartType, variant = 'default', imageBuffer) {
    const baselinePath = this.getBaselinePath(chartType, variant);

    // Create directory if it doesn't exist
    const dir = path.dirname(baselinePath);
    await fs.mkdir(dir, { recursive: true });

    // Write image
    await fs.writeFile(baselinePath, imageBuffer);

    console.log(`[BaselineManager] Saved baseline: ${chartType}/${variant}`);
    console.log(`  Path: ${baselinePath}`);
    console.log(`  Size: ${imageBuffer.length} bytes`);

    return baselinePath;
  }

  /**
   * Update baseline (same as save)
   */
  async updateBaseline(chartType, variant, imageBuffer) {
    return this.saveBaseline(chartType, variant, imageBuffer);
  }

  /**
   * Delete baseline
   */
  async deleteBaseline(chartType, variant = 'default') {
    const baselinePath = this.getBaselinePath(chartType, variant);

    try {
      await fs.unlink(baselinePath);
      console.log(`[BaselineManager] Deleted baseline: ${chartType}/${variant}`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`[BaselineManager] Baseline already deleted: ${chartType}/${variant}`);
        return false;
      }
      throw error;
    }
  }

  /**
   * List all baselines for a chart type
   */
  async listBaselines(chartType) {
    const chartDir = path.join(this.baselineDir, this.kibanaVersion, chartType);

    try {
      const files = await fs.readdir(chartDir);
      const baselines = files
        .filter(f => f.endsWith('.png'))
        .map(f => path.basename(f, '.png'));

      return baselines;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * List all chart types with baselines
   */
  async listChartTypes() {
    const versionDir = path.join(this.baselineDir, this.kibanaVersion);

    try {
      const entries = await fs.readdir(versionDir, { withFileTypes: true });
      const chartTypes = entries
        .filter(e => e.isDirectory())
        .map(e => e.name);

      return chartTypes;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get all baselines as a map
   * @returns {Promise<Map<string, Array<string>>>} Map of chartType -> [variants]
   */
  async getAllBaselines() {
    const chartTypes = await this.listChartTypes();
    const baselinesMap = new Map();

    for (const chartType of chartTypes) {
      const variants = await this.listBaselines(chartType);
      baselinesMap.set(chartType, variants);
    }

    return baselinesMap;
  }

  /**
   * Copy baselines from one version to another
   */
  async copyBaselinesFromVersion(sourceVersion, targetVersion = this.kibanaVersion) {
    const sourceDir = path.join(this.baselineDir, sourceVersion);
    const targetDir = path.join(this.baselineDir, targetVersion);

    console.log(`[BaselineManager] Copying baselines from ${sourceVersion} to ${targetVersion}...`);

    try {
      await fs.cp(sourceDir, targetDir, { recursive: true });
      console.log(`[BaselineManager] Copy complete`);
      return true;
    } catch (error) {
      console.error(`[BaselineManager] Copy failed:`, error.message);
      throw error;
    }
  }

  /**
   * Delete all baselines for current version
   */
  async deleteAllBaselines() {
    const versionDir = path.join(this.baselineDir, this.kibanaVersion);

    try {
      await fs.rm(versionDir, { recursive: true, force: true });
      console.log(`[BaselineManager] Deleted all baselines for version ${this.kibanaVersion}`);
      return true;
    } catch (error) {
      console.error(`[BaselineManager] Delete failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get baseline metadata
   */
  async getBaselineMetadata(chartType, variant = 'default') {
    const baselinePath = this.getBaselinePath(chartType, variant);

    try {
      const stats = await fs.stat(baselinePath);
      return {
        chartType,
        variant,
        path: baselinePath,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Export baselines to a directory
   */
  async exportBaselines(targetDir) {
    const sourceDir = path.join(this.baselineDir, this.kibanaVersion);

    console.log(`[BaselineManager] Exporting baselines to ${targetDir}...`);

    await fs.mkdir(targetDir, { recursive: true });
    await fs.cp(sourceDir, targetDir, { recursive: true });

    console.log(`[BaselineManager] Export complete`);
    return true;
  }

  /**
   * Import baselines from a directory
   */
  async importBaselines(sourceDir) {
    const targetDir = path.join(this.baselineDir, this.kibanaVersion);

    console.log(`[BaselineManager] Importing baselines from ${sourceDir}...`);

    await fs.mkdir(targetDir, { recursive: true });
    await fs.cp(sourceDir, targetDir, { recursive: true });

    console.log(`[BaselineManager] Import complete`);
    return true;
  }

  /**
   * Get baseline directory size
   */
  async getDirectorySize() {
    const versionDir = path.join(this.baselineDir, this.kibanaVersion);

    try {
      let totalSize = 0;
      const files = await this.getAllFiles(versionDir);

      for (const file of files) {
        const stats = await fs.stat(file);
        totalSize += stats.size;
      }

      return totalSize;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Get all files recursively
   */
  async getAllFiles(dir) {
    const files = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    return files;
  }
}

export default BaselineManager;
