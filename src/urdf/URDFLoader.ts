/**
 * URDF Loader
 * Loads URDF (Unified Robot Description Format) files into Babylon.js scenes
 * Uses urdf-loader library for parsing
 */

import * as BABYLON from '@babylonjs/core';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - urdf-loader has no type definitions
import URDFLoader from 'urdf-loader';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - three is peer dependency of urdf-loader
import { LoadingManager } from 'three';
import type {
  URDFLoaderOptions,
  URDFLoadResult,
  LinkInfo,
} from './types';
import { URDFToBabylonConverter } from './URDFToBabylonConverter';

/**
 * Main URDF loader class
 * Integrates urdf-loader (THREE.js) with Babylon.js + kinetiCORE
 */
export class URDFRobotLoader {
  private loader: URDFLoader;
  private manager: LoadingManager;
  private converter: URDFToBabylonConverter;
  private scene: BABYLON.Scene;

  constructor(scene: BABYLON.Scene, options?: URDFLoaderOptions) {
    this.scene = scene;
    this.manager = new LoadingManager();
    this.loader = new URDFLoader(this.manager);
    this.converter = new URDFToBabylonConverter();

    // Configure package paths
    if (options?.packages) {
      this.loader.packages = options.packages;
    }

    // Setup progress tracking
    if (options?.onProgress) {
      this.manager.onProgress = (_url: string, loaded: number, total: number) => {
        options.onProgress?.(loaded, total);
      };
    }
  }

  /**
   * Load URDF file from URL
   * @param urdfPath - Path to URDF file
   * @param options - Loading options
   * @returns Promise resolving to robot model
   */
  async loadRobot(
    urdfPath: string,
    options?: URDFLoaderOptions
  ): Promise<URDFLoadResult> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        urdfPath,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (urdfRobot: any) => {
          try {
            // Convert THREE.js URDF to Babylon.js
            const babylonModel = this.converter.convertRobot(
              urdfRobot,
              this.scene,
              options
            );

            // Extract link and joint information
            const links = this.extractLinkInfo(urdfRobot);
            const joints = Array.from(babylonModel.joints.values());

            resolve({
              robot: babylonModel,
              links,
              joints,
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            reject(
              new Error(`Failed to convert URDF to Babylon: ${errorMsg}`)
            );
          }
        },
        undefined, // onProgress handled by manager
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error: any) => {
          const errorMsg = error instanceof Error ? error.message : String(error);
          reject(new Error(`Failed to load URDF: ${errorMsg}`));
        }
      );
    });
  }


  /**
   * Register package path for mesh loading
   * @param packageName - ROS package name
   * @param basePath - Base path for package
   */
  registerPackage(packageName: string, basePath: string): void {
    if (!this.loader.packages || typeof this.loader.packages !== 'object') {
      this.loader.packages = {};
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.loader.packages as any)[packageName] = basePath;
  }

  /**
   * Extract link information from urdf-loader robot
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractLinkInfo(urdfRobot: any): LinkInfo[] {
    const links: LinkInfo[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traverse = (link: any) => {
      const linkInfo: LinkInfo = {
        name: link.name,
        visual: [],
        collision: [],
      };

      // Extract visual geometry
      if (link.visual) {
        // urdf-loader provides visual meshes
        // We'll extract basic info
        linkInfo.visual = [{
          geometry: {
            type: 'mesh' as const,
            filename: link.visual.geometry?.filename,
          },
          origin: link.visual.origin ? {
            position: new BABYLON.Vector3(
              link.visual.origin.xyz[0],
              link.visual.origin.xyz[1],
              link.visual.origin.xyz[2]
            ),
            rotation: new BABYLON.Vector3(
              link.visual.origin.rpy[0],
              link.visual.origin.rpy[1],
              link.visual.origin.rpy[2]
            ),
          } : undefined,
        }];
      }

      // Extract collision geometry
      if (link.collision) {
        linkInfo.collision = [{
          geometry: {
            type: 'mesh' as const,
            filename: link.collision.geometry?.filename,
          },
          origin: link.collision.origin ? {
            position: new BABYLON.Vector3(
              link.collision.origin.xyz[0],
              link.collision.origin.xyz[1],
              link.collision.origin.xyz[2]
            ),
            rotation: new BABYLON.Vector3(
              link.collision.origin.rpy[0],
              link.collision.origin.rpy[1],
              link.collision.origin.rpy[2]
            ),
          } : undefined,
        }];
      }

      // Extract inertial properties
      if (link.inertial) {
        linkInfo.inertial = {
          mass: link.inertial.mass?.value || 1.0,
          origin: link.inertial.origin ? {
            position: new BABYLON.Vector3(
              link.inertial.origin.xyz[0],
              link.inertial.origin.xyz[1],
              link.inertial.origin.xyz[2]
            ),
            rotation: new BABYLON.Vector3(
              link.inertial.origin.rpy[0],
              link.inertial.origin.rpy[1],
              link.inertial.origin.rpy[2]
            ),
          } : undefined,
          inertia: {
            ixx: link.inertial.inertia?.ixx || 0.001,
            ixy: link.inertial.inertia?.ixy || 0,
            ixz: link.inertial.inertia?.ixz || 0,
            iyy: link.inertial.inertia?.iyy || 0.001,
            iyz: link.inertial.inertia?.iyz || 0,
            izz: link.inertial.inertia?.izz || 0.001,
          },
        };
      }

      links.push(linkInfo);

      // Traverse children
      if (link.children) {
        link.children.forEach((child: any) => {
          if (child.isURDFJoint && child.urdfNode) {
            traverse(child.urdfNode);
          }
        });
      }
    };

    traverse(urdfRobot);
    return links;
  }

  /**
   * Dispose loader resources
   */
  dispose(): void {
    // urdf-loader doesn't require explicit disposal
    // Babylon meshes are disposed through the robot model
  }
}
