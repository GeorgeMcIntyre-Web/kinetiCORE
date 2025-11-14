/**
 * GLB Structure Inspector
 *
 * Diagnostic tool to analyze 9X_110_GEO.glb and understand:
 * 1. Transform node hierarchy
 * 2. Mesh to transform node relationships
 * 3. Name patterns for UNIT_XXX nodes
 * 4. Bounding box dimensions for each node
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { SceneTreeManager } from '../scene/SceneTreeManager';

interface NodeInspection {
  name: string;
  uniqueId: number;
  path: string;
  type: 'TransformNode' | 'Mesh' | 'AbstractMesh';
  hasGeometry: boolean;
  meshCount: number;
  childCount: number;
  position: { x: number; y: number; z: number };
  boundingBox?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    dimensions: number[]; // [small, medium, large] sorted
    volume: number;
  };
  sceneTreeId?: string;
  sceneTreeBabylonId?: string;
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
 */
function computeAggregateBoundingBox(node: BABYLON.TransformNode): NodeInspection['boundingBox'] | undefined {
  node.computeWorldMatrix(true);

  const meshes = node.getChildMeshes(false) as BABYLON.AbstractMesh[];

  if (meshes.length === 0) {
    return undefined;
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
  const dimensions = [sizeX, sizeY, sizeZ].sort((a, b) => a - b);
  const volume = sizeX * sizeY * sizeZ;

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    dimensions,
    volume
  };
}

/**
 * Inspect a single node and gather all relevant data
 */
function inspectNode(node: BABYLON.Node): NodeInspection {
  const path = getNodePath(node);
  const pos = node instanceof BABYLON.TransformNode
    ? node.getAbsolutePosition()
    : BABYLON.Vector3.Zero();

  let type: NodeInspection['type'];
  if (node instanceof BABYLON.Mesh) {
    type = 'Mesh';
  } else if (node instanceof BABYLON.AbstractMesh) {
    type = 'AbstractMesh';
  } else {
    type = 'TransformNode';
  }

  const meshes = node instanceof BABYLON.TransformNode
    ? node.getChildMeshes(false)
    : [];

  const hasGeometry = meshes.length > 0;
  const childCount = node.getChildren().length;

  const inspection: NodeInspection = {
    name: node.name,
    uniqueId: node.uniqueId,
    path,
    type,
    hasGeometry,
    meshCount: meshes.length,
    childCount,
    position: { x: pos.x, y: pos.y, z: pos.z }
  };

  // Compute bounding box for transform nodes with geometry
  if (node instanceof BABYLON.TransformNode && hasGeometry) {
    inspection.boundingBox = computeAggregateBoundingBox(node);
  }

  // Try to find SceneTree mapping
  const sceneTree = SceneTreeManager.getInstance();
  const sceneNode = sceneTree.getNodeByBabylonTransformNodeId(node.uniqueId.toString());

  if (sceneNode) {
    inspection.sceneTreeId = sceneNode.id;
    inspection.sceneTreeBabylonId = sceneNode.babylonTransformNodeId;
  }

  return inspection;
}

/**
 * Recursively inspect all nodes in the scene
 */
function inspectAllNodes(rootNode: BABYLON.Node): NodeInspection[] {
  const inspections: NodeInspection[] = [];

  function traverse(node: BABYLON.Node) {
    inspections.push(inspectNode(node));

    for (const child of node.getChildren()) {
      traverse(child);
    }
  }

  traverse(rootNode);

  return inspections;
}

/**
 * Main inspection function
 */
export async function inspectGLBStructure(
  glbPath: string,
  scene: BABYLON.Scene
): Promise<{
  rootNode: BABYLON.TransformNode | null;
  totalNodes: number;
  transformNodes: number;
  meshes: number;
  unitNodes: NodeInspection[];
  allNodes: NodeInspection[];
  report: string;
}> {
  console.log('================================================================================');
  console.log('GLB STRUCTURE INSPECTION');
  console.log('================================================================================');
  console.log(`File: ${glbPath}`);
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
  console.log(`[LOAD] ✓ GLB loaded successfully`);
  console.log(`[LOAD]   - Meshes: ${result.meshes.length}`);
  console.log(`[LOAD]   - Transform nodes: ${result.transformNodes.length}`);
  console.log(`[LOAD]   - Skeletons: ${result.skeletons.length}`);
  console.log(`[LOAD]   - Particle systems: ${result.particleSystems.length}\n`);

  // Find root node
  let rootNode: BABYLON.TransformNode | null = null;

  // Try to find 9X_110_GEO root
  for (const node of result.transformNodes) {
    if (node.name === '9X_110_GEO' || node.name.includes('9X_110') || !node.parent) {
      rootNode = node;
      console.log(`[ROOT] Found root node: ${node.name} (uniqueId: ${node.uniqueId})\n`);
      break;
    }
  }

  if (!rootNode && result.transformNodes.length > 0) {
    rootNode = result.transformNodes[0];
    console.log(`[ROOT] Using first transform node as root: ${rootNode.name}\n`);
  }

  if (!rootNode) {
    throw new Error('No root transform node found in GLB');
  }

  // Inspect all nodes
  console.log('[INSPECT] Analyzing node hierarchy...');
  const allNodes = inspectAllNodes(rootNode);
  console.log(`[INSPECT] ✓ Inspected ${allNodes.length} nodes\n`);

  // Count by type
  const transformNodes = allNodes.filter(n => n.type === 'TransformNode').length;
  const meshes = allNodes.filter(n => n.type === 'Mesh' || n.type === 'AbstractMesh').length;

  // Find all UNIT nodes
  const unitNodes = allNodes.filter(n =>
    /UNIT_\d+/i.test(n.name) ||
    /RH|LH/i.test(n.name) ||
    /FIXED|MOVING/i.test(n.name)
  );

  console.log('[UNITS] Unit-related nodes:');
  console.log(`  - Total unit nodes: ${unitNodes.length}\n`);

  // Group by UNIT number
  const unitGroups = new Map<string, NodeInspection[]>();

  for (const node of unitNodes) {
    const match = node.name.match(/UNIT_(\d+)/i);
    if (match) {
      const unitNum = match[1];
      if (!unitGroups.has(unitNum)) {
        unitGroups.set(unitNum, []);
      }
      unitGroups.get(unitNum)!.push(node);
    }
  }

  // Print detailed unit information
  for (const [unitNum, nodes] of unitGroups.entries()) {
    console.log(`  UNIT_${unitNum}:`);
    console.log(`    - Total nodes: ${nodes.length}`);

    for (const node of nodes) {
      console.log(`    - ${node.name}`);
      console.log(`        Path: ${node.path}`);
      console.log(`        UniqueId: ${node.uniqueId}`);
      console.log(`        Type: ${node.type}`);
      console.log(`        Has geometry: ${node.hasGeometry} (${node.meshCount} meshes)`);
      console.log(`        Children: ${node.childCount}`);
      console.log(`        Position: (${node.position.x.toFixed(3)}, ${node.position.y.toFixed(3)}, ${node.position.z.toFixed(3)})`);

      if (node.boundingBox) {
        const bbox = node.boundingBox;
        console.log(`        Bounding box:`);
        console.log(`          Dimensions (sorted): [${bbox.dimensions.map(d => d.toFixed(4)).join(', ')}]m`);
        console.log(`          Volume: ${bbox.volume.toFixed(6)}m³`);
      }

      if (node.sceneTreeId) {
        console.log(`        ✓ SceneTree: ${node.sceneTreeId} (babylonId: ${node.sceneTreeBabylonId})`);
      } else {
        console.log(`        ❌ NOT in SceneTree`);
      }

      console.log('');
    }
  }

  // Check for RH/LH pairs
  console.log('[PAIRS] Looking for RH/LH pairs...\n');

  const rhNodes = allNodes.filter(n => /\bRH\b/i.test(n.name));
  const lhNodes = allNodes.filter(n => /\bLH\b/i.test(n.name));

  console.log(`  - RH nodes: ${rhNodes.length}`);
  console.log(`  - LH nodes: ${lhNodes.length}\n`);

  // Try to match RH/LH pairs by bounding box
  for (const rhNode of rhNodes) {
    if (!rhNode.boundingBox) continue;

    console.log(`  ${rhNode.path}:`);
    console.log(`    Dimensions: [${rhNode.boundingBox.dimensions.map(d => d.toFixed(4)).join(', ')}]m`);

    // Find matching LH node
    for (const lhNode of lhNodes) {
      if (!lhNode.boundingBox) continue;

      // Check if in same UNIT
      const rhUnit = rhNode.path.match(/UNIT_(\d+)/i)?.[1];
      const lhUnit = lhNode.path.match(/UNIT_(\d+)/i)?.[1];

      if (rhUnit !== lhUnit) continue;

      // Compute dimension similarity
      const dims1 = rhNode.boundingBox.dimensions;
      const dims2 = lhNode.boundingBox.dimensions;

      const diffs = dims1.map((d, i) => Math.abs(d - dims2[i]) / Math.max(d, dims2[i]));
      const weightedDiff = diffs[0] * 0.2 + diffs[1] * 0.3 + diffs[2] * 0.5;
      const similarity = 1 - weightedDiff;

      if (similarity > 0.90) {
        console.log(`    ✅ MATCH: ${lhNode.path}`);
        console.log(`       Similarity: ${similarity.toFixed(3)}`);
        console.log(`       LH Dimensions: [${dims2.map(d => d.toFixed(4)).join(', ')}]m`);
      }
    }

    console.log('');
  }

  // Build text report
  const report = [
    '===============================================================================',
    'GLB STRUCTURE INSPECTION REPORT',
    '===============================================================================',
    `File: ${glbPath}`,
    `Timestamp: ${new Date().toISOString()}`,
    '',
    'SUMMARY:',
    `  - Total nodes: ${allNodes.length}`,
    `  - Transform nodes: ${transformNodes}`,
    `  - Meshes: ${meshes}`,
    `  - Unit nodes: ${unitNodes.length}`,
    `  - Unit groups: ${unitGroups.size}`,
    '',
    'UNIT GROUPS:',
    ...Array.from(unitGroups.entries()).map(([unitNum, nodes]) =>
      `  - UNIT_${unitNum}: ${nodes.length} nodes`
    ),
    '',
    'SCENETREE MAPPING:',
    `  - Nodes in SceneTree: ${allNodes.filter(n => n.sceneTreeId).length}`,
    `  - Nodes missing from SceneTree: ${allNodes.filter(n => !n.sceneTreeId && n.type === 'TransformNode').length}`,
    '',
    '==============================================================================='
  ].join('\n');

  console.log('\n' + report);

  return {
    rootNode,
    totalNodes: allNodes.length,
    transformNodes,
    meshes,
    unitNodes,
    allNodes,
    report
  };
}

/**
 * Export function to window for browser console access
 */
if (typeof window !== 'undefined') {
  (window as any).inspectGLBStructure = inspectGLBStructure;
}
