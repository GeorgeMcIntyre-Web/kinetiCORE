/**
 * MJCF (MuJoCo XML) Type Definitions
 * Owner: George
 * 
 * Type definitions for MuJoCo XML format parsing and conversion
 */

/**
 * MJCF Joint Types (MuJoCo specific)
 */
export type MJCFJointType = 
  | 'free'      // 6 DOF (position + orientation)
  | 'ball'      // 3 DOF (orientation only)
  | 'slide'     // 1 DOF (prismatic)
  | 'hinge'     // 1 DOF (revolute)
  | 'fixed';    // 0 DOF

/**
 * MJCF Body Definition
 */
export interface MJCFBody {
  name: string;
  pos?: [number, number, number];  // Position (x, y, z) in meters
  quat?: [number, number, number, number];  // Quaternion (w, x, y, z)
  euler?: [number, number, number];  // Euler angles (roll, pitch, yaw) in radians
  
  // Child bodies
  bodies?: MJCFBody[];
  
  // Joints
  joints?: MJCFJoint[];
  
  // Geometry
  geoms?: MJCFGeom[];
  
  // Inertial properties
  inertial?: MJCFInertial;
}

/**
 * MJCF Joint Definition
 */
export interface MJCFJoint {
  name: string;
  type: MJCFJointType;
  pos?: [number, number, number];  // Joint position
  axis?: [number, number, number]; // Joint axis (for hinge/slide)
  range?: [number, number];        // Joint limits
  damping?: number;               // Joint damping
  friction?: number;              // Joint friction
  stiffness?: number;             // Joint stiffness
  springref?: number;             // Spring reference position
}

/**
 * MJCF Geometry Definition
 */
export interface MJCFGeom {
  name?: string;
  type: 'box' | 'sphere' | 'cylinder' | 'capsule' | 'ellipsoid' | 'plane' | 'mesh';
  size?: number | [number, number, number];  // Dimensions
  pos?: [number, number, number];            // Position
  quat?: [number, number, number, number];   // Orientation
  rgba?: [number, number, number, number];   // Color (RGBA)
  mass?: number;                             // Mass
  density?: number;                          // Density
  friction?: [number, number, number];       // Friction (sliding, rolling, torsional)
  mesh?: string;                             // Mesh file reference
  meshfile?: string;                         // Mesh file path
}

/**
 * MJCF Inertial Properties
 */
export interface MJCFInertial {
  pos?: [number, number, number];
  quat?: [number, number, number, number];
  mass?: number;
  diaginertia?: [number, number, number];  // Diagonal inertia tensor
  fullinertia?: number[];                  // Full 6x6 inertia matrix
}

/**
 * MJCF Actuator Definition
 */
export interface MJCFActuator {
  name: string;
  joint: string;                    // Target joint name
  type?: string;                    // Actuator type
  gear?: number;                    // Gear ratio
  bias?: number;                    // Bias value
  ctrllimited?: boolean;            // Control limits enabled
  ctrlrange?: string;               // Control range as string
  forcelimited?: boolean;           // Force limits enabled
  forcerange?: [number, number];    // Force range
  actlimited?: boolean;             // Actuator limits enabled
  actrange?: [number, number];      // Actuator range
  biasprm?: [number, number];       // Bias parameters
  gainprm?: [number, number];       // Gain parameters
}

/**
 * MJCF Tendon Definition (for coupled joints)
 */
export interface MJCFTendon {
  name: string;
  joint: string[];                  // Connected joints
  jointcoef?: number[];             // Joint coefficients
  range?: [number, number];          // Tendon range
  stiffness?: number;               // Tendon stiffness
  damping?: number;                  // Tendon damping
}

/**
 * MJCF Equality Constraint
 */
export interface MJCFEquality {
  name?: string;
  type: 'connect' | 'weld' | 'joint' | 'tendon' | 'distance';
  body1?: string;
  body2?: string;
  joint1?: string;
  joint2?: string;
  anchor?: [number, number, number];
  solref?: [number, number];
  solimp?: [number, number, number];
}

/**
 * MJCF Asset Definition
 */
export interface MJCFAsset {
  name: string;
  type?: 'mesh' | 'texture' | 'material';  // Asset type
  file: string;                     // File path
  scale?: number;                   // Scale factor
  euler?: [number, number, number]; // Euler rotation
  quat?: [number, number, number, number]; // Quaternion rotation
}

/**
 * MJCF Model Root
 */
export interface MJCFModel {
  model: string;                    // Model name
  
  // Default settings
  default?: {
    joint?: Partial<MJCFJoint>;
    geom?: Partial<MJCFGeom>;
    body?: Partial<MJCFBody>;
    actuator?: Partial<MJCFActuator>;
  };
  
  // Assets
  asset?: MJCFAsset[];
  
  // World body (root)
  worldbody: MJCFBody;
  
  // Actuators
  actuator?: MJCFActuator[];
  
  // Tendons
  tendon?: MJCFTendon[];
  
  // Equality constraints
  equality?: MJCFEquality[];
  
  // Contact pairs
  contact?: MJCFContact[];
  
  // Compiler settings
  compiler?: {
    angle?: 'radian' | 'degree';
    coordinate?: 'local' | 'global';
    inertiafromgeom?: boolean;
    inertiafromgeomfull?: boolean;
    meshdir?: string;
    texturedir?: string;
  };

  // Mesh directory for resolving relative paths
  meshDir?: string;
}

/**
 * MJCF Contact Definition
 */
export interface MJCFContact {
  name?: string;
  class?: string;
  geom1?: string;
  geom2?: string;
  condim?: number;
  friction?: [number, number, number];
  solref?: [number, number];
  solimp?: [number, number, number];
}

/**
 * MJCF Import Progress
 */
export interface MJCFImportProgress {
  stage: 'parsing' | 'bodies' | 'joints' | 'geometry' | 'actuators' | 'complete';
  current: number;
  total: number;
  percentComplete: number;
  currentItem?: string;
}

/**
 * MJCF Import Result
 */
export interface MJCFImportResult {
  success: boolean;
  meshes: any[]; // BABYLON.AbstractMesh[]
  rootNodes: any[]; // BABYLON.TransformNode[]
  joints: MJCFJoint[];
  actuators: MJCFActuator[];
  errors: string[];
  warnings: string[];
  bounds?: any; // BABYLON.BoundingBox
}

/**
 * MJCF Error Types
 */
export enum MJCFErrorType {
  ParseError = 'parse_error',
  InvalidFormat = 'invalid_format',
  MissingGeometry = 'missing_geometry',
  UnsupportedFeature = 'unsupported_feature',
  ConversionError = 'conversion_error'
}

/**
 * MJCF Import Error
 */
export class MJCFImportError extends Error {
  constructor(
    public type: MJCFErrorType,
    public details: string,
    public recoverable: boolean = false
  ) {
    super(`MJCF Import Error: ${details}`);
    this.name = 'MJCFImportError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MJCFImportError);
    }
  }

  isRecoverable(): boolean {
    return this.recoverable;
  }

  getUserMessage(): string {
    switch (this.type) {
      case MJCFErrorType.ParseError:
        return 'Failed to parse MJCF XML file. Please check the file format.';
      case MJCFErrorType.InvalidFormat:
        return 'Invalid MJCF file format. Please ensure the file is a valid MuJoCo XML file.';
      case MJCFErrorType.MissingGeometry:
        return 'No valid geometry was found in the MJCF file.';
      case MJCFErrorType.UnsupportedFeature:
        return 'This MJCF file contains unsupported features.';
      case MJCFErrorType.ConversionError:
        return 'Failed to convert MJCF data to Babylon.js format.';
      default:
        return 'An unknown error occurred while importing the MJCF file.';
    }
  }
}
