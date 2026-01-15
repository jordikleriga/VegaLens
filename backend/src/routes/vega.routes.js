import { Router } from 'express';
import { chartRegistry } from '../services/vega/index.js';
import { VegaLiteGenerator } from '../services/vegaLiteGenerator.js';
import { analyzeDataAndRecommend } from '../services/chartRecommendationService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger, validateRequest } from '../middleware/logger.js';

const router = Router();

/**
 * Validate that specified fields exist in the data
 */
function validateFieldsInData(config, data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { valid: true, warnings: ['No data provided for validation'] };
  }
  
  const sampleRecord = data[0];
  const availableFields = Object.keys(sampleRecord);
  const errors = [];
  const warnings = [];
  
  // Helper: Check if a field path exists in the data
  // Handles cases like "category.keyword" where data has "category_keyword" (sanitized)
  function fieldExistsInData(fieldPath) {
    if (!fieldPath) return false;
    
    // Direct match
    if (availableFields.includes(fieldPath)) return true;
    
    // Check for sanitized version (dots replaced with underscores)
    // This handles aggregation data where "category.keyword" becomes "category_keyword"
    const sanitizedField = fieldPath.replace(/\./g, '_');
    if (availableFields.includes(sanitizedField)) return true;
    
    // Handle Elasticsearch ".keyword" subfields - check the base field (raw data)
    // e.g., "category.keyword" should match if "category" exists
    if (fieldPath.endsWith('.keyword')) {
      const baseField = fieldPath.replace(/\.keyword$/, '');
      if (availableFields.includes(baseField)) return true;
    }
    
    // Handle nested field paths (e.g., "user.name" should match if "user" exists as an object)
    const parts = fieldPath.split('.');
    if (parts.length > 1) {
      const topLevel = parts[0];
      if (availableFields.includes(topLevel)) {
        // Check if the nested path exists in the sample record
        let current = sampleRecord;
        for (const part of parts) {
          if (current && typeof current === 'object' && part in current) {
            current = current[part];
          } else {
            break;
          }
        }
        if (current !== undefined) return true;
      }
    }
    
    // Special case: underscore-prefixed fields like "_count" are generated
    if (fieldPath.startsWith('_')) return true;
    
    return false;
  }
  
  // Fields that reference data columns
  const fieldConfigs = ['xField', 'yField', 'colorField', 'categoryField', 'valueField', 
                        'sizeField', 'textField', 'sourceField', 'targetField', 'field',
                        'stageField', 'parentField', 'wordField', 'frequencyField',
                        'minField', 'maxField', 'q1Field', 'q3Field', 'medianField'];
  
  for (const fieldName of fieldConfigs) {
    const fieldValue = config[fieldName];
    if (fieldValue && !fieldExistsInData(fieldValue)) {
      // Check if any available field contains this as a prefix/suffix
      // (handles cases where aggregation changes field names)
      const partialMatch = availableFields.some(f => 
        f.includes(fieldValue.split('.')[0]) || 
        fieldValue.includes(f.split('_')[0])
      );
      
      if (partialMatch) {
        // Add as warning, not error - generator can usually resolve it
        warnings.push({
          field: fieldName,
          value: fieldValue,
          message: `Field '${fieldValue}' may need resolution, similar fields found`,
          availableFields: availableFields.slice(0, 10)
        });
      } else {
        errors.push({
          field: fieldName,
          value: fieldValue,
          message: `Field '${fieldValue}' not found in data`,
          availableFields: availableFields.slice(0, 10) // Limit to first 10 for readability
        });
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    availableFields
  };
}

// Get available visualization types
router.get('/types', (req, res) => {
  const types = chartRegistry.getVisualizationTypes();
  logger.info('Fetched visualization types', { count: types.length });
  res.json(types);
});

// Get Vega-Lite mark types
router.get('/vegalite/marks', (req, res) => {
  const marks = VegaLiteGenerator.getMarkTypes();
  logger.debug('Fetched Vega-Lite mark types', { count: marks.length });
  res.json(marks);
});

// Get aggregate operations
router.get('/vegalite/aggregates', (req, res) => {
  const aggregates = VegaLiteGenerator.getAggregateOps();
  logger.debug('Fetched aggregate operations', { count: aggregates.length });
  res.json(aggregates);
});

// Get time units
router.get('/vegalite/timeunits', (req, res) => {
  const timeUnits = VegaLiteGenerator.getTimeUnits();
  logger.debug('Fetched time units', { count: timeUnits.length });
  res.json(timeUnits);
});

// Get scale types
router.get('/vegalite/scales', (req, res) => {
  const scales = VegaLiteGenerator.getScaleTypes();
  logger.debug('Fetched scale types', { count: scales.length });
  res.json(scales);
});

// Get color schemes
router.get('/vegalite/colorschemes', (req, res) => {
  const schemes = VegaLiteGenerator.getColorSchemes();
  logger.debug('Fetched color schemes', { count: Object.keys(schemes).length });
  res.json(schemes);
});

// Get configuration schema for a visualization type
router.get('/types/:type/schema', (req, res, next) => {
  try {
    const { type } = req.params;
    const schema = chartRegistry.getConfigSchema(type);
    
    if (!schema) {
      throw new AppError(`Unknown visualization type: ${type}`, 404);
    }
    
    res.json(schema);
  } catch (error) {
    next(error);
  }
});

// Pre-validate configuration before generation
router.post('/types/:type/validate-config', (req, res, next) => {
  try {
    const { type } = req.params;
    const { config, data } = req.body;
    
    const schema = chartRegistry.getConfigSchema(type);
    if (!schema) {
      return res.json({
        valid: false,
        errors: [{ type: 'schema', message: `Unknown visualization type: ${type}` }],
        canGenerate: false
      });
    }
    
    const errors = [];
    const warnings = [];
    
    // Check required fields
    const requiredFields = schema.fields.filter(f => f.required);
    const missingFields = requiredFields.filter(f => {
      const value = config?.[f.name];
      return value === undefined || value === null || value === '';
    });
    
    if (missingFields.length > 0) {
      errors.push({
        type: 'missing_required',
        fields: missingFields.map(f => f.name),
        message: `Missing required fields: ${missingFields.map(f => f.label || f.name).join(', ')}`
      });
    }
    
    // If we have data, validate fields exist
    if (data && data.length > 0) {
      const sample = data[0];
      const availableFields = Object.keys(sample);
      
      // Check each configured field exists in data
      for (const field of schema.fields.filter(f => f.type === 'field' && config?.[f.name])) {
        const configuredValue = config[field.name];
        if (!availableFields.includes(configuredValue)) {
          errors.push({
            type: 'field_not_found',
            field: field.name,
            configured: configuredValue,
            available: availableFields,
            message: `Field "${configuredValue}" not found in data (configured for ${field.label})`
          });
        }
      }
      
      // Type checking for numeric fields
      for (const field of schema.fields.filter(f => f.fieldTypes?.some(t => ['number', 'long', 'integer', 'double', 'float'].includes(t)))) {
        const configuredValue = config?.[field.name];
        if (configuredValue && availableFields.includes(configuredValue)) {
          const sampleValue = sample[configuredValue];
          if (typeof sampleValue !== 'number') {
            warnings.push({
              type: 'type_mismatch',
              field: field.name,
              expected: 'number',
              actual: typeof sampleValue,
              message: `Field "${configuredValue}" should be numeric but found ${typeof sampleValue}`
            });
          }
        }
      }
    }
    
    const canGenerate = errors.length === 0;
    
    logger.debug('Config validation result', {
      type,
      canGenerate,
      errorCount: errors.length,
      warningCount: warnings.length,
      configKeys: Object.keys(config || {})
    });
    
    res.json({
      valid: canGenerate,
      canGenerate,
      errors,
      warnings,
      schema: {
        requiredFields: requiredFields.map(f => ({ name: f.name, label: f.label })),
        configuredFields: Object.keys(config || {})
      }
    });
  } catch (error) {
    next(error);
  }
});

// Generate Vega specification
router.post('/generate', (req, res, next) => {
  try {
    const { type, config, data } = req.body;
    
    logger.info('Generating Vega specification', {
      type,
      configKeys: Object.keys(config || {}),
      dataRecords: data?.length || 0,
      xField: config?.xField,
      yField: config?.yField,
      colorField: config?.colorField
    });
    
    // Validation
    if (!type) {
      throw new AppError('Visualization type is required', 400);
    }
    
    // Get the schema for this type
    const schema = chartRegistry.getConfigSchema(type);
    if (!schema) {
      throw new AppError(`Unknown visualization type: ${type}`, 400);
    }
    
    // Validate required fields are configured
    const requiredFields = schema.fields.filter(f => f.required);
    const missingFields = requiredFields.filter(f => !config[f.name]);
    
    if (missingFields.length > 0) {
      logger.warn('Missing required fields in Vega config', {
        type,
        missing: missingFields.map(f => f.name),
        provided: Object.keys(config)
      });
      throw new AppError(
        `Missing required fields: ${missingFields.map(f => f.label || f.name).join(', ')}`,
        400
      );
    }
    
    // Validate fields exist in data
    const fieldValidation = validateFieldsInData(config, data);
    if (!fieldValidation.valid) {
      logger.warn('Field validation failed', {
        type,
        errors: fieldValidation.errors,
        availableFields: fieldValidation.availableFields
      });
      
      const errorMessages = fieldValidation.errors.map(e => e.message);
      throw new AppError(
        `Invalid field configuration: ${errorMessages.join('; ')}. Available fields: ${fieldValidation.availableFields.join(', ')}`,
        400
      );
    }
    
    // Normalize data: unwrap single-element arrays (common in raw ES data)
    // This is especially important for scatter/bubble charts that need numeric values
    const normalizedData = data.map(record => {
      const normalized = {};
      for (const [key, value] of Object.entries(record)) {
        if (Array.isArray(value) && value.length === 1) {
          normalized[key] = value[0];
        } else if (Array.isArray(value) && value.length > 1) {
          // For multi-element arrays, take first value (for numeric charts)
          // This preserves array structure for other use cases
          normalized[key] = value[0];
        } else {
          normalized[key] = value;
        }
      }
      return normalized;
    });
    
    // Generate the spec using chartRegistry with normalized data
    const spec = chartRegistry.generate(type, config, normalizedData);
    
    // Validate the generated spec
    const specValidation = chartRegistry.validate(spec);
    
    logger.info('Vega specification generated', {
      type,
      valid: specValidation.valid,
      dataRecords: data?.length || 0,
      specType: spec.$schema?.includes('vega-lite') ? 'vega-lite' : 'vega'
    });
    
    if (!specValidation.valid) {
      logger.warn('Generated spec validation issues', { errors: specValidation.errors });
    }
    
    // Include validation info in response for debugging
    res.json({
      ...spec,
      _meta: {
        generatedAt: new Date().toISOString(),
        type,
        dataRecords: data?.length || 0,
        validation: specValidation
      }
    });
  } catch (error) {
    logger.error('Vega generation failed', { 
      error: error.message, 
      type: req.body?.type,
      configKeys: Object.keys(req.body?.config || {})
    });
    next(error);
  }
});

/**
 * Shared validation for all chart generation endpoints
 */
function validateChartConfig(type, config, data) {
  const errors = [];
  const warnings = [];
  
  // Get schema for this type
  const schema = chartRegistry.getConfigSchema(type);
  if (!schema) {
    throw new AppError(`Unknown visualization type: ${type}`, 400);
  }
  
  // Check required fields
  const requiredFields = schema.fields.filter(f => f.required);
  const missingFields = requiredFields.filter(f => !config[f.name]);
  
  if (missingFields.length > 0) {
    errors.push({
      type: 'missing_required',
      fields: missingFields.map(f => f.name),
      message: `Missing required fields: ${missingFields.map(f => f.label || f.name).join(', ')}`
    });
  }
  
  // Validate fields exist in data
  if (data && Array.isArray(data) && data.length > 0) {
    const fieldValidation = validateFieldsInData(config, data);
    if (!fieldValidation.valid) {
      errors.push(...fieldValidation.errors.map(e => ({
        type: 'field_not_found',
        ...e
      })));
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    schema
  };
}

// Generate Vega spec with Elasticsearch query embedded (for Kibana)
router.post('/generate-kibana', (req, res, next) => {
  try {
    const { type, config, elasticConfig } = req.body;
    
    if (!type) {
      throw new AppError('Visualization type is required', 400);
    }
    
    // Validate config structure
    const schema = chartRegistry.getConfigSchema(type);
    if (!schema) {
      throw new AppError(`Unknown visualization type: ${type}`, 400);
    }
    
    // Check required fields
    const requiredFields = schema.fields.filter(f => f.required);
    const missingFields = requiredFields.filter(f => !config[f.name]);
    
    if (missingFields.length > 0) {
      logger.warn('Missing required fields for Kibana spec', { type, missing: missingFields.map(f => f.name) });
      throw new AppError(
        `Missing required fields: ${missingFields.map(f => f.label || f.name).join(', ')}`,
        400
      );
    }
    
    logger.debug('Generating Kibana Vega spec', { type, config: Object.keys(config) });
    
    // Generate Kibana-compatible Vega-Lite spec with Elasticsearch query
    const spec = chartRegistry.generateForKibana(type, config, elasticConfig);
    
    // Return as JSON - same format as preview spec but with url data source
    res.json(spec);
  } catch (error) {
    logger.error('Kibana spec generation failed', { error: error.message });
    next(error);
  }
});

// Generate Vega-Lite spec from aggregated data
router.post('/vegalite/generate', (req, res, next) => {
  try {
    const { data, mark, encoding, config = {} } = req.body;
    
    if (!mark) {
      throw new AppError('Mark type is required', 400);
    }
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new AppError('Data is required and must be a non-empty array', 400);
    }
    
    // Validate encoding fields exist in data
    if (encoding) {
      const sampleRecord = data[0];
      const availableFields = Object.keys(sampleRecord);
      const errors = [];
      
      for (const [channel, channelConfig] of Object.entries(encoding)) {
        if (channelConfig.field && !availableFields.includes(channelConfig.field)) {
          errors.push(`Field '${channelConfig.field}' in ${channel} encoding not found in data`);
        }
      }
      
      if (errors.length > 0) {
        throw new AppError(`Encoding validation failed: ${errors.join('; ')}. Available: ${availableFields.join(', ')}`, 400);
      }
    }
    
    const generator = new VegaLiteGenerator(config);
    const spec = generator.generate({ data, mark, encoding });
    
    res.json(spec);
  } catch (error) {
    logger.error('Vega-Lite generation failed', { error: error.message });
    next(error);
  }
});

// Generate Vega-Lite spec from Elasticsearch aggregation
router.post('/vegalite/from-aggregation', (req, res, next) => {
  try {
    const { 
      data, 
      mark = 'bar',
      bucketField = 'key',
      valueField = '_count',
      colorField,
      config = {}
    } = req.body;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new AppError('Aggregated data is required', 400);
    }
    
    // Validate fields exist in data
    const sampleRecord = data[0];
    const availableFields = Object.keys(sampleRecord);
    const errors = [];
    
    if (!availableFields.includes(bucketField)) {
      errors.push(`Bucket field '${bucketField}' not found`);
    }
    if (!availableFields.includes(valueField)) {
      errors.push(`Value field '${valueField}' not found`);
    }
    if (colorField && !availableFields.includes(colorField)) {
      errors.push(`Color field '${colorField}' not found`);
    }
    
    if (errors.length > 0) {
      throw new AppError(`Field validation failed: ${errors.join('; ')}. Available: ${availableFields.join(', ')}`, 400);
    }
    
    const generator = new VegaLiteGenerator(config);
    const spec = generator.fromAggregatedData({
      data,
      mark,
      bucketField,
      valueField,
      colorField,
      ...config
    });
    
    res.json(spec);
  } catch (error) {
    logger.error('Vega-Lite from aggregation failed', { error: error.message });
    next(error);
  }
});

// Generate Vega-Lite chart by type
router.post('/vegalite/chart/:chartType', (req, res, next) => {
  try {
    const { chartType } = req.params;
    const { data, config = {}, ...options } = req.body;
    
    const validChartTypes = ['bar', 'line', 'area', 'pie', 'scatter', 'heatmap', 'histogram', 'boxplot'];
    if (!validChartTypes.includes(chartType)) {
      throw new AppError(`Unknown chart type: ${chartType}. Valid types: ${validChartTypes.join(', ')}`, 400);
    }
    
    // Validate data is provided and valid
    if (!data) {
      throw new AppError('Data is required', 400);
    }
    if (!Array.isArray(data) || data.length === 0) {
      throw new AppError('Data must be a non-empty array', 400);
    }
    
    // Validate required options based on chart type
    const requiredOptions = {
      bar: ['xField', 'yField'],
      line: ['xField', 'yField'],
      area: ['xField', 'yField'],
      pie: ['categoryField', 'valueField'],
      scatter: ['xField', 'yField'],
      heatmap: ['xField', 'yField', 'valueField'],
      histogram: ['field'],
      boxplot: ['categoryField', 'valueField']
    };
    
    const required = requiredOptions[chartType] || [];
    const missing = required.filter(f => !options[f]);
    
    if (missing.length > 0) {
      throw new AppError(`Missing required options for ${chartType} chart: ${missing.join(', ')}`, 400);
    }
    
    // Validate fields exist in data
    if (data && data.length > 0) {
      const availableFields = Object.keys(data[0]);
      const fieldOptions = ['xField', 'yField', 'colorField', 'categoryField', 'valueField', 'field', 'sizeField'];
      const fieldErrors = [];
      
      for (const fieldName of fieldOptions) {
        const fieldValue = options[fieldName];
        if (fieldValue && !availableFields.includes(fieldValue)) {
          fieldErrors.push(`${fieldName} '${fieldValue}' not found in data`);
        }
      }
      
      if (fieldErrors.length > 0) {
        throw new AppError(`Field validation failed: ${fieldErrors.join('; ')}. Available: ${availableFields.join(', ')}`, 400);
      }
    }
    
    logger.debug('Generating Vega-Lite chart', { chartType, options: Object.keys(options) });
    
    const generator = new VegaLiteGenerator(config);
    
    const chartGenerators = {
      bar: () => generator.barChart({ data, ...options }),
      line: () => generator.lineChart({ data, ...options }),
      area: () => generator.areaChart({ data, ...options }),
      pie: () => generator.pieChart({ data, ...options }),
      scatter: () => generator.scatterPlot({ data, ...options }),
      heatmap: () => generator.heatmap({ data, ...options }),
      histogram: () => generator.histogram({ data, ...options }),
      boxplot: () => generator.boxPlot({ data, ...options })
    };
    
    const spec = chartGenerators[chartType]();
    res.json(spec);
  } catch (error) {
    logger.error('Vega-Lite chart generation failed', { error: error.message, chartType: req.params.chartType });
    next(error);
  }
});

// Validate Vega-Lite spec
router.post('/vegalite/validate', (req, res, next) => {
  try {
    const { spec } = req.body;
    
    if (!spec) {
      throw new AppError('Specification is required', 400);
    }
    
    const validation = VegaLiteGenerator.validate(spec);
    res.json(validation);
  } catch (error) {
    next(error);
  }
});

// Validate Vega specification
router.post('/validate', (req, res, next) => {
  try {
    const { spec } = req.body;
    
    if (!spec) {
      throw new AppError('Specification is required', 400);
    }
    
    const validation = chartRegistry.validate(spec);
    res.json(validation);
  } catch (error) {
    next(error);
  }
});

// Get example spec for visualization type
router.get('/examples/:type', (req, res, next) => {
  try {
    const { type } = req.params;
    const example = chartRegistry.getExample(type);
    
    if (!example) {
      throw new AppError(`No example available for type: ${type}`, 404);
    }
    
    res.json(example);
  } catch (error) {
    next(error);
  }
});

// Get chart type recommendations based on data
router.post('/recommend', (req, res, next) => {
  try {
    const { fieldMappings, sampleData, aggregationConfig } = req.body;
    
    if (!fieldMappings || Object.keys(fieldMappings).length === 0) {
      return res.json({
        recommendations: [],
        analyzedFields: {},
        message: 'No field mappings provided'
      });
    }
    
    logger.debug('Generating chart recommendations', {
      fieldCount: Object.keys(fieldMappings).length,
      sampleDataCount: sampleData?.length || 0,
      hasAggConfig: !!aggregationConfig
    });
    
    const result = analyzeDataAndRecommend(
      fieldMappings,
      sampleData || [],
      aggregationConfig
    );
    
    logger.info('Chart recommendations generated', {
      recommendationCount: result.recommendations?.length || 0,
      topRecommendation: result.recommendations?.[0]?.type
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Chart recommendation failed', { error: error.message });
    next(error);
  }
});

export default router;
