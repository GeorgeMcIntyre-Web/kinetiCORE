/**
 * Joint Finder by Geometry
 *
 * Finds matching joint pairs (JOINT_1, JOINT_2, etc.) in 9X_110_GEO.glb by:
 * 1. Computing bounding box dimensions for all transform nodes
 * 2. Finding pairs with similar dimensions (orientation-invariant)
 * 3. Classifying which is FIXED vs MOVING based on heuristics
 *
 * This approach is NAME-AGNOSTIC - works even if naming changes.
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

interface GeometricSignature {
  node: BABYLON.TransformNode;
  uniqueId: number;
  name: string;
  path: string;
  dimensions: [number, number, number]; // [small, medium, large] sorted
  volume: number;
  position: BABYLON.Vector3;
  parentName: string | null;
  childCount: number;
  meshCount: number;
}

interface JointPair {
  node1: GeometricSignature;
  node2: GeometricSignature;
  similarity: number;
  positionDistance: number;
  volumeRatio: number;
  suggestedFixed: GeometricSignature;
  suggestedMoving: GeometricSignature;
  confidence: number;
}

/**
 * Build full hierarchical path for a node
 */
function getNodePath(node: BABYLON.Node): string {
  const parts: string[] = [];
  let current: BABYLON.Node | null = node;

  while (current) {
    parts.unshift(current.name);
    current = current.parent;
  }

  return parts.join('/');
}

/**
 * Compute aggregate bounding box for a transform node (union of all child meshes)
 * Returns sorted dimensions for orientation-invariant comparison
 */
function computeGeometricSignature(node: BABYLON.TransformNode): GeometricSignature | null {
  node.computeWorldMatrix(true);

  const meshes = node.getChildMeshes(false) as BABYLON.AbstractMesh[];

  if (meshes.length === 0) {
    return null; // No geometry
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

  // Sort dimensions for orientation-invariant comparison
  const dimensions: [number, number, number] = [sizeX, sizeY, sizeZ].sort((a, b) => a - b) as [number, number, number];
  const volume = sizeX * sizeY * sizeZ;

  return {
    node,
    uniqueId: node.uniqueId,
    name: node.name,
    path: getNodePath(node),
    dimensions,
    volume,
    position: node.getAbsolutePosition().clone(),
    parentName: node.parent?.name || null,
    childCount: node.getChildren().length,
    meshCount: meshes.length
  };
}

/**
 * Compute dimension-based similarity score (0-1, higher = more similar)
 */
function computeDimensionSimilarity(
  dims1: [number, number, number],
  dims2: [number, number, number]
): number {
  const [d1_small, d1_med, d1_large] = dims1;
  const [d2_small, d2_med, d2_large] = dims2;

  // Compute percentage difference for each dimension
  const diff_small = Math.abs(d1_small - d2_small) / Math.max(d1_small, d2_small);
  const diff_med = Math.abs(d1_med - d2_med) / Math.max(d1_med, d2_med);
  const diff_large = Math.abs(d1_large - d2_large) / Math.max(d1_large, d2_large);

  // Weighted average (larger dimensions matter more)
  const weightedDiff = (diff_small * 0.2 + diff_med * 0.3 + diff_large * 0.5);

  // Convert to similarity score (1 = identical, 0 = completely different)
  return Math.max(0, 1 - weightedDiff);
}

/**
 * Classify which node is fixed vs moving based on heuristics
 */
function classifyFixedMoving(sig1: GeometricSignature, sig2: GeometricSignature): {
  fixed: GeometricSignature;
  moving: GeometricSignature;
  confidence: number;
} {
  // Heuristic 1: Distance from origin (closer = more likely fixed)
  const dist1 = sig1.position.length();
  const dist2 = sig2.position.length();
  const scoreOrigin = dist1 < dist2 ? 1 : 0;

  // Heuristic 2: Connectivity (more children = more likely fixed)
  const scoreConnectivity = sig1.childCount > sig2.childCount ? 1 : 0;

  // Heuristic 3: Name hints (contains "fixed", "base", "anchor", etc.)
  const nameHint1 = /fixture|base|fixed|anchor|retracted/i.test(sig1.name) ? 1 : 0;
  const nameHint2 = /fixture|base|fixed|anchor|retracted/i.test(sig2.name) ? 1 : 0;
  const nameHintMoving1 = /moving|actuator|extended|jaw/i.test(sig1.name) ? -1 : 0;
  const nameHintMoving2 = /moving|actuator|extended|jaw/i.test(sig2.name) ? -1 : 0;

  const score1 = scoreOrigin * 0.3 + scoreConnectivity * 0.3 + nameHint1 * 0.2 + nameHintMoving1 * 0.2;
  const score2 = (1 - scoreOrigin) * 0.3 + (1 - scoreConnectivity) * 0.3 + nameHint2 * 0.2 + nameHintMoving2 * 0.2;

  const confidence = Math.abs(score1 - score2);

  if (score1 > score2) {
    return { fixed: sig1, moving: sig2, confidence };
  } else {
    return { fixed: sig2, moving: sig1, confidence };
  }
}

/**
 * Find all matching pairs in a set of geometric signatures
 */
export function findJointPairs(
  signatures: GeometricSignature[],
  minSimilarity: number = 0.90
): JointPair[] {
  const pairs: JointPair[] = [];

  for (let i = 0; i < signatures.length; i++) {
    for (let j = i + 1; j < signatures.length; j++) {
      const sig1 = signatures[i];
      const sig2 = signatures[j];

      // Quick volume filter (must be within 10% to be same part)
      const volumeRatio = sig1.volume / sig2.volume;
      if (volumeRatio < 0.9 || volumeRatio > 1.1) {
        continue;
      }

      // Dimension similarity
      const similarity = computeDimensionSimilarity(sig1.dimensions, sig2.dimensions);

      if (similarity >= minSimilarity) {
        // Found a match!
        const positionDistance = BABYLON.Vector3.Distance(sig1.position, sig2.position);

        // Classify fixed vs moving
        const classification = classifyFixedMoving(sig1, sig2);

        pairs.push({
          node1: sig1,
          node2: sig2,
          similarity,
          positionDistance,
          volumeRatio,
          suggestedFixed: classification.fixed,
          suggestedMoving: classification.moving,
          confidence: classification.confidence
        });
      }
    }
  }

  return pairs;
}

/**
 * Main analysis function - load GLB and find all joint pairs
 */
export async function analyzeGLBJoints(
  glbPath: string,
  scene: BABYLON.Scene
): Promise<{
  allSignatures: GeometricSignature[];
  jointPairs: JointPair[];
  report: string;
}> {
  console.log('================================================================================');
  console.log('JOINT PAIR ANALYSIS (GEOMETRY-BASED)');
  console.log('================================================================================');
  console.log(`File: ${glbPath}`);
  console.log('Approach: Dimension-based matching (name-agnostic)');
  console.log('Start Time:', new Date().toISOString());
  console.log('================================================================================\n');

  // Load GLB
  console.log('[LOAD] Loading GLB file...');
  console.log(`[LOAD] Path: ${glbPath}`);

  // Extract filename from path for loading from public folder
  const filename = glbPath.split(/[\\/]/).pop() || glbPath;
  console.log(`[LOAD] Loading: ${filename} from public folder`);

  const result = await BABYLON.SceneLoader.ImportMeshAsync(
    '',
    '/', // Root of public folder
    filename,
    scene
  );
  console.log(`[LOAD] ✓ Loaded ${result.transformNodes.length} transform nodes\n`);

  // Extract geometric signatures for all nodes
  console.log('[ANALYZE] Computing geometric signatures...');
  const signatures: GeometricSignature[] = [];

  for (const node of result.transformNodes) {
    const sig = computeGeometricSignature(node);
    if (sig) {
      signatures.push(sig);
    }
  }

  console.log(`[ANALYZE] ✓ Computed signatures for ${signatures.length} nodes with geometry\n`);

  // Find matching pairs
  console.log('[MATCH] Finding dimension-matched pairs (threshold: 0.90)...');
  const jointPairs = findJointPairs(signatures, 0.90);
  console.log(`[MATCH] ✓ Found ${jointPairs.length} matching pairs\n`);

  // Log detailed results
  console.log('[RESULTS] Matched Pairs:');
  console.log('================================================================================\n');

  if (jointPairs.length === 0) {
    console.log('❌ No matching pairs found!');
    console.log('Suggestions:');
    console.log('  - Try lowering similarity threshold (currently 0.90)');
    console.log('  - Check if GLB has duplicated geometry');
    console.log('  - Verify bounding boxes are being computed correctly\n');
  } else {
    jointPairs.forEach((pair, index) => {
      console.log(`Pair ${index + 1}:`);
      console.log(`  Node 1: ${pair.node1.path}`);
      console.log(`    UniqueId: ${pair.node1.uniqueId}`);
      console.log(`    Dimensions: [${pair.node1.dimensions.map(d => d.toFixed(4)).join(', ')}]m`);
      console.log(`    Volume: ${pair.node1.volume.toFixed(6)}m³`);
      console.log(`    Position: (${pair.node1.position.x.toFixed(3)}, ${pair.node1.position.y.toFixed(3)}, ${pair.node1.position.z.toFixed(3)})`);
      console.log('');
      console.log(`  Node 2: ${pair.node2.path}`);
      console.log(`    UniqueId: ${pair.node2.uniqueId}`);
      console.log(`    Dimensions: [${pair.node2.dimensions.map(d => d.toFixed(4)).join(', ')}]m`);
      console.log(`    Volume: ${pair.node2.volume.toFixed(6)}m³`);
      console.log(`    Position: (${pair.node2.position.x.toFixed(3)}, ${pair.node2.position.y.toFixed(3)}, ${pair.node2.position.z.toFixed(3)})`);
      console.log('');
      console.log(`  Similarity: ${pair.similarity.toFixed(3)} (${(pair.similarity * 100).toFixed(1)}%)`);
      console.log(`  Volume Ratio: ${pair.volumeRatio.toFixed(3)}`);
      console.log(`  Position Distance: ${pair.positionDistance.toFixed(4)}m`);
      console.log('');
      console.log(`  Classification:`);
      console.log(`    FIXED:  ${pair.suggestedFixed.name} (uniqueId: ${pair.suggestedFixed.uniqueId})`);
      console.log(`    MOVING: ${pair.suggestedMoving.name} (uniqueId: ${pair.suggestedMoving.uniqueId})`);
      console.log(`    Confidence: ${pair.confidence.toFixed(2)}`);
      console.log('');
      console.log('--------------------------------------------------------------------------------\n');
    });
  }

  // Look specifically for UNIT_112 nodes
  console.log('[UNIT_112] Searching for UNIT_112 joints...');
  const unit112Signatures = signatures.filter(s => s.path.includes('UNIT_112') || s.name.includes('UNIT_112'));

  if (unit112Signatures.length > 0) {
    console.log(`Found ${unit112Signatures.length} nodes in UNIT_112:\n`);
    unit112Signatures.forEach(sig => {
      console.log(`  ${sig.name}`);
      console.log(`    Path: ${sig.path}`);
      console.log(`    UniqueId: ${sig.uniqueId}`);
      console.log(`    Dimensions: [${sig.dimensions.map(d => d.toFixed(4)).join(', ')}]m`);
      console.log(`    Volume: ${sig.volume.toFixed(6)}m³`);
      console.log(`    Has ${sig.meshCount} meshes, ${sig.childCount} children`);
      console.log('');
    });

    // Try to find pairs within UNIT_112
    const unit112Pairs = findJointPairs(unit112Signatures, 0.85); // Lower threshold for within-unit matching
    if (unit112Pairs.length > 0) {
      console.log(`✓ Found ${unit112Pairs.length} matching pairs within UNIT_112:`);
      unit112Pairs.forEach((pair, i) => {
        console.log(`  Pair ${i + 1}:`);
        console.log(`    ${pair.suggestedFixed.name} (FIXED) ↔ ${pair.suggestedMoving.name} (MOVING)`);
        console.log(`    Similarity: ${(pair.similarity * 100).toFixed(1)}%`);
        console.log(`    Distance: ${pair.positionDistance.toFixed(4)}m`);
      });
    } else {
      console.log(`❌ No matching pairs found within UNIT_112 (tried threshold 0.85)`);
    }
  } else {
    console.log('❌ No nodes found containing "UNIT_112" in name or path');
  }

  console.log('');
  console.log('================================================================================');

  // Build text report
  const report = [
    'JOINT PAIR ANALYSIS REPORT',
    '='.repeat(80),
    `File: ${glbPath}`,
    `Total nodes with geometry: ${signatures.length}`,
    `Matching pairs found: ${jointPairs.length}`,
    '',
    'SUMMARY BY UNIT:',
    ...Object.entries(
      signatures.reduce((acc, sig) => {
        const unitMatch = sig.path.match(/UNIT_(\d+)/);
        const unitKey = unitMatch ? `UNIT_${unitMatch[1]}` : 'OTHER';
        acc[unitKey] = (acc[unitKey] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([unit, count]) => `  ${unit}: ${count} nodes`),
    '',
    '='.repeat(80)
  ].join('\n');

  return {
    allSignatures: signatures,
    jointPairs,
    report
  };
}

/**
 * Export to window for browser console access
 */
if (typeof window !== 'undefined') {
  (window as any).analyzeGLBJoints = analyzeGLBJoints;
  (window as any).findJointPairs = findJointPairs;
}
