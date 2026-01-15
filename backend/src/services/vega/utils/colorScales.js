/**
 * Color Scale Utilities
 * Shared color scale generation for all chart types
 */

// Default color schemes available
export const COLOR_SCHEMES = {
  categorical: [
    'category10', 'category20', 'category20b', 'category20c',
    'accent', 'dark2', 'paired', 'pastel1', 'pastel2', 'set1', 'set2', 'set3', 'tableau10', 'tableau20'
  ],
  sequential: [
    'blues', 'greens', 'greys', 'oranges', 'purples', 'reds',
    'viridis', 'magma', 'inferno', 'plasma', 'cividis', 'turbo'
  ],
  diverging: [
    'blueorange', 'brownbluegreen', 'purplegreen', 'pinkyellowgreen',
    'purpleorange', 'redblue', 'redgrey', 'redyellowblue', 'redyellowgreen', 'spectral'
  ]
};

/**
 * Get a color scale configuration for Vega
 */
export function getColorScale(fieldName, options = {}) {
  const {
    scheme = 'category10',
    customColors = null,
    dataSource = 'source'
  } = options;

  if (customColors && customColors.length > 0) {
    return {
      name: 'color',
      type: 'ordinal',
      domain: { data: dataSource, field: fieldName },
      range: customColors
    };
  }

  return {
    name: 'color',
    type: 'ordinal',
    domain: { data: dataSource, field: fieldName },
    range: { scheme }
  };
}

/**
 * Get sequential color scale for quantitative data
 */
export function getSequentialColorScale(fieldName, options = {}) {
  const {
    scheme = 'blues',
    dataSource = 'source',
    reverse = false
  } = options;

  return {
    name: 'color',
    type: 'linear',
    domain: { data: dataSource, field: fieldName },
    range: { scheme },
    reverse
  };
}

/**
 * Get gradient definition for Vega spec
 */
export function getGradientDef(id, startColor, endColor, direction = 'vertical') {
  return {
    name: id,
    type: 'linearGradient',
    x1: 0,
    y1: 0,
    x2: direction === 'horizontal' ? 1 : 0,
    y2: direction === 'vertical' ? 1 : 0,
    stops: [
      { offset: 0, color: startColor },
      { offset: 1, color: endColor }
    ]
  };
}

export default {
  COLOR_SCHEMES,
  getColorScale,
  getSequentialColorScale,
  getGradientDef
};

