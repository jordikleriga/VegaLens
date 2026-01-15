/**
 * Population Pyramid Generator
 * Generates Vega-Lite specs for population pyramid (diverging stacked bar) charts
 */

import { VegaGeneratorBase } from '../VegaGeneratorBase.js';
import { logger } from '../utils/logger.js';

export class PopulationPyramidGenerator extends VegaGeneratorBase {
  static metadata = {
    id: 'population_pyramid',
    name: 'Population Pyramid',
    description: 'Diverging stacked bar chart for comparing two groups',
    category: 'comparison',
    icon: 'bar-chart'
  };

  static schema = {
    fields: [
      { name: 'categoryField', label: 'Category', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'valueField', label: 'Value', type: 'field', required: true, fieldTypes: ['number', 'long', 'integer', 'double', 'float'] },
      { name: 'groupField', label: 'Group', type: 'field', required: true, fieldTypes: ['keyword', 'text'] },
      { name: 'multiLevelMode', label: 'Sub-grouping Display', type: 'select', options: ['stacked', 'faceted'], default: 'stacked', advanced: true, description: 'How to display multi-level bucket data' },
      { name: 'leftGroup', label: 'Left Group Name', type: 'text', default: '' },
      { name: 'rightGroup', label: 'Right Group Name', type: 'text', default: '' },
      { name: 'leftColor', label: 'Left Color', type: 'color', default: '#675193' },
      { name: 'rightColor', label: 'Right Color', type: 'color', default: '#ca8861' }
    ]
  };

  static example = {
    config: {
      categoryField: 'ageGroup',
      valueField: 'population',
      groupField: 'gender',
      leftGroup: 'Male',
      rightGroup: 'Female',
      title: 'Population by Age and Gender'
    },
    data: [
      { ageGroup: '0-14', gender: 'Male', population: 2500 },
      { ageGroup: '0-14', gender: 'Female', population: 2400 },
      { ageGroup: '15-24', gender: 'Male', population: 3200 },
      { ageGroup: '15-24', gender: 'Female', population: 3100 },
      { ageGroup: '25-44', gender: 'Male', population: 4500 },
      { ageGroup: '25-44', gender: 'Female', population: 4600 },
      { ageGroup: '45-64', gender: 'Male', population: 3800 },
      { ageGroup: '45-64', gender: 'Female', population: 4000 },
      { ageGroup: '65+', gender: 'Male', population: 2000 },
      { ageGroup: '65+', gender: 'Female', population: 2600 }
    ]
  };

  generate(data) {
    const {
      categoryField, valueField, groupField,
      leftGroup = '', rightGroup = '',
      leftColor = '#675193', rightColor = '#ca8861'
    } = this.config;

    logger.debug('Generating population pyramid spec', {
      event: 'population_pyramid_generate',
      categoryField,
      valueField,
      groupField
    });

    const resolvedCategoryField = this.resolveFieldPath(categoryField, data);
    const resolvedValueField = this.resolveFieldPath(valueField, data);
    const resolvedGroupField = this.resolveFieldPath(groupField, data);

    // Detect unique group values from data
    const uniqueGroups = [...new Set((data || []).map(d => d[resolvedGroupField]).filter(g => g !== undefined && g !== null))];
    
    const group1 = leftGroup || uniqueGroups[0] || 'Left';
    const group2 = rightGroup || uniqueGroups[1] || uniqueGroups[0] || 'Right';

    // Pre-process data to add signed values
    const processedData = (data || []).map(d => ({
      ...d,
      signed_value: d[resolvedGroupField] === group1 ? -Math.abs(d[resolvedValueField] || 0) : Math.abs(d[resolvedValueField] || 0)
    }));

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Population Pyramid - Diverging Stacked Bar Chart',
      title: this.config.title || '',
      width: this.config.width || 400,
      height: this.config.height || 300,
      data: { values: processedData },
      mark: { type: 'bar', tooltip: true },
      encoding: {
        y: {
          field: resolvedCategoryField,
          type: 'ordinal',
          axis: { title: null },
          sort: 'descending'
        },
        x: {
          aggregate: 'sum',
          field: 'signed_value',
          type: 'quantitative',
          title: valueField,
          axis: { format: 's' }
        },
        color: {
          field: resolvedGroupField,
          type: 'nominal',
          scale: { 
            domain: uniqueGroups.length >= 2 ? [group1, group2] : uniqueGroups,
            range: [leftColor, rightColor] 
          },
          legend: { orient: 'top', title: null }
        },
        tooltip: [
          { field: resolvedCategoryField, type: 'ordinal', title: categoryField },
          { field: resolvedGroupField, type: 'nominal', title: groupField },
          { field: resolvedValueField, type: 'quantitative', title: valueField, format: '.2f' }
        ]
      },
      config: {
        view: { stroke: null },
        axis: { grid: false }
      }
    };
  }

  /**
   * Generate Kibana-compatible Vega-Lite spec with Elasticsearch data source
   */
  generateForKibana(elasticConfig) {
    const { index, query, timeField = '@timestamp', aggregation, useContext } = elasticConfig;
    const idx = index || '_all';
    const {
      categoryField, valueField, groupField,
      leftGroup = '', rightGroup = '',
      leftColor = '#675193', rightColor = '#ca8861'
    } = this.config;

    // Use actual aggregation config structure (NEW PATTERN)
    const bucketAgg = aggregation?.bucketAgg || aggregation?.bucketAggs?.[0];
    const metrics = aggregation?.metrics || [];

    const categoryBucketField = bucketAgg?.field || categoryField;
    const groupBucketField = groupField;
    const metric = metrics[0];
    const metricType = metric?.type; // Don't default - leave undefined if no metric
    const metricField = metric?.field || valueField;

    // Use multi_terms aggregation to get both dimensions in a single bucket
    const aggs = {
      primary: {
        multi_terms: {
          terms: [
            { field: categoryBucketField },
            { field: groupBucketField }
          ],
          size: 25
        },
        aggs: (metrics.length > 0 && metricType && metricType !== 'count') ? {
          metric_0: { [metricType]: { field: metricField } }
        } : {}
      }
    };

    const urlConfig = {
      index: idx,
      body: {
        size: 0,
        ...(query && Object.keys(query).length > 0 ? { query } : {}),
        aggs
      }
    };

    if (useContext) {
      urlConfig['%context%'] = true;
      urlConfig['%timefield%'] = timeField;
    }

    // Build metric field name for transforms
    const sanitizedCategoryField = categoryBucketField.replace(/\./g, '_');
    const sanitizedGroupField = groupBucketField.replace(/\./g, '_');
    const metricFieldName = metricType && metricType !== 'count'
      ? `${metricType}_${metricField.replace(/\./g, '_')}`
      : '_count';

    const transforms = [
      { calculate: 'datum.doc_count', as: '_count' },
      { calculate: 'datum.key[0]', as: sanitizedCategoryField },
      { calculate: 'datum.key[1]', as: sanitizedGroupField },
      ...(metrics.length > 0 && metricType && metricType !== 'count' ? [
        { calculate: 'datum.metric_0.value', as: metricFieldName }
      ] : []),
      {
        // Make left group negative. If no leftGroup specified, alphabetically first value goes left.
        calculate: leftGroup
          ? `datum.${sanitizedGroupField} === '${leftGroup}' ? -abs(datum.${metricFieldName}) : abs(datum.${metricFieldName})`
          : `datum.${sanitizedGroupField} < 'M' ? -abs(datum.${metricFieldName}) : abs(datum.${metricFieldName})`,
        as: 'signed_value'
      }
    ];

    // Determine group values for color scale domain
    const groupValues = leftGroup && rightGroup ? [leftGroup, rightGroup] : null;

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Population Pyramid',
      title: this.config.title || undefined,
      data: {
        url: urlConfig,
        format: { property: 'aggregations.primary.buckets' }
      },
      transform: transforms,
      mark: { type: 'bar', tooltip: true },
      encoding: {
        y: {
          field: sanitizedCategoryField,
          type: 'ordinal',
          axis: { title: null },
          sort: 'descending'
        },
        x: {
          field: 'signed_value',
          type: 'quantitative',
          axis: {
            title: metricType && metricType !== 'count' ? `${metricType} of ${metricField}` : 'count',
            format: 's'
          }
        },
        color: {
          field: sanitizedGroupField,
          type: 'nominal',
          scale: groupValues ? {
            domain: groupValues,
            range: [leftColor, rightColor]
          } : {
            range: [leftColor, rightColor]
          },
          legend: { orient: 'top', title: null }
        },
        tooltip: [
          { field: sanitizedCategoryField, type: 'ordinal', title: categoryBucketField },
          { field: sanitizedGroupField, type: 'nominal', title: groupBucketField },
          { field: metricFieldName, type: 'quantitative', title: metricType && metricType !== 'count' ? `${metricType} of ${metricField}` : 'count', format: '.2f' }
        ]
      },
      config: {
        view: { stroke: null },
        axis: this.getAxisStyleConfig()
      }
    };
  }
}

export default PopulationPyramidGenerator;

