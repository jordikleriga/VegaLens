/**
 * Spec Fixer
 * Validates and auto-fixes Vega specs for Kibana compatibility
 */

import { SpecValidator } from './SpecValidator.js';
import { FixPatterns } from './FixPatterns.js';

export class SpecFixer {
  constructor(options = {}) {
    this.validator = new SpecValidator(options);
    this.autoFix = options.autoFix !== false;
    this.maxAttempts = options.maxAttempts || 3;
  }

  /**
   * Validate and optionally fix a spec
   * @param {Object} spec - Vega or Vega-Lite spec
   * @param {Object} options - Fixing options
   * @returns {Object} Result with validation and fix information
   */
  async validateAndFix(spec, options = {}) {
    const autoFix = options.autoFix !== undefined ? options.autoFix : this.autoFix;
    const result = {
      originalSpec: JSON.parse(JSON.stringify(spec)),
      fixedSpec: null,
      validation: null,
      fixes: [],
      success: false,
      attempts: 0
    };

    let currentSpec = JSON.parse(JSON.stringify(spec));
    let attempt = 0;

    while (attempt < this.maxAttempts) {
      attempt++;
      result.attempts = attempt;

      // Validate current spec
      const validation = this.validator.validate(currentSpec);
      result.validation = validation;

      console.log(`[SpecFixer] Validation attempt ${attempt}:`, {
        valid: validation.valid,
        issueCount: validation.issues.length,
        criticalCount: this.validator.getCriticalIssues(validation.issues).length
      });

      // If valid, we're done
      if (validation.valid) {
        result.fixedSpec = currentSpec;
        result.success = true;
        break;
      }

      // If no autofix, stop here
      if (!autoFix) {
        break;
      }

      // Get fixable issues
      const fixableIssues = this.validator.getFixableIssues(validation.issues);

      if (fixableIssues.length === 0) {
        console.log('[SpecFixer] No fixable issues found');
        break;
      }

      // Apply fixes
      console.log(`[SpecFixer] Applying ${fixableIssues.length} fixes...`);

      for (const issue of fixableIssues) {
        try {
          currentSpec = FixPatterns.applyFix(currentSpec, issue);
          result.fixes.push({
            rule: issue.rule,
            fix: issue.fix,
            description: FixPatterns.getFixDescription(issue.fix),
            success: true
          });

          console.log(`[SpecFixer] Applied fix: ${issue.fix}`);
        } catch (error) {
          result.fixes.push({
            rule: issue.rule,
            fix: issue.fix,
            description: FixPatterns.getFixDescription(issue.fix),
            success: false,
            error: error.message
          });

          console.error(`[SpecFixer] Fix failed: ${issue.fix}`, error.message);
        }
      }

      // Continue loop to re-validate
    }

    // Final validation
    if (!result.success) {
      result.fixedSpec = currentSpec;
      result.validation = this.validator.validate(currentSpec);
    }

    return result;
  }

  /**
   * Get a summary of validation issues
   */
  getIssueSummary(validation) {
    const issues = validation.issues || [];
    const summary = {
      total: issues.length,
      byRule: {},
      bySeverity: {
        error: 0,
        warning: 0,
        info: 0
      },
      fixable: 0
    };

    for (const issue of issues) {
      // Count by rule
      summary.byRule[issue.rule] = (summary.byRule[issue.rule] || 0) + 1;

      // Count by severity
      summary.bySeverity[issue.severity] = (summary.bySeverity[issue.severity] || 0) + 1;

      // Count fixable
      if (issue.fix) {
        summary.fixable++;
      }
    }

    return summary;
  }

  /**
   * Check if spec is Kibana-ready
   */
  isKibanaReady(spec) {
    const validation = this.validator.validate(spec);
    const criticalIssues = this.validator.getCriticalIssues(validation.issues);

    return {
      ready: criticalIssues.length === 0,
      criticalIssues: criticalIssues.length,
      totalIssues: validation.issues.length,
      validation
    };
  }

  /**
   * Batch validate and fix multiple specs
   */
  async validateAndFixBatch(specs, options = {}) {
    const results = [];

    for (const [index, spec] of specs.entries()) {
      console.log(`[SpecFixer] Processing spec ${index + 1}/${specs.length}...`);

      try {
        const result = await this.validateAndFix(spec, options);
        results.push({
          index,
          ...result
        });
      } catch (error) {
        results.push({
          index,
          success: false,
          error: error.message,
          originalSpec: spec
        });
      }
    }

    return results;
  }

  /**
   * Generate fix report
   */
  generateFixReport(result) {
    const report = {
      success: result.success,
      attempts: result.attempts,
      issuesSummary: this.getIssueSummary(result.validation),
      fixes: result.fixes,
      remainingIssues: result.validation?.issues || []
    };

    return report;
  }

  /**
   * Pretty print validation issues
   */
  printIssues(validation) {
    const issues = validation.issues || [];

    if (issues.length === 0) {
      console.log('✓ No issues found');
      return;
    }

    console.log(`\nFound ${issues.length} issue(s):\n`);

    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    const infos = issues.filter(i => i.severity === 'info');

    if (errors.length > 0) {
      console.log(`Errors (${errors.length}):`);
      errors.forEach(e => console.log(`  ✗ [${e.rule}] ${e.message}`));
      console.log('');
    }

    if (warnings.length > 0) {
      console.log(`Warnings (${warnings.length}):`);
      warnings.forEach(w => console.log(`  ! [${w.rule}] ${w.message}${w.fix ? ' (fixable)' : ''}`));
      console.log('');
    }

    if (infos.length > 0) {
      console.log(`Info (${infos.length}):`);
      infos.forEach(i => console.log(`  ℹ [${i.rule}] ${i.message}${i.fix ? ' (fixable)' : ''}`));
    }
  }

  /**
   * Print fix summary
   */
  printFixSummary(result) {
    const { fixes, success, validation } = result;

    console.log('\n' + '='.repeat(60));
    console.log('Fix Summary');
    console.log('='.repeat(60));

    console.log(`\nAttempts: ${result.attempts}`);
    console.log(`Success: ${success ? '✓' : '✗'}`);

    if (fixes.length > 0) {
      console.log(`\nApplied ${fixes.length} fix(es):`);
      fixes.forEach(f => {
        const status = f.success ? '✓' : '✗';
        console.log(`  ${status} ${f.description}`);
        if (!f.success) {
          console.log(`    Error: ${f.error}`);
        }
      });
    }

    if (validation?.issues?.length > 0) {
      console.log(`\nRemaining issues: ${validation.issues.length}`);
      const critical = this.validator.getCriticalIssues(validation.issues);
      if (critical.length > 0) {
        console.log(`Critical issues: ${critical.length}`);
      }
    }

    console.log('');
  }
}

export default SpecFixer;
