/**
 * V2 Units Pipeline - Integration layer.
 * 
 * This module wires the domain-level unit detection and joint pair detection
 * into a complete pipeline that can generate units-v2.json files.
 */

import type {
  ToolingStructure,
  ToolingUnit,
  JointPair,
  ToolingNodeGeometry,
} from './types';
import { detectUnits } from './unitDetection';
import { findJointPairsForUnits } from './jointPairDetection';
import type { UnitDetectionOptions } from './unitDetection';
import type { JointPairDetectionOptions } from './jointPairDetection';

/**
 * V2 Units output format (JSON serializable).
 */
export interface UnitsV2Output {
  units: Array<{
    unitId: string;
    nodeIds: string[];
    bbox: {
      min: { x: number; y: number; z: number };
      max: { x: number; y: number; z: number };
    };
    centroid: { x: number; y: number; z: number };
    jointPairs?: Array<{
      nodeAId: string;
      nodeBId: string;
      score: number;
      axis: { x: number; y: number; z: number };
      gap: number;
      overlapRatio: number;
    }>;
  }>;
  metadata?: {
    detectionAlgorithm: string;
    version: string;
    timestamp: string;
  };
}

/**
 * Run the complete v2 units pipeline.
 * 
 * @param structure - Tooling structure tree
 * @param geometryIndex - Map of nodeId -> point cloud geometry
 * @param options - Detection options
 * @returns V2 units output
 */
export function runUnitsV2Pipeline(
  structure: ToolingStructure,
  geometryIndex: Map<string, ToolingNodeGeometry>,
  options: {
    unitDetection?: UnitDetectionOptions;
    jointPairDetection?: JointPairDetectionOptions;
    includeJointPairs?: boolean;
  } = {}
): UnitsV2Output {
  const { unitDetection = {}, jointPairDetection = {}, includeJointPairs = true } = options;

  // Phase 1: Detect units
  const units = detectUnits(structure, geometryIndex, unitDetection);

  // Phase 2: Find joint pairs (optional)
  let jointPairs: JointPair[] = [];
  if (includeJointPairs && units.length > 0) {
    jointPairs = findJointPairsForUnits(units, geometryIndex, structure, jointPairDetection);
  }

  // Group joint pairs by unit
  const pairsByUnit = new Map<string, JointPair[]>();
  for (const pair of jointPairs) {
    const unitPairs = pairsByUnit.get(pair.unitId) || [];
    unitPairs.push(pair);
    pairsByUnit.set(pair.unitId, unitPairs);
  }

  // Build output
  const output: UnitsV2Output = {
    units: units.map(unit => {
      const unitPairs = pairsByUnit.get(unit.unitId) || [];
      
      return {
        unitId: unit.unitId,
        nodeIds: unit.nodeIds,
        bbox: unit.bbox,
        centroid: unit.centroid,
        jointPairs: unitPairs.length > 0 ? unitPairs.map(pair => ({
          nodeAId: pair.nodeAId,
          nodeBId: pair.nodeBId,
          score: pair.score,
          axis: pair.axis,
          gap: pair.gap,
          overlapRatio: pair.overlapRatio,
        })) : undefined,
      };
    }),
    metadata: {
      detectionAlgorithm: 'hierarchical-point-cloud-v2',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
    },
  };

  return output;
}

