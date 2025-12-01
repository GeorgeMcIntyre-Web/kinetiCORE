// Minimal test to debug the issue
console.log('=== TEST SCRIPT STARTING ===');
process.stderr.write('Error stream test\n');

import * as fs from 'fs';
import * as path from 'path';

console.log('Imports successful');

const FIXTURES_BASE = process.env.KINETICORE_DATA_ROOT 
  ? path.join(process.env.KINETICORE_DATA_ROOT, 'Tooling', 'testing_data')
  : 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data';

console.log('Fixtures base:', FIXTURES_BASE);

// Test first fixture
const testFixture = {
  name: '8X Station 140',
  glbPath: path.join(FIXTURES_BASE, '8X-140_GEO/016ZF_20142435_140_CI00.glb'),
  jsonPath: path.join(FIXTURES_BASE, '8X-140_GEO/016ZF_20142435_140_CI00_tree.json'),
};

console.log('Testing paths:');
console.log('  GLB:', testFixture.glbPath);
console.log('  JSON:', testFixture.jsonPath);
console.log('  GLB exists:', fs.existsSync(testFixture.glbPath));
console.log('  JSON exists:', fs.existsSync(testFixture.jsonPath));

if (fs.existsSync(testFixture.jsonPath)) {
  console.log('Loading JSON...');
  const data = JSON.parse(fs.readFileSync(testFixture.jsonPath, 'utf-8'));
  console.log('JSON loaded, nodes:', data.nodes?.length || 0);
  
  if (data.nodes && data.nodes.length > 0) {
    console.log('First 5 nodes:');
    data.nodes.slice(0, 5).forEach((node: any, i: number) => {
      console.log(`  ${i}: ${node.name}, points: ${node.subtreePointCount || 0}`);
    });
  }
}

console.log('=== TEST SCRIPT COMPLETE ===');
process.exit(0);

