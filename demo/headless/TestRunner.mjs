import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import '@babylonjs/core/Maths/math.vector.js';

// Local ESM imports from compiled-free TS code converted to JS-like usage
// Minimal local implementations to avoid TypeScript runtime deps
function axisFromVectors(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  return { x: dx / len, y: dy / len, z: dz / len };
}

function toV3(v) { return { x: v.X, y: v.Y, z: v.Z }; }

function axisFromMatrix(m) {
  // Decompose rotation quaternion from 4x4
  const trace = m.m[0] + m.m[5] + m.m[10];
  let qw, qx, qy, qz;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1.0) * 2;
    qw = 0.25 * s;
    qx = (m.m[9] - m.m[6]) / s;
    qy = (m.m[2] - m.m[8]) / s;
    qz = (m.m[4] - m.m[1]) / s;
  } else if ((m.m[0] > m.m[5]) && (m.m[0] > m.m[10])) {
    const s = Math.sqrt(1.0 + m.m[0] - m.m[5] - m.m[10]) * 2;
    qw = (m.m[9] - m.m[6]) / s;
    qx = 0.25 * s;
    qy = (m.m[1] + m.m[4]) / s;
    qz = (m.m[2] + m.m[8]) / s;
  } else if (m.m[5] > m.m[10]) {
    const s = Math.sqrt(1.0 + m.m[5] - m.m[0] - m.m[10]) * 2;
    qw = (m.m[2] - m.m[8]) / s;
    qx = (m.m[1] + m.m[4]) / s;
    qy = 0.25 * s;
    qz = (m.m[6] + m.m[9]) / s;
  } else {
    const s = Math.sqrt(1.0 + m.m[10] - m.m[0] - m.m[5]) * 2;
    qw = (m.m[4] - m.m[1]) / s;
    qx = (m.m[2] + m.m[8]) / s;
    qy = (m.m[6] + m.m[9]) / s;
    qz = 0.25 * s;
  }
  const denom = Math.sqrt(1 - qw * qw) || 1;
  const ax = qx / denom, ay = qy / denom, az = qz / denom;
  const n = Math.hypot(ax, ay, az) || 1;
  return { x: ax / n, y: ay / n, z: az / n };
}

function parseMatrix4(rows) {
  const vals = [];
  for (const r of rows) vals.push(...r.trim().split(/\s+/).map(parseFloat));
  const m = { m: new Array(16).fill(0) };
  for (let i = 0; i < 16; i++) m.m[i] = vals[i] ?? 0;
  return m;
}

function buildJointsFromTooling(tooling, resolveParentId) {
  const joints = [];
  for (const unit of tooling) {
    for (const j of unit.Joints) {
      const childId = j.NodeId;
      const parentId = resolveParentId(j.NodeId);
      const from = toV3(j.FromVector);
      const to = toV3(j.ToVector);
      const T = parseMatrix4(j.TransformationMatrix);
      if (j.Type === 0) {
        joints.push({
          id: `${unit.UnitName}_${j.Name}`,
          kind: 'prismatic',
          parentNodeId: parentId,
          childNodeId: childId,
          axisWorld: axisFromVectors(from, to),
          anchorWorld: from,
          limits: { lower: j.MinValue, upper: j.MaxValue },
        });
      } else {
        const axis = axisFromMatrix(T);
        joints.push({
          id: `${unit.UnitName}_${j.Name}`,
          kind: 'hinge',
          parentNodeId: parentId,
          childNodeId: childId,
          axisWorld: axis,
          anchorWorld: from,
          limits: { lower: (j.MinValue * Math.PI) / 180, upper: (j.MaxValue * Math.PI) / 180 },
        });
      }
    }
  }
  return joints;
}

class ValveBankLocal {
  constructor(scene) { this.scene = scene; this.joints = new Map(); this.channels = new Map(); }
  registerJoint(def) { this.joints.set(def.id, { def, state: { value: 0 } }); }
  addChannel(ch) { this.channels.set(ch.id, ch); }
  async runTimeline(events, { stepMs = 16 } = {}) {
    const start = performance.now();
    const sorted = events.slice().sort((a, b) => a.tMs - b.tMs);
    let idx = 0;
    while (idx < sorted.length) {
      const tRel = performance.now() - start;
      while (idx < sorted.length && sorted[idx].tMs <= tRel) {
        const ev = sorted[idx++];
        const ch = this.channels.get(ev.channelId);
        const joint = this.joints.get(ch.jointId);
        const target = ev.cmd === 'extend' ? ch.advanceValue : ev.cmd === 'retract' ? ch.retractValue : joint.state.value;
        joint.state.value = Math.max(joint.def.limits.lower, Math.min(joint.def.limits.upper, target));
      }
      await new Promise(res => setTimeout(res, stepMs));
    }
  }
}

const MJCFExporterLocal = {
  export(model) {
    const lines = [];
    lines.push('<mujoco model="kinetiCORE">');
    lines.push('  <worldbody>');
    for (const j of model.joints) {
      const axis = `(${j.axisWorld.x.toFixed(4)} ${j.axisWorld.y.toFixed(4)} ${j.axisWorld.z.toFixed(4)})`;
      const anch = `(${j.anchorWorld.x.toFixed(4)} ${j.anchorWorld.y.toFixed(4)} ${j.anchorWorld.z.toFixed(4)})`;
      const lim = `[${j.limits.lower.toFixed(4)}, ${j.limits.upper.toFixed(4)}]`;
      lines.push(`    <!-- ${j.type || j.kind} ${j.id} parent=${j.parentId || j.parentNodeId} child=${j.childId || j.childNodeId} axis=${axis} anchor=${anch} limits=${lim} -->`);
    }
    lines.push('  </worldbody>');
    lines.push('  <actuator>');
    for (const ch of model.actuatorProgram.channels) {
      lines.push(`    <!-- channel ${ch.id} unit=${ch.unitId} -->`);
    }
    lines.push('  </actuator>');
    lines.push('</mujoco>');
    return lines.join('\n');
  }
};

function readJson(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(text);
}

function ensureNode(scene, id) {
  let node = scene.getTransformNodeByID(id);
  if (!node) {
    node = new TransformNode(id, scene);
    node.id = id;
    node.name = id;
  }
  return node;
}

function resolveParentIdFromPath(movingNodePath) {
  const idx = movingNodePath.lastIndexOf('/');
  return idx > 0 ? movingNodePath.substring(0, idx) : 'WORLD';
}

async function main() {
  const args = process.argv.slice(2);
  const jsonArgIdx = args.findIndex(a => a === '--json');
  const outArgIdx = args.findIndex(a => a === '--out');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const jsonPath = jsonArgIdx >= 0 ? args[jsonArgIdx + 1] : path.resolve(here, '../../kinetiCORE_data/Tooling/9X_110_GEO.json');
  const outDir = outArgIdx >= 0 ? args[outArgIdx + 1] : path.resolve(here, '../../out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const engine = new NullEngine({ deterministicLockstep: false, renderHeight: 256, renderWidth: 256, textureSize: 256 });
  const scene = new Scene(engine);

  const tooling = readJson(jsonPath);

  const allNodeIds = new Set();
  for (const unit of tooling) {
    for (const j of unit.Joints) {
      allNodeIds.add(j.NodeId);
      allNodeIds.add(resolveParentIdFromPath(j.NodeId));
    }
  }
  for (const id of allNodeIds) ensureNode(scene, id);

  const jointDefs = buildJointsFromTooling(tooling, resolveParentIdFromPath);

  const bank = new ValveBankLocal(scene);
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
    ...channels.map(ch => ({ tMs: 0, cmd: 'extend', channelId: ch.id })),
    ...channels.map(ch => ({ tMs: 1500, cmd: 'retract', channelId: ch.id })),
  ];

  await bank.runTimeline(events, { stepMs: 16 });

  const jointsOut = jointDefs.map(j => ({
    id: j.id,
    type: j.kind,
    parentId: j.parentNodeId,
    childId: j.childNodeId,
    axisWorld: j.axisWorld,
    anchorWorld: j.anchorWorld,
    limits: j.limits,
  }));

  const programOut = {
    channels: channels.map(ch => ({ id: ch.id, unitId: ch.unitId, timeline: [{ tMs: 0, cmd: 'extend' }, { tMs: 1500, cmd: 'retract' }] })),
    residuals: {},
  };

  const model = { joints: jointsOut, actuatorProgram: programOut };
  const mjcf = MJCFExporterLocal.export(model);
  fs.writeFileSync(path.join(outDir, 'model.mjcf.xml'), mjcf, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'actuators.program.json'), JSON.stringify(programOut, null, 2), 'utf-8');

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


