/**
 * TF (Transform) Visualizer
 * Visualizes ROS 2 TF transform tree in Babylon.js scene
 */

import * as BABYLON from '@babylonjs/core';
import { TransformStamped, TFMessage } from '../messages';
// import { fromROSTime } from '../utils';

export interface TFFrameNode {
  name: string;
  parent: string | null;
  transform: TransformStamped;
  lastUpdate: number; // timestamp in seconds
  children: string[];
}

export interface TFVisualizerOptions {
  /** Show coordinate frame axes (default: true) */
  showAxes?: boolean;

  /** Axis length in meters (default: 0.1) */
  axisLength?: number;

  /** Show frame labels (default: true) */
  showLabels?: boolean;

  /** Show parent-child connections (default: true) */
  showConnections?: boolean;

  /** Auto-hide frames older than this (seconds, default: 5.0) */
  maxAge?: number;

  /** Layer mask for visibility control (default: 0) */
  layerMask?: number;
}

/**
 * Manages TF transform visualization in Babylon.js
 */
export class TFVisualizer {
  private scene: BABYLON.Scene;
  private frames: Map<string, TFFrameNode> = new Map();
  private frameAxes: Map<string, BABYLON.TransformNode> = new Map();
    // const _frameLabels = new Map<string, GUI.TextBlock>();
  private connections: Map<string, BABYLON.LinesMesh> = new Map();
  private options: Required<TFVisualizerOptions>;
  private rootTransform: BABYLON.TransformNode;

  constructor(scene: BABYLON.Scene, options: TFVisualizerOptions = {}) {
    this.scene = scene;
    this.options = {
      showAxes: options.showAxes ?? true,
      axisLength: options.axisLength ?? 0.1,
      showLabels: options.showLabels ?? true,
      showConnections: options.showConnections ?? true,
      maxAge: options.maxAge ?? 5.0,
      layerMask: options.layerMask ?? 0
    };

    // Create root transform node
    this.rootTransform = new BABYLON.TransformNode('tf_root', this.scene);
  }

  /**
   * Update transforms from TF message
   */
  updateFromTFMessage(tfMessage: TFMessage): void {
    const now = Date.now() / 1000;

    tfMessage.transforms.forEach((transform) => {
      this.updateFrame(transform, now);
    });

    // Remove stale frames
    this.removeStaleFrames(now);
  }

  /**
   * Update a single transform frame
   */
  private updateFrame(transform: TransformStamped, now: number): void {
    const childFrame = transform.child_frame_id;
    const parentFrame = transform.header.frame_id;

    // Get or create frame node
    let frameNode = this.frames.get(childFrame);
    if (!frameNode) {
      frameNode = {
        name: childFrame,
        parent: parentFrame,
        transform,
        lastUpdate: now,
        children: []
      };
      this.frames.set(childFrame, frameNode);

      // Add to parent's children list
      const parent = this.frames.get(parentFrame);
      if (parent && !parent.children.includes(childFrame)) {
        parent.children.push(childFrame);
      }
    } else {
      // Update existing frame
      frameNode.transform = transform;
      frameNode.lastUpdate = now;
      frameNode.parent = parentFrame;
    }

    // Update visualization
    this.updateFrameVisualization(frameNode);
  }

  /**
   * Update Babylon.js visualization for a frame
   */
  private updateFrameVisualization(frameNode: TFFrameNode): void {
    const frameName = frameNode.name;
    const transform = frameNode.transform.transform;

    // Get or create transform node
    let axesNode = this.frameAxes.get(frameName);
    if (!axesNode) {
      axesNode = this.createFrameAxes(frameName);
      this.frameAxes.set(frameName, axesNode);
    }

    // Update position and rotation
    axesNode.position = new BABYLON.Vector3(
      transform.translation.x,
      transform.translation.z, // Z-up conversion
      transform.translation.y
    );

    axesNode.rotationQuaternion = new BABYLON.Quaternion(
      transform.rotation.x,
      transform.rotation.z, // Z-up conversion
      transform.rotation.y,
      transform.rotation.w
    );

    // Update parent-child connection line
    if (this.options.showConnections && frameNode.parent) {
      this.updateConnection(frameNode);
    }

    // Update label
    if (this.options.showLabels) {
      this.updateLabel(frameNode, axesNode);
    }
  }

  /**
   * Create coordinate axes for a frame
   */
  private createFrameAxes(frameName: string): BABYLON.TransformNode {
    const node = new BABYLON.TransformNode(frameName, this.scene);
    node.parent = this.rootTransform;

    if (this.options.showAxes) {
      const axisLength = this.options.axisLength;

      // X axis (red)
      const xAxis = BABYLON.MeshBuilder.CreateLines(
        `${frameName}_x`,
        {
          points: [
            BABYLON.Vector3.Zero(),
            new BABYLON.Vector3(axisLength, 0, 0)
          ]
        },
        this.scene
      );
      xAxis.color = new BABYLON.Color3(1, 0, 0);
      xAxis.parent = node;

      // Y axis (green)
      const yAxis = BABYLON.MeshBuilder.CreateLines(
        `${frameName}_y`,
        {
          points: [
            BABYLON.Vector3.Zero(),
            new BABYLON.Vector3(0, axisLength, 0)
          ]
        },
        this.scene
      );
      yAxis.color = new BABYLON.Color3(0, 1, 0);
      yAxis.parent = node;

      // Z axis (blue)
      const zAxis = BABYLON.MeshBuilder.CreateLines(
        `${frameName}_z`,
        {
          points: [
            BABYLON.Vector3.Zero(),
            new BABYLON.Vector3(0, 0, axisLength)
          ]
        },
        this.scene
      );
      zAxis.color = new BABYLON.Color3(0, 0, 1);
      zAxis.parent = node;
    }

    return node;
  }

  /**
   * Update connection line between parent and child frames
   */
  private updateConnection(frameNode: TFFrameNode): void {
    if (!frameNode.parent) return;

    const parentNode = this.frameAxes.get(frameNode.parent);
    const childNode = this.frameAxes.get(frameNode.name);

    if (!parentNode || !childNode) return;

    const connectionName = `${frameNode.parent}_to_${frameNode.name}`;
    let connection = this.connections.get(connectionName);

    const points = [
      parentNode.position.clone(),
      childNode.position.clone()
    ];

    if (!connection) {
      connection = BABYLON.MeshBuilder.CreateLines(
        connectionName,
        { points },
        this.scene
      );
      connection.color = new BABYLON.Color3(0.5, 0.5, 0.5);
      connection.alpha = 0.5;
      this.connections.set(connectionName, connection);
    } else {
      connection = BABYLON.MeshBuilder.CreateLines(
        connectionName,
        { points, instance: connection },
        this.scene
      );
    }
  }

  /**
   * Update label for a frame
   */
  private updateLabel(_frameNode: TFFrameNode, _axesNode: BABYLON.TransformNode): void {
    // Note: Labels would typically use BABYLON.GUI.AdvancedDynamicTexture
    // For now, this is a placeholder for the label system
    // Full implementation would require GUI setup
  }

  /**
   * Remove frames that haven't been updated recently
   */
  private removeStaleFrames(now: number): void {
    const staleFrames: string[] = [];

    this.frames.forEach((frame, name) => {
      if (now - frame.lastUpdate > this.options.maxAge) {
        staleFrames.push(name);
      }
    });

    staleFrames.forEach((name) => this.removeFrame(name));
  }

  /**
   * Remove a frame and its visualization
   */
  private removeFrame(frameName: string): void {
    // Remove from parent's children
    const frame = this.frames.get(frameName);
    if (frame && frame.parent) {
      const parent = this.frames.get(frame.parent);
      if (parent) {
        const index = parent.children.indexOf(frameName);
        if (index > -1) {
          parent.children.splice(index, 1);
        }
      }
    }

    // Dispose axes
    const axes = this.frameAxes.get(frameName);
    if (axes) {
      axes.dispose();
      this.frameAxes.delete(frameName);
    }

    // Dispose connections
    this.connections.forEach((connection, name) => {
      if (name.includes(frameName)) {
        connection.dispose();
        this.connections.delete(name);
      }
    });

    // Remove frame data
    this.frames.delete(frameName);
  }

  /**
   * Get all frame names
   */
  getFrameNames(): string[] {
    return Array.from(this.frames.keys());
  }

  /**
   * Get frame hierarchy as tree structure
   */
  getFrameTree(): TFFrameNode[] {
    const roots: TFFrameNode[] = [];

    this.frames.forEach((frame) => {
      if (!frame.parent || !this.frames.has(frame.parent)) {
        roots.push(frame);
      }
    });

    return roots;
  }

  /**
   * Get transform from one frame to another
   */
  getTransform(fromFrame: string, toFrame: string): BABYLON.Matrix | null {
    // This would require full TF tree traversal and transform composition
    // Simplified implementation for now
    const from = this.frameAxes.get(fromFrame);
    const to = this.frameAxes.get(toFrame);

    if (!from || !to) return null;

    const fromMatrix = from.getWorldMatrix();
    const toMatrix = to.getWorldMatrix();

    return fromMatrix.multiply(BABYLON.Matrix.Invert(toMatrix));
  }

  /**
   * Show/hide all visualizations
   */
  setVisible(visible: boolean): void {
    this.rootTransform.setEnabled(visible);
  }

  /**
   * Clear all frames
   */
  clear(): void {
    this.frames.forEach((_, name) => this.removeFrame(name));
    this.frames.clear();
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.clear();
    this.rootTransform.dispose();
  }
}
