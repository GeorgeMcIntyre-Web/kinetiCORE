/**
 * MJCF (MuJoCo XML) Loader
 * Owner: George
 * 
 * Loads MuJoCo XML files and converts them to Babylon.js meshes with kinematics
 * Supports grippers, fixtures, and end-of-arm tooling (EOT)
 */

import * as BABYLON from '@babylonjs/core';
import { 
  MJCFModel, 
  MJCFBody, 
  MJCFJoint, 
  MJCFGeom, 
  MJCFActuator,
  MJCFImportResult,
  MJCFImportProgress,
  MJCFImportError,
  MJCFErrorType
} from './types';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import type { JointType } from '../../scene/SceneTreeNode';

/**
 * Load MJCF file and convert to Babylon.js meshes with kinematics
 */
export async function loadMJCFFromFile(
  file: File,
  scene: BABYLON.Scene
): Promise<MJCFImportResult> {
  try {
    console.log(`[MJCF Import] Loading ${file.name}...`);
    
    // Parse MJCF XML
    const mjcfXML = await file.text();
    const model = parseMJCFXML(mjcfXML);
    
    if (!model) {
      throw new MJCFImportError(
        MJCFErrorType.ParseError,
        'Failed to parse MJCF XML file',
        false
      );
    }

    console.log(`[MJCF Import] Parsed model: ${model.model}`);

    // Convert MJCF to Babylon.js
    const result = await convertMJCFToBabylon(model, scene, file.name);
    
    console.log(`[MJCF Import] Conversion complete: ${result.meshes.length} meshes, ${result.joints.length} joints`);
    
    return result;
    
  } catch (error) {
    if (error instanceof MJCFImportError) {
      throw error;
    }
    
    throw new MJCFImportError(
      MJCFErrorType.ConversionError,
      `Failed to import MJCF file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      false
    );
  }
}

/**
 * Parse MJCF XML string into structured data
 */
function parseMJCFXML(xmlString: string): MJCFModel | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('XML parsing failed: ' + parserError.textContent);
    }

    const mujoco = xmlDoc.querySelector('mujoco');
    if (!mujoco) {
      throw new Error('No mujoco root element found');
    }

    const model: MJCFModel = {
      model: mujoco.getAttribute('model') || 'unnamed_model',
      worldbody: parseBody(mujoco.querySelector('worldbody')),
      actuator: parseActuators(mujoco.querySelectorAll('actuator')),
      tendon: parseTendons(mujoco.querySelectorAll('tendon')),
      equality: parseEqualities(mujoco.querySelectorAll('equality')),
      contact: parseContacts(mujoco.querySelectorAll('contact')),
      asset: parseAssets(mujoco.querySelectorAll('asset'))
    };

    return model;
    
  } catch (error) {
    console.error('Failed to parse MJCF XML:', error);
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
  const geom: MJCFGeom = {
    type: (geomEl.getAttribute('type') as any) || 'box'
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
      actuator.ctrlrange = ctrlrange.split(/\s+/).map(Number) as [number, number];
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
    geom1: el.getAttribute('geom1'),
    geom2: el.getAttribute('geom2'),
    friction: el.getAttribute('friction')?.split(/\s+/).map(Number)
  }));
}

/**
 * Parse MJCF assets
 */
function parseAssets(assetEls: NodeListOf<Element>): any[] {
  return Array.from(assetEls).map(el => ({
    name: el.getAttribute('name') || 'unnamed_asset',
    file: el.getAttribute('file') || '',
    scale: el.getAttribute('scale') ? parseFloat(el.getAttribute('scale')!) : undefined
  }));
}

/**
 * Convert MJCF model to Babylon.js meshes and kinematics
 */
async function convertMJCFToBabylon(
  model: MJCFModel,
  scene: BABYLON.Scene,
  fileName: string
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

  try {
    // Create root assembly node
    const assemblyRoot = new BABYLON.TransformNode(
      fileName.replace('.mjcf', ''),
      scene
    );

    // Convert world body and all children
    const worldBodyResult = await convertBodyToBabylon(
      model.worldbody,
      assemblyRoot,
      scene,
      model
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
  model: MJCFModel
): Promise<{ meshes: BABYLON.AbstractMesh[]; joints: MJCFJoint[] }> {
  const meshes: BABYLON.AbstractMesh[] = [];
  const joints: MJCFJoint[] = [];

  // Create transform node for this body
  const bodyNode = new BABYLON.TransformNode(body.name, scene);
  bodyNode.setParent(parentNode);

  // Apply position
  if (body.pos) {
    // MJCF uses Z-up, convert to Babylon Y-up
    bodyNode.position = new BABYLON.Vector3(
      body.pos[0],
      body.pos[2],  // MJCF Z → Babylon Y
      body.pos[1]   // MJCF Y → Babylon Z
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
  if (body.geoms) {
    for (const geom of body.geoms) {
      const mesh = createMeshFromGeom(geom, bodyNode, scene, model);
      if (mesh) {
        meshes.push(mesh);
      }
    }
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
        model
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
function createMeshFromGeom(
  geom: MJCFGeom,
  parentNode: BABYLON.TransformNode,
  scene: BABYLON.Scene,
  model: MJCFModel
): BABYLON.AbstractMesh | null {
  let mesh: BABYLON.AbstractMesh | null = null;

  try {
    switch (geom.type) {
      case 'box':
        mesh = BABYLON.MeshBuilder.CreateBox(
          geom.name || 'box',
          { size: Array.isArray(geom.size) ? geom.size[0] : geom.size || 1 },
          scene
        );
        break;

      case 'sphere':
        mesh = BABYLON.MeshBuilder.CreateSphere(
          geom.name || 'sphere',
          { diameter: Array.isArray(geom.size) ? geom.size[0] * 2 : (geom.size || 1) * 2 },
          scene
        );
        break;

      case 'cylinder':
        const radius = Array.isArray(geom.size) ? geom.size[0] : geom.size || 0.5;
        const height = Array.isArray(geom.size) ? geom.size[1] : geom.size || 1;
        mesh = BABYLON.MeshBuilder.CreateCylinder(
          geom.name || 'cylinder',
          { height, diameterTop: radius * 2, diameterBottom: radius * 2 },
          scene
        );
        break;

      case 'capsule':
        const capRadius = Array.isArray(geom.size) ? geom.size[0] : geom.size || 0.5;
        const capHeight = Array.isArray(geom.size) ? geom.size[1] : geom.size || 1;
        mesh = BABYLON.MeshBuilder.CreateCapsule(
          geom.name || 'capsule',
          { radius: capRadius, height: capHeight },
          scene
        );
        break;

      case 'plane':
        mesh = BABYLON.MeshBuilder.CreateGround(
          geom.name || 'plane',
          { width: 10, height: 10 },
          scene
        );
        break;

      case 'mesh':
        // TODO: Load external mesh file
        console.warn(`[MJCF Import] Mesh geometry not yet supported: ${geom.mesh || geom.meshfile}`);
        return null;

      default:
        console.warn(`[MJCF Import] Unsupported geometry type: ${geom.type}`);
        return null;
    }

    if (mesh) {
      mesh.setParent(parentNode);

      // Apply geometry position
      if (geom.pos) {
        mesh.position = new BABYLON.Vector3(
          geom.pos[0],
          geom.pos[2],  // MJCF Z → Babylon Y
          geom.pos[1]   // MJCF Y → Babylon Z
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

      // Apply color
      if (geom.rgba) {
        const material = new BABYLON.StandardMaterial(`${geom.name || 'geom'}_material`, scene);
        material.diffuseColor = new BABYLON.Color3(
          geom.rgba[0],
          geom.rgba[1],
          geom.rgba[2]
        );
        material.alpha = geom.rgba[3];
        mesh.material = material;
      }

      // Store MJCF metadata
      mesh.metadata = {
        ...mesh.metadata,
        mjcfGeom: geom,
        sourceFormat: 'mjcf'
      };
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
  const sceneTreeManager = SceneTreeManager.getInstance();

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
