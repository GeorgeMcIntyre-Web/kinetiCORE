/**
 * MJCF (MuJoCo XML) Loader
 * Owner: George
 * 
 * Loads MuJoCo XML files and converts them to Babylon.js meshes with kinematics
 * Supports grippers, fixtures, and end-of-arm tooling (EOT)
 */

import * as BABYLON from '@babylonjs/core';
import JSZip from 'jszip';
import type { HardwareActuator } from '../../kinematics/device/UnifiedDeviceDefinition';
import {
  MJCFModel,
  MJCFBody,
  MJCFJoint,
  MJCFGeom,
  MJCFActuator,
  MJCFImportResult,
  // MJCFImportProgress,
  MJCFImportError,
  MJCFErrorType
} from './types';

/**
 * Load external mesh file (STL, OBJ, etc.)
 * Attempts to load actual mesh files using Babylon.js loaders
 */
async function loadExternalMesh(
  meshFile: string,
  scene: BABYLON.Scene,
  meshDir?: string,
  meshFilesMap?: Map<string, File>
): Promise<BABYLON.AbstractMesh | null> {
  try {
    console.log(`[MJCF Import] Attempting to load external mesh: ${meshFile}`);

    const extension = meshFile.toLowerCase().split('.').pop();

    // Load STL files using Babylon.js STL loader
    if (extension === 'stl') {
      try {
        let result: BABYLON.ISceneLoaderAsyncResult;

        // Try to load from File object if available
        if (meshFilesMap && meshFilesMap.has(meshFile)) {
          const file = meshFilesMap.get(meshFile)!;
          console.log(`[MJCF Import] Loading STL from File object: ${file.name} (${file.size} bytes)`);

          // Read file as ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();
          const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
          const objectURL = URL.createObjectURL(blob);

          try {
            // Load from blob URL
            result = await BABYLON.SceneLoader.ImportMeshAsync(
              '',         // All meshes
              '',         // No root URL needed for blob
              objectURL,  // Blob URL
              scene,
              undefined,
              '.stl'     // Plugin extension
            );

            // Clean up blob URL
            URL.revokeObjectURL(objectURL);
          } catch (blobError) {
            URL.revokeObjectURL(objectURL);
            throw blobError;
          }

        } else if (meshDir) {
          // Fallback to URL-based loading
          const normalizedMeshDir = meshDir.endsWith('/') ? meshDir : `${meshDir}/`;
          const stlPath = `${normalizedMeshDir}${meshFile}`;
          console.log(`[MJCF Import] Loading STL from URL: ${stlPath}`);

          // Use Babylon.js SceneLoader to load STL
          // rootUrl should be the directory, sceneFilename should be the filename
          result = await BABYLON.SceneLoader.ImportMeshAsync(
            '',                // All meshes
            normalizedMeshDir, // Root URL (directory path with trailing slash)
            meshFile,          // Filename
            scene,
            undefined,
            '.stl'            // Plugin extension
          );
        } else {
          throw new Error('No mesh file source available (neither File object nor meshDir)');
        }

        if (result.meshes && result.meshes.length > 0) {
          // Get the first mesh (STL files typically have one mesh)
          const loadedMesh = result.meshes[0];

          // Apply a distinctive material for STL meshes
          const material = new BABYLON.StandardMaterial(`stl_material_${meshFile.replace(/[^a-zA-Z0-9]/g, '_')}`, scene);
          material.diffuseColor = new BABYLON.Color3(0.1, 0.6, 0.9); // Blue color for real STL meshes
          material.alpha = 1.0;
          material.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
          material.backFaceCulling = false; // Show both sides

          // Apply material to all child meshes
          result.meshes.forEach(mesh => {
            if (mesh instanceof BABYLON.Mesh) {
              mesh.material = material;
            }
          });

          // Add metadata
          loadedMesh.metadata = {
            ...loadedMesh.metadata,
            stlFile: meshFile,
            stlPath: `${meshDir}${meshFile}`,
            isSTLMesh: true,
            isRealSTL: true, // Flag to indicate this is a real loaded STL
            originalType: 'mesh'
          };

          console.log(`[MJCF Import] ✅ Successfully loaded STL mesh: ${meshFile} (${result.meshes.length} meshes, ${loadedMesh.getTotalVertices()} vertices)`);
          return loadedMesh as BABYLON.AbstractMesh;
        }

        console.warn(`[MJCF Import] STL loaded but no meshes found: ${meshFile}`);
        throw new Error('No meshes in STL file');

      } catch (stlError) {
        console.warn(`[MJCF Import] Failed to load STL ${meshFile}, creating blue placeholder:`, stlError);

        // Create a distinctive blue placeholder to show STL was attempted
        const mesh = BABYLON.MeshBuilder.CreateBox(
          `stl_placeholder_${meshFile.replace(/[^a-zA-Z0-9]/g, '_')}`,
          { size: 0.4 },
          scene
        );

        const material = new BABYLON.StandardMaterial(`stl_placeholder_material_${meshFile.replace(/[^a-zA-Z0-9]/g, '_')}`, scene);
        material.diffuseColor = new BABYLON.Color3(0.1, 0.6, 0.9); // Blue to indicate STL placeholder
        material.alpha = 0.7;
        material.wireframe = true; // Wireframe to indicate placeholder
        mesh.material = material;

        mesh.metadata = {
          stlFile: meshFile,
          stlPath: meshDir ? `${meshDir}/${meshFile}` : meshFile,
          isSTLMesh: true,
          isPlaceholder: true,
          loadError: stlError instanceof Error ? stlError.message : 'Unknown error',
          originalType: 'mesh'
        };

        return mesh;
      }
    }

    // Fallback to generic placeholder for other file types
    let mesh: BABYLON.AbstractMesh;

    switch (extension) {
      case 'stl':
        mesh = BABYLON.MeshBuilder.CreateBox(
          `external_mesh_${meshFile.replace(/[^a-zA-Z0-9]/g, '_')}`,
          { size: 0.3 },
          scene
        );
        break;

      case 'obj':
        mesh = BABYLON.MeshBuilder.CreateSphere(
          `external_mesh_${meshFile.replace(/[^a-zA-Z0-9]/g, '_')}`,
          { diameter: 0.3 },
          scene
        );
        break;

      case 'dae':
      case 'gltf':
      case 'glb':
        mesh = BABYLON.MeshBuilder.CreateCylinder(
          `external_mesh_${meshFile.replace(/[^a-zA-Z0-9]/g, '_')}`,
          { height: 0.3, diameterTop: 0.2, diameterBottom: 0.2 },
          scene
        );
        break;

      default:
        mesh = BABYLON.MeshBuilder.CreateBox(
          `external_mesh_${meshFile.replace(/[^a-zA-Z0-9]/g, '_')}`,
          { size: 0.2 },
          scene
        );
    }

    // Apply material
    const material = new BABYLON.StandardMaterial(`external_mesh_material_${meshFile.replace(/[^a-zA-Z0-9]/g, '_')}`, scene);
    material.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2); // Green for generic placeholders
    material.alpha = 0.8;
    mesh.material = material;

    console.log(`[MJCF Import] Created generic placeholder for external mesh: ${meshFile}`);
    return mesh;

  } catch (error) {
    console.error(`[MJCF Import] Error loading external mesh ${meshFile}:`, error);
    return null;
  }
}
import { KinematicsManager } from '../../kinematics/KinematicsManager';
// import { SceneTreeManager } from '../../scene/SceneTreeManager';
import type { JointType } from '../../scene/SceneTreeNode';

/**
 * Extract ZIP file and return MJCF file and mesh files
 */
async function extractZipFile(zipFile: File): Promise<{ mjcfFile: File; meshFiles: Map<string, File> }> {
  console.log(`[MJCF Import] Extracting ZIP file: ${zipFile.name}`);

  const zip = new JSZip();
  const zipData = await zipFile.arrayBuffer();
  const zipContents = await zip.loadAsync(zipData);

  let mjcfFile: File | null = null;
  const meshFiles = new Map<string, File>();

  // Find MJCF XML file and STL mesh files
  for (const [filename, zipEntry] of Object.entries(zipContents.files)) {
    if (zipEntry.dir) continue;

    const lowerName = filename.toLowerCase();
    const basename = filename.split('/').pop() || filename;

    // Find MJCF file
    if (lowerName.endsWith('.xml')) {
      const blob = await zipEntry.async('blob');
      mjcfFile = new File([blob], basename, { type: 'text/xml' });
      console.log(`[MJCF Import] Found MJCF file in ZIP: ${basename}`);
    }

    // Find mesh files
    if (lowerName.endsWith('.stl') || lowerName.endsWith('.obj') || lowerName.endsWith('.dae')) {
      const blob = await zipEntry.async('blob');
      const file = new File([blob], basename, { type: 'application/octet-stream' });
      meshFiles.set(basename, file);
      console.log(`[MJCF Import] Found mesh file in ZIP: ${basename}`);
    }
  }

  if (!mjcfFile) {
    throw new MJCFImportError(
      MJCFErrorType.ParseError,
      `No MJCF XML file found in ZIP archive`,
      true
    );
  }

  console.log(`[MJCF Import] Extracted ${meshFiles.size} mesh files from ZIP`);

  return { mjcfFile, meshFiles };
}

/**
 * Load MJCF file and convert to Babylon.js meshes with kinematics
 * Supports both .xml files and .zip archives containing MJCF + mesh files
 */
export async function loadMJCFFromFile(
  file: File,
  scene: BABYLON.Scene,
  meshFiles?: Map<string, File>
): Promise<MJCFImportResult> {
  try {
    console.log(`[MJCF Import] Starting import of ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);

    // Check if file is a ZIP archive
    if (file.name.toLowerCase().endsWith('.zip')) {
      const { mjcfFile, meshFiles: extractedMeshFiles } = await extractZipFile(file);
      return loadMJCFFromFile(mjcfFile, scene, extractedMeshFiles);
    }

    // Validate file
    if (!file.name.toLowerCase().endsWith('.xml')) {
      throw new MJCFImportError(
        MJCFErrorType.ParseError,
        `File ${file.name} is not an XML or ZIP file. MJCF files must have .xml or .zip extension.`,
        true
      );
    }

    if (file.size === 0) {
      throw new MJCFImportError(
        MJCFErrorType.ParseError,
        `File ${file.name} is empty. Please select a valid MJCF file.`,
        true
      );
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      throw new MJCFImportError(
        MJCFErrorType.ParseError,
        `File ${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`,
        true
      );
    }
    
    // Parse MJCF XML
    console.log(`[MJCF Import] Reading file content...`);
    const mjcfXML = await file.text();
    
    if (!mjcfXML || mjcfXML.trim().length === 0) {
      throw new MJCFImportError(
        MJCFErrorType.ParseError,
        `File ${file.name} contains no content or is corrupted.`,
        true
      );
    }

    console.log(`[MJCF Import] Parsing XML (${mjcfXML.length} characters)...`);
    const model = parseMJCFXML(mjcfXML);
    
    if (!model) {
      throw new MJCFImportError(
        MJCFErrorType.ParseError,
        `Failed to parse MJCF XML file ${file.name}. The file may not be a valid MuJoCo XML file.`,
        true
      );
    }

    console.log(`[MJCF Import] Successfully parsed model: "${model.model}"`);
    console.log(`[MJCF Import] Worldbody:`, model.worldbody?.name || 'none');
    console.log(`[MJCF Import] Actuators: ${model.actuator?.length || 0}`);

    // Convert MJCF to Babylon.js
    console.log(`[MJCF Import] Converting to Babylon.js meshes...`);
    if (meshFiles && meshFiles.size > 0) {
      console.log(`[MJCF Import] Using ${meshFiles.size} uploaded mesh files`);
    }
    const result = await convertMJCFToBabylon(model, scene, file.name, meshFiles);
    
    console.log(`[MJCF Import] ✅ Conversion complete: ${result.meshes.length} meshes, ${result.joints.length} joints`);
    
    if (result.meshes.length === 0) {
      result.warnings.push('No meshes were created. The MJCF file may not contain visible geometry.');
    }
    
    return result;
    
  } catch (error) {
    console.error(`[MJCF Import] ❌ Import failed for ${file.name}:`, error);
    
    if (error instanceof MJCFImportError) {
      throw error;
    }
    
    // Convert generic errors to MJCFImportError
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new MJCFImportError(
      MJCFErrorType.ConversionError,
      `Failed to import MJCF file ${file.name}: ${errorMessage}`,
      true
    );
  }
}

/**
 * Parse MJCF XML string into structured data
 */
function parseMJCFXML(xmlString: string): MJCFModel | null {
  try {
    console.log(`[MJCF Parse] Parsing XML string (${xmlString.length} characters)...`);
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      const errorText = parserError.textContent || 'Unknown XML parsing error';
      console.error(`[MJCF Parse] XML parsing failed:`, errorText);
      throw new Error(`XML parsing failed: ${errorText}`);
    }

    const mujoco = xmlDoc.querySelector('mujoco');
    if (!mujoco) {
      console.error(`[MJCF Parse] No mujoco root element found`);
      throw new Error('No mujoco root element found. This may not be a valid MJCF file.');
    }

    const modelName = mujoco.getAttribute('model') || 'unnamed_model';
    console.log(`[MJCF Parse] Found mujoco model: "${modelName}"`);

    const worldbodyEl = mujoco.querySelector('worldbody');
    if (!worldbodyEl) {
      console.warn(`[MJCF Parse] No worldbody found in MJCF file`);
    }

        // Extract mesh directory from compiler
        const compilerEl = mujoco.querySelector('compiler');
        const meshDir = compilerEl?.getAttribute('meshdir') || 'assets';

        const model: MJCFModel = {
          model: modelName,
          worldbody: parseBody(worldbodyEl),
          actuator: parseActuators(mujoco.querySelectorAll('actuator')),
          tendon: parseTendons(mujoco.querySelectorAll('tendon')),
          equality: parseEqualities(mujoco.querySelectorAll('equality')),
          contact: parseContacts(mujoco.querySelectorAll('contact')),
          asset: parseAssets(mujoco.querySelectorAll('asset')),
          meshDir: meshDir
        };

    console.log(`[MJCF Parse] ✅ Successfully parsed model:`, {
      name: model.model,
      hasWorldbody: !!model.worldbody,
      actuatorCount: model.actuator?.length || 0,
      tendonCount: model.tendon?.length || 0,
      contactCount: model.contact?.length || 0,
      assetCount: model.asset?.length || 0
    });

    return model;
    
  } catch (error) {
    console.error(`[MJCF Parse] ❌ Failed to parse MJCF XML:`, error);
    return null;
  }
}

/**
 * Parse MJCF body element
 */
function parseBody(bodyEl: Element | null): MJCFBody {
  if (!bodyEl) {
    return { name: 'world' };
  }

  const body: MJCFBody = {
    name: bodyEl.getAttribute('name') || 'unnamed_body'
  };

  // Parse position
  const pos = bodyEl.getAttribute('pos');
  if (pos) {
    body.pos = pos.split(/\s+/).map(Number) as [number, number, number];
  }

  // Parse quaternion
  const quat = bodyEl.getAttribute('quat');
  if (quat) {
    body.quat = quat.split(/\s+/).map(Number) as [number, number, number, number];
  }

  // Parse euler angles
  const euler = bodyEl.getAttribute('euler');
  if (euler) {
    body.euler = euler.split(/\s+/).map(Number) as [number, number, number];
  }

  // Parse child bodies
  const childBodies = bodyEl.querySelectorAll('body');
  if (childBodies.length > 0) {
    body.bodies = Array.from(childBodies).map(parseBody);
  }

  // Parse joints
  const joints = bodyEl.querySelectorAll('joint');
  if (joints.length > 0) {
    body.joints = Array.from(joints).map(parseJoint);
  }

  // Parse geometry
  const geoms = bodyEl.querySelectorAll('geom');
  if (geoms.length > 0) {
    body.geoms = Array.from(geoms).map(parseGeom);
  }

  // Parse inertial
  const inertial = bodyEl.querySelector('inertial');
  if (inertial) {
    body.inertial = parseInertial(inertial);
  }

  return body;
}

/**
 * Parse MJCF joint element
 */
function parseJoint(jointEl: Element): MJCFJoint {
  const joint: MJCFJoint = {
    name: jointEl.getAttribute('name') || 'unnamed_joint',
    type: (jointEl.getAttribute('type') as any) || 'fixed'
  };

  // Parse position
  const pos = jointEl.getAttribute('pos');
  if (pos) {
    joint.pos = pos.split(/\s+/).map(Number) as [number, number, number];
  }

  // Parse axis
  const axis = jointEl.getAttribute('axis');
  if (axis) {
    joint.axis = axis.split(/\s+/).map(Number) as [number, number, number];
  }

  // Parse range
  const range = jointEl.getAttribute('range');
  if (range) {
    joint.range = range.split(/\s+/).map(Number) as [number, number];
  }

  // Parse dynamics
  const damping = jointEl.getAttribute('damping');
  if (damping) {
    joint.damping = parseFloat(damping);
  }

  const friction = jointEl.getAttribute('friction');
  if (friction) {
    joint.friction = parseFloat(friction);
  }

  const stiffness = jointEl.getAttribute('stiffness');
  if (stiffness) {
    joint.stiffness = parseFloat(stiffness);
  }

  const springref = jointEl.getAttribute('springref');
  if (springref) {
    joint.springref = parseFloat(springref);
  }

  return joint;
}

/**
 * Parse MJCF geometry element
 */
function parseGeom(geomEl: Element): MJCFGeom {
  // Check if mesh attribute is present - if so, type is implicitly 'mesh'
  const meshAttr = geomEl.getAttribute('mesh') || geomEl.getAttribute('meshfile');
  const typeAttr = geomEl.getAttribute('type');

  const geom: MJCFGeom = {
    type: (typeAttr as any) || (meshAttr ? 'mesh' : 'box')
  };

  const name = geomEl.getAttribute('name');
  if (name) {
    geom.name = name;
  }

  // Parse size
  const size = geomEl.getAttribute('size');
  if (size) {
    const sizeValues = size.split(/\s+/).map(Number);
    geom.size = sizeValues.length === 1 ? sizeValues[0] : sizeValues as [number, number, number];
  }

  // Parse position
  const pos = geomEl.getAttribute('pos');
  if (pos) {
    geom.pos = pos.split(/\s+/).map(Number) as [number, number, number];
  }

  // Parse quaternion
  const quat = geomEl.getAttribute('quat');
  if (quat) {
    geom.quat = quat.split(/\s+/).map(Number) as [number, number, number, number];
  }

  // Parse color
  const rgba = geomEl.getAttribute('rgba');
  if (rgba) {
    geom.rgba = rgba.split(/\s+/).map(Number) as [number, number, number, number];
  }

  // Parse mass
  const mass = geomEl.getAttribute('mass');
  if (mass) {
    geom.mass = parseFloat(mass);
  }

  // Parse density
  const density = geomEl.getAttribute('density');
  if (density) {
    geom.density = parseFloat(density);
  }

  // Parse friction
  const friction = geomEl.getAttribute('friction');
  if (friction) {
    geom.friction = friction.split(/\s+/).map(Number) as [number, number, number];
  }

  // Parse mesh
  const mesh = geomEl.getAttribute('mesh');
  if (mesh) {
    geom.mesh = mesh;
  }

  const meshfile = geomEl.getAttribute('meshfile');
  if (meshfile) {
    geom.meshfile = meshfile;
  }

  return geom;
}

/**
 * Parse MJCF inertial element
 */
function parseInertial(inertialEl: Element): any {
  const inertial: any = {};

  const pos = inertialEl.getAttribute('pos');
  if (pos) {
    inertial.pos = pos.split(/\s+/).map(Number) as [number, number, number];
  }

  const quat = inertialEl.getAttribute('quat');
  if (quat) {
    inertial.quat = quat.split(/\s+/).map(Number) as [number, number, number, number];
  }

  const mass = inertialEl.getAttribute('mass');
  if (mass) {
    inertial.mass = parseFloat(mass);
  }

  const diaginertia = inertialEl.getAttribute('diaginertia');
  if (diaginertia) {
    inertial.diaginertia = diaginertia.split(/\s+/).map(Number) as [number, number, number];
  }

  return inertial;
}

/**
 * Parse MJCF actuators
 */
function parseActuators(actuatorEls: NodeListOf<Element>): MJCFActuator[] {
  return Array.from(actuatorEls).map(el => {
    const actuator: MJCFActuator = {
      name: el.getAttribute('name') || 'unnamed_actuator',
      joint: el.getAttribute('joint') || ''
    };

    const gear = el.getAttribute('gear');
    if (gear) {
      actuator.gear = parseFloat(gear);
    }

    const ctrlrange = el.getAttribute('ctrlrange');
    if (ctrlrange) {
      actuator.ctrlrange = ctrlrange;
    }

    const forcerange = el.getAttribute('forcerange');
    if (forcerange) {
      actuator.forcerange = forcerange.split(/\s+/).map(Number) as [number, number];
    }

    return actuator;
  });
}

/**
 * Parse MJCF tendons
 */
function parseTendons(tendonEls: NodeListOf<Element>): any[] {
  return Array.from(tendonEls).map(el => ({
    name: el.getAttribute('name') || 'unnamed_tendon',
    joint: el.getAttribute('joint')?.split(/\s+/) || [],
    stiffness: el.getAttribute('stiffness') ? parseFloat(el.getAttribute('stiffness')!) : undefined,
    damping: el.getAttribute('damping') ? parseFloat(el.getAttribute('damping')!) : undefined
  }));
}

/**
 * Parse MJCF equality constraints
 */
function parseEqualities(equalityEls: NodeListOf<Element>): any[] {
  return Array.from(equalityEls).map(el => ({
    type: el.getAttribute('type') || 'connect',
    body1: el.getAttribute('body1'),
    body2: el.getAttribute('body2'),
    joint1: el.getAttribute('joint1'),
    joint2: el.getAttribute('joint2')
  }));
}

/**
 * Parse MJCF contacts
 */
function parseContacts(contactEls: NodeListOf<Element>): any[] {
  return Array.from(contactEls).map(el => ({
    name: el.getAttribute('name') || 'unnamed_contact',
    geom1: el.getAttribute('geom1'),
    geom2: el.getAttribute('geom2'),
    friction: el.getAttribute('friction')?.split(/\s+/).map(Number),
    condim: el.getAttribute('condim') ? parseInt(el.getAttribute('condim')!) : undefined,
    solref: el.getAttribute('solref')?.split(/\s+/).map(Number),
    solimp: el.getAttribute('solimp')?.split(/\s+/).map(Number)
  }));
}

/**
 * Parse MJCF assets
 */
function parseAssets(assetEls: NodeListOf<Element>): any[] {
  const assets: any[] = [];

  // Process each <asset> section
  assetEls.forEach(assetSection => {
    // Parse mesh assets
    const meshEls = assetSection.querySelectorAll('mesh');
    meshEls.forEach(meshEl => {
      let name = meshEl.getAttribute('name');
      const file = meshEl.getAttribute('file');

      if (file) {
        // If no name attribute, derive name from filename (without extension)
        if (!name) {
          name = file.replace(/\.[^.]*$/, ''); // Remove extension
        }

        assets.push({
          name,
          type: 'mesh' as const,
          file,
          scale: meshEl.getAttribute('scale') ? parseFloat(meshEl.getAttribute('scale')!) : undefined
        });
      }
    });

    // Parse texture assets
    const textureEls = assetSection.querySelectorAll('texture');
    textureEls.forEach(textureEl => {
      const name = textureEl.getAttribute('name');
      const file = textureEl.getAttribute('file');

      if (name && file) {
        assets.push({
          name,
          type: 'texture' as const,
          file,
        });
      }
    });

    // Parse material assets
    const materialEls = assetSection.querySelectorAll('material');
    materialEls.forEach(materialEl => {
      const name = materialEl.getAttribute('name');

      if (name) {
        assets.push({
          name,
          type: 'material' as const,
          file: '', // Materials don't have files
        });
      }
    });
  });

  console.log(`[MJCF Parse] Parsed ${assets.length} assets:`, assets.map(a => `${a.name} (${a.type})`));
  return assets;
}

/**
 * Convert MJCF model to Babylon.js meshes and kinematics
 */
async function convertMJCFToBabylon(
  model: MJCFModel,
  scene: BABYLON.Scene,
  fileName: string,
  meshFiles?: Map<string, File>
): Promise<MJCFImportResult> {
  const result: MJCFImportResult = {
    success: true,
    meshes: [],
    rootNodes: [],
    joints: [],
    actuators: model.actuator || [],
    errors: [],
    warnings: []
  };

      // Performance limits to prevent getting stuck
      const MAX_MESHES = 200; // Increased limit for complex models
      const MAX_BODIES = 500; // Increased limit for complex models
  let processedBodies = 0;
  let processedMeshes = 0;

  try {
    console.log(`[MJCF Import] Starting conversion with limits: max ${MAX_MESHES} meshes, max ${MAX_BODIES} bodies`);
    
        // Create root assembly node
        const assemblyRoot = new BABYLON.TransformNode(
          fileName.replace('.mjcf', '').replace('.xml', ''),
          scene
        );
        
        // Ensure root node is enabled and visible
        assemblyRoot.setEnabled(true);

    // Convert world body and all children
    const worldBodyResult = await convertBodyToBabylon(
      model.worldbody,
      assemblyRoot,
      scene,
      model,
      { count: processedBodies },
      { count: processedMeshes },
      MAX_BODIES,
      MAX_MESHES,
      meshFiles
    );

    result.meshes.push(...worldBodyResult.meshes);
    result.joints.push(...worldBodyResult.joints);

    // Add metadata to all meshes
    result.meshes.forEach(mesh => {
      if (!mesh.metadata) {
        mesh.metadata = {};
      }
      mesh.metadata.sourceFormat = 'mjcf';
      mesh.metadata.originalFile = fileName;
      mesh.metadata.modelName = model.model;
    });

    result.rootNodes.push(assemblyRoot);

    console.log(`[MJCF Import] Converted ${result.meshes.length} meshes and ${result.joints.length} joints`);

    // Ensure meshes are visible by fitting camera to bounds
    if (result.meshes.length > 0) {
      // Calculate bounds manually since FromMeshes doesn't exist
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      
      for (const mesh of result.meshes) {
        const boundingInfo = mesh.getBoundingInfo();
        const min = boundingInfo.boundingBox.minimum;
        const max = boundingInfo.boundingBox.maximum;
        
        minX = Math.min(minX, min.x);
        minY = Math.min(minY, min.y);
        minZ = Math.min(minZ, min.z);
        maxX = Math.max(maxX, max.x);
        maxY = Math.max(maxY, max.y);
        maxZ = Math.max(maxZ, max.z);
      }
      
      const bounds = new BABYLON.BoundingBox(
        new BABYLON.Vector3(minX, minY, minZ),
        new BABYLON.Vector3(maxX, maxY, maxZ)
      );
      console.log(`[MJCF Import] Mesh bounds:`, {
        min: bounds.minimum,
        max: bounds.maximum,
        center: bounds.center,
        size: bounds.maximum.subtract(bounds.minimum)
      });
      
      // Store bounds for camera fitting
      result.bounds = bounds;
      
      // Force scene refresh to ensure meshes are rendered
      scene.markAllMaterialsAsDirty(0);
    }

  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

/**
 * Convert MJCF body to Babylon.js meshes
 */
async function convertBodyToBabylon(
  body: MJCFBody,
  parentNode: BABYLON.TransformNode,
  scene: BABYLON.Scene,
  model: MJCFModel,
  processedBodies: { count: number },
  processedMeshes: { count: number },
  maxBodies: number,
  maxMeshes: number,
  meshFiles?: Map<string, File>
): Promise<{ meshes: BABYLON.AbstractMesh[]; joints: MJCFJoint[] }> {
  // Check limits
  if (processedBodies.count >= maxBodies) {
    console.log(`[MJCF Convert] Reached body limit (${maxBodies}), skipping remaining bodies`);
    return { meshes: [], joints: [] };
  }
  
  processedBodies.count++;
  
  console.log(`[MJCF Convert] Converting body: ${body.name} (${processedBodies.count}/${maxBodies})`);
  const meshes: BABYLON.AbstractMesh[] = [];
  const joints: MJCFJoint[] = [];

      // Create transform node for this body
      const bodyNode = new BABYLON.TransformNode(body.name, scene);
      bodyNode.setParent(parentNode);
      bodyNode.setEnabled(true);

  // Apply position with scaling for visibility
  if (body.pos) {
    // MJCF uses Z-up, convert to Babylon Y-up
    // Scale up positions for better visibility (MJCF units are often very small)
    const scaleFactor = 10;
    bodyNode.position = new BABYLON.Vector3(
      body.pos[0] * scaleFactor,
      body.pos[2] * scaleFactor,  // MJCF Z → Babylon Y
      body.pos[1] * scaleFactor   // MJCF Y → Babylon Z
    );
  }

  // Apply rotation (quaternion or euler)
  if (body.quat) {
    // Convert MJCF quaternion (w,x,y,z) to Babylon quaternion (x,y,z,w)
    const quat = new BABYLON.Quaternion(
      body.quat[1],  // x
      body.quat[3],  // MJCF z → Babylon y
      body.quat[2],  // MJCF y → Babylon z
      body.quat[0]   // w
    );
    bodyNode.rotationQuaternion = quat;
  } else if (body.euler) {
    // Convert MJCF euler (roll, pitch, yaw) to Babylon rotation
    const rotation = new BABYLON.Vector3(
      body.euler[0],  // roll
      body.euler[2],  // MJCF yaw → Babylon y
      body.euler[1]   // MJCF pitch → Babylon z
    );
    bodyNode.rotation = rotation;
  }

  // Convert geometry
  if (body.geoms && processedMeshes.count < maxMeshes) {
    const remainingMeshes = maxMeshes - processedMeshes.count;
    const geomsToProcess = body.geoms.slice(0, remainingMeshes);
    
    console.log(`[MJCF Convert] Processing ${geomsToProcess.length}/${body.geoms.length} geometries for body: ${body.name} (${processedMeshes.count}/${maxMeshes} total)`);
    
    for (const geom of geomsToProcess) {
      if (processedMeshes.count >= maxMeshes) {
        console.log(`[MJCF Convert] Reached mesh limit (${maxMeshes}), skipping remaining geometries`);
        break;
      }
      
          const mesh = await createMeshFromGeom(geom, bodyNode, scene, model, meshFiles);
          if (mesh) {
            meshes.push(mesh);
            processedMeshes.count++;
            console.log(`[MJCF Convert] Created mesh: ${mesh.name} (${processedMeshes.count}/${maxMeshes})`);
          }
    }
  } else if (processedMeshes.count >= maxMeshes) {
    console.log(`[MJCF Convert] Reached mesh limit (${maxMeshes}), skipping geometries for body: ${body.name}`);
  } else {
    console.log(`[MJCF Convert] No geometries found for body: ${body.name}`);
  }

  // Process joints
  if (body.joints) {
    joints.push(...body.joints);
  }

  // Process child bodies recursively
  if (body.bodies) {
    for (const childBody of body.bodies) {
      const childResult = await convertBodyToBabylon(
        childBody,
        bodyNode,
        scene,
        model,
        processedBodies,
        processedMeshes,
        maxBodies,
        maxMeshes,
        meshFiles
      );
      meshes.push(...childResult.meshes);
      joints.push(...childResult.joints);
    }
  }

  return { meshes, joints };
}

/**
 * Create Babylon.js mesh from MJCF geometry
 */
async function createMeshFromGeom(
  geom: MJCFGeom,
  parentNode: BABYLON.TransformNode,
  scene: BABYLON.Scene,
  model: MJCFModel,
  meshFiles?: Map<string, File>
): Promise<BABYLON.AbstractMesh | null> {
  let mesh: BABYLON.AbstractMesh | null = null;

  try {
        switch (geom.type) {
          case 'box':
            const boxSize = Array.isArray(geom.size) ? geom.size[0] : geom.size || 1;
            mesh = BABYLON.MeshBuilder.CreateBox(
              `${parentNode.name}_${geom.name || 'box'}`,
              { size: Math.max(boxSize, 0.1) }, // Increased minimum size for visibility
              scene
            );
            break;

          case 'sphere':
            const sphereSize = Array.isArray(geom.size) ? geom.size[0] : geom.size || 1;
            mesh = BABYLON.MeshBuilder.CreateSphere(
              `${parentNode.name}_${geom.name || 'sphere'}`,
              { diameter: Math.max(sphereSize * 2, 0.2) }, // Increased minimum size for visibility
              scene
            );
            break;

          case 'cylinder':
            const radius = Array.isArray(geom.size) ? geom.size[0] : geom.size || 0.5;
            const height = Array.isArray(geom.size) ? geom.size[1] : geom.size || 1;
            mesh = BABYLON.MeshBuilder.CreateCylinder(
              `${parentNode.name}_${geom.name || 'cylinder'}`,
              { 
                height: Math.max(height, 0.1), 
                diameterTop: Math.max(radius * 2, 0.2), 
                diameterBottom: Math.max(radius * 2, 0.2) 
              },
              scene
            );
            break;

      case 'capsule':
        const capRadius = Array.isArray(geom.size) ? geom.size[0] : geom.size || 0.5;
        const capHeight = Array.isArray(geom.size) ? geom.size[1] : geom.size || 1;
        mesh = BABYLON.MeshBuilder.CreateCapsule(
          `${parentNode.name}_${geom.name || 'capsule'}`,
          { radius: capRadius, height: capHeight },
          scene
        );
        break;

      case 'plane':
        mesh = BABYLON.MeshBuilder.CreateGround(
          `${parentNode.name}_${geom.name || 'plane'}`,
          { width: 10, height: 10 },
          scene
        );
        break;

          case 'mesh':
            // Look up mesh file from assets
            const meshName = geom.mesh || geom.meshfile;
            if (meshName) {
              console.log(`[MJCF Import] Looking up mesh asset: "${meshName}"`);

              // Create asset lookup map
              const assetLookup = new Map<string, string>();
              if (model.asset) {
                model.asset.forEach(asset => {
                  if (asset.type === 'mesh' && asset.file) {
                    assetLookup.set(asset.name, asset.file);
                  }
                });
              }

              // Look up the actual mesh file from assets
              let meshFile = assetLookup.get(meshName);

              // If not found in assets, use the mesh name directly (might be a file path)
              if (!meshFile) {
                console.warn(`[MJCF Import] Mesh "${meshName}" not found in assets, using directly`);
                meshFile = meshName;
              } else {
                console.log(`[MJCF Import] Found mesh asset: "${meshName}" -> "${meshFile}"`);
              }

              try {
                // Try to load the actual mesh file with mesh directory
                const meshResult = await loadExternalMesh(meshFile, scene, model.meshDir, meshFiles);
                if (meshResult) {
                  mesh = meshResult;
                  mesh.name = `${parentNode.name}_${meshName.replace(/[^a-zA-Z0-9]/g, '_')}`;
                  mesh.setParent(parentNode);

                  // Add metadata
                  mesh.metadata = {
                    ...mesh.metadata,
                    externalMeshFile: meshFile,
                    meshAssetName: meshName,
                    isExternalMesh: true,
                    originalType: 'mesh'
                  };

                  console.log(`[MJCF Import] Successfully loaded external mesh: ${meshName} (${meshFile})`);
                } else {
                  // Fallback to placeholder if mesh loading fails
                  console.warn(`[MJCF Import] Failed to load external mesh ${meshName}, creating placeholder`);
                  mesh = BABYLON.MeshBuilder.CreateBox(
                    `${parentNode.name}_${meshName.replace(/[^a-zA-Z0-9]/g, '_')}_placeholder`,
                    { size: 0.2 },
                    scene
                  );

                  mesh.metadata = {
                    ...mesh.metadata,
                    externalMeshFile: meshFile,
                    meshAssetName: meshName,
                    isPlaceholder: true,
                    originalType: 'mesh'
                  };
                }
              } catch (error) {
                console.error(`[MJCF Import] Failed to load external mesh ${meshName}:`, error);
                // Create placeholder on error
                mesh = BABYLON.MeshBuilder.CreateBox(
                  `${parentNode.name}_${meshName.replace(/[^a-zA-Z0-9]/g, '_')}_error`,
                  { size: 0.2 },
                  scene
                );

                mesh.metadata = {
                  ...mesh.metadata,
                  externalMeshFile: meshFile,
                  meshAssetName: meshName,
                  isPlaceholder: true,
                  loadError: error instanceof Error ? error.message : 'Unknown error',
                  originalType: 'mesh'
                };
              }
            } else {
              console.warn(`[MJCF Import] Mesh geometry has no mesh name specified`);
              return null;
            }
            break;

      default:
        console.warn(`[MJCF Import] Unsupported geometry type: ${geom.type}`);
        return null;
    }

        if (mesh) {
          mesh.setParent(parentNode);

          // Apply geometry position with scaling for visibility
          if (geom.pos) {
            // Scale up positions for better visibility (MJCF units are often very small)
            const scaleFactor = 10; // Scale up by 10x for visibility
            mesh.position = new BABYLON.Vector3(
              geom.pos[0] * scaleFactor,
              geom.pos[2] * scaleFactor,  // MJCF Z → Babylon Y
              geom.pos[1] * scaleFactor   // MJCF Y → Babylon Z
            );
          } else {
            // If no position specified, spread meshes out for visibility
            const meshIndex = parentNode.getChildren().length;
            const spreadFactor = 0.5;
            mesh.position = new BABYLON.Vector3(
              (meshIndex % 10) * spreadFactor,
              Math.floor(meshIndex / 10) * spreadFactor,
              0
            );
          }

      // Apply geometry rotation
      if (geom.quat) {
        const quat = new BABYLON.Quaternion(
          geom.quat[1],  // x
          geom.quat[3],  // MJCF z → Babylon y
          geom.quat[2],  // MJCF y → Babylon z
          geom.quat[0]   // w
        );
        mesh.rotationQuaternion = quat;
      }

      // Apply color or default material
      if (geom.rgba) {
        const material = new BABYLON.StandardMaterial(`${geom.name || 'geom'}_material`, scene);
        material.diffuseColor = new BABYLON.Color3(
          geom.rgba[0],
          geom.rgba[1],
          geom.rgba[2]
        );
        material.alpha = geom.rgba[3];
        mesh.material = material;
      } else {
        // Apply default material to make meshes visible
        const defaultMaterial = new BABYLON.StandardMaterial(`${mesh.name}_default_material`, scene);
        defaultMaterial.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7); // Light gray
        defaultMaterial.alpha = 1.0;
        mesh.material = defaultMaterial;
      }

      // Store MJCF metadata
      mesh.metadata = {
        ...mesh.metadata,
        mjcfGeom: geom,
        sourceFormat: 'mjcf'
      };
      
      // Ensure mesh is visible and enabled
      mesh.setEnabled(true);
      mesh.isVisible = true;
      mesh.isPickable = true;
      
      // Debug: Check mesh properties
      console.log(`[MJCF Convert] Created mesh: ${mesh.name}`, {
        position: `(${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`,
        enabled: mesh.isEnabled(),
        visible: mesh.isVisible,
        pickable: mesh.isPickable,
        material: mesh.material ? mesh.material.name : 'none',
        parent: mesh.parent ? mesh.parent.name : 'none',
        uniqueId: mesh.uniqueId,
        verticesCount: mesh.getTotalVertices(),
        boundingInfo: mesh.getBoundingInfo() ? 'exists' : 'missing'
      });
    }

  } catch (error) {
    console.error(`Failed to create mesh from geometry:`, error);
  }

  return mesh;
}

/**
 * Map MJCF joint type to kinetiCORE joint type
 */
function mapMJCFJointType(mjcfType: string): JointType {
  switch (mjcfType) {
    case 'hinge':
      return 'revolute';
    case 'slide':
      return 'prismatic';
    case 'ball':
      return 'spherical';
    case 'free':
      return 'spherical'; // Approximate
    case 'fixed':
      return 'fixed';
    default:
      console.warn(`Unknown MJCF joint type: ${mjcfType}, defaulting to fixed`);
      return 'fixed';
  }
}

/**
 * Create kinematics from MJCF joints
 */
export async function createKinematicsFromMJCF(
  mjcfXML: string,
  deviceRootNodeId: string
): Promise<void> {
  const model = parseMJCFXML(mjcfXML);
  if (!model) {
    throw new Error('Failed to parse MJCF XML');
  }

  const kinematicsManager = KinematicsManager.getInstance();
  // const _sceneTreeManager = SceneTreeManager.getInstance();

  console.log(`[MJCF Kinematics] Creating kinematics for ${model.model}`);

  // Extract all joints from the model
  const allJoints: MJCFJoint[] = [];
  
  const extractJointsFromBody = (body: MJCFBody) => {
    if (body.joints) {
      allJoints.push(...body.joints);
    }
    if (body.bodies) {
      body.bodies.forEach(extractJointsFromBody);
    }
  };

  extractJointsFromBody(model.worldbody);

  console.log(`[MJCF Kinematics] Found ${allJoints.length} joints`);

  // Create joints in kinetiCORE
  let createdCount = 0;
  for (const mjcfJoint of allJoints) {
    if (mjcfJoint.type === 'fixed') {
      continue; // Skip fixed joints
    }

    const jointType = mapMJCFJointType(mjcfJoint.type);

    // For now, create joints with default parent/child relationships
    // TODO: Parse actual parent-child relationships from MJCF structure
    const joint = kinematicsManager.createJoint({
      id: `${deviceRootNodeId}_joint_${mjcfJoint.name}`,
      name: mjcfJoint.name,
      type: jointType,
      parentNodeId: deviceRootNodeId, // TODO: Find actual parent
      childNodeId: deviceRootNodeId,  // TODO: Find actual child
      axis: mjcfJoint.axis ? {
        x: mjcfJoint.axis[0],
        y: mjcfJoint.axis[2], // MJCF Z → Babylon Y
        z: mjcfJoint.axis[1]  // MJCF Y → Babylon Z
      } : { x: 0, y: 0, z: 1 },
      limits: mjcfJoint.range ? {
        lower: mjcfJoint.range[0],
        upper: mjcfJoint.range[1],
        velocity: 1.0,
        effort: 10.0
      } : {
        lower: jointType === 'revolute' ? -Math.PI : -1000,
        upper: jointType === 'revolute' ? Math.PI : 1000,
        velocity: 1.0,
        effort: 10.0
      }
    });

    if (joint) {
      createdCount++;
      console.log(`Created joint: ${joint.name} (${joint.type})`);
    }
  }

  console.log(`✅ Created ${createdCount}/${allJoints.length} joints from MJCF`);

  // Process actuators from MJCF
  if (model.actuator && model.actuator.length > 0) {
    console.log(`[MJCF Kinematics] Processing ${model.actuator.length} actuators...`);
    
    // Import ActuatorSystem dynamically to avoid circular dependencies
    const { ActuatorSystem } = await import('../../kinematics/actuation/ActuatorSystem');
    const actuatorSystem = new ActuatorSystem();
    
    // Process each actuator
    for (const mjcfActuator of model.actuator) {
      if (mjcfActuator.joint) {
        // Find the corresponding joint
        const joint = allJoints.find(j => j.name === mjcfActuator.joint);
        
        if (joint) {
          // Create hardware actuator
          const hardwareActuator: HardwareActuator = {
            id: `${deviceRootNodeId}_actuator_${mjcfActuator.name}`,
            name: mjcfActuator.name || 'unnamed_actuator',
            type: (mjcfActuator.type as any) || 'position',
            controlMode: 'position',
            controlledJoints: [`${deviceRootNodeId}_joint_${joint.name}`],
            specs: {
              forceRange: {
                min: mjcfActuator.forcerange ? mjcfActuator.forcerange[0] : -100,
                max: mjcfActuator.forcerange ? mjcfActuator.forcerange[1] : 100
              },
              ctrlRange: {
                min: mjcfActuator.ctrlrange ? parseFloat(mjcfActuator.ctrlrange.split(' ')[0]) : -1.0,
                max: mjcfActuator.ctrlrange ? parseFloat(mjcfActuator.ctrlrange.split(' ')[1]) : 1.0
              },
              gearRatio: mjcfActuator.gear || 1.0
            },
            coordination: [{
              jointId: `${deviceRootNodeId}_joint_${joint.name}`,
              ratio: 1.0,
              offset: 0.0
            }],
            state: {
              enabled: false,
              value: 0,
              fault: false
            }
          };
          
          // Register actuator
          actuatorSystem.registerActuator(hardwareActuator);
          
          console.log(`[MJCF Kinematics] Registered actuator: ${mjcfActuator.name} → ${joint.name}`);
        }
      }
    }
  }

  // Process collision pairs from MJCF contacts
  if (model.contact && model.contact.length > 0) {
    console.log(`[MJCF Kinematics] Processing ${model.contact.length} collision pairs...`);
    
    // Import JointCollisionManager dynamically to avoid circular dependencies
      const { JointCollisionManager } = await import('../../kinematics/collision/JointCollisionManager');
    const collisionManager = JointCollisionManager.getInstance();
    
    // Initialize collision manager with scene if available
    // Note: SceneTreeManager doesn't have scene access, skipping collision initialization
    // const sceneTreeManager = (await import('../../scene/SceneTreeManager')).SceneTreeManager.getInstance();
    // const scene = sceneTreeManager.getScene(); // Use getter method
    
    // if (scene) {
    //   collisionManager.initialize(scene);
    // }

    // Process each contact pair
    for (const contact of model.contact) {
      if (contact.geom1 && contact.geom2) {
        // Find joints associated with these geoms
        const jointA = allJoints.find(j => j.name === contact.geom1);
        const jointB = allJoints.find(j => j.name === contact.geom2);
        
        if (jointA && jointB) {
          collisionManager.addCollisionPair(
            `${deviceRootNodeId}_joint_${jointA.name}`,
            `${deviceRootNodeId}_joint_${jointB.name}`,
            5.0, // Default clearance
            10.0 // Default warning distance
          );
          
          console.log(`[MJCF Kinematics] Added collision pair: ${contact.geom1} <-> ${contact.geom2}`);
        }
      }
    }
  }
}

/**
 * Load MJCF file and create kinematics
 */
export async function loadMJCFWithKinematics(
  mjcfFile: File,
  deviceRootNodeId: string
): Promise<void> {
  const mjcfXML = await mjcfFile.text();
  await createKinematicsFromMJCF(mjcfXML, deviceRootNodeId);
}
