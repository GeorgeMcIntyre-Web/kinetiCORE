import * as BABYLON from '@babylonjs/core';
import { GeometricToolAnalyzer, type GeometricAnalyzeOptions } from '../sceneAnalysis/GeometricToolAnalyzer';
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

/**
 * Configuration for the complete kinematic extraction pipeline.
 */
export interface PipelineOptions {
  /** Geometric analysis options */
  geometric?: GeometricAnalyzeOptions;

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
}

const DEFAULT_PIPELINE_OPTIONS: Required<PipelineOptions> = {
  geometric: {},
  icp: {},
  jointExtraction: {},
  stateCapture: {
    samplePoints: true,
    stride: 10,
    maxPoints: 1000,
  },
  limitSafetyFactor: 1.1,
  minConfidence: 0.5,
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
  private analyzer: GeometricToolAnalyzer;
  private stateCapture: StateCapture;

  private toolGraph: ToolGraph | null = null;
  private statePairs: Map<string, UnitStatePair> = new Map();
  private icpResults: Map<string, UnitICPResult> = new Map();

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.analyzer = new GeometricToolAnalyzer();
    this.stateCapture = new StateCapture();
  }

  /**
   * Step 1: Analyze scene to identify tool units using geometric properties.
   *
   * @param options - Geometric analysis options
   * @returns ToolGraph with identified units
   */
  async analyzeScene(options?: GeometricAnalyzeOptions): Promise<ToolGraph> {
    console.log('[Pipeline] Step 1: Analyzing scene for tool units...');
    this.toolGraph = this.analyzer.analyze(this.scene, options);

    const fixed = this.toolGraph.units.filter(u => u.isFixed);
    const moving = this.toolGraph.units.filter(u => !u.isFixed);

    console.log(
      `[Pipeline] Analysis complete: ${this.toolGraph.units.length} units ` +
      `(${fixed.length} fixed, ${moving.length} moving)`
    );

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
   * @param options - ICP and joint extraction options
   */
  async fitJoints(options?: PipelineOptions): Promise<void> {
    if (this.statePairs.size === 0) {
      throw new Error('[Pipeline] Must capture states before fitting joints');
    }

    console.log('[Pipeline] Step 4: Fitting joints using ICP...');

    const opts = { ...DEFAULT_PIPELINE_OPTIONS, ...options };

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

      // Run ICP alignment
      console.log(`[Pipeline] Running ICP for unit '${unit.name}'...`);
      const icpResult = ICP.align(retracted.pointCloud, extended.pointCloud, opts.icp);

      if (!icpResult.success) {
        console.warn(
          `[Pipeline] ICP failed for unit '${unit.name}': ` +
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
