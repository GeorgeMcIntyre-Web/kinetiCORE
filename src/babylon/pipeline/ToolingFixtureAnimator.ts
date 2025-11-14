/**
 * Tooling Fixture Animator
 * 
 * Complete integration helper for auto tooling kinematics pipeline:
 * GLB Model → Extract Joints → Register → Connect Actuators → Animate
 * 
 * This bridges the gap between:
 * - KinematicExtractionPipeline (extracts joints from GLB)
 * - ToolingJsonAdapter (loads joints from JSON)
 * - KinematicsManager (registers joints)
 * - ActuatorSystem (controls joints via actuators/valves)
 * 
 * Usage:
 * ```typescript
 * const animator = new ToolingFixtureAnimator(scene);
 * 
 * // Option 1: Load from extracted pipeline
 * const pipeline = new KinematicExtractionPipeline(scene);
 * await pipeline.runComplete();
 * const model = pipeline.exportToJSON();
 * await animator.loadFromExtractedModel(model);
 * 
 * // Option 2: Load from tooling JSON file
 * const json = await fetch('/path/to/tooling.json').then(r => r.json());
 * await animator.loadFromToolingJson(json);
 * 
 * // Animate fixture
 * await animator.animateJoint('UNIT_112_LH_Clamp', 0.5); // 50% extended
 * await animator.animateAllJoints({ 'UNIT_112_LH_Clamp': 0.8, 'UNIT_112_RH_Clamp': 0.8 });
 * 
 * // Or use timeline
 * await animator.runTimeline([
 *   { tMs: 0, jointId: 'UNIT_112_LH_Clamp', value: 0.0 },
 *   { tMs: 1000, jointId: 'UNIT_112_LH_Clamp', value: 1.0 },
 *   { tMs: 2000, jointId: 'UNIT_112_RH_Clamp', value: 1.0 },
 * ]);
 * ```
 */

import * as BABYLON from '@babylonjs/core';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import { ActuatorSystem } from '../../kinematics/actuation/ActuatorSystem';
import type { HardwareActuator } from '../../kinematics/device/UnifiedDeviceDefinition';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { toolingJsonToJoints, type ToolingFileJson } from '../io/ToolingJsonAdapter';
import type { KinematicModelExport, JointDefinitionOutput } from '../io/Schemas';
import { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';

export interface TimelineKeyframe {
  /** Time in milliseconds */
  tMs: number;
  /** Joint ID to animate */
  jointId: string;
  /** Joint value (0-1 normalized, or absolute value in joint units) */
  value: number;
}

export interface JointAnimationOptions {
  /** Duration in milliseconds */
  duration?: number;
  /** Easing function: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut' */
  easing?: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
  /** Callback on each frame */
  onUpdate?: (jointId: string, value: number, progress: number) => void;
  /** Callback on completion */
  onComplete?: () => void;
}

/**
 * Complete tooling fixture animator that integrates all systems.
 */
export class ToolingFixtureAnimator {
  private scene: BABYLON.Scene;
  private kinematicsManager: KinematicsManager;
  private actuatorSystem: ActuatorSystem;
  private fkSolver: ForwardKinematicsSolver;
  private sceneTree: SceneTreeManager;

  /** Map of joint ID → actuator ID for direct control */
  private jointToActuator: Map<string, string> = new Map();

  /** Registered joints */
  private registeredJoints: Map<string, string> = new Map(); // jointId → KinematicsManager joint ID

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.kinematicsManager = KinematicsManager.getInstance();
    this.actuatorSystem = new ActuatorSystem();
    this.fkSolver = ForwardKinematicsSolver.getInstance();
    this.sceneTree = SceneTreeManager.getInstance();
  }

  /**
   * Load joints from extracted kinematic model (from KinematicExtractionPipeline).
   */
  async loadFromExtractedModel(model: KinematicModelExport): Promise<void> {
    console.log(`[ToolingFixtureAnimator] Loading ${model.joints.length} joints from extracted model...`);

    for (const jointDef of model.joints) {
      await this.registerJoint(jointDef);
    }

    console.log(`[ToolingFixtureAnimator] ✓ Registered ${this.registeredJoints.size} joints`);
  }

  /**
   * Load joints from tooling JSON file format.
   */
  async loadFromToolingJson(json: ToolingFileJson): Promise<void> {
    console.log(`[ToolingFixtureAnimator] Loading joints from tooling JSON (${json.length} units)...`);

    // Resolve parent IDs from node paths
    const resolveParentId = (childPath: string): string => {
      // Try to find node by ID (if path is just an ID)
      const childNode = this.sceneTree.getNode(childPath);
      if (childNode?.parentId) {
        return childNode.parentId;
      }

      // Fallback: extract parent from path (e.g., "UNIT_112/LH" -> "UNIT_112")
      const idx = childPath.lastIndexOf('/');
      if (idx > 0) {
        const parentPath = childPath.substring(0, idx);
        const parentNode = this.sceneTree.getNode(parentPath);
        if (parentNode) {
          return parentNode.id;
        }
      }

      // Last resort: use root
      const rootNode = this.sceneTree.getRootNode();
      return rootNode?.id || 'WORLD';
    };

    const jointDefs = toolingJsonToJoints(json, resolveParentId);

    for (const jointDef of jointDefs) {
      await this.registerJoint(jointDef);
    }

    console.log(`[ToolingFixtureAnimator] ✓ Registered ${this.registeredJoints.size} joints from JSON`);
  }

  /**
   * Register a single joint and create corresponding actuator.
   */
  private async registerJoint(jointDef: JointDefinitionOutput): Promise<void> {
    // Find or create nodes in SceneTree
    let parentNode = this.sceneTree.getNode(jointDef.parentId);
    let childNode = this.sceneTree.getNode(jointDef.childId);

    // If nodes don't exist, try to find by path or create
    if (!parentNode || !childNode) {
      // Try to find Babylon nodes
      const scene = this.scene;
      const parentBabylon = this.findBabylonNode(jointDef.parentId, scene);
      const childBabylon = this.findBabylonNode(jointDef.childId, scene);

      if (!parentBabylon || !childBabylon) {
        console.warn(`[ToolingFixtureAnimator] Could not find nodes for joint ${jointDef.id}`);
        return;
      }

      // Register in SceneTree if missing
      if (!parentNode && parentBabylon) {
        parentNode = this.sceneTree.createNode(
          'link',
          parentBabylon.name,
          null, // parent will be set if needed
          undefined // position
        );
        // Update ID if needed (SceneTree generates its own IDs)
        if (parentNode.id !== jointDef.parentId) {
          console.warn(`[ToolingFixtureAnimator] Parent node ID mismatch: expected ${jointDef.parentId}, got ${parentNode.id}`);
        }
      }

      if (!childNode && childBabylon) {
        const parentId = parentNode?.id || jointDef.parentId;
        childNode = this.sceneTree.createNode(
          'link',
          childBabylon.name,
          parentId,
          undefined // position
        );
        // Update ID if needed
        if (childNode.id !== jointDef.childId) {
          console.warn(`[ToolingFixtureAnimator] Child node ID mismatch: expected ${jointDef.childId}, got ${childNode.id}`);
        }
      }
    }

    if (!parentNode || !childNode) {
      console.warn(`[ToolingFixtureAnimator] Failed to create nodes for joint ${jointDef.id}`);
      return;
    }

    // Convert joint definition to KinematicsManager format
    const jointType = jointDef.type === 'prismatic' ? 'prismatic' : 'revolute';

    // Create joint in KinematicsManager
    const joint = this.kinematicsManager.createJoint({
      id: jointDef.id,
      name: jointDef.id,
      type: jointType,
      parentNodeId: jointDef.parentId,
      childNodeId: jointDef.childId,
      axis: {
        x: jointDef.axisWorld.x,
        y: jointDef.axisWorld.y,
        z: jointDef.axisWorld.z,
      },
      origin: {
        x: jointDef.anchorWorld.x,
        y: jointDef.anchorWorld.y,
        z: jointDef.anchorWorld.z,
      },
      limits: {
        lower: jointDef.limits.lower,
        upper: jointDef.limits.upper,
        velocity: 1.0,
        effort: 10.0,
      },
      position: 0,
    });

    if (!joint) {
      console.warn(`[ToolingFixtureAnimator] Failed to create joint ${jointDef.id}`);
      return;
    }

    this.registeredJoints.set(jointDef.id, joint.id);

    // Create actuator for this joint
    const actuatorId = `${jointDef.id}_actuator`;
    const actuator: HardwareActuator = {
      id: actuatorId,
      name: `${jointDef.id} Actuator`,
      type: jointType === 'prismatic' ? 'linear_actuator' : 'servo_motor',
      controlMode: 'position',
      controlledJoints: [joint.id],
      specs: {
        forceRange: {
          min: 0,
          max: 100, // Default force limit
        },
        ctrlRange: {
          min: jointDef.limits.lower,
          max: jointDef.limits.upper,
        },
      },
      state: {
        enabled: true,
        value: 0,
        velocity: 0,
        fault: false,
      },
      coordination: [
        {
          jointId: joint.id,
          ratio: 1.0, // 1:1 mapping
          offset: 0,
        },
      ],
    };

    this.actuatorSystem.registerActuator(actuator);
    this.jointToActuator.set(jointDef.id, actuatorId);

    console.log(`[ToolingFixtureAnimator] ✓ Registered joint ${jointDef.id} with actuator ${actuatorId}`);
  }

  /**
   * Find Babylon node by ID or name.
   */
  private findBabylonNode(nodeId: string, scene: BABYLON.Scene): BABYLON.TransformNode | null {
    // Try by uniqueId first
    const byId = scene.getTransformNodeById(nodeId);
    if (byId) return byId;

    // Try by name
    const byName = scene.getTransformNodeByName(nodeId);
    if (byName) return byName;

    // Try searching all nodes
    for (const node of scene.transformNodes) {
      if (node.name === nodeId || node.id === nodeId || node.uniqueId.toString() === nodeId) {
        return node;
      }
    }

    return null;
  }

  /**
   * Animate a single joint to a target value.
   */
  async animateJoint(
    jointId: string,
    targetValue: number,
    options: JointAnimationOptions = {}
  ): Promise<void> {
    const kmJointId = this.registeredJoints.get(jointId);
    if (!kmJointId) {
      console.warn(`[ToolingFixtureAnimator] Joint not found: ${jointId}`);
      return;
    }

    const joint = this.kinematicsManager.getJoint(kmJointId);
    if (!joint) {
      console.warn(`[ToolingFixtureAnimator] KinematicsManager joint not found: ${kmJointId}`);
      return;
    }

    const startValue = joint.position;
    const duration = options.duration ?? 1000;
    const easing = options.easing ?? 'easeInOut';
    const startTime = performance.now();

    return new Promise((resolve) => {
      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Apply easing
        let eased = progress;
        if (easing === 'easeInOut') {
          eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        } else if (easing === 'easeIn') {
          eased = progress * progress;
        } else if (easing === 'easeOut') {
          eased = 1 - Math.pow(1 - progress, 2);
        }

        const currentValue = startValue + (targetValue - startValue) * eased;

        // Apply joint value
        this.fkSolver.updateJointPosition(kmJointId, currentValue, false);

        if (options.onUpdate) {
          options.onUpdate(jointId, currentValue, progress);
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          if (options.onComplete) {
            options.onComplete();
          }
          resolve();
        }
      };

      animate();
    });
  }

  /**
   * Animate multiple joints simultaneously.
   */
  async animateAllJoints(
    targets: Record<string, number>,
    options: JointAnimationOptions = {}
  ): Promise<void> {
    const promises = Object.entries(targets).map(([jointId, value]) =>
      this.animateJoint(jointId, value, options)
    );

    await Promise.all(promises);
  }

  /**
   * Run a timeline of joint animations.
   */
  async runTimeline(keyframes: TimelineKeyframe[], options: { stepMs?: number } = {}): Promise<void> {
    const stepMs = options.stepMs ?? 16; // ~60 FPS
    const sorted = keyframes.slice().sort((a, b) => a.tMs - b.tMs);

    const startTime = performance.now();
    let currentFrame = 0;

    // Track current values for each joint
    const jointValues = new Map<string, number>();

    return new Promise((resolve) => {
      const animate = () => {
        const elapsed = performance.now() - startTime;

        // Process all keyframes that should have occurred
        while (currentFrame < sorted.length && sorted[currentFrame].tMs <= elapsed) {
          const kf = sorted[currentFrame++];
          jointValues.set(kf.jointId, kf.value);
        }

        // Apply all current joint values
        for (const [jointId, value] of jointValues.entries()) {
          const kmJointId = this.registeredJoints.get(jointId);
          if (kmJointId) {
            this.fkSolver.updateJointPosition(kmJointId, value, false);
          }
        }

        if (currentFrame < sorted.length) {
          setTimeout(animate, stepMs);
        } else {
          resolve();
        }
      };

      animate();
    });
  }

  /**
   * Get current value of a joint (0-1 normalized).
   */
  getJointValue(jointId: string): number | null {
    const kmJointId = this.registeredJoints.get(jointId);
    if (!kmJointId) return null;

    const joint = this.kinematicsManager.getJoint(kmJointId);
    if (!joint) return null;

    // Normalize to 0-1
    const range = joint.limits.upper - joint.limits.lower;
    if (range === 0) return 0;

    return (joint.position - joint.limits.lower) / range;
  }

  /**
   * Get all registered joint IDs.
   */
  getRegisteredJoints(): string[] {
    return Array.from(this.registeredJoints.keys());
  }

  /**
   * Reset all joints to their minimum position.
   */
  async resetAllJoints(options: JointAnimationOptions = {}): Promise<void> {
    const targets: Record<string, number> = {};
    for (const jointId of this.registeredJoints.keys()) {
      targets[jointId] = 0;
    }
    await this.animateAllJoints(targets, options);
  }
}

