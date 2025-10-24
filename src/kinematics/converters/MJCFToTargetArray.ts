/**
 * MJCF to Target Array Converter
 * Owner: George (Agent 1 - Project Manager)
 * 
 * Converts MJCF robot models to unified TargetArray structure
 * Supports humanoids, quadrupeds, and mobile manipulators
 */

import {
  TargetArray,
  KinematicTarget,
  RobotType,
  // TargetType,
  createDefaultVisual,
} from '../types/TargetStructure';
import { KinematicsManager, KinematicChain } from '../KinematicsManager';
// import { MJCFModelTypeDetector, RobotClass } from '../../loaders/mjcf/MJCFModelTypeDetector';

/**
 * Convert MJCF robot to TargetArray
 */
export async function convertMJCFToTargetArray(
  robotRootNodeId: string,
  robotName: string,
  chainName: string
): Promise<TargetArray | null> {
  const kinematicsManager = KinematicsManager.getInstance();
  
  // Get kinematic chain
  const chain = kinematicsManager.getChain(chainName);
  if (!chain) {
    console.error(`[MJCF→Target] Chain not found: ${chainName}`);
    return null;
  }

  // Detect robot type from MJCF metadata or chain structure
  const robotType = detectRobotType(chain);
  
  console.log(`[MJCF→Target] Converting ${robotName} (type: ${robotType}) to TargetArray`);

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
      description: `Auto-generated from MJCF model: ${robotName}`,
    },
  };

  console.log(`[MJCF→Target] ✅ Created TargetArray with ${targets.length} targets`);

  return targetArray;
}

/**
 * Detect robot type from kinematic chain
 */
function detectRobotType(chain: KinematicChain): RobotType {
  const dof = chain.dof;

  // Heuristics based on DOF count and joint names
  const jointNames = chain.joints.map(j => j.name.toLowerCase());

  // Humanoid detection (14+ DOF, has 'left' and 'right' limbs)
  if (dof >= 14) {
    const hasLeftRight = jointNames.some(n => n.includes('left')) && 
                        jointNames.some(n => n.includes('right'));
    const hasLegs = jointNames.some(n => n.includes('hip') || n.includes('knee') || n.includes('ankle'));
    
    if (hasLeftRight && hasLegs) {
      return 'humanoid';
    }
  }

  // Quadruped detection (12 DOF, 4 legs)
  if (dof === 12) {
    const legCount = ['fl', 'fr', 'rl', 'rr', 'front_left', 'front_right', 'rear_left', 'rear_right']
      .filter(prefix => jointNames.some(n => n.includes(prefix)))
      .length;
    
    if (legCount >= 4) {
      return 'quadruped';
    }
  }

  // Dual-arm detection (12-14 DOF, 2 arms)
  if (dof >= 12 && dof <= 14) {
    const hasLeftArm = jointNames.some(n => n.includes('left') && (n.includes('arm') || n.includes('shoulder') || n.includes('elbow')));
    const hasRightArm = jointNames.some(n => n.includes('right') && (n.includes('arm') || n.includes('shoulder') || n.includes('elbow')));
    
    if (hasLeftArm && hasRightArm) {
      return 'dual-arm';
    }
  }

  // 6-axis industrial robot detection (6 DOF)
  if (dof === 6) {
    return 'serial-6axis';
  }

  // Collaborative robot detection (7 DOF)
  if (dof === 7) {
    return 'collaborative';
  }

  // Default to custom
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
    case 'humanoid':
      return createHumanoidTargets(chain, robotRootNodeId);
    case 'quadruped':
      return createQuadrupedTargets(chain, robotRootNodeId);
    case 'serial-6axis':
      return createSerialRobotTargets(chain, robotRootNodeId);
    case 'collaborative':
      return createCollaborativeRobotTargets(chain, robotRootNodeId);
    case 'dual-arm':
      return createDualArmTargets(chain, robotRootNodeId);
    default:
      return createGenericTargets(chain, robotRootNodeId);
  }
}

/**
 * Create targets for humanoid robots
 */
function createHumanoidTargets(
  chain: KinematicChain,
  robotRootNodeId: string
): KinematicTarget[] {
  const targets: KinematicTarget[] = [];
  const jointNames = chain.joints.map(j => j.name.toLowerCase());

  // Left hand
  if (jointNames.some(n => n.includes('left') && (n.includes('hand') || n.includes('wrist')))) {
    targets.push({
      id: `${robotRootNodeId}_target_left_hand`,
      type: 'hand',
      transform: {
        position: [-0.3, 1.0, 0.3],
        rotation: [0, 0, 0, 1],
      },
      constraints: { priority: 0 },
      visual: { ...createDefaultVisual('hand'), label: 'Left Hand' },
      robotMetadata: {
        robotType: 'humanoid',
        chainId: chain.id,
        jointIndices: findJointIndices(chain, ['left', 'arm', 'shoulder', 'elbow', 'wrist']),
      },
    });
  }

  // Right hand
  if (jointNames.some(n => n.includes('right') && (n.includes('hand') || n.includes('wrist')))) {
    targets.push({
      id: `${robotRootNodeId}_target_right_hand`,
      type: 'hand',
      transform: {
        position: [0.3, 1.0, 0.3],
        rotation: [0, 0, 0, 1],
      },
      constraints: { priority: 0 },
      visual: { ...createDefaultVisual('hand'), label: 'Right Hand' },
      robotMetadata: {
        robotType: 'humanoid',
        chainId: chain.id,
        jointIndices: findJointIndices(chain, ['right', 'arm', 'shoulder', 'elbow', 'wrist']),
      },
    });
  }

  // Left foot
  if (jointNames.some(n => n.includes('left') && (n.includes('foot') || n.includes('ankle')))) {
    targets.push({
      id: `${robotRootNodeId}_target_left_foot`,
      type: 'foot',
      transform: {
        position: [-0.15, 0.0, 0.0],
        rotation: [0, 0, 0, 1],
      },
      constraints: { priority: 1 },
      visual: { ...createDefaultVisual('foot'), label: 'Left Foot' },
      robotMetadata: {
        robotType: 'humanoid',
        chainId: chain.id,
        jointIndices: findJointIndices(chain, ['left', 'leg', 'hip', 'knee', 'ankle']),
      },
    });
  }

  // Right foot
  if (jointNames.some(n => n.includes('right') && (n.includes('foot') || n.includes('ankle')))) {
    targets.push({
      id: `${robotRootNodeId}_target_right_foot`,
      type: 'foot',
      transform: {
        position: [0.15, 0.0, 0.0],
        rotation: [0, 0, 0, 1],
      },
      constraints: { priority: 1 },
      visual: { ...createDefaultVisual('foot'), label: 'Right Foot' },
      robotMetadata: {
        robotType: 'humanoid',
        chainId: chain.id,
        jointIndices: findJointIndices(chain, ['right', 'leg', 'hip', 'knee', 'ankle']),
      },
    });
  }

  // Pelvis/base
  if (jointNames.some(n => n.includes('pelvis') || n.includes('torso') || n.includes('base'))) {
    targets.push({
      id: `${robotRootNodeId}_target_pelvis`,
      type: 'base',
      transform: {
        position: [0.0, 0.8, 0.0],
        rotation: [0, 0, 0, 1],
      },
      constraints: { priority: 2 },
      visual: { ...createDefaultVisual('base'), label: 'Pelvis' },
      robotMetadata: {
        robotType: 'humanoid',
        chainId: chain.id,
        jointIndices: findJointIndices(chain, ['pelvis', 'torso', 'spine']),
      },
    });
  }

  return targets;
}

/**
 * Create targets for quadruped robots
 */
function createQuadrupedTargets(
  chain: KinematicChain,
  robotRootNodeId: string
): KinematicTarget[] {
  const targets: KinematicTarget[] = [];

  // Front-left foot
  targets.push({
    id: `${robotRootNodeId}_target_fl_foot`,
    type: 'foot',
    transform: {
      position: [0.3, 0.0, 0.3],
      rotation: [0, 0, 0, 1],
    },
    constraints: { priority: 0 },
    visual: { ...createDefaultVisual('foot'), label: 'FL Foot' },
    robotMetadata: {
      robotType: 'quadruped',
      chainId: chain.id,
      jointIndices: findJointIndices(chain, ['fl', 'front_left', 'front-left']),
    },
  });

  // Front-right foot
  targets.push({
    id: `${robotRootNodeId}_target_fr_foot`,
    type: 'foot',
    transform: {
      position: [0.3, 0.0, -0.3],
      rotation: [0, 0, 0, 1],
    },
    constraints: { priority: 0 },
    visual: { ...createDefaultVisual('foot'), label: 'FR Foot' },
    robotMetadata: {
      robotType: 'quadruped',
      chainId: chain.id,
      jointIndices: findJointIndices(chain, ['fr', 'front_right', 'front-right']),
    },
  });

  // Rear-left foot
  targets.push({
    id: `${robotRootNodeId}_target_rl_foot`,
    type: 'foot',
    transform: {
      position: [-0.3, 0.0, 0.3],
      rotation: [0, 0, 0, 1],
    },
    constraints: { priority: 0 },
    visual: { ...createDefaultVisual('foot'), label: 'RL Foot' },
    robotMetadata: {
      robotType: 'quadruped',
      chainId: chain.id,
      jointIndices: findJointIndices(chain, ['rl', 'rear_left', 'rear-left']),
    },
  });

  // Rear-right foot
  targets.push({
    id: `${robotRootNodeId}_target_rr_foot`,
    type: 'foot',
    transform: {
      position: [-0.3, 0.0, -0.3],
      rotation: [0, 0, 0, 1],
    },
    constraints: { priority: 0 },
    visual: { ...createDefaultVisual('foot'), label: 'RR Foot' },
    robotMetadata: {
      robotType: 'quadruped',
      chainId: chain.id,
      jointIndices: findJointIndices(chain, ['rr', 'rear_right', 'rear-right']),
    },
  });

  // Body/base
  targets.push({
    id: `${robotRootNodeId}_target_body`,
    type: 'base',
    transform: {
      position: [0.0, 0.4, 0.0],
      rotation: [0, 0, 0, 1],
    },
    constraints: { priority: 1 },
    visual: { ...createDefaultVisual('base'), label: 'Body' },
    robotMetadata: {
      robotType: 'quadruped',
      chainId: chain.id,
      jointIndices: [],
    },
  });

  return targets;
}

/**
 * Create targets for serial 6-axis robots
 */
function createSerialRobotTargets(
  chain: KinematicChain,
  robotRootNodeId: string
): KinematicTarget[] {
  return [{
    id: `${robotRootNodeId}_target_end_effector`,
    type: 'end-effector',
    transform: {
      position: [0.5, 0.5, 0.5],
      rotation: [0, 0, 0, 1],
    },
    constraints: { priority: 0 },
    visual: createDefaultVisual('end-effector'),
    robotMetadata: {
      robotType: 'serial-6axis',
      chainId: chain.id,
      jointIndices: [0, 1, 2, 3, 4, 5],
      dofCount: 6,
    },
  }];
}

/**
 * Create targets for collaborative robots (7 DOF)
 */
function createCollaborativeRobotTargets(
  chain: KinematicChain,
  robotRootNodeId: string
): KinematicTarget[] {
  return [{
    id: `${robotRootNodeId}_target_end_effector`,
    type: 'end-effector',
    transform: {
      position: [0.4, 0.4, 0.4],
      rotation: [0, 0, 0, 1],
    },
    constraints: { priority: 0 },
    visual: createDefaultVisual('end-effector'),
    robotMetadata: {
      robotType: 'collaborative',
      chainId: chain.id,
      jointIndices: [0, 1, 2, 3, 4, 5, 6],
      dofCount: 7,
    },
  }];
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
    constraints: { priority: 0 },
    visual: { ...createDefaultVisual('hand'), label: 'Left EE' },
    robotMetadata: {
      robotType: 'dual-arm',
      chainId: chain.id,
      jointIndices: findJointIndices(chain, ['left', 'arm']),
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
    constraints: { priority: 0 },
    visual: { ...createDefaultVisual('hand'), label: 'Right EE' },
    robotMetadata: {
      robotType: 'dual-arm',
      chainId: chain.id,
      jointIndices: findJointIndices(chain, ['right', 'arm']),
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
    constraints: { priority: 0 },
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
