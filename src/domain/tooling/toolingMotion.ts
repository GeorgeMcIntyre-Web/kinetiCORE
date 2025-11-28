/**
 * Tool Motion Joints - Domain Layer
 *
 * Analyzes kinematic snapshots to extract motion joints (revolute/prismatic)
 * from state-based unit detection results.
 *
 * Pure domain logic - no Babylon scene dependencies, no UI.
 */

import type { Matrix } from '@babylonjs/core/Maths/math.vector';
import type {
  ToolingStructure,
  ToolingNodeGeometry,
  JointPair,
} from './types';
import type {
  KinematicSnapshot,
  StateBasedUnitDetectionResult,
  RigidGroup,
  RigidGroupId,
} from './stateBasedUnitDetection';

export type MotionType = 'revolute' | 'prismatic' | 'unknown';

export interface ToolMotionJoint {
  id: string;
  motionType: MotionType;

  baseNodeId: string;
  movingNodeId: string;

  axisWorld: { x: number; y: number; z: number };
  axisOriginWorld: { x: number; y: number; z: number };

  rangeMin: number;
  rangeMax: number;

  unitId?: string;
  jointPairId?: string;
}

export interface ToolMotionBuildOptions {
  minAngularMotionDeg?: number;
  minLinearMotion?: number;
}

const DEFAULT_MOTION_BUILD_OPTIONS: Required<ToolMotionBuildOptions> = {
  minAngularMotionDeg: 1.5,
  minLinearMotion: 0.5,
};

interface CandidateJoint {
  unitId: string;
  baseNodeId: string;
  movingNodeId: string;
  jointPairId: string;
  jointPair: JointPair;
}

interface MotionMeasurement {
  motionType: MotionType;
  axis: { x: number; y: number; z: number };
  axisOrigin: { x: number; y: number; z: number };
  rangeMin: number;
  rangeMax: number;
  amplitude: number;
}

export function buildToolMotionJointsFromState(
  _structure: ToolingStructure,
  _geometryIndex: Map<string, ToolingNodeGeometry>,
  stateResult: StateBasedUnitDetectionResult,
  snapshots: KinematicSnapshot[],
  jointPairs: JointPair[],
  options: ToolMotionBuildOptions = {}
): ToolMotionJoint[] {
  const opts = { ...DEFAULT_MOTION_BUILD_OPTIONS, ...options };

  if (snapshots.length < 2) {
    return [];
  }

  if (stateResult.units.length === 0) {
    return [];
  }

  if (!stateResult.baseGroupId || stateResult.rigidGroups.length === 0) {
    return [];
  }

  const nodeToGroup = buildNodeToGroupMap(stateResult.rigidGroups);
  const groupMap = buildGroupMap(stateResult.rigidGroups);

  const candidates = findCandidateJoints(
    stateResult,
    jointPairs,
    nodeToGroup,
    groupMap
  );

  if (candidates.length === 0) {
    return [];
  }

  const measurements = measureJointMotion(
    candidates,
    snapshots,
    opts
  );

  const filtered = filterAndDeduplicateJoints(measurements, opts);

  return buildMotionJoints(filtered);
}

function buildNodeToGroupMap(rigidGroups: RigidGroup[]): Map<string, RigidGroup> {
  const map = new Map<string, RigidGroup>();

  for (const group of rigidGroups) {
    for (const nodeId of group.nodeIds) {
      map.set(nodeId, group);
    }
  }

  return map;
}

function buildGroupMap(rigidGroups: RigidGroup[]): Map<RigidGroupId, RigidGroup> {
  const map = new Map<RigidGroupId, RigidGroup>();

  for (const group of rigidGroups) {
    map.set(group.id, group);
  }

  return map;
}

function findCandidateJoints(
  stateResult: StateBasedUnitDetectionResult,
  jointPairs: JointPair[],
  nodeToGroup: Map<string, RigidGroup>,
  groupMap: Map<RigidGroupId, RigidGroup>
): CandidateJoint[] {
  const candidates: CandidateJoint[] = [];

  for (const unit of stateResult.units) {
    if (!unit.baseGroupId) {
      continue;
    }

    const baseGroup = groupMap.get(unit.baseGroupId);
    if (!baseGroup) {
      continue;
    }

    const movingGroups = unit.movingGroupIds
      .map(id => groupMap.get(id))
      .filter((g): g is RigidGroup => g !== undefined);

    for (const pair of jointPairs) {
      const groupA = nodeToGroup.get(pair.nodeAId);
      const groupB = nodeToGroup.get(pair.nodeBId);

      if (!groupA || !groupB) {
        continue;
      }

      let baseNodeId: string | undefined;
      let movingNodeId: string | undefined;

      if (groupA.id === unit.baseGroupId && movingGroups.some(g => g.id === groupB.id)) {
        baseNodeId = pair.nodeAId;
        movingNodeId = pair.nodeBId;
      }

      if (groupB.id === unit.baseGroupId && movingGroups.some(g => g.id === groupA.id)) {
        baseNodeId = pair.nodeBId;
        movingNodeId = pair.nodeAId;
      }

      if (!baseNodeId || !movingNodeId) {
        continue;
      }

      const jointPairId = [pair.nodeAId, pair.nodeBId].sort().join('_');

      candidates.push({
        unitId: unit.id,
        baseNodeId,
        movingNodeId,
        jointPairId,
        jointPair: pair,
      });
    }
  }

  return candidates;
}

function measureJointMotion(
  candidates: CandidateJoint[],
  snapshots: KinematicSnapshot[],
  opts: Required<ToolMotionBuildOptions>
): Array<CandidateJoint & MotionMeasurement> {
  const measurements: Array<CandidateJoint & MotionMeasurement> = [];

  for (const candidate of candidates) {
    const baseTransforms: Matrix[] = [];
    const movingTransforms: Matrix[] = [];

    for (const snapshot of snapshots) {
      const baseMatrix = snapshot.nodeWorldMatrices.get(candidate.baseNodeId);
      const movingMatrix = snapshot.nodeWorldMatrices.get(candidate.movingNodeId);

      if (!baseMatrix || !movingMatrix) {
        break;
      }

      baseTransforms.push(baseMatrix);
      movingTransforms.push(movingMatrix);
    }

    if (baseTransforms.length !== snapshots.length) {
      continue;
    }

    const measurement = analyzeMotion(
      candidate,
      baseTransforms,
      movingTransforms,
      opts
    );

    if (!measurement) {
      continue;
    }

    measurements.push({
      ...candidate,
      ...measurement,
    });
  }

  return measurements;
}

function analyzeMotion(
  candidate: CandidateJoint,
  baseTransforms: Matrix[],
  movingTransforms: Matrix[],
  opts: Required<ToolMotionBuildOptions>
): MotionMeasurement | null {
  const relativeDeltas = computeRelativeDeltas(baseTransforms, movingTransforms);

  if (relativeDeltas.length === 0) {
    return null;
  }

  const maxRotationDeg = Math.max(...relativeDeltas.map(d => d.rotationDeg));
  const maxTranslation = Math.max(...relativeDeltas.map(d => d.translationMag));

  const rotationDominant = maxRotationDeg > opts.minAngularMotionDeg * 2 &&
                           maxRotationDeg > maxTranslation * 10;

  const translationDominant = maxTranslation > opts.minLinearMotion * 2 &&
                              maxTranslation > maxRotationDeg * 0.1;

  if (rotationDominant) {
    return analyzeRevoluteMotion(
      candidate,
      baseTransforms,
      movingTransforms,
      relativeDeltas
    );
  }

  if (translationDominant) {
    return analyzePrismaticMotion(
      candidate,
      baseTransforms,
      movingTransforms,
      relativeDeltas
    );
  }

  return null;
}

interface RelativeDelta {
  translationVec: { x: number; y: number; z: number };
  translationMag: number;
  rotationDeg: number;
}

function computeRelativeDeltas(
  baseTransforms: Matrix[],
  movingTransforms: Matrix[]
): RelativeDelta[] {
  const deltas: RelativeDelta[] = [];
  const first = 0;

  for (let i = 1; i < baseTransforms.length; i++) {
    const baseInv = baseTransforms[first].clone().invert();
    const moving0 = movingTransforms[first];
    const movingI = movingTransforms[i];

    const rel0 = moving0.multiply(baseInv);
    const relI = movingI.multiply(baseInv);

    const pos0 = rel0.getTranslation();
    const posI = relI.getTranslation();

    const translationVec = {
      x: posI.x - pos0.x,
      y: posI.y - pos0.y,
      z: posI.z - pos0.z,
    };

    const translationMag = Math.sqrt(
      translationVec.x * translationVec.x +
      translationVec.y * translationVec.y +
      translationVec.z * translationVec.z
    );

    const rot0 = rel0.getRotationMatrix();
    const rotI = relI.getRotationMatrix();
    const rotDelta = rotI.multiply(rot0.clone().invert());

    const trace = rotDelta.m[0] + rotDelta.m[5] + rotDelta.m[10];
    const cosTheta = (trace - 1) / 2;
    const clampedCos = Math.max(-1, Math.min(1, cosTheta));
    const rotationDeg = Math.acos(clampedCos) * (180 / Math.PI);

    deltas.push({
      translationVec,
      translationMag,
      rotationDeg,
    });
  }

  return deltas;
}

function analyzeRevoluteMotion(
  candidate: CandidateJoint,
  baseTransforms: Matrix[],
  movingTransforms: Matrix[],
  deltas: RelativeDelta[]
): MotionMeasurement {
  const axis = candidate.jointPair.axis
    ? normalizeVec(candidate.jointPair.axis)
    : estimateRotationAxis(baseTransforms, movingTransforms);

  const basePos = baseTransforms[0].getTranslation();
  const movingPos = movingTransforms[0].getTranslation();
  const axisOrigin = {
    x: (basePos.x + movingPos.x) / 2,
    y: (basePos.y + movingPos.y) / 2,
    z: (basePos.z + movingPos.z) / 2,
  };

  const angles = deltas.map(d => d.rotationDeg);
  const rangeMin = 0;
  const rangeMax = Math.max(...angles);
  const amplitude = rangeMax - rangeMin;

  return {
    motionType: 'revolute',
    axis,
    axisOrigin,
    rangeMin,
    rangeMax,
    amplitude,
  };
}

function analyzePrismaticMotion(
  _candidate: CandidateJoint,
  baseTransforms: Matrix[],
  _movingTransforms: Matrix[],
  deltas: RelativeDelta[]
): MotionMeasurement {
  const axis = estimatePrismaticAxis(deltas);
  const basePos = baseTransforms[0].getTranslation();
  const axisOrigin = { x: basePos.x, y: basePos.y, z: basePos.z };

  const distances = deltas.map(d => {
    return d.translationVec.x * axis.x +
           d.translationVec.y * axis.y +
           d.translationVec.z * axis.z;
  });

  const rangeMin = Math.min(0, ...distances);
  const rangeMax = Math.max(0, ...distances);
  const amplitude = rangeMax - rangeMin;

  return {
    motionType: 'prismatic',
    axis,
    axisOrigin,
    rangeMin,
    rangeMax,
    amplitude,
  };
}

function estimateRotationAxis(
  baseTransforms: Matrix[],
  movingTransforms: Matrix[]
): { x: number; y: number; z: number } {
  const baseInv = baseTransforms[0].clone().invert();
  const rel0 = movingTransforms[0].multiply(baseInv);
  const rel1 = movingTransforms[1].multiply(baseInv);

  const rot0 = rel0.getRotationMatrix();
  const rot1 = rel1.getRotationMatrix();
  const rotDelta = rot1.multiply(rot0.clone().invert());

  const m = rotDelta.m;
  const axis = {
    x: m[7] - m[5],
    y: m[2] - m[6],
    z: m[3] - m[1],
  };

  return normalizeVec(axis);
}

function estimatePrismaticAxis(
  deltas: RelativeDelta[]
): { x: number; y: number; z: number } {
  if (deltas.length === 0) {
    return { x: 0, y: 0, z: 1 };
  }

  let maxMag = 0;
  let maxVec = deltas[0].translationVec;

  for (const delta of deltas) {
    if (delta.translationMag > maxMag) {
      maxMag = delta.translationMag;
      maxVec = delta.translationVec;
    }
  }

  return normalizeVec(maxVec);
}

function normalizeVec(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

  if (mag < 1e-9) {
    return { x: 0, y: 0, z: 1 };
  }

  return {
    x: v.x / mag,
    y: v.y / mag,
    z: v.z / mag,
  };
}

function filterAndDeduplicateJoints(
  measurements: Array<CandidateJoint & MotionMeasurement>,
  opts: Required<ToolMotionBuildOptions>
): Array<CandidateJoint & MotionMeasurement> {
  const filtered: Array<CandidateJoint & MotionMeasurement> = [];

  for (const m of measurements) {
    if (m.motionType === 'unknown') {
      continue;
    }

    if (m.motionType === 'revolute' && m.amplitude < opts.minAngularMotionDeg) {
      continue;
    }

    if (m.motionType === 'prismatic' && m.amplitude < opts.minLinearMotion) {
      continue;
    }

    filtered.push(m);
  }

  const byPairId = new Map<string, Array<CandidateJoint & MotionMeasurement>>();

  for (const m of filtered) {
    const key = m.jointPairId;
    const existing = byPairId.get(key);

    if (!existing) {
      byPairId.set(key, [m]);
      continue;
    }

    existing.push(m);
  }

  const deduplicated: Array<CandidateJoint & MotionMeasurement> = [];

  for (const group of byPairId.values()) {
    if (group.length === 1) {
      deduplicated.push(group[0]);
      continue;
    }

    const sorted = [...group].sort((a, b) => b.amplitude - a.amplitude);
    deduplicated.push(sorted[0]);
  }

  return deduplicated;
}

function buildMotionJoints(
  measurements: Array<CandidateJoint & MotionMeasurement>
): ToolMotionJoint[] {
  const joints: ToolMotionJoint[] = [];

  for (let i = 0; i < measurements.length; i++) {
    const m = measurements[i];

    joints.push({
      id: `motion_joint_${i}`,
      motionType: m.motionType,
      baseNodeId: m.baseNodeId,
      movingNodeId: m.movingNodeId,
      axisWorld: m.axis,
      axisOriginWorld: m.axisOrigin,
      rangeMin: m.rangeMin,
      rangeMax: m.rangeMax,
      unitId: m.unitId,
      jointPairId: m.jointPairId,
    });
  }

  return joints;
}
