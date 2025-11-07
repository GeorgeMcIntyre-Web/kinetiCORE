import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import '@babylonjs/core/Maths/math.vector.js';

import { ToolingFileJson } from '../../src/babylon/io/ToolingJsonAdapter';
import { KinematicRigBuilder } from '../../src/babylon/kinematics/KinematicRigBuilder';
import { ValveBank } from '../../src/babylon/actuation/ValveBank';
import { MJCFExporter } from '../../src/babylon/io/MJCFExporter';
import { JointDefinitionOutput, ActuatorProgramOutput, KinematicModelExport } from '../../src/babylon/io/Schemas';

function readJson(filePath: string): any {
  const text = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(text);
}

function ensureNode(scene: Scene, id: string): TransformNode {
  let node = scene.getTransformNodeByID(id) as TransformNode;
  if (!node) {
    node = new TransformNode(id, scene);
    node.id = id;
    node.name = id;
  }
  return node;
}

function resolveParentIdFromPath(movingNodePath: string): string {
  // parent = everything before last segment
  const idx = movingNodePath.lastIndexOf('/');
  return idx > 0 ? movingNodePath.substring(0, idx) : 'WORLD';
}

async function main() {
  const args = process.argv.slice(2);
  const jsonArgIdx = args.findIndex(a => a === '--json');
  const outArgIdx = args.findIndex(a => a === '--out');
  const here = typeof __dirname === 'string' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
  const jsonPath = jsonArgIdx >= 0 ? args[jsonArgIdx + 1] : path.resolve(here, '../../kinetiCORE_data/Tooling/9X_110_GEO.json');
  const outDir = outArgIdx >= 0 ? args[outArgIdx + 1] : path.resolve(here, '../../out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const engine = new NullEngine({ deterministicLockstep: false, renderHeight: 256, renderWidth: 256, textureSize: 256 });
  const scene = new Scene(engine);

  // Load tooling JSON
  const tooling: ToolingFileJson = readJson(jsonPath);

  // Create transform nodes for all referenced paths
  const allNodeIds = new Set<string>();
  for (const unit of tooling) {
    for (const j of unit.Joints) {
      allNodeIds.add(j.NodeId);
      allNodeIds.add(resolveParentIdFromPath(j.NodeId));
    }
  }
  for (const id of allNodeIds) ensureNode(scene, id);

  // Build joints
  const jointDefs = KinematicRigBuilder.fromToolingJson(scene, tooling, resolveParentIdFromPath);

  // Register in valve bank and create simple program
  const bank = new ValveBank(scene);
  for (const j of jointDefs) bank.registerJoint(j);

  const channels = jointDefs.map((j, i) => ({
    id: `ch_${i}_${j.id}`,
    unitId: j.childNodeId,
    jointId: j.id,
    advanceValue: j.limits.upper,
    retractValue: j.limits.lower,
  }));
  for (const ch of channels) bank.addChannel(ch);

  const events = [
    ...channels.map(ch => ({ tMs: 0, cmd: 'extend' as const, channelId: ch.id })),
    ...channels.map(ch => ({ tMs: 1500, cmd: 'retract' as const, channelId: ch.id })),
  ];

  await bank.runTimeline(events, { stepMs: 16 });

  // Export MJCF skeleton and actuator program JSON
  const jointsOut: JointDefinitionOutput[] = jointDefs.map(j => ({
    id: j.id,
    type: j.kind,
    parentId: j.parentNodeId,
    childId: j.childNodeId,
    axisWorld: j.axisWorld,
    anchorWorld: j.anchorWorld,
    limits: j.limits,
  }));

  const programOut: ActuatorProgramOutput = {
    channels: channels.map(ch => ({ id: ch.id, unitId: ch.unitId, timeline: [{ tMs: 0, cmd: 'extend' }, { tMs: 1500, cmd: 'retract' }] })),
    residuals: {},
  };

  const model: KinematicModelExport = { joints: jointsOut, actuatorProgram: programOut };
  const mjcf = MJCFExporter.export(model);
  fs.writeFileSync(path.join(outDir, 'model.mjcf.xml'), mjcf, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'actuators.program.json'), MJCFExporter.exportProgram(programOut), 'utf-8');

  // Basic assertions
  // Threshold tolerance bookkeeping: 0.25 degrees (reserved for future use)
  const ok = jointsOut.length > 0 && channels.length === jointsOut.length;
  if (!ok) {
    console.error('Test failed: joints/channels mismatch or none created.');
    process.exit(1);
  }
  console.log('Headless test completed. Outputs written to', outDir);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


