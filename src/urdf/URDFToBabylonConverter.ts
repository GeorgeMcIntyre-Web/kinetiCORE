/**
 * URDF to Babylon.js Converter
 * Converts urdf-loader (THREE.js) robot to Babylon.js scene
 */

import * as BABYLON from '@babylonjs/core';
import type {
  BabylonRobotModel,
  JointInfo,
  URDFLoaderOptions,
  URDFJointType,
} from './types';

/**
 * Converts URDF robot from THREE.js to Babylon.js
 */
export class URDFToBabylonConverter {
  /**
   * Convert urdf-loader robot to Babylon scene
   * @param urdfRobot - Robot from urdf-loader
   * @param scene - Babylon scene
   * @param options - Conversion options
   */
  convertRobot(
    urdfRobot: any,
    scene: BABYLON.Scene,
    options?: URDFLoaderOptions
  ): BabylonRobotModel {
    const scale = options?.scale || 1.0;
    const robotRoot = new BABYLON.TransformNode(urdfRobot.robotName, scene);
    robotRoot.scaling = new BABYLON.Vector3(scale, scale, scale);

    const linkMeshes = new Map<string, BABYLON.Mesh>();
    const linkNodes = new Map<string, BABYLON.TransformNode>();
    const joints = new Map<string, JointInfo>();

    // Traverse URDF tree
    this.traverseLinks(
      urdfRobot,
      robotRoot,
      linkMeshes,
      linkNodes,
      joints,
      scene,
      options
    );

    return {
      root: robotRoot,
      links: linkMeshes,
      joints,
      linkNodes,
    };
  }

  /**
   * Recursively traverse URDF link hierarchy
   */
  private traverseLinks(
    urdfLink: any,
    parentNode: BABYLON.TransformNode,
    linkMeshes: Map<string, BABYLON.Mesh>,
    linkNodes: Map<string, BABYLON.TransformNode>,
    joints: Map<string, JointInfo>,
    scene: BABYLON.Scene,
    options?: URDFLoaderOptions
  ): void {
    // Create Babylon transform node for this link
    const linkNode = new BABYLON.TransformNode(urdfLink.name, scene);
    linkNode.parent = parentNode;
    linkNodes.set(urdfLink.name, linkNode);

    // Convert THREE.js mesh to Babylon if it exists
    if (urdfLink.children && urdfLink.children.length > 0) {
      // Find visual mesh in THREE.js children
      const threeMesh = urdfLink.children.find(
        (child: any) => child.type === 'Mesh' || child.type === 'Group'
      );

      if (threeMesh && options?.loadMeshes !== false) {
        const babylonMesh = this.convertThreeMeshToBabylon(
          threeMesh,
          urdfLink.name,
          scene
        );
        if (babylonMesh) {
          babylonMesh.parent = linkNode;
          linkMeshes.set(urdfLink.name, babylonMesh);
        }
      }
    }

    // Process child joints and links
    if (urdfLink.children) {
      urdfLink.children.forEach((child: any) => {
        if (child.isURDFJoint) {
          const jointInfo = this.extractJointInfo(child, urdfLink.name);
          joints.set(child.name, jointInfo);

          // Create transform node for joint
          const jointNode = new BABYLON.TransformNode(child.name, scene);
          jointNode.parent = linkNode;

          // Apply joint transform (origin)
          if (child.urdfValues && child.urdfValues.origin) {
            const origin = child.urdfValues.origin;

            // Position
            if (origin.xyz) {
              jointNode.position = new BABYLON.Vector3(
                origin.xyz[0],
                origin.xyz[1],
                origin.xyz[2]
              );
            }

            // Rotation (RPY to quaternion)
            if (origin.rpy) {
              jointNode.rotationQuaternion = this.rpyToQuaternion(
                origin.rpy[0],
                origin.rpy[1],
                origin.rpy[2]
              );
            }
          }

          // Recursively process child link
          if (child.urdfNode) {
            this.traverseLinks(
              child.urdfNode,
              jointNode,
              linkMeshes,
              linkNodes,
              joints,
              scene,
              options
            );
          }
        }
      });
    }
  }

  /**
   * Convert THREE.js mesh to Babylon.js mesh
   * Note: This is a basic conversion. For production, consider using
   * Babylon's built-in loaders for STL/OBJ/DAE files directly
   */
  private convertThreeMeshToBabylon(
    threeMesh: any,
    name: string,
    scene: BABYLON.Scene
  ): BABYLON.Mesh | null {
    try {
      // Extract geometry from THREE.js mesh
      const geometry = threeMesh.geometry;
      if (!geometry) return null;

      // Create Babylon mesh
      const babylonMesh = new BABYLON.Mesh(name + '_visual', scene);

      // Convert vertices
      const positions = geometry.attributes.position?.array;
      if (!positions) return null;

      const vertexData = new BABYLON.VertexData();
      vertexData.positions = Array.from(positions);

      // Convert normals
      if (geometry.attributes.normal) {
        vertexData.normals = Array.from(geometry.attributes.normal.array);
      }

      // Convert UVs
      if (geometry.attributes.uv) {
        vertexData.uvs = Array.from(geometry.attributes.uv.array);
      }

      // Convert indices
      if (geometry.index) {
        vertexData.indices = Array.from(geometry.index.array);
      } else {
        // Generate indices if not provided
        const indices = [];
        for (let i = 0; i < positions.length / 3; i++) {
          indices.push(i);
        }
        vertexData.indices = indices;
      }

      vertexData.applyToMesh(babylonMesh);

      // Convert material
      if (threeMesh.material) {
        const material = new BABYLON.StandardMaterial(
          name + '_mat',
          scene
        );

        // Basic color conversion
        if (threeMesh.material.color) {
          material.diffuseColor = new BABYLON.Color3(
            threeMesh.material.color.r,
            threeMesh.material.color.g,
            threeMesh.material.color.b
          );
        }

        babylonMesh.material = material;
      }

      return babylonMesh;
    } catch (error) {
      console.warn(`Failed to convert mesh ${name}:`, error);
      return null;
    }
  }

  /**
   * Extract joint information from URDF joint
   */
  private extractJointInfo(urdfJoint: any, parentLinkName: string): JointInfo {
    const values = urdfJoint.urdfValues || {};
    const origin = values.origin || {};

    const info: JointInfo = {
      name: urdfJoint.name,
      type: (values.type || 'fixed') as URDFJointType,
      parent: parentLinkName,
      child: urdfJoint.urdfNode?.name || '',
      origin: {
        position: new BABYLON.Vector3(
          origin.xyz?.[0] || 0,
          origin.xyz?.[1] || 0,
          origin.xyz?.[2] || 0
        ),
        rotation: new BABYLON.Vector3(
          origin.rpy?.[0] || 0,
          origin.rpy?.[1] || 0,
          origin.rpy?.[2] || 0
        ),
      },
      axis: new BABYLON.Vector3(
        values.axis?.xyz?.[0] || 0,
        values.axis?.xyz?.[1] || 0,
        values.axis?.xyz?.[2] || 1
      ),
    };

    // Extract limits
    if (values.limit) {
      info.limit = {
        lower: values.limit.lower || -Math.PI,
        upper: values.limit.upper || Math.PI,
        effort: values.limit.effort || 0,
        velocity: values.limit.velocity || 0,
      };
    }

    // Extract dynamics
    if (values.dynamics) {
      info.dynamics = {
        damping: values.dynamics.damping || 0,
        friction: values.dynamics.friction || 0,
      };
    }

    return info;
  }

  /**
   * Convert RPY (roll, pitch, yaw) to Babylon quaternion
   * URDF uses fixed-axis rotations: R = Rz(yaw) * Ry(pitch) * Rx(roll)
   */
  private rpyToQuaternion(
    roll: number,
    pitch: number,
    yaw: number
  ): BABYLON.Quaternion {
    // Convert to Babylon's rotation system
    // URDF: X-right, Y-forward, Z-up (ROS convention)
    // Babylon: X-right, Y-up, Z-forward (left-handed)

    // Create individual rotation quaternions
    const qx = BABYLON.Quaternion.RotationAxis(
      BABYLON.Axis.X,
      roll
    );
    const qy = BABYLON.Quaternion.RotationAxis(
      BABYLON.Axis.Y,
      pitch
    );
    const qz = BABYLON.Quaternion.RotationAxis(
      BABYLON.Axis.Z,
      yaw
    );

    // Combine: yaw * pitch * roll
    return qz.multiply(qy).multiply(qx);
  }
}
