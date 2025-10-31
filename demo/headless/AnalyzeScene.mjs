import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import '@babylonjs/core/Maths/math.vector.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function ensureNode(scene, id) {
  let node = scene.getTransformNodeByID(id);
  if (!node) {
    node = new TransformNode(id, scene);
    node.id = id;
    node.name = id;
  }
  return node;
}

function getParentId(pathStr) {
  const idx = pathStr.lastIndexOf('/');
  return idx > 0 ? pathStr.substring(0, idx) : null;
}

function classifyUnits(scene) {
  // Heuristic similar to ToolGraphAnalyzer: consider top-level UNIT_* as units
  const units = [];
  const root = scene.rootNodes[0];
  const children = root ? root.getChildren() : [];
  for (const u of children) {
    if (!u.id.includes('UNIT_')) continue;
    const unitId = u.id;
    const stack = [u];
    const nodeIds = [];
    let moving = false;
    while (stack.length) {
      const n = stack.pop();
      nodeIds.push(n.id);
      if (n.id.toLowerCase().includes('/moving')) moving = true;
      for (const c of n.getChildren()) stack.push(c);
    }
    // Mark unit fixed if it has no '/MOVING' descendants; else moving
    const isFixed = !moving;
    units.push({ id: unitId, name: unitId, isFixed, nodes: nodeIds });
  }
  return units;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonArgIdx = args.findIndex(a => a === '--json');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const jsonPath = jsonArgIdx >= 0 ? args[jsonArgIdx + 1] : path.resolve(here, '../../kinetiCORE_data/Tooling/9X_110_GEO.json');
  const tooling = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  const engine = new NullEngine();
  const scene = new Scene(engine);

  // Build a synthetic tree mimicking GLB hierarchy using NodeId paths
  const rootName = '9X_110_GEO';
  const root = new TransformNode(rootName, scene);
  root.id = rootName;
  for (const unit of tooling) {
    for (const j of unit.Joints) {
      const pathStr = j.NodeId;
      const segments = pathStr.split('/');
      let parent = root;
      let currentPath = rootName;
      for (let i = 1; i < segments.length; i++) {
        currentPath = currentPath + '/' + segments[i];
        let child = scene.getTransformNodeByID(currentPath);
        if (!child) {
          child = new TransformNode(currentPath, scene);
          child.id = currentPath;
          child.name = currentPath;
          child.parent = parent;
        }
        parent = child;
      }
    }
  }

  const units = classifyUnits(scene);
  const numFixed = units.filter(u => u.isFixed).length;
  const numMoving = units.length - numFixed;
  console.log(`Units total: ${units.length}, fixed: ${numFixed}, moving: ${numMoving}`);
  for (const u of units) {
    console.log(` - ${u.name}: ${u.isFixed ? 'fixed' : 'moving'} (${u.nodes.length} nodes)`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });




