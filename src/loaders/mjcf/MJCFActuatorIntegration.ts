/**
 * MJCF Actuator Integration
 * Owner: George
 *
 * Integrates MJCF actuator definitions with kinetiCORE's ActuatorSystem
 * Converts MJCF motor/actuator specs to HardwareActuator instances
 */

import { ActuatorSystem } from '../../kinematics/actuation/ActuatorSystem';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import type { HardwareActuator } from '../../kinematics/device/UnifiedDeviceDefinition';

/**
 * MJCF Actuator Definition (parsed from XML)
 */
export interface MJCFActuatorDef {
  name: string;
  joint: string;
  ctrlrange?: [number, number];
  gear?: number;
  type?: string;
}

/**
 * Create HardwareActuator from MJCF actuator definition
 */
export function createActuatorFromMJCF(
  mjcfActuator: MJCFActuatorDef,
  robotRootNodeId: string,
  kinematicsManager: KinematicsManager
): HardwareActuator | null {
  // Find the joint in KinematicsManager
  const allJoints = kinematicsManager.getAllJoints();

  // MJCF joint names need to be prefixed with robot ID (same as we do in URDFJointExtractor)
  const jointId = `${robotRootNodeId}_joint_${mjcfActuator.joint}`;
  const joint = allJoints.find(j => j.id === jointId);

  if (!joint) {
    console.warn(`[MJCF Actuator] Joint not found: ${mjcfActuator.joint} (tried ${jointId})`);
    return null;
  }

  // Determine actuator type based on joint and MJCF type string
  let actuatorType: 'servo_motor' | 'linear_actuator' | 'pneumatic_cylinder' = 'servo_motor';

  const mjcfType = (mjcfActuator.type || '').toLowerCase();
  const isLinear = joint.type === 'prismatic' || mjcfType.includes('slide') || mjcfType.includes('linear');
  const isServo = joint.type === 'revolute' || mjcfType.includes('motor') || mjcfType.includes('hinge') || mjcfType.includes('position') || mjcfType.includes('velocity');

  if (isLinear) {
    actuatorType = 'linear_actuator';
  } else if (isServo) {
    actuatorType = 'servo_motor';
  }

  // Generate unique actuator ID
  const actuatorId = `${robotRootNodeId}_actuator_${mjcfActuator.name}`;

  // Extract control range from MJCF
  let ctrlMin = joint.type === 'prismatic' ? 0 : -Math.PI;
  let ctrlMax = joint.type === 'prismatic' ? (joint.limits?.upper ?? 0.1) : Math.PI;

  if (mjcfActuator.ctrlrange) {
    ctrlMin = mjcfActuator.ctrlrange[0];
    ctrlMax = mjcfActuator.ctrlrange[1];
  } else if (joint.limits) {
    // Fallback to joint limits
    ctrlMin = joint.limits.lower;
    ctrlMax = joint.limits.upper;
  }

  // Create HardwareActuator
  const actuator: HardwareActuator = {
    id: actuatorId,
    name: mjcfActuator.name,
    type: actuatorType,
    controlMode: 'position',

    controlledJoints: [jointId],

    specs: {
      ctrlRange: { min: ctrlMin, max: ctrlMax },
      forceRange: { min: -joint.limits.effort, max: joint.limits.effort },
      kp: mjcfActuator.gear ?? 150, // Use gear ratio as proportional gain
      ratedTorque: joint.limits.effort,
      maxSpeed: joint.limits.velocity,
    },

    coordination: [{
      jointId: jointId,
      ratio: 1.0,
      offset: 0,
    }],

    state: {
      enabled: true, // MJCF actuators start enabled
      value: 0,
      velocity: 0,
      force: 0,
      fault: false,
    },
  };

  console.log(`[MJCF Actuator] Created: ${mjcfActuator.name} → ${joint.name} (${actuatorType})`);

  return actuator;
}

/**
 * Register MJCF actuators with ActuatorSystem
 */
export function registerMJCFActuators(
  mjcfActuators: MJCFActuatorDef[],
  robotRootNodeId: string,
  actuatorSystem: ActuatorSystem,
  kinematicsManager: KinematicsManager
): HardwareActuator[] {
  console.log(`[MJCF Actuator Integration] Registering ${mjcfActuators.length} actuators for robot ${robotRootNodeId}`);

  const createdActuators: HardwareActuator[] = [];

  for (const mjcfActuator of mjcfActuators) {
    const actuator = createActuatorFromMJCF(mjcfActuator, robotRootNodeId, kinematicsManager);

    if (actuator) {
      actuatorSystem.registerActuator(actuator);
      createdActuators.push(actuator);
    }
  }

  console.log(`[MJCF Actuator Integration] ✅ Registered ${createdActuators.length}/${mjcfActuators.length} actuators`);

  return createdActuators;
}

/**
 * Create actuator groups from MJCF tendon definitions
 * (Future enhancement - Phase 4)
 */
export function createActuatorGroupsFromTendons(
  tendons: any[] // MJCFTendon[]
): void {
  console.log(`[MJCF Actuator Integration] Creating ${tendons.length} tendon groups`);

  // TODO: Implement tendon → actuator group mapping
  // Tendons couple multiple joints together, need to create synchronized actuator groups
}
