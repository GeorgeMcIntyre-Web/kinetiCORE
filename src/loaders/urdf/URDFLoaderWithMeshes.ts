// URDF Loader with Mesh Loading Support
// Owner: George
// Loads URDF with referenced STL/DAE files from a file map
//
// DEVICE ENTITY HIERARCHY:
// - Use loadURDFAsDeviceEntity() to create a device entity with child link entities
// - Device entity represents the whole robot/mechanism
// - Link entities represent individual links
// - Selection: Click any link → selects whole device (Alt+Click for individual link)
// - Transform gizmo: Attached to device root, moves entire device

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

  // URDF coordinate system: Z-up, right-handed, meters
  // Babylon internal: Y-up, right-handed, meters
  // CONVERSION: Swap Y ↔ Z axes (Z-up → Y-up)

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
    coordinateSystem: 'y-up-internal', // Converted from URDF Z-up to Babylon Y-up
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
      coordinateSystem: 'y-up-internal', // Converted from URDF Z-up to Babylon Y-up
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
        const meshFile = findMeshFile(cleanMeshPath, fileMap);

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
        // Convert from URDF Z-up to Babylon Y-up: (x,y,z) → (x,z,y)
        const origin = link.visual.origin;
        if (origin.xyz[0] !== 0 || origin.xyz[1] !== 0 || origin.xyz[2] !== 0) {
          mesh.position = new BABYLON.Vector3(
            origin.xyz[0],  // X stays X
            origin.xyz[2],  // URDF Z (up) → Babylon Y (up)
            origin.xyz[1]   // URDF Y (forward) → Babylon Z (forward)
          );
        }

        // Apply RPY rotation (converted from Z-up to Y-up)
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

      // Apply joint origin transform
      // Convert from URDF Z-up to Babylon Y-up: (x,y,z) → (x,z,y)
      childNode.position = new BABYLON.Vector3(
        joint.origin.xyz[0],  // X stays X
        joint.origin.xyz[2],  // URDF Z (up) → Babylon Y (up)
        joint.origin.xyz[1]   // URDF Y (forward) → Babylon Z (forward)
      );

      // Apply RPY rotation (converted from Z-up to Y-up)
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

  return { meshes, rootNodes: [robotRoot] };
}

/**
 * Load URDF with meshes and create device entity hierarchy
 *
 * Creates a unified device entity architecture for kinematic devices:
 * - Device entity: Parent entity representing the entire robot/device
 * - Link entities: Child entities for each URDF link, properly mapped to their meshes
 *
 * Key benefits:
 * - Select entire device by clicking any link in viewport
 * - Select entire device by clicking device node in tree
 * - Move entire device as unified assembly with transform gizmo
 * - Highlight all device links together (green glow)
 * - Alt+Click to select individual links when needed
 *
 * @param urdfFile - The URDF XML file
 * @param files - All files from the folder (including STL/DAE meshes)
 * @param scene - Babylon.js scene
 * @param registry - Entity registry to create device entities
 * @returns Device entity (parent), link entities (children), meshes, and root nodes
 */
export async function loadURDFAsDeviceEntity(
  urdfFile: File,
  files: File[],
  scene: BABYLON.Scene,
  registry: any // EntityRegistry
): Promise<{
  deviceEntity: any; // SceneEntity (device root)
  linkEntities: any[]; // SceneEntity[] (all link entities)
  meshes: BABYLON.AbstractMesh[];
  rootNodes: BABYLON.TransformNode[];
}> {
  try {
    // First load the URDF normally
    const { meshes, rootNodes } = await loadURDFWithMeshes(urdfFile, files, scene);

  if (rootNodes.length === 0) {
    throw new Error('No root nodes created from URDF');
  }

  const robotRoot = rootNodes[0];
  const urdfText = await urdfFile.text();
  const urdf = parseURDF(urdfText);

  // Create a dummy mesh for the device entity (invisible root)
  const deviceMesh = BABYLON.MeshBuilder.CreateBox(
    `${urdf.robotName}_device_root`,
    { size: 0.01 },
    scene
  );
  deviceMesh.isVisible = false;
  deviceMesh.parent = robotRoot;
  deviceMesh.position = BABYLON.Vector3.Zero();

  // Create the device entity
  const deviceEntity = registry.create({
    mesh: deviceMesh,
    isDevice: true,
    rootTransformNode: robotRoot,
    joints: urdf.joints,
    metadata: {
      name: urdf.robotName,
      type: 'device',
      deviceType: 'urdf',
      urdfPath: urdfFile.name,
    },
  });

  // Create link entities as children of the device
  const linkEntities: any[] = [];
  const linkNodes = new Map<string, BABYLON.TransformNode>();

  // Build map of link nodes
  function collectLinkNodes(node: BABYLON.TransformNode): void {
    if (node.metadata?.isURDFLink) {
      linkNodes.set(node.name, node);
    }
    const children = node.getChildTransformNodes(false);
    for (const child of children) {
      collectLinkNodes(child);
    }
  }
  collectLinkNodes(robotRoot);

  // Create entities for each link
  for (const [linkName, linkNode] of linkNodes.entries()) {
    // Find the visual mesh for this link from the loaded meshes array
    // Meshes are named like "link_1_link_1.stl_0", so we search for the link name
    let linkMesh: BABYLON.Mesh | null = null;

    for (const mesh of meshes) {
      // Check if mesh name starts with the link name (e.g., "base_link_base_link.stl_0" matches "base_link")
      if (mesh.name.startsWith(linkName + '_') && mesh instanceof BABYLON.Mesh) {
        linkMesh = mesh as BABYLON.Mesh;
        break;
      }
    }

    if (!linkMesh) {
      // Create dummy mesh if no visual mesh exists
      linkMesh = BABYLON.MeshBuilder.CreateBox(
        `${linkName}_dummy`,
        { size: 0.01 },
        scene
      );
      linkMesh.isVisible = false;
      linkMesh.parent = linkNode;
      linkMesh.position = BABYLON.Vector3.Zero();
    }

    // Create link entity
    const linkEntity = registry.create({
      mesh: linkMesh,
      metadata: {
        name: linkName,
        type: 'link',
      },
    });

    // Add as child of device entity
    deviceEntity.addChild(linkEntity);
    linkEntities.push(linkEntity);
  }

    console.log(`✓ Created device entity for ${urdf.robotName} with ${linkEntities.length} link entities`);

    return { deviceEntity, linkEntities, meshes, rootNodes };
  } catch (error) {
    console.error('❌ [loadURDFAsDeviceEntity] ERROR:', error);
    throw error;
  }
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

  // Try filename only (most common case)
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

    // Final fallback: try case-insensitive filename match
    const lowerFilename = filename.toLowerCase();
    for (const [path, file] of fileMap.entries()) {
      const pathFilename = path.split('/').pop()?.toLowerCase();
      if (pathFilename === lowerFilename) {
        console.log(`  ✓ Found (case-insensitive filename): ${path}`);
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

            // Mark as URDF mesh (converted to Y-up)
            mesh.metadata = mesh.metadata || {};
            mesh.metadata.isURDFMesh = true;
            mesh.metadata.coordinateSystem = 'y-up-internal'; // Converted from URDF Z-up

            // Parent to link node FIRST
            mesh.parent = linkNode;

            // Reset to clean state
            mesh.position = BABYLON.Vector3.Zero();
            mesh.rotation = BABYLON.Vector3.Zero();
            mesh.scaling = BABYLON.Vector3.One();

            // NOTE: Babylon's STL loader already loads meshes in Y-up orientation
            // No base rotation needed - STL is already Y-up from Babylon loader

            // Apply visual origin position
            // Convert from URDF Z-up to Babylon Y-up: (x,y,z) → (x,z,y)
            if (origin.xyz[0] !== 0 || origin.xyz[1] !== 0 || origin.xyz[2] !== 0) {
              mesh.position = new BABYLON.Vector3(
                origin.xyz[0],  // X stays X
                origin.xyz[2],  // URDF Z (up) → Babylon Y (up)
                origin.xyz[1]   // URDF Y (forward) → Babylon Z (forward)
              );
            }

            // Apply RPY rotation (converted from Z-up to Y-up)
            if (origin.rpy[0] !== 0 || origin.rpy[1] !== 0 || origin.rpy[2] !== 0) {
              applyRPYRotation(mesh, origin.rpy);
            }

            // Apply scale with Y/Z swap
            if (scale) {
              mesh.scaling = new BABYLON.Vector3(scale[0], scale[2], scale[1]);
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
 *
 * Converts from URDF Z-up to Babylon Y-up by swapping Y and Z components
 */
function applyRPYRotation(
  node: BABYLON.TransformNode | BABYLON.AbstractMesh,
  rpy: number[]
): void {
  const roll = rpy[0];   // URDF: Rotation around X
  const pitch = rpy[1];  // URDF: Rotation around Y
  const yaw = rpy[2];    // URDF: Rotation around Z

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
  const rpyQuaternion = new BABYLON.Quaternion(qx, qz, qy, qw);

  // If node already has a rotation quaternion (e.g., base rotation), compose with it
  if (node.rotationQuaternion) {
    node.rotationQuaternion = node.rotationQuaternion.multiply(rpyQuaternion);
  } else {
    node.rotationQuaternion = rpyQuaternion;
  }
}
