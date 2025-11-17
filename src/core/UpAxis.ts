// Scene Up-Axis helpers
// Factory piping operates inside Babylon space (Y-up internal coordinates).
// This module centralizes the up-axis so services do not hard-code "y".

import * as BABYLON from '@babylonjs/core';

export type AxisKey = 'x' | 'y' | 'z';

const SCENE_UP_AXIS: AxisKey = 'y';

/**
 * Returns the active up-axis for Babylon scenes.
 */
export function getSceneUpAxis(): AxisKey {
  return SCENE_UP_AXIS;
}

/**
 * Returns the Babylon axis vector aligned with the active up-axis.
 */
export function getSceneUpVector(): BABYLON.Vector3 {
  const axis = getSceneUpAxis();
  if (axis === 'x') {
    return BABYLON.Axis.X;
  }
  if (axis === 'y') {
    return BABYLON.Axis.Y;
  }
  return BABYLON.Axis.Z;
}

/**
 * Read the component value along the up-axis.
 */
export function getAxisValue(
  source: { x: number; y: number; z: number },
  axis: AxisKey
): number {
  if (axis === 'x') {
    return source.x;
  }
  if (axis === 'y') {
    return source.y;
  }
  return source.z;
}

/**
 * Returns a copy of the vector with the up-axis replaced.
 */
export function setAxisValue<T extends { x: number; y: number; z: number }>(
  source: T,
  axis: AxisKey,
  nextValue: number
): T {
  if (axis === 'x') {
    return { ...source, x: nextValue };
  }
  if (axis === 'y') {
    return { ...source, y: nextValue };
  }
  return { ...source, z: nextValue };
}

/**
 * Returns a copy of the vector with the up-axis offset applied.
 */
export function addAxisValue<T extends { x: number; y: number; z: number }>(
  source: T,
  axis: AxisKey,
  delta: number
): T {
  if (delta === 0) {
    return source;
  }
  const updated = getAxisValue(source, axis) + delta;
  return setAxisValue(source, axis, updated);
}
