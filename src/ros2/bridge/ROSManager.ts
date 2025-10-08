/**
 * ROS Manager
 * High-level interface for ROS 2 operations in kinetiCORE
 */

import { ROSBridgeClient } from './ROSBridgeClient';
import { JointState, JointTrajectory, TFMessage, TransformStamped } from '../messages';
import { TrajectoryExporter } from '../exporters';
import { RobotTrajectory } from '../../pathPlanning/types';
import { TrajectoryOptimizer } from '../../pathPlanning/TrajectoryOptimizer';

export interface ROSManagerOptions {
  /** WebSocket URL (default: 'ws://localhost:9090') */
  url?: string;

  /** Auto-subscribe to common topics (default: true) */
  autoSubscribe?: boolean;
}

export interface DeployTrajectoryOptions {
  /** Controller name (default: 'joint_trajectory_controller') */
  controllerName?: string;

  /** Goal time tolerance in seconds (default: 1.0) */
  goalTimeTolerance?: number;
}

/**
 * Manages ROS 2 integration for kinetiCORE
 */
export class ROSManager {
  private bridge: ROSBridgeClient;
  private exporter: TrajectoryExporter | null = null;
  private jointStateCallback: ((state: JointState) => void) | null = null;
  private tfCallback: ((tf: TFMessage) => void) | null = null;

  constructor(options: ROSManagerOptions = {}) {
    this.bridge = new ROSBridgeClient({
      autoReconnect: true,
      reconnectDelay: 3000,
      maxReconnectAttempts: 10
    });
  }

  /**
   * Connect to ROS 2 system via rosbridge
   * @param url - WebSocket URL (default: 'ws://localhost:9090')
   */
  async connect(url: string = 'ws://localhost:9090'): Promise<void> {
    await this.bridge.connect(url);
    console.log('[ROSManager] Connected to ROS 2');
  }

  /**
   * Disconnect from ROS 2
   */
  disconnect(): void {
    this.bridge.disconnect();
    console.log('[ROSManager] Disconnected from ROS 2');
  }

  /**
   * Check if connected to ROS 2
   */
  isConnected(): boolean {
    return this.bridge.isConnected();
  }

  /**
   * Initialize trajectory exporter
   * @param optimizer - TrajectoryOptimizer instance
   */
  setTrajectoryOptimizer(optimizer: TrajectoryOptimizer): void {
    this.exporter = new TrajectoryExporter(optimizer);
  }

  /**
   * Deploy trajectory to robot controller
   * @param trajectory - kinetiCORE trajectory
   * @param jointNames - Joint names matching robot description
   * @param options - Deployment options
   */
  async deployTrajectory(
    trajectory: RobotTrajectory,
    jointNames: string[],
    options: DeployTrajectoryOptions = {}
  ): Promise<void> {
    if (!this.exporter) {
      throw new Error('TrajectoryOptimizer not set. Call setTrajectoryOptimizer() first.');
    }

    const {
      controllerName = 'joint_trajectory_controller',
      goalTimeTolerance = 1.0
    } = options;

    // Export trajectory to ROS 2 format
    const actionGoal = this.exporter.exportAsActionGoal(trajectory, jointNames, {
      samplingRate: 100,
      includeVelocities: true,
      includeAccelerations: true
    });

    // Override goal time tolerance if specified
    if (goalTimeTolerance !== 1.0) {
      actionGoal.goal_time_tolerance = {
        sec: Math.floor(goalTimeTolerance),
        nanosec: Math.floor((goalTimeTolerance % 1) * 1e9)
      };
    }

    // Send to controller via action interface
    // Note: rosbridge doesn't natively support actions, so we publish directly
    // to the controller's topic (simplified approach for Phase 2)
    const topic = `/${controllerName}/joint_trajectory`;
    const messageType = 'trajectory_msgs/JointTrajectory';

    this.bridge.advertise(topic, messageType);
    this.bridge.publish(topic, messageType, actionGoal.trajectory);

    console.log(`[ROSManager] Trajectory deployed to ${controllerName}`);
  }

  /**
   * Publish a single joint trajectory message
   * @param trajectory - JointTrajectory message
   * @param topic - Topic name (default: '/joint_trajectory')
   */
  publishJointTrajectory(
    trajectory: JointTrajectory,
    topic: string = '/joint_trajectory'
  ): void {
    const messageType = 'trajectory_msgs/JointTrajectory';
    this.bridge.advertise(topic, messageType);
    this.bridge.publish(topic, messageType, trajectory);
  }

  /**
   * Subscribe to robot joint states
   * @param callback - Callback for joint state updates
   * @param topic - Topic name (default: '/joint_states')
   */
  subscribeToJointStates(
    callback: (state: JointState) => void,
    topic: string = '/joint_states'
  ): void {
    this.jointStateCallback = callback;
    this.bridge.subscribe<JointState>(
      topic,
      'sensor_msgs/JointState',
      (msg) => {
        if (this.jointStateCallback) {
          this.jointStateCallback(msg);
        }
      }
    );
    console.log(`[ROSManager] Subscribed to ${topic}`);
  }

  /**
   * Unsubscribe from joint states
   */
  unsubscribeFromJointStates(): void {
    this.bridge.unsubscribe('/joint_states');
    this.jointStateCallback = null;
  }

  /**
   * Subscribe to TF transforms
   * @param callback - Callback for TF updates
   * @param topic - Topic name (default: '/tf')
   */
  subscribeToTF(
    callback: (tf: TFMessage) => void,
    topic: string = '/tf'
  ): void {
    this.tfCallback = callback;
    this.bridge.subscribe<TFMessage>(
      topic,
      'tf2_msgs/TFMessage',
      (msg) => {
        if (this.tfCallback) {
          this.tfCallback(msg);
        }
      }
    );
    console.log(`[ROSManager] Subscribed to ${topic}`);
  }

  /**
   * Unsubscribe from TF
   */
  unsubscribeFromTF(): void {
    this.bridge.unsubscribe('/tf');
    this.tfCallback = null;
  }

  /**
   * Publish a transform to /tf
   * @param transform - Transform to publish
   */
  publishTransform(transform: TransformStamped): void {
    const topic = '/tf';
    const messageType = 'tf2_msgs/TFMessage';

    const tfMessage: TFMessage = {
      transforms: [transform]
    };

    this.bridge.advertise(topic, messageType);
    this.bridge.publish(topic, messageType, tfMessage);
  }

  /**
   * Get list of available ROS topics
   * @returns Promise resolving to array of topic names
   */
  async getTopics(): Promise<string[]> {
    try {
      const result = await this.bridge.callService<
        Record<string, never>,
        { topics: string[] }
      >(
        '/rosapi/topics',
        'rosapi/Topics',
        {}
      );
      return result.topics;
    } catch (error) {
      console.error('[ROSManager] Failed to get topics:', error);
      return [];
    }
  }

  /**
   * Get list of available ROS nodes
   * @returns Promise resolving to array of node names
   */
  async getNodes(): Promise<string[]> {
    try {
      const result = await this.bridge.callService<
        Record<string, never>,
        { nodes: string[] }
      >(
        '/rosapi/nodes',
        'rosapi/Nodes',
        {}
      );
      return result.nodes;
    } catch (error) {
      console.error('[ROSManager] Failed to get nodes:', error);
      return [];
    }
  }

  /**
   * Get ROS parameter value
   * @param name - Parameter name
   * @returns Promise resolving to parameter value
   */
  async getParameter<T = unknown>(name: string): Promise<T | null> {
    try {
      const result = await this.bridge.callService<
        { name: string },
        { value: T }
      >(
        '/rosapi/get_param',
        'rosapi/GetParam',
        { name }
      );
      return result.value;
    } catch (error) {
      console.error(`[ROSManager] Failed to get parameter ${name}:`, error);
      return null;
    }
  }

  /**
   * Set ROS parameter value
   * @param name - Parameter name
   * @param value - Parameter value
   */
  async setParameter<T = unknown>(name: string, value: T): Promise<boolean> {
    try {
      await this.bridge.callService<
        { name: string; value: T },
        Record<string, never>
      >(
        '/rosapi/set_param',
        'rosapi/SetParam',
        { name, value }
      );
      return true;
    } catch (error) {
      console.error(`[ROSManager] Failed to set parameter ${name}:`, error);
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return this.bridge.getStats();
  }
}
