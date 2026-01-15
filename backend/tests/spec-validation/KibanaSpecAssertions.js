/**
 * Kibana Spec Assertions - Tier 1
 *
 * Custom structural assertions for Kibana-specific Vega specs.
 * These go beyond JSON schema to validate Kibana integration requirements.
 */

export class KibanaSpecAssertions {
  constructor() {
    this.assertions = [];
    this.results = [];
  }

  /**
   * Reset assertion results
   */
  reset() {
    this.results = [];
  }

  /**
   * Add assertion result
   */
  addResult(name, passed, message = '') {
    this.results.push({ name, passed, message });
  }

  /**
   * Run all assertions on a spec
   * @param {Object} spec - Vega-Lite specification
   * @returns {Object} Assertion results
   */
  assertAll(spec) {
    this.reset();

    // Run all assertions
    this.assertHasSchema(spec);
    this.assertHasData(spec);
    this.assertKibanaDataSource(spec);
    this.assertHasEncoding(spec);
    this.assertHasMark(spec);
    this.assertNoUndefinedFields(spec);
    this.assertValidAggregations(spec);
    this.assertColorScheme(spec);

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    return {
      passed,
      failed,
      total: this.results.length,
      valid: failed === 0,
      details: this.results
    };
  }

  /**
   * Detect if spec is full Vega (not Vega-Lite)
   */
  isFullVegaSpec(spec) {
    return spec.$schema?.includes('vega/v5') && !spec.$schema?.includes('vega-lite');
  }

  /**
   * Assert spec has valid $schema
   */
  assertHasSchema(spec) {
    const hasSchema = spec.$schema &&
      (spec.$schema.includes('vega-lite') || spec.$schema.includes('vega/'));

    this.addResult(
      'hasSchema',
      hasSchema,
      hasSchema ? 'Valid schema reference' : 'Missing or invalid $schema'
    );
  }

  /**
   * Assert spec has data configuration
   */
  assertHasData(spec) {
    // Check for top-level data OR data in layers
    const hasTopLevelData = spec.data !== undefined;
    const hasLayerData = spec.layer?.some(l => l.data !== undefined);
    const hasData = hasTopLevelData || hasLayerData;

    this.addResult(
      'hasData',
      hasData,
      hasData ? 'Data configuration present' : 'Missing data configuration'
    );
  }

  /**
   * Assert Kibana-specific data source format
   */
  assertKibanaDataSource(spec) {
    if (!spec.data?.url) {
      // Not a Kibana ES data source, skip
      this.addResult('kibanaDataSource', true, 'N/A - inline data');
      return;
    }

    const url = spec.data.url;
    const checks = {
      hasIndex: url.index !== undefined,
      hasBody: url.body !== undefined,
      hasContext: url['%context%'] === true,
      hasTimefield: url['%timefield%'] !== undefined
    };

    const allPassed = checks.hasIndex && checks.hasBody;
    const messages = [];

    if (!checks.hasIndex) messages.push('missing index');
    if (!checks.hasBody) messages.push('missing body (query)');
    if (!checks.hasContext) messages.push('missing %context% (dashboard filters)');
    if (!checks.hasTimefield) messages.push('missing %timefield% (time picker)');

    this.addResult(
      'kibanaDataSource',
      allPassed,
      allPassed ? 'Valid Kibana data source' : `Invalid: ${messages.join(', ')}`
    );

    // Validate aggregation structure if present
    if (url.body?.aggs) {
      this.assertAggregationStructure(url.body.aggs);
    }
  }

  /**
   * Assert valid aggregation structure
   */
  assertAggregationStructure(aggs) {
    const hasAggs = Object.keys(aggs).length > 0;

    if (!hasAggs) {
      this.addResult('aggregationStructure', false, 'Empty aggregations object');
      return;
    }

    // Check for primary aggregation
    const primaryKey = Object.keys(aggs)[0];
    const primary = aggs[primaryKey];

    // Valid aggregation types:
    // - Bucket aggregations: terms, date_histogram, histogram, multi_terms, range, composite
    // - Metric aggregations: top_hits, avg, sum, min, max, cardinality, value_count, stats, extended_stats, percentiles
    const bucketAggTypes = ['terms', 'date_histogram', 'histogram', 'multi_terms', 'range', 'composite'];
    const metricAggTypes = ['top_hits', 'avg', 'sum', 'min', 'max', 'cardinality', 'value_count', 'stats', 'extended_stats', 'percentiles', 'metric'];
    const allAggTypes = [...bucketAggTypes, ...metricAggTypes];
    const hasValidType = allAggTypes.some(type => primary[type] !== undefined);

    this.addResult(
      'aggregationStructure',
      hasValidType,
      hasValidType ? `Valid aggregation: ${primaryKey}` : 'Invalid aggregation structure'
    );
  }

  /**
   * Assert spec has encoding (for Vega-Lite) or scales (for Vega)
   */
  assertHasEncoding(spec) {
    // Full Vega specs use scales instead of encoding
    if (this.isFullVegaSpec(spec)) {
      // Some simple Vega specs (metric, wordcloud) may have marks but no scales
      // Allow specs with marks array OR scales array
      const hasScales = spec.scales && spec.scales.length > 0;
      const hasMarks = spec.marks && spec.marks.length > 0;
      const isValid = hasScales || hasMarks;
      this.addResult(
        'hasEncoding',
        isValid,
        isValid ? (hasScales ? 'Scales present (Vega spec)' : 'Marks present (Vega spec)') : 'Missing scales configuration'
      );
      return;
    }

    const hasEncoding = this.findEncoding(spec) !== null;

    this.addResult(
      'hasEncoding',
      hasEncoding,
      hasEncoding ? 'Encoding present' : 'Missing encoding configuration'
    );
  }

  /**
   * Find encoding in spec (handles layers, facets, etc.)
   */
  findEncoding(spec) {
    if (spec.encoding) return spec.encoding;
    if (spec.layer?.[0]) return this.findEncoding(spec.layer[0]);
    if (spec.spec) return this.findEncoding(spec.spec);
    if (spec.vconcat?.[0]) return this.findEncoding(spec.vconcat[0]);
    if (spec.hconcat?.[0]) return this.findEncoding(spec.hconcat[0]);
    return null;
  }

  /**
   * Assert spec has mark definition (Vega-Lite) or marks array (Vega)
   */
  assertHasMark(spec) {
    // Full Vega specs use marks array
    if (this.isFullVegaSpec(spec)) {
      const hasMarks = spec.marks && spec.marks.length > 0;
      this.addResult(
        'hasMark',
        hasMarks,
        hasMarks ? 'Marks array present (Vega spec)' : 'Missing marks array'
      );
      return;
    }

    const hasMark = this.findMark(spec) !== null;

    this.addResult(
      'hasMark',
      hasMark,
      hasMark ? 'Mark definition present' : 'Missing mark definition'
    );
  }

  /**
   * Find mark in spec
   */
  findMark(spec) {
    if (spec.mark) return spec.mark;
    if (spec.layer?.[0]) return this.findMark(spec.layer[0]);
    if (spec.spec) return this.findMark(spec.spec);
    return null;
  }

  /**
   * Assert no undefined or null values in critical fields
   */
  assertNoUndefinedFields(spec) {
    const issues = [];

    // Check encoding fields
    const encoding = this.findEncoding(spec);
    if (encoding) {
      for (const [channel, enc] of Object.entries(encoding)) {
        if (enc === undefined || enc === null) {
          issues.push(`encoding.${channel} is ${enc}`);
        } else if (enc.field === undefined && enc.value === undefined && enc.datum === undefined && enc.aggregate === undefined) {
          // Field-based encoding should have field, value, datum, or aggregate (like 'count' which doesn't need a field)
          if (!['tooltip'].includes(channel)) {
            issues.push(`encoding.${channel} missing field/value/datum`);
          }
        }
      }
    }

    // Check transform calculate expressions
    // Note: 'flatten', 'fold', 'pivot', 'aggregate', 'window' transforms can have 'as' without 'calculate'
    if (spec.transform) {
      spec.transform.forEach((t, i) => {
        const hasAs = t.as !== undefined;
        const hasCalculate = t.calculate !== undefined;
        const isStructuralTransform = t.flatten !== undefined || t.fold !== undefined ||
          t.pivot !== undefined || t.aggregate !== undefined || t.window !== undefined ||
          t.density !== undefined || t.quantile !== undefined || t.regression !== undefined ||
          t.loess !== undefined || t.lookup !== undefined;

        if (hasAs && !hasCalculate && !isStructuralTransform) {
          issues.push(`transform[${i}] has 'as' but no 'calculate'`);
        }
      });
    }

    const passed = issues.length === 0;
    this.addResult(
      'noUndefinedFields',
      passed,
      passed ? 'No undefined fields' : `Issues: ${issues.join('; ')}`
    );
  }

  /**
   * Assert valid aggregations in data URL
   */
  assertValidAggregations(spec) {
    if (!spec.data?.url?.body?.aggs) {
      this.addResult('validAggregations', true, 'N/A - no aggregations');
      return;
    }

    const aggs = spec.data.url.body.aggs;
    const issues = [];

    const checkAgg = (agg, path) => {
      if (!agg) return;

      for (const [name, config] of Object.entries(agg)) {
        // Check for undefined field references
        const aggType = Object.keys(config).find(k =>
          ['terms', 'date_histogram', 'histogram', 'avg', 'sum', 'min', 'max', 'cardinality'].includes(k)
        );

        if (aggType && config[aggType]?.field === undefined) {
          issues.push(`${path}.${name}.${aggType}.field is undefined`);
        }

        // Recurse into nested aggs
        if (config.aggs) {
          checkAgg(config.aggs, `${path}.${name}.aggs`);
        }
      }
    };

    checkAgg(aggs, 'aggs');

    const passed = issues.length === 0;
    this.addResult(
      'validAggregations',
      passed,
      passed ? 'Valid aggregations' : `Issues: ${issues.join('; ')}`
    );
  }

  /**
   * Assert color scheme is valid
   */
  assertColorScheme(spec) {
    const encoding = this.findEncoding(spec);
    if (!encoding?.color?.scale?.scheme) {
      this.addResult('colorScheme', true, 'N/A - no color scheme');
      return;
    }

    const validSchemes = [
      'category10', 'category20', 'tableau10', 'tableau20',
      'dark2', 'paired', 'set1', 'set2', 'set3',
      'accent', 'pastel1', 'pastel2',
      'blues', 'greens', 'greys', 'oranges', 'purples', 'reds',
      'viridis', 'magma', 'inferno', 'plasma', 'turbo',
      'rainbow', 'sinebow'
    ];

    const scheme = encoding.color.scale.scheme;
    const isValid = validSchemes.includes(scheme);

    this.addResult(
      'colorScheme',
      isValid,
      isValid ? `Valid scheme: ${scheme}` : `Unknown scheme: ${scheme}`
    );
  }

  /**
   * Get summary of all results
   */
  getSummary() {
    const passed = this.results.filter(r => r.passed);
    const failed = this.results.filter(r => !r.passed);

    return {
      passed: passed.map(r => r.name),
      failed: failed.map(r => ({ name: r.name, message: r.message })),
      total: this.results.length,
      passRate: this.results.length > 0
        ? (passed.length / this.results.length * 100).toFixed(1) + '%'
        : 'N/A'
    };
  }
}

export default KibanaSpecAssertions;
