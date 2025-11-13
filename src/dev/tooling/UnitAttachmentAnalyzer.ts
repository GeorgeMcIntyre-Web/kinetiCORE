/**
 * UnitAttachmentAnalyzer
 * 
 * Discovers unit-to-base attachments geometrically from the start pose.
 * Uses XY projection overlap and vertical gap analysis - no name-based logic.
 */

import * as BABYLON from '@babylonjs/core';
import { ToolingSceneExplorer, UnitCandidate, RigidCluster } from './ToolingSceneExplorer';

export interface UnitAttachment {
  unitId: string;
  baseClusterId: string;
  contactAreaApprox: number;
  contactPoints: BABYLON.Vector3[];
}

export class UnitAttachmentAnalyzer {
  constructor(
    private scene: BABYLON.Scene,
    private explorer: ToolingSceneExplorer
  ) {}

  /**
   * Analyze attachments between units and base clusters.
   */
  analyzeAttachments(): { units: UnitCandidate[]; attachments: UnitAttachment[] } {
    const { units, baseClusters } = this.explorer.getUnitCandidates();
    const attachments: UnitAttachment[] = [];

    const OVERLAP_AREA_THRESHOLD = 0.0001; // 1cm² minimum overlap
    const VERTICAL_GAP_TOLERANCE = 0.01; // 1cm maximum gap

    for (const unit of units) {
      let hasAttachment = false;

      for (const baseCluster of baseClusters) {
        const overlapArea = this.computeXYOverlapArea(unit.bbox, baseCluster.bbox);
        const verticalGap = this.computeVerticalGap(unit.bbox, baseCluster.bbox);

        if (overlapArea > OVERLAP_AREA_THRESHOLD && verticalGap < VERTICAL_GAP_TOLERANCE) {
          const contactPoints = this.sampleContactPoints(unit.bbox, baseCluster.bbox, overlapArea);
          
          attachments.push({
            unitId: unit.id,
            baseClusterId: baseCluster.id,
            contactAreaApprox: overlapArea,
            contactPoints,
          });

          hasAttachment = true;
        }
      }

      if (!hasAttachment) {
        console.warn(`[UnitAttachmentAnalyzer] Unit ${unit.id} has no base attachments`);
      }
    }

    return { units, attachments };
  }

  /**
   * Compute overlap area of two bounding boxes projected onto XY plane.
   */
  private computeXYOverlapArea(
    bbox1: BABYLON.BoundingBox,
    bbox2: BABYLON.BoundingBox
  ): number {
    const min1 = bbox1.minimumWorld;
    const max1 = bbox1.maximumWorld;
    const min2 = bbox2.minimumWorld;
    const max2 = bbox2.maximumWorld;

    // Project to XY plane
    const x1Min = min1.x;
    const x1Max = max1.x;
    const y1Min = min1.y;
    const y1Max = max1.y;

    const x2Min = min2.x;
    const x2Max = max2.x;
    const y2Min = min2.y;
    const y2Max = max2.y;

    // Compute overlap rectangle
    const xOverlap = Math.max(0, Math.min(x1Max, x2Max) - Math.max(x1Min, x2Min));
    const yOverlap = Math.max(0, Math.min(y1Max, y2Max) - Math.max(y1Min, y2Min));

    return xOverlap * yOverlap;
  }

  /**
   * Compute vertical gap between unit bottom and base top.
   */
  private computeVerticalGap(
    unitBbox: BABYLON.BoundingBox,
    baseBbox: BABYLON.BoundingBox
  ): number {
    const unitBottom = unitBbox.minimumWorld.z;
    const baseTop = baseBbox.maximumWorld.z;

    // Gap is positive if unit is above base, negative if overlapping
    return unitBottom - baseTop;
  }

  /**
   * Sample contact points from the overlap region.
   * Returns 4 corners + center, converted to 3D with base top Z.
   */
  private sampleContactPoints(
    unitBbox: BABYLON.BoundingBox,
    baseBbox: BABYLON.BoundingBox,
    overlapArea: number
  ): BABYLON.Vector3[] {
    if (overlapArea < 1e-10) {
      return [];
    }

    const min1 = unitBbox.minimumWorld;
    const max1 = unitBbox.maximumWorld;
    const min2 = baseBbox.minimumWorld;
    const max2 = baseBbox.maximumWorld;

    // Compute overlap rectangle in XY
    const xMin = Math.max(min1.x, min2.x);
    const xMax = Math.min(max1.x, max2.x);
    const yMin = Math.max(min1.y, min2.y);
    const yMax = Math.min(max1.y, max2.y);

    const xCenter = (xMin + xMax) * 0.5;
    const yCenter = (yMin + yMax) * 0.5;
    const baseTopZ = baseBbox.maximumWorld.z;

    // Return 4 corners + center
    return [
      new BABYLON.Vector3(xMin, yMin, baseTopZ), // Bottom-left
      new BABYLON.Vector3(xMax, yMin, baseTopZ), // Bottom-right
      new BABYLON.Vector3(xMax, yMax, baseTopZ), // Top-right
      new BABYLON.Vector3(xMin, yMax, baseTopZ), // Top-left
      new BABYLON.Vector3(xCenter, yCenter, baseTopZ), // Center
    ];
  }
}

