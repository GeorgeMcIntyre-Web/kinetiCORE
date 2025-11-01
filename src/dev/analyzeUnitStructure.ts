/**
 * Proper Unit Structure Analyzer
 *
 * Correctly identifies UNIT_XXX as the unit container,
 * and finds RH/LH joint pairs WITHIN each unit.
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

interface UnitStructure {
  unitName: string; // e.g., "UNIT_112"
  unitNode: BABYLON.TransformNode;
  uniqueId: number;
  joints: JointPair[];
  children: BABYLON.Node[];
}

interface JointPair {
  jointName: string; // e.g., "RH/LH pair 1"
  fixed: BABYLON.TransformNode;
  moving: BABYLON.TransformNode;
  fixedId: number;
  movingId: number;
  dimensions: [number, number, number];
  similarity: number;
  distance: number;
}

/**
 * Compute bounding box for a node
 */
function computeBoundingBox(node: BABYLON.TransformNode): {
  dimensions: [number, number, number];
  volume: number;
} | null {
  node.computeWorldMatrix(true);
  const meshes = node.getChildMeshes(false) as BABYLON.AbstractMesh[];

  if (meshes.length === 0) {
    return null;
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const bbox = mesh.getBoundingInfo().boundingBox;

    minX = Math.min(minX, bbox.minimumWorld.x);
    minY = Math.min(minY, bbox.minimumWorld.y);
    minZ = Math.min(minZ, bbox.minimumWorld.z);
    maxX = Math.max(maxX, bbox.maximumWorld.x);
    maxY = Math.max(maxY, bbox.maximumWorld.y);
    maxZ = Math.max(maxZ, bbox.maximumWorld.z);
  }

  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;

  const dimensions: [number, number, number] = [sizeX, sizeY, sizeZ].sort((a, b) => a - b) as [number, number, number];
  const volume = sizeX * sizeY * sizeZ;

  return { dimensions, volume };
}

/**
 * Compute dimension similarity (0-1)
 */
function computeSimilarity(dims1: [number, number, number], dims2: [number, number, number]): number {
  const diff_small = Math.abs(dims1[0] - dims2[0]) / Math.max(dims1[0], dims2[0]);
  const diff_med = Math.abs(dims1[1] - dims2[1]) / Math.max(dims1[1], dims2[1]);
  const diff_large = Math.abs(dims1[2] - dims2[2]) / Math.max(dims1[2], dims2[2]);

  const weightedDiff = (diff_small * 0.2 + diff_med * 0.3 + diff_large * 0.5);
  return Math.max(0, 1 - weightedDiff);
}

/**
 * Find joint pairs within a unit by matching RH/LH or similar patterns
 */
function findJointPairsInUnit(unitNode: BABYLON.TransformNode): JointPair[] {
  const pairs: JointPair[] = [];
  const children = unitNode.getChildren();

  // Get all TransformNode children with geometry
  const transformNodes: BABYLON.TransformNode[] = [];
  for (const child of children) {
    if (child instanceof BABYLON.TransformNode && !(child instanceof BABYLON.AbstractMesh)) {
      const meshes = child.getChildMeshes(false);
      if (meshes.length > 0) {
        transformNodes.push(child);
      }
    }
  }

  console.log(`    [${unitNode.name}] Found ${transformNodes.length} transform nodes with geometry`);

  // Compute bounding boxes for all nodes
  const nodeData = transformNodes.map(node => ({
    node,
    bbox: computeBoundingBox(node),
    name: node.name
  })).filter(d => d.bbox !== null);

  console.log(`    [${unitNode.name}] Computed ${nodeData.length} bounding boxes`);

  // Find matching pairs by dimension similarity
  for (let i = 0; i < nodeData.length; i++) {
    for (let j = i + 1; j < nodeData.length; j++) {
      const data1 = nodeData[i];
      const data2 = nodeData[j];

      if (!data1.bbox || !data2.bbox) continue;

      // Volume filter
      const volumeRatio = data1.bbox.volume / data2.bbox.volume;
      if (volumeRatio < 0.9 || volumeRatio > 1.1) continue;

      // Dimension similarity
      const similarity = computeSimilarity(data1.bbox.dimensions, data2.bbox.dimensions);

      if (similarity >= 0.90) {
        // Found a match! Determine which is fixed/moving
        const pos1 = data1.node.getAbsolutePosition();
        const pos2 = data2.node.getAbsolutePosition();
        const distance = BABYLON.Vector3.Distance(pos1, pos2);

        // Heuristic: Check names for hints
        const name1Lower = data1.name.toLowerCase();
        const name2Lower = data2.name.toLowerCase();

        let fixed = data1.node;
        let moving = data2.node;
        let fixedId = data1.node.uniqueId;
        let movingId = data2.node.uniqueId;

        // Name-based classification
        if (name1Lower.includes('moving') || name1Lower.includes('extended')) {
          [fixed, moving] = [moving, fixed];
          [fixedId, movingId] = [movingId, fixedId];
        } else if (name2Lower.includes('fixed') || name2Lower.includes('retracted')) {
          [fixed, moving] = [moving, fixed];
          [fixedId, movingId] = [movingId, fixedId];
        }

        // Determine joint name from node names
        let jointName = 'Unknown';
        if (name1Lower.includes('rh') && name2Lower.includes('rh')) {
          jointName = 'RH';
        } else if (name1Lower.includes('lh') && name2Lower.includes('lh')) {
          jointName = 'LH';
        } else if (name1Lower.includes('wire') || name2Lower.includes('wire')) {
          jointName = 'WIRE';
        }

        pairs.push({
          jointName,
          fixed,
          moving,
          fixedId,
          movingId,
          dimensions: data1.bbox.dimensions,
          similarity,
          distance
        });

        console.log(`    [${unitNode.name}] ✓ Found joint pair: ${jointName}`);
        console.log(`      Fixed:  ${fixed.name} (uid: ${fixedId})`);
        console.log(`      Moving: ${moving.name} (uid: ${movingId})`);
        console.log(`      Similarity: ${(similarity * 100).toFixed(1)}%`);
        console.log(`      Distance: ${distance.toFixed(4)}m`);
      }
    }
  }

  return pairs;
}

/**
 * Analyze all units in the loaded GLB
 */
export async function analyzeUnitStructure(scene: BABYLON.Scene): Promise<{
  units: UnitStructure[];
  totalJoints: number;
  report: string;
}> {
  console.log('================================================================================');
  console.log('UNIT STRUCTURE ANALYSIS');
  console.log('================================================================================');
  console.log('Analyzing loaded scene for UNIT_XXX structures...\n');

  const units: UnitStructure[] = [];

  // Find all UNIT_XXX nodes in the scene
  const allNodes = scene.transformNodes;
  const unitNodes = allNodes.filter(node => /UNIT_\d+/i.test(node.name));

  console.log(`[SCAN] Found ${unitNodes.length} UNIT_XXX nodes\n`);

  for (const unitNode of unitNodes) {
    console.log(`[UNIT] Analyzing ${unitNode.name}...`);

    const children = unitNode.getChildren();
    console.log(`  - Children: ${children.length}`);

    // Find joint pairs within this unit
    const joints = findJointPairsInUnit(unitNode);

    units.push({
      unitName: unitNode.name,
      unitNode,
      uniqueId: unitNode.uniqueId,
      joints,
      children
    });

    console.log(`  - Joints found: ${joints.length}\n`);
  }

  // Calculate totals
  const totalJoints = units.reduce((sum, unit) => sum + unit.joints.length, 0);

  // Print summary
  console.log('================================================================================');
  console.log('SUMMARY');
  console.log('================================================================================');
  console.log(`Total units: ${units.length}`);
  console.log(`Total joints: ${totalJoints}\n`);

  console.log('UNITS WITH JOINTS:');
  units.forEach(unit => {
    if (unit.joints.length > 0) {
      console.log(`  ${unit.unitName}: ${unit.joints.length} joint(s)`);
      unit.joints.forEach(joint => {
        console.log(`    - ${joint.jointName}: ${joint.fixed.name} ↔ ${joint.moving.name}`);
      });
    }
  });

  console.log('\nUNITS WITHOUT JOINTS:');
  units.forEach(unit => {
    if (unit.joints.length === 0) {
      console.log(`  ${unit.unitName}: 0 joints (${unit.children.length} children)`);
    }
  });

  console.log('\n================================================================================');

  const report = [
    'UNIT STRUCTURE ANALYSIS REPORT',
    '='.repeat(80),
    `Total units: ${units.length}`,
    `Total joints detected: ${totalJoints}`,
    '',
    'BREAKDOWN:',
    ...units.map(u => `  ${u.unitName}: ${u.joints.length} joint(s)`),
    '',
    '='.repeat(80)
  ].join('\n');

  return {
    units,
    totalJoints,
    report
  };
}

/**
 * Export to window for browser console
 */
if (typeof window !== 'undefined') {
  (window as any).analyzeUnitStructure = analyzeUnitStructure;
}
