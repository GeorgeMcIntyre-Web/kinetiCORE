import * as BABYLON from '@babylonjs/core';
import { GeometricToolAnalyzer, type GeometricAnalyzeOptions } from '../sceneAnalysis/GeometricToolAnalyzer';
import { NameBasedToolAnalyzer, type NameBasedAnalyzeOptions } from '../sceneAnalysis/NameBasedToolAnalyzer';
import { GeometryBasedToolAnalyzer, type GeometryBasedAnalyzeOptions } from '../sceneAnalysis/GeometryBasedToolAnalyzer';
import type { ToolGraph, ToolUnit } from '../sceneAnalysis/ToolGraphAnalyzer';
import { StateCapture, type CapturedStateSnapshot } from '../stateCapture/StateCapture';
import { ICP, type ICPOptions, type ICPResult } from '../pointCloud/ICP';
import {
  extractJointFromTransform,
  convertToJointDefinition,
  type JointFitResult,
  type JointExtractionOptions,
} from '../pointCloud/JointExtractor';
import type {
  JointDefinitionOutput,
  ActuatorProgramOutput,
  KinematicModelExport,
} from '../io/Schemas';
import { FastNodeFilter, type FilterOptions, type NodePair } from './FastNodeFilter';
import { PCLICPSolver } from '../pointCloud/PCLICPSolver';
import { SceneTreeManager } from '../../scene/SceneTreeManager';

/**
 * Configuration for the complete kinematic extraction pipeline.
 */
export interface PipelineOptions {
  /** Analysis method: 'geometry-based' (ICP matching - ROBUST), 'name-based' (string matching - BRITTLE), or 'geometric' (heuristic - FALLBACK) */
  analysisMethod?: 'geometry-based' | 'name-based' | 'geometric';

  /** Geometric analysis options (used when analysisMethod = 'geometric') */
  geometric?: GeometricAnalyzeOptions;

  /** Name-based analysis options (used when analysisMethod = 'name-based') */
  nameBased?: NameBasedAnalyzeOptions;

  /** Geometry-based analysis options (used when analysisMethod = 'geometry-based') */
  geometryBased?: GeometryBasedAnalyzeOptions;

  /** ICP alignment options */
  icp?: ICPOptions;

  /** Joint extraction options */
  jointExtraction?: JointExtractionOptions;

  /** State capture options */
  stateCapture?: {
    /** Sample mesh vertices for point cloud */
    samplePoints?: boolean;
    /** Vertex sampling stride (1 = every vertex, 2 = every other, etc.) */
    stride?: number;
    /** Maximum points per mesh */
    maxPoints?: number;
  };

  /** Joint limit safety factor (e.g., 1.2 = 20% margin) */
  limitSafetyFactor?: number;

  /**
   * Minimum confidence threshold to include a joint in output.
   * Range: 0-1, default: 0.5
   */
  minConfidence?: number;

  /**
   * Fast node filtering options (multi-stage ICP-based filtering).
   * Enables early rejection of invalid node pairs for performance.
   */
  fastFiltering?: FilterOptions;

  /**
   * Use professional ICP solver (icpts) instead of custom ICP.
   * Recommended for production use (cascaded registration from ModelAnalyzer3D).
   */
  useProfessionalICP?: boolean;
}

const DEFAULT_PIPELINE_OPTIONS: Required<PipelineOptions> = {
  analysisMethod: 'geometric',
  geometric: {},
  nameBased: {},
  geometryBased: {},
  icp: {
    enableDebug: true, // Enable detailed ICP debugging by default
  },
  jointExtraction: {},
  stateCapture: {
    samplePoints: true,
    stride: 10,
    maxPoints: 1000,
  },
  limitSafetyFactor: 1.1,
  minConfidence: 0.5,
  fastFiltering: {
    minPoints: 50,
    maxCentroidDistance: 2.0, // 2m for automotive tooling
    minCentroidDistance: 0.001, // 1mm minimum motion
    bypassGeometricFilter: false, // Set to true for testing static GLB files
    coarsePointCount: 100,
    coarseMaxIterations: 20,
    coarseErrorMin: 0.001, // Below = no motion
    coarseErrorMax: 0.5, // Above = bad correspondence
    fullMaxIterations: 200,
    fullErrorTolerance: 1e-7,
    translationRange: { min: 0.01, max: 2.0 }, // 10mm - 2m
    rotationRange: { min: 1.0, max: 180.0 }, // 1° - 180°
    enableDebug: true,
  },
  useProfessionalICP: true, // Use icpts by default (ModelAnalyzer3D proven)
};

/**
 * State captured for a single tool unit.
 */
interface UnitStatePair {
  unit: ToolUnit;
  retracted: CapturedStateSnapshot;
  extended: CapturedStateSnapshot;
}

/**
 * Result of ICP alignment for a single unit.
 */
interface UnitICPResult {
  unit: ToolUnit;
  icpResult: ICPResult;
  jointFit: JointFitResult;
}

/**
 * Complete kinematic extraction pipeline orchestrator.
 *
 * Connects all components to automate the workflow:
 * 1. Geometric scene analysis → identify fixed/moving units
 * 2. State capture → sample point clouds in retracted/extended poses
 * 3. ICP alignment → compute transform between states
 * 4. Joint extraction → infer joint type, axis, anchor from transform
 * 5. JSON export → generate tooling JSON with joint definitions
 *
 * **Usage Pattern:**
 * ```typescript
 * const pipeline = new KinematicExtractionPipeline(scene);
 *
 * // Step 1: Analyze scene
 * await pipeline.analyzeScene();
 *
 * // Step 2: Manually position tool units in retracted state
 * // (user interaction or API calls)
 * await pipeline.captureRetractedStates();
 *
 * // Step 3: Manually position tool units in extended state
 * // (user interaction or API calls)
 * await pipeline.captureExtendedStates();
 *
 * // Step 4: Fit joints automatically
 * await pipeline.fitJoints();
 *
 * // Step 5: Export to JSON
 * const json = pipeline.exportToJSON();
 * ```
 *
 * @example
 * ```typescript
 * // Complete workflow in one call
 * const pipeline = new KinematicExtractionPipeline(scene);
 * const model = await pipeline.runComplete({
 *   geometric: { clusteringDistance: 0.1 },
 *   minConfidence: 0.7
 * });
 *
 * console.log(`Extracted ${model.joints.length} joints`);
 * const json = JSON.stringify(model, null, 2);
 * ```
 */
export class KinematicExtractionPipeline {
  private scene: BABYLON.Scene;
  private geometricAnalyzer: GeometricToolAnalyzer;
  private nameBasedAnalyzer: NameBasedToolAnalyzer;
  private geometryBasedAnalyzer: GeometryBasedToolAnalyzer;
  private stateCapture: StateCapture;

  private toolGraph: ToolGraph | null = null;
  private statePairs: Map<string, UnitStatePair> = new Map();
  private icpResults: Map<string, UnitICPResult> = new Map();

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.geometricAnalyzer = new GeometricToolAnalyzer();
    this.nameBasedAnalyzer = new NameBasedToolAnalyzer();
    this.geometryBasedAnalyzer = new GeometryBasedToolAnalyzer();
    this.stateCapture = new StateCapture();
  }

  /**
   * Step 1: Analyze scene to identify tool units.
   *
   * @param options - Analysis options (supports both geometric and name-based methods)
   * @param rootNode - Root node to analyze (required for name-based analysis)
   * @returns ToolGraph with identified units
   *
   * @example
   * ```typescript
   * // Name-based analysis (recommended for automotive GLB files)
   * await pipeline.analyzeScene({ analysisMethod: 'name-based' }, rootNode);
   *
   * // Geometric analysis (fallback for unknown structures)
   * await pipeline.analyzeScene({ analysisMethod: 'geometric', geometric: { ... } }, rootNode);
   * ```
   */
  async analyzeScene(options?: PipelineOptions | GeometricAnalyzeOptions, rootNode?: BABYLON.Node): Promise<ToolGraph> {
    console.log('[Pipeline] Step 1: Analyzing scene for tool units...');

    // Support both old (GeometricAnalyzeOptions) and new (PipelineOptions) signatures
    const pipelineOpts: PipelineOptions = (options as any)?.analysisMethod
      ? (options as PipelineOptions)
      : { analysisMethod: 'geometric', geometric: options as GeometricAnalyzeOptions };

    const method = pipelineOpts.analysisMethod || 'geometric';

    if (method === 'geometry-based') {
      if (!rootNode) {
        throw new Error('[Pipeline] Geometry-based analysis requires a rootNode parameter');
      }

      console.log(`[Pipeline] Using geometry-based analyzer (ICP matching - ROBUST)`);
      this.toolGraph = await this.geometryBasedAnalyzer.analyze(
        this.scene,
        rootNode,
        pipelineOpts.geometryBased
      );
    } else if (method === 'name-based') {
      if (!rootNode) {
        throw new Error('[Pipeline] Name-based analysis requires a rootNode parameter');
      }

      console.log(`[Pipeline] Using name-based analyzer (automotive GLB structure - BRITTLE)`);
      this.toolGraph = this.nameBasedAnalyzer.analyze(
        this.scene,
        rootNode,
        pipelineOpts.nameBased
      );
    } else {
      console.log(`[Pipeline] Using geometric analyzer (heuristic-based - FALLBACK)`);
      this.toolGraph = this.geometricAnalyzer.analyze(
        this.scene,
        pipelineOpts.geometric,
        rootNode
      );
    }

    const fixed = this.toolGraph.units.filter(u => u.isFixed);
    const moving = this.toolGraph.units.filter(u => !u.isFixed);

    console.log(
      `[Pipeline] Analysis complete: ${this.toolGraph.units.length} units ` +
      `(${fixed.length} fixed, ${moving.length} moving)`
    );

    // DEBUG: Log SceneTree structure to verify node mappings
    console.log('[Pipeline] ===== SCENE TREE STRUCTURE =====');
    const tree = SceneTreeManager.getInstance();

    // First, log how many nodes are in SceneTree total
    console.log(`[Pipeline] SceneTree has ${tree.getAllNodes().length} total nodes`);

    for (const unit of this.toolGraph.units) {
      // Enhanced debug logging
      console.log(`[Pipeline] Checking unit: ${unit.name}, root: ${unit.root}`);

      // Try to find the Babylon node first
      const uid = parseInt(unit.root, 10);
      const babylonNode = !isNaN(uid) ? this.scene.getTransformNodeByUniqueId(uid) : null;

      if (babylonNode) {
        console.log(`  - ✓ Babylon TransformNode found: ${babylonNode.name} (uniqueId: ${babylonNode.uniqueId})`);
      } else {
        console.error(`  - ❌ Babylon TransformNode NOT found for uniqueId: ${unit.root}`);
      }

      const sceneNode = tree.getNodeByBabylonTransformNodeId(unit.root);
      if (!sceneNode) {
        console.error(`[Pipeline] ❌ Unit ${unit.name} not found in SceneTree!`);
        console.error(`  - Looking for babylonTransformNodeId: ${unit.root}`);

        // Try to find by name as a fallback diagnostic
        const allNodes = tree.getAllNodes();
        const nodesByName = allNodes.filter(n => n.name.includes(unit.name) || unit.name.includes(n.name));

        if (nodesByName.length > 0) {
          console.log(`  - Found ${nodesByName.length} nodes with similar names:`);
          nodesByName.forEach(n => {
            console.log(`    - "${n.name}" (id: ${n.id}, babylonTransformNodeId: ${n.babylonTransformNodeId || 'NONE'})`);
          });
        } else {
          console.log(`  - No nodes found with similar names to "${unit.name}"`);
        }

        continue;
      }

      console.log(`[Pipeline] Unit: ${unit.name}`);
      console.log(`  - SceneTree ID: ${sceneNode.id}`);
      console.log(`  - babylonTransformNodeId: ${sceneNode.babylonTransformNodeId || '❌ MISSING'}`);
      console.log(`  - babylonMeshId: ${sceneNode.babylonMeshId || 'N/A'}`);
      console.log(`  - Parent: ${sceneNode.parentId || 'N/A'}`);
      console.log(`  - Children: ${sceneNode.childIds.length}`);

      // Show parent and sibling info
      if (sceneNode.parentId) {
        const parent = tree.getNode(sceneNode.parentId);
        if (parent) {
          console.log(`  - Parent name: ${parent.name}`);
          console.log(`  - Siblings count: ${parent.childIds.length - 1}`);

          // Show sibling names (useful for finding FIXED/MOVING pairs)
          const siblings = parent.childIds
            .map(id => tree.getNode(id))
            .filter(n => n && n.id !== sceneNode.id);

          if (siblings.length > 0) {
            console.log(`  - Sibling names: ${siblings.map(s => s?.name).join(', ')}`);
          }
        }
      }
    }
    console.log('[Pipeline] ===== END SCENE TREE =====');

    // DEBUG: Per-unit geometry overview (origins and bounding boxes)
    for (const unit of this.toolGraph.units) {
      // Resolve root transform node
      const uid = parseInt(unit.root, 10);
      const rootTn = !isNaN(uid) ? this.scene.getTransformNodeByUniqueId(uid) : null;
      if (!rootTn) {
        console.warn(`[Pipeline][DEBUG] Unit '${unit.name}': root TransformNode not found for uid=${unit.root}`);
        continue;
      }

      // World origin of unit root
      rootTn.computeWorldMatrix(true);
      const rootPos = rootTn.getAbsolutePosition();

      // Collect child meshes and compute combined world-space bounding box
      const meshes = rootTn.getChildMeshes(false) as BABYLON.AbstractMesh[];
      let min = new BABYLON.Vector3(+Infinity, +Infinity, +Infinity);
      let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
      for (const m of meshes) {
        m.computeWorldMatrix(true);
        const bbox = m.getBoundingInfo().boundingBox;
        min = BABYLON.Vector3.Minimize(min, bbox.minimumWorld);
        max = BABYLON.Vector3.Maximize(max, bbox.maximumWorld);
      }
      const size = max.subtract(min);
      const dimsSorted = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)].sort((a, b) => a - b);

      console.log(
        `[Pipeline][DEBUG] Unit '${unit.name}' ` +
        `(fixed=${unit.isFixed})
  - root uid: ${unit.root}
  - root world pos: (${rootPos.x.toFixed(3)}, ${rootPos.y.toFixed(3)}, ${rootPos.z.toFixed(3)})
  - child meshes: ${meshes.length}
  - bbox min: (${min.x.toFixed(3)}, ${min.y.toFixed(3)}, ${min.z.toFixed(3)})
  - bbox max: (${max.x.toFixed(3)}, ${max.y.toFixed(3)}, ${max.z.toFixed(3)})
  - dims sorted: [${dimsSorted.map(d => d.toFixed(3)).join(', ')}]`
      );
    }

    return this.toolGraph;
  }

  /**
   * Step 2: Capture retracted state for all moving units.
   *
   * **IMPORTANT:** Before calling this, ensure all moving parts are positioned
   * in their retracted state (home position).
   *
   * @param options - State capture options
   */
  async captureRetractedStates(options?: PipelineOptions['stateCapture']): Promise<void> {
    if (!this.toolGraph) {
      throw new Error('[Pipeline] Must call analyzeScene() before capturing states');
    }

    console.log('[Pipeline] Step 2: Capturing retracted states...');

    const movingUnits = this.toolGraph.units.filter(u => !u.isFixed);
    const captureOpts = { ...DEFAULT_PIPELINE_OPTIONS.stateCapture, ...options };

    for (const unit of movingUnits) {
      const snapshot = this.stateCapture.capture(
        this.scene,
        unit.id,
        'retract',
        { kind: 'nodes', nodeIds: unit.nodes },
        captureOpts
      );

      if (!this.statePairs.has(unit.id)) {
        this.statePairs.set(unit.id, { unit, retracted: snapshot } as UnitStatePair);
      } else {
        this.statePairs.get(unit.id)!.retracted = snapshot;
      }

      console.log(`[Pipeline] Captured retracted state for unit '${unit.name}': ${snapshot.pointCloud.length} points`);
      // DEBUG: Show centroid and first points
      if (snapshot.pointCloud.length > 0) {
        const centroid = snapshot.pointCloud.reduce((s, p) => s.add(p), BABYLON.Vector3.Zero()).scale(1 / snapshot.pointCloud.length);
        console.log(`[Pipeline][DEBUG] Retracted centroid for '${unit.name}': (${centroid.x.toFixed(3)}, ${centroid.y.toFixed(3)}, ${centroid.z.toFixed(3)})`);
        const sample = snapshot.pointCloud.slice(0, 3).map(p => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`);
        console.log(`[Pipeline][DEBUG] Retracted sample points: ${sample.join(', ')}`);
      }
    }
  }

  /**
   * Step 3: Capture extended state for all moving units.
   *
   * **IMPORTANT:** Before calling this, ensure all moving parts are positioned
   * in their extended state (actuated position).
   *
   * @param options - State capture options
   */
  async captureExtendedStates(options?: PipelineOptions['stateCapture']): Promise<void> {
    if (!this.toolGraph) {
      throw new Error('[Pipeline] Must call analyzeScene() before capturing states');
    }

    console.log('[Pipeline] Step 3: Capturing extended states...');

    const movingUnits = this.toolGraph.units.filter(u => !u.isFixed);
    const captureOpts = { ...DEFAULT_PIPELINE_OPTIONS.stateCapture, ...options };

    for (const unit of movingUnits) {
      const snapshot = this.stateCapture.capture(
        this.scene,
        unit.id,
        'advance',
        { kind: 'nodes', nodeIds: unit.nodes },
        captureOpts
      );

      if (!this.statePairs.has(unit.id)) {
        throw new Error(`[Pipeline] Retracted state not captured for unit '${unit.name}'`);
      }

      this.statePairs.get(unit.id)!.extended = snapshot;

      console.log(`[Pipeline] Captured extended state for unit '${unit.name}': ${snapshot.pointCloud.length} points`);
      // DEBUG: Show centroid and first points
      if (snapshot.pointCloud.length > 0) {
        const centroid = snapshot.pointCloud.reduce((s, p) => s.add(p), BABYLON.Vector3.Zero()).scale(1 / snapshot.pointCloud.length);
        console.log(`[Pipeline][DEBUG] Extended centroid for '${unit.name}': (${centroid.x.toFixed(3)}, ${centroid.y.toFixed(3)}, ${centroid.z.toFixed(3)})`);
        const sample = snapshot.pointCloud.slice(0, 3).map(p => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`);
        console.log(`[Pipeline][DEBUG] Extended sample points: ${sample.join(', ')}`);
      }
    }
  }

  /**
   * Step 4: Fit joints using ICP alignment between retracted and extended states.
   *
   * **NEW: Multi-stage ICP-based filtering for fast early rejection**
   * - Stage 1: Geometric pre-filtering (< 1ms per node)
   * - Stage 2: Coarse ICP with downsampled points (10-20ms per node)
   * - Stage 3: Full ICP refinement (100-200ms per node)
   * - Stage 4: Confidence scoring
   *
   * @param options - ICP and joint extraction options
   */
  async fitJoints(options?: PipelineOptions): Promise<void> {
    if (this.statePairs.size === 0) {
      throw new Error('[Pipeline] Must capture states before fitting joints');
    }

    console.log('[Pipeline] Step 4: Fitting joints using multi-stage ICP filtering...');

    const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };

    // Build node pairs for FastNodeFilter
    const nodePairs: NodePair[] = [];
    for (const [unitId, statePair] of this.statePairs.entries()) {
      const { unit, retracted, extended } = statePair;

      if (!retracted || !extended) {
        console.warn(`[Pipeline] Skipping unit '${unit.name}': missing state data`);
        continue;
      }

      if (retracted.pointCloud.length === 0 || extended.pointCloud.length === 0) {
        console.warn(`[Pipeline] Skipping unit '${unit.name}': empty point clouds`);
        continue;
      }

      // DEBUG: Log unit details
      console.log(`[Pipeline] Unit: ${unit.name} (ID: ${unitId})`);
      console.log(`  - Type: ${unit.type} (isFixed: ${unit.isFixed})`);
      console.log(`  - Root node: ${unit.root}`);
      console.log(`  - Nodes in unit: ${unit.nodes.length}`);
      console.log(`  - Retracted points: ${retracted.pointCloud.length}`);
      console.log(`  - Extended points: ${extended.pointCloud.length}`);

      // Sample first few points from each state
      const retractedSample = retracted.pointCloud.slice(0, 3);
      const extendedSample = extended.pointCloud.slice(0, 3);
      console.log(`  - Retracted sample:`, retractedSample.map(p => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`));
      console.log(`  - Extended sample:`, extendedSample.map(p => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`));

      // DEBUG: Compare world vs unit-root-relative coordinates
      const uid = parseInt(unit.root, 10);
      const rootTn = !isNaN(uid) ? this.scene.getTransformNodeByUniqueId(uid) : null;
      if (rootTn) {
        rootTn.computeWorldMatrix(true);
        const rootPos = rootTn.getAbsolutePosition();
        const relCentroidRetr = retracted.pointCloud
          .reduce((sum, p) => sum.add(p.subtract(rootPos)), BABYLON.Vector3.Zero())
          .scale(1 / retracted.pointCloud.length);
        const relCentroidExt = extended.pointCloud
          .reduce((sum, p) => sum.add(p.subtract(rootPos)), BABYLON.Vector3.Zero())
          .scale(1 / extended.pointCloud.length);
        const relDelta = relCentroidExt.subtract(relCentroidRetr);
        console.log(
          `  - [DEBUG] Root world pos: (${rootPos.x.toFixed(3)}, ${rootPos.y.toFixed(3)}, ${rootPos.z.toFixed(3)})\n` +
          `    Relative centroid delta (ext - retr): (${relDelta.x.toFixed(3)}, ${relDelta.y.toFixed(3)}, ${relDelta.z.toFixed(3)})`
        );
      }

      nodePairs.push({
        fixedNodeId: unitId, // Use unitId as identifier
        movingNodeId: unitId,
        fixedPoints: retracted.pointCloud,
        movingPoints: extended.pointCloud,
      });
    }

    if (nodePairs.length === 0) {
      console.warn('[Pipeline] No valid node pairs to process');
      return;
    }

    console.log(`[Pipeline] Processing ${nodePairs.length} node pairs through filter pipeline...`);

    // Run multi-stage filtering pipeline
    const filterResults = await FastNodeFilter.filterBatch(nodePairs, opts.fastFiltering);

    console.log(`[Pipeline] Filtering complete. Processing final results...`);

    // Log filtering statistics
    const stats = {
      prefilter: 0,
      coarse: 0,
      full: 0,
      confidence: 0,
    };
    for (const [, result] of filterResults.entries()) {
      if (result.stage === 'prefilter' && !result.passed) stats.prefilter++;
      else if (result.stage === 'coarse' && !result.passed) stats.coarse++;
      else if (result.stage === 'full' && !result.passed) stats.full++;
      else if (result.stage === 'confidence') stats.confidence++;
    }

    console.log(
      `[Pipeline] Filter Statistics:\n` +
      `  - Rejected at Stage 1 (geometric): ${stats.prefilter}\n` +
      `  - Rejected at Stage 2 (coarse ICP): ${stats.coarse}\n` +
      `  - Rejected at Stage 3 (full ICP): ${stats.full}\n` +
      `  - Passed all stages: ${stats.confidence}`
    );

    // Process nodes that passed all filtering stages
    for (const [unitId, filterResult] of filterResults.entries()) {
      if (!filterResult.passed || filterResult.stage !== 'confidence') {
        const statePair = this.statePairs.get(unitId);
        const unitName = statePair?.unit?.name || unitId;
        const unitRoot = statePair?.unit?.root || 'unknown';
        console.warn(
          `[Pipeline] Unit '${unitName}' (root: ${unitRoot}) rejected at stage '${filterResult.stage}': ${filterResult.reason}`
        );
        continue;
      }

      const statePair = this.statePairs.get(unitId);
      if (!statePair) continue;

      const { unit, retracted } = statePair;

      // Run final high-quality ICP using professional solver
      console.log(`[Pipeline] Running final ICP for unit '${unit.name}'...`);

      let icpResult: ICPResult;

      if (opts.useProfessionalICP) {
        // Use icpts (ModelAnalyzer3D cascaded registration)
        const pclResult = await PCLICPSolver.align(
          retracted.pointCloud,
          statePair.extended.pointCloud,
          {
            maxIterations: opts.fastFiltering?.fullMaxIterations ?? 200,
            errorTolerance: opts.fastFiltering?.fullErrorTolerance ?? 1e-7,
            enableDebug: opts.icp?.enableDebug ?? true,
          }
        );

        icpResult = {
          success: pclResult.success,
          transform: pclResult.transform,
          rmsError: pclResult.error,
          iterations: pclResult.iterations,
          correspondences: retracted.pointCloud.length,
        };
      } else {
        // Use custom ICP
        icpResult = ICP.align(retracted.pointCloud, statePair.extended.pointCloud, opts.icp);
      }

      if (!icpResult.success) {
        console.warn(
          `[Pipeline] Final ICP failed for unit '${unit.name}': ` +
          `${icpResult.correspondences} correspondences, ` +
          `RMS error ${icpResult.rmsError.toFixed(4)}m`
        );
        continue;
      }

      // Compute centroid of retracted point cloud
      const centroid = retracted.pointCloud
        .reduce((sum, p) => sum.add(p), BABYLON.Vector3.Zero())
        .scale(1 / retracted.pointCloud.length);

      // Extract joint from transform
      const jointFit = extractJointFromTransform(icpResult, centroid, opts.jointExtraction);

      if (jointFit.confidence < opts.minConfidence) {
        console.warn(
          `[Pipeline] Low confidence joint fit for unit '${unit.name}': ` +
          `${jointFit.confidence.toFixed(2)} < ${opts.minConfidence} (threshold)`
        );
        continue;
      }

      this.icpResults.set(unitId, { unit, icpResult, jointFit });

      console.log(
        `[Pipeline] Fitted ${jointFit.type} joint for unit '${unit.name}': ` +
        `magnitude=${jointFit.magnitude.toFixed(4)}, ` +
        `confidence=${jointFit.confidence.toFixed(2)}, ` +
        `filterConfidence=${filterResult.metrics?.confidence?.toFixed(2) ?? 'N/A'}, ` +
        `error=${icpResult.rmsError.toFixed(4)}m`
      );
    }

    console.log(`[Pipeline] Joint fitting complete: ${this.icpResults.size} joints extracted`);
  }

  /**
   * Step 5: Export to kinematic model JSON.
   *
   * @param options - Export options
   * @returns Complete kinematic model export
   */
  exportToJSON(options?: PipelineOptions): KinematicModelExport {
    if (!this.toolGraph) {
      throw new Error('[Pipeline] Must call analyzeScene() before exporting');
    }

    console.log('[Pipeline] Step 5: Exporting to JSON...');

    const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };
    const joints: JointDefinitionOutput[] = [];
    const residuals: Record<string, number> = {};

    // Find a fixed unit to use as parent
    const fixedUnit = this.toolGraph.units.find(u => u.isFixed);
    if (!fixedUnit) {
      throw new Error('[Pipeline] No fixed unit found to use as parent');
    }

    for (const [unitId, { unit, icpResult, jointFit }] of this.icpResults.entries()) {
      const jointDef = convertToJointDefinition(
        jointFit,
        `${unit.name}_joint`,
        fixedUnit.root,
        unit.root,
        opts.limitSafetyFactor
      );

      joints.push(jointDef);
      residuals[unitId] = icpResult.rmsError;
    }

    // Generate actuator program (simple timeline)
    // Build reverse map from unit.root (Babylon uniqueId string) to unit.id
    const rootToUnitId = new Map<string, string>();
    if (this.toolGraph) {
      for (const u of this.toolGraph.units) rootToUnitId.set(u.root, u.id);
    }

    const actuatorProgram: ActuatorProgramOutput = {
      channels: joints.map((joint, idx) => ({
        id: `ch${idx + 1}`,
        unitId: rootToUnitId.get(joint.childId) || joint.childId,
        timeline: [
          { tMs: 0, cmd: 'retract' as const },
          { tMs: 1000, cmd: 'extend' as const },
          { tMs: 2000, cmd: 'retract' as const },
        ],
      })),
      residuals,
    };

    console.log(`[Pipeline] Export complete: ${joints.length} joints, ${actuatorProgram.channels.length} channels`);

    return { joints, actuatorProgram };
  }

  /**
   * Export in legacy tooling JSON format (array of units with joint records),
   * approximated from our ICP/joint results.
   */
  exportToLegacyJSON(): any[] {
    if (!this.toolGraph) {
      throw new Error('[Pipeline] Must call analyzeScene() before exporting');
    }

    const out: any[] = [];

    // Build lookup for quick access to state point counts and centroids
    const computeCentroid = (pts: BABYLON.Vector3[] | undefined): BABYLON.Vector3 => {
      if (!pts || pts.length === 0) return new BABYLON.Vector3(0, 0, 0);
      const sum = pts.reduce((acc, p) => acc.add(p), BABYLON.Vector3.Zero());
      return sum.scale(1 / pts.length);
    };

    // Group ICP results by unit for legacy structure
    const byUnitId = new Map<string, Array<{ unit: ToolUnit; icp: ICPResult; }>>();
    for (const [unitId, { unit, icpResult }] of this.icpResults.entries()) {
      const arr = byUnitId.get(unitId) || [];
      arr.push({ unit, icp: icpResult });
      byUnitId.set(unitId, arr);
    }

    for (const [unitId, entries] of byUnitId.entries()) {
      const state = this.statePairs.get(unitId);
      const retractedPts = state?.retracted?.pointCloud;
      const extendedPts = state?.extended?.pointCloud;
      const c0 = computeCentroid(retractedPts);
      const c1 = computeCentroid(extendedPts);
      const delta = c1.subtract(c0);

      const joints = entries.map((e, idx) => {
        const T = e.icp.transform;
        const rows = [
          `${T.m[0].toFixed(4)}     ${T.m[1].toFixed(4)}     ${T.m[2].toFixed(4)}     ${T.m[3].toFixed(4)}`,
          `${T.m[4].toFixed(4)}     ${T.m[5].toFixed(4)}     ${T.m[6].toFixed(4)}     ${T.m[7].toFixed(4)}`,
          `${T.m[8].toFixed(4)}     ${T.m[9].toFixed(4)}     ${T.m[10].toFixed(4)}     ${T.m[11].toFixed(4)}`,
          `${T.m[12].toFixed(4)}     ${T.m[13].toFixed(4)}     ${T.m[14].toFixed(4)}     ${T.m[15].toFixed(4)}`,
        ];

        // Best-effort mapping of type and magnitude
        const jf = this.icpResults.get(unitId)?.jointFit;
        const typeCode = jf?.type === 'hinge' ? 1 : 0; // 0=prismatic, 1=revolute(hinge)
        const maxVal = (jf?.magnitude ?? delta.length());

        return {
          Name: `C${idx + 1}`,
          ElectricalName: e.unit.name,
          NodeId: e.unit.root,
          HideId: `${e.unit.root}/WIRE/OPEN`,
          Type: typeCode,
          MaxValue: maxVal,
          MinValue: 0,
          ToVector: { X: delta.x, Y: delta.y, Z: delta.z },
          FromVector: { X: 0, Y: 0, Z: 0 },
          PointCountClose: retractedPts?.length ?? 0,
          PointCountOpen: extendedPts?.length ?? 0,
          RmsError: e.icp.rmsError,
          MaxError: e.icp.rmsError,
          TransformationMatrix: rows,
        };
      });

      out.push({ UnitName: entries[0].unit.name, Joints: joints });
    }

    return out;
  }

  /**
   * Run the complete pipeline automatically.
   *
   * **IMPORTANT:** This method requires manual user interaction to position
   * parts between retracted and extended states. For fully automated execution,
   * use the step-by-step API.
   *
   * @param options - Pipeline configuration
   * @returns Complete kinematic model export
   *
   * @example
   * ```typescript
   * const pipeline = new KinematicExtractionPipeline(scene);
   *
   * // Analyze scene
   * await pipeline.analyzeScene();
   *
   * // User manually positions parts in retracted state...
   * await pipeline.captureRetractedStates();
   *
   * // User manually positions parts in extended state...
   * await pipeline.captureExtendedStates();
   *
   * // Fit joints and export
   * await pipeline.fitJoints();
   * const model = pipeline.exportToJSON();
   * ```
   */
  async runComplete(options?: PipelineOptions): Promise<KinematicModelExport> {
    const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };

    // Step 1: Analyze scene
    await this.analyzeScene(opts.geometric);

    // Step 2 & 3: Capture states
    // NOTE: In a real implementation, this would pause for user interaction
    console.warn(
      '[Pipeline] runComplete() requires manual state capture. ' +
      'Call captureRetractedStates() and captureExtendedStates() separately.'
    );

    // Step 4: Fit joints (only if states already captured)
    if (this.statePairs.size > 0) {
      await this.fitJoints(opts);
    }

    // Step 5: Export
    return this.exportToJSON(opts);
  }

  /**
   * Get current tool graph.
   */
  getToolGraph(): ToolGraph | null {
    return this.toolGraph;
  }

  /**
   * Get captured state pairs.
   */
  getStatePairs(): Map<string, UnitStatePair> {
    return this.statePairs;
  }

  /**
   * Get ICP results.
   */
  getICPResults(): Map<string, UnitICPResult> {
    return this.icpResults;
  }

  /**
   * Reset pipeline state (useful for restarting workflow).
   */
  reset(): void {
    this.toolGraph = null;
    this.statePairs.clear();
    this.icpResults.clear();
    console.log('[Pipeline] Pipeline state reset');
  }

  /**
   * Manually capture state for a specific unit.
   *
   * Useful for interactive workflows where user positions one unit at a time.
   *
   * @param unitId - Tool unit ID
   * @param state - 'retract' or 'advance'
   * @param options - State capture options
   */
  async captureUnitState(
    unitId: string,
    state: 'retract' | 'advance',
    options?: PipelineOptions['stateCapture']
  ): Promise<void> {
    if (!this.toolGraph) {
      throw new Error('[Pipeline] Must call analyzeScene() first');
    }

    const unit = this.toolGraph.units.find(u => u.id === unitId);
    if (!unit) {
      throw new Error(`[Pipeline] Unit '${unitId}' not found in tool graph`);
    }

    const captureOpts = { ...DEFAULT_PIPELINE_OPTIONS.stateCapture, ...options };
    const snapshot = this.stateCapture.capture(
      this.scene,
      unit.id,
      state,
      { kind: 'nodes', nodeIds: unit.nodes },
      captureOpts
    );

    if (!this.statePairs.has(unitId)) {
      this.statePairs.set(unitId, { unit } as UnitStatePair);
    }

    if (state === 'retract') {
      this.statePairs.get(unitId)!.retracted = snapshot;
    } else {
      this.statePairs.get(unitId)!.extended = snapshot;
    }

    console.log(
      `[Pipeline] Captured ${state} state for unit '${unit.name}': ` +
      `${snapshot.pointCloud.length} points`
    );
  }

  /**
   * Manually fit joint for a specific unit.
   *
   * Useful for interactive workflows where user wants to fit one joint at a time.
   *
   * @param unitId - Tool unit ID
   * @param options - ICP and joint extraction options
   */
  async fitUnitJoint(unitId: string, options?: PipelineOptions): Promise<void> {
    const statePair = this.statePairs.get(unitId);
    if (!statePair || !statePair.retracted || !statePair.extended) {
      throw new Error(`[Pipeline] Missing state data for unit '${unitId}'`);
    }

    const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };
    const { unit, retracted, extended } = statePair;

    const icpResult = ICP.align(retracted.pointCloud, extended.pointCloud, opts.icp);

    if (!icpResult.success) {
      throw new Error(
        `[Pipeline] ICP failed for unit '${unit.name}': ` +
        `${icpResult.correspondences} correspondences, ` +
        `RMS error ${icpResult.rmsError.toFixed(4)}m`
      );
    }

    const centroid = retracted.pointCloud
      .reduce((sum, p) => sum.add(p), BABYLON.Vector3.Zero())
      .scale(1 / retracted.pointCloud.length);

    const jointFit = extractJointFromTransform(icpResult, centroid, opts.jointExtraction);

    this.icpResults.set(unitId, { unit, icpResult, jointFit });

    console.log(
      `[Pipeline] Fitted ${jointFit.type} joint for unit '${unit.name}': ` +
      `magnitude=${jointFit.magnitude.toFixed(4)}, ` +
      `confidence=${jointFit.confidence.toFixed(2)}, ` +
      `error=${icpResult.rmsError.toFixed(4)}m`
    );
  }
}
