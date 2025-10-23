/**
 * MJCF Kinematic Extractor
 * Owner: George
 *
 * Extracts kinematic joints and chains from MJCF models
 * Similar to URDFJointExtractor but for MJCF format
 */

import { KinematicsManager, type JointType } from '../../kinematics/KinematicsManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { mjcfLogger } from './MJCFDebugLogger';

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

  mjcfLogger.group('MJCF Kinematic', '🔍 Extracting Joints from MJCF XML');

  // Parse joint elements - MJCF joints are defined directly in the XML
  const jointElements = xmlDoc.getElementsByTagName('joint');
  mjcfLogger.info('MJCF Kinematic', `Found ${jointElements.length} joint elements in XML`);

  for (let i = 0; i < jointElements.length; i++) {
    const jointEl = jointElements[i];
    const name = jointEl.getAttribute('name');
    const type = jointEl.getAttribute('type') || 'hinge';

    if (!name) {
      mjcfLogger.warn('MJCF Kinematic', `Skipping joint at index ${i}: no name attribute`);
      continue;
    }

    mjcfLogger.group('MJCF Kinematic', `Joint [${i}]: ${name}`);
    mjcfLogger.debug('MJCF Kinematic', `Type: ${type}`);
    mjcfLogger.debug('MJCF Kinematic', `Parent Element: ${jointEl.parentElement?.tagName} (name: ${jointEl.parentElement?.getAttribute('name') || 'N/A'})`);

    // Debug: Log all siblings of the joint
    if (jointEl.parentElement) {
      const siblings = Array.from(jointEl.parentElement.children);
      const siblingInfo = siblings.map((s, idx) => `[${idx}] ${s.tagName}:${s.getAttribute('name') || 'unnamed'}`);
      mjcfLogger.debug('MJCF Kinematic', `Parent has ${siblings.length} children:`, siblingInfo);
    }

    let parentBody = '';
    let childBody = '';

    // Special handling for floating_base_joint
    if (name === 'floating_base_joint') {
      parentBody = robotRootNodeId || 'world'; // Floating base joint connects to robot root
      childBody = 'base_link'; // Child is typically the base link
      mjcfLogger.info('MJCF Kinematic', `Special handling for floating_base_joint: parent=${parentBody}, child=${childBody}`);
    } else {
      // For MJCF, joints are defined within the body they connect FROM (parent body)
      // The child body is the body that comes after this joint in the XML structure

      mjcfLogger.debug('MJCF Kinematic', '🔎 Finding parent body by traversing up DOM tree...');

      // Find the parent body by traversing up the DOM tree
      let currentEl = jointEl.parentElement;
      while (currentEl) {
        if (currentEl.tagName.toLowerCase() === 'body') {
          parentBody = currentEl.getAttribute('name') || '';
          mjcfLogger.success('MJCF Kinematic', `✓ Found parent body: ${parentBody}`);
          break;
        }
        currentEl = currentEl.parentElement;
      }

      if (!parentBody) {
        mjcfLogger.error('MJCF Kinematic', `❌ No parent body found!`);
      }

      mjcfLogger.debug('MJCF Kinematic', '🔎 Finding child body by searching siblings after joint...');

      // Find the child body by looking for the next body element after this joint
      // In MJCF, the child body is the body element that comes after this joint
      // in the same parent body's children
      if (jointEl.parentElement) {
        const parentBodyEl = jointEl.parentElement;
        const allChildren = Array.from(parentBodyEl.children);
        const jointIndex = allChildren.indexOf(jointEl);

        mjcfLogger.debug('MJCF Kinematic', `Joint index in parent: ${jointIndex}/${allChildren.length - 1}`);

        // Look for body elements after this joint
        for (let i = jointIndex + 1; i < allChildren.length; i++) {
          if (allChildren[i].tagName.toLowerCase() === 'body') {
            childBody = allChildren[i].getAttribute('name') || '';
            mjcfLogger.success('MJCF Kinematic', `✓ Found child body at index [${i}]: ${childBody}`);
            break;
          }
        }
      }

      // If we still don't have a child body, this might be a leaf joint
      // In this case, the joint doesn't connect to another body, but it's still a valid joint for actuators
      if (!childBody) {
        mjcfLogger.warn('MJCF Kinematic', `⚠️ No child body found - treating as leaf joint`);
        mjcfLogger.warn('MJCF Kinematic', `Setting childBody = parentBody = ${parentBody}`);
        // For leaf joints, we'll create the joint with the parent body as both parent and child
        // This allows actuators to control the joint even though it doesn't connect to another body
        childBody = parentBody;
      }
    }

    mjcfLogger.logJointMapping('MJCF Kinematic', name, parentBody, childBody, jointEl);
    mjcfLogger.groupEnd(); // End joint group
    
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

  mjcfLogger.groupEnd(); // End extraction group

  mjcfLogger.success('MJCF Kinematic', `✅ Extracted ${joints.length} joints from MJCF`);

  // Log summary table
  if (joints.length > 0) {
    mjcfLogger.group('MJCF Kinematic', '📋 Joint Summary');
    joints.forEach((j, idx) => {
      mjcfLogger.debug('MJCF Kinematic',
        `[${idx}] ${j.name} (${j.type}): ${j.parent} → ${j.child}`
      );
    });
    mjcfLogger.groupEnd();
  }

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
  robotRootNodeId: string,
  robotName?: string
): Promise<void> {
  mjcfLogger.group('MJCF Kinematic', '🔧 Creating Kinematics from MJCF');

  const joints = extractJointsFromMJCF(xmlString, robotRootNodeId);
  const kinematicsManager = KinematicsManager.getInstance();
  const sceneTreeManager = SceneTreeManager.getInstance();

  mjcfLogger.info('MJCF Kinematic', `Robot Root Node ID: ${robotRootNodeId}`);
  mjcfLogger.info('MJCF Kinematic', `Robot Name: ${robotName || 'Unknown'}`);
  mjcfLogger.info('MJCF Kinematic', `Total Joints to Process: ${joints.length}`);

  // Map body names to scene tree node IDs (same approach as URDF)
  const bodyNameToNodeId = new Map<string, string>();

  mjcfLogger.group('MJCF Kinematic', '🗺️ Building Body → Scene Tree Node Mapping');

  // Build body name → node ID mapping by traversing the robot hierarchy
  const buildBodyMapping = (nodeId: string, depth: number = 0) => {
    const node = sceneTreeManager.getNode(nodeId);
    if (!node) {
      mjcfLogger.warn('MJCF Kinematic', `Node ${nodeId} not found in scene tree`);
      return;
    }

    // Store mapping (node name is body name from MJCF)
    bodyNameToNodeId.set(node.name, nodeId);
    mjcfLogger.logSceneTreeMapping('MJCF Kinematic', node.name, nodeId, node.name);

    // Recurse to children
    node.childIds.forEach((childId) => buildBodyMapping(childId, depth + 1));
  };

  buildBodyMapping(robotRootNodeId);

  mjcfLogger.success('MJCF Kinematic', `✅ Mapped ${bodyNameToNodeId.size} bodies to scene tree nodes`);
  mjcfLogger.groupEnd(); // End mapping group

  // Debug: Log all mapped bodies in a table
  mjcfLogger.group('MJCF Kinematic', '📊 Body Mapping Table');
  for (const [bodyName, nodeId] of bodyNameToNodeId) {
    mjcfLogger.debug('MJCF Kinematic', `  "${bodyName}" → ${nodeId}`);
  }
  mjcfLogger.groupEnd();

  // Debug: Log joint mappings to verify parent/child relationships
  mjcfLogger.group('MJCF Kinematic', '🔗 Joint Parent/Child Relationships');
  for (const joint of joints) {
    const parentExists = bodyNameToNodeId.has(joint.parent);
    const childExists = bodyNameToNodeId.has(joint.child);
    const status = (parentExists && childExists) ? '✓' : '❌';
    mjcfLogger.debug('MJCF Kinematic',
      `${status} ${joint.name}: ${joint.parent} → ${joint.child} ` +
      `(parent: ${parentExists ? 'found' : 'MISSING'}, child: ${childExists ? 'found' : 'MISSING'})`
    );
  }
  mjcfLogger.groupEnd();

  // Find base body (parent of first joint, or body with no parent joint)
  const childBodies = new Set(joints.map((j) => j.child));
  const baseBody = joints.find((j) => !childBodies.has(j.parent))?.parent || joints[0]?.parent;

  if (baseBody) {
    const baseBodyNodeId = bodyNameToNodeId.get(baseBody);
    if (baseBodyNodeId) {
      mjcfLogger.info('MJCF Kinematic', `🔒 Grounding base body: ${baseBody} (${baseBodyNodeId})`);
      kinematicsManager.groundNode(baseBodyNodeId);
    } else {
      mjcfLogger.warn('MJCF Kinematic', `⚠️ Base body ${baseBody} not found in body mapping!`);
    }
  }

  // Create joints
  mjcfLogger.group('MJCF Kinematic', '⚙️ Creating Kinematic Joints');
  let createdCount = 0;
  let skippedCount = 0;

  for (const mjcfJoint of joints) {
    mjcfLogger.group('MJCF Kinematic', `Joint: ${mjcfJoint.name}`);

    let parentNodeId = bodyNameToNodeId.get(mjcfJoint.parent);
    const childNodeId = bodyNameToNodeId.get(mjcfJoint.child);

    mjcfLogger.debug('MJCF Kinematic', `Parent body "${mjcfJoint.parent}" → ${parentNodeId || 'NOT FOUND'}`);
    mjcfLogger.debug('MJCF Kinematic', `Child body "${mjcfJoint.child}" → ${childNodeId || 'NOT FOUND'}`);

    // Handle floating base joint specially - it connects world to base_link
    if (mjcfJoint.name === 'floating_base_joint' && !parentNodeId && childNodeId) {
      // For floating base joint, use the robot root node as the parent
      parentNodeId = robotRootNodeId;
      mjcfLogger.info('MJCF Kinematic', `Special handling: using robot root (${robotRootNodeId}) as parent`);
    } else if (!parentNodeId || !childNodeId) {
      mjcfLogger.error('MJCF Kinematic', `❌ SKIPPING: Missing parent or child node`);
      mjcfLogger.groupEnd();
      skippedCount++;
      continue;
    }

    // Create joint ID following the same pattern as URDF
    const jointId = `${robotRootNodeId}_joint_${mjcfJoint.name}`;
    mjcfLogger.debug('MJCF Kinematic', `Joint ID: ${jointId}`);

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
      mjcfLogger.success('MJCF Kinematic', `✓ Created joint (${mjcfJoint.type})`);
    } catch (error) {
      mjcfLogger.error('MJCF Kinematic', `❌ Failed to create joint:`, error);
    }

    mjcfLogger.groupEnd(); // End joint group
  }

  mjcfLogger.groupEnd(); // End creation group

  mjcfLogger.success('MJCF Kinematic', `✅ Created ${createdCount}/${joints.length} kinematic joints (${skippedCount} skipped)`);

  // Create kinematic chain
  if (createdCount > 0) {
    mjcfLogger.group('MJCF Kinematic', '🔗 Creating Kinematic Chain');

    try {
      // Use robot name if provided, otherwise fall back to root node ID
      const chainName = robotName ? robotName : robotRootNodeId;
      mjcfLogger.info('MJCF Kinematic', `Chain Name: ${chainName}`);
      mjcfLogger.info('MJCF Kinematic', `Root Node: ${robotRootNodeId}`);

      const chain = kinematicsManager.createChain(
        chainName,
        robotRootNodeId,
        'serial'
      );

      // For MJCF, we need to manually add all joints to the chain
      // because the automatic findChainJoints method only finds serial chains
      const allJoints = kinematicsManager.getAllJoints();
      const robotJoints = allJoints.filter(joint => joint.id.startsWith(`${robotRootNodeId}_joint_`));

      mjcfLogger.debug('MJCF Kinematic', `Total joints in manager: ${allJoints.length}`);
      mjcfLogger.debug('MJCF Kinematic', `Robot joints (filtered): ${robotJoints.length}`);

      // Update the chain with all robot joints
      chain.joints = robotJoints;
      chain.dof = robotJoints.filter(j => j.type !== 'fixed').length;

      mjcfLogger.logKinematicChain('MJCF Kinematic', chain.id, robotJoints);
      mjcfLogger.success('MJCF Kinematic', `✅ Created kinematic chain with ${chain.dof} DOF`);
    } catch (error) {
      mjcfLogger.error('MJCF Kinematic', `❌ Failed to create kinematic chain:`, error);
    }

    mjcfLogger.groupEnd(); // End chain group
  } else {
    mjcfLogger.warn('MJCF Kinematic', `⚠️ No joints created, skipping kinematic chain creation`);
  }

  mjcfLogger.groupEnd(); // End main group
  mjcfLogger.printSummary();
}
