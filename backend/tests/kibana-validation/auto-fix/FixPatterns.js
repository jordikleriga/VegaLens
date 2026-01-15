/**
 * Fix Patterns
 * Catalog of common fixes for Vega spec issues
 */

export class FixPatterns {
  /**
   * Get all available fix patterns
   */
  static getAll() {
    return {
      'add-schema': this.addSchema,
      'add-format-property': this.addFormatProperty,
      'add-keyword-subfield': this.addKeywordSubfield,
      'fix-flatten-transform': this.fixFlattenTransform,
      'add-key-mapping': this.addKeyMapping,
      'fix-color-scheme': this.fixColorScheme,
      'add-axis-styling': this.addAxisStyling,
      'use-container-sizing': this.useContainerSizing,
      'add-kibana-context': this.addKibanaContext
    };
  }

  /**
   * Fix: Add schema
   */
  static addSchema(spec, issue) {
    if (!spec.$schema) {
      spec.$schema = 'https://vega.github.io/schema/vega/v5.json';
    }
    return spec;
  }

  /**
   * Fix: Add format property for ES aggregations
   */
  static addFormatProperty(spec, issue) {
    const dataIndex = issue.dataIndex;
    const dataArray = Array.isArray(spec.data) ? spec.data : [spec.data];
    const data = dataArray[dataIndex];

    if (data && data.url && typeof data.url === 'object') {
      // Infer format property from aggregation structure
      const aggKeys = Object.keys(data.url.body?.aggs || {});
      if (aggKeys.length > 0) {
        const primaryAgg = aggKeys[0];
        data.format = data.format || {};
        data.format.property = `aggregations.${primaryAgg}.buckets`;
      }
    }

    return spec;
  }

  /**
   * Fix: Add .keyword to text field
   */
  static addKeywordSubfield(spec, issue) {
    const dataIndex = issue.dataIndex;
    const fieldName = issue.field;
    const dataArray = Array.isArray(spec.data) ? spec.data : [spec.data];
    const data = dataArray[dataIndex];

    if (data?.url?.body?.aggs) {
      // Find and fix the field in aggregations
      const aggs = data.url.body.aggs;
      for (const [key, agg] of Object.entries(aggs)) {
        if (agg.terms?.field === fieldName) {
          agg.terms.field = `${fieldName}.keyword`;
        }

        // Check nested aggregations
        if (agg.aggs) {
          for (const [nestedKey, nestedAgg] of Object.entries(agg.aggs)) {
            if (nestedAgg.terms?.field === fieldName) {
              nestedAgg.terms.field = `${fieldName}.keyword`;
            }
          }
        }
      }
    }

    return spec;
  }

  /**
   * Fix: Fix flatten transform structure
   */
  static fixFlattenTransform(spec, issue) {
    const dataIndex = issue.dataIndex;
    const transformIndex = issue.transformIndex;
    const dataArray = Array.isArray(spec.data) ? spec.data : [spec.data];
    const data = dataArray[dataIndex];

    if (data?.transform?.[transformIndex]) {
      const transform = data.transform[transformIndex];

      // Fix flatten -> fields
      if (transform.flatten && !transform.fields) {
        transform.fields = Array.isArray(transform.flatten)
          ? transform.flatten
          : [transform.flatten];
        delete transform.flatten;
      }

      // Ensure type is set
      if (!transform.type) {
        transform.type = 'flatten';
      }
    }

    return spec;
  }

  /**
   * Fix: Add key mapping transform
   */
  static addKeyMapping(spec, issue) {
    const dataIndex = issue.dataIndex;
    const dataArray = Array.isArray(spec.data) ? spec.data : [spec.data];
    const data = dataArray[dataIndex];

    if (data) {
      data.transform = data.transform || [];

      // Add transform to map ES bucket key to category field
      data.transform.unshift({
        type: 'formula',
        expr: 'datum.key_as_string || datum.key',
        as: 'category'
      });
    }

    return spec;
  }

  /**
   * Fix: Replace invalid color scheme
   */
  static fixColorScheme(spec, issue) {
    const invalidScheme = issue.invalidScheme;
    const scaleName = issue.scale;

    // Map invalid schemes to valid ones
    const schemeMapping = {
      'category': 'category10',
      'tableau': 'tableau10',
      'blue': 'blues',
      'green': 'greens',
      'red': 'reds',
      'orange': 'oranges',
      'purple': 'purples',
      'grey': 'greys',
      'gray': 'greys'
    };

    const replacement = schemeMapping[invalidScheme.toLowerCase()] || 'category10';

    // Find and fix the scale
    if (spec.scales) {
      for (const scale of spec.scales) {
        if (scale.name === scaleName && scale.range?.scheme === invalidScheme) {
          scale.range.scheme = replacement;
        }
      }
    }

    return spec;
  }

  /**
   * Fix: Add axis styling for Kibana theme
   */
  static addAxisStyling(spec, issue) {
    spec.config = spec.config || {};
    spec.config.axis = {
      labelColor: '#DFE5EF',
      titleColor: '#DFE5EF',
      gridColor: '#2b2f38',
      domainColor: '#343741',
      tickColor: '#343741',
      labelFont: 'Inter, system-ui, sans-serif',
      titleFont: 'Inter, system-ui, sans-serif'
    };

    // Also add legend styling
    spec.config.legend = {
      labelColor: '#DFE5EF',
      titleColor: '#DFE5EF',
      labelFont: 'Inter, system-ui, sans-serif',
      titleFont: 'Inter, system-ui, sans-serif'
    };

    // Add background
    spec.background = spec.background || '#1d1e24';

    return spec;
  }

  /**
   * Fix: Use container sizing instead of fixed dimensions
   */
  static useContainerSizing(spec, issue) {
    if (issue.rule === 'fixed-width') {
      spec.width = 'container';
    }

    if (issue.rule === 'fixed-height') {
      spec.height = 'container';
    }

    // For Vega-Lite, use autosize
    if (spec.$schema?.includes('vega-lite')) {
      spec.autosize = {
        type: 'fit',
        contains: 'padding'
      };
    }

    return spec;
  }

  /**
   * Fix: Add Kibana context for time-based queries
   */
  static addKibanaContext(spec, issue) {
    const dataIndex = issue.dataIndex;
    const dataArray = Array.isArray(spec.data) ? spec.data : [spec.data];
    const data = dataArray[dataIndex];

    if (data?.url && typeof data.url === 'object') {
      data.url['%context%'] = true;
      data.url['%timefield%'] = '@timestamp';
    }

    return spec;
  }

  /**
   * Apply a fix to a spec
   */
  static applyFix(spec, issue) {
    const fixes = this.getAll();
    const fixFunction = fixes[issue.fix];

    if (!fixFunction) {
      throw new Error(`Unknown fix pattern: ${issue.fix}`);
    }

    return fixFunction(spec, issue);
  }

  /**
   * Apply multiple fixes to a spec
   */
  static applyMultipleFixes(spec, issues) {
    let fixedSpec = JSON.parse(JSON.stringify(spec)); // Deep clone

    for (const issue of issues) {
      if (issue.fix) {
        try {
          fixedSpec = this.applyFix(fixedSpec, issue);
        } catch (error) {
          console.error(`[FixPatterns] Failed to apply fix "${issue.fix}":`, error.message);
        }
      }
    }

    return fixedSpec;
  }

  /**
   * Get fix description
   */
  static getFixDescription(fixName) {
    const descriptions = {
      'add-schema': 'Add missing $schema property',
      'add-format-property': 'Add format.property for ES aggregation results',
      'add-keyword-subfield': 'Add .keyword subfield to text field',
      'fix-flatten-transform': 'Fix flatten transform structure',
      'add-key-mapping': 'Add transform to map ES bucket keys',
      'fix-color-scheme': 'Replace invalid color scheme with valid alternative',
      'add-axis-styling': 'Add Kibana theme-compatible axis styling',
      'use-container-sizing': 'Use container-based sizing instead of fixed dimensions',
      'add-kibana-context': 'Add Kibana time context integration'
    };

    return descriptions[fixName] || 'Unknown fix';
  }
}

export default FixPatterns;
