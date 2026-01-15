/**
 * Spec Validator
 * Validates Vega specs for common issues that cause Kibana rendering failures
 */

export class SpecValidator {
  constructor(options = {}) {
    this.strict = options.strict !== false;
  }

  /**
   * Validate a Vega spec
   * @param {Object} spec - Vega or Vega-Lite spec
   * @returns {Object} Validation result with issues array
   */
  validate(spec) {
    const issues = [];

    // Run all validation rules
    issues.push(...this.validateSchema(spec));
    issues.push(...this.validateData(spec));
    issues.push(...this.validateTransforms(spec));
    issues.push(...this.validateScales(spec));
    issues.push(...this.validateAxes(spec));
    issues.push(...this.validateMarks(spec));
    issues.push(...this.validateDimensions(spec));
    issues.push(...this.validateKibanaContext(spec));
    issues.push(...this.validateFieldMappings(spec));
    issues.push(...this.validateColorSchemes(spec));

    return {
      valid: issues.length === 0,
      issues,
      spec
    };
  }

  /**
   * Rule 1: Validate schema
   */
  validateSchema(spec) {
    const issues = [];

    if (!spec.$schema) {
      issues.push({
        rule: 'missing-schema',
        severity: 'warning',
        message: 'Missing $schema property',
        fix: 'add-schema'
      });
    }

    return issues;
  }

  /**
   * Rule 2: Validate data configuration
   */
  validateData(spec) {
    const issues = [];

    if (!spec.data) {
      issues.push({
        rule: 'missing-data',
        severity: 'error',
        message: 'Missing data property',
        fix: null
      });
      return issues;
    }

    const dataArray = Array.isArray(spec.data) ? spec.data : [spec.data];

    for (const [index, data] of dataArray.entries()) {
      // Check for Elasticsearch URL structure
      if (data.url && typeof data.url === 'object') {
        // Validate index field
        if (!data.url.index) {
          issues.push({
            rule: 'missing-es-index',
            severity: 'error',
            message: `Data source ${index} missing index field`,
            fix: null,
            dataIndex: index
          });
        }

        // Validate aggregation structure
        if (data.url.body?.aggs) {
          const aggIssues = this.validateAggregations(data.url.body.aggs, index);
          issues.push(...aggIssues);
        }
      }

      // Check format property for ES data
      if (data.url && typeof data.url === 'object' && !data.format?.property) {
        issues.push({
          rule: 'missing-format-property',
          severity: 'warning',
          message: `Data source ${index} missing format.property for ES aggregation results`,
          fix: 'add-format-property',
          dataIndex: index
        });
      }
    }

    return issues;
  }

  /**
   * Rule 3: Validate aggregations
   */
  validateAggregations(aggs, dataIndex) {
    const issues = [];

    // Check for fielddata issues (text fields without .keyword)
    const aggValues = Object.values(aggs);
    for (const agg of aggValues) {
      if (agg.terms?.field && !agg.terms.field.includes('.keyword')) {
        // Check if it's a known text field that needs .keyword
        const knownTextFields = ['category', 'name', 'parent', 'subcategory', 'status', 'region', 'gender', 'day_of_week'];
        if (knownTextFields.some(f => agg.terms.field.includes(f))) {
          issues.push({
            rule: 'missing-keyword-subfield',
            severity: 'warning',
            message: `Terms aggregation on text field "${agg.terms.field}" may need .keyword`,
            fix: 'add-keyword-subfield',
            dataIndex,
            field: agg.terms.field
          });
        }
      }
    }

    return issues;
  }

  /**
   * Rule 4: Validate transforms
   */
  validateTransforms(spec) {
    const issues = [];

    const dataArray = Array.isArray(spec.data) ? spec.data : spec.data ? [spec.data] : [];

    for (const [index, data] of dataArray.entries()) {
      if (data.transform) {
        for (const [tIndex, transform] of data.transform.entries()) {
          // Check for missing type field
          if (!transform.type) {
            issues.push({
              rule: 'missing-transform-type',
              severity: 'error',
              message: `Transform ${tIndex} in data ${index} missing type field`,
              fix: null,
              dataIndex: index,
              transformIndex: tIndex,
              transform
            });
          }

          // Check for missing calculate field mappings
          if (transform.type === 'formula' && !transform.as) {
            issues.push({
              rule: 'missing-formula-as',
              severity: 'error',
              message: `Formula transform in data ${index} missing "as" field`,
              fix: null,
              dataIndex: index,
              transformIndex: tIndex
            });
          }

          // Check flatten transform structure
          if (transform.type === 'flatten') {
            if (!transform.fields && !transform.flatten) {
              issues.push({
                rule: 'invalid-flatten-transform',
                severity: 'error',
                message: `Flatten transform in data ${index} missing fields property`,
                fix: 'fix-flatten-transform',
                dataIndex: index,
                transformIndex: tIndex
              });
            }
          }
        }
      }

      // Check if ES data needs calculate transforms for key mapping
      if (data.url && typeof data.url === 'object' && data.format?.property?.includes('buckets')) {
        const hasKeyMapping = data.transform?.some(t =>
          t.type === 'formula' && (t.expr?.includes('datum.key') || t.expr?.includes('key_as_string'))
        );

        if (!hasKeyMapping) {
          issues.push({
            rule: 'missing-key-mapping',
            severity: 'warning',
            message: `Data source ${index} may need transform to map ES bucket keys`,
            fix: 'add-key-mapping',
            dataIndex: index
          });
        }
      }
    }

    return issues;
  }

  /**
   * Rule 5: Validate scales
   */
  validateScales(spec) {
    const issues = [];

    if (spec.scales) {
      for (const scale of spec.scales) {
        // Check for invalid color schemes
        if (scale.type === 'ordinal' && scale.range?.scheme) {
          const validSchemes = [
            'category10', 'category20', 'tableau10', 'accent', 'dark2', 'paired',
            'pastel1', 'pastel2', 'set1', 'set2', 'set3', 'blues', 'greens', 'greys',
            'oranges', 'purples', 'reds', 'viridis', 'inferno', 'magma', 'plasma',
            'cividis', 'turbo', 'blueorange', 'redblue', 'redgrey', 'spectral'
          ];

          if (!validSchemes.includes(scale.range.scheme)) {
            issues.push({
              rule: 'invalid-color-scheme',
              severity: 'warning',
              message: `Invalid color scheme "${scale.range.scheme}"`,
              fix: 'fix-color-scheme',
              scale: scale.name,
              invalidScheme: scale.range.scheme
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Rule 6: Validate axes styling
   */
  validateAxes(spec) {
    const issues = [];

    // Check if config.axis exists for Kibana dark theme compatibility
    if (!spec.config?.axis) {
      issues.push({
        rule: 'missing-axis-styling',
        severity: 'info',
        message: 'Missing axis styling configuration for Kibana theme',
        fix: 'add-axis-styling'
      });
    }

    return issues;
  }

  /**
   * Rule 7: Validate marks
   */
  validateMarks(spec) {
    const issues = [];

    if (!spec.marks || spec.marks.length === 0) {
      issues.push({
        rule: 'missing-marks',
        severity: 'error',
        message: 'Missing marks array',
        fix: null
      });
    }

    return issues;
  }

  /**
   * Rule 8: Validate dimensions
   */
  validateDimensions(spec) {
    const issues = [];

    // Check for fixed dimensions (should be 'container' for Kibana)
    if (typeof spec.width === 'number') {
      issues.push({
        rule: 'fixed-width',
        severity: 'warning',
        message: 'Spec uses fixed width instead of container sizing',
        fix: 'use-container-sizing',
        currentValue: spec.width
      });
    }

    if (typeof spec.height === 'number') {
      issues.push({
        rule: 'fixed-height',
        severity: 'warning',
        message: 'Spec uses fixed height instead of container sizing',
        fix: 'use-container-sizing',
        currentValue: spec.height
      });
    }

    return issues;
  }

  /**
   * Rule 9: Validate Kibana context
   */
  validateKibanaContext(spec) {
    const issues = [];

    const dataArray = Array.isArray(spec.data) ? spec.data : spec.data ? [spec.data] : [];

    for (const [index, data] of dataArray.entries()) {
      // Check for timeseries data without Kibana context
      if (data.url?.body?.query || data.url?.index?.includes('time')) {
        if (!data.url['%context%']) {
          issues.push({
            rule: 'missing-kibana-context',
            severity: 'info',
            message: `Data source ${index} may benefit from Kibana time context`,
            fix: 'add-kibana-context',
            dataIndex: index
          });
        }
      }
    }

    return issues;
  }

  /**
   * Rule 10: Validate field mappings
   */
  validateFieldMappings(spec) {
    const issues = [];

    // Check if encoding fields exist in data transforms
    if (spec.encoding) {
      const encodingFields = this.extractEncodingFields(spec.encoding);
      const dataFields = this.extractDataFields(spec.data);

      for (const field of encodingFields) {
        if (!dataFields.has(field) && !field.startsWith('datum.')) {
          issues.push({
            rule: 'unmapped-encoding-field',
            severity: 'warning',
            message: `Encoding field "${field}" not found in data transforms`,
            fix: null,
            field
          });
        }
      }
    }

    return issues;
  }

  /**
   * Rule 11: Validate color schemes
   */
  validateColorSchemes(spec) {
    const issues = [];

    // Already handled in validateScales
    return issues;
  }

  /**
   * Extract fields from encoding
   */
  extractEncodingFields(encoding) {
    const fields = new Set();

    for (const channel of Object.values(encoding)) {
      if (channel.field) {
        fields.add(channel.field);
      }
    }

    return fields;
  }

  /**
   * Extract fields from data transforms
   */
  extractDataFields(data) {
    const fields = new Set();

    const dataArray = Array.isArray(data) ? data : data ? [data] : [];

    for (const d of dataArray) {
      if (d.transform) {
        for (const transform of d.transform) {
          if (transform.as) {
            if (Array.isArray(transform.as)) {
              transform.as.forEach(f => fields.add(f));
            } else {
              fields.add(transform.as);
            }
          }
        }
      }
    }

    return fields;
  }

  /**
   * Get fixable issues
   */
  getFixableIssues(issues) {
    return issues.filter(issue => issue.fix !== null);
  }

  /**
   * Get critical issues (errors)
   */
  getCriticalIssues(issues) {
    return issues.filter(issue => issue.severity === 'error');
  }
}

export default SpecValidator;
