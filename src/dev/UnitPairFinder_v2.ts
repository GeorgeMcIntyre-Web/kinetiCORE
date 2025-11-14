/**
 * Unit Pair Finder v2
 *
 * Handles complex hierarchies with multiple joints per unit.
 * Example: UNIT_112 has LH and RH, each with their own FIXED/MOVING.
 *
 * Owner: George (Agent 1 - Claude Code)
 */

import * as BABYLON from '@babylonjs/core';

/**
 * A single joint pair (FIXED ↔ MOVING)
 */
export interface JointPair {
  jointName: string; // e.g., "UNIT_112_LH", "UNIT_112_RH"
  unitName: string; // e.g., "UNIT_112"
  fixedNode: BABYLON.TransformNode;
  movingNode: BABYLON.TransformNode;
  fixedPath: string; // e.g., "UNIT_112/LH/FIXED"
  movingPath: string; // e.g., "UNIT_112/LH/MOVING"
  confidence: number;
  method: 'name-exact' | 'name-fuzzy' | 'geometry' | 'hierarchy';
  geometricSimilarity?: number;
  notes: string[];
}

/**
 * Analysis for one unit (may contain multiple joints)
 */
export interface UnitAnalysis {
  unitName: string;
  unitNode: BABYLON.TransformNode;
  joints: JointPair[];
  hasMultipleJoints: boolean;
  warnings: string[];
}

export interface UnitPairReport {
  totalUnits: number;
  totalJoints: number;
  unitsWithJoints: number;
  unitsWithoutJoints: number;
  units: UnitAnalysis[];
  allJoints: JointPair[];
  warnings: string[];
}

export class UnitPairFinderV2 {
  private scene: BABYLON.Scene;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Find all UNIT_xxx nodes and their joints
   */
  findAllUnitPairs(): UnitPairReport {
    const units = this.findAllUnits();
    const unitAnalyses: UnitAnalysis[] = [];
    const allJoints: JointPair[] = [];
    const warnings: string[] = [];

    console.log(`[UnitPairFinderV2] Found ${units.length} units`);

    for (const unitNode of units) {
      const analysis = this.analyzeUnit(unitNode);
      unitAnalyses.push(analysis);
      allJoints.push(...analysis.joints);
      warnings.push(...analysis.warnings);

      if (analysis.joints.length === 0) {
        console.log(`[UnitPairFinderV2] ❌ ${analysis.unitName}: No joints found`);
      } else if (analysis.hasMultipleJoints) {
        console.log(
          `[UnitPairFinderV2] ✅ ${analysis.unitName}: ${analysis.joints.length} joints found (multi-joint unit)`
        );
        for (const joint of analysis.joints) {
          console.log(`  - ${joint.jointName}: ${joint.fixedPath} ↔ ${joint.movingPath}`);
        }
      } else {
        const joint = analysis.joints[0];
        console.log(
          `[UnitPairFinderV2] ✅ ${analysis.unitName}: ${joint.fixedPath} ↔ ${joint.movingPath}`
        );
      }
    }

    const unitsWithJoints = unitAnalyses.filter(u => u.joints.length > 0).length;

    return {
      totalUnits: units.length,
      totalJoints: allJoints.length,
      unitsWithJoints,
      unitsWithoutJoints: units.length - unitsWithJoints,
      units: unitAnalyses,
      allJoints,
      warnings,
    };
  }

  /**
   * Find all UNIT_xxx nodes in the scene
   */
  private findAllUnits(): BABYLON.TransformNode[] {
    const units: BABYLON.TransformNode[] = [];

    for (const node of this.scene.transformNodes) {
      if (/^UNIT_\d+$/i.test(node.name)) {
        units.push(node);
      }
    }

    // Sort by unit number
    units.sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, ''), 10);
      const numB = parseInt(b.name.replace(/\D/g, ''), 10);
      return numA - numB;
    });

    return units;
  }

  /**
   * Analyze a unit to find all its joints
   */
  analyzeUnit(unitNode: BABYLON.TransformNode): UnitAnalysis {
    const unitName = unitNode.name;
    const joints: JointPair[] = [];
    const warnings: string[] = [];

    // Strategy 1: Look for LH/RH sub-nodes (left/right hand pattern)
    const children = unitNode.getChildren(undefined, false) as BABYLON.Node[];

    const lhNode = children.find(c => c.name.toUpperCase() === 'LH');
    const rhNode = children.find(c => c.name.toUpperCase() === 'RH');

    if (lhNode) {
      const lhJoint = this.findJointInSubtree(lhNode as BABYLON.TransformNode, `${unitName}_LH`);
      if (lhJoint) {
        joints.push(lhJoint);
      } else {
        warnings.push(`${unitName}/LH: No FIXED/MOVING pair found`);
      }
    }

    if (rhNode) {
      const rhJoint = this.findJointInSubtree(rhNode as BABYLON.TransformNode, `${unitName}_RH`);
      if (rhJoint) {
        joints.push(rhJoint);
      } else {
        warnings.push(`${unitName}/RH: No FIXED/MOVING pair found`);
      }
    }

    // Strategy 2: If no LH/RH, look for direct FIXED/MOVING children
    if (joints.length === 0) {
      const directJoint = this.findJointInSubtree(unitNode, unitName);
      if (directJoint) {
        joints.push(directJoint);
      }
    }

    // Strategy 3: Recursively search all descendants
    if (joints.length === 0) {
      const recursiveJoints = this.findJointsRecursive(unitNode, unitName);
      joints.push(...recursiveJoints);
    }

    return {
      unitName,
      unitNode,
      joints,
      hasMultipleJoints: joints.length > 1,
      warnings,
    };
  }

  /**
   * Find a FIXED/MOVING pair within a specific subtree
   */
  private findJointInSubtree(
    node: BABYLON.TransformNode,
    jointName: string
  ): JointPair | null {
    const children = node.getChildren(undefined, false) as BABYLON.Node[];

    // Look for direct FIXED and MOVING children
    const fixedNode = children.find(c => c.name.toUpperCase() === 'FIXED') as
      | BABYLON.TransformNode
      | undefined;
    const movingNode = children.find(c => c.name.toUpperCase() === 'MOVING') as
      | BABYLON.TransformNode
      | undefined;

    if (fixedNode && movingNode) {
      const fixedPath = this.getNodePath(fixedNode);
      const movingPath = this.getNodePath(movingNode);

      const geometricSimilarity = this.compareGeometry(fixedNode, movingNode);

      return {
        jointName,
        unitName: jointName.split('_').slice(0, 2).join('_'), // Extract "UNIT_XXX" from "UNIT_XXX_LH"
        fixedNode,
        movingNode,
        fixedPath,
        movingPath,
        confidence: 1.0,
        method: 'name-exact',
        geometricSimilarity,
        notes: [`Found exact FIXED/MOVING children in ${node.name}`],
      };
    }

    return null;
  }

  /**
   * Recursively search for all FIXED/MOVING pairs in a subtree
   */
  private findJointsRecursive(
    node: BABYLON.TransformNode,
    unitName: string,
    depth: number = 0
  ): JointPair[] {
    if (depth > 5) return []; // Prevent infinite recursion

    const joints: JointPair[] = [];
    const children = node.getChildren(undefined, false) as BABYLON.Node[];

    // Check if this node has FIXED and MOVING children
    const fixedNode = children.find(c => c.name.toUpperCase() === 'FIXED') as
      | BABYLON.TransformNode
      | undefined;
    const movingNode = children.find(c => c.name.toUpperCase() === 'MOVING') as
      | BABYLON.TransformNode
      | undefined;

    if (fixedNode && movingNode) {
      const jointName = `${unitName}_${node.name}`;
      const fixedPath = this.getNodePath(fixedNode);
      const movingPath = this.getNodePath(movingNode);
      const geometricSimilarity = this.compareGeometry(fixedNode, movingNode);

      joints.push({
        jointName,
        unitName,
        fixedNode,
        movingNode,
        fixedPath,
        movingPath,
        confidence: 1.0,
        method: 'hierarchy',
        geometricSimilarity,
        notes: [`Found in subtree: ${node.name}`],
      });
    }

    // Recurse into children
    for (const child of children) {
      if (child instanceof BABYLON.TransformNode) {
        const childJoints = this.findJointsRecursive(child, unitName, depth + 1);
        joints.push(...childJoints);
      }
    }

    return joints;
  }

  /**
   * Get full path of a node (e.g., "UNIT_112/LH/FIXED")
   */
  private getNodePath(node: BABYLON.Node): string {
    const parts: string[] = [];
    let current: BABYLON.Node | null = node;

    while (current) {
      parts.unshift(current.name);
      current = current.parent;
    }

    // Remove root nodes like "9X_110_GEO" or "__root__"
    while (parts.length > 0 && !/^UNIT_\d+$/i.test(parts[0])) {
      parts.shift();
    }

    return parts.join('/');
  }

  /**
   * Compare geometry of two nodes (rotation-invariant bounding box)
   */
  private compareGeometry(node1: BABYLON.TransformNode, node2: BABYLON.TransformNode): number {
    const bbox1 = this.getBoundingBox(node1);
    const bbox2 = this.getBoundingBox(node2);

    if (!bbox1 || !bbox2) {
      const meshes1 = node1.getChildMeshes(true).length;
      const meshes2 = node2.getChildMeshes(true).length;
      console.log(
        `[UnitPairFinderV2] Warning: No bounding box for ${node1.name} (${meshes1} meshes) or ${node2.name} (${meshes2} meshes)`
      );
      return 0;
    }

    // Sort dimensions (rotation-invariant)
    const dims1 = [bbox1.x, bbox1.y, bbox1.z].sort((a, b) => a - b);
    const dims2 = [bbox2.x, bbox2.y, bbox2.z].sort((a, b) => a - b);

    // Volume
    const vol1 = dims1[0] * dims1[1] * dims1[2];
    const vol2 = dims2[0] * dims2[1] * dims2[2];

    if (vol1 < 1e-9 || vol2 < 1e-9) return 0; // No geometry

    // Dimension similarity
    const dimSim =
      (1.0 - Math.abs(dims1[0] - dims2[0]) / Math.max(dims1[0], dims2[0], 1e-6)) *
      (1.0 - Math.abs(dims1[1] - dims2[1]) / Math.max(dims1[1], dims2[1], 1e-6)) *
      (1.0 - Math.abs(dims1[2] - dims2[2]) / Math.max(dims1[2], dims2[2], 1e-6));

    // Volume similarity
    const volSim = 1.0 - Math.abs(vol1 - vol2) / Math.max(vol1, vol2, 1e-6);

    return 0.8 * dimSim + 0.2 * volSim;
  }

  /**
   * Get bounding box size of a node (including all child meshes)
   */
  private getBoundingBox(node: BABYLON.TransformNode): BABYLON.Vector3 | null {
    // Get all child meshes recursively
    const meshes = node.getChildMeshes(true);
    if (meshes.length === 0) return null;

    // Force refresh of all bounding info
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (const mesh of meshes) {
      // Force recompute world matrix
      mesh.computeWorldMatrix(true);

      const boundingInfo = mesh.getBoundingInfo();

      // Use boundingBox.vectorsWorld which gives the 8 corners in world space
      const vectors = boundingInfo.boundingBox.vectorsWorld;

      for (const v of vectors) {
        minX = Math.min(minX, v.x);
        minY = Math.min(minY, v.y);
        minZ = Math.min(minZ, v.z);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
        maxZ = Math.max(maxZ, v.z);
      }
    }

    // Check if we got valid bounds
    if (minX === Infinity || maxX === -Infinity) return null;

    return new BABYLON.Vector3(maxX - minX, maxY - minY, maxZ - minZ);
  }

  /**
   * Export report to markdown
   */
  exportToMarkdown(report: UnitPairReport): string {
    let md = `# Unit Pair Analysis (v2)\n\n`;
    md += `**Total Units:** ${report.totalUnits}\n`;
    md += `**Total Joints:** ${report.totalJoints}\n`;
    md += `**Units with Joints:** ${report.unitsWithJoints}\n`;
    md += `**Units without Joints:** ${report.unitsWithoutJoints}\n\n`;

    if (report.warnings.length > 0) {
      md += `## Warnings\n\n`;
      for (const warning of report.warnings) {
        md += `- ⚠️ ${warning}\n`;
      }
      md += `\n`;
    }

    md += `## Units\n\n`;

    for (const unit of report.units) {
      md += `### ${unit.unitName}\n\n`;

      if (unit.joints.length === 0) {
        md += `❌ No joints found\n\n`;
      } else {
        for (const joint of unit.joints) {
          md += `#### ${joint.jointName}\n\n`;
          md += `- **FIXED:** ${joint.fixedPath}\n`;
          md += `- **MOVING:** ${joint.movingPath}\n`;
          md += `- **Confidence:** ${(joint.confidence * 100).toFixed(0)}%\n`;
          md += `- **Method:** ${joint.method}\n`;
          if (joint.geometricSimilarity !== undefined) {
            md += `- **Geometric Similarity:** ${(joint.geometricSimilarity * 100).toFixed(1)}%\n`;
          }
          if (joint.notes.length > 0) {
            md += `- **Notes:**\n`;
            for (const note of joint.notes) {
              md += `  - ${note}\n`;
            }
          }
          md += `\n`;
        }
      }
    }

    return md;
  }

  /**
   * Export report to JSON
   */
  exportToJSON(report: UnitPairReport): string {
    // Remove circular references (Babylon nodes)
    return JSON.stringify(
      {
        totalUnits: report.totalUnits,
        totalJoints: report.totalJoints,
        unitsWithJoints: report.unitsWithJoints,
        unitsWithoutJoints: report.unitsWithoutJoints,
        units: report.units.map(u => ({
          unitName: u.unitName,
          hasMultipleJoints: u.hasMultipleJoints,
          joints: u.joints.map(j => ({
            jointName: j.jointName,
            unitName: j.unitName,
            fixedPath: j.fixedPath,
            movingPath: j.movingPath,
            confidence: j.confidence,
            method: j.method,
            geometricSimilarity: j.geometricSimilarity,
            notes: j.notes,
          })),
          warnings: u.warnings,
        })),
        warnings: report.warnings,
      },
      null,
      2
    );
  }
}
