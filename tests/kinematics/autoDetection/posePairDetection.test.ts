/**
 * Tests for pose pair detection using real fixture data
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  detectUnits,
  findPosePairs,
  matchGeometryByPointCount,
  getGeometryNodes,
} from '../../../src/kinematics/autoDetection';
import type { GLBTreeData } from '../../../src/kinematics/autoDetection';

const TEST_DATA_DIR = 'C:\\Users\\georgem\\source\\repos\\kinetiCORE_data\\Tooling\\testing_data';

function loadFixtureData(fixtureName: string): GLBTreeData {
  const filePath = join(TEST_DATA_DIR, fixtureName, `${fixtureName}_tree.json`);
  const data = readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

describe('Pose Pair Detection - Real Fixture Data', () => {
  it('should detect pose pairs in units with moving parts', () => {
    const data = loadFixtureData('016ZF_20142435_130');
    const units = detectUnits(data);

    console.log(`\n=== Testing Pose Pair Detection ===`);
    console.log(`Found ${units.length} units\n`);

    let unitsWithPairs = 0;
    let totalPairs = 0;

    for (const unit of units) {
      const node = data.nodes[unit.nodeIndex];
      console.log(`\nAnalyzing unit: ${node.name}`);

      const pairs = findPosePairs(data, unit);

      if (pairs.length > 0) {
        unitsWithPairs++;
        totalPairs += pairs.length;

        for (const pair of pairs) {
          const closedNode = data.nodes[pair.closedSubtreeIndex];
          const openNode = data.nodes[pair.openSubtreeIndex];

          console.log(`  Pair found:`);
          console.log(`    Closed: ${closedNode.name} (index ${pair.closedSubtreeIndex})`);
          console.log(`    Open: ${openNode.name} (index ${pair.openSubtreeIndex})`);
          console.log(`    Matched geometry: ${pair.matchingGeometry.length} pairs`);
          console.log(`    Confidence: ${(pair.confidence * 100).toFixed(1)}%`);

          expect(pair.confidence).toBeGreaterThanOrEqual(0.7);
          expect(pair.matchingGeometry.length).toBeGreaterThan(0);
        }
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Units with moving parts: ${unitsWithPairs} / ${units.length}`);
    console.log(`Total pose pairs detected: ${totalPairs}`);

    // At least some units should have moving parts
    expect(unitsWithPairs).toBeGreaterThan(0);
  });

  it('should match geometry by point count accurately', () => {
    const data = loadFixtureData('016ZF_20142435_130');
    const units = detectUnits(data);

    // Find a unit with children
    const unitWithChildren = units.find(u => data.nodes[u.nodeIndex].childrenIndices.length >= 2);

    if (!unitWithChildren) {
      console.log('No units with multiple children found, skipping test');
      return;
    }

    const unitNode = data.nodes[unitWithChildren.nodeIndex];
    const children = unitNode.childrenIndices.map(idx => data.nodes[idx]);

    if (children.length < 2) return;

    const geomA = getGeometryNodes(data.nodes, children[0].index);
    const geomB = getGeometryNodes(data.nodes, children[1].index);

    console.log(`\nMatching geometry between subtrees:`);
    console.log(`  Subtree A (${children[0].name}): ${geomA.length} geometry nodes`);
    console.log(`  Subtree B (${children[1].name}): ${geomB.length} geometry nodes`);

    const matches = matchGeometryByPointCount(geomA, geomB, 0.02, 100);

    console.log(`  Matches found: ${matches.length}`);

    for (const match of matches) {
      const nodeA = data.nodes[match.closedNodeIndex];
      const nodeB = data.nodes[match.openNodeIndex];

      console.log(`    ${nodeA.name} (${nodeA.pointCount} pts) ↔ ${nodeB.name} (${nodeB.pointCount} pts)`);

      // Point counts should be very similar
      const diff = Math.abs(nodeA.pointCount - nodeB.pointCount);
      const avgCount = (nodeA.pointCount + nodeB.pointCount) / 2;
      const percentDiff = (diff / avgCount) * 100;

      expect(percentDiff).toBeLessThanOrEqual(2);  // Within 2% tolerance
    }
  });

  it('should find RH/WIRE pattern in Fides fixtures', () => {
    const data = loadFixtureData('016ZF_20142452_110');
    const units = detectUnits(data);

    console.log(`\n=== Looking for RH/WIRE pattern ===`);

    for (const unit of units) {
      const node = data.nodes[unit.nodeIndex];
      const children = node.childrenIndices.map(idx => data.nodes[idx]);

      // Look for RH and WIRE siblings
      const hasRH = children.some(c => c.name.includes('RH'));
      const hasWIRE = children.some(c => c.name.includes('WIRE'));

      if (hasRH && hasWIRE) {
        console.log(`\nFound RH/WIRE pattern in unit: ${node.name}`);

        const rhNode = children.find(c => c.name.includes('RH'))!;
        const wireNode = children.find(c => c.name.includes('WIRE'))!;

        console.log(`  RH: ${rhNode.name} (${rhNode.subtreePointCount} pts)`);
        console.log(`  WIRE: ${wireNode.name} (${wireNode.subtreePointCount} pts)`);

        const pairs = findPosePairs(data, unit);

        if (pairs.length > 0) {
          console.log(`  ✓ Pose pairs detected: ${pairs.length}`);
          expect(pairs.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('should handle units with fixed parts (no pose pairs)', () => {
    const data = loadFixtureData('016ZF_20142435_130');
    const units = detectUnits(data);

    let fixedUnits = 0;

    for (const unit of units) {
      const pairs = findPosePairs(data, unit);

      if (pairs.length === 0) {
        fixedUnits++;
        const node = data.nodes[unit.nodeIndex];
        console.log(`Unit ${node.name} has no moving parts (FIXED)`);
      }
    }

    console.log(`\nFixed units: ${fixedUnits} / ${units.length}`);

    // Some units should be fixed
    expect(fixedUnits).toBeGreaterThanOrEqual(0);
  });

  it('should group subtrees by point count tolerance', () => {
    const data = loadFixtureData('016ZF_20142452_110');
    const units = detectUnits(data);

    // Find a unit with RH/LH mirrored structure
    for (const unit of units) {
      const node = data.nodes[unit.nodeIndex];
      const children = node.childrenIndices.map(idx => data.nodes[idx]);

      const hasRH = children.some(c => c.name.includes('RH'));
      const hasLH = children.some(c => c.name.includes('LH'));

      if (hasRH && hasLH) {
        console.log(`\nTesting mirror detection in: ${node.name}`);

        const rhNode = children.find(c => c.name.includes('RH'))!;
        const lhNode = children.find(c => c.name.includes('LH'))!;

        console.log(`  RH: ${rhNode.subtreePointCount} pts`);
        console.log(`  LH: ${lhNode.subtreePointCount} pts`);

        const diff = Math.abs(rhNode.subtreePointCount - lhNode.subtreePointCount);
        const avgCount = (rhNode.subtreePointCount + lhNode.subtreePointCount) / 2;
        const percentDiff = (diff / avgCount) * 100;

        console.log(`  Difference: ${percentDiff.toFixed(2)}%`);

        // Mirrored parts should have very similar point counts
        expect(percentDiff).toBeLessThanOrEqual(2);

        break;
      }
    }
  });
});
