// URDF Loader with Mesh Loading Support
// Owner: George
// Loads URDF with referenced STL/DAE files from a file map

import * as BABYLON from '@babylonjs/core';
import { parseURDF } from './URDFLoader';

/**
 * Load URDF with associated mesh files
 * @param urdfFile - The URDF XML file
 * @param files - All files from the folder (including STL/DAE meshes)
 * @param scene - Babylon.js scene
 */
export async function loadURDFWithMeshes(
  urdfFile: File,
  files: File[],
  scene: BABYLON.Scene
): Promise<{ meshes: BABYLON.AbstractMesh[]; rootNodes: BABYLON.TransformNode[] }> {
  // Read URDF file
  const urdfText = await urdfFile.text();
  const urdf = parseURDF(urdfText);

  // URDF uses meters, Babylon.js uses meters - NO CONVERSION NEEDED
  // (The Inspector will handle display units)

  console.log(`Loading URDF: ${urdf.robotName}`);
  console.log(`Total files provided: ${files.length}`);

  // Create a map of file paths to File objects
  const fileMap = new Map<string, File>();
  files.forEach(file => {
    // Store with forward slashes and normalize path
    const normalizedPath = file.webkitRelativePath || file.name;
    const cleanPath = normalizedPath.replace(/\\/g, '/');
    fileMap.set(cleanPath, file);
    fileMap.set(file.name, file); // Also store by filename only
  });

  console.log('File map created with paths:');
  fileMap.forEach((_, path) => console.log(`  - ${path}`));

  // Create root node for the robot
  const robotRoot = new BABYLON.TransformNode(urdf.robotName, scene);
  robotRoot.metadata = {
    isURDFRobot: true,
    isURDFMesh: true,
    coordinateSystem: 'babylon-native', // Y-up, meters
    urdfJoints: urdf.joints,
    urdfLinks: urdf.links,
  };

  // Create transform nodes for each link
  const linkNodes = new Map<string, BABYLON.TransformNode>();
  const meshes: BABYLON.AbstractMesh[] = [];
  const meshLoadPromises: Promise<void>[] = [];

  for (const link of urdf.links) {
    const linkNode = new BABYLON.TransformNode(link.name, scene);
    linkNode.metadata = {
      isURDFLink: true,
      isURDFMesh: true,
      coordinateSystem: 'babylon-native', // Y-up, meters
    };
    linkNodes.set(link.name, linkNode);

    // Create mesh for visual geometry
    if (link.visual?.geometry) {
      let mesh: BABYLON.AbstractMesh | null = null;

      // Handle primitive geometries
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
        // Load external mesh file (STL/DAE)
        const meshPath = link.visual.geometry.mesh.filename;

        // Clean mesh path - remove package:// prefix if present
        let cleanMeshPath = meshPath.replace('package://', '');
        cleanMeshPath = cleanMeshPath.replace(/^\//, ''); // Remove leading slash

        console.log(`Looking for mesh: ${cleanMeshPath}`);

        // Try to find the file
        let meshFile = findMeshFile(cleanMeshPath, fileMap);

        if (meshFile) {
          console.log(`✓ Found mesh file: ${meshFile.name}`);

          // Create promise to load mesh asynchronously
          const loadPromise = loadMeshFile(
            meshFile,
            link.name,
            linkNode,
            link.visual.origin,
            link.visual.geometry.mesh.scale,
            scene
          ).then(loadedMeshes => {
            meshes.push(...loadedMeshes);
          });

          meshLoadPromises.push(loadPromise);
        } else {
          console.warn(`✗ Mesh file not found: ${cleanMeshPath}`);
          console.warn(`  Available files: ${Array.from(fileMap.keys()).join(', ')}`);

          // Create placeholder
          mesh = BABYLON.MeshBuilder.CreateBox(
            `${link.name}_placeholder`,
            { size: 0.15 },
            scene
          );
          const mat = new BABYLON.StandardMaterial(`${link.name}_placeholder_mat`, scene);
          mat.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red = missing file
          mat.alpha = 0.5;
          mat.wireframe = true;
          mesh.material = mat;
          mesh.metadata = { urdfMeshPath: meshPath, isMissingFile: true };
        }
      }

      if (mesh) {
        // Reset to clean state
        mesh.position = BABYLON.Vector3.Zero();
        mesh.rotation = BABYLON.Vector3.Zero();

        // Parent to link node
        mesh.parent = linkNode;

        // Apply visual origin transform
        // URDF: Z-up, meters → Babylon: Y-up, meters
        // Conversion: (x, y, z) URDF → (x, z, y) Babylon
        const origin = link.visual.origin;
        if (origin.xyz[0] !== 0 || origin.xyz[1] !== 0 || origin.xyz[2] !== 0) {
          mesh.position = new BABYLON.Vector3(
            origin.xyz[0],  // X stays X
            origin.xyz[2],  // URDF Z (up) → Babylon Y (up)
            origin.xyz[1]   // URDF Y (forward) → Babylon Z (forward)
          );
        }

        // Apply RPY rotation correctly (only if non-zero)
        if (origin.rpy[0] !== 0 || origin.rpy[1] !== 0 || origin.rpy[2] !== 0) {
          applyRPYRotation(mesh, origin.rpy);
        }

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

      // Apply joint origin transform (URDF is in meters, same as Babylon)
      childNode.position = new BABYLON.Vector3(
        joint.origin.xyz[0],
        joint.origin.xyz[1],
        joint.origin.xyz[2]
      );

      // URDF uses RPY (Roll-Pitch-Yaw) = intrinsic XYZ Euler angles
      // Babylon uses extrinsic ZYX Euler angles
      // Convert RPY to quaternion, then to Babylon rotation
      applyRPYRotation(childNode, joint.origin.rpy);

      // Store joint metadata (preserve existing metadata)
      childNode.metadata = {
        ...childNode.metadata,
        jointType: joint.type,
        jointName: joint.name,
        jointAxis: joint.axis,
        jointLimit: joint.limit,
      };
    }
  }

  // Find root links (links with no parent joint)
  const childLinks = new Set(urdf.joints.map(j => j.child));
  const rootLinkNames = urdf.links.map(l => l.name).filter(name => !childLinks.has(name));

  // Parent root links to robot root
  for (const rootLinkName of rootLinkNames) {
    const rootLink = linkNodes.get(rootLinkName);
    if (rootLink) {
      rootLink.parent = robotRoot;
    }
  }

  // Wait for all meshes to load
  await Promise.all(meshLoadPromises);

  console.log(`✓ URDF loaded: ${meshes.length} meshes created`);

  // Debug: Print hierarchy
  console.log('=== URDF Hierarchy Debug ===');
  function printHierarchy(node: BABYLON.TransformNode, indent: string = '') {
    const children = node.getChildTransformNodes(false);
    const meshChildren = node.getChildMeshes(false);
    console.log(`${indent}${node.name} (${node.constructor.name}) - ${children.length} transform children, ${meshChildren.length} mesh children`);
    for (const child of children) {
      printHierarchy(child, indent + '  ');
    }
    for (const mesh of meshChildren) {
      console.log(`${indent}  ${mesh.name} (Mesh)`);
    }
  }
  printHierarchy(robotRoot);
  console.log('=== End Hierarchy ===');

  return { meshes, rootNodes: [robotRoot] };
}

/**
 * Find mesh file in file map (tries multiple path variations)
 */
function findMeshFile(meshPath: string, fileMap: Map<string, File>): File | undefined {
  console.log(`  Searching for: ${meshPath}`);

  // Try exact match
  if (fileMap.has(meshPath)) {
    console.log(`  ✓ Found (exact match)`);
    return fileMap.get(meshPath);
  }

  // Try filename only
  const filename = meshPath.split('/').pop();
  if (filename && fileMap.has(filename)) {
    console.log(`  ✓ Found (filename match): ${filename}`);
    return fileMap.get(filename);
  }

  // Try case-insensitive search
  const lowerPath = meshPath.toLowerCase();
  for (const [path, file] of fileMap.entries()) {
    if (path.toLowerCase() === lowerPath) {
      console.log(`  ✓ Found (case-insensitive): ${path}`);
      return file;
    }
  }

  // Try searching paths that end with our mesh path
  for (const [path, file] of fileMap.entries()) {
    if (path.endsWith(meshPath)) {
      console.log(`  ✓ Found (ends with): ${path}`);
      return file;
    }
  }

  // Try searching paths that contain the mesh path
  for (const [path, file] of fileMap.entries()) {
    if (path.includes(meshPath)) {
      console.log(`  ✓ Found (contains): ${path}`);
      return file;
    }
  }

  // Try matching path structure (last N components)
  if (filename) {
    const pathParts = meshPath.split('/').filter(p => p.length > 0);

    for (const [path, file] of fileMap.entries()) {
      const fileParts = path.split('/').filter(p => p.length > 0);

      // Check if last N parts match (e.g., "visual/link_1.stl")
      let matchCount = 0;
      for (let i = 1; i <= pathParts.length && i <= fileParts.length; i++) {
        const pathPart = pathParts[pathParts.length - i];
        const filePart = fileParts[fileParts.length - i];

        if (pathPart === filePart) {
          matchCount++;
        } else {
          break;
        }
      }

      // If at least 2 parts match, consider it a match
      if (matchCount >= 2) {
        console.log(`  ✓ Found (structure match - ${matchCount} parts): ${path}`);
        return file;
      }
    }
  }

  console.log(`  ✗ Not found in ${fileMap.size} files`);
  return undefined;
}

/**
 * Load mesh file (STL/DAE) and attach to link node
 */
async function loadMeshFile(
  file: File,
  linkName: string,
  linkNode: BABYLON.TransformNode,
  origin: { xyz: number[]; rpy: number[] },
  scale: number[] | undefined,
  scene: BABYLON.Scene
): Promise<BABYLON.AbstractMesh[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const data = event.target?.result;
      if (!data) {
        reject(new Error('Failed to read mesh file'));
        return;
      }

      // Determine file extension
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

      // Create blob URL
      const blob = new Blob([data], {
        type: ext === '.stl' ? 'application/octet-stream' : 'application/octet-stream',
      });
      const url = URL.createObjectURL(blob);

      // Load mesh using Babylon's SceneLoader
      BABYLON.SceneLoader.ImportMesh(
        '',
        '',
        url,
        scene,
        (loadedMeshes) => {
          URL.revokeObjectURL(url);

          const meshesToReturn: BABYLON.AbstractMesh[] = [];

          loadedMeshes.forEach((mesh, index) => {
            mesh.name = `${linkName}_${file.name}_${index}`;

            // Parent first, THEN set local position
            mesh.parent = linkNode;

            // Mark as URDF mesh (uses native Babylon Y-up coordinates)
            mesh.metadata = mesh.metadata || {};
            mesh.metadata.isURDFMesh = true;
            mesh.metadata.coordinateSystem = 'babylon-native'; // Y-up, meters

            // Reset position to origin
            mesh.position = BABYLON.Vector3.Zero();
            mesh.rotation = BABYLON.Vector3.Zero();
            mesh.scaling = BABYLON.Vector3.One();

            // Visual origin is relative to the link frame (URDF is in meters, same as Babylon)
            // Most URDF visual origins are (0,0,0)
            if (origin.xyz[0] !== 0 || origin.xyz[1] !== 0 || origin.xyz[2] !== 0) {
              mesh.position = new BABYLON.Vector3(
                origin.xyz[0],
                origin.xyz[1],
                origin.xyz[2]
              );
            }

            // Apply RPY rotation only if non-zero
            if (origin.rpy[0] !== 0 || origin.rpy[1] !== 0 || origin.rpy[2] !== 0) {
              applyRPYRotation(mesh, origin.rpy);
            }

            // Apply scale from URDF if specified
            if (scale) {
              mesh.scaling = new BABYLON.Vector3(scale[0], scale[1], scale[2]);
            }

            meshesToReturn.push(mesh);
          });

          resolve(meshesToReturn);
        },
        null,
        (_scene, message) => {
          URL.revokeObjectURL(url);
          console.error(`Failed to load mesh ${file.name}: ${message}`);
          // Don't reject, just resolve with empty array
          resolve([]);
        },
        ext
      );
    };

    reader.onerror = () => {
      reject(new Error('Failed to read mesh file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Apply URDF RPY (Roll-Pitch-Yaw) rotation to a Babylon node
 * URDF RPY = intrinsic XYZ rotations (rotate around moving axes)
 * Algorithm: R = Rz(yaw) * Ry(pitch) * Rx(roll) in fixed frame
 */
function applyRPYRotation(
  node: BABYLON.TransformNode | BABYLON.AbstractMesh,
  rpy: number[]
): void {
  // URDF uses Z-up convention, Babylon uses Y-up
  // URDF: Roll(X), Pitch(Y), Yaw(Z) in Z-up frame
  // Need to convert to Babylon's Y-up frame
  const roll = rpy[0];   // Rotation around X (same in both)
  const pitch = rpy[1];  // URDF: around Y, Babylon: around Z
  const yaw = rpy[2];    // URDF: around Z, Babylon: around Y

  // Convert RPY to quaternion in URDF's Z-up frame
  const qx = Math.sin(roll / 2) * Math.cos(pitch / 2) * Math.cos(yaw / 2) -
             Math.cos(roll / 2) * Math.sin(pitch / 2) * Math.sin(yaw / 2);
  const qy = Math.cos(roll / 2) * Math.sin(pitch / 2) * Math.cos(yaw / 2) +
             Math.sin(roll / 2) * Math.cos(pitch / 2) * Math.sin(yaw / 2);
  const qz = Math.cos(roll / 2) * Math.cos(pitch / 2) * Math.sin(yaw / 2) -
             Math.sin(roll / 2) * Math.sin(pitch / 2) * Math.cos(yaw / 2);
  const qw = Math.cos(roll / 2) * Math.cos(pitch / 2) * Math.cos(yaw / 2) +
             Math.sin(roll / 2) * Math.sin(pitch / 2) * Math.sin(yaw / 2);

  // Convert quaternion from Z-up to Y-up: swap Y and Z components
  // URDF (x, y, z, w) → Babylon (x, z, y, w)
  node.rotationQuaternion = new BABYLON.Quaternion(qx, qz, qy, qw);
}
