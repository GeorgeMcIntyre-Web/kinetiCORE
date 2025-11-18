import * as BABYLON from '@babylonjs/core';
import { getWorldTransform, WorldSpace } from '../utils/WorldSpace';
import { PCLICPSolver } from '../pointCloud/PCLICPSolver';
// import { SceneManager } from '../../scene/SceneManager'; // Not used - scene passed as parameter
import type { ToolUnit, ToolGraph, ToolUnitType } from './ToolGraphAnalyzer';
import type { DetectedToolJoint, AnalyzerDebugSnapshot, AnalyzerUnitDebug, JointCandidateDebug } from './ToolingTypes';

// Feature flag for fixture-specific debug logging
const FX_DEBUG_ENV = typeof process !== 'undefined'
  ? process.env.KINETICORE_FX_DEBUG
  : undefined;
const FX_DEBUG_ENABLED = FX_DEBUG_ENV === '1';

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
   * Joint detection configuration (geometry + ICP thresholds).
   * All thresholds are centralized here for maintainability.
   * Values are tuned against the tooling dataset (8X-140_GEO fixture).
   */
  jointDetectionConfig?: {
    /** Normalized extents similarity threshold (per component). Default: 0.03 (3%) */
    geometryEpsilon?: number;
    /** Transform clustering: position epsilon (meters). Default: 0.0001 (0.1mm) */
    transformClusterPosEpsilon?: number;
    /** Transform clustering: rotation epsilon (degrees). Default: 0.1 */
    transformClusterRotEpsilonDeg?: number;
    /** Max center distance factor (× bodySize). Default: 2.5 */
    maxCenterDistanceFactor?: number;
    /** Min center distance factor (× bodySize, clamped to 0.0005m). Default: 0.005 (0.5%) */
    minCenterDistanceFactor?: number;
    /** Max translation factor (× bodySize) for initial matrix filter. Default: 30 */
    maxTranslationFactor?: number;
    /** Max translation factor for "normal" stroke classification. Default: 12 */
    maxTranslationFactorNormal?: number;
    /** Min rotation angle (degrees) to reject as too small. Default: 0.5 */
    minRotationAngleDeg?: number;
    /** Max rotation angle (degrees) to reject as too large. Default: 150.0 */
    maxRotationAngleDeg?: number;
    /** Unit clustering configuration (for grouping related units into mechanical units) */
    unitClustering?: {
      /** Max center distance factor (× combined body size) for clustering. Default: 0.5 */
      maxCenterDistanceFactor?: number;
      /** Min AABB overlap ratio (0-1) to consider units as same mechanical unit. Default: 0.3 */
      minOverlapRatio?: number;
    };
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
    // Threshold tuning notes (tuned for automotive tooling GLBs):
    // maxICPError: 0.20 (200mm) - lenient for automotive tooling with manufacturing tolerances.
    //   Increased from 0.15 to catch more valid joints for 1E1_LH and 2174.
    //   Too strict (< 0.15): rejects valid joints with higher alignment error.
    //   Too loose (> 0.25): accepts false positives from mismatched geometry.
    maxICPError: 0.20,
    // minPoints: 20 - minimum vertices for reliable geometry signature.
    //   Lowered from 50 to catch smaller components while avoiding noise.
    //   Actual minimum enforced in classifyJointPair is max(20, userValue).
    minPoints: 20,
    // maxSamplePoints: 500 - balance between accuracy and performance.
    //   Higher (> 1000): better ICP accuracy but slower.
    //   Lower (< 200): faster but may miss fine details.
    maxSamplePoints: 500,
    // sampleStride: 3-5 - vertex sampling stride for point clouds.
    //   Lower (< 3): more points, slower ICP.
    //   Higher (> 10): fewer points, faster but less accurate.
    //   Actual stride is clamped to max(3, userValue) in classifyJointPair.
    sampleStride: 3,
    // minTranslation: 0.01 (10mm) - minimum motion to classify as prismatic.
    //   Too strict (< 5mm): misses small but valid motions.
    //   Too loose (> 20mm): accepts noise as motion.
    minTranslation: 0.01,
    // minRotation: 0.5° - minimum rotation to classify as revolute.
    //   Lowered from 1.0° to catch more valid revolute joints for 1E1_LH and 2174.
    //   Too strict (< 0.3°): misses small rotations.
    //   Too loose (> 2°): accepts noise as rotation.
    minRotation: 0.5,
    // maxTranslation: 2.0 (2m) - maximum translation for automotive tooling.
    //   Prevents accepting physically impossible motions.
    //   Adjust based on your fixture size scale.
    maxTranslation: 2.0,
  },
  jointDetectionConfig: {
    // Geometry similarity threshold (normalized extents, per component).
    // Tuned for automotive tooling GLBs where same rigid bodies appear in multiple poses.
    // Too strict (< 0.02): misses valid families due to minor geometric variations.
    // Too loose (> 0.05): groups different parts incorrectly.
    geometryEpsilon: 0.03,
    // Transform clustering: position epsilon (0.3mm) - groups nodes at same pose.
    // Slightly relaxed to group similar states and create more pairs.
    // Too strict (< 0.2mm): creates too many states, missing valid pairs.
    // Too loose (> 0.5mm): groups different states together incorrectly.
    transformClusterPosEpsilon: 0.0003,
    // Transform clustering: rotation epsilon (0.3°) - groups nodes at same orientation.
    // Slightly relaxed to group similar states and create more pairs.
    // Too strict (< 0.2°): creates too many states, missing valid pairs.
    // Too loose (> 0.5°): groups different states together incorrectly.
    transformClusterRotEpsilonDeg: 0.3,
    // Max center distance factor (3.0× bodySize) - maximum distance for pairing instances.
    // Tuned to catch valid pairs that are further apart in units with large motion ranges.
    // Increased from 2.5 to catch more valid pairs for 1E1_LH and 2174.
    maxCenterDistanceFactor: 3.0,
    // Min center distance factor (0.5% bodySize, min 0.5mm) - filters same-pose duplicates.
    minCenterDistanceFactor: 0.005,
    // Max translation factor (30× bodySize) - allows long-stroke joints like UNIT_102's S1 pair.
    // The maxTranslation check (2.0m) still catches physically impossible motions.
    maxTranslationFactor: 30,
    // Max translation factor for "normal" stroke classification (12× bodySize).
    // Joints above this are classified as "longStroke" for diagnostics.
    maxTranslationFactorNormal: 12,
    // Min rotation angle (0.3°) - rejects joints with negligible rotation.
    // Lowered from 0.5° to catch more valid revolute joints for 1E1_LH and 2174.
    minRotationAngleDeg: 0.3,
    // Max rotation angle (150°) - rejects joints with impossible rotation (> 180°).
    maxRotationAngleDeg: 150.0,
    // Unit clustering: groups related unit candidates into mechanical units.
    // Extremely conservative defaults: require near-perfect overlap (>99%) AND tiny distance (< 0.005x).
    // This prevents over-clustering separate mechanical units (1E1_LH, 2174 cases).
    // True sub-assemblies (GEO case) will have near-perfect overlap (>99%) and tiny distance.
    unitClustering: {
      // Max center distance factor (0.005× combined body size) - extremely strict to prevent over-clustering.
      // Only units that are nearly identical in position relative to their size should cluster.
      // Too strict (< 0.002): might miss some valid sub-assemblies in GEO.
      // Too loose (> 0.01): incorrectly merges separate mechanical units (1E1_LH, 2174).
      maxCenterDistanceFactor: 0.005,
      // Min AABB overlap ratio (0.99 = 99%) - extremely strict to prevent over-clustering.
      // Overlap = intersection volume / min(volumeA, volumeB).
      // True sub-assemblies have >99% overlap, separate units have <98% overlap.
      // Too strict (> 0.995): might miss some valid sub-assemblies in GEO.
      // Too loose (< 0.98): incorrectly merges separate mechanical units (1E1_LH, 2174).
      minOverlapRatio: 0.99,
    },
  },
  verbose: false,
};

/**
 * Joint delta classification result.
 */
interface JointDeltaClassification {
  isPrismatic: boolean;
  translation: BABYLON.Vector3;
  translationMagnitude: number;
  rotationAxis: BABYLON.Vector3;
  rotationAngleRad: number;
  rotationAngleDeg: number;
  translationRatio: number;
  strokeCategory: 'normal' | 'longStroke';
}

/**
 * Structure-based tool unit analyzer.
 * 
 * **Algorithm:**
 * 1. Traverse hierarchy from root downward
 * 2. Find the highest level where child count >= minUnitCount
 * 3. Treat those children as "units"
 * 4. Optionally classify fixed vs moving based on geometry
 * 
 * **Key Features:**
 * - Name-agnostic: Does not rely on naming patterns like "UNIT_XXX"
 * - Geometry-driven joint detection: Uses geometry similarity + ICP, not node text
 * - Uncapped: No maximum joints per unit; joints determined by:
 *   - Geometry similarity (families)
 *   - Transform clustering (instances)
 *   - Distance filters (spatial proximity)
 *   - Matrix + ICP quality thresholds
 * 
 * The golden fixture (8X-140_GEO) currently has 9 joints (4/3/2 for units 102/104/106)
 * and is used as a regression baseline.
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
  /** Detected joints from the last analysis run */
  private detectedJoints: DetectedToolJoint[] = [];
  /** Units from the last analysis run (for snapshot) */
  private lastUnits: ToolUnit[] = [];
  /** Scene from the last analysis run (for snapshot) */
  private lastScene: BABYLON.Scene | null = null;
  /** Debug information (only populated when debug is enabled) */
  private debugUnitInfo: AnalyzerUnitDebug[] = [];
  private debugCandidatePairs: JointCandidateDebug[] = [];

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

    // Clear debug info from previous run
    this.debugUnitInfo = [];
    this.debugCandidatePairs = [];

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

    // Step 2: Convert children to ToolUnits (candidates)
    const unitCandidates: Array<{
      unit: ToolUnit;
      node: BABYLON.Node;
      center: BABYLON.Vector3;
      extent: BABYLON.Vector3;
      aabb: { min: BABYLON.Vector3; max: BABYLON.Vector3 };
    }> = [];

    for (let i = 0; i < unitsLevel.children.length; i++) {
      const child = unitsLevel.children[i];
      const unitId = this.generateUnitId(child, i);
      const nodeIds = this.collectDescendantIds(child);

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

      const bbox = this.computeNodeBoundingBox(child);
      if (!bbox) continue;

      const extent = bbox.maximum.subtract(bbox.minimum);
      const center = bbox.minimum.add(bbox.maximum).scale(0.5);

      unitCandidates.push({
        unit: {
          id: unitId,
          name: child.name || unitId,
          root: this.nodeId(child),
          type: this.inferUnitType(child, isFixed),
          isFixed,
          nodes: nodeIds,
        },
        node: child,
        center,
        extent,
        aabb: {
          min: bbox.minimum.clone(),
          max: bbox.maximum.clone(),
        },
      });

      if (opts.verbose) {
        console.log(
          `[StructureBasedToolAnalyzer] Created unit candidate: ${unitId} ` +
          `(fixed: ${isFixed}, nodes: ${nodeIds.length})`
        );
      }
    }

    // Step 2b: Cluster unit candidates into mechanical units
    const defaultUnitClustering = DEFAULT_STRUCTURE_OPTIONS.jointDetectionConfig!.unitClustering!;
    const unitClustering: { maxCenterDistanceFactor: number; minOverlapRatio: number } = {
      maxCenterDistanceFactor: opts.jointDetectionConfig?.unitClustering?.maxCenterDistanceFactor ?? defaultUnitClustering.maxCenterDistanceFactor ?? 0.005,
      minOverlapRatio: opts.jointDetectionConfig?.unitClustering?.minOverlapRatio ?? defaultUnitClustering.minOverlapRatio ?? 0.99,
    };
    
    if (opts.verbose || FX_DEBUG_ENABLED) {
      console.log(
        `[StructureBasedToolAnalyzer] Clustering ${unitCandidates.length} candidates ` +
        `(maxCenterDistFactor: ${unitClustering.maxCenterDistanceFactor}, minOverlap: ${unitClustering.minOverlapRatio})`
      );
    }
    
    const clusteredCandidates = this.clusterUnits(unitCandidates, unitClustering, opts.verbose || FX_DEBUG_ENABLED);
    
    if (opts.verbose || FX_DEBUG_ENABLED) {
      console.log(
        `[StructureBasedToolAnalyzer] Clustered to ${clusteredCandidates.length} mechanical units`
      );
    }

    // Step 2c: Convert clustered candidates to final units
    const units: ToolUnit[] = [];
    const anchors: ToolGraph['anchors'] = {};

    for (const candidate of clusteredCandidates) {
      const unit = candidate.unit;
      units.push(unit);

      const wt = getWorldTransform(candidate.node);
      anchors[unit.id] = {
        position: wt.position.clone(),
        rotation: wt.rotation.clone(),
      };

      if (opts.verbose) {
        console.log(
          `[StructureBasedToolAnalyzer] Final unit: ${unit.id} ` +
          `(from ${unitCandidates.filter(c => c.unit.id === unit.id).length} candidate(s))`
        );
      }
    }

    // Step 3: Use ICP to detect which units have joints (if enabled)
    if (opts.detectJointsWithICP && units.length >= 2) {
      console.log(`[StructureBasedToolAnalyzer] Running ICP-based joint detection on ${units.length} units...`);
      await this.detectJointsWithICP(units, opts, scene);
    } else {
      console.log(`[StructureBasedToolAnalyzer] Skipping ICP detection: detectJointsWithICP=${opts.detectJointsWithICP}, units.length=${units.length}`);
      this.detectedJoints = [];
    }

    // Store units and scene for snapshot access
    this.lastUnits = units;
    this.lastScene = scene;

    // Debug logging (toggleable via KINETICORE_FX_DEBUG=1)
    if (FX_DEBUG_ENABLED) {
      const snapshot = this.getDebugSnapshot(opts.verbose ? 'debug' : 'fixture');
      const joints = this.getDetectedToolJoints();
      this.logUnitsSummary(snapshot);
      this.logJointsSummary(joints, snapshot.fixtureId);
    }

    return { units, anchors };
  }

  /**
   * Get detected tool joints from the last analysis run.
   * Returns empty array if no joints were detected or analysis hasn't been run.
   */
  getDetectedToolJoints(): DetectedToolJoint[] {
    return this.detectedJoints;
  }

  /**
   * Get debug snapshot of analyzer state for a fixture.
   * Uses the current in-memory analysis result, not re-run detection.
   */
  getDebugSnapshot(fixtureId: string): AnalyzerDebugSnapshot {
    if (!this.lastScene) {
      return {
        fixtureId,
        units: [],
        totalUnits: 0,
        totalJoints: 0,
      };
    }

    const units: AnalyzerDebugSnapshot['units'] = [];
    const jointCountsByUnit = new Map<string, number>();

    for (const joint of this.detectedJoints) {
      const currentCount = jointCountsByUnit.get(joint.unitId) || 0;
      jointCountsByUnit.set(joint.unitId, currentCount + 1);
    }

    for (const unit of this.lastUnits) {
      // Try multiple methods to find the unit node
      let unitNode: BABYLON.Node | null = null;
      const rootId = unit.root;
      
      // Try parsing as uniqueId first
      const uniqueId = parseInt(rootId);
      if (!isNaN(uniqueId)) {
        unitNode = this.lastScene.transformNodes.find(n => n.uniqueId === uniqueId) as BABYLON.Node || null;
        if (!unitNode) {
          unitNode = this.lastScene.meshes.find(m => m.uniqueId === uniqueId) as BABYLON.Node || null;
        }
      }
      
      // Fallback to ID-based lookup
      if (!unitNode) {
        unitNode = this.lastScene.getNodeById(rootId) || 
                   this.lastScene.getTransformNodeByID(rootId) ||
                   this.lastScene.getMeshByID(rootId) ||
                   this.lastScene.getNodeByName(unit.name) ||
                   null;
      }
      
      if (!unitNode) continue;

      const bbox = this.computeNodeBoundingBox(unitNode);
      if (!bbox) continue;

      const childNodeCount = this.getImmediateChildren(unitNode).length;
      const jointCount = jointCountsByUnit.get(unit.id) || 0;

      units.push({
        id: unit.id,
        worldAabb: {
          min: bbox.minimum.clone(),
          max: bbox.maximum.clone(),
        },
        childNodeCount,
        jointCount,
      });
    }

    const snapshot: AnalyzerDebugSnapshot = {
      fixtureId,
      units,
      totalUnits: units.length,
      totalJoints: this.detectedJoints.length,
    };

    // Include debug info if available (only populated when debug is enabled)
    if (this.debugUnitInfo.length > 0 || this.debugCandidatePairs.length > 0) {
      snapshot.unitDebug = this.debugUnitInfo;
      snapshot.candidatePairs = this.debugCandidatePairs;
    }

    return snapshot;
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
            
            // Sort by score (highest first) and take all candidates that meet criteria
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
              .map(item => item.node);
            
            // If we didn't get enough direct children, try without the parent filter (in case hierarchy is different)
            // Take all candidates that meet the UNIT node criteria (no hardcoded limit)
            if (topUnitNodes.length < opts.minUnitCount && scoredNodes.length >= opts.minUnitCount) {
              const fallbackNodes = scoredNodes.map(item => item.node);
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
   * Geometry-based joint detection pipeline (no name-based pairing).
   * 
   * Algorithm:
   * 1. Build geometry signatures per UNIT (AABB, vertex count, normalized extents)
   * 2. Group "same rigid body" by geometry (families)
   * 3. Pair family members by spatial proximity (greedy closest-pair)
   * 4. For each pair: relative matrix + ICP → joint candidate
   * 
   * This algorithm does NOT rely on node names to pair states.
   * It works purely on geometry + transforms + hierarchy.
   */
  private async detectJointsWithICP(
    units: ToolUnit[],
    opts: Required<StructureBasedAnalyzeOptions>,
    scene: BABYLON.Scene
  ): Promise<void> {
    const DEBUG_STRUCTURE_ANALYZER = opts.verbose || false;
    
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

    const defaultJointCfg = DEFAULT_STRUCTURE_OPTIONS.jointDetectionConfig!;
    const jointCfg: Required<NonNullable<StructureBasedAnalyzeOptions['jointDetectionConfig']>> = {
      geometryEpsilon: opts.jointDetectionConfig?.geometryEpsilon ?? defaultJointCfg.geometryEpsilon!,
      transformClusterPosEpsilon: opts.jointDetectionConfig?.transformClusterPosEpsilon ?? defaultJointCfg.transformClusterPosEpsilon!,
      transformClusterRotEpsilonDeg: opts.jointDetectionConfig?.transformClusterRotEpsilonDeg ?? defaultJointCfg.transformClusterRotEpsilonDeg!,
      maxCenterDistanceFactor: opts.jointDetectionConfig?.maxCenterDistanceFactor ?? defaultJointCfg.maxCenterDistanceFactor!,
      minCenterDistanceFactor: opts.jointDetectionConfig?.minCenterDistanceFactor ?? defaultJointCfg.minCenterDistanceFactor!,
      maxTranslationFactor: opts.jointDetectionConfig?.maxTranslationFactor ?? defaultJointCfg.maxTranslationFactor!,
      maxTranslationFactorNormal: opts.jointDetectionConfig?.maxTranslationFactorNormal ?? defaultJointCfg.maxTranslationFactorNormal!,
      minRotationAngleDeg: opts.jointDetectionConfig?.minRotationAngleDeg ?? defaultJointCfg.minRotationAngleDeg!,
      maxRotationAngleDeg: opts.jointDetectionConfig?.maxRotationAngleDeg ?? defaultJointCfg.maxRotationAngleDeg!,
      unitClustering: {
        maxCenterDistanceFactor: opts.jointDetectionConfig?.unitClustering?.maxCenterDistanceFactor ?? defaultJointCfg.unitClustering!.maxCenterDistanceFactor,
        minOverlapRatio: opts.jointDetectionConfig?.unitClustering?.minOverlapRatio ?? defaultJointCfg.unitClustering!.minOverlapRatio,
      },
    };
    
    if (!scene) {
      console.warn('[StructureBasedToolAnalyzer] No scene available for ICP detection');
      return;
    }

    // Helper: Structured logging with tags
    const log = (tag: string, message: string) => {
      if (DEBUG_STRUCTURE_ANALYZER) {
        console.log(`[${tag}] ${message}`);
      }
    };

    // Step 1: Build geometry signatures per UNIT
    interface GeometrySignature {
      node: BABYLON.TransformNode;
      unitId: string;
      vertexCount: number;
      extents: BABYLON.Vector3;
      center: BABYLON.Vector3;
      normExtents: BABYLON.Vector3;
    }

    interface BodyFamily {
      members: GeometrySignature[];
      representative: GeometrySignature;
    }

    const unitSignatures = new Map<string, GeometrySignature[]>();

    for (const unit of units) {
      const uniqueId = parseInt(unit.root);
      let unitNode: BABYLON.Node | null = null;
      
      if (!isNaN(uniqueId)) {
        unitNode = scene.transformNodes.find(n => n.uniqueId === uniqueId) as BABYLON.Node || null;
        if (!unitNode) {
          unitNode = scene.meshes.find(m => m.uniqueId === uniqueId) as BABYLON.Node || null;
        }
      }
      
      if (!unitNode) {
        unitNode = scene.getNodeById(unit.root) ||
                   scene.getTransformNodeByID(unit.root) ||
                   scene.getMeshByID(unit.root) ||
                   scene.getNodeByName(unit.name) ||
                   null;
      }

      if (!unitNode) {
        log('FAMILY_BUILD', `Unit ${unit.name}: root node not found`);
        continue;
      }

      const signatures = this.buildGeometrySignatures(unitNode, unit.id, opts.minVolume, icpOpts);
      if (signatures.length > 0) {
        unitSignatures.set(unit.id, signatures);
        log('FAMILY_BUILD', `Unit ${unit.name}: ${signatures.length} geometry signatures`);
      }
    }

    // Step 2: Group "same rigid body" by geometry (families)
    const unitFamilies = new Map<string, BodyFamily[]>();
    
    for (const [unitId, signatures] of unitSignatures.entries()) {
      const families = this.groupIntoFamilies(signatures, jointCfg, DEBUG_STRUCTURE_ANALYZER);
      if (families.length > 0) {
        unitFamilies.set(unitId, families);
        log('FAMILY_BUILD', `Unit ${unitId}: ${families.length} body families`);
        for (const family of families) {
          log('FAMILY_BUILD', `  Family: ${family.members.length} members`);
        }
      }
    }

    // Track debug info for families (only when debug is enabled)
    const enableDebug = DEBUG_STRUCTURE_ANALYZER || FX_DEBUG_ENABLED;
    if (enableDebug) {
      for (const [unitId, families] of unitFamilies.entries()) {
        const unitDebug: AnalyzerUnitDebug = {
          unitId,
          families: [],
          jointCount: 0,
        };

        for (const family of families) {
          // Cluster to get state count
          const instances = this.clusterByTransform(family, jointCfg, false);
          const pairs = this.pairBySpatialProximity(family, jointCfg, false);
          const familyId = `${unitId}_${family.representative.vertexCount}_${family.representative.normExtents.x.toFixed(3)}`;
          
          unitDebug.families.push({
            familyId,
            memberCount: family.members.length,
            stateCount: instances.length,
            pairsCount: pairs.length,
          });
        }

        this.debugUnitInfo.push(unitDebug);
      }
    }

    // Step 3: Pair family members by spatial proximity (state pairs)
    // 
    // Pairing strategy: Cluster by transform → pair instances
    // 
    // We cluster family members by transform into "body instances" to avoid pairing
    // same-pose duplicates (e.g., multiple bolts at the same location). This handles
    // tools where a clamp is built from many parts that share transforms.
    // 
    // After clustering, we pair instances (poses) rather than raw mesh nodes. This ensures
    // we find genuine "state A vs state B" pairs for joints, not duplicate geometry.
    // 
    // Thresholds are tuned so the 8X-140_GEO tooling detects 6 joints and other test
    // fixtures behave correctly.
    interface StatePair {
      unit: ToolUnit;
      sigA: GeometrySignature;
      sigB: GeometrySignature;
      distance: number;
    }

    const allStatePairs: Array<StatePair & { familyId: string }> = [];

    for (const [unitId, families] of unitFamilies.entries()) {
      const unit = units.find(u => u.id === unitId);
      if (!unit) continue;

      for (const family of families) {
        if (family.members.length < 2) continue;

        const pairs = this.pairBySpatialProximity(family, jointCfg, DEBUG_STRUCTURE_ANALYZER);
        const familyId = `${unitId}_${family.representative.vertexCount}_${family.representative.normExtents.x.toFixed(3)}`;
        for (const pair of pairs) {
          allStatePairs.push({
            unit,
            sigA: pair.a,
            sigB: pair.b,
            distance: pair.distance,
            familyId,
          });
        }
      }
    }

    log('PAIR_DIST', `Total state pairs found: ${allStatePairs.length}`);

    // Step 4: For each pair: relative matrix + ICP → joint candidate
    type JointStrokeCategory = 'normal' | 'longStroke';
    const jointPairs: Array<{
      unit: ToolUnit;
      sigA: GeometrySignature;
      sigB: GeometrySignature;
      transform: BABYLON.Matrix;
      error: number;
      jointType: 'revolute' | 'prismatic';
      rotationAngle: number;
      translationMag: number;
      strokeCategory: JointStrokeCategory;
      translationRatio: number;
    }> = [];

    for (const statePair of allStatePairs) {
      const bodySize = Math.max(statePair.sigA.extents.length(), statePair.sigB.extents.length());
      const candidateDebug: JointCandidateDebug = {
        unitId: statePair.unit.id,
        familyId: statePair.familyId,
        stateAId: this.nodeId(statePair.sigA.node),
        stateBId: this.nodeId(statePair.sigB.node),
        centerDistance: statePair.distance,
        bodySize,
      };

      const result = await this.classifyJointPair(
        statePair.sigA,
        statePair.sigB,
        icpOpts,
        jointCfg,
        DEBUG_STRUCTURE_ANALYZER
      );

      if (!result) {
        // Track rejected candidates
        if (enableDebug) {
          candidateDebug.classification = 'rejected';
          candidateDebug.rejectionReason = 'classification_failed';
          this.debugCandidatePairs.push(candidateDebug);
        }
        continue;
      }

      candidateDebug.icpError = result.error;
      candidateDebug.rotationDeg = result.rotationAngle;
      candidateDebug.translationMagnitude = result.translationMag;
      candidateDebug.classification = result.jointType;

      if (enableDebug) {
        this.debugCandidatePairs.push(candidateDebug);
      }

      const translationRatio = bodySize > 0 ? result.translationMag / bodySize : 0;
      const strokeCategory: JointStrokeCategory = translationRatio <= jointCfg.maxTranslationFactorNormal ? 'normal' : 'longStroke';

      jointPairs.push({
        unit: statePair.unit,
        sigA: statePair.sigA,
        sigB: statePair.sigB,
        transform: result.transform,
        error: result.error,
        jointType: result.jointType,
        rotationAngle: result.rotationAngle,
        translationMag: result.translationMag,
        strokeCategory,
        translationRatio,
      });

      log('JOINT_ACCEPTED', 
        `Unit ${statePair.unit.name}: ${result.jointType} joint ` +
        `(error: ${result.error.toFixed(6)}, ` +
        `translation: ${result.translationMag.toFixed(3)}m, ` +
        `rotation: ${result.rotationAngle.toFixed(1)}°)`
      );
    }

    // Step 4b: Filter only exact duplicates (same nodes, same transform)
    // Only remove pairs that are truly identical - different nodes with similar transforms are different joints
    const filteredJointPairs: typeof jointPairs = [];
    const jointsByUnit = new Map<string, typeof jointPairs>();
    for (const pair of jointPairs) {
      if (!jointsByUnit.has(pair.unit.id)) {
        jointsByUnit.set(pair.unit.id, []);
      }
      jointsByUnit.get(pair.unit.id)!.push(pair);
    }

    for (const [, unitJoints] of jointsByUnit.entries()) {
      const kept: typeof unitJoints = [];
      for (const joint of unitJoints) {
        let isDuplicate = false;
        for (const existing of kept) {
          // Only filter if pairs share the exact same geometry signatures (same nodes)
          // Different nodes with similar transforms are different joints
          const sameNodes = (joint.sigA.node === existing.sigA.node && joint.sigB.node === existing.sigB.node) ||
                           (joint.sigA.node === existing.sigB.node && joint.sigB.node === existing.sigA.node);
          if (sameNodes) {
            // Keep the one with better (lower) ICP error
            if (joint.error < existing.error) {
              const idx = kept.indexOf(existing);
              kept[idx] = joint;
            }
            isDuplicate = true;
            break;
          }
        }
        if (!isDuplicate) {
          kept.push(joint);
        }
      }
      filteredJointPairs.push(...kept);
    }

    // Step 5: Mark units with joints as moving, units without as fixed
    // Joint count is determined purely by quality filters in classifyJointPair and duplicate filtering.
    // No per-unit or per-family caps - all high-quality pairs are accepted.
    // Also track joint counts per unit for testing/debugging
    const unitsWithJoints = new Set<string>();
    const jointCountsPerUnit = new Map<string, number>();

    for (const pair of filteredJointPairs) {
      unitsWithJoints.add(pair.unit.id);
      pair.unit.isFixed = false;
      const currentCount = jointCountsPerUnit.get(pair.unit.id) || 0;
      jointCountsPerUnit.set(pair.unit.id, currentCount + 1);
    }

    for (const unit of units) {
      if (!unitsWithJoints.has(unit.id)) {
        unit.isFixed = true;
        jointCountsPerUnit.set(unit.id, 0);
      }
    }

    if (DEBUG_STRUCTURE_ANALYZER) {
      const fixedCount = units.filter(u => u.isFixed).length;
      const movingCount = units.filter(u => !u.isFixed).length;
      log('JOINT_ACCEPTED', 
        `Joint detection complete: ${filteredJointPairs.length} joints found, ` +
        `${fixedCount} fixed units, ${movingCount} moving units`
      );
      for (const [unitId, count] of jointCountsPerUnit.entries()) {
        if (count > 0) {
          const unit = units.find(u => u.id === unitId);
          log('JOINT_ACCEPTED', `Unit ${unit?.name || unitId}: ${count} joint(s)`);
        }
      }
    }

    // Store joint counts in units for test access (minimal extension, doesn't change algorithm)
    for (const unit of units) {
      (unit as any).jointCount = jointCountsPerUnit.get(unit.id) || 0;
    }

    // Update joint counts in debug info
    if (enableDebug) {
      for (const unitDebug of this.debugUnitInfo) {
        unitDebug.jointCount = jointCountsPerUnit.get(unitDebug.unitId) || 0;
      }
    }

    // Convert filteredJointPairs to DetectedToolJoint[] and store
    this.detectedJoints = this.convertJointPairsToDetectedJoints(filteredJointPairs);
  }

  /**
   * Convert internal joint pairs to DetectedToolJoint format.
   */
  private convertJointPairsToDetectedJoints(
    jointPairs: Array<{
      unit: ToolUnit;
      sigA: {
        node: BABYLON.TransformNode;
        center: BABYLON.Vector3;
        extents: BABYLON.Vector3;
      };
      sigB: {
        node: BABYLON.TransformNode;
        center: BABYLON.Vector3;
        extents: BABYLON.Vector3;
      };
      transform: BABYLON.Matrix;
      error: number;
      jointType: 'revolute' | 'prismatic';
      rotationAngle: number;
      translationMag: number;
      strokeCategory: 'normal' | 'longStroke';
      translationRatio: number;
    }>
  ): DetectedToolJoint[] {
    const detected: DetectedToolJoint[] = [];
    const jointIndexByUnit = new Map<string, number>();

    for (const pair of jointPairs) {
      const unitId = pair.unit.id;
      const currentIndex = jointIndexByUnit.get(unitId) || 0;
      const jointId = `${unitId}_J${currentIndex}`;
      jointIndexByUnit.set(unitId, currentIndex + 1);

      // Extract axis and origin from transform
      const transform = pair.transform;
      const translation = new BABYLON.Vector3();
      const rotation = new BABYLON.Quaternion();
      transform.decompose(new BABYLON.Vector3(), rotation, translation);

      let axisWorld: BABYLON.Vector3;
      let travelWorld: number;
      let originWorld: BABYLON.Vector3;

      if (pair.jointType === 'prismatic') {
        // Prismatic: axis is normalized translation vector
        axisWorld = translation.length() > 1e-6 ? translation.normalize() : new BABYLON.Vector3(1, 0, 0);
        travelWorld = pair.translationMag; // meters
        originWorld = pair.sigA.center.clone(); // Use first state center as origin
      } else {
        // Revolute: axis is rotation axis from quaternion
        const angle = pair.rotationAngle * (Math.PI / 180);
        const sinHalfAngle = Math.sin(angle / 2);
        if (Math.abs(sinHalfAngle) > 1e-6) {
          axisWorld = new BABYLON.Vector3(
            rotation.x / sinHalfAngle,
            rotation.y / sinHalfAngle,
            rotation.z / sinHalfAngle
          ).normalize();
        } else {
          axisWorld = new BABYLON.Vector3(0, 0, 1); // Default axis
        }
        travelWorld = angle; // radians
        originWorld = pair.sigA.center.clone(); // Use first state center as origin
      }

      const transformA = WorldSpace.getWorldMatrix(pair.sigA.node);
      const transformB = WorldSpace.getWorldMatrix(pair.sigB.node);

      detected.push({
        unitId,
        jointId,
        strokeCategory: pair.strokeCategory,
        translationRatio: pair.translationRatio,
        axisWorld,
        travelWorld,
        originWorld,
        isPrismatic: pair.jointType === 'prismatic',
        icpError: pair.error,
        nodeAId: this.nodeId(pair.sigA.node),
        nodeBId: this.nodeId(pair.sigB.node),
        transformA,
        transformB,
      });
    }

    return detected;
  }

  /**
   * Build geometry signatures for all candidate nodes in a UNIT.
   * Returns signatures for nodes with significant geometry.
   */
  private buildGeometrySignatures(
    unitNode: BABYLON.Node,
    unitId: string,
    minVolume: number,
    icpOpts: NonNullable<StructureBasedAnalyzeOptions['icpOptions']>
  ): Array<{
    node: BABYLON.TransformNode;
    unitId: string;
    vertexCount: number;
    extents: BABYLON.Vector3;
    center: BABYLON.Vector3;
    normExtents: BABYLON.Vector3;
  }> {
    const signatures: Array<{
      node: BABYLON.TransformNode;
      unitId: string;
      vertexCount: number;
      extents: BABYLON.Vector3;
      center: BABYLON.Vector3;
      normExtents: BABYLON.Vector3;
    }> = [];

    const visited = new Set<BABYLON.Node>();
    const MIN_VERTEX_COUNT = 20;

    const traverse = (node: BABYLON.Node, depth: number) => {
      if (depth > 5 || visited.has(node)) return;
      visited.add(node);

      if (!(node instanceof BABYLON.TransformNode)) {
        const children = this.getImmediateChildren(node);
        for (const child of children) {
          traverse(child, depth + 1);
        }
        return;
      }

      if (!this.hasSignificantGeometry(node, minVolume)) {
        const children = this.getImmediateChildren(node);
        for (const child of children) {
          traverse(child, depth + 1);
        }
        return;
      }

      const bbox = this.computeNodeBoundingBox(node);
      if (!bbox) {
        const children = this.getImmediateChildren(node);
        for (const child of children) {
          traverse(child, depth + 1);
        }
        return;
      }

      const extents = bbox.maximum.subtract(bbox.minimum);
      const volume = Math.abs(extents.x * extents.y * extents.z);
      if (volume < minVolume) {
        const children = this.getImmediateChildren(node);
        for (const child of children) {
          traverse(child, depth + 1);
        }
        return;
      }

      const pointCloud = this.sampleNodePointCloud(node, icpOpts);
      const vertexCount = pointCloud.length;

      if (vertexCount < MIN_VERTEX_COUNT) {
        const children = this.getImmediateChildren(node);
        for (const child of children) {
          traverse(child, depth + 1);
        }
        return;
      }

      const center = bbox.minimum.add(bbox.maximum).scale(0.5);
      const maxExtent = Math.max(Math.abs(extents.x), Math.abs(extents.y), Math.abs(extents.z));
      if (maxExtent < 1e-6) {
        const children = this.getImmediateChildren(node);
        for (const child of children) {
          traverse(child, depth + 1);
        }
        return;
      }

      const sortedExtents = [Math.abs(extents.x), Math.abs(extents.y), Math.abs(extents.z)].sort((a, b) => a - b);
      const normExtents = new BABYLON.Vector3(
        sortedExtents[0] / maxExtent,
        sortedExtents[1] / maxExtent,
        sortedExtents[2] / maxExtent
      );

      signatures.push({
        node,
        unitId,
        vertexCount,
        extents,
        center,
        normExtents,
      });

      const children = this.getImmediateChildren(node);
      for (const child of children) {
        traverse(child, depth + 1);
      }
    };

    traverse(unitNode, 0);
    return signatures;
  }

  /**
   * Group geometry signatures into families (same rigid body).
   * Members must have same vertex count and similar normalized extents.
   */
  private groupIntoFamilies(
    signatures: Array<{
      vertexCount: number;
      normExtents: BABYLON.Vector3;
      extents: BABYLON.Vector3;
      center: BABYLON.Vector3;
      node: BABYLON.TransformNode;
      unitId: string;
    }>,
    jointCfg: Required<NonNullable<StructureBasedAnalyzeOptions['jointDetectionConfig']>>,
    _debug: boolean
  ): Array<{
    members: typeof signatures;
    representative: typeof signatures[0];
  }> {
    const families: Array<{
      members: typeof signatures;
      representative: typeof signatures[0];
    }> = [];
    const used = new Set<number>();
    const EPSILON = jointCfg.geometryEpsilon;

    for (let i = 0; i < signatures.length; i++) {
      if (used.has(i)) continue;

      const sig = signatures[i];
      const family: typeof signatures = [sig];
      used.add(i);

      for (let j = i + 1; j < signatures.length; j++) {
        if (used.has(j)) continue;

        const other = signatures[j];

        if (sig.vertexCount !== other.vertexCount) continue;

        const dx = Math.abs(sig.normExtents.x - other.normExtents.x);
        const dy = Math.abs(sig.normExtents.y - other.normExtents.y);
        const dz = Math.abs(sig.normExtents.z - other.normExtents.z);

        if (dx > EPSILON || dy > EPSILON || dz > EPSILON) continue;

        family.push(other);
        used.add(j);
      }

      if (family.length >= 2) {
        families.push({
          members: family,
          representative: family[0],
        });
      }
    }

    return families;
  }

  /**
   * Cluster family members by transform into body instances.
   * Groups nodes at the same pose (same transform) to avoid pairing duplicates.
   * 
   * This handles cases where the same rigid body geometry exists multiple times
   * at exactly the same transform (bolts, subparts), which would give 0mm distances.
   * By clustering first, we pair instances (poses) rather than raw mesh nodes.
   */
  private clusterByTransform(
    family: {
      members: Array<{
        center: BABYLON.Vector3;
        extents: BABYLON.Vector3;
        node: BABYLON.TransformNode;
        unitId: string;
        vertexCount: number;
        normExtents: BABYLON.Vector3;
      }>;
      representative: typeof family.members[0];
    },
    jointCfg: Required<NonNullable<StructureBasedAnalyzeOptions['jointDetectionConfig']>>,
    debug: boolean
  ): Array<{
    members: typeof family.members;
    center: BABYLON.Vector3;
    extents: BABYLON.Vector3;
    worldMatrix: BABYLON.Matrix;
    representativeNode: BABYLON.TransformNode;
  }> {
    interface BodyInstance {
      members: typeof family.members;
      center: BABYLON.Vector3;
      extents: BABYLON.Vector3;
      worldMatrix: BABYLON.Matrix;
      representativeNode: BABYLON.TransformNode;
    }

    const instances: BodyInstance[] = [];
    const TRANSFORM_EPSILON_TRANSLATION = jointCfg.transformClusterPosEpsilon;
    const TRANSFORM_EPSILON_ROTATION = jointCfg.transformClusterRotEpsilonDeg;

    for (const member of family.members) {
      const memberMatrix = WorldSpace.getWorldMatrix(member.node);
      const memberTranslation = new BABYLON.Vector3();
      const memberRotation = new BABYLON.Quaternion();
      memberMatrix.decompose(new BABYLON.Vector3(), memberRotation, memberTranslation);

      let foundInstance = false;
      for (const instance of instances) {
        const instanceTranslation = new BABYLON.Vector3();
        const instanceRotation = new BABYLON.Quaternion();
        instance.worldMatrix.decompose(new BABYLON.Vector3(), instanceRotation, instanceTranslation);

        const translationDiff = BABYLON.Vector3.Distance(memberTranslation, instanceTranslation);
        const rotationDiff = Math.abs(2 * Math.acos(Math.max(-1, Math.min(1, 
          BABYLON.Quaternion.Dot(memberRotation, instanceRotation)
        )))) * (180 / Math.PI);

        if (translationDiff < TRANSFORM_EPSILON_TRANSLATION && rotationDiff < TRANSFORM_EPSILON_ROTATION) {
          instance.members.push(member);
          foundInstance = true;
          break;
        }
      }

      if (!foundInstance) {
        instances.push({
          members: [member],
          center: member.center.clone(),
          extents: member.extents.clone(),
          worldMatrix: memberMatrix,
          representativeNode: member.node,
        });
      }
    }

    if (debug && instances.length < family.members.length) {
      console.log(`[FAMILY_BUILD] Clustered ${family.members.length} members into ${instances.length} instances`);
    }

    return instances;
  }

  /**
   * Pair body instances by spatial proximity (greedy closest-pair).
   * 
   * Works on instances (clustered by transform) rather than raw nodes to avoid
   * pairing same-pose duplicates. Each instance represents one physical pose
   * of a rigid body, regardless of how many mesh nodes share that transform.
   */
  private pairBySpatialProximity(
    family: {
      members: Array<{
        center: BABYLON.Vector3;
        extents: BABYLON.Vector3;
        node: BABYLON.TransformNode;
        unitId: string;
        vertexCount: number;
        normExtents: BABYLON.Vector3;
      }>;
      representative: typeof family.members[0];
    },
    jointCfg: Required<NonNullable<StructureBasedAnalyzeOptions['jointDetectionConfig']>>,
    debug: boolean
  ): Array<{
    a: typeof family.members[0];
    b: typeof family.members[0];
    distance: number;
  }> {
    // Step 1: Cluster members by transform into instances
    const instances = this.clusterByTransform(family, jointCfg, debug);
    if (instances.length < 2) {
      return [];
    }

    // Step 2: Build candidate pairs from instances
    interface CandidatePair {
      instanceA: number;
      instanceB: number;
      distance: number;
    }

    const candidates: CandidatePair[] = [];
    const bodySize = family.representative.extents.length();
    const maxCenterDistance = bodySize * jointCfg.maxCenterDistanceFactor;
    const minCenterDistance = Math.max(bodySize * jointCfg.minCenterDistanceFactor, 0.0005);

    for (let i = 0; i < instances.length; i++) {
      for (let j = i + 1; j < instances.length; j++) {
        const dist = BABYLON.Vector3.Distance(instances[i].center, instances[j].center);
        if (dist >= minCenterDistance && dist <= maxCenterDistance) {
          candidates.push({ instanceA: i, instanceB: j, distance: dist });
        }
      }
    }

    // Step 3: Greedy disjoint pairing (no per-family cap)
    // Each instance can appear in at most one pair, which naturally prevents impossible
    // "multi-state" reuse for a single physical body. Joint count is determined by
    // quality filters in classifyJointPair, not hard caps.
    candidates.sort((a, b) => a.distance - b.distance);

    const pairs: Array<{
      a: typeof family.members[0];
      b: typeof family.members[0];
      distance: number;
    }> = [];

    const usedInstances = new Set<number>();

    for (const candidate of candidates) {
      if (usedInstances.has(candidate.instanceA)) continue;
      if (usedInstances.has(candidate.instanceB)) continue;

      pairs.push({
        a: instances[candidate.instanceA].members[0],
        b: instances[candidate.instanceB].members[0],
        distance: candidate.distance,
      });

      usedInstances.add(candidate.instanceA);
      usedInstances.add(candidate.instanceB);

      if (debug) {
        console.log(`[PAIR_DIST] Instance pair distance: ${(candidate.distance * 1000).toFixed(1)}mm (max: ${(maxCenterDistance * 1000).toFixed(1)}mm)`);
      }
    }

    return pairs;
  }

  /**
   * Classify delta transform (Δ = M_moving * inverse(M_fixed)) into revolute or prismatic.
   * 
   * Algorithm:
   * 1. Compute delta = moving * inverse(fixed) (transform from retracted → advanced pose)
   * 2. Decompose into translation, rotation (quaternion), and scale
   * 3. Extract rotation axis and angle from quaternion
   * 4. Classify based on translation/rotation dominance:
   *    - Prismatic: significant translation, minimal rotation
   *    - Revolute: significant rotation, translation relatively small
   * 
   * This is the single source of truth for matrix decomposition and joint classification.
   * Handles NaN checks and normalization with guard clauses.
   */
  private classifyDelta(
    refTransform: BABYLON.Matrix,
    movingTransform: BABYLON.Matrix,
    bodySize: number,
    cfg: Required<NonNullable<StructureBasedAnalyzeOptions['jointDetectionConfig']>>,
    icpOpts: NonNullable<StructureBasedAnalyzeOptions['icpOptions']>
  ): JointDeltaClassification | undefined {
    // Guard: Check for singular matrix (determinant near zero)
    const refDet = refTransform.determinant();
    if (Math.abs(refDet) < 1e-9) {
      return undefined;
    }
    
    // Compute delta = moving * inverse(ref)
    // This represents: "how to transform from retracted pose to advanced pose"
    const invRef = refTransform.clone();
    invRef.invert();
    const delta = movingTransform.multiply(invRef);

    // Extract translation
    const translation = new BABYLON.Vector3();
    const rotation = new BABYLON.Quaternion();
    const scale = new BABYLON.Vector3();
    delta.decompose(scale, rotation, translation);

    // Guard: Check for invalid transforms
    if (!Number.isFinite(translation.x) || !Number.isFinite(translation.y) || !Number.isFinite(translation.z)) {
      return undefined;
    }

    const translationMagnitude = translation.length();
    
    // Note: Zero or very small translation is valid for pure rotation (revolute joints)
    // We'll check motion significance later in classification

    // Extract rotation axis and angle from quaternion
    const w = Math.max(-1, Math.min(1, rotation.w)); // Clamp to valid range
    const rotationAngleRad = Math.abs(2 * Math.acos(w));
    const rotationAngleDeg = rotationAngleRad * (180 / Math.PI);

    // Guard: Check for invalid rotation
    if (!Number.isFinite(rotationAngleDeg)) {
      return undefined;
    }

    const sinHalfAngle = Math.sin(rotationAngleRad / 2);
    let rotationAxis: BABYLON.Vector3;
    if (Math.abs(sinHalfAngle) > 1e-6) {
      rotationAxis = new BABYLON.Vector3(
        rotation.x / sinHalfAngle,
        rotation.y / sinHalfAngle,
        rotation.z / sinHalfAngle
      ).normalize();
    } else {
      // Near-zero rotation, use default axis
      rotationAxis = new BABYLON.Vector3(0, 0, 1);
    }

    // Guard: Check for invalid axis
    if (!Number.isFinite(rotationAxis.x) || !Number.isFinite(rotationAxis.y) || !Number.isFinite(rotationAxis.z)) {
      return undefined;
    }

    // Compute translation ratio
    const epsilonBodySize = Math.max(bodySize, 1e-6);
    const translationRatio = translationMagnitude / epsilonBodySize;

    // Classify joint type
    // Prismatic: primarily translation, minimal rotation
    // Revolute: primarily rotation, translation can be present but should be small relative to rotation
    const minRotationDeg = icpOpts.minRotation ?? 1.0;
    const minTranslation = icpOpts.minTranslation ?? 0.01;
    
    // Prismatic: significant translation, minimal rotation
    const isPrismatic = translationMagnitude >= minTranslation && rotationAngleDeg < minRotationDeg;
    
    // Revolute: significant rotation within valid range
    // Translation can be present (clamp center moves) but rotation should dominate
    const hasSignificantRotation = rotationAngleDeg >= minRotationDeg && 
                                   rotationAngleDeg >= cfg.minRotationAngleDeg &&
                                   rotationAngleDeg <= cfg.maxRotationAngleDeg;
    
    // For revolute, rotation should be significant
    // Translation can be present but should be reasonable (allow up to 2x body size for clamp motion)
    const isRevolute = hasSignificantRotation && translationRatio < 2.0;

    // Guard: Must be either prismatic or revolute
    if (!isPrismatic && !isRevolute) {
      return undefined;
    }

    // Determine stroke category
    const strokeCategory: 'normal' | 'longStroke' = translationRatio <= cfg.maxTranslationFactorNormal ? 'normal' : 'longStroke';

    return {
      isPrismatic,
      translation,
      translationMagnitude,
      rotationAxis,
      rotationAngleRad,
      rotationAngleDeg,
      translationRatio,
      strokeCategory,
    };
  }

  /**
   * Classify a joint pair using matrix + ICP.
   */
  private async classifyJointPair(
    sigA: {
      node: BABYLON.TransformNode;
      center: BABYLON.Vector3;
      extents: BABYLON.Vector3;
    },
    sigB: {
      node: BABYLON.TransformNode;
      center: BABYLON.Vector3;
      extents: BABYLON.Vector3;
    },
    icpOpts: NonNullable<StructureBasedAnalyzeOptions['icpOptions']>,
    jointCfg: Required<NonNullable<StructureBasedAnalyzeOptions['jointDetectionConfig']>>,
    debug: boolean
  ): Promise<{
    transform: BABYLON.Matrix;
    error: number;
    jointType: 'revolute' | 'prismatic';
    translationMag: number;
    rotationAngle: number;
  } | null> {
    // Use classifyDelta for canonical matrix decomposition and classification
    const MA = WorldSpace.getWorldMatrix(sigA.node);
    const MB = WorldSpace.getWorldMatrix(sigB.node);
    const bodySize = Math.max(sigA.extents.length(), sigB.extents.length());
    
    // Compute initial delta for early filtering (don't require perfect classification yet)
    // We'll use ICP results for final classification
    const invMA = MA.clone();
    invMA.invert();
    const T_AB = MB.multiply(invMA);
    
    const translation = new BABYLON.Vector3();
    const rotation = new BABYLON.Quaternion();
    T_AB.decompose(new BABYLON.Vector3(), rotation, translation);
    
    const translationMag = translation.length();
    const rotationAngle = Math.abs(2 * Math.acos(Math.max(-1, Math.min(1, rotation.w)))) * (180 / Math.PI);
    
    // Early rejection: both translation and rotation negligible
    const hasSignificantMotion = translationMag >= 1e-6 || rotationAngle >= 0.1;
    if (!hasSignificantMotion) {
      if (debug) {
        console.log('[MATRIX_FILTER] Rejected: transform too small (no significant motion)');
      }
      return null;
    }
    
    // Early rejection: translation too large relative to body size
    if (translationMag > bodySize * jointCfg.maxTranslationFactor) {
      if (debug) {
        console.log(`[MATRIX_FILTER] Rejected: translation too large (${(translationMag * 1000).toFixed(1)}mm vs body size ${(bodySize * 1000).toFixed(1)}mm)`);
      }
      return null;
    }
    
    // Use classifyDelta for initial classification (for logging/debugging)
    const delta = this.classifyDelta(MA, MB, bodySize, jointCfg, icpOpts);

    if (debug) {
      const deltaType = delta ? (delta.isPrismatic ? 'prismatic' : 'revolute') : 'unknown';
      console.log(`[MATRIX_FILTER] Translation: ${(translationMag * 1000).toFixed(1)}mm, Rotation: ${rotationAngle.toFixed(1)}°, Initial type: ${deltaType}`);
    }

    const pointCloudA = this.sampleNodePointCloud(sigA.node, {
      ...icpOpts,
      minPoints: Math.max(icpOpts.minPoints ?? 20, 20),
      maxSamplePoints: Math.min(icpOpts.maxSamplePoints ?? 500, 500),
      sampleStride: Math.max(icpOpts.sampleStride ?? 3, 3),
    });

    const pointCloudB = this.sampleNodePointCloud(sigB.node, {
      ...icpOpts,
      minPoints: Math.max(icpOpts.minPoints ?? 20, 20),
      maxSamplePoints: Math.min(icpOpts.maxSamplePoints ?? 500, 500),
      sampleStride: Math.max(icpOpts.sampleStride ?? 3, 3),
    });

    if (pointCloudA.length < (icpOpts.minPoints ?? 20) || pointCloudB.length < (icpOpts.minPoints ?? 20)) {
      if (debug) {
        console.log(`[ICP_RUN] Rejected: insufficient points (${pointCloudA.length}, ${pointCloudB.length})`);
      }
      return null;
    }

    if (debug) {
      console.log(`[ICP_RUN] Running ICP with ${pointCloudA.length} vs ${pointCloudB.length} points`);
    }

    const icpResult = await PCLICPSolver.align(pointCloudA, pointCloudB, {
      maxIterations: 30,
      errorTolerance: 1e-4,
      enableDebug: false,
    });

    if (debug) {
      console.log(`[ICP_RUN] ICP error: ${icpResult.error.toFixed(6)}, iterations: ${icpResult.iterations}`);
    }

    const maxError = icpOpts.maxICPError ?? 0.15;
    if (icpResult.error > maxError) {
      if (debug) {
        console.log(`[ICP_REJECT] Error too high: ${icpResult.error.toFixed(6)} (max: ${maxError})`);
      }
      return null;
    }

    // Use classifyDelta on ICP result for consistent classification
    // ICP result.transform is the transform from A to B (same as delta = MB * inv(MA))
    // To use classifyDelta, we need: refTransform (MA) and movingTransform (MB)
    // Since ICP result is approximately MB * inv(MA), we can compute MB ≈ icpResult.transform * MA
    const MB_refined = icpResult.transform.multiply(MA);
    const icpDelta = this.classifyDelta(MA, MB_refined, bodySize, jointCfg, icpOpts);
    
    if (!icpDelta) {
      if (debug) {
        console.log('[ICP_REJECT] ICP result failed classifyDelta validation');
      }
      return null;
    }

    // Validate ICP result matches initial classification
    // For revolute joints, rotation should be in valid range
    if (!icpDelta.isPrismatic) {
      // Revolute joint: check rotation angle is in valid range
      if (icpDelta.rotationAngleDeg < jointCfg.minRotationAngleDeg) {
        if (debug) {
          console.log(`[ICP_REJECT] Revolute joint rotation angle too small: ${icpDelta.rotationAngleDeg.toFixed(1)}° (min: ${jointCfg.minRotationAngleDeg}°)`);
        }
        return null;
      }
      if (icpDelta.rotationAngleDeg > jointCfg.maxRotationAngleDeg) {
        if (debug) {
          console.log(`[ICP_REJECT] Revolute joint rotation angle too large: ${icpDelta.rotationAngleDeg.toFixed(1)}° (max: ${jointCfg.maxRotationAngleDeg}°)`);
        }
        return null;
      }
    }

    // Check translation is within physical limits
    if (icpDelta.translationMagnitude > (icpOpts.maxTranslation ?? 2.0)) {
      if (debug) {
        console.log(`[ICP_REJECT] Translation too large: ${(icpDelta.translationMagnitude * 1000).toFixed(1)}mm`);
      }
      return null;
    }

    if (debug) {
      console.log(`[ICP_OK] Joint classified as ${icpDelta.isPrismatic ? 'prismatic' : 'revolute'}`);
    }

    return {
      transform: icpResult.transform,
      error: icpResult.error,
      jointType: icpDelta.isPrismatic ? 'prismatic' : 'revolute',
      translationMag: icpDelta.translationMagnitude,
      rotationAngle: icpDelta.rotationAngleDeg,
    };
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
  // @ts-ignore - Unused but kept for potential future use
  private isPureTranslation(transform: BABYLON.Matrix, icpOpts: NonNullable<StructureBasedAnalyzeOptions['icpOptions']>): boolean {
    const rotationAngle = this.extractRotationAngle(transform);
    const translationMag = this.extractTranslationMagnitude(transform);
    return translationMag >= (icpOpts.minTranslation ?? 0.01) && rotationAngle < (icpOpts.minRotation ?? 1.0);
  }

  /**
   * Check if transformation is primarily rotation (not translation).
   */
  // @ts-ignore - Unused but kept for potential future use
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
  // @ts-ignore - Unused but kept for potential future use
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

  /**
   * Cluster unit candidates into mechanical units based on spatial proximity, AABB overlap, and hierarchy.
   * Groups related candidates (e.g., sub-assemblies) into single mechanical units.
   */
  private clusterUnits(
    candidates: Array<{
      unit: ToolUnit;
      node: BABYLON.Node;
      center: BABYLON.Vector3;
      extent: BABYLON.Vector3;
      aabb: { min: BABYLON.Vector3; max: BABYLON.Vector3 };
    }>,
    clustering: { maxCenterDistanceFactor: number; minOverlapRatio: number },
    debug: boolean = false
  ): Array<{
    unit: ToolUnit;
    node: BABYLON.Node;
    center: BABYLON.Vector3;
    extent: BABYLON.Vector3;
    aabb: { min: BABYLON.Vector3; max: BABYLON.Vector3 };
  }> {
    if (candidates.length <= 0) return [];

    // Sort candidates by center position (stable ordering)
    const sorted = [...candidates].sort((a, b) => {
      if (Math.abs(a.center.x - b.center.x) > 1e-6) return a.center.x - b.center.x;
      if (Math.abs(a.center.y - b.center.y) > 1e-6) return a.center.y - b.center.y;
      return a.center.z - b.center.z;
    });

    interface Cluster {
      members: typeof candidates;
      primary: typeof candidates[0];
    }

    const clusters: Cluster[] = [];

    for (const candidate of sorted) {
      let assigned = false;

      for (const cluster of clusters) {
        const primary = cluster.primary;
        
        // Compute metrics once
        const centerDist = BABYLON.Vector3.Distance(candidate.center, primary.center);
        const combinedBodySize = Math.max(
          candidate.extent.length(),
          primary.extent.length(),
          1e-6
        );
        const distFactor = centerDist / combinedBodySize;
        const overlapRatio = this.computeAabbOverlapRatio(candidate.aabb, primary.aabb);
        
        // Check hierarchy relationship
        const candidateParent = candidate.node.parent;
        const primaryParent = primary.node.parent;
        const shareParent = candidateParent !== null && 
                           primaryParent !== null && 
                           candidateParent === primaryParent;
        
        // Default stance: NO CLUSTERING unless all conditions are met
        // We require VERY high overlap AND very close distance
        // Use config values but interpret them conservatively
        
        // Conservative clustering: require BOTH high overlap AND small distance
        // Use config values but interpret strictly to avoid over-clustering
        // For GEO: sub-assemblies have very high overlap (>95%) and are very close
        // For 1E1_LH: units are separate, so overlap is lower or distance is larger
        
        // Use config values with strict interpretation: require BOTH high overlap AND small distance
        // Config defaults are balanced (95% overlap, 0.03x distance)
        // This prevents over-clustering separate units (1E1_LH case)
        // But allows true sub-assemblies to cluster (GEO case)
        
        // For shared parent case, be very slightly more lenient (sub-assemblies often share parent)
        // But still extremely conservative to prevent over-clustering
        const minOverlapRequired = shareParent 
          ? Math.max(clustering.minOverlapRatio * 0.998, 0.985) // Very slightly lower for shared parent (98.5% vs 99%)
          : clustering.minOverlapRatio; // Use full config value (99%)
        
        const maxDistFactor = shareParent
          ? clustering.maxCenterDistanceFactor * 1.05 // Very slightly more lenient for shared parent (0.00525x vs 0.005x)
          : clustering.maxCenterDistanceFactor; // Use config value (0.005x)
        
        // Only merge if BOTH conditions are met: high overlap AND small distance
        const shouldMerge = overlapRatio >= minOverlapRequired && distFactor <= maxDistFactor;
        
        if (debug) {
          console.log(
            `[CLUSTER] ${candidate.unit.id} vs ${primary.unit.id}: ` +
            `dist=${(centerDist * 1000).toFixed(1)}mm, distFactor=${distFactor.toFixed(3)}x, ` +
            `overlap=${(overlapRatio * 100).toFixed(1)}%, shareParent=${shareParent}, ` +
            `maxDistFactor=${maxDistFactor.toFixed(3)}x, shouldMerge=${shouldMerge}`
          );
        }
        
        if (shouldMerge) {
          if (debug) {
            console.log(`[CLUSTER] ✓ Clustered ${candidate.unit.id} with ${primary.unit.id} (overlap ${(overlapRatio * 100).toFixed(1)}% + dist ${distFactor.toFixed(3)}x)`);
          }
          cluster.members.push(candidate);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        clusters.push({
          members: [candidate],
          primary: candidate,
        });
      }
    }

    // For each cluster, choose primary candidate (largest extent)
    const primaries: typeof candidates = [];
    for (const cluster of clusters) {
      let primary = cluster.primary;
      for (const member of cluster.members) {
        const memberSize = member.extent.length();
        const primarySize = primary.extent.length();
        if (memberSize > primarySize) {
          primary = member;
        }
      }
      primaries.push(primary);
    }

    return primaries;
  }

  /**
   * Compute AABB overlap ratio (intersection volume / min(volumeA, volumeB)).
   */
  private computeAabbOverlapRatio(
    aabbA: { min: BABYLON.Vector3; max: BABYLON.Vector3 },
    aabbB: { min: BABYLON.Vector3; max: BABYLON.Vector3 }
  ): number {
    const minX = Math.max(aabbA.min.x, aabbB.min.x);
    const minY = Math.max(aabbA.min.y, aabbB.min.y);
    const minZ = Math.max(aabbA.min.z, aabbB.min.z);
    const maxX = Math.min(aabbA.max.x, aabbB.max.x);
    const maxY = Math.min(aabbA.max.y, aabbB.max.y);
    const maxZ = Math.min(aabbA.max.z, aabbB.max.z);

    if (minX >= maxX || minY >= maxY || minZ >= maxZ) return 0;

    const intersectionVol = Math.abs((maxX - minX) * (maxY - minY) * (maxZ - minZ));
    const volA = Math.abs(
      (aabbA.max.x - aabbA.min.x) * (aabbA.max.y - aabbA.min.y) * (aabbA.max.z - aabbA.min.z)
    );
    const volB = Math.abs(
      (aabbB.max.x - aabbB.min.x) * (aabbB.max.y - aabbB.min.y) * (aabbB.max.z - aabbB.min.z)
    );

    const minVol = Math.min(volA, volB);
    if (minVol < 1e-9) return 0;

    return intersectionVol / minVol;
  }

  /**
   * Log units summary (toggleable via KINETICORE_FX_DEBUG=1).
   */
  private logUnitsSummary(snapshot: AnalyzerDebugSnapshot): void {
    if (FX_DEBUG_ENABLED !== true) return;

    console.groupCollapsed(`[FX_DEBUG] Units Summary: ${snapshot.fixtureId}`);
    console.log(`Total units: ${snapshot.totalUnits}, Total joints: ${snapshot.totalJoints}`);
    
    for (const unit of snapshot.units) {
      const aabbSize = unit.worldAabb.max.subtract(unit.worldAabb.min);
      const sizeStr = `(${(aabbSize.x * 1000).toFixed(1)}, ${(aabbSize.y * 1000).toFixed(1)}, ${(aabbSize.z * 1000).toFixed(1)})mm`;
      console.log(
        `  Unit ${unit.id}: ${sizeStr}, ` +
        `${unit.childNodeCount} children, ${unit.jointCount} joints`
      );
    }
    
    console.groupEnd();
  }

  /**
   * Log joints summary (toggleable via KINETICORE_FX_DEBUG=1).
   */
  private logJointsSummary(joints: DetectedToolJoint[], fixtureId: string): void {
    if (FX_DEBUG_ENABLED !== true) return;

    console.groupCollapsed(`[FX_DEBUG] Joints Summary: ${fixtureId}`);
    console.log(`Total joints: ${joints.length}`);
    
    for (const joint of joints) {
      const travelStr = joint.isPrismatic
        ? `${(joint.travelWorld * 1000).toFixed(1)}mm`
        : `${(joint.travelWorld * (180 / Math.PI)).toFixed(1)}°`;
      console.log(
        `  ${joint.jointId} (${joint.unitId}): ` +
        `${joint.isPrismatic ? 'prismatic' : 'revolute'}, ` +
        `travel=${travelStr}, ` +
        `transRatio=${joint.translationRatio.toFixed(2)}x, ` +
        `icpError=${(joint.icpError * 1000).toFixed(1)}mm, ` +
        `category=${joint.strokeCategory}`
      );
    }
    
    console.groupEnd();
  }
}



