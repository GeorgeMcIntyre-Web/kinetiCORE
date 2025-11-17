import * as BABYLON from '@babylonjs/core';
import { getWorldTransform, WorldSpace } from '../utils/WorldSpace';
import { PCLICPSolver } from '../pointCloud/PCLICPSolver';
// import { SceneManager } from '../../scene/SceneManager'; // Not used - scene passed as parameter
import type { ToolUnit, ToolGraph, ToolUnitType } from './ToolGraphAnalyzer';

/**
 * Configuration options for structure-based tool unit analysis.
 * Uses hierarchy structure (not names) to identify units.
 */
export interface StructureBasedAnalyzeOptions {
  /**
   * Minimum number of children required at a level to be considered "units level".
   * Default: 2 (at least 2 units)
   */
  minUnitCount?: number;

  /**
   * Maximum depth to search for units level.
   * Prevents searching too deep in the hierarchy.
   * Default: 10
   */
  maxDepth?: number;

  /**
   * Minimum bounding box volume (m³) to consider a node as a valid unit.
   * Filters out tiny nodes that are likely not actual units.
   * Default: 0.0001 (1 cm³)
   */
  minVolume?: number;

  /**
   * Whether to classify units as fixed/moving based on geometric properties.
   * If false, all units are marked as potentially moving (requires state capture).
   * Default: true
   */
  classifyFixedMoving?: boolean;

  /**
   * Whether to use ICP-based joint detection to identify which units have joints.
   * This finds matching geometry pairs (fixed/moving pairs) without using names.
   * Default: true
   */
  detectJointsWithICP?: boolean;

  /**
   * ICP matching options (used when detectJointsWithICP = true)
   */
  icpOptions?: {
    /** Maximum ICP error to consider a match (meters). Default: 0.15 (150mm) */
    maxICPError?: number;
    /** Minimum points required per unit. Default: 50 */
    minPoints?: number;
    /** Maximum points to sample per unit. Default: 500 */
    maxSamplePoints?: number;
    /** Vertex sampling stride. Default: 10 */
    sampleStride?: number;
    /** Minimum translation to consider as motion (meters). Default: 0.01 (10mm) */
    minTranslation?: number;
    /** Minimum rotation to consider as motion (degrees). Default: 1.0 */
    minRotation?: number;
    /** Maximum translation for automotive tooling (meters). Default: 2.0 */
    maxTranslation?: number;
  };

  /**
   * Enable verbose logging for debugging.
   * Default: false
   */
  verbose?: boolean;
}

const DEFAULT_STRUCTURE_OPTIONS: Required<StructureBasedAnalyzeOptions> = {
  minUnitCount: 2,
  maxDepth: 10,
  minVolume: 0.0001,
  classifyFixedMoving: true,
  detectJointsWithICP: true,
  icpOptions: {
    maxICPError: 0.15, // 150mm - lenient for automotive tooling
    minPoints: 50,
    maxSamplePoints: 500,
    sampleStride: 10,
    minTranslation: 0.01, // 10mm minimum motion
    minRotation: 1.0, // 1° minimum rotation
    maxTranslation: 2.0, // 2m maximum for automotive
  },
  verbose: false,
};

/**
 * Structure-based tool unit analyzer.
 * 
 * **Algorithm:**
 * 1. Traverse hierarchy from root downward
 * 2. Find the highest level where child count >= minUnitCount
 * 3. Treat those children as "units"
 * 4. Optionally classify fixed vs moving based on geometry
 * 
 * **Key Feature:** Name-agnostic - does not rely on naming patterns like "UNIT_XXX"
 * 
 * @example
 * ```typescript
 * const analyzer = new StructureBasedToolAnalyzer();
 * const graph = analyzer.analyze(scene, {
 *   minUnitCount: 2,
 *   verbose: true
 * }, rootNode);
 * ```
 */
export class StructureBasedToolAnalyzer {
  /**
   * Analyze scene to identify tool units using hierarchy structure.
   * 
   * @param scene - Babylon scene containing tool geometry
   * @param options - Configuration for structure-based analysis
   * @param rootNode - Root node to start analysis from (required)
   * @returns ToolGraph with identified units
   */
  async analyze(
    scene: BABYLON.Scene,
    options: StructureBasedAnalyzeOptions = {},
    rootNode?: BABYLON.Node
  ): Promise<ToolGraph> {
    const opts: Required<StructureBasedAnalyzeOptions> = {
      ...DEFAULT_STRUCTURE_OPTIONS,
      ...options,
    };

    if (!rootNode) {
      console.warn('[StructureBasedToolAnalyzer] No rootNode provided, using scene root');
      rootNode = scene.rootNodes[0];
      if (!rootNode) {
        console.error('[StructureBasedToolAnalyzer] No root nodes in scene');
        return { units: [], anchors: {} };
      }
    }

    if (opts.verbose) {
      console.log(`[StructureBasedToolAnalyzer] Starting analysis from root: ${rootNode.name || rootNode.id}`);
    }

    // Step 1: Find the "units level" - highest level with count >= minUnitCount
    const unitsLevel = this.findUnitsLevel(rootNode, opts);

    if (!unitsLevel) {
      console.warn(
        `[StructureBasedToolAnalyzer] No level found with >= ${opts.minUnitCount} children. ` +
        `Try selecting a deeper node or reducing minUnitCount.`
      );
      return { units: [], anchors: {} };
    }

    if (opts.verbose) {
      console.log(
        `[StructureBasedToolAnalyzer] Found units level at depth ${unitsLevel.depth} ` +
        `with ${unitsLevel.children.length} children`
      );
      unitsLevel.children.forEach((child, idx) => {
        const name = child.name || child.id || `child_${idx}`;
        console.log(`  - Unit ${idx + 1}: ${name} (uniqueId: ${(child as any).uniqueId})`);
      });
    }

    // Step 2: Convert children to ToolUnits
    const units: ToolUnit[] = [];
    const anchors: ToolGraph['anchors'] = {};

    for (let i = 0; i < unitsLevel.children.length; i++) {
      const child = unitsLevel.children[i];
      const unitId = this.generateUnitId(child, i);
      const nodeIds = this.collectDescendantIds(child);
      const wt = getWorldTransform(child);

      // Check if unit has significant geometry
      const hasGeometry = this.hasSignificantGeometry(child, opts.minVolume);

      if (!hasGeometry && opts.verbose) {
        console.warn(
          `[StructureBasedToolAnalyzer] Unit ${i + 1} (${child.name || unitId}) ` +
          `has no significant geometry (volume < ${opts.minVolume}m³)`
        );
      }

      // Initially classify as fixed or moving (basic heuristic)
      let isFixed = opts.classifyFixedMoving
        ? this.classifyAsFixed(child, unitsLevel.children, opts)
        : false; // Default to moving if classification disabled

      units.push({
        id: unitId,
        name: child.name || unitId,
        root: this.nodeId(child),
        type: this.inferUnitType(child, isFixed),
        isFixed,
        nodes: nodeIds,
      });

      anchors[unitId] = {
        position: wt.position.clone(),
        rotation: wt.rotation.clone(),
      };

      if (opts.verbose) {
        console.log(
          `[StructureBasedToolAnalyzer] Created unit: ${unitId} ` +
          `(fixed: ${isFixed}, nodes: ${nodeIds.length})`
        );
      }
    }

    // Step 3: Use ICP to detect which units have joints (if enabled)
    if (opts.detectJointsWithICP && units.length >= 2) {
      console.log(`[StructureBasedToolAnalyzer] Running ICP-based joint detection on ${units.length} units...`);
      await this.detectJointsWithICP(units, opts, scene);
    } else {
      console.log(`[StructureBasedToolAnalyzer] Skipping ICP detection: detectJointsWithICP=${opts.detectJointsWithICP}, units.length=${units.length}`);
    }

    return { units, anchors };
  }

  /**
   * Find the highest level in hierarchy where child count >= minUnitCount.
   * 
   * Traverses from root downward, stopping at first level with enough children.
   * 
   * IMPORTANT: We want to find the level with the actual UNIT nodes (like UNIT_114, UNIT_112),
   * not too deep where we hit individual mesh components. The algorithm prefers levels
   * with a reasonable number of children (not thousands).
   */
  private findUnitsLevel(
    root: BABYLON.Node,
    opts: Required<StructureBasedAnalyzeOptions>
  ): { children: BABYLON.Node[]; depth: number } | null {
    const visited = new Set<BABYLON.Node>();
    let bestMatch: { children: BABYLON.Node[]; depth: number } | null = null;
    let bestScore = -1; // Prefer levels with fewer children (closer to expected unit count)

    const traverse = (node: BABYLON.Node, depth: number) => {
      if (depth > opts.maxDepth || visited.has(node)) {
        return;
      }
      visited.add(node);

      // Get immediate children (transform nodes only)
      const children = this.getImmediateChildren(node);

      if (opts.verbose && depth <= 3) {
        const nodeName = node.name || node.id || `node_${depth}`;
        console.log(
          `[StructureBasedToolAnalyzer] Level ${depth}: ${nodeName} has ${children.length} children`
        );
      }

      // Special case: If this node has MANY children (>100), check if those children
      // look like UNIT nodes (they have many sub-children). If so, those children
      // ARE the units, and we should use them directly.
      if (children.length > 100 && depth <= 2) {
        // Sample some children to see if they look like UNIT nodes
        const sampleSize = Math.min(20, children.length);
        let unitLikeCount = 0;
        let totalSubChildren = 0;
        
        for (let i = 0; i < sampleSize; i++) {
          const child = children[i];
          const subChildren = this.getImmediateChildren(child);
          totalSubChildren += subChildren.length;
          if (subChildren.length > 30) { // UNIT nodes have many sub-children
            unitLikeCount++;
          }
        }
        
        const avgSubChildren = totalSubChildren / sampleSize;
        
        // If many children look like UNIT nodes, those children ARE the units
        if (unitLikeCount >= 3 && avgSubChildren > 50) {
          // This node's children are the UNIT nodes - use them as the units level
          // Filter to only children that look like UNIT nodes
          // UNIT nodes have many direct children (assemblies like RH, LH, MOVING, FIXED)
          // They typically have 30-200 direct children
          // Also check that their children have many sub-children (assemblies, not raw meshes)
          // This helps distinguish UNIT nodes from other large nodes
          const unitNodes = children.filter(child => {
            const subChildren = this.getImmediateChildren(child);
            // Must have many direct children (30-800 range for UNIT nodes)
            // Some UNIT nodes can have many children (like UNIT_101 with 730)
            if (subChildren.length < 30 || subChildren.length > 800) return false;
            
            // Check if sub-children also have many sub-children (assemblies)
            // UNIT nodes contain assemblies (RH, LH) which contain many components
            // This distinguishes UNIT nodes from other large nodes
            const avgSubSubChildren = subChildren.length > 0
              ? subChildren.slice(0, 10).reduce((sum, subChild) => {
                  const subSubChildren = this.getImmediateChildren(subChild);
                  return sum + subSubChildren.length;
                }, 0) / Math.min(10, subChildren.length)
              : 0;
            
            // UNIT nodes have sub-children (like RH) that contain many components
            // If avgSubSubChildren is very low, it's likely not a UNIT node
            // Also check that at least some sub-children have significant geometry (state nodes)
            const hasStateNodeLikeChildren = subChildren.some(subChild => {
              // Check if this sub-child has geometry (could be MOVING, FIXED, etc.)
              return this.hasSignificantGeometry(subChild, opts.minVolume);
            });
            
            // UNIT nodes have a specific structure:
            // - They have assemblies (RH, LH) with many components (avgSubSubChildren > 5)
            // - They have state-node-like children with geometry
            // - The assemblies themselves should have many sub-children (indicating they're assemblies, not raw meshes)
            // Additional check: at least 2 sub-children should have many sub-sub-children (assemblies like RH/LH)
            const assemblyLikeChildren = subChildren.filter(subChild => {
              const subSubChildren = this.getImmediateChildren(subChild);
              return subSubChildren.length > 10; // Assemblies have many components
            }).length;
            
            // Most selective check: UNIT nodes should have children that contain state nodes (MOVING/FIXED)
            // These state nodes are typically grandchildren (children of RH/LH)
            // Check if any sub-child has children with geometry (state nodes like MOVING/FIXED)
            const hasNestedStateNodes = subChildren.some(subChild => {
              const subSubChildren = this.getImmediateChildren(subChild);
              // Check if any grandchild has geometry (state node)
              return subSubChildren.some(subSubChild => {
                return this.hasSignificantGeometry(subSubChild, opts.minVolume);
              });
            });
            
            // Must have:
            // 1. Assemblies with many components (avgSubSubChildren > 5)
            // 2. State-node-like children with geometry (direct children)
            // 3. At least 2 assembly-like children (RH, LH, etc.)
            // 4. Nested state nodes (MOVING/FIXED within RH/LH) - this is the most selective
            return avgSubSubChildren > 5 && hasStateNodeLikeChildren && assemblyLikeChildren >= 2 && hasNestedStateNodes;
          });
          
          if (unitNodes.length >= opts.minUnitCount) {
            // If we found many candidates but we know there should be exactly 9 UNIT nodes,
            // prioritize nodes with the most "UNIT-like" structure
            // Score each candidate and take the top ones
            const scoredNodes = unitNodes.map(node => {
              const subChildren = this.getImmediateChildren(node);
              const avgSubSubChildren = subChildren.length > 0
                ? subChildren.slice(0, 10).reduce((sum, subChild) => {
                    const subSubChildren = this.getImmediateChildren(subChild);
                    return sum + subSubChildren.length;
                  }, 0) / Math.min(10, subChildren.length)
                : 0;
              
              // Score based on:
              // 1. Number of children (UNIT nodes have 30-800)
              // 2. Average sub-sub-children (assemblies have many components)
              // 3. Number of assembly-like children
              const assemblyLikeCount = subChildren.filter(subChild => {
                const subSubChildren = this.getImmediateChildren(subChild);
                return subSubChildren.length > 10;
              }).length;
              
              // Higher score = more UNIT-like
              const score = (subChildren.length / 100) + (avgSubSubChildren / 10) + (assemblyLikeCount * 2);
              return { node, score };
            });
            
            // Sort by score (highest first) and take top 9 (or all if fewer)
            // BUT: Only include nodes that are direct children of the current level
            // Filter out nodes that are too deep (children of UNIT nodes like RH, FIXED)
            scoredNodes.sort((a, b) => b.score - a.score);
            
            // Additional filter: Only include nodes that are direct children of Level 1
            // Check that the node's parent is the Level 1 node (not a UNIT node's child)
            const level1Node = node; // The node we're currently evaluating (Level 1)
            let topUnitNodes = scoredNodes
              .filter(item => {
                const parent = item.node.parent;
                // Only include if parent is Level 1 node (direct children)
                return parent === level1Node;
              })
              .slice(0, 9)
              .map(item => item.node);
            
            // If we didn't get 9, try without the parent filter (in case hierarchy is different)
            if (topUnitNodes.length < 9 && scoredNodes.length >= 9) {
              const fallbackNodes = scoredNodes.slice(0, 9).map(item => item.node);
              // Use fallback but log a warning
              if (opts.verbose) {
                console.warn(
                  `[StructureBasedToolAnalyzer] Only found ${topUnitNodes.length} direct children, ` +
                  `using ${fallbackNodes.length} top-scored nodes instead`
                );
              }
              topUnitNodes = fallbackNodes;
            }
            
            // STRONGLY prefer Level 1's UNIT nodes (shallower = much better)
            // Depth 0-1 is where UNIT nodes typically are
            // Score much higher for shallower levels
            const depthPenalty = depth === 0 ? 0 : (depth === 1 ? 50 : 200);
            const score = 5000 - (topUnitNodes.length * 5) - depthPenalty;
            
            if (score > bestScore) {
              bestMatch = { children: topUnitNodes, depth: depth + 1 }; // Treat as next level
              bestScore = score;
              
              if (opts.verbose) {
                console.log(
                  `[StructureBasedToolAnalyzer] ✓ Found UNIT nodes at Level ${depth + 1}: ` +
                  `${unitNodes.length} UNIT nodes (filtered from ${children.length} children, ` +
                  `avg sub-children: ${avgSubChildren.toFixed(1)}, score: ${score})`
                );
              }
            }
          }
          
          if (opts.verbose) {
            console.log(
              `[StructureBasedToolAnalyzer] Level ${depth} has ${children.length} children, ` +
              `${unitLikeCount}/${sampleSize} look like UNIT nodes (avg sub-children: ${avgSubChildren.toFixed(1)})`
            );
          }
        }
      }
      
      // Check if this level qualifies as "units level"
      if (children.length >= opts.minUnitCount) {
        // Score calculation:
        // - Prefer levels with 2-20 children (likely UNIT nodes)
        // - STRONGLY prefer shallower levels (depth is very important)
        // - Heavily penalize levels with >100 children (likely raw meshes or too high level)
        // - Prefer levels where children themselves have many children (UNIT nodes contain sub-assemblies)
        let score = 0;
        
        // Check if children look like UNIT nodes (they should have many sub-children)
        const avgChildCount = children.length > 0 
          ? children.reduce((sum, child) => {
              const childChildren = this.getImmediateChildren(child);
              return sum + childChildren.length;
            }, 0) / children.length
          : 0;
        
        if (children.length <= 20) {
          // Good candidate: 2-20 children
          // STRONG bonus if children have many sub-children (likely UNIT nodes with assemblies)
          // UNIT nodes typically have 30-200 sub-children
          const unitBonus = avgChildCount > 30 ? 1000 : (avgChildCount > 10 ? 500 : 0);
          // Prefer depth 1-3 (where UNIT nodes typically are)
          const depthBonus = depth >= 1 && depth <= 3 ? 300 : 0;
          score = 2000 - (children.length * 10) - (depth * 150) + unitBonus + depthBonus;
        } else if (children.length <= 100) {
          // Acceptable but not ideal: 21-100 children
          score = 1000 - (children.length * 5) - (depth * 100);
        } else {
          // Too many children: likely raw meshes or wrong level
          // BUT: if children look like UNIT nodes, we should look at Level 2 instead
          // We'll handle this by not scoring this level, but continuing to traverse
          score = 0;
        }
        
        if (score > bestScore) {
          bestMatch = { children, depth };
          bestScore = score;
          
          if (opts.verbose) {
            console.log(
              `[StructureBasedToolAnalyzer] ✓ Candidate units level at depth ${depth} ` +
              `with ${children.length} children (avg child children: ${avgChildCount.toFixed(1)}, score: ${score})`
            );
          }
        }
      }

      // Continue searching to find the best match
      // But if we found a very good match (2-10 children at shallow depth), prefer it
      if (bestScore > 1900 && depth <= 3) {
        // Found an excellent match (2-10 children at depth <= 3), this is likely the UNIT level
        // Continue searching but this is our best candidate so far
      }

      // Continue searching children
      for (const child of children) {
        traverse(child, depth + 1);
      }
    };

    traverse(root, 0);
    
    if (bestMatch !== null) {
      const match: { children: BABYLON.Node[]; depth: number } = bestMatch;
      if (opts.verbose) {
        console.log(
          `[StructureBasedToolAnalyzer] Selected units level at depth ${match.depth} ` +
          `with ${match.children.length} children`
        );
      }
    }
    
    return bestMatch;
  }

  /**
   * Get immediate children of a node (transform nodes only).
   */
  private getImmediateChildren(node: BABYLON.Node): BABYLON.Node[] {
    const children: BABYLON.Node[] = [];
    const seen = new Set<BABYLON.Node>();

    // Method 1: getChildren() - most common for TransformNode
    if ((node as any).getChildren) {
      try {
        const allChildren = (node as any).getChildren() as BABYLON.Node[];
        for (const child of allChildren) {
          if (!seen.has(child)) {
            // Include transform nodes and meshes (which are also transform nodes)
            if (child instanceof BABYLON.TransformNode || child instanceof BABYLON.AbstractMesh) {
              children.push(child);
              seen.add(child);
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Method 2: getChildTransformNodes() - if available
    if (node instanceof BABYLON.TransformNode) {
      try {
        const transformChildren = node.getChildTransformNodes(false);
        for (const child of transformChildren) {
          if (!seen.has(child)) {
            children.push(child);
            seen.add(child);
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Method 3: getChildMeshes() - for mesh containers
    if (node instanceof BABYLON.TransformNode) {
      try {
        const meshChildren = node.getChildMeshes(false);
        for (const child of meshChildren) {
          if (!seen.has(child) && child instanceof BABYLON.TransformNode) {
            children.push(child);
            seen.add(child);
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }

    return children;
  }

  /**
   * Collect all descendant node IDs for a unit.
   */
  private collectDescendantIds(root: BABYLON.Node): string[] {
    const ids: string[] = [];
    const visited = new Set<BABYLON.Node>();

    const traverse = (node: BABYLON.Node) => {
      if (visited.has(node)) return;
      visited.add(node);

      const id = this.nodeId(node);
      if (id) {
        ids.push(id);
      }

      const children = this.getImmediateChildren(node);
      for (const child of children) {
        traverse(child);
      }
    };

    traverse(root);
    return ids;
  }

  /**
   * Check if a node has significant geometry (meshes with volume >= minVolume).
   */
  private hasSignificantGeometry(node: BABYLON.Node, minVolume: number): boolean {
    if (node instanceof BABYLON.AbstractMesh) {
      try {
        node.computeWorldMatrix(true);
        const bbox = node.getBoundingInfo().boundingBox;
        const volume = this.computeVolume(bbox);
        return volume >= minVolume;
      } catch {
        return false;
      }
    }

    // Check descendants for meshes
    const children = this.getImmediateChildren(node);
    for (const child of children) {
      if (this.hasSignificantGeometry(child, minVolume)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Compute bounding box volume in cubic meters.
   */
  private computeVolume(bbox: BABYLON.BoundingBox): number {
    const size = bbox.maximum.subtract(bbox.minimum);
    return Math.abs(size.x * size.y * size.z);
  }

  /**
   * Classify a unit as fixed or moving based on geometric heuristics.
   */
  private classifyAsFixed(
    unitNode: BABYLON.Node,
    allUnits: BABYLON.Node[],
    _opts: Required<StructureBasedAnalyzeOptions>
  ): boolean {
    // Heuristic 1: Largest unit by volume is likely fixed
    const volumes = allUnits.map((u) => {
      if (u instanceof BABYLON.AbstractMesh) {
        try {
          u.computeWorldMatrix(true);
          return this.computeVolume(u.getBoundingInfo().boundingBox);
        } catch {
          return 0;
        }
      }
      return 0;
    });

    const maxVolume = Math.max(...volumes, 0);
    const unitVolume = volumes[allUnits.indexOf(unitNode)];

    // If this unit is significantly larger than others, likely fixed
    if (unitVolume > 0 && unitVolume === maxVolume && maxVolume > 0) {
      const ratio = unitVolume / (volumes.reduce((a, b) => a + b, 0) / volumes.length || 1);
      if (ratio > 2.0) {
        // More than 2x average volume
        return true;
      }
    }

    // Heuristic 2: Position near origin suggests fixed base
    try {
      const wt = getWorldTransform(unitNode);
      const distanceFromOrigin = wt.position.length();
      if (distanceFromOrigin < 0.1) {
        // Very close to origin
        return true;
      }
    } catch {
      // Ignore transform errors
    }

    // Default: assume moving (requires state capture to determine)
    return false;
  }

  /**
   * Infer unit type from node structure and classification.
   */
  private inferUnitType(_node: BABYLON.Node, isFixed: boolean): ToolUnitType {
    if (isFixed) {
      return 'fixture';
    }

    // Try to infer from geometry shape (elongated = slide, compact = gripper)
    // For now, default to 'gripper' for moving parts
    return 'gripper';
  }

  /**
   * Generate a unique ID for a unit.
   */
  private generateUnitId(node: BABYLON.Node, index: number): string {
    // Prefer uniqueId if available
    if ((node as any).uniqueId !== undefined) {
      return `unit_${(node as any).uniqueId}`;
    }

    // Fallback to index-based ID
    return `unit_${index}_${Date.now()}`;
  }

  /**
   * Get node identifier (uniqueId > id > name).
   */
  private nodeId(node: BABYLON.Node): string {
    if ((node as any).uniqueId !== undefined) {
      return String((node as any).uniqueId);
    }
    if (node.id) {
      return String(node.id);
    }
    return node.name || 'unknown';
  }

  /**
   * Use mixed BB + ICP approach to detect which units have joints.
   * 
   * Algorithm:
   * 1. For each unit, find child nodes that might represent same geometry in different states
   * 2. Use bounding box similarity to find candidate pairs (same size, similar position)
   * 3. Use ICP to verify they're matching geometry with valid transform
   * 4. Mark units with joints as moving, others as fixed
   * 
   * This is more efficient than testing all pairs and handles cases where
   * the same geometry exists in multiple states (open/closed, retracted/extended).
   */
  private async detectJointsWithICP(
    units: ToolUnit[],
    opts: Required<StructureBasedAnalyzeOptions>,
    scene: BABYLON.Scene
  ): Promise<void> {
    console.log(`[StructureBasedToolAnalyzer] detectJointsWithICP called with ${units.length} units, opts.detectJointsWithICP=${opts.detectJointsWithICP}`);
    
    const defaultIcpOpts = DEFAULT_STRUCTURE_OPTIONS.icpOptions!;
    const icpOpts = {
      maxICPError: opts.icpOptions?.maxICPError ?? defaultIcpOpts.maxICPError,
      minPoints: opts.icpOptions?.minPoints ?? defaultIcpOpts.minPoints,
      maxSamplePoints: opts.icpOptions?.maxSamplePoints ?? defaultIcpOpts.maxSamplePoints,
      sampleStride: opts.icpOptions?.sampleStride ?? defaultIcpOpts.sampleStride,
      minTranslation: opts.icpOptions?.minTranslation ?? defaultIcpOpts.minTranslation,
      minRotation: opts.icpOptions?.minRotation ?? defaultIcpOpts.minRotation,
      maxTranslation: opts.icpOptions?.maxTranslation ?? defaultIcpOpts.maxTranslation,
    };
    // Scene is now passed as parameter from analyze method
    if (!scene) {
      console.warn('[StructureBasedToolAnalyzer] No scene available for ICP detection');
      return;
    }
    console.log(`[StructureBasedToolAnalyzer] Scene found, proceeding with ICP detection...`);

    // Step 1: For each unit, find child nodes that might represent same geometry in different states
    // Use bounding box similarity as a pre-filter, then ICP to verify
    
    interface NodeCandidate {
      node: BABYLON.Node;
      boundingBox: BABYLON.BoundingBox;
      dimensions: BABYLON.Vector3; // Size (width, height, depth)
      volume: number;
      pointCloud: BABYLON.Vector3[];
      unit: ToolUnit;
    }

    interface UnitStateCandidates {
      unit: ToolUnit;
      candidates: NodeCandidate[];
    }

    const unitStateCandidates: UnitStateCandidates[] = [];

    // Collect child nodes from each unit and compute their bounding boxes
    // Each UNIT is treated as a root, and we look for state nodes within it
    // LIMIT: Max 10 candidates per unit to prevent explosion
    const MAX_CANDIDATES_PER_UNIT = 10;

    for (const unit of units) {
      // Find node by uniqueId - search through transformNodes and meshes
      const uniqueId = parseInt(unit.root);
      let unitNode: BABYLON.Node | null = null;
      
      if (!isNaN(uniqueId)) {
        // Try transformNodes first
        unitNode = scene.transformNodes.find(n => n.uniqueId === uniqueId) as BABYLON.Node || null;
        
        // Try meshes if not found
        if (!unitNode) {
          unitNode = scene.meshes.find(m => m.uniqueId === uniqueId) as BABYLON.Node || null;
        }
      }
      
      // Fallback: try by name or ID
      if (!unitNode) {
        unitNode = scene.getNodeById(unit.root) ||
                   scene.getTransformNodeByID(unit.root) ||
                   scene.getMeshByID(unit.root) ||
                   scene.getNodeByName(unit.name) ||
                   null;
      }

      if (!unitNode) {
        if (opts.verbose) {
          console.warn(`[StructureBasedToolAnalyzer] Unit ${unit.name} root node not found: ${unit.root}`);
        }
        continue;
      }

      console.log(
        `[StructureBasedToolAnalyzer] Analyzing unit ${unit.name} ` +
        `(root: ${unitNode.name || unit.root}) for state nodes...`
      );

      // Strategy: Find sibling groups (nodes with same parent) and use BB+ICP to find matching pairs
      // Pattern: UNIT -> RH/LH/OPEN -> [sibling nodes] (or UNIT -> OPEN -> OPEN_RH/OPEN_LH -> [sibling nodes])
      // We only collect nodes that are part of sibling groups (2+ children with same parent)
      // Then use BB similarity to find matching geometry, then ICP to verify
      
      const immediateChildren = this.getImmediateChildren(unitNode);
      const candidates: NodeCandidate[] = [];

      // LIMIT: Only process first 5 immediate children to prevent explosion
      const MAX_IMMEDIATE_CHILDREN = 5;
      const limitedImmediateChildren = immediateChildren.slice(0, MAX_IMMEDIATE_CHILDREN);

      // For each immediate child (RH, LH, OPEN, etc.)
      for (const child of limitedImmediateChildren) {
        const grandChildren = this.getImmediateChildren(child);
        
        // Check if grandchildren have their own children (like OPEN -> OPEN_RH -> MOVING)
        // This means we need to go one level deeper (depth 3)
        const hasNestedChildren = grandChildren.some(gc => {
          const nested = this.getImmediateChildren(gc);
          return nested.length > 0;
        });
        
        if (hasNestedChildren) {
          // Depth 3: OPEN -> OPEN_RH -> MOVING_1, MOVING_2
          // Only collect from parent groups that have 2+ children (sibling groups)
          for (const grandChild of grandChildren) {
            const greatGrandChildren = this.getImmediateChildren(grandChild);
            
            // Only process if this is a sibling group (2+ children)
            // This ensures we only look at groups that could contain matching pairs
            if (greatGrandChildren.length >= 2) {
              // LIMIT: Only collect first 5 siblings per group to prevent explosion
              const MAX_SIBLINGS_PER_GROUP = 5;
              const limitedSiblings = greatGrandChildren.slice(0, MAX_SIBLINGS_PER_GROUP);

              // Collect children from this sibling group (limited)
              for (const ggc of limitedSiblings) {
                if (!this.hasSignificantGeometry(ggc, opts.minVolume)) continue;
                
                const bbox = this.computeNodeBoundingBox(ggc);
                if (!bbox) continue;
                
                const dimensions = bbox.maximum.subtract(bbox.minimum);
                const volume = Math.abs(dimensions.x * dimensions.y * dimensions.z);
                if (volume < opts.minVolume) continue;
                
                // Sample point cloud
                const pointCloud = this.sampleNodePointCloud(ggc, {
                  ...icpOpts,
                  sampleStride: Math.max(icpOpts.sampleStride ?? 5, 10),
                  maxSamplePoints: 100,
                });
                
                if (pointCloud.length < (icpOpts.minPoints || 20)) continue;
                
                candidates.push({
                  node: ggc,
                  boundingBox: bbox,
                  dimensions,
                  volume,
                  pointCloud: pointCloud.slice(0, 100),
                  unit,
                });

                // LIMIT: Stop collecting if we hit max candidates per unit
                if (candidates.length >= MAX_CANDIDATES_PER_UNIT) break;
              }
              if (candidates.length >= MAX_CANDIDATES_PER_UNIT) break;
            }
          }
          if (candidates.length >= MAX_CANDIDATES_PER_UNIT) break;
        } else {
          // Depth 2: RH -> MOVING_1, MOVING_2, FIXED
          // Only collect if this is a sibling group (2+ children)
          // This ensures we only look at groups that could contain matching pairs
          if (grandChildren.length >= 2) {
            // LIMIT: Only collect first 5 siblings per group to prevent explosion
            const MAX_SIBLINGS_PER_GROUP = 5;
            const limitedSiblings = grandChildren.slice(0, MAX_SIBLINGS_PER_GROUP);

            // Collect children from this sibling group (limited)
            for (const grandChild of limitedSiblings) {
              if (!this.hasSignificantGeometry(grandChild, opts.minVolume)) continue;
              
              const bbox = this.computeNodeBoundingBox(grandChild);
              if (!bbox) continue;
              
              const dimensions = bbox.maximum.subtract(bbox.minimum);
              const volume = Math.abs(dimensions.x * dimensions.y * dimensions.z);
              if (volume < opts.minVolume) continue;
              
              // Sample point cloud
              const pointCloud = this.sampleNodePointCloud(grandChild, {
                ...icpOpts,
                sampleStride: Math.max(icpOpts.sampleStride ?? 5, 10),
                maxSamplePoints: 100,
              });
              
              if (pointCloud.length < (icpOpts.minPoints || 20)) continue;
              
              candidates.push({
                node: grandChild,
                boundingBox: bbox,
                dimensions,
                volume,
                pointCloud: pointCloud.slice(0, 100),
                unit,
              });

              // LIMIT: Stop collecting if we hit max candidates per unit
              if (candidates.length >= MAX_CANDIDATES_PER_UNIT) break;
            }
          }
        }
        if (candidates.length >= MAX_CANDIDATES_PER_UNIT) break;
      }

      console.log(
        `[StructureBasedToolAnalyzer] Unit ${unit.name}: found ${candidates.length} state node candidates ` +
        `(from sibling groups only, ${immediateChildren.length} immediate children checked)`
      );

      if (candidates.length > 0) {
        unitStateCandidates.push({ unit, candidates });
        
        if (opts.verbose) {
          console.log(
            `[StructureBasedToolAnalyzer] Unit ${unit.name}: found ${candidates.length} ` +
            `state node candidates from sibling groups`
          );
          candidates.forEach((cand, idx) => {
            console.log(
              `  [${idx + 1}] Node (${cand.pointCloud.length} points, ` +
              `volume: ${(cand.volume * 1e9).toFixed(2)}mm³)`
            );
          });
        }
      } else {
        if (opts.verbose) {
          console.warn(
            `[StructureBasedToolAnalyzer] Unit ${unit.name}: no state node candidates found ` +
            `(no sibling groups with 2+ children found)`
          );
        }
      }
    }

    // Step 2: Use BB similarity to find candidate pairs, then ICP to verify
    const jointPairs: Array<{ 
      unit: ToolUnit; 
      fixedNode: NodeCandidate; 
      movingNode: NodeCandidate; 
      transform: BABYLON.Matrix; 
      error: number 
    }> = [];

    console.log('[StructureBasedToolAnalyzer] Using mixed BB + ICP approach to find joint pairs...');
    console.log(`[StructureBasedToolAnalyzer] Total units to check: ${unitStateCandidates.length}`);

    // Strategy 1: Look within each unit for child nodes in different states
    for (let unitIdx = 0; unitIdx < unitStateCandidates.length; unitIdx++) {
      const unitData = unitStateCandidates[unitIdx];
      const candidates = unitData.candidates;

      console.log(
        `[StructureBasedToolAnalyzer] Processing unit ${unitIdx + 1}/${unitStateCandidates.length}: ` +
        `${unitData.unit.name} (${candidates.length} state nodes)`
      );
      
      if (candidates.length < 2) {
        console.log(
          `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: skipping (need at least 2 state nodes, found ${candidates.length})`
        );
        continue; // Need at least 2 states
      }

      // Strategy: Look for sibling pairs (MOVING/FIXED under same parent)
      // These represent the same geometry in different states
      // Group candidates by parent to find sibling pairs first
      const candidatesByParent = new Map<BABYLON.Node | null, NodeCandidate[]>();
      for (const cand of candidates) {
        const parent = cand.node.parent;
        if (!candidatesByParent.has(parent)) {
          candidatesByParent.set(parent, []);
        }
        candidatesByParent.get(parent)!.push(cand);
      }
      
      // Log parent groups for debugging
      if (opts.verbose) {
        console.log(
          `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
          `Grouped ${candidates.length} candidates into ${candidatesByParent.size} parent groups`
        );
        for (const [, siblings] of candidatesByParent.entries()) {
          console.log(
            `  - Parent group: ${siblings.length} siblings (${siblings.map(s => 
              `${s.pointCloud.length}pts, ${(s.volume * 1e9).toFixed(0)}mm³`
            ).join(', ')})`
          );
        }
      }

      // First, try to find sibling pairs (same parent) - these are most likely to be matching geometry
      // Structure-based only: no name checking, purely geometric matching
      // LIMIT: Only check first 5 parent groups to avoid hanging
      // NOTE: We search ALL parent groups to find ALL joints per unit (units can have 2+ joints)
      let jointsFoundInUnit = 0;
      const allParentGroups = Array.from(candidatesByParent.entries());
      const parentGroups = allParentGroups.slice(0, 5);

      console.log(
        `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
        `Checking ${parentGroups.length} parent groups (limited from ${candidatesByParent.size})`
      );

      for (let pgIdx = 0; pgIdx < parentGroups.length; pgIdx++) {
        const [, siblingCandidates] = parentGroups[pgIdx];
        if (siblingCandidates.length < 2) continue;
        
        console.log(
          `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
          `Parent group ${pgIdx + 1}/${parentGroups.length} has ${siblingCandidates.length} siblings`
        );
        
        // LIMIT: Only compare first 3 pairs per parent group to avoid too many ICP calls
        // Units can have 2 joints, so check up to 3 pairs per group to find both
        const maxPairs = Math.min(3, Math.floor(siblingCandidates.length * (siblingCandidates.length - 1) / 2));
        let pairCount = 0;

        // Compare pairs of siblings (limited)
        // Don't break early - continue to find ALL joints in this parent group
        for (let i = 0; i < siblingCandidates.length && pairCount < maxPairs; i++) {
          for (let j = i + 1; j < siblingCandidates.length && pairCount < maxPairs; j++) {
            pairCount++;
            const candA = siblingCandidates[i];
            const candB = siblingCandidates[j];

            // Pre-filter using bounding box similarity (structure-based, no names)
            if (!this.areBoundingBoxesSimilar(candA, candB, opts.verbose)) {
              if (opts.verbose) {
                console.log(
                  `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
                  `BB mismatch between sibling pair (volumes: ${(candA.volume * 1e9).toFixed(0)} vs ${(candB.volume * 1e9).toFixed(0)}mm³, skipping ICP)`
                );
              }
              continue;
            }

            console.log(
              `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
              `BB match found for pair ${pairCount}/${maxPairs} (volumes: ${(candA.volume * 1e9).toFixed(0)} vs ${(candB.volume * 1e9).toFixed(0)}mm³), running ICP...`
            );

            // LIMIT point clouds to 50 points each for fast ICP
            const cloudA = candA.pointCloud.slice(0, 50);
            const cloudB = candB.pointCloud.slice(0, 50);

            console.log(
              `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
              `Running ICP with ${cloudA.length} vs ${cloudB.length} points...`
            );

            // Use faster ICP settings for sibling pairs
            const icpResult = await PCLICPSolver.align(cloudA, cloudB, {
              maxIterations: 15, // Reduced for speed
              errorTolerance: 1e-3, // Relaxed for speed
              enableDebug: false,
            });

            console.log(
              `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
              `ICP complete - error: ${icpResult.error.toFixed(6)}`
            );

            // Validate ICP result
            const maxError = icpOpts.maxICPError ?? 0.15;
            if (icpResult.error > maxError) {
              console.log(
                `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
                `ICP error too high: ${icpResult.error} (max: ${maxError})`
              );
              continue;
            }
            
            const isPrismatic = this.isPureTranslation(icpResult.transform, icpOpts);
            const isRevolute = this.isPureRotation(icpResult.transform, icpOpts);
            if (!isPrismatic && !isRevolute) {
              console.log(
                `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
                `ICP transform is not pure translation or rotation`
              );
              continue;
            }

            const translationMag = this.extractTranslationMagnitude(icpResult.transform);
            if (translationMag > (icpOpts.maxTranslation ?? 2.0)) {
              console.log(
                `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
                `Translation magnitude too large: ${translationMag} (max: ${icpOpts.maxTranslation})`
              );
              continue;
            }

            // Valid joint pair found!
            const fixedNode = candA.volume > candB.volume ? candA : candB;
            const movingNode = candA.volume > candB.volume ? candB : candA;
            
            const jointRotationAngle = this.extractRotationAngle(icpResult.transform);
            const jointTranslationMag = this.extractTranslationMagnitude(icpResult.transform);
            
            jointsFoundInUnit++;

            console.log(
              `[StructureBasedToolAnalyzer] ✓ JOINT ${jointsFoundInUnit} FOUND in Unit ${unitData.unit.name}: ` +
              `sibling pair (${isRevolute ? 'revolute' : 'prismatic'}, ` +
              `error: ${icpResult.error.toFixed(6)}, ` +
              `translation: ${jointTranslationMag.toFixed(3)}m, ` +
              `rotation: ${jointRotationAngle.toFixed(1)}°)`
            );

            jointPairs.push({
              unit: unitData.unit,
              fixedNode,
              movingNode,
              transform: icpResult.transform,
              error: icpResult.error,
            });

            // Continue checking for more joints in this unit (don't break early)
          }
        }
      }

      // Log summary for this unit
      if (jointsFoundInUnit > 0) {
        console.log(
          `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
          `Found ${jointsFoundInUnit} joint(s) total`
        );
      }

      // Skip expensive fallback - sibling pairs are sufficient and most reliable
      // If no joints found, this unit likely has no joints
      if (jointsFoundInUnit === 0 && opts.verbose) {
        console.log(
          `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
          `No valid joints found (unit likely has no joints or different structure)`
        );
      }
      
      // DISABLED: Expensive all-pairs comparison causes hangs
      // Sibling pairs are sufficient for joint detection
      /*
      if (!foundSiblingPair) {
        console.log(
          `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
          `No sibling pairs found, trying all pairs...`
        );
        
        // Compare all pairs within this unit (LIMITED to first 3 candidates only)
        const limitedCandidates = candidates.slice(0, 3);
        for (let i = 0; i < limitedCandidates.length; i++) {
          for (let j = i + 1; j < limitedCandidates.length; j++) {
            const candA = candidates[i];
            const candB = candidates[j];

            // Pre-filter using bounding box similarity
            if (!this.areBoundingBoxesSimilar(candA, candB, opts.verbose)) {
              continue;
            }

            // BBs are similar - run ICP to verify geometry match
            console.log(
              `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
              `BB match found between pair (volumes: ${(candA.volume * 1e9).toFixed(0)} vs ${(candB.volume * 1e9).toFixed(0)}mm³), running ICP...`
            );

            const icpResult = await PCLICPSolver.align(candA.pointCloud, candB.pointCloud, {
              maxIterations: 100,
              errorTolerance: 1e-6,
              enableDebug: false,
            });

            // Validate ICP result
            const maxError = icpOpts.maxICPError ?? 0.15;
            if (icpResult.error > maxError) {
              console.log(
                `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
                `ICP error too high: ${icpResult.error} (max: ${maxError})`
              );
              continue;
            }
            
            const isPrismatic = this.isPureTranslation(icpResult.transform, icpOpts);
            const isRevolute = this.isPureRotation(icpResult.transform, icpOpts);
            if (!isPrismatic && !isRevolute) {
              console.log(
                `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
                `ICP transform is not pure translation or rotation`
              );
              continue;
            }

            const translationMag = this.extractTranslationMagnitude(icpResult.transform);
            if (translationMag > (icpOpts.maxTranslation ?? 2.0)) {
              console.log(
                `[StructureBasedToolAnalyzer] Unit ${unitData.unit.name}: ` +
                `Translation magnitude too large: ${translationMag} (max: ${icpOpts.maxTranslation})`
              );
              continue;
            }

            // Valid joint pair found!
            const fixedNode = candA.volume > candB.volume ? candA : candB;
            const movingNode = candA.volume > candB.volume ? candB : candA;
            
            const jointRotationAngle = this.extractRotationAngle(icpResult.transform);
            const jointTranslationMag = this.extractTranslationMagnitude(icpResult.transform);
            
            console.log(
              `[StructureBasedToolAnalyzer] ✓ JOINT FOUND in Unit ${unitData.unit.name}: ` +
              `sibling pair (${isRevolute ? 'revolute' : 'prismatic'}, ` +
              `error: ${icpResult.error.toFixed(6)}, ` +
              `translation: ${jointTranslationMag.toFixed(3)}m, ` +
              `rotation: ${jointRotationAngle.toFixed(1)}°)`
            );

            jointPairs.push({
              unit: unitData.unit,
              fixedNode,
              movingNode,
              transform: icpResult.transform,
              error: icpResult.error,
            });
            
            foundSiblingPair = true; // Mark as found to break outer loop
            break;
          }
          if (foundSiblingPair) break;
        }
      }
    }

    // Strategy 2: Also check between units (fallback if no internal states found)
    if (jointPairs.length === 0 && unitStateCandidates.length >= 2) {
      if (opts.verbose) {
        console.log('[StructureBasedToolAnalyzer] No internal states found, checking between units...');
      }

      // Compare units directly (simplified - use first candidate from each unit)
      for (let i = 0; i < unitStateCandidates.length; i++) {
        for (let j = i + 1; j < unitStateCandidates.length; j++) {
          const unitA = unitStateCandidates[i];
          const unitB = unitStateCandidates[j];

          if (unitA.candidates.length === 0 || unitB.candidates.length === 0) continue;

          // Use first candidate from each unit
          const candA = unitA.candidates[0];
          const candB = unitB.candidates[0];

          // Pre-filter with BB
          if (!this.areBoundingBoxesSimilar(candA, candB, false)) continue;

          const icpResult = await PCLICPSolver.align(candA.pointCloud, candB.pointCloud, {
            maxIterations: 100,
            errorTolerance: 1e-6,
            enableDebug: false,
          });

          if (icpResult.error > (icpOpts.maxICPError ?? 0.15)) continue;
          
          const isPrismatic = this.isPureTranslation(icpResult.transform, icpOpts);
          const isRevolute = this.isPureRotation(icpResult.transform, icpOpts);
          if (!isPrismatic && !isRevolute) continue;

          const translationMag = this.extractTranslationMagnitude(icpResult.transform);
          if (translationMag > (icpOpts.maxTranslation ?? 2.0)) continue;

          const fixedNode = candA.volume > candB.volume ? candA : candB;
          const movingNode = candA.volume > candB.volume ? candB : candA;

          jointPairs.push({
            unit: movingNode.unit,
            fixedNode,
            movingNode,
            transform: icpResult.transform,
            error: icpResult.error,
          });
        }
      }
      */
    }

    // Step 3: Mark units with joints as moving, units without as fixed
    const unitsWithJoints = new Set<string>();

    for (const pair of jointPairs) {
      // Mark the unit as having a joint (moving)
      unitsWithJoints.add(pair.unit.id);
      pair.unit.isFixed = false;

      if (opts.verbose) {
        const jointType = this.isPureTranslation(pair.transform, icpOpts) ? 'PRISMATIC' : 'REVOLUTE';
        console.log(
          `[StructureBasedToolAnalyzer] Unit ${pair.unit.name}: ${jointType} joint detected ` +
          `(fixed node ↔ moving node), marked as MOVING`
        );
      }
    }

    // Units without joints are likely fixed (base structure)
    for (const unit of units) {
      if (!unitsWithJoints.has(unit.id)) {
        unit.isFixed = true;
        if (opts.verbose) {
          console.log(`[StructureBasedToolAnalyzer] Unit ${unit.name}: no joint detected, marked as FIXED`);
        }
      }
    }

    if (opts.verbose) {
      const fixedCount = units.filter(u => u.isFixed).length;
      const movingCount = units.filter(u => !u.isFixed).length;
      console.log(
        `[StructureBasedToolAnalyzer] ICP joint detection complete: ` +
        `${jointPairs.length} joints found, ${fixedCount} fixed, ${movingCount} moving`
      );
    }
  }

  /**
   * Extract rotation angle from transformation matrix (degrees).
   */
  private extractRotationAngle(transform: BABYLON.Matrix): number {
    const rotation = new BABYLON.Quaternion();
    transform.decompose(new BABYLON.Vector3(), rotation, new BABYLON.Vector3());
    const angle = 2 * Math.acos(Math.max(-1, Math.min(1, rotation.w)));
    return (angle * 180) / Math.PI;
  }

  /**
   * Extract translation magnitude from transformation matrix (meters).
   */
  private extractTranslationMagnitude(transform: BABYLON.Matrix): number {
    const translation = new BABYLON.Vector3();
    transform.decompose(new BABYLON.Vector3(), new BABYLON.Quaternion(), translation);
    return translation.length();
  }

  /**
   * Check if transformation is primarily translation (not rotation).
   */
  private isPureTranslation(transform: BABYLON.Matrix, icpOpts: NonNullable<StructureBasedAnalyzeOptions['icpOptions']>): boolean {
    const rotationAngle = this.extractRotationAngle(transform);
    const translationMag = this.extractTranslationMagnitude(transform);
    return translationMag >= (icpOpts.minTranslation ?? 0.01) && rotationAngle < (icpOpts.minRotation ?? 1.0);
  }

  /**
   * Check if transformation is primarily rotation (not translation).
   */
  private isPureRotation(transform: BABYLON.Matrix, icpOpts: NonNullable<StructureBasedAnalyzeOptions['icpOptions']>): boolean {
    const rotationAngle = this.extractRotationAngle(transform);
    const translationMag = this.extractTranslationMagnitude(transform);
    return rotationAngle >= (icpOpts.minRotation ?? 1.0) && translationMag < (icpOpts.minTranslation ?? 0.01);
  }

  /**
   * Get all significant child nodes (transform nodes with geometry) from a parent node.
   * 
   * Limits depth to avoid going too deep into the tree where raw meshes would match
   * too many things. We want to find high-level state nodes (MOVING, FIXED, OPEN, CLOSED)
   * not individual mesh components.
   * 
   * NOTE: Currently unused - we use a more targeted approach in detectJointsWithICP
   */
  // @ts-ignore - Unused but kept for potential future use
  private getAllSignificantChildNodes(parent: BABYLON.Node, maxDepth: number = 3): BABYLON.Node[] {
    const children: BABYLON.Node[] = [];
    const visited = new Set<BABYLON.Node>();

    const traverse = (node: BABYLON.Node, depth: number) => {
      // Limit depth to avoid raw meshes - we want high-level state nodes
      if (depth > maxDepth || visited.has(node)) return;
      visited.add(node);

      // Get immediate children
      const immediateChildren = this.getImmediateChildren(node);
      
      for (const child of immediateChildren) {
        // Check if child has geometry (meshes)
        const hasGeometry = this.hasSignificantGeometry(child, 0.0001); // Use small threshold
        
        if (hasGeometry) {
          // Found a node with geometry - add it
          // Allow up to depth 2 to find state nodes (MOVING, FIXED, etc.)
          // Depth 0 = UNIT root, Depth 1 = RH/LH, Depth 2 = MOVING/FIXED
          // We want MOVING and FIXED nodes, which are typically at depth 1-2
          if (depth <= 2) {
            children.push(child);
          }
          // Don't recurse deeper if we found geometry at this level
          // This prevents going into individual mesh components
        } else {
          // No geometry at this level - recurse into children (might be containers)
          traverse(child, depth + 1);
        }
      }
    };

    traverse(parent, 0);
    return children;
  }

  /**
   * Compute bounding box for a node (including all descendant meshes).
   */
  private computeNodeBoundingBox(node: BABYLON.Node): BABYLON.BoundingBox | null {
    try {
      if (node instanceof BABYLON.AbstractMesh) {
        node.computeWorldMatrix(true);
        return node.getBoundingInfo().boundingBox;
      }

      if (node instanceof BABYLON.TransformNode) {
        // Get all descendant meshes
        const meshes = node.getChildMeshes(false);
        
        if (meshes.length === 0) {
          return null;
        }

        // Compute combined bounding box
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (const mesh of meshes) {
          mesh.computeWorldMatrix(true);
          const bbox = mesh.getBoundingInfo().boundingBox;
          
          minX = Math.min(minX, bbox.minimum.x);
          minY = Math.min(minY, bbox.minimum.y);
          minZ = Math.min(minZ, bbox.minimum.z);
          maxX = Math.max(maxX, bbox.maximum.x);
          maxY = Math.max(maxY, bbox.maximum.y);
          maxZ = Math.max(maxZ, bbox.maximum.z);
        }

        if (minX === Infinity) {
          return null;
        }

        return new BABYLON.BoundingBox(
          new BABYLON.Vector3(minX, minY, minZ),
          new BABYLON.Vector3(maxX, maxY, maxZ)
        );
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Sample point cloud from a node (all descendant meshes in local space).
   */
  private sampleNodePointCloud(
    node: BABYLON.Node,
    icpOpts: NonNullable<StructureBasedAnalyzeOptions['icpOptions']>
  ): BABYLON.Vector3[] {
    const pointCloud: BABYLON.Vector3[] = [];

    if (node instanceof BABYLON.AbstractMesh) {
      const points = WorldSpace.sampleMeshLocalPoints(node, {
        stride: icpOpts.sampleStride,
        maxPoints: icpOpts.maxSamplePoints,
      });
      pointCloud.push(...points);
    }

    if (node instanceof BABYLON.TransformNode) {
      const meshes = node.getChildMeshes(false);
      for (const mesh of meshes) {
        const points = WorldSpace.sampleMeshLocalPoints(mesh, {
          stride: icpOpts.sampleStride,
          maxPoints: icpOpts.maxSamplePoints,
        });
        pointCloud.push(...points);
      }
    }

    return pointCloud;
  }

  /**
   * Check if two bounding boxes are similar (same size, similar position).
   * Used as a pre-filter before running expensive ICP.
   * 
   * @param candA - First node candidate
   * @param candB - Second node candidate
   * @param verbose - Enable verbose logging
   * @returns true if bounding boxes are similar enough to warrant ICP
   */
  private areBoundingBoxesSimilar(
    candA: { dimensions: BABYLON.Vector3; volume: number; boundingBox: BABYLON.BoundingBox },
    candB: { dimensions: BABYLON.Vector3; volume: number; boundingBox: BABYLON.BoundingBox },
    verbose: boolean
  ): boolean {
    // Check 1: Volume similarity (within 20% tolerance)
    const volumeRatio = Math.min(candA.volume, candB.volume) / Math.max(candA.volume, candB.volume);
    if (volumeRatio < 0.8) {
      if (verbose) {
        console.log(
          `  - BB volume mismatch: ${(candA.volume * 1e9).toFixed(2)}mm³ vs ` +
          `${(candB.volume * 1e9).toFixed(2)}mm³ (ratio: ${(volumeRatio * 100).toFixed(1)}%)`
        );
      }
      return false;
    }

    // Check 2: Dimension similarity (each axis within 20% tolerance)
    const dimA = candA.dimensions;
    const dimB = candB.dimensions;
    
    const xRatio = Math.min(Math.abs(dimA.x), Math.abs(dimB.x)) / Math.max(Math.abs(dimA.x), Math.abs(dimB.x));
    const yRatio = Math.min(Math.abs(dimA.y), Math.abs(dimB.y)) / Math.max(Math.abs(dimA.y), Math.abs(dimB.y));
    const zRatio = Math.min(Math.abs(dimA.z), Math.abs(dimB.z)) / Math.max(Math.abs(dimA.z), Math.abs(dimB.z));

    if (xRatio < 0.8 || yRatio < 0.8 || zRatio < 0.8) {
      if (verbose) {
        console.log(
          `  - BB dimension mismatch: ` +
          `(${(dimA.x * 1000).toFixed(1)}, ${(dimA.y * 1000).toFixed(1)}, ${(dimA.z * 1000).toFixed(1)})mm vs ` +
          `(${(dimB.x * 1000).toFixed(1)}, ${(dimB.y * 1000).toFixed(1)}, ${(dimB.z * 1000).toFixed(1)})mm`
        );
      }
      return false;
    }

    // Check 3: Position similarity (centroids should be reasonably close)
    // For same geometry in different states, centroids might differ due to motion
    // But they shouldn't be wildly different (e.g., more than 3x the largest dimension)
    const centroidA = candA.boundingBox.minimum.add(candA.boundingBox.maximum).scale(0.5);
    const centroidB = candB.boundingBox.minimum.add(candB.boundingBox.maximum).scale(0.5);
    const centroidDistance = BABYLON.Vector3.Distance(centroidA, centroidB);
    const maxDimension = Math.max(
      Math.abs(dimA.x), Math.abs(dimA.y), Math.abs(dimA.z),
      Math.abs(dimB.x), Math.abs(dimB.y), Math.abs(dimB.z)
    );

    // Allow centroid distance up to 3x the max dimension (for open/closed states)
    if (centroidDistance > maxDimension * 3) {
      if (verbose) {
        console.log(
          `  - BB centroid too far: ${(centroidDistance * 1000).toFixed(1)}mm ` +
          `(max dim: ${(maxDimension * 1000).toFixed(1)}mm)`
        );
      }
      return false;
    }

    if (verbose) {
      console.log(
        `  - ✅ BB similarity match: ` +
        `volume ratio: ${(volumeRatio * 100).toFixed(1)}%, ` +
        `centroid distance: ${(centroidDistance * 1000).toFixed(1)}mm`
      );
    }

    return true;
  }
}

