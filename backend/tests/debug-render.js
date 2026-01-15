import * as vega from 'vega';
import * as vegaLite from 'vega-lite';

// Simple test spec
const spec = {
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  data: { values: [{a: 'A', b: 28}, {a: 'B', b: 55}, {a: 'C', b: 43}] },
  mark: 'bar',
  encoding: {
    x: {field: 'a', type: 'nominal'},
    y: {field: 'b', type: 'quantitative'}
  },
  width: 400,
  height: 300
};

console.log('=== Testing Vega Rendering ===\n');

const compiled = vegaLite.compile(spec);
console.log('Compiled Vega spec successfully');

const runtime = vega.parse(compiled.spec);
console.log('Parsed runtime successfully');

const view = new vega.View(runtime, { renderer: 'none' });
console.log('Created view with renderer: none');

await view.runAsync();
console.log('View run completed');

// Test toCanvas - it should return a canvas
console.log('\n=== Testing toCanvas() ===');
const canvas = await view.toCanvas();
console.log('Canvas returned:', !!canvas);
console.log('Canvas type:', typeof canvas);
console.log('Canvas constructor:', canvas?.constructor?.name);
console.log('Has toBuffer:', typeof canvas?.toBuffer);
console.log('Canvas width:', canvas?.width);
console.log('Canvas height:', canvas?.height);

if (canvas && canvas.toBuffer) {
  const buffer = canvas.toBuffer('image/png');
  console.log('\n=== PNG Buffer ===');
  console.log('Buffer length:', buffer.length, 'bytes');
  console.log('First 8 bytes (hex):', buffer.slice(0, 8).toString('hex'));
  console.log('Expected PNG magic:   89504e470d0a1a0a');
  console.log('Is valid PNG:', buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a');
  
  // Save for inspection
  import('fs').then(fs => {
    fs.writeFileSync('tests/debug-output.png', buffer);
    console.log('\nSaved to tests/debug-output.png');
  });
}
