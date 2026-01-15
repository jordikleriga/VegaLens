import { BasePage } from './BasePage.js';

/**
 * Builder Page Object Model
 * 
 * Handles interactions with the visualization builder:
 * - Step navigation (Data Source, Chart Type, Configure)
 * - Chart type selection
 * - Field configuration
 * - Preview generation
 */
export class BuilderPage extends BasePage {
  constructor(page) {
    super(page);
    
    this.selectors = {
      ...this.selectors,
      
      // Steps
      stepIndicator: '[class*="step"], [class*="stepper"]',
      step1: 'button:has-text("Data Source"), [data-step="1"]',
      step2: 'button:has-text("Chart Type"), [data-step="2"]',
      step3: 'button:has-text("Configure"), [data-step="3"]',
      
      // Data Source Panel
      dataSourcePanel: '[class*="DataSource"], [data-panel="datasource"]',
      indexSelect: 'select, [class*="index-select"]',
      indexDropdown: 'button:has-text("Select Index"), [data-testid="index-select"]',
      
      // Chart Type Picker
      chartTypePicker: '[class*="VisualizationType"], [data-panel="chart-type"]',
      chartTypeCard: '[class*="chart-type"], [class*="visualization-card"]',
      chartCategory: '[class*="category"]',
      
      // Chart Types
      chartBar: 'button:has-text("Bar"), [data-chart="bar"]',
      chartLine: 'button:has-text("Line"), [data-chart="line"]',
      chartPie: 'button:has-text("Pie"), [data-chart="pie"]',
      chartScatter: 'button:has-text("Scatter"), [data-chart="scatter"]',
      chartBubble: 'button:has-text("Bubble"), [data-chart="bubble"]',
      chartArea: 'button:has-text("Area"), [data-chart="area"]',
      chartHeatmap: 'button:has-text("Heatmap"), [data-chart="heatmap"]',
      chartTreemap: 'button:has-text("Treemap"), [data-chart="treemap"]',
      chartBoxplot: 'button:has-text("Box Plot"), [data-chart="boxplot"]',
      chartHistogram: 'button:has-text("Histogram"), [data-chart="histogram"]',
      chartRadar: 'button:has-text("Radar"), [data-chart="radar"]',
      chartSankey: 'button:has-text("Sankey"), [data-chart="sankey"]',
      chartWaterfall: 'button:has-text("Waterfall"), [data-chart="waterfall"]',
      chartTernary: 'button:has-text("Ternary"), [data-chart="ternary"]',
      
      // Configuration Panel
      configPanel: '[class*="Config"], [class*="Unified"], [data-panel="config"]',
      fieldDropdown: '[class*="field-dropdown"], [class*="FieldDropdown"]',
      fieldOption: '[class*="field-option"], [role="option"]',
      aggregationSelect: 'select[class*="aggregation"], [data-testid="aggregation"]',
      
      // Axis fields
      xAxisField: 'button:has-text("X-Axis"), [data-field="x"]',
      yAxisField: 'button:has-text("Y-Axis"), [data-field="y"]',
      colorField: 'button:has-text("Color"), [data-field="color"]',
      sizeField: 'button:has-text("Size"), [data-field="size"]',
      
      // Preview
      previewContainer: '[class*="preview"], [class*="VegaPreview"], canvas, svg',
      vegaCanvas: 'canvas.marks, svg.marks, [class*="vega"]',
      
      // Spec output
      specEditor: '[class*="SpecEditor"], [class*="spec-output"]',
      copySpecButton: 'button:has-text("Copy"), [data-action="copy"]',
      vegaSpecTab: 'button:has-text("Vega Spec")',
      kibanaSpecTab: 'button:has-text("Kibana Spec")',
      
      // Actions
      saveButton: 'button:has-text("Save")',
      resetButton: 'button:has-text("Reset")',
      runButton: 'button:has-text("Run"), button:has-text("Generate")',
    };
  }

  /**
   * Navigate to builder page
   */
  async goto() {
    await this.navigate('/builder');
  }

  /**
   * Select a chart type by name
   */
  async selectChartType(chartType) {
    // Map chart type names to selectors
    const chartMap = {
      'bar': this.selectors.chartBar,
      'line': this.selectors.chartLine,
      'pie': this.selectors.chartPie,
      'scatter': this.selectors.chartScatter,
      'bubble': this.selectors.chartBubble,
      'area': this.selectors.chartArea,
      'heatmap': this.selectors.chartHeatmap,
      'treemap': this.selectors.chartTreemap,
      'boxplot': this.selectors.chartBoxplot,
      'histogram': this.selectors.chartHistogram,
      'radar': this.selectors.chartRadar,
      'sankey': this.selectors.chartSankey,
      'waterfall': this.selectors.chartWaterfall,
      'ternary': this.selectors.chartTernary,
    };
    
    const selector = chartMap[chartType.toLowerCase()];
    if (!selector) {
      // Try generic text matching
      await this.page.locator(`button:has-text("${chartType}")`).first().click();
    } else {
      await this.page.locator(selector).first().click();
    }
    
    await this.waitForPageLoad();
  }

  /**
   * Select an index from dropdown
   */
  async selectIndex(indexName) {
    const indexBtn = this.page.locator(this.selectors.indexDropdown).first();
    if (await indexBtn.count() > 0) {
      await indexBtn.click();
      await this.page.locator(`text="${indexName}"`).first().click();
    } else {
      // Try select element
      await this.page.locator(this.selectors.indexSelect).first().selectOption({ label: indexName });
    }
    await this.waitForPageLoad();
  }

  /**
   * Configure a field (X, Y, Color, Size, etc.)
   */
  async configureField(fieldType, fieldName, options = {}) {
    const { aggregation } = options;
    
    // Click field button to open dropdown
    const fieldBtn = this.page.locator(`button:has-text("${fieldType}")`).first();
    await fieldBtn.click();
    
    // Wait for dropdown and select field
    await this.page.waitForTimeout(300); // Wait for dropdown animation
    
    // Type to search/filter
    const searchInput = this.page.locator('input[type="text"], input[placeholder*="Search"]').first();
    if (await searchInput.count() > 0 && await searchInput.isVisible()) {
      await searchInput.fill(fieldName);
      await this.page.waitForTimeout(200);
    }
    
    // Click the field option
    await this.page.locator(`text="${fieldName}"`).first().click();
    
    // Select aggregation if specified
    if (aggregation) {
      const aggSelect = this.page.locator(this.selectors.aggregationSelect).first();
      if (await aggSelect.count() > 0) {
        await aggSelect.selectOption({ label: aggregation });
      }
    }
    
    await this.waitForPageLoad();
  }

  /**
   * Navigate to a specific step
   */
  async goToStep(stepNumber) {
    const stepSelectors = {
      1: this.selectors.step1,
      2: this.selectors.step2,
      3: this.selectors.step3,
    };
    
    await this.page.locator(stepSelectors[stepNumber]).first().click();
    await this.waitForPageLoad();
  }

  /**
   * Check if preview is visible
   */
  async isPreviewVisible() {
    const preview = this.page.locator(this.selectors.previewContainer);
    return await preview.count() > 0 && await preview.first().isVisible();
  }

  /**
   * Wait for preview to render
   */
  async waitForPreview(timeout = 10000) {
    await this.page.locator(this.selectors.vegaCanvas).first().waitFor({ 
      state: 'visible', 
      timeout 
    });
  }

  /**
   * Get the Vega spec JSON
   */
  async getVegaSpec() {
    // Switch to Vega Spec tab
    const vegaTab = this.page.locator(this.selectors.vegaSpecTab);
    if (await vegaTab.count() > 0) {
      await vegaTab.click();
    }
    
    // Get spec content
    const specEditor = this.page.locator(this.selectors.specEditor);
    const content = await specEditor.textContent();
    
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }

  /**
   * Get the Kibana spec JSON
   */
  async getKibanaSpec() {
    // Switch to Kibana Spec tab
    const kibanaTab = this.page.locator(this.selectors.kibanaSpecTab);
    if (await kibanaTab.count() > 0) {
      await kibanaTab.click();
    }
    
    // Get spec content
    const specEditor = this.page.locator(this.selectors.specEditor);
    const content = await specEditor.textContent();
    
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }

  /**
   * Copy spec to clipboard
   */
  async copySpec() {
    await this.page.locator(this.selectors.copySpecButton).first().click();
  }

  /**
   * Reset the builder
   */
  async reset() {
    await this.page.locator(this.selectors.resetButton).first().click();
    await this.waitForPageLoad();
  }

  /**
   * Run/generate visualization
   */
  async runVisualization() {
    await this.page.locator(this.selectors.runButton).first().click();
    await this.waitForPageLoad();
    await this.waitForPreview();
  }

  /**
   * Check if a specific chart type is available
   */
  async isChartTypeAvailable(chartType) {
    const chartBtn = this.page.locator(`button:has-text("${chartType}")`);
    return await chartBtn.count() > 0;
  }

  /**
   * Get list of available chart types
   */
  async getAvailableChartTypes() {
    const chartCards = this.page.locator(this.selectors.chartTypeCard);
    const count = await chartCards.count();
    const types = [];
    
    for (let i = 0; i < count; i++) {
      const text = await chartCards.nth(i).textContent();
      types.push(text.trim());
    }
    
    return types;
  }
}


