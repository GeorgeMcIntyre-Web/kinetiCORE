/**
 * IKinematicsManager Interface
 * Extracted to break circular dependency with ActuatorSystem
 */

import type { JointConfig, KinematicChain, TCPFrame, BaseFrame, RobotKeyframe } from './KinematicsManager';

/**
 * Interface for KinematicsManager
 * Use this interface for dependencies to avoid circular imports
 */
export interface IKinematicsManager {
  // Joint management
  getJoint(jointId: string): JointConfig | undefined;
  getAllJoints(): JointConfig[];
  getNodeJoints(nodeId: string): JointConfig[];
  createJoint(config: Partial<JointConfig>): JointConfig | null;
  deleteJoint(jointId: string): boolean;

  // Chain management
  getChain(name: string): KinematicChain | undefined;
  getAllChains(): KinematicChain[];
  getChainJoints(chainId: string): JointConfig[];
  createChain(name: string, rootNodeId: string, type?: 'serial' | 'parallel' | 'tree' | 'closed'): KinematicChain;

  // Grounding
  groundNode(nodeId: string, lockPosition?: boolean): boolean;
  ungroundNode(nodeId: string): boolean;
  isGrounded(nodeId: string): boolean;
  getGroundedNodes(): string[];

  // TCP frames
  addTCPFrame(chainId: string, tcpFrame: TCPFrame): boolean;
  getTCPFrames(chainId: string): TCPFrame[];
  setBaseFrame(chainId: string, baseFrame: BaseFrame): boolean;
  getBaseFrame(chainId: string): BaseFrame | undefined;

  // Keyframes
  addKeyframe(keyframe: RobotKeyframe): void;
  getKeyframe(keyframeId: string): RobotKeyframe | undefined;
  getKeyframesForChain(chainId: string): RobotKeyframe[];
  getAllKeyframes(): RobotKeyframe[];
  deleteKeyframe(keyframeId: string): boolean;
  captureCurrentPose(chainId: string, name: string, description?: string): RobotKeyframe;

  // Visualization
  showJointAxis(jointId: string, scene: any): void;
  hideJointVisuals(jointId: string): void;

  // Utility
  reset(): void;
}
