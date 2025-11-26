/**
 * Demo script to test automatic kinematics detection on real fixture data.
 * Run with: npx tsx src/kinematics/autoDetection/demo.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  detectUnits,
  findPosePairs,
  getGeometryNodes,
} from './index';
import type { GLBTreeData } from './types';

const TEST_DATA_DIR = 'C:\\Users\\georgem\\source\\repos\\kinetiCORE_data\\Tooling\\testing_data';

function loadFixtureData(fixtureName: string): GLBTreeData {
  const filePath = join(TEST_DATA_DIR, fixtureName, `${fixtureName}_tree.json`);
  const data = readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

function analyzeFixture(fixtureName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Analyzing Fixture: ${fixtureName}`);
  console.log('='.repeat(80));

  const data = loadFixtureData(fixtureName);

  console.log(`\nFile Info:`);
  console.log(`  Total nodes: ${data.summary.totalNodes.toLocaleString()}`);
  console.log(`  Total points: ${data.summary.totalPointCount.toLocaleString()}`);
  console.log(`  Max depth: ${data.summary.maxDepth}`);
  console.log(`  Nodes with geometry: ${data.summary.nodesWithGeometry.toLocaleString()}`);

  // Step 1: Unit Detection
  console.log(`\n${'─'.repeat(80)}`);
  console.log('STEP 1: Unit Detection');
  console.log('─'.repeat(80));

  const units = detectUnits(data);

  const totalCoverage = units.reduce((sum, u) => sum + u.subtreePointCount, 0);
  const coveragePercent = (totalCoverage / data.summary.totalPointCount) * 100;

  console.log(`\nDetected ${units.length} units (${coveragePercent.toFixed(1)}% coverage):\n`);

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const node = data.nodes[unit.nodeIndex];
    const geomNodes = getGeometryNodes(data.nodes, unit.nodeIndex);

    console.log(`${i + 1}. ${node.name}`);
    console.log(`   Index: ${unit.nodeIndex}, Depth: ${unit.depth}`);
    console.log(`   Points: ${unit.subtreePointCount.toLocaleString()} (${unit.percentOfTotal.toFixed(1)}%)`);
    console.log(`   Children: ${unit.childCount}, Geometry nodes: ${geomNodes.length}`);
  }

  // Step 2: Pose Pair Detection
  console.log(`\n${'─'.repeat(80)}`);
  console.log('STEP 2: Pose Pair Detection');
  console.log('─'.repeat(80));

  let unitsWithPairs = 0;
  let totalPairs = 0;

  for (const unit of units) {
    const node = data.nodes[unit.nodeIndex];
    const pairs = findPosePairs(data, unit);

    if (pairs.length > 0) {
      unitsWithPairs++;
      totalPairs += pairs.length;

      console.log(`\n✓ ${node.name}: ${pairs.length} pose pair(s) detected`);

      for (const pair of pairs) {
        const closedNode = data.nodes[pair.closedSubtreeIndex];
        const openNode = data.nodes[pair.openSubtreeIndex];

        console.log(`  Closed pose: ${closedNode.name} (index ${pair.closedSubtreeIndex}, ${closedNode.subtreePointCount} pts)`);
        console.log(`  Open pose:   ${openNode.name} (index ${pair.openSubtreeIndex}, ${openNode.subtreePointCount} pts)`);
        console.log(`  Matched geometry: ${pair.matchingGeometry.length} pairs`);
        console.log(`  Confidence: ${(pair.confidence * 100).toFixed(1)}%`);

        // Show first few geometry matches
        console.log(`  Sample matches:`);
        for (let i = 0; i < Math.min(3, pair.matchingGeometry.length); i++) {
          const match = pair.matchingGeometry[i];
          const nodeA = data.nodes[match.closedNodeIndex];
          const nodeB = data.nodes[match.openNodeIndex];
          console.log(`    ${nodeA.name || '(unnamed)'} (${nodeA.pointCount} pts) ↔ ${nodeB.name || '(unnamed)'} (${nodeB.pointCount} pts)`);
        }
        if (pair.matchingGeometry.length > 3) {
          console.log(`    ... and ${pair.matchingGeometry.length - 3} more`);
        }
      }
    } else {
      console.log(`\n○ ${node.name}: No moving parts (FIXED)`);
    }
  }

  console.log(`\n${'─'.repeat(80)}`);
  console.log('Summary');
  console.log('─'.repeat(80));
  console.log(`Units detected: ${units.length}`);
  console.log(`Units with moving parts: ${unitsWithPairs}`);
  console.log(`Total pose pairs: ${totalPairs}`);
  console.log(`Coverage: ${coveragePercent.toFixed(1)}%`);
}

// Main execution
console.log('\n');
console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
console.log('║          AUTOMATIC FIXTURE KINEMATICS DETECTION - DEMO                       ║');
console.log('║          Name-Agnostic Unit and Pose Pair Detection                          ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');

const fixtures = [
  '016ZF_20142435_130',
  '016ZF_20142452_110',
  '2174530000_M00_GJR_RR FLR_CM030_T01',
];

for (const fixture of fixtures) {
  try {
    analyzeFixture(fixture);
  } catch (error) {
    console.error(`\nError analyzing ${fixture}:`, error);
  }
}

console.log(`\n${'='.repeat(80)}`);
console.log('Analysis complete!');
console.log(`${'='.repeat(80)}\n`);
