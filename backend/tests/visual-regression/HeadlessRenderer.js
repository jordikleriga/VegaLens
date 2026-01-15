/**
 * Headless Renderer - Tier 3
 *
 * Renders Vega/Vega-Lite specs to PNG using node-canvas.
 * No browser required - pure server-side rendering.
 */

import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
// Note: canvas package is still required - vega uses it internally for node rendering

// Default config for better visual output
const DEFAULT_CONFIG = {
  // White background instead of transparent
  background: '#ffffff',

  // Axis styling with gridlines
  axis: {
    grid: true,
    gridColor: '#e0e0e0',
    gridOpacity: 0.8,
    domainColor: '#333333',
    tickColor: '#333333',
    labelColor: '#333333',
    titleColor: '#333333'
  },

  // Legend styling
  legend: {
    labelColor: '#333333',
    titleColor: '#333333'
  },

  // Title styling
  title: {
    color: '#333333'
  },

  // View padding
  view: {
    stroke: null
  }
};

export class HeadlessRenderer {
  constructor(options = {}) {
    this.width = options.width || 600;
    this.height = options.height || 400;
    this.scaleFactor = options.scaleFactor || 1;
    this.applyDefaultConfig = options.applyDefaultConfig !== false; // Default true
  }

  /**
   * Check if spec is full Vega (not Vega-Lite)
   */
  isFullVegaSpec(spec) {
    return spec.$schema?.includes('vega/v5') && !spec.$schema?.includes('vega-lite');
  }

  /**
   * Deep merge helper - our defaults take precedence for visual testing
   */
  deepMergeConfig(defaults, specConfig) {
    const result = { ...defaults };

    for (const key of Object.keys(specConfig || {})) {
      // Skip transparent backgrounds - always use white for visual testing
      if (key === 'background' && specConfig[key] === 'transparent') {
        continue;
      }

      if (typeof specConfig[key] === 'object' && specConfig[key] !== null && !Array.isArray(specConfig[key])) {
        // Deep merge nested objects, but our defaults win
        result[key] = { ...specConfig[key], ...defaults[key] };
      } else {
        // For primitives, keep our defaults (don't let spec override)
        // This ensures white background and gridlines for testing
      }
    }

    return result;
  }

  /**
   * Apply default config for better visual output
   */
  applyConfig(spec) {
    if (!this.applyDefaultConfig) {
      return spec;
    }

    // Clone to avoid mutation
    const enhanced = JSON.parse(JSON.stringify(spec));

    // For Vega-Lite specs, merge config with our defaults taking precedence
    if (!this.isFullVegaSpec(enhanced)) {
      enhanced.config = this.deepMergeConfig(DEFAULT_CONFIG, enhanced.config);
    } else {
      // For full Vega specs, always set white background
      enhanced.background = '#ffffff';
    }

    return enhanced;
  }

  /**
   * Compile Vega-Lite to Vega
   */
  compileSpec(spec) {
    // Apply default config first
    const configuredSpec = this.applyConfig(spec);

    if (this.isFullVegaSpec(configuredSpec)) {
      return configuredSpec;
    }

    // Compile Vega-Lite to Vega
    const compiled = vegaLite.compile(configuredSpec);
    return compiled.spec;
  }

  /**
   * Render a Vega spec to PNG buffer
   * @param {Object} spec - Vega or Vega-Lite specification
   * @param {Object} options - Rendering options
   * @returns {Promise<Buffer>} PNG image buffer
   */
  async render(spec, options = {}) {
    const width = options.width || this.width;
    const height = options.height || this.height;
    const scaleFactor = options.scaleFactor || this.scaleFactor;

    // Compile to Vega if needed
    let vegaSpec;
    try {
      vegaSpec = this.compileSpec(spec);
    } catch (error) {
      throw new Error(`Compilation failed: ${error.message}`);
    }

    // Override dimensions if not set
    if (!vegaSpec.width) vegaSpec.width = width;
    if (!vegaSpec.height) vegaSpec.height = height;

    // Parse the Vega spec
    let runtime;
    try {
      runtime = vega.parse(vegaSpec);
    } catch (error) {
      throw new Error(`Parse failed: ${error.message}`);
    }

    // Create view
    const view = new vega.View(runtime, {
      renderer: 'none', // Don't need DOM renderer
      logLevel: vega.Warn
    });

    // Initialize the view
    await view.runAsync();

    // Render to canvas - toCanvas() returns a canvas with the chart rendered
    // scaleFactor controls the resolution multiplier
    const canvas = await view.toCanvas(scaleFactor);

    // Export as PNG buffer
    return canvas.toBuffer('image/png');
  }

  /**
   * Render with mock data injected
   * @param {Object} spec - Vega or Vega-Lite specification
   * @param {Array} mockData - Data to inject
   * @param {Object} options - Rendering options
   * @returns {Promise<Buffer>} PNG image buffer
   */
  async renderWithData(spec, mockData, options = {}) {
    // Clone spec to avoid mutation
    const specWithData = JSON.parse(JSON.stringify(spec));

    // Inject mock data
    if (specWithData.data?.url) {
      // Replace URL data source with inline data
      delete specWithData.data.url;
      specWithData.data.values = mockData;
    } else if (specWithData.data?.values === undefined && !Array.isArray(specWithData.data)) {
      // Add inline data
      specWithData.data = { values: mockData };
    } else if (Array.isArray(specWithData.data)) {
      // Full Vega: replace source data
      const sourceIdx = specWithData.data.findIndex(d => d.name === 'source');
      if (sourceIdx >= 0) {
        delete specWithData.data[sourceIdx].url;
        specWithData.data[sourceIdx].values = mockData;
      }
    }

    return this.render(specWithData, options);
  }

  /**
   * Render multiple specs
   * @param {Array<{name: string, spec: Object}>} specs - Array of named specs
   * @param {Object} options - Rendering options
   * @returns {Promise<Array<{name: string, png: Buffer, error: Error}>>}
   */
  async renderBatch(specs, options = {}) {
    const results = [];

    for (const { name, spec, data } of specs) {
      try {
        const png = data
          ? await this.renderWithData(spec, data, options)
          : await this.render(spec, options);

        results.push({
          name,
          png,
          error: null
        });
      } catch (error) {
        results.push({
          name,
          png: null,
          error
        });
      }
    }

    return results;
  }

  /**
   * Get dimensions from spec
   */
  getDimensions(spec) {
    const vegaSpec = this.compileSpec(spec);
    return {
      width: vegaSpec.width || this.width,
      height: vegaSpec.height || this.height
    };
  }
}

export default HeadlessRenderer;
