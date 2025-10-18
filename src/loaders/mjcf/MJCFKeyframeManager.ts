import { TransformNode, Quaternion } from "@babylonjs/core";
import { convertPosition, convertQuaternion, convertAxis } from "./MJCFCoordinateSystem";

/**
 * Manages keyframe application state and prevents double application
 */
export interface KeyframeApplicationState {
  modelId: string;
  keyframeName: string;
  timestamp: number;
  applied: boolean;
}

/**
 * Keyframe object for registration
 */
export interface KeyframeObject {
  name: string;
  jointValues: number[];
  description: string;
}

/**
 * Keyframe manager for MJCF models
 * Handles state tracking and prevents double application of keyframes
 */
export class MJCFKeyframeManager {
  private static instance: MJCFKeyframeManager;
  // Make applicationStates static so it's accessible from both instance and static methods
  private static applicationStates = new Map<string, KeyframeApplicationState>();
  private registeredKeyframes = new Map<string, KeyframeObject[]>();

  /**
   * Get singleton instance
   */
  static getInstance(): MJCFKeyframeManager {
    if (!this.instance) {
      this.instance = new MJCFKeyframeManager();
    }
    return this.instance;
  }

  /**
   * Register keyframes for a model
   */
  registerKeyframes(modelId: string, keyframes: KeyframeObject[]): void {
    this.registeredKeyframes.set(modelId, keyframes);
    console.log(`[MJCF Keyframe] Registered ${keyframes.length} keyframes for model '${modelId}'`);
  }

  /**
   * Get registered keyframes for a model
   */
  getKeyframes(modelId: string): KeyframeObject[] {
    return this.registeredKeyframes.get(modelId) || [];
  }

  /**
   * Get all registered models with keyframes
   */
  getAllModels(): string[] {
    return Array.from(this.registeredKeyframes.keys());
  }

  /**
   * Check if a keyframe has already been applied
   */
  hasBeenApplied(modelId: string, keyframeName: string): boolean {
    const keyframeId = this.generateKeyframeId(modelId, keyframeName);
    const state = MJCFKeyframeManager.applicationStates.get(keyframeId);
    return state ? state.applied : false;
  }

  /**
   * Mark a keyframe as applied
   */
  markApplied(modelId: string, keyframeName: string): void {
    const keyframeId = this.generateKeyframeId(modelId, keyframeName);
    const state: KeyframeApplicationState = {
      modelId,
      keyframeName,
      timestamp: Date.now(),
      applied: true
    };

    MJCFKeyframeManager.applicationStates.set(keyframeId, state);
    console.log(`[MJCF Keyframe] Marked keyframe '${keyframeId}' as applied`);
  }

  /**
   * Generate a unique keyframe ID for tracking
   */
  private generateKeyframeId(modelId: string, keyframeName: string): string {
    return MJCFKeyframeManager.generateKeyframeId(modelId, keyframeName);
  }

  /**
   * Generate a unique keyframe ID for tracking (static version)
   */
  private static generateKeyframeId(modelId: string, keyframeName: string): string {
    return `${modelId}:${keyframeName}`;
  }

  /**
   * Check if a keyframe has already been applied to prevent double application
   */
  static isKeyframeApplied(rootNode: TransformNode, keyframeId: string): boolean {
    const state = this.applicationStates.get(keyframeId);
    if (!state) return false;

    // Check if the root node has the same keyframe ID in metadata
    const nodeMetadata = rootNode.metadata as any;
    return nodeMetadata?.keyframeId === keyframeId && state.applied;
  }

  /**
   * Mark a keyframe as applied
   */
  static markKeyframeApplied(rootNode: TransformNode, keyframeId: string): void {
    const state: KeyframeApplicationState = {
      modelId: keyframeId.split(':')[0],
      keyframeName: keyframeId.split(':')[1],
      timestamp: Date.now(),
      applied: true
    };

    this.applicationStates.set(keyframeId, state);
    
    // Store in node metadata for quick lookup
    rootNode.metadata = {
      ...rootNode.metadata,
      keyframeId,
      keyframeApplied: true,
      keyframeTimestamp: state.timestamp
    };

    console.log(`[MJCF Keyframe] Marked keyframe '${keyframeId}' as applied at ${new Date(state.timestamp).toISOString()}`);
  }

  /**
   * Reset keyframe application state for a model
   */
  static resetKeyframeState(rootNode: TransformNode): void {
    const nodeMetadata = rootNode.metadata as any;
    if (nodeMetadata?.keyframeId) {
      const keyframeId = nodeMetadata.keyframeId;
      this.applicationStates.delete(keyframeId);
      
      // Clear metadata
      rootNode.metadata = {
        ...rootNode.metadata,
        keyframeId: undefined,
        keyframeApplied: false,
        keyframeTimestamp: undefined
      };

      console.log(`[MJCF Keyframe] Reset keyframe state for '${keyframeId}'`);
    }
  }

  /**
   * Apply keyframe data using pure quaternion math
   */
  static applyKeyframeData(
    rootNode: TransformNode,
    keyframes: Record<string, number[]>,
    jointMap: Record<string, string>,
    jointAxes: Record<string, number[]>,
    modelId: string
  ): void {
    // Find the first keyframe to apply (typically "home")
    const keyframeName = Object.keys(keyframes)[0];
    if (!keyframeName) {
      console.warn("[MJCF Keyframe] No keyframes found to apply");
      return;
    }

    const keyframeId = this.generateKeyframeId(modelId, keyframeName);
    
    // Check if already applied (strict idempotence)
    if (this.isKeyframeApplied(rootNode, keyframeId)) {
      console.log(`[MJCF Keyframe] Keyframe '${keyframeId}' already applied, skipping`);
      return;
    }

    console.log(`[MJCF Keyframe] Applying keyframe '${keyframeName}' to model '${modelId}'`);

    const keyframeData = keyframes[keyframeName];
    if (!keyframeData || keyframeData.length < 7) {
      console.warn(`[MJCF Keyframe] Invalid keyframe data for '${keyframeName}'`);
      return;
    }

    // Parse keyframe data: [px, py, pz, qw, qx, qy, qz, ...jointValues]
    const [px, py, pz, qw, qx, qy, qz, ...jointValues] = keyframeData;

    // Apply base pose to root body
    const rootBody = rootNode.getChildTransformNodes(false)[0];
    if (rootBody) {
      // Apply base position
      rootBody.position = convertPosition([px, py, pz]);
      console.log(`[MJCF Keyframe] Applied base position: (${px}, ${py}, ${pz}) -> (${rootBody.position.x}, ${rootBody.position.y}, ${rootBody.position.z})`);

      // Apply base rotation
      rootBody.rotationQuaternion = convertQuaternion([qw, qx, qy, qz]);
      console.log(`[MJCF Keyframe] Applied base rotation: (${qw}, ${qx}, ${qy}, ${qz})`);
    }

    // Apply joint rotations
    const jointNames = Object.keys(jointMap);
    for (let i = 0; i < jointValues.length && i < jointNames.length; i++) {
      const jointName = jointNames[i];
      const jointValue = jointValues[i];
      const bodyName = jointMap[jointName];

      if (!bodyName) {
        console.warn(`[MJCF Keyframe] No body mapping found for joint '${jointName}'`);
        continue;
      }

      // Find the body node
      const bodyNode = this.findBodyNode(rootNode, bodyName);
      if (!bodyNode) {
        console.warn(`[MJCF Keyframe] Body node '${bodyName}' not found for joint '${jointName}'`);
        continue;
      }

      // Get joint axis
      const axisData = jointAxes[jointName];
      if (!axisData || axisData.length < 3) {
        console.warn(`[MJCF Keyframe] No axis data for joint '${jointName}'`);
        continue;
      }

      // Create rotation from axis-angle
      const axis = convertAxis([axisData[0], axisData[1], axisData[2]]);
      const rotation = Quaternion.RotationAxis(axis, jointValue);

      // Compose with existing rotation (if any from MJCF body quat)
      if (bodyNode.rotationQuaternion) {
        // Apply joint rotation AFTER body base rotation
        bodyNode.rotationQuaternion = rotation.multiply(bodyNode.rotationQuaternion);
      } else {
        bodyNode.rotationQuaternion = rotation;
      }

      console.log(`[MJCF Keyframe] Applied joint '${jointName}' rotation: ${jointValue.toFixed(4)} rad around axis (${axis.x}, ${axis.y}, ${axis.z})`);
    }

    // Mark as applied
    this.markKeyframeApplied(rootNode, keyframeId);
    console.log(`[MJCF Keyframe] Successfully applied keyframe '${keyframeName}' to model '${modelId}'`);
  }

  /**
   * Recursively find a body node by name
   */
  private static findBodyNode(rootNode: TransformNode, bodyName: string): TransformNode | null {
    const allNodes = this.getAllTransformNodes(rootNode);
    return allNodes.find(node => node.name === bodyName) || null;
  }

  /**
   * Recursively collect all transform nodes
   */
  private static getAllTransformNodes(node: TransformNode): TransformNode[] {
    const nodes: TransformNode[] = [node];
    const children = node.getChildTransformNodes(false);
    for (const child of children) {
      nodes.push(...this.getAllTransformNodes(child));
    }
    return nodes;
  }

  /**
   * Get application state for debugging
   */
  static getApplicationState(keyframeId: string): KeyframeApplicationState | undefined {
    return this.applicationStates.get(keyframeId);
  }

  /**
   * Clear all application states (for testing)
   */
  static clearAllStates(): void {
    this.applicationStates.clear();
    console.log("[MJCF Keyframe] Cleared all application states");
  }
}