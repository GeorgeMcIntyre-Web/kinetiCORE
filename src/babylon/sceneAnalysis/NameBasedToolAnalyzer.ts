import * as BABYLON from '@babylonjs/core';
import { getWorldTransform } from '../utils/WorldSpace';
import type { ToolUnit, ToolGraph, ToolUnitType } from './ToolGraphAnalyzer';

/**
 * Name-Based Tool Analyzer for Automotive GLB Files
 *
 * Understands the standard automotive tooling GLB structure:
 * ```
 * UNIT_XXX/
 *   ├── RH/ (or LH/)
 *   │   ├── FIXED (base that gets bolted down)
 *   │   └── MOVING (or MOVING_1, MOVING_2 - actuating parts)
 *   └── WIRE/
 *       └── OPENING_ANGLE
 * ```
 *
 * This is the proven structure from WebGLKinematicsClaudeCode.
 */

function uuid(): string {
  return 'tool_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
}

function nodeId(node: BABYLON.Node): string {
  // Prefer uniqueId (numerical, consistent) over name (can have duplicates) over id (optional string)
  if (node.uniqueId !== undefined) {
    return String(node.uniqueId);
  }
  if (node.id) {
    return String(node.id);
  }
  return node.name || 'unknown';
}

/**
 * Get the GLB "Native name" from metadata, or fall back to node.name
 */
function getNativeName(node: BABYLON.Node): string {
  // Check GLB metadata for native name (common in automotive GLB files)
  const metadata = (node as any).metadata;
  if (metadata?.gltf?.extras?.['Native name']) {
    return metadata.gltf.extras['Native name'].trim();
  }
  return node.name || '';
}

/**
 * Collect all descendant node IDs using getChildMeshes() and getChildren()
 */
function collectDescendantIds(root: BABYLON.Node): string[] {
  const ids: string[] = [];
  const visited = new Set<string>();

  // Add root node ID
  const rootIdStr = nodeId(root);
  ids.push(rootIdStr);
  visited.add(rootIdStr);

  // Use getChildMeshes() to collect ALL descendant meshes
  if ((root as any).getChildMeshes) {
    const meshes = (root as any).getChildMeshes() as BABYLON.AbstractMesh[];
    for (const mesh of meshes) {
      const meshIdStr = nodeId(mesh);
      if (!visited.has(meshIdStr)) {
        ids.push(meshIdStr);
        visited.add(meshIdStr);
      }
    }
  }

  // Also traverse TransformNode children using getChildren()
  const stack: BABYLON.Node[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    const nIdStr = nodeId(n);

    if (!visited.has(nIdStr)) {
      ids.push(nIdStr);
      visited.add(nIdStr);
    }

    const children = (n as any).getChildren ? (n as any).getChildren() as BABYLON.Node[] : [];
    for (const c of children) {
      if (!visited.has(nodeId(c))) {
        stack.push(c);
      }
    }
  }

  return ids;
}

export interface NameBasedAnalyzeOptions {
  /**
   * Whether to use verbose logging
   */
  verbose?: boolean;

  /**
   * Search depth limit (prevent infinite loops)
   */
  maxDepth?: number;
}

const DEFAULT_OPTIONS: Required<NameBasedAnalyzeOptions> = {
  verbose: true,
  maxDepth: 20,
};

/**
 * Name-Based Tool Analyzer
 *
 * Specifically designed for automotive GLB files with UNIT_XXX/RH/LH/FIXED/MOVING structure.
 *
 * @example
 * ```typescript
 * const analyzer = new NameBasedToolAnalyzer();
 * const graph = analyzer.analyze(scene, rootNode);
 *
 * // graph.units will contain:
 * // - FIXED units (isFixed: true) - the base parts bolted to infrastructure
 * // - MOVING units (isFixed: false) - the actuating parts (joints)
 * ```
 */
export class NameBasedToolAnalyzer {
  /**
   * Analyze a GLB scene to find UNIT_XXX/RH or LH/FIXED and MOVING nodes.
   *
   * @param scene - Babylon scene
   * @param rootNode - Root node to start search from (typically the GLB file root like "9X_110_GEO")
   * @param options - Analysis options
   * @returns ToolGraph with identified fixed and moving units
   */
  analyze(
    _scene: BABYLON.Scene,
    rootNode: BABYLON.Node,
    options: NameBasedAnalyzeOptions = {}
  ): ToolGraph {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const units: ToolUnit[] = [];
    const anchors: ToolGraph['anchors'] = {};

    if (opts.verbose) {
      console.log(`[NameBasedToolAnalyzer] Starting analysis from root: ${rootNode.name || rootNode.id}`);
    }

    // Step 1: Find all UNIT_XXX nodes
    const unitNodes = this.findUnitNodes(rootNode, opts);

    if (opts.verbose) {
      console.log(`[NameBasedToolAnalyzer] Found ${unitNodes.length} UNIT_XXX nodes`);
    }

    // Step 2: For each UNIT, find RH/LH sides
    for (const unitNode of unitNodes) {
      const unitName = getNativeName(unitNode);

      if (opts.verbose) {
        console.log(`[NameBasedToolAnalyzer] Analyzing unit: ${unitName}`);
      }

      const sides = this.findSideNodes(unitNode, opts);

      if (sides.length === 0) {
        if (opts.verbose) {
          console.warn(`[NameBasedToolAnalyzer] Unit ${unitName} has no RH/LH sides, skipping`);
        }
        continue;
      }

      // Step 3: For each side (RH/LH), find FIXED and MOVING nodes
      for (const sideNode of sides) {
        const sideName = getNativeName(sideNode) as 'RH' | 'LH';
        const { fixed, moving: movingUnderSide } = this.findFixedAndMovingNodes(sideNode, opts);

        // Also check for MOVING nodes under WIRE/OPEN_XX (alternate pattern)
        const movingUnderWire = this.findMovingNodesUnderWire(unitNode, sideName, opts);

        // Combine MOVING nodes from both patterns and deduplicate by uniqueId
        const allMovingNodes = [...movingUnderSide, ...movingUnderWire];
        const uniqueMovingNodes = new Map<number, BABYLON.Node>();
        for (const node of allMovingNodes) {
          uniqueMovingNodes.set(node.uniqueId, node);
        }
        const moving = Array.from(uniqueMovingNodes.values());

        if (opts.verbose) {
          console.log(`[NameBasedToolAnalyzer] ${unitName}/${sideName}: ${fixed.length} FIXED, ${moving.length} MOVING (${movingUnderSide.length} under side, ${movingUnderWire.length} under WIRE)`);
        }

        // Create ToolUnits for FIXED nodes
        for (const fixedNode of fixed) {
          const id = uuid();
          const nodeIds = collectDescendantIds(fixedNode);
          const wt = getWorldTransform(fixedNode);

          units.push({
            id,
            name: `${unitName}/${sideName}/FIXED`,
            root: nodeId(fixedNode),
            babylonUniqueId: fixedNode.uniqueId,
            type: 'fixture' as ToolUnitType,
            isFixed: true,
            nodes: nodeIds,
          });

          anchors[id] = { position: wt.position, rotation: wt.rotation };

          if (opts.verbose) {
            console.log(`[NameBasedToolAnalyzer] Created FIXED unit: ${unitName}/${sideName}/FIXED (${nodeIds.length} nodes)`);
          }
        }

        // Create ToolUnits for MOVING nodes
        for (const movingNode of moving) {
          const id = uuid();
          const nodeIds = collectDescendantIds(movingNode);
          const wt = getWorldTransform(movingNode);
          const movingName = getNativeName(movingNode);

          // Determine type based on unit name patterns
          let type: ToolUnitType = 'unknown';
          if (unitName.includes('CLAMP')) type = 'clamp';
          else if (unitName.includes('PIN')) type = 'pin';
          else if (unitName.includes('DUMP')) type = 'dump';
          else if (unitName.includes('SLIDE')) type = 'slide';
          else type = 'gripper'; // Default for MOVING parts

          units.push({
            id,
            name: `${unitName}/${sideName}/${movingName}`,
            root: nodeId(movingNode),
            babylonUniqueId: movingNode.uniqueId,
            type,
            isFixed: false,
            nodes: nodeIds,
          });

          anchors[id] = { position: wt.position, rotation: wt.rotation };

          if (opts.verbose) {
            console.log(`[NameBasedToolAnalyzer] Created MOVING unit: ${unitName}/${sideName}/${movingName} (${nodeIds.length} nodes)`);
          }
        }
      }
    }

    if (opts.verbose) {
      const fixedCount = units.filter(u => u.isFixed).length;
      const movingCount = units.filter(u => !u.isFixed).length;
      console.log(`[NameBasedToolAnalyzer] Analysis complete: ${units.length} total units (${fixedCount} fixed, ${movingCount} moving)`);
    }

    return { units, anchors };
  }

  /**
   * Find all UNIT_XXX nodes under the root
   */
  private findUnitNodes(root: BABYLON.Node, opts: Required<NameBasedAnalyzeOptions>): BABYLON.Node[] {
    const unitNodes: BABYLON.Node[] = [];
    const visited = new Set<BABYLON.Node>();
    const allNodesScanned: string[] = [];

    const traverse = (node: BABYLON.Node, depth: number) => {
      if (depth > opts.maxDepth || visited.has(node)) return;
      visited.add(node);

      const name = getNativeName(node);
      const nodeName = node.name || 'unnamed';
      const nativeName = name || nodeName;

      allNodesScanned.push(`${' '.repeat(depth * 2)}${nativeName} (native: ${name}, node: ${nodeName})`);

      // Match UNIT_XXX pattern (must be UNIT_ followed by digits, nothing else)
      // This excludes: CARRY_OVER_UNITS, 9X_BASE_FAB, etc.
      if (name.match(/^UNIT_\d+$/i)) {
        unitNodes.push(node);
        if (opts.verbose) {
          console.log(`[NameBasedToolAnalyzer] ✓ Found UNIT node: ${name}`);
        }
      }

      // Continue searching children
      const children = (node as any).getChildren ? (node as any).getChildren() as BABYLON.Node[] : [];
      for (const child of children) {
        traverse(child, depth + 1);
      }
    };

    traverse(root, 0);

    if (opts.verbose) {
      console.log('[NameBasedToolAnalyzer] All nodes scanned:');
      allNodesScanned.forEach(line => console.log(line));
      console.log(`[NameBasedToolAnalyzer] Total nodes scanned: ${allNodesScanned.length}`);
      console.log(`[NameBasedToolAnalyzer] UNIT nodes found: ${unitNodes.length}`);
    }

    return unitNodes;
  }

  /**
   * Find RH and LH side nodes under a UNIT node
   */
  private findSideNodes(unitNode: BABYLON.Node, opts: Required<NameBasedAnalyzeOptions>): BABYLON.Node[] {
    const sideNodes: BABYLON.Node[] = [];
    const children = (unitNode as any).getChildren ? (unitNode as any).getChildren() as BABYLON.Node[] : [];

    for (const child of children) {
      const name = getNativeName(child);

      // Match RH or LH
      if (name === 'RH' || name === 'LH') {
        sideNodes.push(child);
        if (opts.verbose) {
          console.log(`[NameBasedToolAnalyzer] Found side node: ${name}`);
        }
      }
    }

    return sideNodes;
  }

  /**
   * Find FIXED and MOVING nodes under a side (RH/LH) node
   *
   * Handles two patterns:
   * Pattern 1: UNIT/RH/FIXED and UNIT/RH/MOVING
   * Pattern 2: UNIT/RH/FIXED and UNIT/WIRE/OPEN_RH/MOVING
   */
  private findFixedAndMovingNodes(
    sideNode: BABYLON.Node,
    opts: Required<NameBasedAnalyzeOptions>
  ): { fixed: BABYLON.Node[]; moving: BABYLON.Node[] } {
    const fixed: BABYLON.Node[] = [];
    const moving: BABYLON.Node[] = [];

    const children = (sideNode as any).getChildren ? (sideNode as any).getChildren() as BABYLON.Node[] : [];

    for (const child of children) {
      const name = getNativeName(child);

      if (name === 'FIXED') {
        fixed.push(child);
        if (opts.verbose) {
          console.log(`[NameBasedToolAnalyzer] Found FIXED node: ${name}`);
        }
      } else if (name === 'MOVING' || name.startsWith('MOVING_')) {
        moving.push(child);
        if (opts.verbose) {
          console.log(`[NameBasedToolAnalyzer] Found MOVING node: ${name}`);
        }
      }
    }

    return { fixed, moving };
  }

  /**
   * Find MOVING nodes under WIRE/OPEN_XX nodes
   * Some GLB files put MOVING nodes under WIRE/OPEN_RH or WIRE/OPEN_LH
   */
  private findMovingNodesUnderWire(
    unitNode: BABYLON.Node,
    side: 'RH' | 'LH',
    opts: Required<NameBasedAnalyzeOptions>
  ): BABYLON.Node[] {
    const moving: BABYLON.Node[] = [];
    const children = (unitNode as any).getChildren ? (unitNode as any).getChildren() as BABYLON.Node[] : [];

    // Look for WIRE node
    for (const child of children) {
      const name = getNativeName(child);
      if (name === 'WIRE') {
        // Look for OPEN_RH or OPEN_LH under WIRE
        const wireChildren = (child as any).getChildren ? (child as any).getChildren() as BABYLON.Node[] : [];
        for (const wireChild of wireChildren) {
          const wireName = getNativeName(wireChild);
          if (wireName === `OPEN_${side}`) {
            // Look for MOVING under OPEN_XX
            const openChildren = (wireChild as any).getChildren ? (wireChild as any).getChildren() as BABYLON.Node[] : [];
            for (const openChild of openChildren) {
              const openName = getNativeName(openChild);
              if (openName === 'MOVING' || openName.startsWith('MOVING_')) {
                moving.push(openChild);
                if (opts.verbose) {
                  console.log(`[NameBasedToolAnalyzer] Found MOVING node under WIRE/OPEN_${side}: ${openName}`);
                }
              }
            }
          }
        }
      }
    }

    return moving;
  }
}
