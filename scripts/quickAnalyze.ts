/**
 * Quick Analyze - Complete Auto-Kinematics Pipeline Test
 *
 * Shows ALL tested pairs including PRIMARY and REJECTED candidates
 *
 * Usage: npx tsx scripts/quickAnalyze.ts <path-to-glb-file>
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import * as fs from 'fs';
import * as path from 'path';

import {
  detectUnits,
  findPosePairs,
  extractPosePairVertices,
  runICPWithOpen3D,
  matrixToAxisAngle,
  classifyJoint,
  type GLBTreeData,
  type Vec3,
} from '../src/kinematics/autoDetection';

// [FIX] Disable Draco workers - Node.js cannot spawn browser Blob workers
BABYLON.DracoCompression.DefaultNumWorkers = 0;

interface TestResult {
  pairIndex: number;
  isPrimary: boolean;
  retractedNode: string;
  retractedIndex: number;
  extendedNode: string;
  extendedIndex: number;
  rmsError: number;
  jointType: string;
  angle?: number;
  distance?: number;
  rotationAxis?: Vec3;
  translationAxis?: Vec3;
  rotation?: number;
  score: number;
}

async function loadGLBFile(glbPath: string): Promise<{ scene: BABYLON.Scene; engine: BABYLON.NullEngine }> {
  const engine = new BABYLON.NullEngine();
  const scene = new BABYLON.Scene(engine);

  // Optimization settings
  scene.skipPointerMovePicking = true;
  scene.skipPointerDownPicking = true;
  scene.skipPointerUpPicking = true;
  scene.skipFrustumClipping = true;
  scene.blockMaterialDirtyMechanism = true;

  console.log(`Loading GLB: ${path.basename(glbPath)}...\n`);

  // Read file directly as binary buffer
  const fileBuffer = fs.readFileSync(glbPath);

  // Create ArrayBuffer from Node.js Buffer
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  );

  try {
    // Load directly from ArrayBuffer (bypasses XHR completely)
    await BABYLON.SceneLoader.ImportMeshAsync(
      '',
      '',
      new Uint8Array(arrayBuffer),
      scene,
      undefined,
      '.glb'
    );
  } catch (e) {
    console.error("❌ GLB Load Failed:", e);
    throw e;
  }

  // Freeze materials
  scene.materials.forEach(material => {
    material.freeze();
    material.doNotSerialize = true;
  });

  return { scene, engine };
}

function extractTreeDataFromScene(scene: BABYLON.Scene): GLBTreeData {
  const nodes: any[] = [];
  const nodeMap = new Map<BABYLON.Node, number>(); // Map from Babylon node to our index

  // Collect all nodes (both TransformNodes and Meshes)
  const allNodes: BABYLON.Node[] = [];
  
  // Add all transform nodes
  scene.transformNodes.forEach(node => {
    allNodes.push(node);
  });
  
  // Add all meshes (they're also nodes)
  scene.meshes.forEach(mesh => {
    if (!allNodes.includes(mesh)) {
      allNodes.push(mesh);
    }
  });

  // Build node tree - process all nodes
  function buildNodeTree(node: BABYLON.Node, parentIndex: number | null, depth: number): number {
    // Check if we've already processed this node
    if (nodeMap.has(node)) {
      return nodeMap.get(node)!;
    }

    const currentIndex = nodes.length;
    nodeMap.set(node, currentIndex);

    const nodeData: any = {
      index: currentIndex,
      name: node.name || `Node_${currentIndex}`,
      parentIndex,
      childrenIndices: [],
      depth,
      subtreePointCount: 0,
    };

    nodes.push(nodeData);

    // Count points in meshes under this node
    let pointCount = 0;
    if (node instanceof BABYLON.Mesh) {
      const positions = node.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      if (positions) {
        pointCount = positions.length / 3;
      }
    }

    // Process children - get all child nodes
    const children = node.getChildren();
    for (const child of children) {
      const childIndex = buildNodeTree(child, currentIndex, depth + 1);
      nodeData.childrenIndices.push(childIndex);
      pointCount += nodes[childIndex].subtreePointCount;
    }

    nodeData.subtreePointCount = pointCount;

    return currentIndex;
  }

  // Find root nodes (nodes without parents or scene root children)
  const rootNodes: BABYLON.Node[] = [];
  
  // Check scene root nodes
  if (scene.rootNodes && scene.rootNodes.length > 0) {
    scene.rootNodes.forEach(rootNode => {
      if (!rootNodes.includes(rootNode)) {
        rootNodes.push(rootNode);
      }
    });
  }
  
  // Also check nodes without parents
  allNodes.forEach(node => {
    if (!node.parent && !rootNodes.includes(node)) {
      rootNodes.push(node);
    }
  });

  // Build tree starting from root nodes
  console.log(`[TREE] Found ${rootNodes.length} root nodes, ${allNodes.length} total nodes in scene`);
  rootNodes.forEach(rootNode => {
    buildNodeTree(rootNode, null, 0);
  });

  console.log(`[TREE] Built tree with ${nodes.length} nodes`);

  // Calculate total point count from root nodes
  const totalPointCount = nodes
    .filter(n => n.parentIndex === null)
    .reduce((sum, n) => sum + (n.subtreePointCount || 0), 0);

  // Find max depth
  const maxDepth = Math.max(...nodes.map(n => n.depth || 0), 0);

  // Count nodes with geometry
  const nodesWithGeometry = nodes.filter(n => (n.subtreePointCount || 0) > 0).length;

  return {
    nodes,
    summary: {
      totalNodes: nodes.length,
      totalPointCount,
      rootCount: rootNodes.length,
      maxDepth,
      nodesWithMesh: nodesWithGeometry,
      nodesWithGeometry,
      depthDistribution: [], // Optional, can be empty
    },
    fileInfo: {
      generator: 'quickAnalyze.ts',
      version: '1.0.0',
    },
    tree: [], // Optional nested tree structure
  } as GLBTreeData;
}

async function main() {
  const glbPath = process.argv[2];

  if (!glbPath) {
    console.error('Usage: npx tsx scripts/quickAnalyze.ts <path-to-glb-file>');
    process.exit(1);
  }

  if (!fs.existsSync(glbPath)) {
    console.error(`Error: File not found: ${glbPath}`);
    process.exit(1);
  }

  // Load GLB
  const { scene, engine } = await loadGLBFile(glbPath);

  // Extract tree data from scene
  const treeData = extractTreeDataFromScene(scene);

  // Detect units
  const units = detectUnits(treeData);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('ALL TESTED PAIRS - INCLUDING SECONDARY & REJECTED');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Process each unit
  for (const unit of units) {
    const unitNode = treeData.nodes[unit.nodeIndex];
    console.log(`Unit: ${unitNode.name} (node index: ${unit.nodeIndex})`);

    // Find pose pairs
    const posePairs = findPosePairs(treeData, unit);

    if (posePairs.length === 0) {
      console.log(`Tested 0 pose pair(s):\n`);
      continue;
    }

    console.log(`Tested ${posePairs.length} pose pair(s):\n`);

    // Test all pairs and collect results
    const results: TestResult[] = [];

    for (let i = 0; i < posePairs.length; i++) {
      const pair = posePairs[i];

      const matchA = pair.closedSubtreeIndex;
      const matchB = pair.openSubtreeIndex;
      const nodeA = treeData.nodes[matchA];
      const nodeB = treeData.nodes[matchB];

      try {
        const { poseA, poseB } = extractPosePairVertices(scene, treeData, matchA, matchB, {
          subsampleRatio: 0.1,
        });

        if (poseA.length === 0) {
          continue;
        }

        // Run ICP with Open3D
        const icpResult = await runICPWithOpen3D(poseA, poseB, {
          maxIterations: 50,
          convergenceThreshold: 1e-6,
        });

        if (!icpResult.converged) {
          continue;
        }

        // Classify joint
        const joint = classifyJoint(icpResult);
        const axisAngle = matrixToAxisAngle(icpResult.rotation);
        const angleDeg = (axisAngle.angle * 180) / Math.PI;

        // Calculate score based on subtree point count (matches original script)
        // Score uses the subtree point count from the tree data
        // For very low RMS errors, score is essentially the point count
        const nodeASubtreePoints = nodeA.subtreePointCount || 0;
        const nodeBSubtreePoints = nodeB.subtreePointCount || 0;
        // Use the average of both nodes' subtree point counts
        const score = (nodeASubtreePoints + nodeBSubtreePoints) / 2;

        const result: TestResult = {
          pairIndex: i,
          isPrimary: false, // Will be set later
          retractedNode: nodeA.name,
          retractedIndex: matchA,
          extendedNode: nodeB.name,
          extendedIndex: matchB,
          rmsError: icpResult.rmsError * 1000, // Convert to mm
          jointType: joint.type.toUpperCase(),
          score,
        };

        if (joint.type === 'revolute') {
          result.angle = angleDeg;
          result.rotationAxis = axisAngle.axis;
        } else if (joint.type === 'prismatic') {
          result.rotation = angleDeg;
          result.distance = Math.sqrt(
            icpResult.translation[0] ** 2 +
            icpResult.translation[1] ** 2 +
            icpResult.translation[2] ** 2
          ) * 1000; // Convert to mm

          // Normalize translation to get axis
          const dist = result.distance / 1000;
          if (dist > 0.001) {
            result.translationAxis = [
              icpResult.translation[0] / dist,
              icpResult.translation[1] / dist,
              icpResult.translation[2] / dist,
            ];
          }
        }

        results.push(result);
      } catch (error) {
        // Skip failed pairs
      }
    }

    // Select primary pair (highest score)
    if (results.length > 0) {
      let maxScore = -Infinity;
      let primaryIdx = -1;

      results.forEach((result, idx) => {
        if (result.score > maxScore) {
          maxScore = result.score;
          primaryIdx = idx;
        }
      });

      if (primaryIdx >= 0) {
        results[primaryIdx].isPrimary = true;
      }
    }

    // Print results
    results.forEach((result, idx) => {
      const status = result.isPrimary ? '✓ SELECTED (PRIMARY)' : '✗ REJECTED (secondary)';
      console.log(`  Pair ${idx + 1}: ${status}`);
      console.log(`    Retracted Node: ${result.retractedNode} (index ${result.retractedIndex})`);
      console.log(`    Extended Node:  ${result.extendedNode} (index ${result.extendedIndex})`);
      console.log(`    RMS Error:      ${result.rmsError.toFixed(2)}mm`);
      console.log(`    Joint Type:     ${result.jointType}`);

      if (result.jointType === 'REVOLUTE') {
        console.log(`    Angle:          ${result.angle?.toFixed(1)}°`);
        if (result.rotationAxis) {
          console.log(`    Rotation Axis:  [${result.rotationAxis.map(x => x.toFixed(3)).join(', ')}]`);
        }
      } else if (result.jointType === 'PRISMATIC') {
        console.log(`    Rotation:       ${result.rotation?.toFixed(2)}° (should be < 2° for pure translation)`);
        console.log(`    Distance:       ${result.distance?.toFixed(2)}mm`);
        if (result.translationAxis) {
          console.log(`    Translation Axis: [${result.translationAxis.map(x => x.toFixed(3)).join(', ')}]`);
        }
      }

      console.log(`    Score:          ${result.score.toFixed(1)}`);
      console.log('');
    });
  }

  scene.dispose();
  engine.dispose();
}

main().catch((error) => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});
