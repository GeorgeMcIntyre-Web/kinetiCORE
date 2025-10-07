/**
 * Kinematic System - Usage Example
 * Demonstrates complete workflow from device creation to actuation
 */

import { KinematicsManager } from './KinematicsManager';
import type {
  KinematicDevice,
  FixtureDevice,
  HardwareActuator,
} from './device/UnifiedDeviceDefinition';
import { MJCFExporter } from './exporters/MJCFExporter';
import { URDFExporter } from './exporters/URDFExporter';

/**
 * Example 1: Create a simple 2-jaw gripper with servo motor
 */
export function createGripperExample(): KinematicDevice {
  const kinematicsManager = KinematicsManager.getInstance();
  const actuatorSystem = kinematicsManager.getActuatorSystem();

  // 1. Define device structure
  const device: KinematicDevice = {
    id: 'gripper_001',
    name: 'Parallel Jaw Gripper',
    type: 'gripper',
    version: '1.0',
    createdAt: new Date(),
    modifiedAt: new Date(),
    author: 'User',
    description: 'Electric parallel gripper for pick and place',
    tags: ['gripper', 'electric'],
    links: [
      // Base link (grounded)
      {
        id: 'base_link',
        name: 'base',
        geometry: {
          vertices: [], // Simplified - would have actual mesh data
          indices: [],
          normals: [],
        },
        material: {
          color: { r: 0.7, g: 0.7, b: 0.7, a: 1.0 },
          metallic: 0.8,
          roughness: 0.3,
        },
        isBase: true,
        tags: ['base'],
      },
      // Left finger
      {
        id: 'left_finger',
        name: 'finger_left',
        geometry: { vertices: [], indices: [], normals: [] },
        material: {
          color: { r: 0.2, g: 0.3, b: 0.8, a: 1.0 },
          metallic: 0.7,
          roughness: 0.4,
        },
        mass: 0.1,
        isBase: false,
        tags: ['finger'],
      },
      // Right finger
      {
        id: 'right_finger',
        name: 'finger_right',
        geometry: { vertices: [], indices: [], normals: [] },
        material: {
          color: { r: 0.2, g: 0.3, b: 0.8, a: 1.0 },
          metallic: 0.7,
          roughness: 0.4,
        },
        mass: 0.1,
        isBase: false,
        tags: ['finger'],
      },
    ],
    joints: [
      // Left finger joint (prismatic - moves in X direction)
      {
        id: 'joint_left',
        name: 'left_finger_joint',
        type: 'prismatic',
        parentLink: 'base_link',
        childLink: 'left_finger',
        parentFrame: {
          origin: { x: -0.025, y: 0, z: 0 }, // 25mm left in Babylon space (Y-up, meters)
          xAxis: { x: 1, y: 0, z: 0 },
          yAxis: { x: 0, y: 1, z: 0 },
          zAxis: { x: 0, y: 0, z: 1 },
        },
        childFrame: {
          origin: { x: 0, y: 0, z: 0 },
          xAxis: { x: 1, y: 0, z: 0 },
          yAxis: { x: 0, y: 1, z: 0 },
          zAxis: { x: 0, y: 0, z: 1 },
        },
        axis: { x: -1, y: 0, z: 0 }, // Move left (negative X)
        limits: {
          min: 0,
          max: 0.05, // 50mm max travel
          velocity: 0.1, // 100mm/s
          effort: 100, // 100N
        },
        currentValue: 0.025, // Start at mid-position (25mm)
        showAxis: true,
        axisLength: 0.1,
      },
      // Right finger joint (prismatic - moves in X direction)
      {
        id: 'joint_right',
        name: 'right_finger_joint',
        type: 'prismatic',
        parentLink: 'base_link',
        childLink: 'right_finger',
        parentFrame: {
          origin: { x: 0.025, y: 0, z: 0 }, // 25mm right
          xAxis: { x: 1, y: 0, z: 0 },
          yAxis: { x: 0, y: 1, z: 0 },
          zAxis: { x: 0, y: 0, z: 1 },
        },
        childFrame: {
          origin: { x: 0, y: 0, z: 0 },
          xAxis: { x: 1, y: 0, z: 0 },
          yAxis: { x: 0, y: 1, z: 0 },
          zAxis: { x: 0, y: 0, z: 1 },
        },
        axis: { x: 1, y: 0, z: 0 }, // Move right (positive X)
        limits: {
          min: 0,
          max: 0.05,
          velocity: 0.1,
          effort: 100,
        },
        currentValue: 0.025,
        showAxis: true,
        axisLength: 0.1,
      },
    ],
    baseLink: 'base_link',
    dof: 2,
    exportFormat: 'all',
    actuators: [],
    actuatorGroups: [],
  };

  // 2. Create electric gripper actuator
  const gripperActuator: HardwareActuator = {
    id: 'gripper_actuator_001',
    name: 'Electric Gripper Motor',
    type: 'electric_gripper',
    controlMode: 'position',
    manufacturer: 'Schunk',
    modelNumber: 'EGP-40',
    controlledJoints: ['joint_left', 'joint_right'],
    specs: {
      ratedForce: 140, // 140N gripping force
      peakForce: 200,
      maxSpeed: 0.1, // 100mm/s
      forceRange: { min: 0, max: 140 },
      ctrlRange: { min: 0, max: 0.05 }, // 0-50mm opening
      voltage: 24,
      current: 2.5,
      power: 60,
      hasEncoder: true,
      encoderResolution: 1024,
    },
    coordination: [
      {
        jointId: 'joint_left',
        ratio: -1.0, // Move left when opening (negative direction)
        offset: 0.025, // Start at 25mm
      },
      {
        jointId: 'joint_right',
        ratio: 1.0, // Move right when opening (positive direction)
        offset: 0.025, // Start at 25mm
      },
    ],
    state: {
      enabled: false,
      value: 0.025, // Current opening: 25mm
      velocity: 0,
      force: 0,
      fault: false,
    },
  };

  device.actuators = [gripperActuator];

  // 3. Register actuator with system
  actuatorSystem.registerActuator(gripperActuator);

  console.log('✅ Gripper device created with actuator');
  return device;
}

/**
 * Example 2: Control the gripper
 */
export function controlGripperExample() {
  const kinematicsManager = KinematicsManager.getInstance();
  const actuatorSystem = kinematicsManager.getActuatorSystem();

  // Get the gripper actuator
  const actuator = actuatorSystem.getAllActuators().find(a => a.type === 'electric_gripper');
  if (!actuator) {
    console.error('No gripper actuator found');
    return;
  }

  // Enable actuator
  actuatorSystem.sendCommand({
    actuatorId: actuator.id,
    command: 'enable',
  });

  console.log('✅ Gripper enabled');

  // Open gripper to 40mm
  actuatorSystem.sendCommand({
    actuatorId: actuator.id,
    command: 'set_value',
    value: 0.04, // 40mm
  });

  console.log('✅ Gripper opening to 40mm');
  // This will automatically:
  // - Set left joint to: 0.04 * -1.0 + 0.025 = -0.015 (move left 15mm)
  // - Set right joint to: 0.04 * 1.0 + 0.025 = 0.065 (move right 65mm)
  // - Result: 40mm total opening

  // Wait 2 seconds
  setTimeout(() => {
    // Close gripper to 10mm
    actuatorSystem.sendCommand({
      actuatorId: actuator.id,
      command: 'set_value',
      value: 0.01, // 10mm
    });

    console.log('✅ Gripper closing to 10mm');
  }, 2000);
}

/**
 * Example 3: Export device to MJCF and URDF
 */
export async function exportDeviceExample(device: KinematicDevice) {
  // Export to MJCF (for MuJoCo simulation)
  const mjcfExporter = new MJCFExporter();
  const mjcfResult = await mjcfExporter.exportAndDownload(device);

  if (mjcfResult.success) {
    console.log('✅ MJCF exported successfully');
    console.log('   Downloaded:', `${device.name}_mjcf.zip`);
  }

  // Export to URDF (for ROS)
  const urdfExporter = new URDFExporter();
  const urdfResult = await urdfExporter.exportAndDownload(device);

  if (urdfResult.success) {
    console.log('✅ URDF exported successfully');
    console.log('   Downloaded:', `${device.name}_urdf.zip`);
  }
}

/**
 * Example 4: Create a pneumatic fixture
 */
export function createFixtureExample(): FixtureDevice {
  const kinematicsManager = KinematicsManager.getInstance();
  const actuatorSystem = kinematicsManager.getActuatorSystem();

  // Base fixture device
  const fixture: FixtureDevice = {
    id: 'fixture_001',
    name: '4-Clamp Fixture',
    type: 'fixture',
    version: '1.0',
    createdAt: new Date(),
    modifiedAt: new Date(),
    tags: ['fixture', 'pneumatic'],
    links: [
      {
        id: 'fixture_base',
        name: 'base_plate',
        geometry: { vertices: [], indices: [], normals: [] },
        material: {
          color: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
          metallic: 0.8,
          roughness: 0.4,
        },
        mass: 5.0,
        isBase: true,
        tags: ['base'],
      },
      // Add 4 clamp links (simplified)
    ],
    joints: [
      // Add 4 clamp joints (simplified)
    ],
    baseLink: 'fixture_base',
    dof: 4,
    exportFormat: 'all',
    actuators: [],
    fixtureProperties: {
      workpieceSize: { width: 0.3, height: 0.2, depth: 0.05 },
      clampPositions: [],
      pinPositions: [],
      locatingPoints: [],
    },
  };

  // Create pneumatic valve actuators for each clamp
  for (let i = 1; i <= 4; i++) {
    const valve = actuatorSystem.createPneumaticValve(
      `clamp_${i}_valve`,
      [`clamp_${i}_joint`],
      {
        pressure: 6, // 6 bar
        bore: 32, // 32mm diameter
        stroke: 25, // 25mm stroke
        force: 482, // 482N at 6 bar
      }
    );

    fixture.actuators!.push(valve);
  }

  console.log('✅ Fixture created with 4 pneumatic valves');
  return fixture;
}

/**
 * Complete workflow example
 */
export async function completeWorkflowExample() {
  console.log('=== Kinematic System Example ===\n');

  // Step 1: Create device
  console.log('Step 1: Creating gripper device...');
  const device = createGripperExample();

  // Step 2: Control actuators
  console.log('\nStep 2: Controlling gripper...');
  controlGripperExample();

  // Step 3: Export (after motion simulation)
  console.log('\nStep 3: Exporting device...');
  setTimeout(async () => {
    await exportDeviceExample(device);
    console.log('\n=== Example Complete ===');
  }, 5000);
}

// Uncomment to run example:
// completeWorkflowExample();
