// CoordinateFrameWidget - Visual RGB axes overlay for custom reference frames
// Owner: George

import * as BABYLON from '@babylonjs/core';
import type { CustomFrameFeature } from '../core/types';
import { userToBabylon } from '../core/CoordinateSystem';

export class CoordinateFrameWidget {
  private scene: BABYLON.Scene;
  private rootNode: BABYLON.TransformNode | null = null;
  private xAxisLine: BABYLON.LinesMesh | null = null;
  private yAxisLine: BABYLON.LinesMesh | null = null;
  private zAxisLine: BABYLON.LinesMesh | null = null;
  private xArrowHead: BABYLON.Mesh | null = null;
  private yArrowHead: BABYLON.Mesh | null = null;
  private zArrowHead: BABYLON.Mesh | null = null;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Show coordinate frame axes at specified feature
   */
  show(frame: CustomFrameFeature, axisLength: number = 0.1): void {
    // Clean up existing widget
    this.hide();

    // Create root node for all axes
    this.rootNode = new BABYLON.TransformNode('customFrameWidget', this.scene);

    const origin = userToBabylon(frame.origin);
    this.rootNode.position = origin;

    // Convert axis vectors to Babylon space and normalize
    const xAxis = new BABYLON.Vector3(frame.xAxis.x, frame.xAxis.y, frame.xAxis.z).normalize();
    const yAxis = new BABYLON.Vector3(frame.yAxis.x, frame.yAxis.y, frame.yAxis.z).normalize();
    const zAxis = new BABYLON.Vector3(frame.zAxis.x, frame.zAxis.y, frame.zAxis.z).normalize();

    // X-axis (Red)
    this.xAxisLine = this.createAxisLine(
      BABYLON.Vector3.Zero(),
      xAxis.scale(axisLength),
      new BABYLON.Color3(1, 0, 0)
    );
    this.xAxisLine.parent = this.rootNode;

    this.xArrowHead = this.createArrowHead(xAxis.scale(axisLength), xAxis, new BABYLON.Color3(1, 0, 0));
    this.xArrowHead.parent = this.rootNode;

    // Y-axis (Green)
    this.yAxisLine = this.createAxisLine(
      BABYLON.Vector3.Zero(),
      yAxis.scale(axisLength),
      new BABYLON.Color3(0, 1, 0)
    );
    this.yAxisLine.parent = this.rootNode;

    this.yArrowHead = this.createArrowHead(yAxis.scale(axisLength), yAxis, new BABYLON.Color3(0, 1, 0));
    this.yArrowHead.parent = this.rootNode;

    // Z-axis (Blue)
    this.zAxisLine = this.createAxisLine(
      BABYLON.Vector3.Zero(),
      zAxis.scale(axisLength),
      new BABYLON.Color3(0, 0, 1)
    );
    this.zAxisLine.parent = this.rootNode;

    this.zArrowHead = this.createArrowHead(zAxis.scale(axisLength), zAxis, new BABYLON.Color3(0, 0, 1));
    this.zArrowHead.parent = this.rootNode;

    // Make widget always render on top
    [this.xAxisLine, this.yAxisLine, this.zAxisLine].forEach((line) => {
      if (line) {
        line.renderingGroupId = 3;
        line.isPickable = false;
      }
    });

    [this.xArrowHead, this.yArrowHead, this.zArrowHead].forEach((arrow) => {
      if (arrow) {
        arrow.renderingGroupId = 3;
        arrow.isPickable = false;
      }
    });
  }

  /**
   * Hide and dispose coordinate frame widget
   */
  hide(): void {
    if (this.xAxisLine) {
      this.xAxisLine.dispose();
      this.xAxisLine = null;
    }
    if (this.yAxisLine) {
      this.yAxisLine.dispose();
      this.yAxisLine = null;
    }
    if (this.zAxisLine) {
      this.zAxisLine.dispose();
      this.zAxisLine = null;
    }
    if (this.xArrowHead) {
      this.xArrowHead.dispose();
      this.xArrowHead = null;
    }
    if (this.yArrowHead) {
      this.yArrowHead.dispose();
      this.yArrowHead = null;
    }
    if (this.zArrowHead) {
      this.zArrowHead.dispose();
      this.zArrowHead = null;
    }
    if (this.rootNode) {
      this.rootNode.dispose();
      this.rootNode = null;
    }
  }

  /**
   * Check if widget is currently visible
   */
  isVisible(): boolean {
    return this.rootNode !== null;
  }

  /**
   * Create a colored line for an axis
   */
  private createAxisLine(
    start: BABYLON.Vector3,
    end: BABYLON.Vector3,
    color: BABYLON.Color3
  ): BABYLON.LinesMesh {
    const line = BABYLON.MeshBuilder.CreateLines(
      'axisLine',
      {
        points: [start, end],
        updatable: false,
      },
      this.scene
    );

    const material = new BABYLON.StandardMaterial('axisLineMaterial', this.scene);
    material.emissiveColor = color;
    material.disableLighting = true;
    line.color = color;

    return line;
  }

  /**
   * Create arrow head cone for axis
   */
  private createArrowHead(
    position: BABYLON.Vector3,
    direction: BABYLON.Vector3,
    color: BABYLON.Color3
  ): BABYLON.Mesh {
    const cone = BABYLON.MeshBuilder.CreateCylinder(
      'arrowHead',
      {
        diameterTop: 0,
        diameterBottom: 0.01,
        height: 0.02,
        tessellation: 8,
      },
      this.scene
    );

    cone.position = position;

    // Align cone with direction
    const up = BABYLON.Vector3.Up();
    const angle = Math.acos(BABYLON.Vector3.Dot(up, direction));
    const axis = BABYLON.Vector3.Cross(up, direction).normalize();

    if (axis.length() > 0.001) {
      cone.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
    } else if (BABYLON.Vector3.Dot(up, direction) < 0) {
      cone.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Right(), Math.PI);
    }

    const material = new BABYLON.StandardMaterial('arrowHeadMaterial', this.scene);
    material.emissiveColor = color;
    material.disableLighting = true;
    cone.material = material;

    return cone;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.hide();
  }
}
