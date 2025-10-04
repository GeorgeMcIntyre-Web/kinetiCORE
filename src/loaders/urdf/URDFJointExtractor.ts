// URDF Joint Extractor
// Owner: George
// Automatically extracts joint definitions from URDF XML and creates kinematic chains
//
// COORDINATE SYSTEM CONVERSION:
// - URDF: Z-up, right-handed, meters (ROS standard)
// - Babylon: Y-up, right-handed, meters
// - Conversion: (x, y, z) URDF → (x, z, y) Babylon

import { KinematicsManager } from '../../kinematics/KinematicsManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import type { JointType } from '../../scene/SceneTreeNode';

/**
 * URDF Joint Definition (parsed from XML)
 */
interface URDFJoint {
  name: string;
  type: string; // 'revolute' | 'prismatic' | 'fixed' | 'continuous' | 'floating' | 'planar'
  parent: string; // Parent link name
  child: string; // Child link name
  origin: {
    xyz: [number, number, number]; // Position in meters
    rpy: [number, number, number]; // Roll, pitch, yaw in radians
  };
  axis: {
    xyz: [number, number, number]; // Axis direction
  };
  limits?: {
    lower: number; // Radians or meters
    upper: number;
    velocity: number;
    effort: number;
  };
}

/**
 * Extract joints from URDF XML string
 */
export async function extractJointsFromURDF(urdfXML: string): Promise<URDFJoint[]> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(urdfXML, 'text/xml');

  // Check for parsing errors
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('URDF XML parsing failed: ' + parserError.textContent);
  }

  const joints: URDFJoint[] = [];
  const jointElements = xmlDoc.querySelectorAll('joint');

  jointElements.forEach((jointEl) => {
    const name = jointEl.getAttribute('name') || 'unnamed_joint';
    const type = jointEl.getAttribute('type') || 'fixed';

    // Parse parent link
    const parentEl = jointEl.querySelector('parent');
    const parent = parentEl?.getAttribute('link') || '';

    // Parse child link
    const childEl = jointEl.querySelector('child');
    const child = childEl?.getAttribute('link') || '';

    // Parse origin
    const originEl = jointEl.querySelector('origin');
    const xyzStr = originEl?.getAttribute('xyz') || '0 0 0';
    const rpyStr = originEl?.getAttribute('rpy') || '0 0 0';

    const xyz = xyzStr.split(/\s+/).map(Number) as [number, number, number];
    const rpy = rpyStr.split(/\s+/).map(Number) as [number, number, number];

    // Parse axis
    const axisEl = jointEl.querySelector('axis');
    const axisStr = axisEl?.getAttribute('xyz') || '0 0 1'; // Default Z-axis
    const axisXYZ = axisStr.split(/\s+/).map(Number) as [number, number, number];

    // Parse limits
    const limitEl = jointEl.querySelector('limit');
    let limits: URDFJoint['limits'] | undefined;

    if (limitEl) {
      limits = {
        lower: parseFloat(limitEl.getAttribute('lower') || '-3.14'),
        upper: parseFloat(limitEl.getAttribute('upper') || '3.14'),
        velocity: parseFloat(limitEl.getAttribute('velocity') || '1.0'),
        effort: parseFloat(limitEl.getAttribute('effort') || '10.0'),
      };
    }

    joints.push({
      name,
      type,
      parent,
      child,
      origin: { xyz, rpy },
      axis: { xyz: axisXYZ },
      limits,
    });
  });

  return joints;
}

/**
 * Convert URDF position (Z-up, meters) to Babylon (Y-up, meters)
 * URDF: (x, y, z) where Z is up
 * Babylon: (x, y, z) where Y is up
 * Conversion: x stays x, URDF.z → Babylon.y, URDF.y → Babylon.z
 */
function urdfToBabylonPosition(urdfPos: [number, number, number]): { x: number; y: number; z: number } {
  return {
    x: urdfPos[0],      // X stays X
    y: urdfPos[2],      // URDF Z (up) → Babylon Y (up)
    z: urdfPos[1],      // URDF Y (forward) → Babylon Z (forward)
  };
}

/**
 * Convert URDF axis (Z-up) to Babylon (Y-up)
 * Axes are directional vectors, same transformation as positions
 */
function urdfToBabylonAxis(urdfAxis: [number, number, number]): { x: number; y: number; z: number } {
  return {
    x: urdfAxis[0],     // X stays X
    y: urdfAxis[2],     // URDF Z → Babylon Y
    z: urdfAxis[1],     // URDF Y → Babylon Z
  };
}

/**
 * Map URDF joint type to kinetiCORE joint type
 */
function mapURDFJointType(urdfType: string): JointType {
  switch (urdfType) {
    case 'revolute':
    case 'continuous':
      return 'revolute';
    case 'prismatic':
      return 'prismatic';
    case 'fixed':
      return 'fixed';
    case 'floating':
      return 'spherical'; // Approximate
    case 'planar':
      return 'planar';
    default:
      console.warn(`Unknown URDF joint type: ${urdfType}, defaulting to fixed`);
      return 'fixed';
  }
}

/**
 * Create kinematic joints from URDF data
 */
export async function createKinematicsFromURDF(
  urdfXML: string,
  robotRootNodeId: string
): Promise<void> {
  const joints = await extractJointsFromURDF(urdfXML);
  const kinematicsManager = KinematicsManager.getInstance();
  const sceneTreeManager = SceneTreeManager.getInstance();

  console.log(`Found ${joints.length} joints in URDF`);

  // Map link names to scene tree node IDs
  const linkNameToNodeId = new Map<string, string>();

  // Build link name → node ID mapping by traversing the robot hierarchy
  const buildLinkMapping = (nodeId: string) => {
    const node = sceneTreeManager.getNode(nodeId);
    if (!node) return;

    // Store mapping (node name is link name from URDF)
    linkNameToNodeId.set(node.name, nodeId);

    // Recurse to children
    node.childIds.forEach((childId) => buildLinkMapping(childId));
  };

  buildLinkMapping(robotRootNodeId);

  console.log(`Mapped ${linkNameToNodeId.size} links to scene nodes`);

  // Find base link (parent of first joint, or link with no parent joint)
  const childLinks = new Set(joints.map((j) => j.child));
  const baseLink = joints.find((j) => !childLinks.has(j.parent))?.parent || joints[0]?.parent;

  if (baseLink) {
    const baseLinkNodeId = linkNameToNodeId.get(baseLink);
    if (baseLinkNodeId) {
      console.log(`Grounding base link: ${baseLink}`);
      kinematicsManager.groundNode(baseLinkNodeId);
    }
  }

  // Create joints
  let createdCount = 0;
  for (const urdfJoint of joints) {
    const parentNodeId = linkNameToNodeId.get(urdfJoint.parent);
    const childNodeId = linkNameToNodeId.get(urdfJoint.child);

    if (!parentNodeId || !childNodeId) {
      console.warn(
        `Skipping joint ${urdfJoint.name}: ` +
        `parent=${urdfJoint.parent} (${parentNodeId}), ` +
        `child=${urdfJoint.child} (${childNodeId})`
      );
      continue;
    }

    const jointType = mapURDFJointType(urdfJoint.type);

    // Convert URDF coordinates (Z-up, meters) to Babylon (Y-up, meters) then to kinetiCORE (mm)
    const M_TO_MM = 1000;
    const originBabylon = urdfToBabylonPosition(urdfJoint.origin.xyz);
    const origin = {
      x: originBabylon.x * M_TO_MM,
      y: originBabylon.y * M_TO_MM,
      z: originBabylon.z * M_TO_MM,
    };

    // Convert axis direction (Z-up to Y-up)
    const axis = urdfToBabylonAxis(urdfJoint.axis.xyz);

    // Create joint with URDF limits
    const joint = kinematicsManager.createJoint({
      name: urdfJoint.name,
      type: jointType,
      parentNodeId,
      childNodeId,
      origin,
      axis,
      limits: urdfJoint.limits || {
        lower: jointType === 'revolute' ? -Math.PI : -1000,
        upper: jointType === 'revolute' ? Math.PI : 1000,
        velocity: 1.0,
        effort: 10.0,
      },
    });

    if (joint) {
      createdCount++;
      console.log(
        `Created joint: ${joint.name} (${joint.type}) ` +
        `${urdfJoint.parent} → ${urdfJoint.child}`
      );
    }
  }

  console.log(`✅ Created ${createdCount}/${joints.length} joints from URDF`);

  // Create kinematic chain if base link exists
  if (baseLink) {
    const baseLinkNodeId = linkNameToNodeId.get(baseLink);
    if (baseLinkNodeId) {
      const robotName = sceneTreeManager.getNode(robotRootNodeId)?.name || 'Robot';
      kinematicsManager.createChain(robotName, baseLinkNodeId, 'serial');
    }
  }
}

/**
 * Load URDF file and create kinematics
 */
export async function loadURDFWithKinematics(
  urdfFile: File,
  robotRootNodeId: string
): Promise<void> {
  const urdfXML = await urdfFile.text();
  await createKinematicsFromURDF(urdfXML, robotRootNodeId);
}
