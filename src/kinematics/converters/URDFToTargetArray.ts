/**
 * URDF to Target Array Converter
 * Owner: George (Agent 1 - Project Manager)
 * 
 * Converts URDF robot models to unified TargetArray structure
 * Supports 6-axis industrial robots, collaborative robots, and mobile manipulators
 */

import { 
  TargetArray, 
  KinematicTarget, 
  RobotType,
  createDefaultVisual,
} from '../types/TargetStructure';
import { KinematicsManager, KinematicChain } from '../KinematicsManager';

/**
 * Convert URDF robot to TargetArray
 */
export async function convertURDFToTargetArray(
  robotRootNodeId: string,
  robotName: string,
  chainName: string
): Promise<TargetArray | null> {
  const kinematicsManager = KinematicsManager.getInstance();
  
  // Get kinematic chain (URDF chain name includes robot root ID)
  const chain = kinematicsManager.getChain(chainName);
  if (!chain) {
    console.error(`[URDF→Target] Chain not found: ${chainName}`);
    return null;
  }

  // Detect robot type from URDF metadata or chain structure
  const robotType = detectRobotType(chain);
  
  console.log(`[URDF→Target] Converting ${robotName} (type: ${robotType}) to TargetArray`);

  // Create targets based on robot type
  const targets = createTargetsForRobotType(robotType, chain, robotRootNodeId);

  const targetArray: TargetArray = {
    robotId: robotRootNodeId,
    robotName,
    robotType,
    targets,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      description: `Auto-generated from URDF model: ${robotName}`,
    },
  };

  console.log(`[URDF→Target] ✅ Created TargetArray with ${targets.length} targets`);

  return targetArray;
}

/**
 * Detect robot type from kinematic chain
 */
function detectRobotType(chain: KinematicChain): RobotType {
  const dof = chain.dof;
  const jointNames = chain.joints.map(j => j.name.toLowerCase());

  // Check for specific robot brands/models in joint names
  const isFanuc = jointNames.some(n => n.includes('fanuc'));
  const isABB = jointNames.some(n => n.includes('abb') || n.includes('irb'));
  const isKUKA = jointNames.some(n => n.includes('kuka') || n.includes('kr'));
  const isUR = jointNames.some(n => n.includes('ur') || n.includes('universal'));
  const isFranka = jointNames.some(n => n.includes('franka') || n.includes('panda'));

  // 6-axis industrial robot (FANUC, ABB, KUKA, etc.)
  if (dof === 6 && (isFanuc || isABB || isKUKA)) {
    return 'serial-6axis';
  }

  // Collaborative robot (UR10, Franka Emika - typically 7 DOF)
  if ((dof === 6 || dof === 7) && (isUR || isFranka)) {
    return 'collaborative';
  }

  // Mobile manipulator detection
  const hasMobileBase = jointNames.some(n => 
    n.includes('wheel') || n.includes('base') || n.includes('mobile')
  );
  const hasArm = jointNames.some(n => 
    n.includes('arm') || n.includes('shoulder') || n.includes('elbow')
  );
  
  if (hasMobileBase && hasArm) {
    return 'mobile-manipulator';
  }

  // Dual-arm detection
  const hasLeftArm = jointNames.some(n => n.includes('left') && n.includes('arm'));
  const hasRightArm = jointNames.some(n => n.includes('right') && n.includes('arm'));
  
  if (hasLeftArm && hasRightArm) {
    return 'dual-arm';
  }

  // Default based on DOF
  if (dof === 6) {
    return 'serial-6axis';
  } else if (dof === 7) {
    return 'collaborative';
  }

  return 'custom';
}

/**
 * Create targets based on robot type
 */
function createTargetsForRobotType(
  robotType: RobotType,
  chain: KinematicChain,
  robotRootNodeId: string
): KinematicTarget[] {
  switch (robotType) {
    case 'serial-6axis':
      return createSerialRobotTargets(chain, robotRootNodeId);
    case 'collaborative':
      return createCollaborativeRobotTargets(chain, robotRootNodeId);
    case 'mobile-manipulator':
      return createMobileManipulatorTargets(chain, robotRootNodeId);
    case 'dual-arm':
      return createDualArmTargets(chain, robotRootNodeId);
    default:
      return createGenericTargets(chain, robotRootNodeId);
  }
}

/**
 * Create targets for serial 6-axis robots (FANUC, ABB, KUKA)
 */
function createSerialRobotTargets(
  chain: KinematicChain,
  robotRootNodeId: string
): KinematicTarget[] {
  const targets: KinematicTarget[] = [];

  // Check if robot has TCP frame
  const tcpFrames = chain.tcpFrames || [];
  const hasTCP = tcpFrames.length > 0;

  // Primary end-effector target
  targets.push({
    id: `${robotRootNodeId}_target_end_effector`,
    type: 'end-effector',
    transform: {
      position: [0.5, 0.5, 0.5], // Default position (will be updated by IK)
      rotation: [0, 0, 0, 1],
    },
    constraints: { 
      priority: 0,
      weight: 1.0,
    },
    visual: {
      ...createDefaultVisual('end-effector'),
      label: hasTCP ? tcpFrames[0].name : 'End Effector',
    },
    robotMetadata: {
      robotType: 'serial-6axis',
      chainId: chain.id,
      jointIndices: [0, 1, 2, 3, 4, 5],
      dofCount: 6,
    },
    userData: {
      tcpFrameId: hasTCP ? tcpFrames[0].id : undefined,
    },
  });

  return targets;
}

/**
 * Create targets for collaborative robots (UR10, Franka Emika)
 */
function createCollaborativeRobotTargets(
  chain: KinematicChain,
  robotRootNodeId: string
): KinematicTarget[] {
  const targets: KinematicTarget[] = [];
  const dof = chain.dof;

  // End-effector target
  targets.push({
    id: `${robotRootNodeId}_target_end_effector`,
    type: 'end-effector',
    transform: {
      position: [0.4, 0.4, 0.4],
      rotation: [0, 0, 0, 1],
    },
    constraints: { 
      priority: 0,
      weight: 1.0,
    },
    visual: createDefaultVisual('end-effector'),
    robotMetadata: {
      robotType: 'collaborative',
      chainId: chain.id,
      jointIndices: dof === 7 ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5],
      dofCount: dof,
    },
  });

  // Elbow target (for redundant 7-DOF arms)
  if (dof === 7) {
    targets.push({
      id: `${robotRootNodeId}_target_elbow`,
      type: 'elbow',
      transform: {
        position: [0.2, 0.3, 0.2],
        rotation: [0, 0, 0, 1],
      },
      constraints: { 
        priority: 1,
        weight: 0.5, // Lower weight for secondary target
      },
      visual: {
        ...createDefaultVisual('elbow'),
        visible: false, // Hidden by default
      },
      robotMetadata: {
        robotType: 'collaborative',
        chainId: chain.id,
        jointIndices: [3], // Typically elbow joint
        dofCount: 1,
      },
    });
  }

  return targets;
}

/**
 * Create targets for mobile manipulators (TurtleBot + arm)
 */
function createMobileManipulatorTargets(
  chain: KinematicChain,
  robotRootNodeId: string
): KinematicTarget[] {
  const targets: KinematicTarget[] = [];

  // Base target (for mobile base positioning)
  targets.push({
    id: `${robotRootNodeId}_target_base`,
    type: 'base',
    transform: {
      position: [0.0, 0.0, 0.0],
      rotation: [0, 0, 0, 1],
    },
    constraints: { 
      priority: 1,
      translationLimits: {
        min: [-10, 0, -10], // Allow movement in XZ plane only
        max: [10, 0, 10],
      },
    },
    visual: {
      ...createDefaultVisual('base'),
      visible: false, // Hidden by default
    },
    robotMetadata: {
      robotType: 'mobile-manipulator',
      chainId: chain.id,
      jointIndices: findJointIndices(chain, ['wheel', 'base', 'mobile']),
    },
  });

  // Arm end-effector target
  targets.push({
    id: `${robotRootNodeId}_target_end_effector`,
    type: 'end-effector',
    transform: {
      position: [0.5, 0.5, 0.3],
      rotation: [0, 0, 0, 1],
    },
    constraints: { 
      priority: 0,
      weight: 1.0,
    },
    visual: createDefaultVisual('end-effector'),
    robotMetadata: {
      robotType: 'mobile-manipulator',
      chainId: chain.id,
      jointIndices: findJointIndices(chain, ['arm', 'shoulder', 'elbow', 'wrist']),
    },
  });

  return targets;
}

/**
 * Create targets for dual-arm robots
 */
function createDualArmTargets(
  chain: KinematicChain,
  robotRootNodeId: string
): KinematicTarget[] {
  const targets: KinematicTarget[] = [];

  // Left arm end-effector
  targets.push({
    id: `${robotRootNodeId}_target_left_ee`,
    type: 'hand',
    transform: {
      position: [-0.3, 0.5, 0.3],
      rotation: [0, 0, 0, 1],
    },
    constraints: { 
      priority: 0,
      weight: 1.0,
    },
    visual: {
      ...createDefaultVisual('hand'),
      label: 'Left EE',
      color: '#FF5733', // Orange
    },
    robotMetadata: {
      robotType: 'dual-arm',
      chainId: chain.id,
      jointIndices: findJointIndices(chain, ['left', 'l_arm', 'l_shoulder', 'l_elbow']),
    },
  });

  // Right arm end-effector
  targets.push({
    id: `${robotRootNodeId}_target_right_ee`,
    type: 'hand',
    transform: {
      position: [0.3, 0.5, 0.3],
      rotation: [0, 0, 0, 1],
    },
    constraints: { 
      priority: 0,
      weight: 1.0,
    },
    visual: {
      ...createDefaultVisual('hand'),
      label: 'Right EE',
      color: '#3498DB', // Blue
    },
    robotMetadata: {
      robotType: 'dual-arm',
      chainId: chain.id,
      jointIndices: findJointIndices(chain, ['right', 'r_arm', 'r_shoulder', 'r_elbow']),
    },
  });

  return targets;
}

/**
 * Create generic targets for unknown robot types
 */
function createGenericTargets(
  chain: KinematicChain,
  robotRootNodeId: string
): KinematicTarget[] {
  // Create a single end-effector target
  return [{
    id: `${robotRootNodeId}_target_end_effector`,
    type: 'end-effector',
    transform: {
      position: [0.5, 0.5, 0.5],
      rotation: [0, 0, 0, 1],
    },
    constraints: { 
      priority: 0,
      weight: 1.0,
    },
    visual: createDefaultVisual('end-effector'),
    robotMetadata: {
      robotType: 'custom',
      chainId: chain.id,
      jointIndices: chain.joints.map((_, i) => i),
      dofCount: chain.dof,
    },
  }];
}

/**
 * Find joint indices that match any of the given keywords
 */
function findJointIndices(chain: KinematicChain, keywords: string[]): number[] {
  const indices: number[] = [];
  
  chain.joints.forEach((joint, index) => {
    const jointName = joint.name.toLowerCase();
    if (keywords.some(keyword => jointName.includes(keyword.toLowerCase()))) {
      indices.push(index);
    }
  });
  
  return indices;
}

/**
 * Get TCP frame position from chain
 * Returns the position of the first TCP frame, or null if none exist
 */
export function getTCPFramePosition(chain: KinematicChain): [number, number, number] | null {
  const tcpFrames = chain.tcpFrames || [];
  
  if (tcpFrames.length === 0) {
    return null;
  }

  const tcp = tcpFrames[0];
  return [tcp.offset.x, tcp.offset.y, tcp.offset.z];
}

/**
 * Update target array with actual TCP frame positions
 * Called after robot is loaded and TCP frames are detected
 */
export function updateTargetArrayWithTCPFrames(
  targetArray: TargetArray,
  chain: KinematicChain
): TargetArray {
  const tcpPosition = getTCPFramePosition(chain);
  
  if (!tcpPosition) {
    return targetArray;
  }

  // Update end-effector target with TCP position
  const eeTarget = targetArray.targets.find(t => t.type === 'end-effector');
  
  if (eeTarget) {
    eeTarget.transform.position = tcpPosition;
    targetArray.metadata.updatedAt = new Date();
  }

  return targetArray;
}
