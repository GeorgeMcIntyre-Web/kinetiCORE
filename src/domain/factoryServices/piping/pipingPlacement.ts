import {
  Position3D,
  PipingNode,
  PipingPlacementSettings,
  PipingPlacementMode,
} from './pipingTypes';

export type PlacementFallback = 'none' | 'defaultElevation' | 'snapToFloor';

export interface PlacementComputationInput {
  floorPoint: Position3D | null;
  pointerPoint: Position3D | null;
  snapCandidate: PipingNode | null;
}

export interface PlacementComputationResult {
  position: Position3D;
  appliedMode: PipingPlacementMode;
  snappedNodeId: string | null;
  floorPoint: Position3D | null;
  fallback: PlacementFallback;
}

export function computePlacementPosition(
  settings: PipingPlacementSettings,
  input: PlacementComputationInput
): PlacementComputationResult {
  const pointerPoint = clonePosition(input.pointerPoint ?? input.floorPoint);
  if (!pointerPoint) {
    throw new Error('Piping placement requires a pointer position');
  }

  if (settings.mode === 'snap' && input.snapCandidate) {
    const snappedPosition = clonePosition(input.snapCandidate.position);
    return {
      position: snappedPosition,
      appliedMode: 'snap',
      snappedNodeId: input.snapCandidate.id,
      floorPoint: clonePosition(input.floorPoint),
      fallback: 'none',
    };
  }

  if (settings.mode === 'snap') {
    return fallbackToFloor(settings, pointerPoint, input.floorPoint);
  }

  if (settings.mode === 'floor' && input.floorPoint) {
    const floorPosition = clonePosition(input.floorPoint);
    return {
      position: floorPosition,
      appliedMode: 'floor',
      snappedNodeId: null,
      floorPoint: floorPosition,
      fallback: 'none',
    };
  }

  if (settings.mode === 'floor') {
    return fallbackToDefaultElevation(settings, pointerPoint);
  }

  if (settings.mode === 'elevation') {
    return applyElevation(pointerPoint, settings.defaultElevationZ, input.floorPoint);
  }

  return {
    position: clonePosition(pointerPoint),
    appliedMode: 'floor',
    snappedNodeId: null,
    floorPoint: clonePosition(input.floorPoint),
    fallback: 'none',
  };
}

const fallbackToFloor = (
  settings: PipingPlacementSettings,
  pointerPoint: Position3D,
  floorPoint: Position3D | null
): PlacementComputationResult => {
  if (floorPoint) {
    const resolvedFloor = clonePosition(floorPoint);
    return {
      position: resolvedFloor,
      appliedMode: 'floor',
      snappedNodeId: null,
      floorPoint: resolvedFloor,
      fallback: 'snapToFloor',
    };
  }

  return fallbackToDefaultElevation(settings, pointerPoint);
};

const fallbackToDefaultElevation = (
  settings: PipingPlacementSettings,
  pointerPoint: Position3D
): PlacementComputationResult => {
  const elevated = {
    x: pointerPoint.x,
    y: pointerPoint.y,
    z: settings.defaultElevationZ,
  };

  return {
    position: elevated,
    appliedMode: 'elevation',
    snappedNodeId: null,
    floorPoint: null,
    fallback: 'defaultElevation',
  };
};

const applyElevation = (
  pointerPoint: Position3D,
  elevationZ: number,
  floorPoint: Position3D | null
): PlacementComputationResult => {
  const position = {
    x: pointerPoint.x,
    y: pointerPoint.y,
    z: elevationZ,
  };

  return {
    position,
    appliedMode: 'elevation',
    snappedNodeId: null,
    floorPoint: clonePosition(floorPoint),
    fallback: 'none',
  };
};

const clonePosition = (position: Position3D | null): Position3D | null => {
  if (!position) {
    return null;
  }

  return {
    x: position.x,
    y: position.y,
    z: position.z,
  };
};

