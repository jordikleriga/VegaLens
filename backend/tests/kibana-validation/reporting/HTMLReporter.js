/**
 * HTML Reporter
 * Generates rich HTML reports for visual regression test results
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class HTMLReporter {
  constructor(options = {}) {
    this.templatePath = options.templatePath || path.join(__dirname, 'templates/report.html');
  }

  /**
   * Generate HTML report
   * @param {Object} results - Test results
   * @param {string} outputPath - Output file path
   */
  async generate(results, outputPath) {
    console.log('[HTMLReporter] Generating HTML report...');

    // Load template
    const template = await this.loadTemplate();

    // Build HTML content
    const html = this.buildReport(template, results);

    // Write report
    await fs.writeFile(outputPath, html);

    console.log(`[HTMLReporter] Report generated: ${outputPath}`);
    return outputPath;
  }

  /**
   * Load HTML template
   */
  async loadTemplate() {
    try {
      return await fs.readFile(this.templatePath, 'utf-8');
    } catch (error) {
      // Use inline template if file doesn't exist
      return this.getInlineTemplate();
    }
  }

  /**
   * Build report from template and results
   */
  buildReport(template, results) {
    const data = {
      title: 'Kibana Visual Regression Test Report',
      runId: results.runId,
      timestamp: new Date(results.startTime).toLocaleString(),
      duration: this.formatDuration(results.duration),
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      passRate: results.passRate.toFixed(1),
      summaryCards: this.buildSummaryCards(results),
      failedTests: this.buildFailedTestsSection(results),
      allTests: this.buildAllTestsSection(results)
    };

    // Replace template variables
    let html = template;
    for (const [key, value] of Object.entries(data)) {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return html;
  }

  /**
   * Build summary cards HTML
   */
  buildSummaryCards(results) {
    const passRate = results.passRate;
    const statusClass = passRate === 100 ? 'success' : passRate >= 80 ? 'warning' : 'error';

    return `
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">Total Tests</div>
          <div class="summary-value">${results.total}</div>
        </div>
        <div class="summary-card success">
          <div class="summary-label">Passed</div>
          <div class="summary-value">${results.passed}</div>
        </div>
        <div class="summary-card ${results.failed > 0 ? 'error' : ''}">
          <div class="summary-label">Failed</div>
          <div class="summary-value">${results.failed}</div>
        </div>
        <div class="summary-card ${statusClass}">
          <div class="summary-label">Pass Rate</div>
          <div class="summary-value">${passRate.toFixed(1)}%</div>
        </div>
      </div>
    `;
  }

  /**
   * Build failed tests section
   */
  buildFailedTestsSection(results) {
    const failedTests = results.results.filter(r => !r.passed);

    if (failedTests.length === 0) {
      return '<div class="no-failures">✓ All tests passed!</div>';
    }

    let html = '<div class="failed-tests">';

    for (const test of failedTests) {
      html += `
        <div class="test-result failed">
          <div class="test-header">
            <span class="test-status">✗</span>
            <span class="test-name">${test.testId}</span>
            <span class="test-duration">${this.formatDuration(test.duration)}</span>
          </div>
          ${this.buildTestDetails(test)}
        </div>
      `;
    }

    html += '</div>';
    return html;
  }

  /**
   * Build all tests section
   */
  buildAllTestsSection(results) {
    let html = '<div class="all-tests">';

    for (const test of results.results) {
      const statusClass = test.passed ? 'passed' : 'failed';
      const statusIcon = test.passed ? '✓' : '✗';

      html += `
        <details class="test-result ${statusClass}">
          <summary class="test-header">
            <span class="test-status">${statusIcon}</span>
            <span class="test-name">${test.testId}</span>
            <span class="test-duration">${this.formatDuration(test.duration)}</span>
          </summary>
          ${this.buildTestDetails(test)}
        </details>
      `;
    }

    html += '</div>';
    return html;
  }

  /**
   * Build test details (screenshots, comparison, etc.)
   */
  buildTestDetails(test) {
    let html = '<div class="test-details">';

    // Error message
    if (test.error) {
      html += `
        <div class="error-message">
          <strong>Error:</strong> ${this.escapeHtml(test.error)}
        </div>
      `;
    }

    // Comparison results
    if (test.comparison && !test.comparison.isNewBaseline) {
      html += `
        <div class="comparison-stats">
          <div class="stat">
            <span class="stat-label">Diff Percentage:</span>
            <span class="stat-value ${test.comparison.diffPercentage > test.comparison.threshold ? 'error' : 'success'}">
              ${test.comparison.diffPercentage.toFixed(2)}%
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Different Pixels:</span>
            <span class="stat-value">${test.comparison.numDiffPixels.toLocaleString()}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Threshold:</span>
            <span class="stat-value">${test.comparison.threshold}%</span>
          </div>
        </div>
      `;
    }

    // Screenshots
    if (test.comparison) {
      html += '<div class="screenshots">';

      if (!test.comparison.isNewBaseline) {
        html += `
          <div class="screenshot-group">
            <div class="screenshot-label">Baseline</div>
            <img src="baseline/${test.testId}.png" alt="Baseline" class="screenshot">
          </div>
          <div class="screenshot-group">
            <div class="screenshot-label">Current</div>
            <img src="current/${test.testId}.png" alt="Current" class="screenshot">
          </div>
          <div class="screenshot-group">
            <div class="screenshot-label">Diff</div>
            <img src="diff/${test.testId}.png" alt="Diff" class="screenshot">
          </div>
        `;
      } else {
        html += `
          <div class="screenshot-group">
            <div class="screenshot-label">New Baseline</div>
            <img src="current/${test.testId}.png" alt="New Baseline" class="screenshot">
          </div>
        `;
      }

      html += '</div>';
    }

    // Validation issues
    if (test.validation && test.validation.issues.length > 0) {
      html += '<div class="validation-issues">';
      html += '<h4>Validation Issues</h4>';
      html += '<ul>';

      for (const issue of test.validation.issues) {
        const severityClass = issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info';
        html += `
          <li class="${severityClass}">
            <strong>[${issue.rule}]</strong> ${this.escapeHtml(issue.message)}
            ${issue.fix ? ' <em>(auto-fixed)</em>' : ''}
          </li>
        `;
      }

      html += '</ul>';
      html += '</div>';
    }

    // Applied fixes
    if (test.fixes && test.fixes.length > 0) {
      html += '<div class="applied-fixes">';
      html += '<h4>Applied Fixes</h4>';
      html += '<ul>';

      for (const fix of test.fixes) {
        const fixClass = fix.success ? 'success' : 'error';
        const fixIcon = fix.success ? '✓' : '✗';
        html += `
          <li class="${fixClass}">
            ${fixIcon} ${this.escapeHtml(fix.description)}
          </li>
        `;
      }

      html += '</ul>';
      html += '</div>';
    }

    // Spec link
    html += `
      <div class="spec-link">
        <a href="specs/${test.testId}.json" target="_blank">View Vega Spec →</a>
      </div>
    `;

    html += '</div>';
    return html;
  }

  /**
   * Format duration in milliseconds
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Get inline template
   */
  getInlineTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1419; color: #DFE5EF; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { font-size: 32px; margin-bottom: 10px; }
    .subtitle { color: #98A2B3; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .summary-card { background: #1a1f29; padding: 20px; border-radius: 8px; border: 1px solid #2b2f38; }
    .summary-card.success { border-color: #22c55e; }
    .summary-card.warning { border-color: #f59e0b; }
    .summary-card.error { border-color: #ef4444; }
    .summary-label { color: #98A2B3; font-size: 14px; margin-bottom: 8px; }
    .summary-value { font-size: 36px; font-weight: 700; }
    .section-title { font-size: 24px; margin: 40px 0 20px; }
    .test-result { background: #1a1f29; border: 1px solid #2b2f38; border-radius: 8px; margin-bottom: 15px; overflow: hidden; }
    .test-result.passed { border-left: 4px solid #22c55e; }
    .test-result.failed { border-left: 4px solid #ef4444; }
    .test-header { display: flex; align-items: center; padding: 15px 20px; cursor: pointer; font-weight: 500; }
    .test-status { font-size: 20px; margin-right: 12px; }
    .test-name { flex: 1; }
    .test-duration { color: #98A2B3; font-size: 14px; }
    .test-details { padding: 0 20px 20px; }
    .error-message { background: #2d1818; border: 1px solid #ef4444; padding: 12px; border-radius: 6px; margin: 15px 0; font-family: monospace; font-size: 13px; }
    .comparison-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 15px 0; }
    .stat { background: #0f1419; padding: 12px; border-radius: 6px; }
    .stat-label { display: block; color: #98A2B3; font-size: 12px; margin-bottom: 4px; }
    .stat-value { font-size: 20px; font-weight: 600; }
    .stat-value.success { color: #22c55e; }
    .stat-value.error { color: #ef4444; }
    .screenshots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
    .screenshot-group { background: #0f1419; padding: 10px; border-radius: 6px; }
    .screenshot-label { font-size: 12px; color: #98A2B3; margin-bottom: 8px; text-align: center; }
    .screenshot { width: 100%; border-radius: 4px; border: 1px solid #2b2f38; }
    .validation-issues, .applied-fixes { margin: 15px 0; }
    .validation-issues h4, .applied-fixes h4 { font-size: 14px; margin-bottom: 10px; color: #98A2B3; }
    .validation-issues ul, .applied-fixes ul { list-style: none; }
    .validation-issues li, .applied-fixes li { padding: 8px; margin: 5px 0; border-radius: 4px; font-size: 13px; }
    .validation-issues li.error { background: #2d1818; border-left: 3px solid #ef4444; }
    .validation-issues li.warning { background: #2d2618; border-left: 3px solid #f59e0b; }
    .validation-issues li.info { background: #18252d; border-left: 3px solid #0ea5e9; }
    .applied-fixes li.success { background: #1a2d1a; border-left: 3px solid #22c55e; }
    .applied-fixes li.error { background: #2d1818; border-left: 3px solid #ef4444; }
    .spec-link { margin-top: 15px; }
    .spec-link a { color: #0ea5e9; text-decoration: none; font-size: 14px; }
    .spec-link a:hover { text-decoration: underline; }
    .no-failures { text-align: center; padding: 60px; font-size: 24px; color: #22c55e; }
    details summary { list-style: none; }
    details summary::-webkit-details-marker { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>{{title}}</h1>
    <div class="subtitle">Run ID: {{runId}} • {{timestamp}} • Duration: {{duration}}</div>

    {{summaryCards}}

    <h2 class="section-title">Failed Tests</h2>
    {{failedTests}}

    <h2 class="section-title">All Tests</h2>
    {{allTests}}
  </div>
</body>
</html>`;
  }
}

export default HTMLReporter;
