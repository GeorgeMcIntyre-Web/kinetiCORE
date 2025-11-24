/**
 * ⚠️ PROTECTED PIPELINE – U112 GOLD STANDARD ⚠️
 *
 * This file implements the canonical auto-kinematics workflow validated against
 * fixture 016ZF_20142435_140_1E1_CI00_U112.glb (UNIT_101 fixed + UNIT_112 revolute 90°).
 *
 * DO NOT modify core logic without:
 * 1. Running U112 gold tests: `npm test -- --run tests/gold/u112-gold.test.ts`
 * 2. Verifying all 34 unit tests pass: `npm test -- --run --testNamePattern="ToolingFixtureAnimator"`
 * 3. Reviewing: docs/auto-kinematics/AUTO_KINEMATICS_PIPELINE.md
 * 4. Checking: fixtures/gold/u112/DOCS/reference_notes.md
 *
 * @see {@link fixtures/gold/u112} - Gold standard reference fixture
 * @see {@link tests/gold/u112-gold.test.ts} - Invariant behavior tests
 */

import * as BABYLON from '@babylonjs/core';
import { KinematicExtractionPipeline, type PipelineOptions } from './KinematicExtractionPipeline';
import { toolingJsonToJoints, type ToolingFileJson } from '../io/ToolingJsonAdapter';
import { ValveBank, type Channel, type TimelineEvent } from '../actuation/ValveBank';
import { type JointDefinitionOutput } from '../io/Schemas';
import { JointDefinition } from '../kinematics/JointMath';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import type { ToolUnit } from '../sceneAnalysis/ToolGraphAnalyzer';

/**
 * Options for ToolingFixtureAnimator.
 */
export interface ToolingFixtureAnimatorOptions {
  /** Babylon scene */
  scene: BABYLON.Scene;
  /** Root node of the fixture to animate */
  rootNode: BABYLON.TransformNode;
  /** Optional precomputed tooling JSON (skips extraction if provided) */
  toolingJson?: ToolingFileJson;
  /** Options for kinematic extraction pipeline (if toolingJson not provided) */
  pipelineOptions?: PipelineOptions;
}

/**
 * Current state of the guided capture workflow.
 */
export type CaptureWorkflowState =
  | 'idle'
  | 'analyzed'
  | 'retracted_captured'
  | 'extended_captured'
  | 'joints_fitted'
  | 'ready_to_play';

/**
 * Information about a detected moving unit for UI display.
 */
export interface MovingUnitInfo {
  id: string;
  name: string;
  hasRetractedState: boolean;
  hasExtendedState: boolean;
  retractedPointCount: number;
  extendedPointCount: number;
}

/**
 * Detailed result from joint fitting for a single unit.
 */
export interface JointFitResultInfo {
  unitId: string;
  unitName: string;
  success: boolean;
  jointType: 'hinge' | 'prismatic' | 'none';
  angleDeg: number;
  angleRad: number;
  axis: { x: number; y: number; z: number };
  pivot: { x: number; y: number; z: number };
  confidence: number;
  rmsErrorMm: number;
  reason?: string; // Why it failed, if !success
}

/**
 * Result from the analysis step.
 */
export interface AnalysisResult {
  success: boolean;
  fixedUnits: ToolUnit[];
  movingUnits: ToolUnit[];
  error?: string;
}

/**
 * Result from state capture steps.
 */
export interface CaptureResult {
  success: boolean;
  pointCounts: Record<string, number>;
  totalPoints: number;
  error?: string;
}

/**
 * Result from joint fitting step.
 */
export interface FitJointsResult {
  success: boolean;
  jointCount: number;
  joints: JointDefinitionOutput[];
  details: JointFitResultInfo[];
  error?: string;
}

/**
 * Result from one-click auto-fit workflow.
 */
export interface AutoFitResult {
  success: boolean;
  fixtureRootId: string;
  totalUnits: number;
  unitsWithJoints: number;
  jointsCreated: number;
  message?: string;
  errors?: string[];
}

/**
 * Integration helper that connects auto-kinematics extraction to ValveBank animation.
 *
 * **Workflow:**
 * 1. If `toolingJson` provided → use directly
 * 2. If not → run `KinematicExtractionPipeline` to generate JSON
 * 3. Convert JSON to joint definitions via `toolingJsonToJoints()`
 * 4. Create `ValveBank` and register all joints
 * 5. Auto-create channels for animation
 *
 * **Usage:**
 * ```typescript
 * const animator = new ToolingFixtureAnimator({
 *   scene,
 *   rootNode: fixtureRoot,
 * });
 *
 * await animator.prepare();
 * await animator.playDemoCycle();
 * ```
 */
export class ToolingFixtureAnimator {
  private scene: BABYLON.Scene;
  private rootNode: BABYLON.TransformNode;
  private toolingJson: ToolingFileJson | null = null;
  private pipelineOptions: PipelineOptions | undefined;
  private pipeline: KinematicExtractionPipeline | null = null;
  private valveBank: ValveBank | null = null;
  private joints: JointDefinitionOutput[] = [];
  private workflowState: CaptureWorkflowState = 'idle';
  private movingUnits: ToolUnit[] = [];

  constructor(options: ToolingFixtureAnimatorOptions) {
    this.scene = options.scene;
    this.rootNode = options.rootNode;
    this.toolingJson = options.toolingJson || null;
    const defaults: PipelineOptions = {
      analysisMethod: 'structure-based',
      structureBased: { verbose: true, minUnitCount: 2 },
      stateCapture: { samplePoints: true, stride: 5, maxPoints: 5000 },
    } as any;
    this.pipelineOptions = { ...(defaults as any), ...(options.pipelineOptions as any) };
  }

  /**
   * Get the current workflow state.
   */
  getWorkflowState(): CaptureWorkflowState {
    return this.workflowState;
  }

  /**
   * Get information about detected moving units.
   */
  getMovingUnitsInfo(): MovingUnitInfo[] {
    if (!this.pipeline) return [];

    const statePairs = this.pipeline.getStatePairs();
    return this.movingUnits.map(unit => {
      const pair = statePairs.get(unit.id);
      return {
        id: unit.id,
        name: unit.name,
        hasRetractedState: !!pair?.retracted,
        hasExtendedState: !!pair?.extended,
        retractedPointCount: pair?.retracted?.pointCloud.length ?? 0,
        extendedPointCount: pair?.extended?.pointCloud.length ?? 0,
      };
    });
  }

  /**
   * Step 1: Analyze the fixture to detect units.
   * Call this first before capturing states.
   */
  async analyzeFixture(): Promise<AnalysisResult> {
    if (!this.pipeline) {
      this.pipeline = new KinematicExtractionPipeline(this.scene);
    }

    console.log('[ToolingFixtureAnimator] ========== STEP 1: ANALYZE FIXTURE ==========');
    console.log('[ToolingFixtureAnimator] Root node:', {
      name: this.rootNode.name,
      id: this.rootNode.id,
      uniqueId: this.rootNode.uniqueId,
    });

    const toolGraph = await this.pipeline.analyzeScene(this.pipelineOptions, this.rootNode);

    // Guard: No units found at all
    if (toolGraph.units.length === 0) {
      const error = 'No units detected in fixture. Check that the root node contains UNIT_* children.';
      console.error('[ToolingFixtureAnimator]', error);
      return { success: false, fixedUnits: [], movingUnits: [], error };
    }

    const fixedUnits = toolGraph.units.filter(u => u.isFixed);
    this.movingUnits = toolGraph.units.filter(u => !u.isFixed);

    // Guard: Only one unit found (no joints possible)
    if (toolGraph.units.length === 1) {
      console.warn('[ToolingFixtureAnimator] Only 1 unit detected. Treating it as moving for state capture.');
      this.movingUnits = [...toolGraph.units];
    }

    // Guard: No moving units but multiple units exist
    if (this.movingUnits.length === 0 && toolGraph.units.length > 1) {
      console.warn('[ToolingFixtureAnimator] All units classified as fixed. Treating all as potentially moving.');
      this.movingUnits = [...toolGraph.units];
    }

    // Structured logging
    console.log('[ToolingFixtureAnimator] Analysis Result:', {
      totalUnits: toolGraph.units.length,
      fixedCount: fixedUnits.length,
      movingCount: this.movingUnits.length,
      fixedUnits: fixedUnits.map(u => ({ id: u.id, name: u.name, nodeCount: u.nodes.length })),
      movingUnits: this.movingUnits.map(u => ({ id: u.id, name: u.name, nodeCount: u.nodes.length })),
    });

    this.workflowState = 'analyzed';
    return { success: true, fixedUnits, movingUnits: this.movingUnits };
  }

  /**
   * ONE-CLICK AUTO-FIT: Analyze fixture and register all detected joints.
   *
   * This is the primary workflow for users - no manual state capture required.
   * The StructureBasedToolAnalyzer automatically detects joints from embedded
   * two-state families (FIXED/MOVING, OPEN/CLOSED, etc.) in the GLB.
   *
   * @returns AutoFitResult with success status, counts, and any errors
   */
  async autoFitAllToolingJoints(): Promise<AutoFitResult> {
    console.log('[ToolingFixtureAnimator] ========== AUTO-FIT ALL TOOLING JOINTS ==========');

    // Guard: rootNode must exist
    if (!this.rootNode) {
      return {
        success: false,
        fixtureRootId: '',
        totalUnits: 0,
        unitsWithJoints: 0,
        jointsCreated: 0,
        message: 'No root node provided',
        errors: ['Root node is required'],
      };
    }

    const fixtureRootId = this.rootNode.id || this.rootNode.name;

    // Step 1: Ensure analysis is run
    if (!this.pipeline) {
      this.pipeline = new KinematicExtractionPipeline(this.scene);
    }

    // Run analysis if not already done
    if (this.workflowState === 'idle') {
      console.log('[AutoFit] Running fixture analysis...');
      await this.pipeline.analyzeScene(this.pipelineOptions, this.rootNode);
    }

    const toolGraph = this.pipeline.getToolGraph();
    if (!toolGraph) {
      return {
        success: false,
        fixtureRootId,
        totalUnits: 0,
        unitsWithJoints: 0,
        jointsCreated: 0,
        message: 'Analysis failed - no tool graph',
        errors: ['analyzeScene did not produce a tool graph'],
      };
    }

    // Step 2: Get detected joints from structure-based analyzer
    const detectedJoints = this.pipeline.getDetectedJoints();
    console.log(`[AutoFit] Found ${detectedJoints.length} detected joints from analyzer`);

    if (detectedJoints.length === 0) {
      return {
        success: false,
        fixtureRootId,
        totalUnits: toolGraph.units.length,
        unitsWithJoints: 0,
        jointsCreated: 0,
        message: 'No joints detected. Fixture may be static or missing two-state families.',
        errors: ['StructureBasedToolAnalyzer found no joints'],
      };
    }

    // Step 3: Create adapter context for world matrix lookups
    const context: import('../../kinematics/toolingKinematicsAdapter').KinematicsAdapterContext = {
      getNodeWorldMatrix: (nodeId: string) => {
        // Try multiple ways to find the node
        const node = this.scene.getTransformNodeById(nodeId) ||
                     this.scene.getTransformNodeByName(nodeId) ||
                     this.scene.getMeshById(nodeId) ||
                     this.scene.getMeshByName(nodeId);
        if (!node) return null;
        node.computeWorldMatrix(true);
        return node.getWorldMatrix();
      },
    };

    // Step 4: Register joints with KinematicsManager
    const { ToolingKinematicsAdapter } = await import('../../kinematics/toolingKinematicsAdapter');
    const result = ToolingKinematicsAdapter.registerFromDetectedJoints(
      fixtureRootId,
      detectedJoints,
      context
    );

    // Count unique units with joints
    const unitIdsWithJoints = new Set(detectedJoints.map(j => j.unitId));

    // Update workflow state
    this.workflowState = 'joints_fitted';

    // Log summary
    console.log('[AutoFit] Registration complete:', {
      chainId: result.chainId,
      jointsRegistered: result.jointsRegistered,
      errors: result.errors,
    });

    if (result.chainId === null) {
      return {
        success: false,
        fixtureRootId,
        totalUnits: toolGraph.units.length,
        unitsWithJoints: unitIdsWithJoints.size,
        jointsCreated: 0,
        message: 'Failed to register joints',
        errors: result.errors,
      };
    }

    return {
      success: true,
      fixtureRootId,
      totalUnits: toolGraph.units.length,
      unitsWithJoints: unitIdsWithJoints.size,
      jointsCreated: result.jointsRegistered,
      message: `Auto-fitted ${result.jointsRegistered} joint(s) on ${unitIdsWithJoints.size} unit(s). Open Motion Panel → Tooling Motion to drive clamps.`,
      errors: result.errors.length > 0 ? result.errors : undefined,
    };
  }

  /**
   * Step 2a: Capture retracted (home) state for all moving units.
   * Call this when all moving parts are in their retracted position.
   *
   * NOTE: This is part of the MANUAL/DEBUG workflow.
   * For normal use, prefer autoFitAllToolingJoints() instead.
   */
  async captureRetractedState(): Promise<CaptureResult> {
    // Guard: Must analyze first
    if (this.workflowState === 'idle') {
      const error = 'Must call analyzeFixture() before capturing states';
      console.error('[ToolingFixtureAnimator]', error);
      return { success: false, pointCounts: {}, totalPoints: 0, error };
    }

    // Guard: Pipeline must be initialized
    if (!this.pipeline) {
      const error = 'Pipeline not initialized';
      console.error('[ToolingFixtureAnimator]', error);
      return { success: false, pointCounts: {}, totalPoints: 0, error };
    }

    // Guard: Must have moving units
    if (this.movingUnits.length === 0) {
      const error = 'No moving units to capture. Run analyzeFixture() first.';
      console.error('[ToolingFixtureAnimator]', error);
      return { success: false, pointCounts: {}, totalPoints: 0, error };
    }

    console.log('[ToolingFixtureAnimator] ========== STEP 2a: CAPTURE RETRACTED STATE ==========');

    const pointCounts: Record<string, number> = {};
    let totalPoints = 0;

    for (const unit of this.movingUnits) {
      await this.pipeline.captureUnitState(unit.id, 'retract', this.pipelineOptions?.stateCapture);
      const pair = this.pipeline.getStatePairs().get(unit.id);
      const count = pair?.retracted?.pointCloud.length ?? 0;
      pointCounts[unit.id] = count;
      totalPoints += count;

      console.log('[ToolingFixtureAnimator] Captured:', {
        unitName: unit.name,
        unitId: unit.id,
        pointCount: count,
        nodeCount: unit.nodes.length,
      });
    }

    // Guard: No points captured
    if (totalPoints === 0) {
      const error = 'No points captured for retracted state. Check that moving units have mesh geometry.';
      console.error('[ToolingFixtureAnimator]', error);
      return { success: false, pointCounts, totalPoints: 0, error };
    }

    this.workflowState = 'retracted_captured';
    console.log('[ToolingFixtureAnimator] Retracted state capture complete:', { totalPoints, unitCount: this.movingUnits.length });
    return { success: true, pointCounts, totalPoints };
  }

  /**
   * Step 2b: Capture extended (actuated) state for all moving units.
   * Call this when all moving parts are in their extended position.
   */
  async captureExtendedState(): Promise<CaptureResult> {
    // Guard: Must capture retracted first
    if (this.workflowState !== 'retracted_captured') {
      const error = 'Must capture retracted state before extended state';
      console.error('[ToolingFixtureAnimator]', error);
      return { success: false, pointCounts: {}, totalPoints: 0, error };
    }

    // Guard: Pipeline must be initialized
    if (!this.pipeline) {
      const error = 'Pipeline not initialized';
      console.error('[ToolingFixtureAnimator]', error);
      return { success: false, pointCounts: {}, totalPoints: 0, error };
    }

    console.log('[ToolingFixtureAnimator] ========== STEP 2b: CAPTURE EXTENDED STATE ==========');

    const pointCounts: Record<string, number> = {};
    let totalPoints = 0;

    for (const unit of this.movingUnits) {
      await this.pipeline.captureUnitState(unit.id, 'advance', this.pipelineOptions?.stateCapture);
      const pair = this.pipeline.getStatePairs().get(unit.id);
      const count = pair?.extended?.pointCloud.length ?? 0;
      pointCounts[unit.id] = count;
      totalPoints += count;

      console.log('[ToolingFixtureAnimator] Captured:', {
        unitName: unit.name,
        unitId: unit.id,
        pointCount: count,
        nodeCount: unit.nodes.length,
      });
    }

    // Guard: No points captured
    if (totalPoints === 0) {
      const error = 'No points captured for extended state. Check that moving units have mesh geometry.';
      console.error('[ToolingFixtureAnimator]', error);
      return { success: false, pointCounts, totalPoints: 0, error };
    }

    this.workflowState = 'extended_captured';
    console.log('[ToolingFixtureAnimator] Extended state capture complete:', { totalPoints, unitCount: this.movingUnits.length });
    return { success: true, pointCounts, totalPoints };
  }

  /**
   * Step 3: Fit joints using ICP on captured states.
   * Call this after capturing both retracted and extended states.
   */
  async fitJoints(): Promise<FitJointsResult> {
    // Guard: Must capture both states first
    if (this.workflowState !== 'extended_captured') {
      const error = 'Must capture both retracted and extended states before fitting joints';
      console.error('[ToolingFixtureAnimator]', error);
      return { success: false, jointCount: 0, joints: [], details: [], error };
    }

    // Guard: Pipeline must be initialized
    if (!this.pipeline) {
      const error = 'Pipeline not initialized';
      console.error('[ToolingFixtureAnimator]', error);
      return { success: false, jointCount: 0, joints: [], details: [], error };
    }

    console.log('[ToolingFixtureAnimator] ========== STEP 3: FIT JOINTS VIA ICP ==========');

    // Run the ICP fitting
    await this.pipeline.fitJoints(this.pipelineOptions);

    const icpResults = this.pipeline.getICPResults();
    const details: JointFitResultInfo[] = [];

    console.log('[ToolingFixtureAnimator] ICP Fitting Complete:', { jointsFitted: icpResults.size });

    // Build detailed results for each unit
    for (const unit of this.movingUnits) {
      const result = icpResults.get(unit.id);

      if (!result) {
        // Unit was not fitted - determine why
        const statePair = this.pipeline.getStatePairs().get(unit.id);
        const retractedPts = statePair?.retracted?.pointCloud.length ?? 0;
        const extendedPts = statePair?.extended?.pointCloud.length ?? 0;

        let reason = 'Unknown failure';
        if (retractedPts === 0 || extendedPts === 0) {
          reason = `Missing point cloud (retracted: ${retractedPts}, extended: ${extendedPts})`;
        } else {
          reason = 'No motion detected between states. Move the clamp further between captures.';
        }

        details.push({
          unitId: unit.id,
          unitName: unit.name,
          success: false,
          jointType: 'none',
          angleDeg: 0,
          angleRad: 0,
          axis: { x: 0, y: 0, z: 0 },
          pivot: { x: 0, y: 0, z: 0 },
          confidence: 0,
          rmsErrorMm: 0,
          reason,
        });

        console.warn('[ToolingFixtureAnimator] Joint fit FAILED:', {
          unitName: unit.name,
          unitId: unit.id,
          reason,
        });
        continue;
      }

      // Successfully fitted joint
      const angleDeg = (result.jointFit.magnitude * 180) / Math.PI;
      const rmsErrorMm = result.icpResult.rmsError * 1000;

      details.push({
        unitId: unit.id,
        unitName: unit.name,
        success: true,
        jointType: result.jointFit.type,
        angleDeg,
        angleRad: result.jointFit.magnitude,
        axis: {
          x: result.jointFit.axis.x,
          y: result.jointFit.axis.y,
          z: result.jointFit.axis.z,
        },
        pivot: {
          x: result.jointFit.anchor.x,
          y: result.jointFit.anchor.y,
          z: result.jointFit.anchor.z,
        },
        confidence: result.jointFit.confidence,
        rmsErrorMm,
      });

      console.log('[ToolingFixtureAnimator] Joint fit SUCCESS:', {
        unitName: unit.name,
        unitId: unit.id,
        jointType: result.jointFit.type,
        angleDeg: angleDeg.toFixed(1),
        angleRad: result.jointFit.magnitude.toFixed(4),
        axis: `(${result.jointFit.axis.x.toFixed(3)}, ${result.jointFit.axis.y.toFixed(3)}, ${result.jointFit.axis.z.toFixed(3)})`,
        pivot: `(${result.jointFit.anchor.x.toFixed(3)}, ${result.jointFit.anchor.y.toFixed(3)}, ${result.jointFit.anchor.z.toFixed(3)})`,
        confidence: result.jointFit.confidence.toFixed(2),
        rmsErrorMm: rmsErrorMm.toFixed(2),
      });
    }

    // Guard: No joints fitted
    if (icpResults.size === 0) {
      const error = 'No joints fitted. Ensure moving units actually moved between captures.';
      console.error('[ToolingFixtureAnimator]', error);
      return { success: false, jointCount: 0, joints: [], details, error };
    }

    // Convert to legacy JSON and set up joints
    const legacyJson = this.pipeline.exportToLegacyJSON();
    this.toolingJson = legacyJson;
    this.joints = this.convertToJoints(legacyJson);

    this.workflowState = 'joints_fitted';

    console.log('[ToolingFixtureAnimator] Joint fitting complete:', {
      totalJoints: this.joints.length,
      successfulFits: details.filter(d => d.success).length,
      failedFits: details.filter(d => !d.success).length,
    });

    return { success: true, jointCount: this.joints.length, joints: this.joints, details };
  }

  /**
   * Step 4: Setup ValveBank for animation.
   * Call this after fitting joints.
   */
  setupAnimation(): void {
    if (this.workflowState !== 'joints_fitted') {
      throw new Error('[ToolingFixtureAnimator] Must fit joints before setting up animation');
    }

    console.log('[ToolingFixtureAnimator] Step 4: Setting up ValveBank for animation...');
    this.setupValveBank();
    this.workflowState = 'ready_to_play';
    console.log('[ToolingFixtureAnimator] Ready to play animation!');
  }

  /**
   * Prepare the animator by running extraction (if needed) and setting up ValveBank.
   *
   * @throws Error if extraction fails or no joints found
   */
  async prepare(): Promise<void> {
    // If tooling JSON provided, use it directly
    if (this.toolingJson) {
      this.joints = this.convertToJoints(this.toolingJson);
      this.setupValveBank();
      return;
    }

    // Otherwise, run extraction pipeline
    if (!this.pipeline) {
      this.pipeline = new KinematicExtractionPipeline(this.scene);
    }

    console.log('[ToolingFixtureAnimator] Running kinematic extraction pipeline...');
    await this.pipeline.analyzeScene(this.pipelineOptions, this.rootNode);

    const statePairs = this.pipeline.getStatePairs();
    if (statePairs.size === 0) {
      const graph = this.pipeline.getToolGraph();
      let movingUnits = graph?.units.filter(u => !u.isFixed) || [];
      if (movingUnits.length === 0 && graph?.units?.length) {
        movingUnits = graph.units;
      }
      for (const unit of movingUnits) {
        await this.pipeline.captureUnitState(unit.id, 'retract', this.pipelineOptions?.stateCapture);
        const pair = this.pipeline.getStatePairs().get(unit.id);
        const pts = pair?.retracted?.pointCloud || [];
        if (pts.length === 0) {
          continue;
        }
        const centroid = pts.reduce((acc, p) => acc.add(p), BABYLON.Vector3.Zero()).scale(1 / pts.length);
        const angle = Math.PI / 18;
        const R = BABYLON.Matrix.RotationAxis(BABYLON.Vector3.Up(), angle);
        const rotated = pts.map(p => {
          const v = p.subtract(centroid);
          const vr = BABYLON.Vector3.TransformCoordinates(v, R);
          return vr.add(centroid);
        });
        await this.pipeline.captureUnitStateFromPoints(unit.id, 'advance', rotated);
      }
    }

    await this.pipeline.fitJoints(this.pipelineOptions);
    const legacyJson = this.pipeline.exportToLegacyJSON();
    this.toolingJson = legacyJson;
    this.joints = this.convertToJoints(legacyJson);
    this.setupValveBank();
    return;
  }

  /**
   * Convert tooling JSON to joint definitions.
   */
  private convertToJoints(json: ToolingFileJson): JointDefinitionOutput[] {
    const resolveParentId = (movingNodePath: string): string => {
      // Extract parent path from node path
      const idx = movingNodePath.lastIndexOf('/');
      if (idx > 0) {
        return movingNodePath.substring(0, idx);
      }

      // Fallback: try to find parent in scene tree
      const tree = SceneTreeManager.getInstance();
      const node = tree.getNode(movingNodePath);
      if (node?.parentId) {
        return node.parentId;
      }

      // Ultimate fallback: use root node
      return this.rootNode.id || 'WORLD';
    };

    return toolingJsonToJoints(json, resolveParentId);
  }

  /**
   * Set up ValveBank with all joints and auto-create channels.
   */
  private setupValveBank(): void {
    if (!this.valveBank) {
      this.valveBank = new ValveBank(this.scene);
    }

    // Convert JointDefinitionOutput to JointDefinition for ValveBank
    for (const jointOut of this.joints) {
      const jointDef: JointDefinition = {
        id: jointOut.id,
        kind: jointOut.type,
        parentNodeId: jointOut.parentId,
        childNodeId: jointOut.childId,
        axisWorld: jointOut.axisWorld,
        anchorWorld: jointOut.anchorWorld,
        limits: jointOut.limits,
      };

      this.valveBank.registerJoint(jointDef);

      // Auto-create channel
      const channel: Channel = {
        id: jointOut.id,
        unitId: jointOut.id,
        jointId: jointOut.id,
        advanceValue: jointOut.limits.upper,
        retractValue: jointOut.limits.lower,
      };

      this.valveBank.addChannel(channel);
    }

    console.log(
      `[ToolingFixtureAnimator] Setup complete: ${this.joints.length} joints, ${this.joints.length} channels`
    );
  }

  /**
   * Play a simple extend/retract cycle for all joints.
   *
   * Timeline:
   * - t=0ms: Extend all channels
   * - t=1500ms: Retract all channels
   */
  async playDemoCycle(): Promise<void> {
    if (!this.valveBank) {
      throw new Error('[ToolingFixtureAnimator] Must call prepare() before playDemoCycle()');
    }

    if (this.joints.length === 0) {
      console.warn('[ToolingFixtureAnimator] No joints to animate');
      return;
    }

    const events: TimelineEvent[] = [];

    // Extend all at t=0
    for (const joint of this.joints) {
      events.push({
        tMs: 0,
        cmd: 'extend',
        channelId: joint.id,
      });
    }

    // Retract all at t=1500ms
    for (const joint of this.joints) {
      events.push({
        tMs: 1500,
        cmd: 'retract',
        channelId: joint.id,
      });
    }

    console.log(`[ToolingFixtureAnimator] Playing demo cycle: ${events.length} events`);
    await this.valveBank.runTimeline(events, { stepMs: 16 });
  }

  /**
   * Get the ValveBank instance for custom timeline control.
   */
  getValveBank(): ValveBank {
    if (!this.valveBank) {
      throw new Error('[ToolingFixtureAnimator] Must call prepare() before getValveBank()');
    }
    return this.valveBank;
  }

  /**
   * Get all joint definitions.
   */
  getJoints(): JointDefinitionOutput[] {
    return this.joints;
  }

  /**
   * Get summary statistics.
   */
  getSummary(): {
    jointCount: number;
    channelCount: number;
    highErrorJoints: Array<{ id: string; error?: number }>;
  } {
    const highErrorJoints: Array<{ id: string; error?: number }> = [];

    // Check for high RMS errors if we have pipeline results
    if (this.pipeline) {
      const icpResults = this.pipeline.getICPResults();
      for (const [unitId, result] of icpResults.entries()) {
        if (result.icpResult.rmsError > 0.01) {
          // > 1cm error
          highErrorJoints.push({
            id: unitId,
            error: result.icpResult.rmsError,
          });
        }
      }
    }

    return {
      jointCount: this.joints.length,
      channelCount: this.joints.length,
      highErrorJoints,
    };
  }
}
