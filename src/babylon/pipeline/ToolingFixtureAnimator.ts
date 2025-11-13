import * as BABYLON from '@babylonjs/core';
import { KinematicExtractionPipeline, type PipelineOptions } from './KinematicExtractionPipeline';
import { toolingJsonToJoints, type ToolingFileJson } from '../io/ToolingJsonAdapter';
import { ValveBank, type Channel, type TimelineEvent } from '../actuation/ValveBank';
import { JointDefinition, type JointDefinitionOutput } from '../io/Schemas';
import { JointMath } from '../kinematics/JointMath';
import { SceneTreeManager } from '../../scene/SceneTreeManager';

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

  constructor(options: ToolingFixtureAnimatorOptions) {
    this.scene = options.scene;
    this.rootNode = options.rootNode;
    this.toolingJson = options.toolingJson || null;
    this.pipelineOptions = options.pipelineOptions;
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

    // Run analysis first
    console.log('[ToolingFixtureAnimator] Running kinematic extraction pipeline...');
    await this.pipeline.analyzeScene(this.pipelineOptions, this.rootNode);

    // Check if states are already captured
    const statePairs = this.pipeline.getStatePairs();
    if (statePairs.size > 0) {
      // States already captured, fit joints
      await this.pipeline.fitJoints(this.pipelineOptions);
      const legacyJson = this.pipeline.exportToLegacyJSON();
      this.toolingJson = legacyJson;
      this.joints = this.convertToJoints(legacyJson);
      this.setupValveBank();
      return;
    }

    // No states captured - user must capture states first
    // This is expected for the current workflow where user manually positions parts
    throw new Error(
      '[ToolingFixtureAnimator] No tooling JSON provided and no states captured. ' +
      'Please either:\n' +
      '1. Provide precomputed toolingJson in options, or\n' +
      '2. Capture states first using:\n' +
      '   - pipeline.captureRetractedStates()\n' +
      '   - (manually position parts in extended state)\n' +
      '   - pipeline.captureExtendedStates()\n' +
      'Then call prepare() again.'
    );
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
