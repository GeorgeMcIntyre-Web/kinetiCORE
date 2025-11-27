import * as BABYLON from '@babylonjs/core';
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
import { collectSubtree, selectUnits, findUnitCandidates, getNodePairsForUnit, type Scene as StatScene } from '../../kinematics/statisticalPairing/StatisticalPairingEngine';
import { BabylonAdapter } from './BabylonAdapter';

/**
 * Detected Joint from Tool Analysis
 */
export interface DetectedToolJoint {
  jointId: string;
  unitId: string;
  nodeAId: string;
  nodeBId: string;
  deltaType: 'revolute' | 'prismatic';
  angleDeg?: number;
  axis: BABYLON.Vector3;
  anchor: BABYLON.Vector3;
  confidence: number;
  min?: number;
  max?: number;
}

/**
 * Configuration for the complete kinematic extraction pipeline.
 */
/**
 * Configuration for the complete kinematic extraction pipeline.
 */
export interface PipelineOptions {
  /**
   * Minimum confidence threshold to include a joint in output.
   * Range: 0-1, default: 0.5
   */
  minConfidence?: number;

  /**
   * ICP alignment options
   */
  icp?: ICPOptions;

  /**
   * Joint extraction options
   */
  jointExtraction?: JointExtractionOptions;

  /**
   * State capture options
   */
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
   * Fast node filtering options (multi-stage ICP-based filtering).
   */
  fastFiltering?: FilterOptions;

  /**
   * Use professional ICP solver (icpts) instead of custom ICP.
   */
  useProfessionalICP?: boolean;
}

const DEFAULT_PIPELINE_OPTIONS: Required<PipelineOptions> = {
  minConfidence: 0.5,
  icp: {
    enableDebug: true,
  },
  jointExtraction: {},
  stateCapture: {
    samplePoints: true,
    stride: 10,
    maxPoints: 1000,
  },
  limitSafetyFactor: 1.1,
  fastFiltering: {
    minPoints: 50,
    maxCentroidDistance: 2.0,
    minCentroidDistance: 0.001,
    bypassGeometricFilter: false,
    coarsePointCount: 100,
    coarseMaxIterations: 20,
    coarseErrorMin: 0.001,
    coarseErrorMax: 0.5,
    fullMaxIterations: 200,
    fullErrorTolerance: 1e-7,
    translationRange: { min: 0.01, max: 2.0 },
    rotationRange: { min: 1.0, max: 180.0 },
    enableDebug: true,
  },
  useProfessionalICP: true,
};

/**
 * Tool Unit definition (replaces legacy ToolUnit)
 */
export interface ToolUnit {
  id: string;
  name: string;
  root: string;
  nodes: string[];
  isFixed: boolean;
  type?: 'fixed' | 'moving';
}

/**
 * Tool Graph definition (replaces legacy ToolGraph)
 */
export interface ToolGraph {
  units: ToolUnit[];
}


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
  private stateCapture: StateCapture;

  private toolGraph: ToolGraph | null = null;
  private statePairs: Map<string, UnitStatePair> = new Map();
  private icpResults: Map<string, UnitICPResult> = new Map();
  private detectedJoints: DetectedToolJoint[] = [];

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
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
  /**
   * Step 1: Analyze scene to identify tool units using Statistical Pairing.
   */
  async analyzeScene(options?: PipelineOptions, rootNode?: BABYLON.Node): Promise<ToolGraph> {
    console.log('[Pipeline] Step 1: Analyzing scene for tool units (Statistical Pairing)...');

    if (!rootNode) {
      // Fallback to scene root if not provided
      rootNode = this.scene.rootNodes[0];
    }

    if (!rootNode) {
      throw new Error('[Pipeline] No root node found to analyze');
    }

    // 1. Convert Babylon scene to Statistical Scene
    const statScene = BabylonAdapter.convert(rootNode);
    const flatNodes = collectSubtree(statScene, statScene.rootId);

    // 2. Find Unit Candidates
    const fixtureTotal = flatNodes[0].totalPoints; // Root total
    const candidates = findUnitCandidates(flatNodes, fixtureTotal);

    // 3. Select Units
    const unitIds = selectUnits(candidates, statScene, fixtureTotal);

    console.log(`[Pipeline] Statistical Analysis found ${unitIds.length} units:`, unitIds);

    // 4. Convert to ToolUnit objects
    // Heuristic: The unit with the most points is likely the base (Fixed)
    let maxPoints = -1;
    let fixedUnitId = '';

    const units: ToolUnit[] = unitIds.map(id => {
      const node = statScene.nodes.get(id);
      const points = node?.totalPointCount ?? 0;

      if (points > maxPoints) {
        maxPoints = points;
        fixedUnitId = id;
      }

      // Collect all descendant node IDs for this unit
      const unitNodes = collectSubtree(statScene, id).map(n => n.id);

      return {
        id: id,
        name: id, // Use ID as name (name-agnostic)
        root: id,
        nodes: unitNodes,
        isFixed: false, // Will update below
        type: 'moving'
      };
    });

    // Mark fixed unit
    const fixedUnit = units.find(u => u.id === fixedUnitId);
    if (fixedUnit) {
      fixedUnit.isFixed = true;
      fixedUnit.type = 'fixed';
    }

    this.toolGraph = { units };

    console.log(
      `[Pipeline] Analysis complete: ${units.length} units ` +
      `(${fixedUnitId} identified as base/fixed)`
    );

    return this.toolGraph;
  }

  /**
   * Auto-detect joints by statistically pairing units and nodes.
   * This replaces the manual state capture workflow.
   */
  async detectJointsStatistically(options?: PipelineOptions): Promise<DetectedToolJoint[]> {
    if (!this.toolGraph) {
      throw new Error('[Pipeline] Must call analyzeScene() before detecting joints');
    }

    console.log('[Pipeline] Detecting joints statistically...');
    const detectedJoints: DetectedToolJoint[] = [];
    const statScene = BabylonAdapter.convert(this.scene.rootNodes[0]); // Re-convert or cache? Re-convert is safer for now.

    // 1. Pair Units (Self-Pairing Strategy)
    // Group units by point count (within 1% tolerance)
    const units = this.toolGraph.units;
    const groups: ToolUnit[][] = [];
    const processed = new Set<string>();

    for (const u1 of units) {
      if (processed.has(u1.id)) continue;

      const group = [u1];
      processed.add(u1.id);
      const p1 = statScene.nodes.get(u1.id)?.totalPointCount ?? 0;

      for (const u2 of units) {
        if (processed.has(u2.id)) continue;
        const p2 = statScene.nodes.get(u2.id)?.totalPointCount ?? 0;

        // Tolerance: 1% relative or 50 points absolute
        const diff = Math.abs(p1 - p2);
        const maxP = Math.max(p1, p2);
        const rel = maxP === 0 ? 0 : diff / maxP;

        if (diff < 50 || rel < 0.01) {
          group.push(u2);
          processed.add(u2.id);
        }
      }
      groups.push(group);
    }

    console.log(`[Pipeline] Found ${groups.length} unit groups based on point count.`);

    // 2. Process Pairs
    for (const group of groups) {
      if (group.length !== 2) {
        console.log(`[Pipeline] Group with ${group.length} units (points ~${statScene.nodes.get(group[0].id)?.totalPointCount}) - skipping (not a pair)`);
        continue;
      }

      const [uA, uB] = group;
      console.log(`[Pipeline] Processing Unit Pair: ${uA.id} <-> ${uB.id}`);

      // We don't know which is Open/Closed, but it doesn't matter for finding the joint *axis*.
      // We just need to find the transform between them.
      // Arbitrarily assign Open/Closed for the helper function
      const unitPair = { openUnitId: uA.id, closedUnitId: uB.id };

      // 3. Pair Nodes within Units
      const nodePairs = getNodePairsForUnit(statScene, statScene, unitPair);
      console.log(`[Pipeline]   Found ${nodePairs.length} node pairs.`);

      if (nodePairs.length === 0) continue;

      // 4. Run ICP on Node Pairs to find Joint
      // We aggregate points from all paired nodes to get a robust fit
      let pointsA: BABYLON.Vector3[] = [];
      let pointsB: BABYLON.Vector3[] = [];

      for (const pair of nodePairs) {
        const nodeA = this.scene.getTransformNodeById(pair.openNodeId) || this.scene.getMeshById(pair.openNodeId);
        const nodeB = this.scene.getTransformNodeById(pair.closedNodeId) || this.scene.getMeshById(pair.closedNodeId);

        if (nodeA && nodeB) {
          // Extract world vertices
          // Note: We need a helper to extract vertices. StateCapture has one, or we can use a simple one here.
          // For now, let's assume meshes.
          const ptsA = this.extractVertices(nodeA);
          const ptsB = this.extractVertices(nodeB);
          pointsA.push(...ptsA);
          pointsB.push(...ptsB);
        }
      }

      if (pointsA.length < 50 || pointsB.length < 50) {
        console.warn('[Pipeline] Insufficient points for ICP.');
        continue;
      }

      // Run ICP
      // Use PCLICPSolver if available
      const icpResultRaw = await PCLICPSolver.align(pointsA, pointsB, { maxIterations: 100 });

      if (!icpResultRaw.success) {
        console.warn(`[Pipeline] ICP failed for pair ${uA.id}-${uB.id}`);
        continue;
      }

      // Extract Joint
      const icpResult: ICPResult = {
        success: icpResultRaw.success,
        transform: icpResultRaw.transform,
        rmsError: icpResultRaw.error,
        iterations: icpResultRaw.iterations,
        correspondences: pointsA.length
      };

      const jointFit = extractJointFromTransform(
        icpResult,
        pointsA,
        options?.jointExtraction
      );

      if (jointFit && jointFit.confidence > (options?.minConfidence ?? 0.5)) {
        console.log(`[Pipeline] Detected ${jointFit.type} joint!`);

        detectedJoints.push({
          jointId: `${uA.id}_joint`,
          unitId: uA.id, // Assign to one of them
          nodeAId: uA.id,
          nodeBId: uB.id,
          deltaType: jointFit.type === 'hinge' ? 'revolute' : 'prismatic',
          angleDeg: (jointFit.magnitude * 180) / Math.PI,
          axis: new BABYLON.Vector3(jointFit.axis.x, jointFit.axis.y, jointFit.axis.z),
          anchor: new BABYLON.Vector3(jointFit.anchor.x, jointFit.anchor.y, jointFit.anchor.z),
          confidence: jointFit.confidence,
          min: 0, // TODO: Infer limits
          max: jointFit.magnitude
        });
      }
    }

    this.detectedJoints = detectedJoints;
    return detectedJoints;
  }

  private extractVertices(node: BABYLON.Node): BABYLON.Vector3[] {
    const points: BABYLON.Vector3[] = [];
    if (node instanceof BABYLON.Mesh) {
      const data = node.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      if (data) {
        node.computeWorldMatrix(true);
        const matrix = node.getWorldMatrix();
        for (let i = 0; i < data.length; i += 3) {
          const v = new BABYLON.Vector3(data[i], data[i + 1], data[i + 2]);
          points.push(BABYLON.Vector3.TransformCoordinates(v, matrix));
        }
      }
    }
    // Recurse? collectSubtree already gave us the nodes, so we iterate them in the caller.
    // But wait, getNodePairsForUnit returns pairs of *individual* nodes.
    // So if I pass a node here, it's just that node.
    return points;
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

      // Extract joint from transform (orbit-based circle fitting, no centroid)
      const jointFit = extractJointFromTransform(icpResult, retracted.pointCloud, opts.jointExtraction);

      if (!jointFit) {
        console.warn(
          `[Pipeline] No joint detected for unit '${unit.name}' (insufficient motion)`
        );
        continue;
      }

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
    const actuatorProgram: ActuatorProgramOutput = {
      channels: joints.map((joint, idx) => ({
        id: `ch${idx + 1}`,
        unitId: this.icpResults.get(joint.childId)?.unit.id || joint.childId,
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
    await this.analyzeScene(opts);

    // Step 2 & 3: Capture states
    // NOTE: In a real implementation, this would pause for user interaction
    console.warn(
      '[Pipeline] runComplete() requires manual state capture. ' +
      'Call captureRetractedStates() and captureExtendedStates() separately.'
    );

    // Step 4: Fit joints (only if states already captured)
    if (this.statePairs.size > 0) {
      await this.fitJoints(opts);
    } else {
      // Auto-detect if no manual states
      await this.detectJointsStatistically(opts);
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
   * Get detected joints from the structure-based analyzer.
   * These are auto-detected joints from ICP on two-state families.
   */
  getDetectedJoints(): DetectedToolJoint[] {
    return this.detectedJoints;
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

  async captureUnitStateFromPoints(
    unitId: string,
    state: 'retract' | 'advance',
    points: BABYLON.Vector3[],
  ): Promise<void> {
    if (!this.toolGraph) {
      throw new Error('[Pipeline] Must call analyzeScene() first');
    }

    const unit = this.toolGraph.units.find(u => u.id === unitId);
    if (!unit) {
      throw new Error(`[Pipeline] Unit '${unitId}' not found in tool graph`);
    }

    const snapshot = this.stateCapture.capture(
      this.scene,
      unit.id,
      state,
      { kind: 'points', points },
      {}
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
      `[Pipeline] Captured ${state} state (points) for unit '${unit.name}': ` +
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

    // Extract joint from transform (orbit-based circle fitting, no centroid)
    const jointFit = extractJointFromTransform(icpResult, retracted.pointCloud, opts.jointExtraction);

    if (!jointFit) {
      throw new Error(
        `[Pipeline] No joint detected for unit '${unit.name}' (insufficient motion)`
      );
    }

    this.icpResults.set(unitId, { unit, icpResult, jointFit });

    console.log(
      `[Pipeline] Fitted ${jointFit.type} joint for unit '${unit.name}': ` +
      `magnitude=${jointFit.magnitude.toFixed(4)}, ` +
      `confidence=${jointFit.confidence.toFixed(2)}, ` +
      `error=${icpResult.rmsError.toFixed(4)}m`
    );
  }
}
