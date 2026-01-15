/**
 * Image Comparator
 * Uses pixelmatch to compare screenshots and detect visual differences
 */

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';

export class ImageComparator {
  constructor(options = {}) {
    this.threshold = options.threshold || 0.1; // 10% diff tolerance
    this.includeAA = options.includeAA !== false; // Include anti-aliasing
    this.alpha = options.alpha || 0.1;
    this.diffColor = options.diffColor || [255, 0, 0]; // Red for differences
  }

  /**
   * Compare two images and generate diff
   * @param {Buffer} baselineBuffer - Baseline image buffer
   * @param {Buffer} currentBuffer - Current image buffer
   * @returns {Promise<Object>} Comparison result
   */
  async compare(baselineBuffer, currentBuffer) {
    try {
      // Load images
      const baseline = PNG.sync.read(baselineBuffer);
      const current = PNG.sync.read(currentBuffer);

      // Ensure images have same dimensions
      if (baseline.width !== current.width || baseline.height !== current.height) {
        console.warn('[ImageComparator] Image dimensions differ, resizing...');
        const resized = await this.resizeToMatch(currentBuffer, baseline.width, baseline.height);
        return this.compare(baselineBuffer, resized);
      }

      // Create diff image
      const { width, height } = baseline;
      const diff = new PNG({ width, height });

      // Perform pixel comparison
      const numDiffPixels = pixelmatch(
        baseline.data,
        current.data,
        diff.data,
        width,
        height,
        {
          threshold: this.threshold,
          includeAA: this.includeAA,
          alpha: this.alpha,
          diffColor: this.diffColor
        }
      );

      // Calculate difference percentage
      const totalPixels = width * height;
      const diffPercentage = (numDiffPixels / totalPixels) * 100;

      // Generate diff image buffer
      const diffBuffer = PNG.sync.write(diff);

      // Determine if test passed (using threshold)
      const passed = diffPercentage <= this.threshold * 100;

      const result = {
        passed,
        diffPercentage,
        numDiffPixels,
        totalPixels,
        threshold: this.threshold * 100,
        dimensions: { width, height },
        diffImage: diffBuffer
      };

      console.log('[ImageComparator] Comparison result:', {
        passed: result.passed,
        diffPercentage: result.diffPercentage.toFixed(2) + '%',
        numDiffPixels: result.numDiffPixels
      });

      return result;
    } catch (error) {
      console.error('[ImageComparator] Comparison failed:', error.message);
      throw error;
    }
  }

  /**
   * Resize image to match target dimensions
   */
  async resizeToMatch(imageBuffer, targetWidth, targetHeight) {
    try {
      const resized = await sharp(imageBuffer)
        .resize(targetWidth, targetHeight, {
          fit: 'fill',
          kernel: sharp.kernel.nearest
        })
        .png()
        .toBuffer();

      return resized;
    } catch (error) {
      console.error('[ImageComparator] Resize failed:', error.message);
      throw error;
    }
  }

  /**
   * Create side-by-side comparison image
   * @param {Buffer} baselineBuffer - Baseline image
   * @param {Buffer} currentBuffer - Current image
   * @param {Buffer} diffBuffer - Diff image
   * @returns {Promise<Buffer>} Combined comparison image
   */
  async createComparisonImage(baselineBuffer, currentBuffer, diffBuffer) {
    try {
      // Load images
      const baseline = await sharp(baselineBuffer).png().toBuffer();
      const current = await sharp(currentBuffer).png().toBuffer();
      const diff = await sharp(diffBuffer).png().toBuffer();

      // Get dimensions
      const meta = await sharp(baseline).metadata();
      const { width, height } = meta;

      // Create side-by-side image (baseline | current | diff)
      const combined = await sharp({
        create: {
          width: width * 3 + 40, // 3 images + padding
          height: height + 60, // Extra for labels
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      })
        .composite([
          // Baseline
          { input: baseline, top: 50, left: 10 },
          // Current
          { input: current, top: 50, left: width + 20 },
          // Diff
          { input: diff, top: 50, left: width * 2 + 30 }
        ])
        .png()
        .toBuffer();

      // Add labels using sharp's text overlay (if available)
      // Note: This requires sharp with text support, alternative is to return without labels
      return combined;
    } catch (error) {
      console.error('[ImageComparator] Failed to create comparison image:', error.message);
      throw error;
    }
  }

  /**
   * Get image metadata
   */
  async getMetadata(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: imageBuffer.length
      };
    } catch (error) {
      console.error('[ImageComparator] Failed to get metadata:', error.message);
      throw error;
    }
  }

  /**
   * Validate image buffer
   */
  async isValidImage(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      return metadata.width > 0 && metadata.height > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Crop image to specific region
   */
  async crop(imageBuffer, region) {
    try {
      const cropped = await sharp(imageBuffer)
        .extract(region)
        .png()
        .toBuffer();

      return cropped;
    } catch (error) {
      console.error('[ImageComparator] Crop failed:', error.message);
      throw error;
    }
  }

  /**
   * Compare only a specific region of images
   */
  async compareRegion(baselineBuffer, currentBuffer, region) {
    const baselineCropped = await this.crop(baselineBuffer, region);
    const currentCropped = await this.crop(currentBuffer, region);

    return this.compare(baselineCropped, currentCropped);
  }
}

export default ImageComparator;
