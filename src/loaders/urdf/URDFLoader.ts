// URDF Loader - Parse URDF robot description files
// Owner: George
// Parses URDF XML and loads referenced mesh files

import * as BABYLON from '@babylonjs/core';

/**
 * URDF Link structure
 */
interface URDFLink {
  name: string;
  visualMeshPath?: string;
  collisionMeshPath?: string;
  inertial?: {
    mass: number;
    origin: { xyz: number[]; rpy: number[] };
  };
  visual?: {
    origin: { xyz: number[]; rpy: number[] };
    geometry: {
      mesh?: { filename: string; scale?: number[] };
      box?: { size: number[] };
      cylinder?: { radius: number; length: number };
      sphere?: { radius: number };
    };
  };
}

/**
 * URDF Joint structure
 */
interface URDFJoint {
  name: string;
  type: 'revolute' | 'prismatic' | 'fixed' | 'continuous' | 'planar' | 'floating';
  parent: string;
  child: string;
  origin: { xyz: number[]; rpy: number[] };
  axis?: { xyz: number[] };
  limit?: { lower: number; upper: number; effort: number; velocity: number };
}

/**
 * Parsed URDF structure
 */
export interface ParsedURDF {
  robotName: string;
  links: URDFLink[];
  joints: URDFJoint[];
}

/**
 * Parse URDF XML string
 */
export function parseURDF(xmlString: string): ParsedURDF {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const robotElement = xmlDoc.getElementsByTagName('robot')[0];
  if (!robotElement) {
    throw new Error('Invalid URDF: No <robot> element found');
  }

  const robotName = robotElement.getAttribute('name') || 'robot';
  const links: URDFLink[] = [];
  const joints: URDFJoint[] = [];

  // Parse links
  const linkElements = xmlDoc.getElementsByTagName('link');
  for (let i = 0; i < linkElements.length; i++) {
    const linkEl = linkElements[i];
    const link: URDFLink = {
      name: linkEl.getAttribute('name') || `link_${i}`,
    };

    // Parse visual element
    const visualEl = linkEl.getElementsByTagName('visual')[0];
    if (visualEl) {
      const originEl = visualEl.getElementsByTagName('origin')[0];
      const geometryEl = visualEl.getElementsByTagName('geometry')[0];

      link.visual = {
        origin: parseOrigin(originEl),
        geometry: parseGeometry(geometryEl),
      };

      // Extract mesh path if present
      if (link.visual.geometry.mesh) {
        link.visualMeshPath = link.visual.geometry.mesh.filename;
      }
    }

    // Parse inertial element
    const inertialEl = linkEl.getElementsByTagName('inertial')[0];
    if (inertialEl) {
      const massEl = inertialEl.getElementsByTagName('mass')[0];
      const originEl = inertialEl.getElementsByTagName('origin')[0];

      link.inertial = {
        mass: parseFloat(massEl?.getAttribute('value') || '1.0'),
        origin: parseOrigin(originEl),
      };
    }

    links.push(link);
  }

  // Parse joints
  const jointElements = xmlDoc.getElementsByTagName('joint');
  for (let i = 0; i < jointElements.length; i++) {
    const jointEl = jointElements[i];
    const joint: URDFJoint = {
      name: jointEl.getAttribute('name') || `joint_${i}`,
      type: (jointEl.getAttribute('type') as URDFJoint['type']) || 'fixed',
      parent: jointEl.getElementsByTagName('parent')[0]?.getAttribute('link') || '',
      child: jointEl.getElementsByTagName('child')[0]?.getAttribute('link') || '',
      origin: parseOrigin(jointEl.getElementsByTagName('origin')[0]),
    };

    // Parse axis
    const axisEl = jointEl.getElementsByTagName('axis')[0];
    if (axisEl) {
      joint.axis = { xyz: parseVector(axisEl.getAttribute('xyz') || '1 0 0') };
    }

    // Parse limits
    const limitEl = jointEl.getElementsByTagName('limit')[0];
    if (limitEl) {
      joint.limit = {
        lower: parseFloat(limitEl.getAttribute('lower') || '0'),
        upper: parseFloat(limitEl.getAttribute('upper') || '0'),
        effort: parseFloat(limitEl.getAttribute('effort') || '0'),
        velocity: parseFloat(limitEl.getAttribute('velocity') || '0'),
      };
    }

    joints.push(joint);
  }

  return { robotName, links, joints };
}

/**
 * Parse origin element (xyz and rpy)
 */
function parseOrigin(originEl?: Element): { xyz: number[]; rpy: number[] } {
  if (!originEl) {
    return { xyz: [0, 0, 0], rpy: [0, 0, 0] };
  }

  return {
    xyz: parseVector(originEl.getAttribute('xyz') || '0 0 0'),
    rpy: parseVector(originEl.getAttribute('rpy') || '0 0 0'),
  };
}

/**
 * Parse geometry element
 */
function parseGeometry(geometryEl?: Element): {
  mesh?: { filename: string; scale?: number[] };
  box?: { size: number[] };
  cylinder?: { radius: number; length: number };
  sphere?: { radius: number };
} {
  const geometry: {
    mesh?: { filename: string; scale?: number[] };
    box?: { size: number[] };
    cylinder?: { radius: number; length: number };
    sphere?: { radius: number };
  } = {};

  if (!geometryEl) return geometry;

  // Check for mesh
  const meshEl = geometryEl.getElementsByTagName('mesh')[0];
  if (meshEl) {
    const filename = meshEl.getAttribute('filename') || '';
    const scale = parseVector(meshEl.getAttribute('scale') || '1 1 1');
    geometry.mesh = { filename, scale };
  }

  // Check for box
  const boxEl = geometryEl.getElementsByTagName('box')[0];
  if (boxEl) {
    geometry.box = {
      size: parseVector(boxEl.getAttribute('size') || '1 1 1'),
    };
  }

  // Check for cylinder
  const cylinderEl = geometryEl.getElementsByTagName('cylinder')[0];
  if (cylinderEl) {
    geometry.cylinder = {
      radius: parseFloat(cylinderEl.getAttribute('radius') || '1'),
      length: parseFloat(cylinderEl.getAttribute('length') || '1'),
    };
  }

  // Check for sphere
  const sphereEl = geometryEl.getElementsByTagName('sphere')[0];
  if (sphereEl) {
    geometry.sphere = {
      radius: parseFloat(sphereEl.getAttribute('radius') || '1'),
    };
  }

  return geometry;
}

/**
 * Parse vector string "x y z" into number array
 */
function parseVector(str: string): number[] {
  return str.trim().split(/\s+/).map(parseFloat);
}

/**
 * Load URDF file and create Babylon.js scene hierarchy
 * Note: This creates a basic hierarchy. Mesh files must be loaded separately.
 */
export async function loadURDFFromFile(
  file: File,
  scene: BABYLON.Scene
): Promise<{ meshes: BABYLON.AbstractMesh[]; rootNodes: BABYLON.TransformNode[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      const xmlString = event.target?.result as string;
      if (!xmlString) {
        reject(new Error('Failed to read URDF file'));
        return;
      }

      try {
        const urdf = parseURDF(xmlString);
        console.log('Parsed URDF:', urdf);

        // Collect all mesh file paths for user info
        const meshPaths: string[] = [];
        for (const link of urdf.links) {
          if (link.visual?.geometry?.mesh?.filename) {
            meshPaths.push(link.visual.geometry.mesh.filename);
          }
        }

        if (meshPaths.length > 0) {
          console.warn('⚠️ URDF References External Mesh Files:');
          console.warn('The following mesh files need to be in the correct paths:');
          meshPaths.forEach(path => console.warn(`  - ${path}`));
          console.warn('\n💡 Tip: Place STL/DAE files relative to the URDF file location');
          console.warn('For now, placeholders (small boxes) will be created.');
        }

        // Create root node for the robot
        const robotRoot = new BABYLON.TransformNode(urdf.robotName, scene);
        robotRoot.metadata = {
          isURDFRobot: true,
          urdfJoints: urdf.joints,
          urdfLinks: urdf.links,
          requiredMeshFiles: meshPaths,
        };

        // Create transform nodes for each link
        const linkNodes = new Map<string, BABYLON.TransformNode>();
        const meshes: BABYLON.AbstractMesh[] = [];

        for (const link of urdf.links) {
          const linkNode = new BABYLON.TransformNode(link.name, scene);
          linkNodes.set(link.name, linkNode);

          // Create placeholder mesh if visual geometry is primitive
          if (link.visual?.geometry) {
            let mesh: BABYLON.AbstractMesh | null = null;

            if (link.visual.geometry.box) {
              const size = link.visual.geometry.box.size;
              mesh = BABYLON.MeshBuilder.CreateBox(
                `${link.name}_visual`,
                { width: size[0], height: size[1], depth: size[2] },
                scene
              );
            } else if (link.visual.geometry.cylinder) {
              mesh = BABYLON.MeshBuilder.CreateCylinder(
                `${link.name}_visual`,
                {
                  diameter: link.visual.geometry.cylinder.radius * 2,
                  height: link.visual.geometry.cylinder.length,
                },
                scene
              );
            } else if (link.visual.geometry.sphere) {
              mesh = BABYLON.MeshBuilder.CreateSphere(
                `${link.name}_visual`,
                { diameter: link.visual.geometry.sphere.radius * 2 },
                scene
              );
            } else if (link.visual.geometry.mesh) {
              // Create placeholder for mesh (user needs to load STL separately)
              mesh = BABYLON.MeshBuilder.CreateBox(
                `${link.name}_placeholder`,
                { size: 0.15 },
                scene
              );

              // Make placeholder semi-transparent and colored
              const mat = new BABYLON.StandardMaterial(`${link.name}_placeholder_mat`, scene);
              mat.diffuseColor = new BABYLON.Color3(1, 0.5, 0); // Orange
              mat.alpha = 0.5;
              mat.wireframe = true;
              mesh.material = mat;

              mesh.metadata = {
                urdfMeshPath: link.visual.geometry.mesh.filename,
                urdfMeshScale: link.visual.geometry.mesh.scale,
                isURDFPlaceholder: true,
              };
            }

            if (mesh) {
              mesh.parent = linkNode;

              // Apply visual origin transform
              const origin = link.visual.origin;
              mesh.position = new BABYLON.Vector3(origin.xyz[0], origin.xyz[1], origin.xyz[2]);
              mesh.rotation = new BABYLON.Vector3(origin.rpy[0], origin.rpy[1], origin.rpy[2]);

              meshes.push(mesh);
            }
          }
        }

        // Build hierarchy based on joints
        for (const joint of urdf.joints) {
          const parentNode = linkNodes.get(joint.parent);
          const childNode = linkNodes.get(joint.child);

          if (parentNode && childNode) {
            childNode.parent = parentNode;

            // Apply joint origin transform
            childNode.position = new BABYLON.Vector3(
              joint.origin.xyz[0],
              joint.origin.xyz[1],
              joint.origin.xyz[2]
            );
            childNode.rotation = new BABYLON.Vector3(
              joint.origin.rpy[0],
              joint.origin.rpy[1],
              joint.origin.rpy[2]
            );

            // Store joint metadata
            childNode.metadata = {
              jointType: joint.type,
              jointName: joint.name,
              jointAxis: joint.axis,
              jointLimit: joint.limit,
            };
          }
        }

        // Find root links (links with no parent joint)
        const childLinks = new Set(urdf.joints.map(j => j.child));
        const rootLinkNames = urdf.links
          .map(l => l.name)
          .filter(name => !childLinks.has(name));

        // Parent root links to robot root
        for (const rootLinkName of rootLinkNames) {
          const rootLink = linkNodes.get(rootLinkName);
          if (rootLink) {
            rootLink.parent = robotRoot;
          }
        }

        resolve({ meshes, rootNodes: [robotRoot] });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read URDF file'));
    };

    reader.readAsText(file);
  });
}
