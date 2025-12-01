/**
 * ICP Verification Script for Real Tooling Fixtures
 * 
 * Runs ICP verification on 4 fixtures with RMSE validation:
 * - 8X Station 140: 4 joints (RMSE target: 0.01mm)
 * - 5X Station 110: 12 joints (RMSE target: 0.01mm)
 * - 8X Station 130: 16 joints (RMSE target: 0.01mm)
 * - Floor Clamp: 10 joints (RMSE target: 0.04mm, can start with 0.1mm)
 * 
 * Uses name and structure agnostic detection via statistical pairing.
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import * as fs from 'fs';
import * as path from 'path';
import {
  extractPosePairVertices,
  matrixToAxisAngle,
  classifyJoint,
  type GLBTreeData,
} from '../src/kinematics/autoDetection';
import { runICPWithOpen3D } from '../src/kinematics/autoDetection/icpOpen3D';

BABYLON.DracoCompression.DefaultNumWorkers = 0;

// Base path for fixtures - handle both with and without Tooling/testing_data
const getFixturesBase = (): string => {
  if (process.env.KINETICORE_DATA_ROOT) {
    const base = process.env.KINETICORE_DATA_ROOT;
    // If it already includes Tooling/testing_data, use it as-is
    if (base.includes('Tooling') && base.includes('testing_data')) {
      return base;
    }
    // Otherwise add Tooling/testing_data
    return path.join(base, 'Tooling', 'testing_data');
  }
  return 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data';
};

const FIXTURES_BASE = getFixturesBase();

interface FixtureConfig {
  name: string;
  fixtureId: string;
  glbPath: string;
  jsonPath: string;
  expectedJoints: number;
  rmseThreshold: number; // in meters
  expectedUnits: Array<{
    unitName: string;
    jointCount: number;
    jointType: 'revolute' | 'prismatic';
  }>;
}

const FIXTURES: FixtureConfig[] = [
  {
    name: '8X Station 140',
    fixtureId: '8X-140_GEO',
    glbPath: path.join(FIXTURES_BASE, '8X-140_GEO', '016ZF_20142435_140_CI00.glb'),
    jsonPath: path.join(FIXTURES_BASE, '8X-140_GEO', '016ZF_20142435_140_CI00_tree.json'),
    expectedJoints: 4,
    rmseThreshold: 0.00001, // 0.01mm
    expectedUnits: [
      { unitName: 'UNIT_102', jointCount: 2, jointType: 'revolute' },
      { unitName: 'UNIT_106', jointCount: 2, jointType: 'revolute' },
    ],
  },
  {
    name: '5X Station 110',
    fixtureId: '016ZF_20142452_110',
    glbPath: path.join(FIXTURES_BASE, '016ZF_20142452_110', '016ZF_20142452_110.glb'),
    jsonPath: path.join(FIXTURES_BASE, '016ZF_20142452_110', '016ZF_20142452_110_tree.json'),
    expectedJoints: 12,
    rmseThreshold: 0.00001, // 0.01mm
    expectedUnits: [
      { unitName: 'UNIT_104', jointCount: 1, jointType: 'prismatic' },
      { unitName: 'UNIT_105', jointCount: 1, jointType: 'prismatic' },
      { unitName: 'UNIT_108', jointCount: 2, jointType: 'prismatic' },
      { unitName: 'UNIT_112', jointCount: 2, jointType: 'revolute' },
      { unitName: 'UNIT_114', jointCount: 2, jointType: 'revolute' },
      { unitName: 'UNIT_116', jointCount: 2, jointType: 'revolute' },
      { unitName: 'UNIT_120', jointCount: 2, jointType: 'revolute' },
    ],
  },
  {
    name: '8X Station 130',
    fixtureId: '016ZF_20142435_130',
    glbPath: path.join(FIXTURES_BASE, '016ZF_20142435_130', '016ZF_20142435_130.glb'),
    jsonPath: path.join(FIXTURES_BASE, '016ZF_20142435_130', '016ZF_20142435_130_tree.json'),
    expectedJoints: 16,
    rmseThreshold: 0.00001, // 0.01mm
    expectedUnits: [
      { unitName: 'UNIT_114', jointCount: 2, jointType: 'revolute' },
      { unitName: 'UNIT_112', jointCount: 2, jointType: 'revolute' },
      { unitName: 'UNIT_110', jointCount: 2, jointType: 'revolute' },
      { unitName: 'UNIT_108', jointCount: 2, jointType: 'revolute' },
      { unitName: 'UNIT_107', jointCount: 1, jointType: 'revolute' },
      { unitName: 'UNIT_106', jointCount: 1, jointType: 'revolute' },
      { unitName: 'UNIT_104', jointCount: 2, jointType: 'revolute' },
      { unitName: 'UNIT_102', jointCount: 2, jointType: 'revolute' },
      { unitName: 'UNIT_116', jointCount: 2, jointType: 'revolute' },
    ],
  },
  {
    name: 'Floor Clamp',
    fixtureId: '2174530000_M00_GJR_RR FLR_CM030_T01',
    glbPath: path.join(FIXTURES_BASE, '2174530000_M00_GJR_RR FLR_CM030_T01', '2174530000_M00_GJR_RR FLR_CM030_T01.glb'),
    jsonPath: path.join(FIXTURES_BASE, '2174530000_M00_GJR_RR FLR_CM030_T01', '2174530000_M00_GJR_RR FLR_CM030_T01_tree.json'),
    expectedJoints: 10,
    rmseThreshold: 0.0001, // 0.1mm (can tighten to 0.04mm later)
    expectedUnits: [
      { unitName: '2174530040_M00_CLAMP UNIT_040', jointCount: 1, jointType: 'revolute' },
      { unitName: '2174530060_M00_CLAMP UNIT_060', jointCount: 1, jointType: 'revolute' },
      { unitName: '2174530080_M00_CLAMP UNIT_080', jointCount: 1, jointType: 'revolute' },
      { unitName: '2174530100_M00_CLAMP UNIT_100_SYM_080', jointCount: 1, jointType: 'revolute' },
      { unitName: '2174530120_M00_CLAMP UNIT_120', jointCount: 1, jointType: 'revolute' },
      { unitName: '2174530260_M00_CLAMP UNIT_260_SYM_240', jointCount: 1, jointType: 'revolute' },
      { unitName: '2174530280_M00_CLAMP UNIT_280', jointCount: 1, jointType: 'revolute' },
      { unitName: '2174530300_M00_CLAMP UNIT_300_SYM_280', jointCount: 1, jointType: 'revolute' },
      { unitName: '2174530320_M00_RETRACT PIN UNIT_320', jointCount: 1, jointType: 'prismatic' },
      { unitName: '2174530340_M00_RETRACT PIN UNIT_340_SYM_320', jointCount: 1, jointType: 'prismatic' },
    ],
  },
];

interface ICPResult {
  unitName: string;
  jointIndex: number;
  rmse: number; // in meters
  rmseMM: number; // in millimeters
  passed: boolean;
  jointType: 'revolute' | 'prismatic';
  angleDeg?: number;
  translationMM?: number;
  error?: string;
}

interface FixtureResults {
  fixture: FixtureConfig;
  results: ICPResult[];
  totalJoints: number;
  passedJoints: number;
  failedJoints: number;
  avgRMSE: number;
  maxRMSE: number;
  minRMSE: number;
  allPassed: boolean;
}

async function loadGLBFile(glbPath: string): Promise<{ scene: BABYLON.Scene; engine: BABYLON.NullEngine }> {
  const engine = new BABYLON.NullEngine();
  const scene = new BABYLON.Scene(engine);

  scene.skipPointerMovePicking = true;
  scene.skipPointerDownPicking = true;
  scene.skipPointerUpPicking = true;
  scene.skipFrustumClipping = true;
  scene.blockMaterialDirtyMechanism = true;

  if (!fs.existsSync(glbPath)) {
    throw new Error(`GLB file not found: ${glbPath}`);
  }

  const fileBuffer = fs.readFileSync(glbPath);
  const arrayBufferView = new Uint8Array(
    fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
  );

  // Use LoadAssetContainerAsync instead of ImportMeshAsync to avoid XMLHttpRequest issues
  const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
    '',
    arrayBufferView,
    scene,
    undefined,
    '.glb'
  );

  // Add all meshes and nodes to the scene
  container.addAllToScene();

  // Compute world matrices for all nodes
  scene.rootNodes.forEach(node => {
    node.computeWorldMatrix(true);
  });

  scene.materials.forEach(material => {
    material.freeze();
    material.doNotSerialize = true;
  });

  return { scene, engine };
}

/**
 * Find all pose pairs for a fixture using name-agnostic statistical pairing
 * Based on point count matching (structure and name agnostic)
 * Uses the same approach as StatisticalPairingEngine
 */
function findAllPosePairs(treeData: GLBTreeData, verbose: boolean = false): Array<{ 
  unitName: string; 
  openIndex: number; 
  closedIndex: number; 
  confidence: number;
  pointCount: number;
}> {
  const allPairs: Array<{ 
    unitName: string; 
    openIndex: number; 
    closedIndex: number; 
    confidence: number;
    pointCount: number;
  }> = [];

  // Collect all nodes with significant geometry
  // Use lower threshold to catch smaller moving parts
  const MIN_POINTS = 100;  // Lowered from 500 to catch more candidates
  const significantNodes: Array<{ index: number; pointCount: number; name: string; parentIndex?: number; depth?: number }> = [];
  
  for (let i = 0; i < treeData.nodes.length; i++) {
    const node = treeData.nodes[i];
    const pointCount = node.subtreePointCount || 0;
    
    if (pointCount >= MIN_POINTS) {
      significantNodes.push({
        index: i,
        pointCount,
        name: node.name,
        parentIndex: node.parentIndex,
        depth: node.depth,
      });
    }
  }

  if (verbose) {
    console.log(`      Found ${significantNodes.length} nodes with >= ${MIN_POINTS} points`);
    if (significantNodes.length > 0) {
      const minPts = Math.min(...significantNodes.map(n => n.pointCount));
      const maxPts = Math.max(...significantNodes.map(n => n.pointCount));
      console.log(`      Point count range: ${minPts.toLocaleString()} - ${maxPts.toLocaleString()}`);
      // Show sample of node names
      console.log(`      Sample nodes: ${significantNodes.slice(0, 5).map(n => `${n.name} (${n.pointCount.toLocaleString()} pts)`).join(', ')}`);
    } else {
      console.log(`      ⚠️  No nodes found with >= ${MIN_POINTS} points! Total nodes: ${treeData.nodes.length}`);
      // Show what point counts we do have
      const allCounts = treeData.nodes.map(n => n.subtreePointCount || 0).filter(c => c > 0).sort((a, b) => b - a);
      if (allCounts.length > 0) {
        console.log(`      Top 10 point counts: ${allCounts.slice(0, 10).map(c => c.toLocaleString()).join(', ')}`);
      }
    }
  }

  // Use relaxed tolerances for initial detection
  // StatisticalPairingEngine uses: NODE_ABS_TOL = 50, NODE_REL_TOL = 0.0012
  // But that's very strict - let's be more lenient for automatic detection
  const ABS_TOLERANCE = 200;     // Absolute tolerance (points) - relaxed from 50
  const REL_TOLERANCE = 0.05;    // Relative tolerance (5%) - relaxed from 0.12%
  
  // Greedy matching algorithm (like StatisticalPairingEngine.pairNodesByPoints)
  const usedIndices = new Set<number>();
  let pairsChecked = 0;
  let pairsMatched = 0;
  
  // Sort by point count for better matching
  const sortedNodes = [...significantNodes].sort((a, b) => a.pointCount - b.pointCount);
  
  for (let i = 0; i < sortedNodes.length; i++) {
    if (usedIndices.has(sortedNodes[i].index)) continue;
    
    const nodeA = sortedNodes[i];
    let bestMatch: typeof nodeA | null = null;
    let bestDiff = Infinity;
    let bestConfidence = 0;
    
    // Find best match for this node
    for (let j = i + 1; j < sortedNodes.length; j++) {
      if (usedIndices.has(sortedNodes[j].index)) continue;
      
      const nodeB = sortedNodes[j];
      
      // Check point count similarity (statistical pairing approach)
      const diff = Math.abs(nodeA.pointCount - nodeB.pointCount);
      const maxPoints = Math.max(nodeA.pointCount, nodeB.pointCount);
      const relDiff = maxPoints > 0 ? diff / maxPoints : 1;
      
      // Match if within absolute OR relative tolerance
      const isMatch = diff <= ABS_TOLERANCE || relDiff <= REL_TOLERANCE;
      pairsChecked++;
      
      if (isMatch && diff < bestDiff) {
        pairsMatched++;
        // Calculate confidence based on point count similarity and heuristics
        const ratio = Math.min(nodeA.pointCount, nodeB.pointCount) / Math.max(nodeA.pointCount, nodeB.pointCount);
        let confidence = ratio * 100;
        
        const nameA = nodeA.name.toLowerCase();
        const nameB = nodeB.name.toLowerCase();
        
        // Boost confidence if same parent (sibling nodes)
        if (nodeA.parentIndex !== undefined && nodeA.parentIndex === nodeB.parentIndex) {
          confidence += 10;
        }
        
        // Boost confidence if both contain "moving" (common pattern)
        if (nameA.includes('moving') && nameB.includes('moving')) {
          confidence += 10;
        }
        
        // Boost confidence if names share common prefix (same unit)
        const prefixA = nameA.split('_').slice(0, 2).join('_');
        const prefixB = nameB.split('_').slice(0, 2).join('_');
        if (prefixA === prefixB && prefixA.length > 3) {
          confidence += 15;
        }
        
        // Check for unit number pattern
        const unitMatchA = nameA.match(/unit[_\s]?(\d+)/i);
        const unitMatchB = nameB.match(/unit[_\s]?(\d+)/i);
        if (unitMatchA && unitMatchB && unitMatchA[1] === unitMatchB[1]) {
          confidence += 20; // Same unit number = high confidence
        }
        
        bestMatch = nodeB;
        bestDiff = diff;
        bestConfidence = Math.min(confidence, 100);
      }
    }
    
    if (bestMatch) {
      // Extract unit name
      let unitName = 'UNKNOWN';
      const nameA = nodeA.name.toLowerCase();
      const unitMatchA = nameA.match(/unit[_\s]?(\d+)/i);
      const unitMatchB = bestMatch.name.toLowerCase().match(/unit[_\s]?(\d+)/i);
      
      if (unitMatchA) {
        unitName = `UNIT_${unitMatchA[1]}`;
      } else if (unitMatchB) {
        unitName = `UNIT_${unitMatchB[1]}`;
      } else {
        // Fallback: use first two parts of name
        const partsA = nodeA.name.split('_');
        if (partsA.length >= 2) {
          unitName = partsA[0] + '_' + partsA[1];
        } else {
          unitName = partsA[0];
        }
      }
      
      allPairs.push({
        unitName,
        openIndex: nodeA.index,
        closedIndex: bestMatch.index,
        confidence: bestConfidence,
        pointCount: nodeA.pointCount,
      });
      
      usedIndices.add(nodeA.index);
      usedIndices.add(bestMatch.index);
    }
  }

  // Sort by confidence (highest first)
  allPairs.sort((a, b) => b.confidence - a.confidence);

  if (verbose) {
    console.log(`      Found ${allPairs.length} pose pairs`);
    if (allPairs.length > 0) {
      const confidences = allPairs.map(p => p.confidence);
      console.log(`      Confidence range: ${Math.min(...confidences).toFixed(1)}% - ${Math.max(...confidences).toFixed(1)}%`);
      console.log(`      Pairs checked: ${pairsChecked}, matches found: ${pairsMatched}`);
    } else {
      console.log(`      ⚠️  No pairs found! Checked ${pairsChecked} node pairs`);
      if (significantNodes.length > 0) {
        console.log(`      Sample point counts: ${significantNodes.slice(0, 10).map(n => n.pointCount).join(', ')}`);
      }
    }
  }

  return allPairs;
}

/**
 * Fallback: Find pairs by name patterns when point count matching fails
 */
function findPairsByNamePatterns(treeData: GLBTreeData, verbose: boolean = false): Array<{ 
  unitName: string; 
  openIndex: number; 
  closedIndex: number; 
  confidence: number;
  pointCount: number;
}> {
  const pairs: Array<{ 
    unitName: string; 
    openIndex: number; 
    closedIndex: number; 
    confidence: number;
    pointCount: number;
  }> = [];

  // Look for common patterns: MOVING nodes, OPEN/CLOSED, RH/LH pairs
  for (let i = 0; i < treeData.nodes.length; i++) {
    const nodeA = treeData.nodes[i];
    const nameA = nodeA.name.toLowerCase();
    const pointCountA = nodeA.subtreePointCount || 0;
    
    if (pointCountA < 100) continue; // Still need some geometry
    
    // Look for matching patterns
    for (let j = i + 1; j < treeData.nodes.length; j++) {
      const nodeB = treeData.nodes[j];
      const nameB = nodeB.name.toLowerCase();
      const pointCountB = nodeB.subtreePointCount || 0;
      
      if (pointCountB < 100) continue;
      
      // Pattern 1: Both contain "MOVING" - likely same part in different states
      if (nameA.includes('moving') && nameB.includes('moving')) {
        // Check if they share a common parent or unit identifier
        const unitMatchA = nameA.match(/unit[_\s]?(\d+)/i);
        const unitMatchB = nameB.match(/unit[_\s]?(\d+)/i);
        
        if (unitMatchA && unitMatchB && unitMatchA[1] === unitMatchB[1]) {
          // Same unit number - high confidence
          const ratio = Math.min(pointCountA, pointCountB) / Math.max(pointCountA, pointCountB);
          if (ratio > 0.8) { // Still check point count similarity
            pairs.push({
              unitName: `UNIT_${unitMatchA[1]}`,
              openIndex: i,
              closedIndex: j,
              confidence: ratio * 100 + 30, // Boost for same unit
              pointCount: pointCountA,
            });
          }
        } else if (nodeA.parentIndex === nodeB.parentIndex && nodeA.parentIndex !== undefined) {
          // Same parent - medium confidence
          const ratio = Math.min(pointCountA, pointCountB) / Math.max(pointCountA, pointCountB);
          if (ratio > 0.7) {
            // Try to extract unit from parent or name
            let unitName = 'UNKNOWN';
            const parentNode = treeData.nodes[nodeA.parentIndex];
            const parentName = parentNode?.name.toLowerCase() || '';
            const unitMatch = parentName.match(/unit[_\s]?(\d+)/i) || nameA.match(/unit[_\s]?(\d+)/i);
            if (unitMatch) {
              unitName = `UNIT_${unitMatch[1]}`;
            }
            
            pairs.push({
              unitName,
              openIndex: i,
              closedIndex: j,
              confidence: ratio * 100 + 20,
              pointCount: pointCountA,
            });
          }
        }
      }
      
      // Pattern 2: OPEN/CLOSED or similar state indicators
      if ((nameA.includes('open') && nameB.includes('closed')) ||
          (nameA.includes('closed') && nameB.includes('open')) ||
          (nameA.includes('extended') && nameB.includes('retracted')) ||
          (nameA.includes('retracted') && nameB.includes('extended'))) {
        const ratio = Math.min(pointCountA, pointCountB) / Math.max(pointCountA, pointCountB);
        if (ratio > 0.8) {
          // Extract unit name
          let unitName = 'UNKNOWN';
          const unitMatchA = nameA.match(/unit[_\s]?(\d+)/i);
          const unitMatchB = nameB.match(/unit[_\s]?(\d+)/i);
          if (unitMatchA) unitName = `UNIT_${unitMatchA[1]}`;
          else if (unitMatchB) unitName = `UNIT_${unitMatchB[1]}`;
          
          pairs.push({
            unitName,
            openIndex: i,
            closedIndex: j,
            confidence: ratio * 100 + 25,
            pointCount: pointCountA,
          });
        }
      }
    }
  }

  // Remove duplicates and sort by confidence
  const uniquePairs = pairs.filter((p, idx, arr) => 
    arr.findIndex(pp => pp.openIndex === p.openIndex && pp.closedIndex === p.closedIndex) === idx
  );
  
  uniquePairs.sort((a, b) => b.confidence - a.confidence);
  
  return uniquePairs;
}

async function verifyFixtureICP(fixture: FixtureConfig): Promise<FixtureResults> {
  console.error(`[DEBUG] Starting verification for ${fixture.name}`);
  console.log(`\n${'='.repeat(100)}`);
  console.log(`  ICP VERIFICATION: ${fixture.name}`);
  console.log(`  Expected: ${fixture.expectedJoints} joints, RMSE threshold: ${(fixture.rmseThreshold * 1000).toFixed(3)}mm`);
  console.log(`${'='.repeat(100)}\n`);

  // Check files exist
  if (!fs.existsSync(fixture.glbPath)) {
    throw new Error(`GLB file not found: ${fixture.glbPath}`);
  }
  if (!fs.existsSync(fixture.jsonPath)) {
    throw new Error(`Tree JSON not found: ${fixture.jsonPath}`);
  }

  // Load tree data
  console.log('[1/4] Loading tree data...');
  const treeData: GLBTreeData = JSON.parse(fs.readFileSync(fixture.jsonPath, 'utf-8'));
  console.log(`      ✓ Loaded: ${treeData.nodes.length} nodes\n`);

  // Load GLB
  console.log('[2/4] Loading GLB scene...');
  const { scene, engine } = await loadGLBFile(fixture.glbPath);
  console.log(`      ✓ Scene loaded: ${scene.meshes.length} meshes\n`);

  // Find pose pairs
  console.log('[3/4] Finding pose pairs...');
  console.log(`      Analyzing ${treeData.nodes.length} nodes...`);
  const allPairs = findAllPosePairs(treeData, true); // Enable verbose logging
  console.log(`      ✓ Found ${allPairs.length} potential pose pairs`);
  
  if (allPairs.length === 0) {
    console.log(`      ⚠️  WARNING: No pose pairs detected via point count matching!`);
    console.log(`      Trying fallback: name-based pattern matching...`);
    
    // Fallback: Try name-based matching for common patterns
    const fallbackPairs = findPairsByNamePatterns(treeData, verbose);
    if (fallbackPairs.length > 0) {
      console.log(`      ✓ Found ${fallbackPairs.length} pairs via name patterns`);
      allPairs.push(...fallbackPairs);
    } else {
      console.log(`      ⚠️  No pairs found via name patterns either`);
      console.log(`      This may indicate:`);
      console.log(`         - Detection thresholds too strict`);
      console.log(`         - Tree structure differs from expected`);
      console.log(`         - Need to use known node indices instead\n`);
    }
  }
  
  if (allPairs.length > 0) {
    console.log(`      Top 5 pairs by confidence:`);
    allPairs.slice(0, 5).forEach((p, i) => {
      const nodeA = treeData.nodes[p.openIndex];
      const nodeB = treeData.nodes[p.closedIndex];
      console.log(`        ${i + 1}. ${p.unitName}: ${nodeA.name} ↔ ${nodeB.name} (conf: ${p.confidence.toFixed(1)}%, pts: ${p.pointCount.toLocaleString()})`);
    });
  }
  console.log();

  // Run ICP on each pair
  console.log('[4/4] Running ICP verification...\n');
  const results: ICPResult[] = [];
  const usedPairs = new Set<number>(); // Track which pairs we've used

  // Match pairs to expected units
  for (const unit of fixture.expectedUnits) {
    // Find pairs that match this unit (by name matching)
    const unitNameLower = unit.unitName.toLowerCase();
    const unitNumber = unitNameLower.match(/\d+/)?.[0] || '';
    
    const matchingPairs = allPairs
      .map((p, idx) => ({ pair: p, index: idx }))
      .filter(({ pair, index }) => {
        if (usedPairs.has(index)) return false;
        
        const pairNameLower = pair.unitName.toLowerCase();
        
        // Match by unit number (e.g., "102" in "UNIT_102")
        if (unitNumber && pairNameLower.includes(unitNumber)) return true;
        
        // Match by name similarity
        if (pairNameLower.includes(unitNameLower.split('_')[0])) return true;
        if (unitNameLower.includes(pairNameLower.split('_')[0])) return true;
        
        // For floor clamp, match by CLAMP or RETRACT pattern
        if (unitNameLower.includes('clamp') && pairNameLower.includes('clamp')) return true;
        if (unitNameLower.includes('retract') && pairNameLower.includes('retract')) return true;
        
        return false;
      })
      .sort((a, b) => b.pair.confidence - a.pair.confidence); // Sort by confidence

    // Process up to the expected number of joints for this unit
    const pairsToProcess = matchingPairs.slice(0, unit.jointCount);

    if (pairsToProcess.length === 0) {
      // No pairs found for this unit
      for (let i = 0; i < unit.jointCount; i++) {
        results.push({
          unitName: unit.unitName,
          jointIndex: i + 1,
          rmse: Infinity,
          rmseMM: Infinity,
          passed: false,
          jointType: unit.jointType,
          error: 'No pose pairs found',
        });
        console.log(`  ✗ SKIP ${unit.unitName} joint ${i + 1}: No pose pairs detected`);
      }
      continue;
    }

    // Process each pair
    for (let i = 0; i < pairsToProcess.length; i++) {
      const { pair, index } = pairsToProcess[i];
      usedPairs.add(index);

      try {
        // Extract vertices
        const { poseA, poseB } = extractPosePairVertices(
          scene,
          treeData,
          pair.openIndex,
          pair.closedIndex,
          { subsampleRatio: 1.0 }
        );

        if (poseA.length === 0 || poseB.length === 0) {
          results.push({
            unitName: unit.unitName,
            jointIndex: i + 1,
            rmse: Infinity,
            rmseMM: Infinity,
            passed: false,
            jointType: unit.jointType,
            error: 'No vertices extracted',
          });
          console.log(`  ✗ ERROR ${unit.unitName} joint ${i + 1}: No vertices extracted`);
          continue;
        }

        // Run Open3D ICP
        const icpResult = await runICPWithOpen3D(poseA, poseB, {
          maxCorrespondenceDistance: 0.100, // 100mm
          maxIterations: 200,
          rmse_threshold: fixture.rmseThreshold * 10, // Allow 10x threshold for convergence
        });

        const rmseMM = icpResult.rmsError * 1000;
        const passed = rmseMM <= (fixture.rmseThreshold * 1000);

        const axisAngle = matrixToAxisAngle(icpResult.rotation);
        const angleDeg = (axisAngle.angle * 180) / Math.PI;
        const translationMM = Math.sqrt(
          icpResult.translation[0] ** 2 +
          icpResult.translation[1] ** 2 +
          icpResult.translation[2] ** 2
        ) * 1000;

        const detectedType = classifyJoint(icpResult);

        results.push({
          unitName: unit.unitName,
          jointIndex: i + 1,
          rmse: icpResult.rmsError,
          rmseMM,
          passed,
          jointType: unit.jointType,
          angleDeg,
          translationMM,
        });

        const status = passed ? '✓ PASS' : '✗ FAIL';
        console.log(`  ${status} ${unit.unitName} joint ${i + 1}: RMSE = ${rmseMM.toFixed(5)}mm (threshold: ${(fixture.rmseThreshold * 1000).toFixed(3)}mm)`);
        console.log(`         Confidence: ${pair.confidence.toFixed(1)}%, Points: ${pair.pointCount.toLocaleString()}`);
        if (unit.jointType === 'revolute') {
          console.log(`         Rotation: ${angleDeg.toFixed(2)}°`);
        } else {
          console.log(`         Translation: ${translationMM.toFixed(3)}mm`);
        }

      } catch (error: any) {
        results.push({
          unitName: unit.unitName,
          jointIndex: i + 1,
          rmse: Infinity,
          rmseMM: Infinity,
          passed: false,
          jointType: unit.jointType,
          error: error.message || String(error),
        });
        console.log(`  ✗ ERROR ${unit.unitName} joint ${i + 1}: ${error.message || error}`);
      }
    }

    // If we found fewer pairs than expected joints, mark the rest as missing
    if (pairsToProcess.length < unit.jointCount) {
      for (let i = pairsToProcess.length; i < unit.jointCount; i++) {
        results.push({
          unitName: unit.unitName,
          jointIndex: i + 1,
          rmse: Infinity,
          rmseMM: Infinity,
          passed: false,
          jointType: unit.jointType,
          error: 'Insufficient pose pairs found',
        });
        console.log(`  ✗ SKIP ${unit.unitName} joint ${i + 1}: Insufficient pose pairs (found ${pairsToProcess.length}, expected ${unit.jointCount})`);
      }
    }
  }

  scene.dispose();
  engine.dispose();

  // Calculate statistics
  const validResults = results.filter(r => !isFinite(r.rmseMM) === false && r.rmseMM !== Infinity);
  const passedResults = results.filter(r => r.passed);
  const avgRMSE = validResults.length > 0
    ? validResults.reduce((sum, r) => sum + r.rmseMM, 0) / validResults.length
    : Infinity;
  const maxRMSE = validResults.length > 0
    ? Math.max(...validResults.map(r => r.rmseMM))
    : Infinity;
  const minRMSE = validResults.length > 0
    ? Math.min(...validResults.map(r => r.rmseMM))
    : Infinity;

  return {
    fixture,
    results,
    totalJoints: results.length,
    passedJoints: passedResults.length,
    failedJoints: results.length - passedResults.length,
    avgRMSE,
    maxRMSE,
    minRMSE,
    allPassed: passedResults.length === fixture.expectedJoints,
  };
}

async function main() {
  // Immediate output to verify script is running
  console.log('Starting ICP verification script...');
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    ICP VERIFICATION - REAL TOOLING FIXTURES                                   ║');
  console.log('║                    Name & Structure Agnostic Detection                                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════╝\n');

  const allResults: FixtureResults[] = [];

  for (const fixture of FIXTURES) {
    try {
      const result = await verifyFixtureICP(fixture);
      allResults.push(result);
    } catch (error: any) {
      console.error(`\n❌ FATAL ERROR processing ${fixture.name}:`, error.message);
      console.error(error.stack);
    }
  }

  // Print summary
  console.log(`\n${'='.repeat(100)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(100)}\n`);

  let totalJoints = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const result of allResults) {
    totalJoints += result.totalJoints;
    totalPassed += result.passedJoints;
    totalFailed += result.failedJoints;

    const status = result.allPassed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} ${result.fixture.name}`);
    console.log(`  Joints: ${result.passedJoints}/${result.totalJoints} passed`);
    console.log(`  RMSE:   avg=${result.avgRMSE.toFixed(5)}mm, min=${result.minRMSE.toFixed(5)}mm, max=${result.maxRMSE.toFixed(5)}mm`);
    console.log(`  Threshold: ${(result.fixture.rmseThreshold * 1000).toFixed(3)}mm\n`);
  }

  console.log(`${'='.repeat(100)}`);
  console.log(`OVERALL: ${totalPassed}/${totalJoints} joints passed (${((totalPassed/totalJoints)*100).toFixed(1)}%)`);
  console.log(`${'='.repeat(100)}\n`);

  // Save results to JSON
  const outputPath = path.join(process.cwd(), 'icp_verification_results.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(allResults, null, 2),
    'utf-8'
  );
  console.log(`Results saved to: ${outputPath}\n`);

  process.exit(totalFailed === 0 ? 0 : 1);
}

// Run with proper error handling
console.log('Script starting...');
(async () => {
  try {
    await main();
  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();

