/**
 * Bounding Box Matching Algorithm Test
 * 
 * Run this to test bounding box matching on currently selected nodes.
 * Usage: Copy-paste into browser console or run as module.
 */

import * as BABYLON from '@babylonjs/core';
import { useEditorStore } from '../ui/store/editorStore';
import { SceneTreeManager } from '../scene/SceneTreeManager';
import { SceneManager } from '../scene/SceneManager';

/**
 * Compute bounding box signature for a TransformNode
 */
function computeBoundingBoxSignature(node) {
  if (!node) return null;
  
  node.computeWorldMatrix(true);
  const meshes = node.getChildMeshes(false);
  
  if (meshes.length === 0) {
    // Try to find a child TransformNode that has meshes
    const children = node.getChildren();
    for (const child of children) {
      if (child instanceof BABYLON.TransformNode) {
        const childSig = computeBoundingBoxSignature(child);
        if (childSig) return childSig;
      }
    }
    return null;
  }

  // Compute combined world-space bounding box
  let min = new BABYLON.Vector3(+Infinity, +Infinity, +Infinity);
  let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
  
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const bbox = mesh.getBoundingInfo().boundingBox;
    min = BABYLON.Vector3.Minimize(min, bbox.minimumWorld);
    max = BABYLON.Vector3.Maximize(max, bbox.maximumWorld);
  }

  const size = max.subtract(min);
  const dims = [
    Math.abs(size.x),
    Math.abs(size.y),
    Math.abs(size.z)
  ].sort((a, b) => a - b); // Sort ascending for orientation-invariant comparison

  const volume = Math.abs(size.x * size.y * size.z);
  const pos = node.getAbsolutePosition();

  return {
    node,
    name: node.name,
    dims,
    volume,
    pos,
    meshCount: meshes.length,
    bboxMin: min,
    bboxMax: max,
  };
}

/**
 * Compute dimension similarity score (0-1, higher = more similar)
 */
function computeDimensionSimilarity(dims1, dims2, tolerance = 0.01) {
  if (dims1.length !== 3 || dims2.length !== 3) return 0;

  // Both are already sorted [small, medium, large]
  const [d1_small, d1_med, d1_large] = dims1;
  const [d2_small, d2_med, d2_large] = dims2;

  // Compute percentage difference for each dimension
  const diff_small = Math.abs(d1_small - d2_small) / Math.max(d1_small, d2_small, tolerance);
  const diff_med = Math.abs(d1_med - d2_med) / Math.max(d1_med, d2_med, tolerance);
  const diff_large = Math.abs(d1_large - d2_large) / Math.max(d1_large, d2_large, tolerance);

  // Weighted average (larger dimensions matter more)
  const weightedDiff = diff_small * 0.2 + diff_med * 0.3 + diff_large * 0.5;

  // Convert to similarity score (1 = identical, 0 = completely different)
  return Math.max(0, 1 - weightedDiff);
}

/**
 * Find bounding box matches for a set of signatures
 */
function findBoundingBoxMatches(signatures, minSimilarity = 0.95) {
  const matches = [];

  for (let i = 0; i < signatures.length; i++) {
    for (let j = i + 1; j < signatures.length; j++) {
      const sig1 = signatures[i];
      const sig2 = signatures[j];

      if (!sig1 || !sig2) continue;

      // Quick volume filter (must be within 10% to be same part)
      const volumeRatio = sig1.volume / sig2.volume;
      if (volumeRatio < 0.9 || volumeRatio > 1.1) continue;

      // Dimension similarity
      const similarity = computeDimensionSimilarity(sig1.dims, sig2.dims);

      if (similarity >= minSimilarity) {
        const positionDistance = BABYLON.Vector3.Distance(sig1.pos, sig2.pos);
        matches.push({
          node1: sig1,
          node2: sig2,
          similarity,
          volumeRatio,
          positionDistance,
        });
      }
    }
  }

  return matches;
}

/**
 * Classify fixed vs moving based on heuristics
 */
function classifyFixedMoving(match) {
  const { node1, node2 } = match;

  // Heuristic 1: Proximity to origin (closer = more likely fixed)
  const dist1 = node1.pos.length();
  const dist2 = node2.pos.length();

  // Heuristic 2: Connectivity (more children = more likely fixed)
  const connectivity1 = node1.node.getChildren().length;
  const connectivity2 = node2.node.getChildren().length;

  // Heuristic 3: Name hints (optional, as backup)
  const nameHint1 = /fixture|base|fixed|anchor/i.test(node1.name) ? 1 : 0;
  const nameHint2 = /fixture|base|fixed|anchor/i.test(node2.name) ? 1 : 0;

  // Weighted score (higher = more likely fixed)
  const score1 =
    (dist1 < dist2 ? 1 : 0) * 0.4 +
    (connectivity1 > connectivity2 ? 1 : 0) * 0.4 +
    nameHint1 * 0.2;

  const score2 =
    (dist2 < dist1 ? 1 : 0) * 0.4 +
    (connectivity2 > connectivity1 ? 1 : 0) * 0.4 +
    nameHint2 * 0.2;

  const confidence = Math.abs(score1 - score2);

  if (score1 > score2) {
    return { fixed: node1, moving: node2, confidence };
  } else {
    return { fixed: node2, moving: node1, confidence };
  }
}

/**
 * Main test function
 */
export async function testBoundingBoxMatching() {
  console.log('='.repeat(80));
  console.log('BOUNDING BOX MATCHING ALGORITHM TEST');
  console.log('='.repeat(80));

  // Get scene
  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();
  if (!scene) {
    console.error('❌ No Babylon scene found');
    return;
  }

  // Get current selection
  const selectedNodeIds = useEditorStore.getState().selectedNodeIds;
  const tree = SceneTreeManager.getInstance();

  console.log(`\nSelected ${selectedNodeIds.length} node(s):`);

  if (selectedNodeIds.length === 0) {
    console.warn('⚠️ No nodes selected. Please select nodes in the Scene Tree first.');
    console.log('\nTip: Select nodes like UNIT_112/RH/FIXED, UNIT_112/RH/MOVING, etc.');
    return;
  }

  // Resolve selected nodes to Babylon TransformNodes
  const selectedNodes = [];
  for (const nodeId of selectedNodeIds) {
    const sceneNode = tree.getNode(nodeId);
    if (!sceneNode) continue;

    let babylonNode = null;
    if (sceneNode.babylonTransformNodeId) {
      const uid = parseInt(sceneNode.babylonTransformNodeId, 10);
      babylonNode = scene.getTransformNodeByUniqueId(uid);
    }

    if (babylonNode) {
      console.log(`  - ${sceneNode.name} (uid: ${babylonNode.uniqueId})`);
      selectedNodes.push(babylonNode);
    } else {
      console.warn(`  - ${sceneNode.name}: Could not resolve Babylon TransformNode`);
    }
  }

  if (selectedNodes.length < 2) {
    console.error('❌ Need at least 2 selected nodes to find pairs');
    return;
  }

  // Compute bounding box signatures
  console.log('\n' + '='.repeat(80));
  console.log('COMPUTING BOUNDING BOX SIGNATURES');
  console.log('='.repeat(80));

  const signatures = [];
  for (const node of selectedNodes) {
    const sig = computeBoundingBoxSignature(node);
    if (sig) {
      signatures.push(sig);
      console.log(`\n${sig.name}:`);
      console.log(`  - Dimensions (sorted): [${sig.dims.map(d => d.toFixed(3)).join(', ')}] m`);
      console.log(`  - Volume: ${sig.volume.toFixed(6)} m³`);
      console.log(`  - Mesh count: ${sig.meshCount}`);
      console.log(`  - World position: (${sig.pos.x.toFixed(3)}, ${sig.pos.y.toFixed(3)}, ${sig.pos.z.toFixed(3)})`);
    } else {
      console.warn(`  ${node.name}: No geometry found (no meshes)`);
    }
  }

  if (signatures.length < 2) {
    console.error('❌ Need at least 2 nodes with geometry to find pairs');
    return;
  }

  // Find matches
  console.log('\n' + '='.repeat(80));
  console.log('FINDING MATCHES');
  console.log('='.repeat(80));

  const matches = findBoundingBoxMatches(signatures, 0.95);

  if (matches.length === 0) {
    console.warn('⚠️ No matches found with similarity ≥ 0.95');
    console.log('\nTry lowering the threshold or checking that nodes have similar dimensions.');
    return;
  }

  console.log(`\nFound ${matches.length} matching pair(s):\n`);

  // Classify and display results
  for (const match of matches) {
    const { node1, node2, similarity, volumeRatio, positionDistance } = match;
    const { fixed, moving, confidence } = classifyFixedMoving(match);

    console.log('✅ MATCH FOUND');
    console.log(`  Node 1: ${node1.name}`);
    console.log(`  Node 2: ${node2.name}`);
    console.log(`  Dimensions: [${node1.dims.map(d => d.toFixed(3)).join(', ')}] (sorted)`);
    console.log(`  Similarity: ${similarity.toFixed(3)} (threshold: 0.95)`);
    console.log(`  Volume Ratio: ${volumeRatio.toFixed(3)}`);
    console.log(`  Position Δ: ${positionDistance.toFixed(3)}m`);
    console.log(`  Classification: ${fixed.name} → FIXED, ${moving.name} → MOVING`);
    console.log(`  Confidence: ${confidence.toFixed(2)}`);
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));

  return matches;
}

// Auto-run if executed directly
if (typeof window !== 'undefined') {
  window.testBoundingBoxMatching = testBoundingBoxMatching;
}

