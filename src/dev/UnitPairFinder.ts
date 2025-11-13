/**
 * Unit Pair Finder
 *
 * Specialized tool for finding FIXED/MOVING pairs within UNIT_xxx hierarchies.
 * This is more targeted than the general GLBStructureAnalyzer for auto-kinematics.
 *
 * Owner: George (Agent 1 - Claude Code)
 */

import * as BABYLON from '@babylonjs/core';

export interface UnitPair {
  unitName: string;
  unitNode: BABYLON.TransformNode;
  fixedNode: BABYLON.TransformNode | null;
  movingNode: BABYLON.TransformNode | null;
  confidence: number;
  method: 'name-exact' | 'name-fuzzy' | 'geometry' | 'hierarchy';
  geometricSimilarity?: number;
  notes: string[];
}

export interface UnitPairReport {
  totalUnits: number;
  unitsWithPairs: number;
  unitsWithoutPairs: number;
  pairs: UnitPair[];
  warnings: string[];
}

export class UnitPairFinder {
  private scene: BABYLON.Scene;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Find all UNIT_xxx nodes and their FIXED/MOVING pairs
   */
  findAllUnitPairs(): UnitPairReport {
    const units = this.findAllUnits();
    const pairs: UnitPair[] = [];
    const warnings: string[] = [];

    console.log(`[UnitPairFinder] Found ${units.length} units`);

    for (const unitNode of units) {
      const pair = this.findPairForUnit(unitNode);
      pairs.push(pair);

      if (!pair.fixedNode || !pair.movingNode) {
        warnings.push(
          `Unit ${pair.unitName}: Missing ${!pair.fixedNode ? 'FIXED' : 'MOVING'} node`
        );
      }

      console.log(
        `[UnitPairFinder] ${pair.unitName}: ` +
          `FIXED=${pair.fixedNode?.name ?? 'NONE'}, MOVING=${pair.movingNode?.name ?? 'NONE'} ` +
          `(confidence: ${(pair.confidence * 100).toFixed(0)}%, method: ${pair.method})`
      );
    }

    const unitsWithPairs = pairs.filter(p => p.fixedNode && p.movingNode).length;

    return {
      totalUnits: units.length,
      unitsWithPairs,
      unitsWithoutPairs: units.length - unitsWithPairs,
      pairs,
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
   * Find FIXED/MOVING pair for a specific unit
   */
  findPairForUnit(unitNode: BABYLON.TransformNode): UnitPair {
    const unitName = unitNode.name;
    const notes: string[] = [];

    // Strategy 1: Look for direct children named "FIXED" and "MOVING"
    const children = unitNode.getChildren(undefined, false) as BABYLON.TransformNode[];
    let fixedNode: BABYLON.TransformNode | null = null;
    let movingNode: BABYLON.TransformNode | null = null;
    let confidence = 0;
    let method: UnitPair['method'] = 'name-exact';

    // Check for exact name matches
    fixedNode = children.find(c => c.name.toUpperCase() === 'FIXED') as BABYLON.TransformNode;
    movingNode = children.find(c => c.name.toUpperCase() === 'MOVING') as BABYLON.TransformNode;

    if (fixedNode && movingNode) {
      confidence = 1.0;
      method = 'name-exact';
      notes.push('Found exact FIXED/MOVING children');
    } else {
      // Strategy 2: Look for children containing "FIXED" or "MOVING"
      if (!fixedNode) {
        fixedNode = children.find(c => /FIXED/i.test(c.name)) as BABYLON.TransformNode;
        if (fixedNode) {
          notes.push(`Found FIXED via fuzzy match: ${fixedNode.name}`);
          method = 'name-fuzzy';
          confidence = 0.8;
        }
      }

      if (!movingNode) {
        movingNode = children.find(c => /MOVING/i.test(c.name)) as BABYLON.TransformNode;
        if (movingNode) {
          notes.push(`Found MOVING via fuzzy match: ${movingNode.name}`);
          method = 'name-fuzzy';
          confidence = Math.min(confidence || 0.8, 0.8);
        }
      }

      // Strategy 3: Look for LH/RH containing FIXED/MOVING
      if (!fixedNode || !movingNode) {
        const lhNode = children.find(c => c.name.toUpperCase() === 'LH') as BABYLON.TransformNode;
        const rhNode = children.find(c => c.name.toUpperCase() === 'RH') as BABYLON.TransformNode;

        if (lhNode) {
          const lhChildren = lhNode.getChildren(undefined, false) as BABYLON.TransformNode[];
          if (!fixedNode) {
            fixedNode = lhChildren.find(c => /FIXED/i.test(c.name)) as BABYLON.TransformNode;
            if (fixedNode) notes.push(`Found FIXED under LH: ${fixedNode.name}`);
          }
          if (!movingNode) {
            movingNode = lhChildren.find(c => /MOVING/i.test(c.name)) as BABYLON.TransformNode;
            if (movingNode) notes.push(`Found MOVING under LH: ${movingNode.name}`);
          }
        }

        if (rhNode) {
          const rhChildren = rhNode.getChildren(undefined, false) as BABYLON.TransformNode[];
          if (!fixedNode) {
            fixedNode = rhChildren.find(c => /FIXED/i.test(c.name)) as BABYLON.TransformNode;
            if (fixedNode) notes.push(`Found FIXED under RH: ${fixedNode.name}`);
          }
          if (!movingNode) {
            movingNode = rhChildren.find(c => /MOVING/i.test(c.name)) as BABYLON.TransformNode;
            if (movingNode) notes.push(`Found MOVING under RH: ${movingNode.name}`);
          }
        }

        if ((lhNode || rhNode) && (fixedNode || movingNode)) {
          method = 'hierarchy';
          confidence = 0.7;
        }
      }

      // Strategy 4: Geometry-based matching (if we have candidates)
      if (fixedNode && movingNode) {
        const similarity = this.compareGeometry(fixedNode, movingNode);
        notes.push(`Geometric similarity: ${(similarity * 100).toFixed(1)}%`);

        if (similarity >= 0.80) {
          confidence = Math.max(confidence, 0.85);
          notes.push('High geometric similarity confirms pair');
        } else if (similarity < 0.50) {
          notes.push('⚠️ WARNING: Low geometric similarity - verify this pair!');
          confidence *= 0.5; // Reduce confidence
        }
      }
    }

    const geometricSimilarity =
      fixedNode && movingNode ? this.compareGeometry(fixedNode, movingNode) : undefined;

    return {
      unitName,
      unitNode,
      fixedNode,
      movingNode,
      confidence,
      method,
      geometricSimilarity,
      notes,
    };
  }

  /**
   * Compare geometry of two nodes (rotation-invariant bounding box)
   */
  private compareGeometry(node1: BABYLON.TransformNode, node2: BABYLON.TransformNode): number {
    const bbox1 = this.getBoundingBox(node1);
    const bbox2 = this.getBoundingBox(node2);

    if (!bbox1 || !bbox2) return 0;

    // Sort dimensions (rotation-invariant)
    const dims1 = [bbox1.x, bbox1.y, bbox1.z].sort((a, b) => a - b);
    const dims2 = [bbox2.x, bbox2.y, bbox2.z].sort((a, b) => a - b);

    // Volume
    const vol1 = dims1[0] * dims1[1] * dims1[2];
    const vol2 = dims2[0] * dims2[1] * dims2[2];

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
    const meshes = node.getChildMeshes(true);
    if (meshes.length === 0) return null;

    node.computeWorldMatrix(true);

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const boundingInfo = mesh.getBoundingInfo();
      const bbox = boundingInfo.boundingBox;

      const worldMatrix = mesh.getWorldMatrix();
      const corners = [
        BABYLON.Vector3.TransformCoordinates(bbox.minimumWorld, worldMatrix),
        BABYLON.Vector3.TransformCoordinates(bbox.maximumWorld, worldMatrix),
      ];

      for (const corner of corners) {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        minZ = Math.min(minZ, corner.z);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
        maxZ = Math.max(maxZ, corner.z);
      }
    }

    return new BABYLON.Vector3(maxX - minX, maxY - minY, maxZ - minZ);
  }

  /**
   * Export report to markdown
   */
  exportToMarkdown(report: UnitPairReport): string {
    let md = `# Unit Pair Analysis\n\n`;
    md += `**Total Units:** ${report.totalUnits}\n`;
    md += `**Units with Valid Pairs:** ${report.unitsWithPairs}\n`;
    md += `**Units without Pairs:** ${report.unitsWithoutPairs}\n\n`;

    if (report.warnings.length > 0) {
      md += `## Warnings\n\n`;
      for (const warning of report.warnings) {
        md += `- ⚠️ ${warning}\n`;
      }
      md += `\n`;
    }

    md += `## Unit Pairs\n\n`;

    for (const pair of report.pairs) {
      md += `### ${pair.unitName}\n\n`;
      md += `- **FIXED:** ${pair.fixedNode?.name ?? 'NONE'}\n`;
      md += `- **MOVING:** ${pair.movingNode?.name ?? 'NONE'}\n`;
      md += `- **Confidence:** ${(pair.confidence * 100).toFixed(0)}%\n`;
      md += `- **Method:** ${pair.method}\n`;
      if (pair.geometricSimilarity !== undefined) {
        md += `- **Geometric Similarity:** ${(pair.geometricSimilarity * 100).toFixed(1)}%\n`;
      }
      if (pair.notes.length > 0) {
        md += `- **Notes:**\n`;
        for (const note of pair.notes) {
          md += `  - ${note}\n`;
        }
      }
      md += `\n`;
    }

    return md;
  }

  /**
   * Export report to JSON
   */
  exportToJSON(report: UnitPairReport): string {
    return JSON.stringify(
      {
        ...report,
        pairs: report.pairs.map(p => ({
          unitName: p.unitName,
          fixedNodeName: p.fixedNode?.name ?? null,
          movingNodeName: p.movingNode?.name ?? null,
          confidence: p.confidence,
          method: p.method,
          geometricSimilarity: p.geometricSimilarity,
          notes: p.notes,
        })),
      },
      null,
      2
    );
  }
}
