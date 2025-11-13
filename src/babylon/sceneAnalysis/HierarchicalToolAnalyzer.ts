/**
 * Hierarchical Tool Analyzer
 *
 * Properly detects automotive tooling structure:
 * - UNIT_XXX as the unit (assembly level)
 * - RH/LH/MOVING nodes as joints within each unit
 *
 * Matches the reference JSON format from 9X_110_GEO.json
 */

import * as BABYLON from '@babylonjs/core';

export interface JointDefinition {
  name: string; // e.g., "C1", "C2"
  electricalName: string; // e.g., "UNIT_112L", "UNIT_114R"
  nodeId: string; // Full path: "9X_110_GEO/UNIT_112/LH/MOVING"
  movingNode: BABYLON.TransformNode;
  fixedNode?: BABYLON.TransformNode; // Corresponding FIXED node if exists
  type: 0 | 1; // 0 = Prismatic, 1 = Revolute
  side: 'RH' | 'LH' | 'UNKNOWN'; // Which side (RH or LH)
  uniqueId: number; // Babylon uniqueId for easy lookup
}

export interface UnitDefinition {
  unitName: string; // e.g., "UNIT_112"
  unitNode: BABYLON.TransformNode;
  uniqueId: number;
  joints: JointDefinition[];
  children: BABYLON.Node[];
}

export interface HierarchicalToolGraph {
  units: UnitDefinition[];
  totalJoints: number;
}

/**
 * Get full path for a node in the scene hierarchy
 */
function getNodePath(node: BABYLON.Node): string {
  const parts: string[] = [];
  let current: BABYLON.Node | null = node;

  while (current) {
    parts.unshift(current.name);
    current = current.parent;
  }

  return parts.join('/');
}

/**
 * Hierarchical Tool Analyzer
 *
 * Detects:
 * - UNIT_XXX nodes as units
 * - MOVING nodes under RH/LH as joints
 */
export class HierarchicalToolAnalyzer {
  /**
   * Analyze a scene to find units and their joints
   *
   * @param scene - Babylon scene
   * @param rootNode - Root node to search from (e.g., "9X_110_GEO")
   * @returns HierarchicalToolGraph with units and joints
   */
  analyze(
    _scene: BABYLON.Scene,
    rootNode: BABYLON.Node
  ): HierarchicalToolGraph {
    console.log('[HierarchicalToolAnalyzer] ========================================');
    console.log('[HierarchicalToolAnalyzer] Starting analysis from:', rootNode.name);
    console.log('[HierarchicalToolAnalyzer] ========================================\n');

    const units: UnitDefinition[] = [];

    // Step 1: Find all UNIT_XXX nodes
    const unitNodes = this.findUnitNodes(rootNode);
    console.log(`[HierarchicalToolAnalyzer] Found ${unitNodes.length} UNIT_XXX nodes\n`);

    // Step 2: For each unit, find its joints
    for (const unitNode of unitNodes) {
      const joints = this.findJointsInUnit(unitNode);

      units.push({
        unitName: unitNode.name,
        unitNode: unitNode as BABYLON.TransformNode,
        uniqueId: unitNode.uniqueId,
        joints,
        children: unitNode.getChildren()
      });

      console.log(`[HierarchicalToolAnalyzer] ${unitNode.name}: ${joints.length} joint(s)`);
      joints.forEach(joint => {
        console.log(`  - ${joint.name}: ${joint.nodeId} (${joint.type === 0 ? 'Prismatic' : 'Revolute'})`);
      });
      console.log('');
    }

    const totalJoints = units.reduce((sum, unit) => sum + unit.joints.length, 0);

    console.log('[HierarchicalToolAnalyzer] ========================================');
    console.log('[HierarchicalToolAnalyzer] SUMMARY');
    console.log('[HierarchicalToolAnalyzer] ========================================');
    console.log(`Total units: ${units.length}`);
    console.log(`Total joints: ${totalJoints}`);
    console.log('[HierarchicalToolAnalyzer] ========================================\n');

    return {
      units,
      totalJoints
    };
  }

  /**
   * Find all UNIT_XXX nodes under a root node
   */
  private findUnitNodes(rootNode: BABYLON.Node): BABYLON.Node[] {
    const unitNodes: BABYLON.Node[] = [];
    const stack: BABYLON.Node[] = [rootNode];

    while (stack.length > 0) {
      const node = stack.pop()!;

      // Check if this node matches UNIT_XXX pattern
      if (/^UNIT_\d+$/i.test(node.name)) {
        unitNodes.push(node);
        // Don't traverse into this unit's children for more units
        // (we want UNIT_XXX level, not nested units)
        continue;
      }

      // Add children to stack
      const children = node.getChildren();
      stack.push(...children);
    }

    return unitNodes;
  }

  /**
   * Find all joints (MOVING nodes) within a unit
   */
  private findJointsInUnit(unitNode: BABYLON.Node): JointDefinition[] {
    const joints: JointDefinition[] = [];
    let jointCounter = 1;

    // Look for RH and LH containers
    const children = unitNode.getChildren();

    for (const child of children) {
      // Check if this is an RH or LH node
      const childName = child.name.toUpperCase();
      let side: 'RH' | 'LH' | 'UNKNOWN' = 'UNKNOWN';

      if (childName === 'RH' || childName.includes('RH')) {
        side = 'RH';
      } else if (childName === 'LH' || childName.includes('LH')) {
        side = 'LH';
      }

      if (side !== 'UNKNOWN') {
        // Look for MOVING nodes under this side
        const movingNodes = this.findMovingNodes(child);

        for (const movingNode of movingNodes) {
          const nodeId = getNodePath(movingNode);
          const jointName = `C${jointCounter}`;
          const electricalName = `${unitNode.name}${side === 'RH' ? 'R' : 'L'}`;

          // Try to find corresponding FIXED node (for reference, not required)
          const fixedNode = this.findFixedNode(child);

          // Determine joint type (will be refined later with ICP)
          // For now, default to revolute (1) - will be updated during analysis
          const type: 0 | 1 = 1;

          joints.push({
            name: jointName,
            electricalName,
            nodeId,
            movingNode: movingNode as BABYLON.TransformNode,
            fixedNode: fixedNode as BABYLON.TransformNode | undefined,
            type,
            side,
            uniqueId: movingNode.uniqueId
          });

          jointCounter++;
        }
      }
    }

    return joints;
  }

  /**
   * Find MOVING nodes under a container (recursively)
   */
  private findMovingNodes(containerNode: BABYLON.Node): BABYLON.Node[] {
    const movingNodes: BABYLON.Node[] = [];
    const stack: BABYLON.Node[] = [containerNode];

    while (stack.length > 0) {
      const node = stack.pop()!;

      // Check if this node name contains "MOVING"
      if (/MOVING/i.test(node.name)) {
        movingNodes.push(node);
        // Don't traverse deeper from MOVING nodes
        continue;
      }

      // Add children to stack
      const children = node.getChildren();
      stack.push(...children);
    }

    return movingNodes;
  }

  /**
   * Find FIXED node under a container (if exists)
   */
  private findFixedNode(containerNode: BABYLON.Node): BABYLON.Node | null {
    const stack: BABYLON.Node[] = [containerNode];

    while (stack.length > 0) {
      const node = stack.pop()!;

      // Check if this node name contains "FIXED"
      if (/FIXED/i.test(node.name)) {
        return node;
      }

      // Add children to stack
      const children = node.getChildren();
      stack.push(...children);
    }

    return null;
  }
}
