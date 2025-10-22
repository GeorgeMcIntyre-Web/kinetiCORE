/**
 * MJCF Keyframe Integration
 * Owner: George
 *
 * Integrates MJCF keyframe definitions with kinetiCORE's KinematicsManager
 * Converts MJCF <keyframe> elements to RobotKeyframe instances
 */

import { KinematicsManager, RobotKeyframe } from '../../kinematics/KinematicsManager';

/**
 * MJCF Keyframe Definition (parsed from XML)
 */
export interface MJCFKeyframeDef {
  name: string;
  qpos: number[]; // Joint positions array
}

/**
 * Register MJCF keyframes with KinematicsManager
 */
export function registerMJCFKeyframes(
  mjcfKeyframes: Record<string, number[]>,
  chainId: string,
  kinematicsManager: KinematicsManager
): RobotKeyframe[] {
  console.log(`[MJCF Keyframe Integration] Registering ${Object.keys(mjcfKeyframes).length} keyframes for chain ${chainId}`);

  const chain = kinematicsManager.getAllChains().find(c => c.id === chainId);
  if (!chain) {
    console.warn(`[MJCF Keyframe Integration] Chain not found: ${chainId}`);
    return [];
  }

  const createdKeyframes: RobotKeyframe[] = [];

  // MJCF keyframes use qpos array which maps to joints in order
  const movableJoints = chain.joints.filter(j => j.type !== 'fixed');

  for (const [keyframeName, qposArray] of Object.entries(mjcfKeyframes)) {
    if (qposArray.length === 0) {
      console.warn(`[MJCF Keyframe Integration] Empty keyframe: ${keyframeName}`);
      continue;
    }

    // Map qpos array indices to joint IDs
    const jointPositions: Record<string, number> = {};

    for (let i = 0; i < Math.min(qposArray.length, movableJoints.length); i++) {
      const joint = movableJoints[i];
      jointPositions[joint.id] = qposArray[i];
    }

    if (qposArray.length > movableJoints.length) {
      console.warn(
        `[MJCF Keyframe Integration] Keyframe ${keyframeName} has ${qposArray.length} values but only ${movableJoints.length} movable joints`
      );
    }

    const keyframe: RobotKeyframe = {
      id: `${chainId}_keyframe_${keyframeName}`,
      name: keyframeName,
      chainId: chainId,
      jointPositions,
      timestamp: Date.now(),
      description: `MJCF keyframe: ${keyframeName}`,
    };

    kinematicsManager.addKeyframe(keyframe);
    createdKeyframes.push(keyframe);

    console.log(`[MJCF Keyframe Integration] Created keyframe: ${keyframeName} (${Object.keys(jointPositions).length} joints)`);
  }

  console.log(`[MJCF Keyframe Integration] ✅ Registered ${createdKeyframes.length} keyframes`);

  return createdKeyframes;
}
