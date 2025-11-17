/**
 * Standalone test script for running StructureBasedToolAnalyzer on multiple GLB files
 * Run with: node run-glb-tests.mjs
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

const testFiles = [
  {
    name: '8X-140_GEO (Original)',
    path: path.resolve(process.cwd(), '..', 'kinetiCORE_data', 'Tooling', 'testing_data', '8X-140_GEO', '016ZF_20142435_140_CI00.glb'),
    expectedUnits: 9,
    expectedJoints: 6,
    unitsWithJoints: 4,
  },
  {
    name: '8X-140-1E1_LH',
    path: path.resolve(process.cwd(), '..', 'kinetiCORE_data', 'Tooling', 'testing_data', '8X-140-1E1_LH', '016ZF_20142435_140_1E1_CI00.glb'),
  },
  {
    name: '8X-140-2E1_RH',
    path: path.resolve(process.cwd(), '..', 'kinetiCORE_data', 'Tooling', 'testing_data', '8X-140-2E1_RH', '016ZF_20142435_140_2E1_CI00.glb'),
  },
  {
    name: '016ZF_20142435_130',
    path: path.resolve(process.cwd(), '..', 'kinetiCORE_data', 'Tooling', 'testing_data', '016ZF_20142435_130', '016ZF_20142435_130.glb'),
  },
];

console.log('='.repeat(80));
console.log('StructureBasedToolAnalyzer - Multiple GLB File Tests');
console.log('='.repeat(80));
console.log('');

console.log('Checking GLB files...');
console.log('');

const results = [];

for (const testFile of testFiles) {
  const exists = existsSync(testFile.path);
  const size = exists ? (readFileSync(testFile.path).length / (1024 * 1024)).toFixed(2) : 'N/A';

  results.push({
    name: testFile.name,
    path: testFile.path,
    exists,
    size: exists ? `${size} MB` : 'NOT FOUND',
    expected: testFile.expectedUnits !== undefined
      ? `${testFile.expectedUnits} units, ${testFile.expectedJoints} joints, ${testFile.unitsWithJoints} with joints`
      : 'Unknown (will discover)',
  });
}

// Print results table
console.log('File Status:');
console.log('-'.repeat(80));
results.forEach((result, index) => {
  console.log(`[${index + 1}/${results.length}] ${result.name}`);
  console.log(`    Path: ${result.path}`);
  console.log(`    Status: ${result.exists ? '✅ Found' : '❌ NOT FOUND'}`);
  if (result.exists) {
    console.log(`    Size: ${result.size}`);
    console.log(`    Expected: ${result.expected}`);
  }
  console.log('');
});

const foundFiles = results.filter(r => r.exists);
console.log('='.repeat(80));
console.log(`Summary: ${foundFiles.length}/${results.length} files found`);
console.log('='.repeat(80));
console.log('');

if (foundFiles.length > 0) {
  console.log('To run the actual analyzer tests, use:');
  console.log('npm test -- tests/babylon/sceneAnalysis/StructureBasedToolAnalyzer.test.ts --run');
  console.log('');
  console.log('Note: The test file currently uses the first GLB (8X-140_GEO).');
  console.log('Update the glbPath in the test file to test other GLBs individually.');
} else {
  console.log('❌ No GLB files found. Please check the paths.');
}
