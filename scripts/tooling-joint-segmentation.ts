// scripts/tooling-joint-segmentation.ts
//
// Usage:
//   npx tsx scripts/tooling-joint-segmentation.ts "C:/path/to/9X_110_GEO.glb" "C:/path/to/9X_110_GEO.json"
//
// Output:
//   <glbName>.joint-segmentation.json

import { NodeIO, type Node, type Primitive } from '@gltf-transform/core';
import fs from 'node:fs';
import path from 'node:path';

type Vec3 = { x: number; y: number; z: number };

type RawJoint = {
  Name: string;
  ElectricalName: string;
  NodeId: string;
  HideId: string;
  Type: number;
  MaxValue: number;
  MinValue: number;
  ToVector: { X: number; Y: number; Z: number };
  FromVector: { X: number; Y: number; Z: number };
  TransformationMatrix: string[];
};

type RawUnit = {
  UnitName: string;
  Joints: RawJoint[];
};

type SegmentedJoint = {
  name: string;
  electricalName: string;
  nodePath: string;
  type: 'prismatic' | 'revolute' | 'unknown';
  min: number;
  max: number;
  axis: Vec3;
  origin: Vec3;
  matrix4x4: number[];
};

type SegmentedUnit = {
  unitName: string;
  meshIds: number[];
  nodePaths: string[];
  joints: SegmentedJoint[];
};

type MeshNodeInfo = {
  id: number;
  node: Node;
  path: string;
};

const io = new NodeIO();

const glbPath = process.argv[2];
const jointsJsonPath = process.argv[3];

if (glbPath === undefined || jointsJsonPath === undefined) {
  console.error('Usage: npx tsx scripts/tooling-joint-segmentation.ts <path-to-glb> <path-to-9X_110_GEO.json>');
  process.exit(1);
}

run().catch(err => {
  console.error('Joint segmentation failed:', err);
  process.exit(1);
});

async function run() {
  if (!fs.existsSync(glbPath)) {
    console.error('GLB not found:', glbPath);
    process.exit(1);
  }

  if (!fs.existsSync(jointsJsonPath)) {
    console.error('Joint JSON not found:', jointsJsonPath);
    process.exit(1);
  }

  // Try to read the GLB - if it fails due to Draco compression, decompress it first
  let doc;
  let tempGlbPath: string | null = null;
  
  try {
    doc = await io.read(glbPath);
  } catch (err: any) {
    if (err?.message?.includes('KHR_draco_mesh_compression')) {
      console.log('GLB uses Draco compression. Decompressing...');
      
      // Create a temporary decompressed GLB file
      const tempDir = path.join(path.dirname(glbPath), '.temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const glbName = path.basename(glbPath, '.glb');
      tempGlbPath = path.join(tempDir, `${glbName}_decompressed.glb`);
      
      // Use gltf-transform copy to decompress (copy without compression = decompress)
      // Quote paths to handle spaces
      const { spawn } = await import('node:child_process');
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('npx', ['@gltf-transform/cli', 'copy', `"${glbPath}"`, `"${tempGlbPath}"`], {
          stdio: 'inherit',
          shell: true,
        });
        
        proc.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Decompression failed with code ${code}`));
          }
        });
        
        proc.on('error', (err) => {
          reject(err);
        });
      });
      
      console.log('Decompression complete. Processing decompressed GLB...');
      doc = await io.read(tempGlbPath);
    } else {
      throw err;
    }
  }
  const scene = doc.getRoot().getDefaultScene();
  if (!scene) {
    console.error('GLB has no default scene');
    process.exit(1);
  }

  const sceneChildren = scene.listChildren();
  if (sceneChildren.length === 0) {
    console.error('Scene has no children');
    process.exit(1);
  }

  const fixtureRoot =
    sceneChildren.find(n => n.listChildren().length > 0) ?? sceneChildren[0];

  const fixtureName = fixtureRoot.getName() || '(fixture-root)';
  console.log('Fixture root:', fixtureName);

  const { pathToNode, nodeToParent } = buildPathIndex(fixtureRoot, fixtureName);
  const meshInfos = collectMeshInfos(fixtureRoot, pathToNode);

  console.log(`Indexed ${pathToNode.size} nodes, ${meshInfos.length} meshes`);

  const raw = JSON.parse(fs.readFileSync(jointsJsonPath, 'utf8')) as unknown;
  if (!Array.isArray(raw)) {
    console.error('Joint JSON is not an array of units');
    process.exit(1);
  }

  const rawUnits = raw as RawUnit[];

  const units: SegmentedUnit[] = rawUnits.map(unit =>
    segmentUnit(unit, pathToNode, nodeToParent, meshInfos),
  );

  const out = {
    fixtureName,
    glbPath,
    jointsJsonPath,
    units,
  };

  const outPath = makeOutputPath(glbPath);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

  console.log('Joint segmentation JSON written to:', outPath);
  
  // Clean up temporary decompressed GLB if it was created
  if (tempGlbPath && fs.existsSync(tempGlbPath)) {
    try {
      fs.unlinkSync(tempGlbPath);
      console.log('Cleaned up temporary decompressed GLB');
    } catch (err) {
      console.warn('Failed to clean up temporary GLB:', err);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Path index + mesh collection                                       */
/* ------------------------------------------------------------------ */

function buildPathIndex(root: Node, rootName: string): {
  pathToNode: Map<string, Node>;
  nodeToParent: Map<Node, Node>;
} {
  const pathToNode = new Map<string, Node>();
  const nodeToParent = new Map<Node, Node>();

  const stack: { node: Node; path: string; parent: Node | null }[] = [
    { node: root, path: rootName, parent: null },
  ];

  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) continue;

    pathToNode.set(item.path, item.node);
    if (item.parent) {
      nodeToParent.set(item.node, item.parent);
    }

    const children = item.node.listChildren();
    children.forEach(child => {
      const childName = child.getName() || '(node)';
      const childPath = `${item.path}/${childName}`;
      stack.push({ node: child, path: childPath, parent: item.node });
    });
  }

  return { pathToNode, nodeToParent };
}

function collectMeshInfos(
  root: Node,
  pathToNode: Map<string, Node>,
): MeshNodeInfo[] {
  const result: MeshNodeInfo[] = [];
  const idByNode = new Map<Node, number>();

  let nextId = 0;

  pathToNode.forEach((node, path) => {
    const mesh = node.getMesh();
    if (!mesh) return;

    const prims = mesh.listPrimitives();
    if (prims.length === 0) return;

    const hasVerts = prims.some((prim: Primitive) => {
      const pos = prim.getAttribute('POSITION');
      if (!pos) return false;
      return pos.getCount() > 0;
    });

    if (!hasVerts) return;

    const id = nextId;
    nextId += 1;

    idByNode.set(node, id);
    result.push({ id, node, path });
  });

  return result;
}

/* ------------------------------------------------------------------ */
/* Unit segmentation                                                  */
/* ------------------------------------------------------------------ */

function segmentUnit(
  rawUnit: RawUnit,
  pathToNode: Map<string, Node>,
  nodeToParent: Map<Node, Node>,
  meshInfos: MeshNodeInfo[],
): SegmentedUnit {
  const joints = rawUnit.Joints ?? [];
  const jointResults: SegmentedJoint[] = [];
  const unitNodePaths = new Set<string>();
  const unitMeshIds = new Set<number>();

  joints.forEach(j => {
    const jointNode = findNodeForJoint(j, pathToNode);
    if (!jointNode) return;

    const jointNodePath = findPathForNode(jointNode, pathToNode);
    if (!jointNodePath) return;

    const linkRoot = findUnitRoot(jointNode, rawUnit.UnitName, nodeToParent, pathToNode);
    if (!linkRoot) return;

    const linkRootPath = findPathForNode(linkRoot, pathToNode);
    if (linkRootPath) unitNodePaths.add(linkRootPath);

    const joint = buildSegmentedJoint(j, jointNodePath);
    jointResults.push(joint);

    const meshIds = collectMeshesUnderNode(linkRoot, meshInfos);
    meshIds.forEach(id => unitMeshIds.add(id));
  });

  return {
    unitName: rawUnit.UnitName,
    meshIds: Array.from(unitMeshIds),
    nodePaths: Array.from(unitNodePaths),
    joints: jointResults,
  };
}

function findNodeForJoint(
  joint: RawJoint,
  pathToNode: Map<string, Node>,
): Node | undefined {
  const node = pathToNode.get(joint.NodeId);
  if (node) return node;

  // Fallback: sometimes NodeId might not include the fixture root name
  const alt = Array.from(pathToNode.entries()).find(([key]) =>
    key.endsWith(joint.NodeId),
  );

  if (!alt) return undefined;
  return alt[1];
}

function findPathForNode(
  target: Node,
  pathToNode: Map<string, Node>,
): string | undefined {
  for (const [path, node] of pathToNode.entries()) {
    if (node === target) return path;
  }

  return undefined;
}

/**
 * Walk up from the joint node until we hit the UNIT_xxx node
 * that matches rawUnitName.
 */
function findUnitRoot(
  node: Node,
  rawUnitName: string,
  nodeToParent: Map<Node, Node>,
  pathToNode: Map<string, Node>,
): Node | undefined {
  let current: Node | undefined = node;

  while (current) {
    const name = current.getName() || '';
    const isUnit = name === rawUnitName;
    if (isUnit) return current;

    const parent = nodeToParent.get(current);
    if (!parent) break;
    current = parent;
  }

  // Fallback: use path name contains UNIT_xxx
  const target = Array.from(pathToNode.values()).find(n => {
    const nm = n.getName() || '';
    const matches = nm === rawUnitName;
    return matches;
  });

  return target;
}

function buildSegmentedJoint(
  joint: RawJoint,
  nodePath: string,
): SegmentedJoint {
  const from: Vec3 = {
    x: joint.FromVector.X,
    y: joint.FromVector.Y,
    z: joint.FromVector.Z,
  };

  const to: Vec3 = {
    x: joint.ToVector.X,
    y: joint.ToVector.Y,
    z: joint.ToVector.Z,
  };

  const axis = normalizeVec3({
    x: to.x - from.x,
    y: to.y - from.y,
    z: to.z - from.z,
  });

  const type: SegmentedJoint['type'] =
    joint.Type === 0
      ? 'prismatic'
      : joint.Type === 1
      ? 'revolute'
      : 'unknown';

  const matrix4x4 = parseMatrix(joint.TransformationMatrix);

  return {
    name: joint.Name,
    electricalName: joint.ElectricalName,
    nodePath,
    type,
    min: joint.MinValue,
    max: joint.MaxValue,
    axis,
    origin: from,
    matrix4x4,
  };
}

function collectMeshesUnderNode(
  root: Node,
  meshInfos: MeshNodeInfo[],
): number[] {
  const ids: number[] = [];
  const stack: Node[] = [root];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;

    meshInfos.forEach(info => {
      if (info.node === node) ids.push(info.id);
    });

    node.listChildren().forEach(child => stack.push(child));
  }

  return ids;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function normalizeVec3(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len <= 1e-8) return { x: 0, y: 0, z: 0 };
  const inv = 1 / len;
  return { x: v.x * inv, y: v.y * inv, z: v.z * inv };
}

function parseMatrix(lines: string[]): number[] {
  const values: number[] = [];

  lines.forEach(line => {
    const tokens = line.trim().split(/\s+/);
    tokens.forEach(tok => {
      const value = Number.parseFloat(tok);
      if (Number.isFinite(value)) values.push(value);
    });
  });

  if (values.length !== 16) return values;
  return values;
}

function makeOutputPath(glbPathLocal: string): string {
  const dir = path.dirname(glbPathLocal);
  const base = path.basename(glbPathLocal, path.extname(glbPathLocal));
  return path.join(dir, `${base}.joint-segmentation.json`);
}

