// Shared types for the snap system
// Extracted from SnappingHelper.ts for better organization

import * as BABYLON from '@babylonjs/core';

export type SnapType =
  | 'grid'
  | 'vertex'
  | 'edge'
  | 'face'
  | 'center'
  | 'object'
  | 'midpoint'
  | 'intersection'
  | 'perpendicular'
  | 'tangent'
  | 'along'
  | 'normal'
  | 'plane'
  | 'axis'
  | 'curve'
  | 'surface'
  | 'objectToVertex'
  | 'pointOnEdge'
  | 'bboxCorner';

export interface SnapResult {
  snapped: boolean;
  position: BABYLON.Vector3;
  snapType?: SnapType;
  targetMeshName?: string;
  visualFeedback?: BABYLON.Vector3[];

  // Circle-specific metadata (used by showPreviewDot for 'center')
  circleNormal?: BABYLON.Vector3;
  circleRadius?: number;
  circleVertices?: BABYLON.Vector3[];
}


