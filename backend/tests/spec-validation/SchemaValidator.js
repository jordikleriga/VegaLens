/**
 * Schema Validator - Tier 1
 *
 * Validates Vega-Lite specs against the official JSON schema and
 * tests compilation with the vega-lite library.
 */

import Ajv from 'ajv';
import * as vegaLite from 'vega-lite';
import * as vega from 'vega';

export class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateFormats: false
    });
    this.vegaLiteSchema = null;
    this.vegaSchema = null;
    this.schemaLoaded = false;
  }

  /**
   * Load the Vega-Lite schema from the official source
   */
  async loadSchemas() {
    if (this.schemaLoaded) return;

    try {
      // Fetch Vega-Lite v5 schema
      const vlResponse = await fetch('https://vega.github.io/schema/vega-lite/v5.json');
      if (vlResponse.ok) {
        this.vegaLiteSchema = await vlResponse.json();
        console.log('[SchemaValidator] Loaded Vega-Lite v5 schema');
      }
    } catch (e) {
      console.warn('[SchemaValidator] Could not fetch remote schema, using compile-only validation');
    }

    this.schemaLoaded = true;
  }

  /**
   * Validate a spec against the JSON schema
   * @param {Object} spec - Vega-Lite specification
   * @returns {Object} Validation result
   */
  validateSchema(spec) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // If schema loaded, validate against it
    if (this.vegaLiteSchema) {
      const validate = this.ajv.compile(this.vegaLiteSchema);
      const valid = validate(spec);

      if (!valid) {
        result.valid = false;
        result.errors = validate.errors.map(err => ({
          path: err.instancePath || err.dataPath,
          message: err.message,
          params: err.params
        }));
      }
    }

    return result;
  }

  /**
   * Check if spec is full Vega (not Vega-Lite)
   */
  isFullVegaSpec(spec) {
    return spec.$schema?.includes('vega/v5') && !spec.$schema?.includes('vega-lite');
  }

  /**
   * Compile spec with Vega-Lite to catch semantic errors
   * For full Vega specs, just parse directly with Vega
   * @param {Object} spec - Vega or Vega-Lite specification
   * @returns {Object} Compilation result
   */
  compileSpec(spec) {
    const result = {
      valid: true,
      vegaSpec: null,
      errors: [],
      warnings: [],
      isVegaSpec: false
    };

    // Handle full Vega specs directly
    if (this.isFullVegaSpec(spec)) {
      result.isVegaSpec = true;
      result.vegaSpec = spec;

      try {
        vega.parse(spec);
      } catch (vegaError) {
        result.valid = false;
        result.errors.push({
          stage: 'vega-parse',
          message: vegaError.message
        });
      }

      return result;
    }

    // Vega-Lite: compile then parse
    try {
      const compiled = vegaLite.compile(spec);
      result.vegaSpec = compiled.spec;

      // Capture any warnings
      if (compiled.warnings && compiled.warnings.length > 0) {
        result.warnings = compiled.warnings;
      }

      // Try to parse with Vega to ensure it's fully valid
      try {
        vega.parse(compiled.spec);
      } catch (vegaError) {
        result.valid = false;
        result.errors.push({
          stage: 'vega-parse',
          message: vegaError.message
        });
      }

    } catch (compileError) {
      result.valid = false;
      result.errors.push({
        stage: 'vega-lite-compile',
        message: compileError.message
      });
    }

    return result;
  }

  /**
   * Full validation: schema + compilation
   * @param {Object} spec - Vega-Lite specification
   * @returns {Object} Combined validation result
   */
  async validate(spec) {
    await this.loadSchemas();

    const schemaResult = this.validateSchema(spec);
    const compileResult = this.compileSpec(spec);

    return {
      valid: schemaResult.valid && compileResult.valid,
      schemaValidation: schemaResult,
      compilation: compileResult,
      summary: {
        schemaErrors: schemaResult.errors.length,
        compileErrors: compileResult.errors.length,
        warnings: [...schemaResult.warnings, ...compileResult.warnings]
      }
    };
  }

  /**
   * Quick validation without schema fetch (compile-only)
   * @param {Object} spec - Vega-Lite specification
   * @returns {Object} Compilation result
   */
  validateQuick(spec) {
    return this.compileSpec(spec);
  }

  /**
   * Batch validate multiple specs
   * @param {Array<{name: string, spec: Object}>} specs - Array of named specs
   * @returns {Object} Batch validation results
   */
  async validateBatch(specs) {
    await this.loadSchemas();

    const results = {
      total: specs.length,
      passed: 0,
      failed: 0,
      details: []
    };

    for (const { name, spec } of specs) {
      const result = await this.validate(spec);

      results.details.push({
        name,
        valid: result.valid,
        errors: [
          ...result.schemaValidation.errors,
          ...result.compilation.errors
        ],
        warnings: result.summary.warnings
      });

      if (result.valid) {
        results.passed++;
      } else {
        results.failed++;
      }
    }

    return results;
  }
}

export default SchemaValidator;
