import * as BABYLON from '@babylonjs/core';

/**
 * @fileoverview Type schemas for auto kinematic tooling system.
 * Defines input/output contracts for the kinematic extraction pipeline.
 */

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

/**
 * Tool definition input for manual tooling specification.
 * Used when tool units are defined explicitly rather than auto-detected.
 */
export interface ToolDefinitionInput {
  /** Unique identifier for this tool */
  id: string;
  /** Human-readable tool name */
  name: string;
  /** Root node ID in the scene hierarchy */
  toolRootNodeId: string;
  /** Optional tags for classification (e.g., ['gripper', 'pneumatic']) */
  tags?: string[];
  /** Hints for identifying moving components */
  movingHints?: string[];
  /** Hints for identifying fixed components */
  fixedHints?: string[];
}

/**
 * Pneumatic actuation plan input.
 * Defines valve bank configuration and channel timings for pneumatic tooling.
 */
export interface PneumaticPlanInput {
  /** ID of the valve bank controlling these channels */
  valveBankId: string;
  /** Array of pneumatic channels */
  channels: Array<{
    /** Unique channel identifier */
    id: string;
    /** Tool unit ID this channel controls */
    unitId: string;
    /** Type of pneumatic actuator */
    type: 'clamp' | 'pin' | 'dump' | 'slide' | 'other';
    /** Command string to extend actuator */
    extendCmd: string;
    /** Command string to retract actuator */
    retractCmd: string;
    /** Timing parameters in milliseconds */
    timings: {
      /** Time to extend (ms) */
      extendMs: number;
      /** Time to retract (ms) */
      retractMs: number;
      /** Optional dwell time at extended position (ms) */
      dwellMs?: number;
    };
    /** Optional interlock dependencies (other channel IDs) */
    interlocks?: string[];
  }>;
}

/**
 * State reference input for ICP-based joint extraction.
 * Defines reference poses for advance/retract states.
 */
export type StateRefsInput = Array<{
  /** Tool unit ID */
  unitId: string;
  /** Advance state reference (nodes or explicit points) */
  advance: {
    /** Node IDs to sample */
    nodes?: string[];
    /** Explicit world-space points */
    points?: BABYLON.Vector3[];
  };
  /** Retract state reference (nodes or explicit points) */
  retract: {
    /** Node IDs to sample */
    nodes?: string[];
    /** Explicit world-space points */
    points?: BABYLON.Vector3[];
  };
}>;

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

/**
 * Joint definition output in world space.
 * Complete kinematic joint specification ready for simulation.
 *
 * @remarks
 * All spatial data (axis, anchor) is in world coordinates.
 * This format is compatible with MJCF export and ValveBank registration.
 */
export interface JointDefinitionOutput {
  /** Unique joint identifier */
  id: string;
  /** Joint type */
  type: 'hinge' | 'prismatic';
  /** Parent node ID in kinematic tree */
  parentId: string;
  /** Child node ID (moves relative to parent) */
  childId: string;
  /** Axis of rotation/translation in world space (unit vector) */
  axisWorld: BABYLON.Vector3;
  /** Anchor/pivot point in world space */
  anchorWorld: BABYLON.Vector3;
  /** Joint motion limits */
  limits: {
    /** Lower limit (radians for hinge, meters for prismatic) */
    lower: number;
    /** Upper limit (radians for hinge, meters for prismatic) */
    upper: number;
  };
  /** Optional motion profile constraints */
  profiles?: {
    /** Maximum velocity (rad/s or m/s) */
    maxVelocity?: number;
    /** Maximum acceleration (rad/s² or m/s²) */
    maxAcceleration?: number;
  };
}

/**
 * Actuator program output.
 * Timeline-based control program for valve bank execution.
 *
 * @remarks
 * This format can be exported to PLC control systems or executed
 * directly via ValveBank for simulation/validation.
 */
export interface ActuatorProgramOutput {
  /** Array of channel programs */
  channels: Array<{
    /** Channel identifier */
    id: string;
    /** Tool unit ID this channel controls */
    unitId: string;
    /** Timeline of commands */
    timeline: Array<{
      /** Time offset in milliseconds */
      tMs: number;
      /** Command to execute */
      cmd: 'extend' | 'retract' | 'hold';
    }>;
  }>;
  /** Optional residual errors from ICP fit (meters), keyed by unit ID */
  residuals?: Record<string, number>;
}

/**
 * Complete kinematic model export.
 * Bundles joint definitions and actuator program for external use.
 *
 * @remarks
 * This is the top-level output format for the kinematic extraction pipeline.
 * Can be serialized to JSON and imported into other systems.
 *
 * @example
 * ```typescript
 * const model: KinematicModelExport = {
 *   joints: [
 *     { id: 'gripper_jaw', type: 'hinge', ... },
 *     { id: 'clamp_slide', type: 'prismatic', ... }
 *   ],
 *   actuatorProgram: {
 *     channels: [
 *       { id: 'ch1', unitId: 'gripper', timeline: [...] }
 *     ]
 *   }
 * };
 *
 * // Export to JSON
 * const json = JSON.stringify(model, null, 2);
 *
 * // Export to MJCF
 * const mjcf = MJCFExporter.export(model);
 * ```
 */
export interface KinematicModelExport {
  /** Array of joint definitions */
  joints: JointDefinitionOutput[];
  /** Actuator control program */
  actuatorProgram: ActuatorProgramOutput;
}
