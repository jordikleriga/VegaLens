#!/usr/bin/env node
/**
 * Chart Thumbnail Generator
 * Generates mini SVG thumbnails for each chart type using example data
 * 
 * Usage: node scripts/generate-thumbnails.js
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import * as vl from 'vega-lite';
import * as vega from 'vega';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Output directory for thumbnails
const OUTPUT_DIR = join(__dirname, '../frontend/public/thumbnails');

// Thumbnail dimensions
const THUMB_WIDTH = 140;
const THUMB_HEIGHT = 90;

// Mini specs for each chart type with sample data
// These are simplified versions optimized for thumbnail display
const CHART_THUMBNAILS = {
  bar: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 'A', y: 28 },
        { x: 'B', y: 55 },
        { x: 'C', y: 43 },
        { x: 'D', y: 91 },
        { x: 'E', y: 67 }
      ]
    },
    mark: { type: 'bar', cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3 },
    encoding: {
      x: { field: 'x', type: 'nominal', axis: null },
      y: { field: 'y', type: 'quantitative', axis: null },
      color: { value: '#0ea5e9' }
    },
    config: { view: { stroke: null } }
  },

  line: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 0, y: 20 }, { x: 1, y: 35 }, { x: 2, y: 28 },
        { x: 3, y: 55 }, { x: 4, y: 43 }, { x: 5, y: 67 }
      ]
    },
    mark: { type: 'line', strokeWidth: 3 },
    encoding: {
      x: { field: 'x', type: 'quantitative', axis: null },
      y: { field: 'y', type: 'quantitative', axis: null },
      color: { value: '#22c55e' }
    },
    config: { view: { stroke: null } }
  },

  area: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 0, y: 20 }, { x: 1, y: 35 }, { x: 2, y: 28 },
        { x: 3, y: 55 }, { x: 4, y: 43 }, { x: 5, y: 67 }
      ]
    },
    mark: { type: 'area', line: true, opacity: 0.7 },
    encoding: {
      x: { field: 'x', type: 'quantitative', axis: null },
      y: { field: 'y', type: 'quantitative', axis: null },
      color: { value: '#8b5cf6' }
    },
    config: { view: { stroke: null } }
  },

  pie: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_HEIGHT,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { category: 'A', value: 35 },
        { category: 'B', value: 25 },
        { category: 'C', value: 20 },
        { category: 'D', value: 20 }
      ]
    },
    mark: { type: 'arc', outerRadius: 40 },
    encoding: {
      theta: { field: 'value', type: 'quantitative' },
      color: { field: 'category', type: 'nominal', legend: null, scale: { scheme: 'tableau10' } }
    },
    config: { view: { stroke: null } }
  },

  donut: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_HEIGHT,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { category: 'A', value: 35 },
        { category: 'B', value: 25 },
        { category: 'C', value: 20 },
        { category: 'D', value: 20 }
      ]
    },
    mark: { type: 'arc', innerRadius: 20, outerRadius: 40 },
    encoding: {
      theta: { field: 'value', type: 'quantitative' },
      color: { field: 'category', type: 'nominal', legend: null, scale: { scheme: 'tableau10' } }
    },
    config: { view: { stroke: null } }
  },

  scatter: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 10, y: 20 }, { x: 25, y: 35 }, { x: 40, y: 28 },
        { x: 55, y: 55 }, { x: 70, y: 43 }, { x: 85, y: 67 },
        { x: 15, y: 45 }, { x: 60, y: 25 }, { x: 35, y: 60 }
      ]
    },
    mark: { type: 'circle', size: 60, opacity: 0.8 },
    encoding: {
      x: { field: 'x', type: 'quantitative', axis: null },
      y: { field: 'y', type: 'quantitative', axis: null },
      color: { value: '#f97316' }
    },
    config: { view: { stroke: null } }
  },

  bubble: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 10, y: 20, size: 100 }, { x: 30, y: 45, size: 200 },
        { x: 50, y: 30, size: 150 }, { x: 70, y: 60, size: 300 },
        { x: 85, y: 35, size: 180 }
      ]
    },
    mark: { type: 'circle', opacity: 0.7 },
    encoding: {
      x: { field: 'x', type: 'quantitative', axis: null },
      y: { field: 'y', type: 'quantitative', axis: null },
      size: { field: 'size', type: 'quantitative', legend: null },
      color: { value: '#ec4899' }
    },
    config: { view: { stroke: null } }
  },

  heatmap: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 'A', y: '1', v: 28 }, { x: 'B', y: '1', v: 55 }, { x: 'C', y: '1', v: 43 },
        { x: 'A', y: '2', v: 91 }, { x: 'B', y: '2', v: 81 }, { x: 'C', y: '2', v: 53 },
        { x: 'A', y: '3', v: 19 }, { x: 'B', y: '3', v: 87 }, { x: 'C', y: '3', v: 52 }
      ]
    },
    mark: 'rect',
    encoding: {
      x: { field: 'x', type: 'nominal', axis: null },
      y: { field: 'y', type: 'nominal', axis: null },
      color: { field: 'v', type: 'quantitative', legend: null, scale: { scheme: 'viridis' } }
    },
    config: { view: { stroke: null } }
  },

  binned_heatmap: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: Array.from({ length: 100 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100
      }))
    },
    mark: 'rect',
    encoding: {
      x: { bin: { maxbins: 10 }, field: 'x', type: 'quantitative', axis: null },
      y: { bin: { maxbins: 10 }, field: 'y', type: 'quantitative', axis: null },
      color: { aggregate: 'count', type: 'quantitative', legend: null, scale: { scheme: 'plasma' } }
    },
    config: { view: { stroke: null } }
  },

  histogram: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: Array.from({ length: 100 }, () => ({ v: Math.random() * 100 }))
    },
    mark: { type: 'bar', cornerRadiusTopLeft: 2, cornerRadiusTopRight: 2 },
    encoding: {
      x: { bin: { maxbins: 12 }, field: 'v', type: 'quantitative', axis: null },
      y: { aggregate: 'count', type: 'quantitative', axis: null },
      color: { value: '#14b8a6' }
    },
    config: { view: { stroke: null } }
  },

  treemap: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 2,
    background: 'transparent',
    data: {
      values: [
        { id: 1, name: 'A', parent: null, value: null },
        { id: 2, name: 'B', parent: 1, value: 35 },
        { id: 3, name: 'C', parent: 1, value: 25 },
        { id: 4, name: 'D', parent: 1, value: 20 },
        { id: 5, name: 'E', parent: 1, value: 15 },
        { id: 6, name: 'F', parent: 1, value: 5 }
      ]
    },
    transform: [
      { type: 'stratify', key: 'id', parentKey: 'parent' },
      { type: 'treemap', field: 'value', size: [{ signal: 'width' }, { signal: 'height' }] }
    ],
    mark: 'rect',
    encoding: {
      x: { field: 'x0', type: 'quantitative', axis: null },
      x2: { field: 'x1' },
      y: { field: 'y0', type: 'quantitative', axis: null },
      y2: { field: 'y1' },
      color: { field: 'name', type: 'nominal', legend: null, scale: { scheme: 'category10' } }
    },
    config: { view: { stroke: null } }
  },

  gauge: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_HEIGHT,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: { values: [{ value: 72, max: 100 }] },
    layer: [
      {
        mark: { type: 'arc', innerRadius: 25, outerRadius: 38, theta: 0, theta2: 6.28, color: '#334155' }
      },
      {
        mark: { type: 'arc', innerRadius: 25, outerRadius: 38, theta: 0 },
        encoding: {
          theta2: { field: 'value', type: 'quantitative', scale: { domain: [0, 100], range: [0, 6.28] } },
          color: { value: '#22c55e' }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  metric: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 10,
    background: 'transparent',
    data: { values: [{ value: 1234 }] },
    mark: { type: 'text', fontSize: 32, fontWeight: 'bold', color: '#0ea5e9' },
    encoding: {
      text: { field: 'value', type: 'quantitative', format: ',.0f' }
    },
    config: { view: { stroke: null } }
  },

  boxplot: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { cat: 'A', v: 20 }, { cat: 'A', v: 25 }, { cat: 'A', v: 30 }, { cat: 'A', v: 35 }, { cat: 'A', v: 50 },
        { cat: 'B', v: 30 }, { cat: 'B', v: 40 }, { cat: 'B', v: 45 }, { cat: 'B', v: 55 }, { cat: 'B', v: 60 },
        { cat: 'C', v: 15 }, { cat: 'C', v: 25 }, { cat: 'C', v: 35 }, { cat: 'C', v: 40 }, { cat: 'C', v: 70 }
      ]
    },
    mark: { type: 'boxplot', extent: 'min-max' },
    encoding: {
      x: { field: 'cat', type: 'nominal', axis: null },
      y: { field: 'v', type: 'quantitative', axis: null },
      color: { field: 'cat', type: 'nominal', legend: null, scale: { scheme: 'set2' } }
    },
    config: { view: { stroke: null } }
  },

  wordcloud: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { word: 'Data', size: 60 }, { word: 'Viz', size: 45 },
        { word: 'Chart', size: 35 }, { word: 'Graph', size: 30 },
        { word: 'Plot', size: 25 }
      ]
    },
    mark: { type: 'text', fontWeight: 'bold' },
    encoding: {
      text: { field: 'word', type: 'nominal' },
      size: { field: 'size', type: 'quantitative', legend: null, scale: { range: [10, 28] } },
      color: { field: 'word', type: 'nominal', legend: null, scale: { scheme: 'category10' } },
      x: { value: THUMB_WIDTH / 2 },
      y: { value: THUMB_HEIGHT / 2 }
    },
    config: { view: { stroke: null } }
  },

  sankey: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    layer: [
      {
        data: {
          values: [
            { x: 10, y: 10, y2: 35, c: 'A' },
            { x: 10, y: 40, y2: 60, c: 'B' },
            { x: 10, y: 65, y2: 80, c: 'C' }
          ]
        },
        mark: { type: 'rect', width: 15, cornerRadius: 2 },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null, scale: { domain: [0, 140] } },
          y: { field: 'y', type: 'quantitative', axis: null, scale: { domain: [0, 90] } },
          y2: { field: 'y2' },
          color: { field: 'c', type: 'nominal', legend: null, scale: { scheme: 'set2' } }
        }
      },
      {
        data: {
          values: [
            { x: 115, y: 5, y2: 45, c: 'X' },
            { x: 115, y: 50, y2: 85, c: 'Y' }
          ]
        },
        mark: { type: 'rect', width: 15, cornerRadius: 2 },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null, scale: { domain: [0, 140] } },
          y: { field: 'y', type: 'quantitative', axis: null, scale: { domain: [0, 90] } },
          y2: { field: 'y2' },
          color: { field: 'c', type: 'nominal', legend: null, scale: { scheme: 'pastel1' } }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  radial: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_HEIGHT,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { category: 'A', value: 35 },
        { category: 'B', value: 25 },
        { category: 'C', value: 20 },
        { category: 'D', value: 15 },
        { category: 'E', value: 5 }
      ]
    },
    layer: [
      {
        mark: { type: 'arc', innerRadius: 15, outerRadius: 40, stroke: '#1e293b', strokeWidth: 1 },
        encoding: {
          theta: { field: 'value', type: 'quantitative', stack: true },
          radius: { field: 'value', type: 'quantitative', scale: { type: 'sqrt', zero: true, range: [15, 40] } },
          color: { field: 'category', type: 'nominal', legend: null, scale: { scheme: 'tableau10' } }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  radar: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_HEIGHT,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        // Static radar polygon points (pre-calculated)
        { x: 45, y: 10 },   // top
        { x: 75, y: 25 },   // top-right
        { x: 70, y: 60 },   // bottom-right
        { x: 45, y: 75 },   // bottom
        { x: 20, y: 55 },   // bottom-left
        { x: 25, y: 25 },   // top-left
        { x: 45, y: 10 }    // close polygon
      ]
    },
    layer: [
      // Grid circles
      {
        data: { values: [{ r: 1 }, { r: 2 }, { r: 3 }] },
        mark: { type: 'arc', innerRadius: 0, stroke: '#334155', strokeWidth: 1, fill: null },
        encoding: {
          theta: { value: 6.28 },
          radius: { field: 'r', type: 'quantitative', scale: { domain: [0, 3], range: [0, 35] } }
        }
      },
      // Radar polygon
      {
        mark: { type: 'line', strokeWidth: 2, point: { filled: true, size: 40 }, closed: true },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null, scale: { domain: [0, 90] } },
          y: { field: 'y', type: 'quantitative', axis: null, scale: { domain: [0, 90] } },
          color: { value: '#8b5cf6' },
          order: { value: 1 }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  funnel: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { stage: 1, width: 120, y: 10 },
        { stage: 2, width: 90, y: 30 },
        { stage: 3, width: 60, y: 50 },
        { stage: 4, width: 30, y: 70 }
      ]
    },
    mark: { type: 'bar', cornerRadius: 3 },
    encoding: {
      x: { field: 'width', type: 'quantitative', axis: null, scale: { domain: [0, 140] } },
      y: { field: 'y', type: 'quantitative', axis: null, sort: 'descending' },
      color: { field: 'stage', type: 'ordinal', legend: null, scale: { scheme: 'blues' } },
      xOffset: {
        field: 'width',
        type: 'quantitative',
        scale: { domain: [0, 140], range: [60, 0] }
      }
    },
    config: { view: { stroke: null } }
  },

  streamgraph: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 0, y: 20, c: 'A' }, { x: 1, y: 25, c: 'A' }, { x: 2, y: 30, c: 'A' }, { x: 3, y: 20, c: 'A' },
        { x: 0, y: 15, c: 'B' }, { x: 1, y: 20, c: 'B' }, { x: 2, y: 25, c: 'B' }, { x: 3, y: 30, c: 'B' },
        { x: 0, y: 25, c: 'C' }, { x: 1, y: 15, c: 'C' }, { x: 2, y: 20, c: 'C' }, { x: 3, y: 25, c: 'C' }
      ]
    },
    mark: { type: 'area', interpolate: 'monotone' },
    encoding: {
      x: { field: 'x', type: 'quantitative', axis: null },
      y: { field: 'y', type: 'quantitative', axis: null, stack: 'center' },
      color: { field: 'c', type: 'nominal', legend: null, scale: { scheme: 'category10' } }
    },
    config: { view: { stroke: null } }
  },

  density: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: Array.from({ length: 200 }, () => ({ v: (Math.random() + Math.random() + Math.random()) / 3 * 100 }))
    },
    transform: [{ density: 'v', bandwidth: 5 }],
    mark: { type: 'area', opacity: 0.7 },
    encoding: {
      x: { field: 'value', type: 'quantitative', axis: null },
      y: { field: 'density', type: 'quantitative', axis: null },
      color: { value: '#6366f1' }
    },
    config: { view: { stroke: null } }
  },

  waterfall: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { label: 'Start', amount: 100, start: 0, end: 100, color: 'start' },
        { label: '+A', amount: 30, start: 100, end: 130, color: 'positive' },
        { label: '-B', amount: -20, start: 130, end: 110, color: 'negative' },
        { label: '+C', amount: 25, start: 110, end: 135, color: 'positive' },
        { label: 'End', amount: 135, start: 0, end: 135, color: 'end' }
      ]
    },
    mark: { type: 'bar', cornerRadius: 2 },
    encoding: {
      x: { field: 'label', type: 'nominal', axis: null },
      y: { field: 'start', type: 'quantitative', axis: null },
      y2: { field: 'end' },
      color: { 
        field: 'color', 
        type: 'nominal', 
        legend: null,
        scale: { 
          domain: ['start', 'positive', 'negative', 'end'],
          range: ['#64748b', '#22c55e', '#ef4444', '#0ea5e9']
        }
      }
    },
    config: { view: { stroke: null } }
  },

  rolling_average: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 0, y: 20, avg: 22 }, { x: 1, y: 35, avg: 28 }, { x: 2, y: 28, avg: 30 },
        { x: 3, y: 40, avg: 34 }, { x: 4, y: 32, avg: 35 }, { x: 5, y: 45, avg: 38 }
      ]
    },
    layer: [
      {
        mark: { type: 'line', strokeWidth: 1, opacity: 0.5 },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null },
          y: { field: 'y', type: 'quantitative', axis: null },
          color: { value: '#64748b' }
        }
      },
      {
        mark: { type: 'line', strokeWidth: 3 },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null },
          y: { field: 'avg', type: 'quantitative', axis: null },
          color: { value: '#f97316' }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  dual_axis: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 'A', y1: 28, y2: 15 }, { x: 'B', y1: 55, y2: 30 },
        { x: 'C', y1: 43, y2: 45 }, { x: 'D', y1: 70, y2: 60 }
      ]
    },
    layer: [
      {
        mark: { type: 'bar', cornerRadiusTopLeft: 2, cornerRadiusTopRight: 2, opacity: 0.7 },
        encoding: {
          x: { field: 'x', type: 'nominal', axis: null },
          y: { field: 'y1', type: 'quantitative', axis: null },
          color: { value: '#0ea5e9' }
        }
      },
      {
        mark: { type: 'line', strokeWidth: 3, point: { filled: true, size: 60 } },
        encoding: {
          x: { field: 'x', type: 'nominal', axis: null },
          y: { field: 'y2', type: 'quantitative', axis: null },
          color: { value: '#f97316' }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  bullet: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    layer: [
      {
        data: { values: [{ y: 45, width: 120 }] },
        mark: { type: 'bar', height: 25, cornerRadius: 2, color: '#334155' },
        encoding: {
          x: { field: 'width', type: 'quantitative', axis: null, scale: { domain: [0, 140] } },
          y: { field: 'y', type: 'quantitative', axis: null, scale: { domain: [0, 90] } }
        }
      },
      {
        data: { values: [{ y: 45, width: 85 }] },
        mark: { type: 'bar', height: 15, cornerRadius: 2, color: '#0ea5e9' },
        encoding: {
          x: { field: 'width', type: 'quantitative', axis: null },
          y: { field: 'y', type: 'quantitative', axis: null }
        }
      },
      {
        data: { values: [{ y: 45, x: 100 }] },
        mark: { type: 'tick', thickness: 3, color: '#ef4444' },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null },
          y: { field: 'y', type: 'quantitative', axis: null }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  population_pyramid: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { age: '0-14', male: -15, female: 14 },
        { age: '15-29', male: -20, female: 18 },
        { age: '30-44', male: -18, female: 17 },
        { age: '45-59', male: -12, female: 13 },
        { age: '60+', male: -8, female: 10 }
      ]
    },
    layer: [
      {
        mark: { type: 'bar', cornerRadius: 2 },
        encoding: {
          y: { field: 'age', type: 'nominal', axis: null },
          x: { field: 'male', type: 'quantitative', axis: null },
          color: { value: '#0ea5e9' }
        }
      },
      {
        mark: { type: 'bar', cornerRadius: 2 },
        encoding: {
          y: { field: 'age', type: 'nominal', axis: null },
          x: { field: 'female', type: 'quantitative', axis: null },
          color: { value: '#ec4899' }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  lasagna: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 1, y: 'A', v: 30 }, { x: 2, y: 'A', v: 50 }, { x: 3, y: 'A', v: 40 }, { x: 4, y: 'A', v: 70 },
        { x: 1, y: 'B', v: 60 }, { x: 2, y: 'B', v: 30 }, { x: 3, y: 'B', v: 80 }, { x: 4, y: 'B', v: 40 },
        { x: 1, y: 'C', v: 40 }, { x: 2, y: 'C', v: 70 }, { x: 3, y: 'C', v: 50 }, { x: 4, y: 'C', v: 60 }
      ]
    },
    mark: 'rect',
    encoding: {
      x: { field: 'x', type: 'ordinal', axis: null },
      y: { field: 'y', type: 'nominal', axis: null },
      color: { field: 'v', type: 'quantitative', legend: null, scale: { scheme: 'orangered' } }
    },
    config: { view: { stroke: null } }
  },

  trellis_area: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 2,
    background: 'transparent',
    data: {
      values: [
        { x: 0, y: 20, f: 'A' }, { x: 1, y: 35, f: 'A' }, { x: 2, y: 25, f: 'A' },
        { x: 0, y: 30, f: 'B' }, { x: 1, y: 20, f: 'B' }, { x: 2, y: 40, f: 'B' }
      ]
    },
    mark: { type: 'area', opacity: 0.7 },
    encoding: {
      x: { field: 'x', type: 'quantitative', axis: null },
      y: { field: 'y', type: 'quantitative', axis: null },
      color: { field: 'f', type: 'nominal', legend: null, scale: { scheme: 'set2' } },
      column: { field: 'f', type: 'nominal', header: null }
    },
    config: { view: { stroke: null } }
  },

  comet: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 8,
    background: 'transparent',
    data: {
      values: [
        { cat: 'A', x1: 15, x2: 55, y: 15 },
        { cat: 'B', x1: 25, x2: 85, y: 40 },
        { cat: 'C', x1: 20, x2: 65, y: 65 }
      ]
    },
    layer: [
      // Comet tails (gradient effect with multiple lines)
      {
        mark: { type: 'rule', strokeWidth: 8, opacity: 0.2 },
        encoding: {
          x: { field: 'x1', type: 'quantitative', axis: null, scale: { domain: [0, 130] } },
          x2: { field: 'x2' },
          y: { field: 'y', type: 'quantitative', axis: null, scale: { domain: [0, 80] } },
          color: { field: 'cat', type: 'nominal', legend: null, scale: { scheme: 'tableau10' } }
        }
      },
      {
        mark: { type: 'rule', strokeWidth: 4, opacity: 0.5 },
        encoding: {
          x: { field: 'x1', type: 'quantitative', axis: null },
          x2: { field: 'x2' },
          y: { field: 'y', type: 'quantitative', axis: null },
          color: { field: 'cat', type: 'nominal', legend: null, scale: { scheme: 'tableau10' } }
        }
      },
      // Comet heads
      {
        mark: { type: 'circle', size: 120, opacity: 1 },
        encoding: {
          x: { field: 'x2', type: 'quantitative', axis: null },
          y: { field: 'y', type: 'quantitative', axis: null },
          color: { field: 'cat', type: 'nominal', legend: null }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  heatlane: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: Array.from({ length: 50 }, (_, i) => ({ x: i, v: Math.random() * 100 }))
    },
    mark: { type: 'rect', height: 20 },
    encoding: {
      x: { field: 'x', type: 'ordinal', axis: null },
      color: { field: 'v', type: 'quantitative', legend: null, scale: { scheme: 'viridis' } },
      y: { value: THUMB_HEIGHT / 2 - 10 }
    },
    config: { view: { stroke: null } }
  },

  ternary: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_HEIGHT,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 45, y: 75 }, { x: 60, y: 25 }, { x: 30, y: 40 },
        { x: 70, y: 55 }, { x: 50, y: 50 }
      ]
    },
    layer: [
      {
        data: { values: [{ points: '45,5 5,80 85,80' }] },
        mark: { type: 'rule', strokeWidth: 1, color: '#475569' },
        encoding: {}
      },
      {
        mark: { type: 'circle', size: 80, opacity: 0.8 },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null, scale: { domain: [0, 90] } },
          y: { field: 'y', type: 'quantitative', axis: null, scale: { domain: [0, 90] } },
          color: { value: '#8b5cf6' }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  sparkline: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT / 2,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 0, y: 20 }, { x: 1, y: 35 }, { x: 2, y: 28 },
        { x: 3, y: 40 }, { x: 4, y: 32 }, { x: 5, y: 45 },
        { x: 6, y: 38 }, { x: 7, y: 55 }
      ]
    },
    mark: { type: 'line', strokeWidth: 2 },
    encoding: {
      x: { field: 'x', type: 'quantitative', axis: null },
      y: { field: 'y', type: 'quantitative', axis: null },
      color: { value: '#22c55e' }
    },
    config: { view: { stroke: null } }
  },

  error_bars: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 'A', y: 40, ymin: 30, ymax: 50 },
        { x: 'B', y: 55, ymin: 45, ymax: 65 },
        { x: 'C', y: 35, ymin: 25, ymax: 45 },
        { x: 'D', y: 60, ymin: 50, ymax: 70 }
      ]
    },
    layer: [
      {
        mark: { type: 'rule', strokeWidth: 2 },
        encoding: {
          x: { field: 'x', type: 'nominal', axis: null },
          y: { field: 'ymin', type: 'quantitative', axis: null },
          y2: { field: 'ymax' },
          color: { value: '#64748b' }
        }
      },
      {
        mark: { type: 'circle', size: 80 },
        encoding: {
          x: { field: 'x', type: 'nominal', axis: null },
          y: { field: 'y', type: 'quantitative', axis: null },
          color: { value: '#0ea5e9' }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  horizon: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 0, y: 20 }, { x: 1, y: 35 }, { x: 2, y: 55 },
        { x: 3, y: 40 }, { x: 4, y: 70 }, { x: 5, y: 45 }
      ]
    },
    layer: [
      {
        mark: { type: 'area', opacity: 0.3 },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null },
          y: { field: 'y', type: 'quantitative', axis: null },
          color: { value: '#0ea5e9' }
        }
      },
      {
        mark: { type: 'area', opacity: 0.5 },
        transform: [{ calculate: 'max(datum.y - 30, 0)', as: 'y2' }],
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null },
          y: { field: 'y2', type: 'quantitative', axis: null },
          color: { value: '#0ea5e9' }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  circle_packing: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_HEIGHT,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 45, y: 45, r: 35 },
        { x: 30, y: 35, r: 18 },
        { x: 60, y: 55, r: 22 },
        { x: 45, y: 60, r: 12 },
        { x: 55, y: 30, r: 10 }
      ]
    },
    mark: { type: 'circle', opacity: 0.7, stroke: '#1e293b', strokeWidth: 1 },
    encoding: {
      x: { field: 'x', type: 'quantitative', axis: null, scale: { domain: [0, 90] } },
      y: { field: 'y', type: 'quantitative', axis: null, scale: { domain: [0, 90] } },
      size: { field: 'r', type: 'quantitative', legend: null, scale: { range: [200, 2000] } },
      color: { field: 'r', type: 'quantitative', legend: null, scale: { scheme: 'blues' } }
    },
    config: { view: { stroke: null } }
  },

  marimekko: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 0, x2: 40, y: 0, y2: 60, c: 'A1' },
        { x: 0, x2: 40, y: 60, y2: 100, c: 'A2' },
        { x: 40, x2: 100, y: 0, y2: 40, c: 'B1' },
        { x: 40, x2: 100, y: 40, y2: 100, c: 'B2' },
        { x: 100, x2: 130, y: 0, y2: 80, c: 'C1' },
        { x: 100, x2: 130, y: 80, y2: 100, c: 'C2' }
      ]
    },
    mark: { type: 'rect', stroke: '#1e293b', strokeWidth: 1 },
    encoding: {
      x: { field: 'x', type: 'quantitative', axis: null, scale: { domain: [0, 140] } },
      x2: { field: 'x2' },
      y: { field: 'y', type: 'quantitative', axis: null, scale: { domain: [0, 100] } },
      y2: { field: 'y2' },
      color: { field: 'c', type: 'nominal', legend: null, scale: { scheme: 'tableau10' } }
    },
    config: { view: { stroke: null } }
  },

  table: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 },
        { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 },
        { r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }
      ]
    },
    mark: { type: 'rect', stroke: '#475569', strokeWidth: 1, fill: '#1e293b' },
    encoding: {
      x: { field: 'c', type: 'ordinal', axis: null },
      y: { field: 'r', type: 'ordinal', axis: null }
    },
    config: { view: { stroke: null } }
  },

  // Chord diagram - simplified as connected arcs
  chord: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_HEIGHT,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    layer: [
      // Outer ring segments
      {
        data: {
          values: [
            { start: 0, end: 1.5, color: 'A' },
            { start: 1.7, end: 3.0, color: 'B' },
            { start: 3.2, end: 4.5, color: 'C' },
            { start: 4.7, end: 6.0, color: 'D' }
          ]
        },
        mark: { type: 'arc', innerRadius: 32, outerRadius: 38 },
        encoding: {
          theta: { field: 'start', type: 'quantitative' },
          theta2: { field: 'end' },
          color: { field: 'color', type: 'nominal', legend: null, scale: { scheme: 'tableau10' } }
        }
      },
      // Connection ribbons (simplified as curved lines between segments)
      {
        data: {
          values: [
            { x: 20, y: 45 }, { x: 45, y: 60 }, { x: 70, y: 45 },
            { x: 25, y: 30 }, { x: 45, y: 50 }, { x: 65, y: 65 }
          ]
        },
        mark: { type: 'line', strokeWidth: 3, opacity: 0.4, interpolate: 'basis' },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null, scale: { domain: [0, 90] } },
          y: { field: 'y', type: 'quantitative', axis: null, scale: { domain: [0, 90] } },
          color: { value: '#8b5cf6' }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  // Pareto chart - bars with cumulative line
  pareto: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 5,
    background: 'transparent',
    data: {
      values: [
        { x: 'A', bar: 45, line: 45 },
        { x: 'B', bar: 30, line: 75 },
        { x: 'C', bar: 15, line: 90 },
        { x: 'D', bar: 7, line: 97 },
        { x: 'E', bar: 3, line: 100 }
      ]
    },
    layer: [
      {
        mark: { type: 'bar', cornerRadiusTopLeft: 2, cornerRadiusTopRight: 2 },
        encoding: {
          x: { field: 'x', type: 'nominal', axis: null },
          y: { field: 'bar', type: 'quantitative', axis: null, scale: { domain: [0, 100] } },
          color: { value: '#0ea5e9' }
        }
      },
      {
        mark: { type: 'line', strokeWidth: 3, point: { filled: true, size: 40 } },
        encoding: {
          x: { field: 'x', type: 'nominal', axis: null },
          y: { field: 'line', type: 'quantitative', axis: null, scale: { domain: [0, 100] } },
          color: { value: '#f97316' }
        }
      },
      // 80% reference line
      {
        data: { values: [{ y: 80 }] },
        mark: { type: 'rule', strokeDash: [4, 4], strokeWidth: 1 },
        encoding: {
          y: { field: 'y', type: 'quantitative', axis: null },
          color: { value: '#ef4444' }
        }
      }
    ],
    config: { view: { stroke: null } }
  },

  // Violin plot - mirrored density curves
  violin: {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    padding: 8,
    background: 'transparent',
    layer: [
      // Violin shapes (simplified as mirrored area charts)
      {
        data: {
          values: [
            // Violin 1
            { cat: 'A', x: 25, y: 15 }, { cat: 'A', x: 30, y: 25 }, { cat: 'A', x: 35, y: 50 },
            { cat: 'A', x: 30, y: 65 }, { cat: 'A', x: 25, y: 75 },
            // Mirrored
            { cat: 'A', x: 20, y: 75 }, { cat: 'A', x: 15, y: 65 }, { cat: 'A', x: 10, y: 50 },
            { cat: 'A', x: 15, y: 25 }, { cat: 'A', x: 20, y: 15 }, { cat: 'A', x: 25, y: 15 },
            // Violin 2
            { cat: 'B', x: 70, y: 10 }, { cat: 'B', x: 78, y: 30 }, { cat: 'B', x: 80, y: 45 },
            { cat: 'B', x: 75, y: 60 }, { cat: 'B', x: 70, y: 80 },
            // Mirrored
            { cat: 'B', x: 65, y: 80 }, { cat: 'B', x: 60, y: 60 }, { cat: 'B', x: 55, y: 45 },
            { cat: 'B', x: 57, y: 30 }, { cat: 'B', x: 65, y: 10 }, { cat: 'B', x: 70, y: 10 },
            // Violin 3
            { cat: 'C', x: 115, y: 20 }, { cat: 'C', x: 122, y: 35 }, { cat: 'C', x: 120, y: 55 },
            { cat: 'C', x: 115, y: 70 },
            // Mirrored  
            { cat: 'C', x: 110, y: 70 }, { cat: 'C', x: 105, y: 55 }, { cat: 'C', x: 103, y: 35 },
            { cat: 'C', x: 110, y: 20 }, { cat: 'C', x: 115, y: 20 }
          ]
        },
        mark: { type: 'area', opacity: 0.7, line: { strokeWidth: 1 } },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null, scale: { domain: [0, 130] } },
          y: { field: 'y', type: 'quantitative', axis: null, scale: { domain: [0, 90] } },
          color: { field: 'cat', type: 'nominal', legend: null, scale: { scheme: 'set2' } },
          order: { value: 1 }
        }
      },
      // Median lines
      {
        data: {
          values: [
            { x1: 10, x2: 35, y: 50 },
            { x1: 55, x2: 80, y: 45 },
            { x1: 103, x2: 122, y: 45 }
          ]
        },
        mark: { type: 'rule', strokeWidth: 2 },
        encoding: {
          x: { field: 'x1', type: 'quantitative', axis: null },
          x2: { field: 'x2' },
          y: { field: 'y', type: 'quantitative', axis: null },
          color: { value: '#1e293b' }
        }
      }
    ],
    config: { view: { stroke: null } }
  }
};

/**
 * Generate SVG thumbnail for a chart type
 */
async function generateSvg(chartType, spec) {
  try {
    // Compile Vega-Lite to Vega
    const vegaSpec = vl.compile(spec).spec;
    
    // Create Vega view
    const view = new vega.View(vega.parse(vegaSpec), { renderer: 'none' });
    
    // Generate SVG
    const svg = await view.toSVG();
    
    return svg;
  } catch (error) {
    console.error(`Error generating ${chartType}:`, error.message);
    return null;
  }
}

/**
 * Main function to generate all thumbnails
 */
async function main() {
  console.log('🎨 Generating chart thumbnails...\n');
  
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const chartTypes = Object.keys(CHART_THUMBNAILS);
  let successCount = 0;
  let errorCount = 0;
  
  for (const chartType of chartTypes) {
    process.stdout.write(`  Generating ${chartType}... `);
    
    const spec = CHART_THUMBNAILS[chartType];
    const svg = await generateSvg(chartType, spec);
    
    if (svg) {
      const outputPath = join(OUTPUT_DIR, `${chartType}.svg`);
      writeFileSync(outputPath, svg);
      console.log('✓');
      successCount++;
    } else {
      console.log('✗');
      errorCount++;
    }
  }
  
  console.log(`\n✨ Done! Generated ${successCount} thumbnails (${errorCount} errors)`);
  console.log(`   Output: ${OUTPUT_DIR}`);
}

main().catch(console.error);


