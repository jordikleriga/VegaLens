/**
 * Chart Registry
 * Manages registration and lookup of chart generators
 * Provides a plugin-based architecture for chart types
 */

import { logger } from './utils/logger.js';
import { VegaGeneratorBase } from './VegaGeneratorBase.js';

class ChartRegistry {
  constructor() {
    this.generators = new Map();
    this.metadata = new Map();
    this.schemas = new Map();
    this.examples = new Map();
  }

  /**
   * Register a chart generator
   * @param {string} id - Unique chart type identifier
   * @param {Object} options - Registration options
   * @param {Function} options.generator - Generator class or factory function
   * @param {Object} options.metadata - Chart metadata (name, description, category, icon)
   * @param {Object} options.schema - Configuration schema for the chart
   * @param {Object} options.example - Example config and data for the chart
   */
  register(id, options) {
    const { generator, metadata, schema, example } = options;

    if (this.generators.has(id)) {
      logger.warn('Chart type already registered, overwriting', { chartType: id });
    }

    this.generators.set(id, generator);
    
    if (metadata) {
      this.metadata.set(id, {
        id,
        name: metadata.name || id,
        description: metadata.description || '',
        category: metadata.category || 'other',
        icon: metadata.icon || 'chart'
      });
    }

    if (schema) {
      this.schemas.set(id, schema);
    }

    // Store example from generator's static property or options
    const exampleData = example || generator?.example;
    if (exampleData) {
      this.examples.set(id, exampleData);
    }

    logger.debug('Chart type registered', {
      event: 'chart_registered',
      chartType: id,
      category: metadata?.category
    });

    return this;
  }

  /**
   * Get a generator for a chart type
   * @param {string} id - Chart type identifier
   * @returns {Function|null} Generator class or null if not found
   */
  getGenerator(id) {
    return this.generators.get(id) || null;
  }

  /**
   * Get metadata for a chart type
   */
  getMetadata(id) {
    return this.metadata.get(id) || null;
  }

  /**
   * Get schema for a chart type
   */
  getSchema(id) {
    return this.schemas.get(id) || null;
  }

  /**
   * Check if a chart type is registered
   */
  has(id) {
    return this.generators.has(id);
  }

  /**
   * Get all registered chart types
   */
  getTypes() {
    return Array.from(this.generators.keys());
  }

  /**
   * Get all chart metadata
   */
  getAllMetadata() {
    return Array.from(this.metadata.values());
  }

  /**
   * Get chart types grouped by category
   */
  getTypesByCategory() {
    const categories = {};
    for (const [id, meta] of this.metadata) {
      const category = meta.category || 'other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(meta);
    }
    return categories;
  }

  /**
   * Create a generator instance for a chart type
   * @param {string} id - Chart type identifier
   * @param {Object} config - Chart configuration
   * @returns {Object} Generator instance
   */
  createGenerator(id, config = {}) {
    const Generator = this.getGenerator(id);
    
    if (!Generator) {
      const error = new Error(`Unknown chart type: ${id}`);
      error.code = 'UNKNOWN_CHART_TYPE';
      error.chartType = id;
      error.availableTypes = this.getTypes();
      throw error;
    }

    // Handle both class and factory function patterns
    if (typeof Generator === 'function') {
      // Check if it's a class (has prototype with generate method)
      if (Generator.prototype && Generator.prototype.generate) {
        return new Generator(id, config);
      }
      // It's a factory function
      return Generator(id, config);
    }

    throw new Error(`Invalid generator for chart type: ${id}`);
  }

  /**
   * Generate a chart spec
   * @param {string} id - Chart type identifier
   * @param {Object} config - Chart configuration
   * @param {Array} data - Data to visualize
   * @returns {Object} Vega/Vega-Lite spec
   */
  generate(id, config, data) {
    const startTime = Date.now();
    
    try {
      const generator = this.createGenerator(id, config);
      const spec = generator.generate(data);
      
      const duration = Date.now() - startTime;
      logger.info('Chart spec generated', {
        event: 'chart_generated',
        chartType: id,
        duration,
        dataPoints: data?.length || 0
      });
      
      return spec;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Chart generation failed', {
        event: 'chart_generation_error',
        chartType: id,
        duration,
        error: error.message,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * Generate a Kibana-compatible Vega spec with Elasticsearch data source
   * @param {string} id - Chart type identifier
   * @param {Object} config - Chart configuration
   * @param {Object} elasticConfig - Elasticsearch configuration
   * @returns {Object} Vega/Vega-Lite spec for Kibana
   */
  generateForKibana(id, config, elasticConfig) {
    const startTime = Date.now();
    
    try {
      const generator = this.createGenerator(id, config);
      
      if (typeof generator.generateForKibana !== 'function') {
        throw new Error(`Chart type ${id} does not support Kibana generation`);
      }
      
      const spec = generator.generateForKibana(elasticConfig);
      
      const duration = Date.now() - startTime;
      logger.info('Kibana chart spec generated', {
        event: 'kibana_chart_generated',
        chartType: id,
        duration,
        index: elasticConfig?.index
      });
      
      return spec;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Kibana chart generation failed', {
        event: 'kibana_chart_generation_error',
        chartType: id,
        duration,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get visualization types formatted for frontend dropdown
   * Compatible with VegaSpecGenerator.getVisualizationTypes()
   * @returns {Array} Array of visualization type objects
   */
  getVisualizationTypes() {
    return Array.from(this.metadata.values()).map(meta => ({
      id: meta.id,
      name: meta.name,
      description: meta.description,
      category: meta.category,
      icon: meta.icon,
      helpText: meta.helpText || null,
      helpLink: meta.helpLink || null
    }));
  }

  /**
   * Get configuration schema for a chart type
   * Compatible with VegaSpecGenerator.getConfigSchema()
   * @param {string} id - Chart type identifier
   * @returns {Object|null} Configuration schema
   */
  getConfigSchema(id) {
    return this.schemas.get(id) || null;
  }

  /**
   * Get example configuration and data for a chart type
   * @param {string} id - Chart type identifier
   * @returns {Object|null} Example object with config and data
   */
  getExample(id) {
    // First check examples map
    if (this.examples.has(id)) {
      return this.examples.get(id);
    }
    
    // Try to get from generator's static property
    const Generator = this.getGenerator(id);
    if (Generator?.example) {
      return Generator.example;
    }
    
    return null;
  }

  /**
   * Validate a Vega/Vega-Lite specification
   * @param {Object} spec - The spec to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result with valid, errors, warnings
   */
  validate(spec, options = {}) {
    return VegaGeneratorBase.validate(spec, options);
  }
}

// Export singleton instance
export const chartRegistry = new ChartRegistry();

// Export class for testing
export { ChartRegistry };

export default chartRegistry;

