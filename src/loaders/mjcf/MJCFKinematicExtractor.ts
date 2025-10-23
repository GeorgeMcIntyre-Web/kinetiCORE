/**
 * MJCF Kinematic Extractor
 * Owner: George
 *
 * Extracts kinematic joints and chains from MJCF models
 * Similar to URDFJointExtractor but for MJCF format
 */

import { KinematicsManager, type JointType } from '../../kinematics/KinematicsManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';

export interface MJCFJoint {
  name: string;
  type: JointType;
  parent: string;
  child: string;
  axis?: { xyz: number[] };
  limits?: {
    lower: number;
    upper: number;
    effort: number;
    velocity: number;
  };
  origin?: {
    xyz: number[];
    rpy: number[];
  };
}

/**
 * Extract joints from MJCF XML string
 */
export function extractJointsFromMJCF(xmlString: string, robotRootNodeId?: string): MJCFJoint[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  
  const joints: MJCFJoint[] = [];
  
  // Parse joint elements - MJCF joints are defined directly in the XML
  const jointElements = xmlDoc.getElementsByTagName('joint');
  for (let i = 0; i < jointElements.length; i++) {
    const jointEl = jointElements[i];
    const name = jointEl.getAttribute('name');
    const type = jointEl.getAttribute('type') || 'hinge';
    
    if (!name) continue;
    
    // Debug: Log joint element structure
    console.log(`[MJCF Kinematic Extractor] Processing joint: ${name} (type: ${type})`);
    console.log(`[MJCF Kinematic Extractor] Joint parent element: ${jointEl.parentElement?.tagName} (name: ${jointEl.parentElement?.getAttribute('name')})`);
    
    // Debug: Log all siblings of the joint
    if (jointEl.parentElement) {
      const siblings = Array.from(jointEl.parentElement.children);
      console.log(`[MJCF Kinematic Extractor] Joint ${name} siblings:`, siblings.map(s => `${s.tagName}:${s.getAttribute('name') || 'unnamed'}`));
    }
    
    let parentBody = '';
    let childBody = '';
    
    // Special handling for floating_base_joint
    if (name === 'floating_base_joint') {
      parentBody = robotRootNodeId || 'world'; // Floating base joint connects to robot root
      childBody = 'base_link'; // Child is typically the base link
    } else {
      // For MJCF, joints are defined within the body they connect FROM (parent body)
      // The child body is the body that comes after this joint in the XML structure
      
      // Find the parent body by traversing up the DOM tree
      let currentEl = jointEl.parentElement;
      while (currentEl) {
        if (currentEl.tagName.toLowerCase() === 'body') {
          parentBody = currentEl.getAttribute('name') || '';
          break;
        }
        currentEl = currentEl.parentElement;
      }
      
      // Find the child body by looking for the next body element after this joint
      // In MJCF, the child body is the body element that comes after this joint
      // in the same parent body's children
      if (jointEl.parentElement) {
        const parentBodyEl = jointEl.parentElement;
        const allChildren = Array.from(parentBodyEl.children);
        const jointIndex = allChildren.indexOf(jointEl);
        
        console.log(`[MJCF Kinematic Extractor] Joint ${name} index in parent children: ${jointIndex}`);
        console.log(`[MJCF Kinematic Extractor] Parent children:`, allChildren.map((c, i) => `${i}:${c.tagName}:${c.getAttribute('name') || 'unnamed'}`));
        
        // Look for body elements after this joint
        for (let i = jointIndex + 1; i < allChildren.length; i++) {
          if (allChildren[i].tagName.toLowerCase() === 'body') {
            childBody = allChildren[i].getAttribute('name') || '';
            console.log(`[MJCF Kinematic Extractor] Found child body via parent children search: ${childBody}`);
            break;
          }
        }
      }
      
      // If we still don't have a child body, this might be a leaf joint
      // In this case, the joint doesn't connect to another body, but it's still a valid joint for actuators
      if (!childBody) {
        console.warn(`[MJCF Kinematic Extractor] Joint ${name} has no child body - this might be a leaf joint`);
        // For leaf joints, we'll create the joint with the parent body as both parent and child
        // This allows actuators to control the joint even though it doesn't connect to another body
        childBody = parentBody;
      }
    }
    
    console.log(`[MJCF Kinematic Extractor] Joint ${name}: parent=${parentBody}, child=${childBody}`);
    
    // Parse axis - MJCF joints have axis as a direct attribute
    let axis: { xyz: number[] } | undefined;
    const axisAttr = jointEl.getAttribute('axis');
    if (axisAttr) {
      const axisValues = axisAttr.split(' ').map(Number).filter(n => !isNaN(n));
      if (axisValues.length >= 3) {
        axis = { xyz: axisValues };
      }
    }
    
    // Parse limits - MJCF joints have range as a direct attribute
    let limits: MJCFJoint['limits'];
    const rangeAttr = jointEl.getAttribute('range');
    if (rangeAttr) {
      const rangeValues = rangeAttr.split(' ').map(Number).filter(n => !isNaN(n));
      if (rangeValues.length >= 2) {
        limits = {
          lower: rangeValues[0],
          upper: rangeValues[1],
          effort: 0, // MJCF doesn't typically specify effort in joint definition
          velocity: 0, // MJCF doesn't typically specify velocity in joint definition
        };
      }
    }
    
    // Parse origin - MJCF joints have pos as a direct attribute
    let origin: MJCFJoint['origin'];
    const posAttr = jointEl.getAttribute('pos');
    if (posAttr) {
      const posValues = posAttr.split(' ').map(Number).filter(n => !isNaN(n));
      if (posValues.length >= 3) {
        origin = {
          xyz: posValues,
          rpy: [0, 0, 0], // MJCF doesn't typically specify rotation in joint definition
        };
      }
    }
    
    const joint: MJCFJoint = {
      name,
      type: mapMJCFJointType(type),
      parent: parentBody,
      child: childBody,
      axis,
      limits,
      origin,
    };
    
    joints.push(joint);
  }
  
  console.log(`[MJCF Kinematic Extractor] Found ${joints.length} joints in MJCF`);
  return joints;
}

/**
 * Map MJCF joint types to kinetiCORE joint types
 */
function mapMJCFJointType(mjcfType: string): JointType {
  switch (mjcfType.toLowerCase()) {
    case 'hinge':
    case 'ball':
      return 'revolute';
    case 'slide':
      return 'prismatic';
    case 'free':
      return 'spherical'; // Map free to spherical (3DOF rotation)
    case 'fixed':
    default:
      return 'fixed';
  }
}

/**
 * Create kinematic joints from MJCF data
 */
export async function createKinematicsFromMJCF(
  xmlString: string,
  robotRootNodeId: string
): Promise<void> {
  const joints = extractJointsFromMJCF(xmlString, robotRootNodeId);
  const kinematicsManager = KinematicsManager.getInstance();
  const sceneTreeManager = SceneTreeManager.getInstance();

  console.log(`[MJCF Kinematic Extractor] Creating kinematics from ${joints.length} joints`);

  // Map body names to scene tree node IDs (same approach as URDF)
  const bodyNameToNodeId = new Map<string, string>();

  // Build body name → node ID mapping by traversing the robot hierarchy
  const buildBodyMapping = (nodeId: string) => {
    const node = sceneTreeManager.getNode(nodeId);
    if (!node) return;

    // Store mapping (node name is body name from MJCF)
    bodyNameToNodeId.set(node.name, nodeId);
    console.log(`[MJCF Kinematic Extractor] Mapped body: ${node.name} -> ${nodeId}`);

    // Recurse to children
    node.childIds.forEach((childId) => buildBodyMapping(childId));
  };

  buildBodyMapping(robotRootNodeId);

  console.log(`[MJCF Kinematic Extractor] Mapped ${bodyNameToNodeId.size} bodies to scene tree nodes`);
  
  // Debug: Log all mapped bodies
  console.log(`[MJCF Kinematic Extractor] Body mappings:`);
  for (const [bodyName, nodeId] of bodyNameToNodeId) {
    console.log(`  ${bodyName} -> ${nodeId}`);
  }
  
  // Debug: Log all joints and their parent/child bodies
  console.log(`[MJCF Kinematic Extractor] Joint parent/child mapping:`);
  for (const joint of joints) {
    console.log(`  ${joint.name}: ${joint.parent} -> ${joint.child}`);
  }

  // Find base body (parent of first joint, or body with no parent joint)
  const childBodies = new Set(joints.map((j) => j.child));
  const baseBody = joints.find((j) => !childBodies.has(j.parent))?.parent || joints[0]?.parent;

  if (baseBody) {
    const baseBodyNodeId = bodyNameToNodeId.get(baseBody);
    if (baseBodyNodeId) {
      console.log(`[MJCF Kinematic Extractor] Grounding base body: ${baseBody}`);
      kinematicsManager.groundNode(baseBodyNodeId);
    }
  }

  // Create joints
  let createdCount = 0;
  for (const mjcfJoint of joints) {
    let parentNodeId = bodyNameToNodeId.get(mjcfJoint.parent);
    const childNodeId = bodyNameToNodeId.get(mjcfJoint.child);

    // Handle floating base joint specially - it connects world to base_link
    if (mjcfJoint.name === 'floating_base_joint' && !parentNodeId && childNodeId) {
      // For floating base joint, use the robot root node as the parent
      parentNodeId = robotRootNodeId;
      console.log(`[MJCF Kinematic Extractor] Floating base joint: using robot root as parent`);
    } else if (!parentNodeId || !childNodeId) {
      console.warn(`[MJCF Kinematic Extractor] Skipping joint ${mjcfJoint.name}: missing parent or child node`);
      continue;
    }

    // Create joint ID following the same pattern as URDF
    const jointId = `${robotRootNodeId}_joint_${mjcfJoint.name}`;

    try {
      // Create the joint in KinematicsManager
      kinematicsManager.createJoint({
        id: jointId,
        name: mjcfJoint.name,
        type: mjcfJoint.type,
        parentNodeId,
        childNodeId,
        axis: mjcfJoint.axis ? {
          x: mjcfJoint.axis.xyz[0],
          y: mjcfJoint.axis.xyz[1],
          z: mjcfJoint.axis.xyz[2],
        } : { x: 1, y: 0, z: 0 },
        limits: mjcfJoint.limits ? {
          lower: mjcfJoint.limits.lower,
          upper: mjcfJoint.limits.upper,
          effort: mjcfJoint.limits.effort,
          velocity: mjcfJoint.limits.velocity,
        } : undefined,
        origin: mjcfJoint.origin ? {
          x: mjcfJoint.origin.xyz[0],
          y: mjcfJoint.origin.xyz[1],
          z: mjcfJoint.origin.xyz[2],
        } : undefined,
      });

      createdCount++;
      console.log(`[MJCF Kinematic Extractor] Created joint: ${mjcfJoint.name} (${mjcfJoint.type})`);
    } catch (error) {
      console.error(`[MJCF Kinematic Extractor] Failed to create joint ${mjcfJoint.name}:`, error);
    }
  }

  console.log(`[MJCF Kinematic Extractor] ✅ Created ${createdCount}/${joints.length} kinematic joints`);

  // Create kinematic chain
  if (createdCount > 0) {
    try {
      const chain = kinematicsManager.createChain(
        `${robotRootNodeId} Kinematic Chain`,
        robotRootNodeId,
        'serial'
      );

      // For MJCF, we need to manually add all joints to the chain
      // because the automatic findChainJoints method only finds serial chains
      const allJoints = kinematicsManager.getAllJoints();
      const robotJoints = allJoints.filter(joint => joint.id.startsWith(`${robotRootNodeId}_joint_`));
      
      // Update the chain with all robot joints
      chain.joints = robotJoints;
      chain.dof = robotJoints.filter(j => j.type !== 'fixed').length;

      console.log(`[MJCF Kinematic Extractor] ✅ Created kinematic chain: ${chain.id} with ${chain.dof} DOF`);
    } catch (error) {
      console.error(`[MJCF Kinematic Extractor] Failed to create kinematic chain:`, error);
    }
  }
}
