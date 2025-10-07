/**
 * Unified Device Definition
 * Single source of truth for all kinematic devices
 * Consolidates: DeviceDefinition.ts, HardwareDeviceDefinition.ts, GenericDeviceDefinition.ts
 */

// ============================================================================
// Core Types
// ============================================================================

export type DeviceType = 'fixture' | 'gripper' | 'robot' | 'custom';
export type JointType = 'revolute' | 'prismatic' | 'fixed';
export type ActuatorType =
  | 'servo_motor'
  | 'stepper_motor'
  | 'pneumatic_cylinder'
  | 'hydraulic_cylinder'
  | 'electric_gripper'
  | 'linear_actuator';
export type ActuatorControlMode = 'position' | 'velocity' | 'force' | 'motor';

// ============================================================================
// Geometry & Transform Types
// ============================================================================

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Frame {
  origin: Vector3;
  xAxis: Vector3;  // Unit vector
  yAxis: Vector3;  // Unit vector
  zAxis: Vector3;  // Unit vector
}

export interface LinkGeometry {
  vertices: number[];    // Flat array: [x1,y1,z1, x2,y2,z2, ...]
  indices: number[];     // Triangle indices
  normals: number[];     // Vertex normals
  uvs?: number[];        // Optional UV coordinates
}

export interface Material {
  color: { r: number; g: number; b: number; a: number };
  metallic: number;      // 0-1
  roughness: number;     // 0-1
  emissive?: { r: number; g: number; b: number };
}

// ============================================================================
// Joint Definition
// ============================================================================

export interface JointLimits {
  min: number;          // Radians for revolute, meters for prismatic
  max: number;
  velocity?: number;    // Max velocity
  effort?: number;      // Max force/torque
}

export interface Joint {
  id: string;
  name: string;
  type: JointType;

  parentLink: string;   // Link ID
  childLink: string;    // Link ID

  // Frames define where joint attaches to parent and child
  parentFrame: Frame;
  childFrame: Frame;

  // Joint axis (relevant for revolute/prismatic)
  axis: Vector3;

  limits: JointLimits;

  // Current state
  currentValue: number; // Current angle/position

  // Dynamics (optional, from MJCF)
  damping?: number;       // Joint damping (N·m·s/rad or N·s/m)
  friction?: number;      // Friction (N·m or N)
  springRef?: number;     // Spring reference position
  springStiffness?: number; // Spring stiffness (N·m/rad or N/m)

  // Visual properties
  showAxis: boolean;
  axisLength: number;   // Visualization length
}

// ============================================================================
// Link Definition
// ============================================================================

export interface Link {
  id: string;
  name: string;

  geometry: LinkGeometry;
  material: Material;

  // Physics properties (optional)
  mass?: number;
  inertia?: {
    ixx: number; iyy: number; izz: number;
    ixy: number; ixz: number; iyz: number;
  };

  // Metadata
  isBase: boolean;      // Is this the grounded/base link?
  tags: string[];       // User tags for organization
}

// ============================================================================
// Hardware Actuator (MJCF-inspired)
// ============================================================================

export interface HardwareActuator {
  id: string;
  name: string;
  type: ActuatorType;
  controlMode: ActuatorControlMode;

  // Manufacturer info (optional)
  manufacturer?: string;
  modelNumber?: string;
  datasheet?: string;

  // Controlled joints
  controlledJoints: string[];

  // MJCF-style specifications
  specs: {
    // Control gains (for position/velocity control)
    kp?: number;          // Proportional gain
    ki?: number;          // Integral gain
    kd?: number;          // Derivative gain
    kv?: number;          // Velocity gain

    // Force/torque limits (N·m for rotary, N for linear)
    forceRange: {
      min: number;
      max: number;
    };

    // Control range (depends on controlMode)
    ctrlRange: {
      min: number;
      max: number;
    };

    // Transmission
    gearRatio?: number;   // Gear reduction ratio
    leadScrew?: number;   // Lead screw pitch (m) for linear

    // Performance specs
    ratedTorque?: number;    // Continuous torque (N·m)
    peakTorque?: number;     // Peak/intermittent torque (N·m)
    ratedForce?: number;     // Continuous force (N)
    peakForce?: number;      // Peak force (N)
    maxSpeed?: number;       // Max speed (rad/s or m/s)

    // Electrical
    voltage?: number;        // Operating voltage (V)
    current?: number;        // Rated current (A)
    power?: number;          // Rated power (W)

    // Pneumatic/Hydraulic specific
    pressure?: number;       // Operating pressure (bar or psi)
    bore?: number;           // Cylinder bore diameter (mm)
    stroke?: number;         // Cylinder stroke (mm)
    flowRate?: number;       // Flow rate (L/min)

    // Encoder/Feedback
    encoderResolution?: number;  // Counts per revolution
    hasEncoder?: boolean;
  };

  // Joint coordination (which joints, how they move)
  coordination: {
    jointId: string;
    ratio: number;        // Motion ratio (1.0 = same, -1.0 = opposite)
    offset: number;       // Position offset
  }[];

  // Current state
  state: {
    enabled: boolean;
    value: number;
    velocity?: number;
    force?: number;
    temperature?: number;
    fault: boolean;
    faultCode?: string;
  };
}

// ============================================================================
// Actuator Group
// ============================================================================

export interface ActuatorGroup {
  id: string;
  name: string;
  actuatorIds: string[];
  synchronized: boolean;
  leader?: string;  // ID of leader actuator
}

// ============================================================================
// Base Kinematic Device
// ============================================================================

export interface KinematicDevice {
  // Metadata
  id: string;
  name: string;
  type: DeviceType;
  version: string;

  createdAt: Date;
  modifiedAt: Date;
  author?: string;
  description?: string;
  tags: string[];

  // Structure
  links: Link[];
  joints: Joint[];

  // Base link reference
  baseLink: string;     // Link ID that is grounded

  // Hardware actuation (optional - can be generic or real hardware)
  actuators?: HardwareActuator[];
  actuatorGroups?: ActuatorGroup[];

  // Computed properties
  dof: number;          // Degrees of freedom

  // Export settings
  exportFormat: 'kicore' | 'urdf' | 'mjcf' | 'all';
}

// ============================================================================
// Fixture-specific Device
// ============================================================================

export interface FixtureDevice extends KinematicDevice {
  type: 'fixture';

  fixtureProperties: {
    workpieceSize: { width: number; height: number; depth: number };
    clampPositions: string[];  // Actuator IDs
    pinPositions: string[];    // Actuator IDs
    locatingPoints: string[];  // Key reference points (joint IDs)
  };
}

// ============================================================================
// Gripper-specific Device
// ============================================================================

export interface GripperDevice extends KinematicDevice {
  type: 'gripper';

  gripperProperties: {
    fingerCount: number;
    maxGripWidth: number;
    minGripWidth: number;
    gripForce: number;

    // Joint IDs that control gripper
    actuatedJoints: string[];
  };
}

// ============================================================================
// Device Creation Requests
// ============================================================================

export interface DeviceCreationRequest {
  name: string;
  type: DeviceType;

  // Meshes to include (from scene)
  selectedMeshIds: string[];

  // Base link
  baseMeshId: string;

  // Optional template
  templateId?: string;

  // Optional hardware selection
  selectedHardware?: {
    libraryEntryId: string;
    quantity: number;
  }[];
}

// ============================================================================
// Export Results
// ============================================================================

export interface ExportResult {
  success: boolean;
  format: 'kicore' | 'urdf' | 'mjcf';

  // File data
  files: {
    filename: string;
    content: Blob;
  }[];

  // Metadata
  deviceName: string;
  exportDate: Date;

  error?: string;
}

export interface ImportResult {
  success: boolean;
  device?: KinematicDevice;
  warnings: string[];
  errors: string[];
}

// ============================================================================
// Hardware Library Entry
// ============================================================================

export interface HardwareLibraryEntry {
  id: string;
  category: 'servo_motor' | 'pneumatic' | 'hydraulic' | 'gripper' | 'linear';

  manufacturer: string;
  modelNumber: string;
  description: string;
  datasheet?: string;
  image?: string;

  // Specifications (to be used in HardwareActuator.specs)
  specs: HardwareActuator['specs'];

  // Common applications
  applications: string[];

  // Availability
  inStock: boolean;
  price?: number;
  currency?: string;
}

// ============================================================================
// Control Commands
// ============================================================================

export interface HardwareCommand {
  actuatorId: string;
  command: 'enable' | 'disable' | 'set_value' | 'set_velocity' | 'set_force' | 'home' | 'reset_fault';
  value?: number;
}

export interface HardwareDeviceState {
  timestamp: Date;
  deviceId: string;

  jointStates: {
    jointId: string;
    position: number;
    velocity: number;
    force: number;
  }[];

  actuatorStates: {
    actuatorId: string;
    enabled: boolean;
    controlValue: number;
    actualPosition?: number;
    actualVelocity?: number;
    actualForce?: number;
    temperature?: number;
    fault: boolean;
  }[];
}

// ============================================================================
// Type Guards
// ============================================================================

export function isFixtureDevice(device: KinematicDevice): device is FixtureDevice {
  return device.type === 'fixture';
}

export function isGripperDevice(device: KinematicDevice): device is GripperDevice {
  return device.type === 'gripper';
}

export function hasActuators(device: KinematicDevice): boolean {
  return device.actuators !== undefined && device.actuators.length > 0;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function calculateDOF(joints: Joint[]): number {
  let dof = 0;
  for (const joint of joints) {
    if (joint.type === 'revolute' || joint.type === 'prismatic') {
      dof++;
    }
  }
  return dof;
}

export function createDefaultFrame(): Frame {
  return {
    origin: { x: 0, y: 0, z: 0 },
    xAxis: { x: 1, y: 0, z: 0 },
    yAxis: { x: 0, y: 1, z: 0 },
    zAxis: { x: 0, y: 0, z: 1 },
  };
}

export function createDefaultMaterial(): Material {
  return {
    color: { r: 0.7, g: 0.7, b: 0.7, a: 1.0 },
    metallic: 0.5,
    roughness: 0.5,
  };
}
