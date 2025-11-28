/**
 * Tests for automatic unit detection using real fixture data
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { detectUnits, getGeometryNodes } from '../../../src/kinematics/autoDetection';
import type { GLBTreeData } from '../../../src/kinematics/autoDetection';

const TEST_DATA_DIR = 'C:\\Users\\georgem\\source\\repos\\kinetiCORE_data\\Tooling\\testing_data';

function loadFixtureData(fixtureName: string): GLBTreeData {
  const filePath = join(TEST_DATA_DIR, fixtureName, `${fixtureName}_tree.json`);
  const data = readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

describe('Unit Detection - Real Fixture Data', () => {
  it('should detect units in 016ZF_20142435_130 (Fides format)', () => {
    const data = loadFixtureData('016ZF_20142435_130');

    console.log(`\n=== Testing ${data.nodes[0].name} ===`);
    console.log(`Total nodes: ${data.summary.totalNodes}`);
    console.log(`Total points: ${data.summary.totalPointCount.toLocaleString()}`);

    const units = detectUnits(data);

    // Validate results
    expect(units.length).toBeGreaterThanOrEqual(2);
    expect(units.length).toBeLessThanOrEqual(50);

    // Check total coverage
    const totalCoverage = units.reduce((sum, u) => sum + u.subtreePointCount, 0);
    const coveragePercent = (totalCoverage / data.summary.totalPointCount) * 100;

    console.log(`\nDetected ${units.length} units with ${coveragePercent.toFixed(1)}% coverage`);

    expect(coveragePercent).toBeGreaterThanOrEqual(85);
    expect(coveragePercent).toBeLessThanOrEqual(100);

    // Log unit details
    console.log('\nUnit Details:');
    for (const unit of units) {
      const node = data.nodes[unit.nodeIndex];
      console.log(`  ${node.name}: ${unit.subtreePointCount.toLocaleString()} pts (${unit.percentOfTotal.toFixed(1)}%)`);
    }
  });

  it('should detect units in 016ZF_20142452_110 (larger fixture)', () => {
    const data = loadFixtureData('016ZF_20142452_110');

    console.log(`\n=== Testing ${data.nodes[0].name} ===`);
    console.log(`Total nodes: ${data.summary.totalNodes}`);
    console.log(`Total points: ${data.summary.totalPointCount.toLocaleString()}`);

    const units = detectUnits(data);

    expect(units.length).toBeGreaterThanOrEqual(2);

    const totalCoverage = units.reduce((sum, u) => sum + u.subtreePointCount, 0);
    const coveragePercent = (totalCoverage / data.summary.totalPointCount) * 100;

    console.log(`\nDetected ${units.length} units with ${coveragePercent.toFixed(1)}% coverage`);

    expect(coveragePercent).toBeGreaterThanOrEqual(85);
  });

  it('should detect units in 2174530000_M00_GJR (GM format)', () => {
    const data = loadFixtureData('2174530000_M00_GJR_RR FLR_CM030_T01');

    console.log(`\n=== Testing GM-style fixture ===`);
    console.log(`Total nodes: ${data.summary.totalNodes}`);
    console.log(`Total points: ${data.summary.totalPointCount.toLocaleString()}`);

    const units = detectUnits(data);

    expect(units.length).toBeGreaterThanOrEqual(2);

    const totalCoverage = units.reduce((sum, u) => sum + u.subtreePointCount, 0);
    const coveragePercent = (totalCoverage / data.summary.totalPointCount) * 100;

    console.log(`\nDetected ${units.length} units with ${coveragePercent.toFixed(1)}% coverage`);

    expect(coveragePercent).toBeGreaterThanOrEqual(80);  // Slightly lower threshold for different format
  });

  it('should filter units by point count thresholds', () => {
    const data = loadFixtureData('016ZF_20142435_130');
    const units = detectUnits(data);

    for (const unit of units) {
      const percent = unit.percentOfTotal;

      // Each unit should be 1-60% of total
      expect(percent).toBeGreaterThanOrEqual(1.0);
      expect(percent).toBeLessThanOrEqual(60.0);
    }
  });

  it('should extract geometry nodes from units', () => {
    const data = loadFixtureData('016ZF_20142435_130');
    const units = detectUnits(data);

    expect(units.length).toBeGreaterThan(0);

    const firstUnit = units[0];
    const geometryNodes = getGeometryNodes(data.nodes, firstUnit.nodeIndex);

    console.log(`\nFirst unit has ${geometryNodes.length} geometry nodes`);

    expect(geometryNodes.length).toBeGreaterThan(0);

    // All geometry nodes should have meshes and points
    for (const node of geometryNodes) {
      expect(node.meshIndex).not.toBeNull();
      expect(node.pointCount).toBeGreaterThan(0);
    }
  });

  it('should handle pass-through container nodes', () => {
    const data = loadFixtureData('016ZF_20142435_130');

    // Check if depth-1 is a pass-through
    const depth1Children = data.nodes.filter(n => n.depth === 1);

    if (depth1Children.length === 1) {
      const child = depth1Children[0];
      const ratio = child.subtreePointCount / data.summary.totalPointCount;

      if (ratio > 0.95) {
        console.log(`\nDetected pass-through node at depth 1: ${child.name} (${(ratio * 100).toFixed(1)}%)`);

        // Units should be detected at depth 2 instead
        const units = detectUnits(data);
        const unitDepth = units[0]?.depth;

        expect(unitDepth).toBe(2);
      }
    }
  });
});
