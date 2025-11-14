import * as BABYLON from '@babylonjs/core';
import {
  addAxisValue,
  getAxisValue,
  getSceneUpAxis,
  setAxisValue,
} from '../../core/UpAxis';
import {
  DEFAULT_PIPING_PLACEMENT_SETTINGS,
  PipingPlacementSettings,
  PipingPlacementMode,
} from '../../domain/factoryServices/piping/pipingPlacement';
import { Position3D } from '../../domain/factoryServices/piping/pipingTypes';

export interface PipingPickResolver {
  handlePick(pickedMesh: BABYLON.AbstractMesh | null): {
    type: 'node' | 'segment' | null;
    id: string | null;
  };
}

const FLOOR_NAME_HINTS = ['ground', 'floor', 'slab', 'deck'];

export type PlacementDecision =
  | { kind: 'no-placement'; reason: string }
  | { kind: 'snap-to-node'; nodeId: string }
  | { kind: 'place-new'; position: Position3D };

interface PlacementResolutionParams {
  pickInfo: BABYLON.PickingInfo | null | undefined;
  pickResolver: PipingPickResolver | null;
  placementSettings?: PipingPlacementSettings;
}

export function resolvePipingHitForPlacement(
  params: PlacementResolutionParams
): PlacementDecision {
  const pickInfo = params.pickInfo;
  if (!pickInfo) {
    return { kind: 'no-placement', reason: 'no pick info' };
  }

  if (!pickInfo.hit) {
    return { kind: 'no-placement', reason: 'ray missed' };
  }

  if (!pickInfo.pickedPoint) {
    return { kind: 'no-placement', reason: 'missing picked point' };
  }

  const pickResolver = params.pickResolver;
  if (pickResolver) {
    const pickResult = pickResolver.handlePick(pickInfo.pickedMesh ?? null);
    if (pickResult.type === 'node' && pickResult.id) {
      return { kind: 'snap-to-node', nodeId: pickResult.id };
    }
  }

  if (!isValidHit(pickInfo.pickedMesh)) {
    return { kind: 'no-placement', reason: 'invalid mesh hit' };
  }

  const settings = params.placementSettings ?? DEFAULT_PIPING_PLACEMENT_SETTINGS;
  const basePosition = createPositionFromPick(pickInfo.pickedPoint);
  const isFloorHit = isFloorMesh(pickInfo.pickedMesh);
  if (isFloorHit) {
    const elevated = applyElevationOffset(basePosition, settings.elevationOffset);
    return { kind: 'place-new', position: elevated };
  }

  const resolved = resolveNonFloorPosition(basePosition, settings);
  if (!resolved) {
    return { kind: 'no-placement', reason: 'non-floor hit without rule' };
  }

  return { kind: 'place-new', position: resolved };
}

function createPositionFromPick(point: BABYLON.Vector3): Position3D {
  return { x: point.x, y: point.y, z: point.z };
}

function isValidHit(mesh: BABYLON.AbstractMesh | null | undefined): boolean {
  if (!mesh) {
    return true;
  }
  if (mesh.isDisposed()) {
    return false;
  }
  return true;
}

function isFloorMesh(mesh: BABYLON.AbstractMesh | null | undefined): boolean {
  if (!mesh) {
    return false;
  }

  const metadata = mesh.metadata as Record<string, unknown> | undefined;
  if (metadata && metadata.pipingFloor === true) {
    return true;
  }

  const name = mesh.name?.toLowerCase() ?? '';
  if (name.length === 0) {
    return false;
  }

  for (const hint of FLOOR_NAME_HINTS) {
    if (name.includes(hint)) {
      return true;
    }
  }

  return false;
}

function resolveNonFloorPosition(
  basePosition: Position3D,
  settings: PipingPlacementSettings
): Position3D | null {
  const mode = settings.mode;
  if (mode === 'project-to-floor') {
    return projectToFloor(basePosition, settings);
  }
  if (mode === 'fixed-elevation') {
    return applyFixedElevation(basePosition, settings);
  }
  return applyElevationOffset(basePosition, settings.elevationOffset);
}

function projectToFloor(
  position: Position3D,
  settings: PipingPlacementSettings
): Position3D {
  const upAxis = getSceneUpAxis();
  const floorHeight = settings.defaultFloorHeight;
  const flattened = setAxisValue(position, upAxis, floorHeight);
  return applyElevationOffset(flattened, settings.elevationOffset);
}

function applyFixedElevation(
  position: Position3D,
  settings: PipingPlacementSettings
): Position3D | null {
  const upAxis = getSceneUpAxis();
  const fixed = settings.fixedElevation;
  if (fixed === null) {
    return null;
  }
  const updated = setAxisValue(position, upAxis, fixed);
  return applyElevationOffset(updated, settings.elevationOffset);
}

function applyElevationOffset(position: Position3D, offset: number): Position3D {
  if (offset === 0) {
    return position;
  }
  const upAxis = getSceneUpAxis();
  return addAxisValue(position, upAxis, offset);
}

export function getUpAxisValue(position: Position3D): number {
  const upAxis = getSceneUpAxis();
  return getAxisValue(position, upAxis);
}

export function describePlacementMode(mode: PipingPlacementMode): string {
  if (mode === 'project-to-floor') {
    return 'project-to-floor';
  }
  if (mode === 'fixed-elevation') {
    return 'fixed-elevation';
  }
  return 'follow-surface';
}
