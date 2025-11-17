/**
 * ToolingJointOverlay
 * 
 * Loads joints from 9X_110_GEO.json and visualizes them in the scene
 * with gizmos (spheres at FromVector, lines to ToVector).
 */

import * as BABYLON from '@babylonjs/core';
import { ToolingConfig } from './ToolingConfig';
import { ToolingFileJson } from '../../babylon/io/ToolingJsonAdapter';

export interface ToolingJointDefinition {
  unitName: string;
  name: string;
  type: 'hinge' | 'prismatic';
  nodeId: string;
  hideId?: string;
  from: BABYLON.Vector3;
  to: BABYLON.Vector3;
}

export class ToolingJointOverlay {
  private gizmos: BABYLON.AbstractMesh[] = [];
  private fixtureRoot: BABYLON.TransformNode | null = null;

  constructor(
    private scene: BABYLON.Scene,
    private config: ToolingConfig
  ) {
    this.fixtureRoot = this.findFixtureRoot();
  }

  /**
   * Load joints from JSON file.
   */
  async loadJoints(): Promise<ToolingJointDefinition[]> {
    try {
      const response = await fetch(this.config.jsonPath);
      if (!response.ok) {
        console.warn('[ToolingJointOverlay] Failed to load JSON:', response.statusText);
        return [];
      }

      const data: ToolingFileJson = await response.json();
      if (!Array.isArray(data)) {
        console.warn('[ToolingJointOverlay] Invalid JSON format: expected array');
        return [];
      }

      const joints: ToolingJointDefinition[] = [];

      for (const unit of data) {
        if (!unit.UnitName || !Array.isArray(unit.Joints)) {
          continue;
        }

        for (const joint of unit.Joints) {
          if (joint.Type !== 0 && joint.Type !== 1) {
            continue;
          }

          const from = new BABYLON.Vector3(
            joint.FromVector.X,
            joint.FromVector.Y,
            joint.FromVector.Z
          );
          const to = new BABYLON.Vector3(
            joint.ToVector.X,
            joint.ToVector.Y,
            joint.ToVector.Z
          );

          joints.push({
            unitName: unit.UnitName,
            name: joint.Name || 'unnamed',
            type: joint.Type === 0 ? 'prismatic' : 'hinge',
            nodeId: joint.NodeId || '',
            hideId: joint.HideId,
            from,
            to,
          });
        }
      }

      console.log(`[ToolingJointOverlay] Loaded ${joints.length} joints from ${data.length} units`);
      return joints;
    } catch (error) {
      console.warn('[ToolingJointOverlay] Error loading joints:', error);
      return [];
    }
  }

  /**
   * Create visual gizmos for joints.
   */
  createGizmos(joints: ToolingJointDefinition[]): BABYLON.AbstractMesh[] {
    // Clear existing gizmos
    this.dispose();

    if (!this.fixtureRoot) {
      console.warn('[ToolingJointOverlay] Fixture root not found, gizmos will not be parented');
    }

    const PRISMATIC_COLOR = new BABYLON.Color3(0, 1, 0); // Green
    const HINGE_COLOR = new BABYLON.Color3(1, 0, 0); // Red
    const SPHERE_SIZE = 0.02; // 2cm radius

    for (const joint of joints) {
      const color = joint.type === 'prismatic' ? PRISMATIC_COLOR : HINGE_COLOR;

      // Create sphere at FromVector
      const sphere = BABYLON.MeshBuilder.CreateSphere(
        `joint_sphere_${joint.unitName}_${joint.name}`,
        { diameter: SPHERE_SIZE },
        this.scene
      );
      sphere.position = joint.from.clone();
      sphere.isPickable = false;

      const sphereMaterial = new BABYLON.StandardMaterial(`joint_mat_sphere_${joint.unitName}_${joint.name}`, this.scene);
      sphereMaterial.emissiveColor = color;
      sphereMaterial.disableLighting = true;
      sphere.material = sphereMaterial;

      if (this.fixtureRoot) {
        sphere.parent = this.fixtureRoot;
      }

      this.gizmos.push(sphere);

      // Create line from FromVector to ToVector
      const points = [joint.from.clone(), joint.to.clone()];
      const line = BABYLON.MeshBuilder.CreateLines(
        `joint_line_${joint.unitName}_${joint.name}`,
        { points },
        this.scene
      );
      line.color = color;
      line.isPickable = false;

      if (this.fixtureRoot) {
        line.parent = this.fixtureRoot;
      }

      this.gizmos.push(line);
    }

    console.log(`[ToolingJointOverlay] Created ${this.gizmos.length} gizmos for ${joints.length} joints`);
    return this.gizmos;
  }

  /**
   * Dispose all gizmo meshes.
   */
  dispose(): void {
    for (const gizmo of this.gizmos) {
      gizmo.dispose();
    }
    this.gizmos = [];
  }

  /**
   * Find the fixture root node by name.
   */
  private findFixtureRoot(): BABYLON.TransformNode | null {
    for (const node of this.scene.transformNodes) {
      if (node.name === this.config.fixtureRootName) {
        return node;
      }
    }
    return null;
  }
}

