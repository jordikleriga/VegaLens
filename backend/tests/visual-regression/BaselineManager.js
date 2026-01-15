/**
 * Baseline Manager - Tier 3
 *
 * Manages baseline images for visual regression testing.
 */

import fs from 'fs/promises';
import path from 'path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export class BaselineManager {
  constructor(options = {}) {
    this.baselineDir = options.baselineDir || 'tests/visual-regression/baselines';
    this.outputDir = options.outputDir || 'tests/visual-regression/output';
    this.diffThreshold = options.diffThreshold || 0.01; // 1% pixel difference
  }

  /**
   * Ensure directories exist
   */
  async ensureDirectories() {
    await fs.mkdir(this.baselineDir, { recursive: true });
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'diff'), { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'current'), { recursive: true });
  }

  /**
   * Get baseline path for a chart
   */
  getBaselinePath(chartType, variant = 'default') {
    return path.join(this.baselineDir, `${chartType}-${variant}.png`);
  }

  /**
   * Get output path for current screenshot
   */
  getCurrentPath(chartType, variant = 'default') {
    return path.join(this.outputDir, 'current', `${chartType}-${variant}.png`);
  }

  /**
   * Get diff path
   */
  getDiffPath(chartType, variant = 'default') {
    return path.join(this.outputDir, 'diff', `${chartType}-${variant}.png`);
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
   * Save baseline image
   */
  async saveBaseline(chartType, variant, pngBuffer) {
    await this.ensureDirectories();
    const baselinePath = this.getBaselinePath(chartType, variant);
    await fs.writeFile(baselinePath, pngBuffer);
    console.log(`  [BASELINE] Saved: ${baselinePath}`);
    return baselinePath;
  }

  /**
   * Get baseline image
   */
  async getBaseline(chartType, variant = 'default') {
    const baselinePath = this.getBaselinePath(chartType, variant);
    return fs.readFile(baselinePath);
  }

  /**
   * Save current screenshot
   */
  async saveCurrent(chartType, variant, pngBuffer) {
    await this.ensureDirectories();
    const currentPath = this.getCurrentPath(chartType, variant);
    await fs.writeFile(currentPath, pngBuffer);
    return currentPath;
  }

  /**
   * Compare two PNG buffers
   * @param {Buffer} baseline - Baseline PNG buffer
   * @param {Buffer} current - Current PNG buffer
   * @returns {Object} Comparison result
   */
  async compare(baseline, current) {
    const baselinePng = PNG.sync.read(baseline);
    const currentPng = PNG.sync.read(current);

    const { width, height } = baselinePng;

    // Check dimensions match
    if (currentPng.width !== width || currentPng.height !== height) {
      return {
        match: false,
        reason: 'dimension_mismatch',
        baseline: { width, height },
        current: { width: currentPng.width, height: currentPng.height },
        diffPixels: -1,
        diffPercent: 100
      };
    }

    // Create diff image
    const diff = new PNG({ width, height });

    // Compare pixels
    const diffPixels = pixelmatch(
      baselinePng.data,
      currentPng.data,
      diff.data,
      width,
      height,
      {
        threshold: 0.1, // Color difference threshold
        includeAA: false, // Don't detect anti-aliasing
        alpha: 0.1 // Alpha channel blending
      }
    );

    const totalPixels = width * height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    return {
      match: diffPercent <= this.diffThreshold * 100,
      reason: diffPercent <= this.diffThreshold * 100 ? 'match' : 'visual_difference',
      diffPixels,
      diffPercent,
      totalPixels,
      threshold: this.diffThreshold * 100,
      width,
      height,
      diffImage: PNG.sync.write(diff)
    };
  }

  /**
   * Full comparison workflow
   */
  async compareAndSave(chartType, variant, currentPngBuffer) {
    await this.ensureDirectories();

    // Save current
    await this.saveCurrent(chartType, variant, currentPngBuffer);

    // Check for baseline
    const hasBaseline = await this.hasBaseline(chartType, variant);

    if (!hasBaseline) {
      // First run - create baseline
      await this.saveBaseline(chartType, variant, currentPngBuffer);
      return {
        status: 'baseline_created',
        match: true,
        chartType,
        variant
      };
    }

    // Get baseline and compare
    const baseline = await this.getBaseline(chartType, variant);
    const result = await this.compare(baseline, currentPngBuffer);

    // Save diff if not matching
    if (!result.match && result.diffImage) {
      const diffPath = this.getDiffPath(chartType, variant);
      await fs.writeFile(diffPath, result.diffImage);
      result.diffPath = diffPath;
    }

    return {
      status: result.match ? 'pass' : 'fail',
      ...result,
      chartType,
      variant
    };
  }

  /**
   * Update baseline with current
   */
  async updateBaseline(chartType, variant = 'default') {
    const currentPath = this.getCurrentPath(chartType, variant);
    const baselinePath = this.getBaselinePath(chartType, variant);

    try {
      const current = await fs.readFile(currentPath);
      await fs.writeFile(baselinePath, current);
      console.log(`  [UPDATE] Baseline updated: ${baselinePath}`);
      return true;
    } catch (error) {
      console.error(`  [ERROR] Could not update baseline: ${error.message}`);
      return false;
    }
  }

  /**
   * List all baselines
   */
  async listBaselines() {
    try {
      const files = await fs.readdir(this.baselineDir);
      return files
        .filter(f => f.endsWith('.png'))
        .map(f => {
          const [chartType, ...rest] = f.replace('.png', '').split('-');
          const variant = rest.join('-') || 'default';
          return { chartType, variant, filename: f };
        });
    } catch {
      return [];
    }
  }

  /**
   * Clean output directory
   */
  async cleanOutput() {
    try {
      await fs.rm(this.outputDir, { recursive: true, force: true });
      await this.ensureDirectories();
    } catch {
      // Ignore errors
    }
  }

  /**
   * Analyze PNG content to detect if chart has meaningful data rendered
   * Returns metrics about color diversity and non-background content
   * @param {Buffer} pngBuffer - PNG image buffer
   * @returns {Object} Content analysis result
   */
  analyzeContent(pngBuffer) {
    const png = PNG.sync.read(pngBuffer);
    const { width, height, data } = png;
    const totalPixels = width * height;

    // Count unique colors and categorize pixels
    const colorCounts = new Map();
    let backgroundPixels = 0; // White or near-white
    let textPixels = 0; // Dark gray/black (likely text/axes)
    let dataPixels = 0; // Colored pixels (likely chart data)

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip fully transparent
      if (a === 0) {
        backgroundPixels++;
        continue;
      }

      const colorKey = `${r},${g},${b}`;
      colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);

      // Categorize by color
      const brightness = (r + g + b) / 3;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);

      if (brightness > 240 && saturation < 20) {
        // White/near-white background
        backgroundPixels++;
      } else if (brightness < 80 && saturation < 30) {
        // Dark gray/black - likely text, axes, gridlines
        textPixels++;
      } else if (saturation > 30 || (brightness > 80 && brightness < 240)) {
        // Colored or mid-tone - likely actual chart data
        dataPixels++;
      } else {
        // Light gray - could be gridlines or light data
        textPixels++;
      }
    }

    const uniqueColors = colorCounts.size;
    const backgroundPercent = (backgroundPixels / totalPixels) * 100;
    const textPercent = (textPixels / totalPixels) * 100;
    const dataPercent = (dataPixels / totalPixels) * 100;

    // Determine if chart has meaningful content
    // A chart with no data typically has >95% background + <2% data pixels
    const hasData = dataPercent > 2;
    const isEmptyChart = backgroundPercent > 90 && dataPercent < 2;
    const isAxesOnly = backgroundPercent > 85 && textPercent > 3 && dataPercent < 3;

    return {
      width,
      height,
      totalPixels,
      uniqueColors,
      backgroundPixels,
      backgroundPercent: backgroundPercent.toFixed(1),
      textPixels,
      textPercent: textPercent.toFixed(1),
      dataPixels,
      dataPercent: dataPercent.toFixed(1),
      hasData,
      isEmptyChart,
      isAxesOnly,
      contentScore: dataPercent + (textPercent * 0.1), // Weighted score
      verdict: hasData ? 'HAS_DATA' : (isAxesOnly ? 'AXES_ONLY' : 'EMPTY')
    };
  }

  /**
   * Validate that a rendered chart has meaningful content
   * @param {Buffer} pngBuffer - PNG image buffer
   * @param {string} chartType - Chart type for context
   * @returns {Object} Validation result
   */
  validateContent(pngBuffer, chartType) {
    const analysis = this.analyzeContent(pngBuffer);

    // Some chart types legitimately have less visual data
    const lowDataCharts = ['metric', 'sparkline', 'table', 'gauge'];
    const minDataPercent = lowDataCharts.includes(chartType) ? 0.5 : 2;

    const isValid = analysis.dataPercent >= minDataPercent || analysis.hasData;

    return {
      valid: isValid,
      analysis,
      warning: !isValid ? `Chart appears empty: ${analysis.verdict} (${analysis.dataPercent}% data pixels)` : null
    };
  }
}

export default BaselineManager;
