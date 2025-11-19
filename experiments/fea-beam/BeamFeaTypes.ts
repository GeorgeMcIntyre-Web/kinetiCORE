/**
 * BeamFeaTypes.ts
 * Type definitions for simple 1D cantilever beam FEA experiment
 */

/**
 * Material properties for beam analysis
 */
export interface BeamMaterial {
  /** Material name (e.g., "Steel", "Aluminum") */
  name: string;
  /** Young's modulus (Pa) */
  youngsModulus: number;
  /** Second moment of area (m^4) */
  momentOfInertia: number;
  /** Density (kg/m^3) - optional for static analysis */
  density?: number;
  /** Yield strength (Pa) - optional for FoS calculation */
  yieldStrength?: number;
}

/**
 * Boundary condition types for beam
 */
export type BeamBoundaryType = 'fixed' | 'pinned' | 'roller';

/**
 * Boundary condition definition
 */
export interface BeamBoundaryCondition {
  /** Type of boundary condition */
  type: BeamBoundaryType;
  /** Position along beam (x coordinate in meters) */
  position: number;
}

/**
 * Load types for beam
 */
export type BeamLoadType = 'point' | 'distributed' | 'moment';

/**
 * Load definition
 */
export interface BeamLoad {
  /** Type of load */
  type: BeamLoadType;
  /** Position along beam (meters) */
  position: number;
  /** Force magnitude (N) or distributed load (N/m) */
  magnitude: number;
  /** For moment loads: moment magnitude (N⋅m) */
  moment?: number;
}

/**
 * Complete beam FEA input specification
 */
export interface BeamFeaInput {
  /** Beam length (meters) */
  length: number;
  /** Material properties */
  material: BeamMaterial;
  /** Boundary conditions */
  boundaryConditions: BeamBoundaryCondition[];
  /** Applied loads */
  loads: BeamLoad[];
  /** Number of elements for discretization */
  numElements: number;
}

/**
 * Nodal result data
 */
export interface BeamNodalResult {
  /** Node position along beam (meters) */
  position: number;
  /** Vertical displacement (meters) */
  displacement: number;
  /** Rotation (radians) */
  rotation: number;
}

/**
 * Element result data
 */
export interface BeamElementResult {
  /** Element center position (meters) */
  position: number;
  /** Bending moment (N⋅m) */
  moment: number;
  /** Shear force (N) */
  shear: number;
  /** Bending stress (Pa) */
  stress: number;
}

/**
 * Complete beam FEA result
 */
export interface BeamFeaResult {
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Nodal displacements and rotations */
  nodalResults: BeamNodalResult[];
  /** Element internal forces and stresses */
  elementResults: BeamElementResult[];
  /** Maximum displacement magnitude (meters) */
  maxDisplacement: number;
  /** Maximum stress magnitude (Pa) */
  maxStress: number;
  /** Factor of safety (if yield strength provided) */
  factorOfSafety?: number;
  /** Solution metadata */
  meta: {
    /** Degrees of freedom */
    dofs: number;
    /** Solve time (ms) */
    solveTime: number;
  };
}

/**
 * Validation: Check if material properties are physical
 */
export function validateMaterial(material: BeamMaterial): string | null {
  if (material.youngsModulus <= 0) {
    return "Young's modulus must be positive";
  }

  if (material.momentOfInertia <= 0) {
    return 'Moment of inertia must be positive';
  }

  if (material.density !== undefined && material.density <= 0) {
    return 'Density must be positive';
  }

  if (material.yieldStrength !== undefined && material.yieldStrength <= 0) {
    return 'Yield strength must be positive';
  }

  return null;
}

/**
 * Validation: Check if beam input is valid
 */
export function validateBeamInput(input: BeamFeaInput): string | null {
  if (input.length <= 0) {
    return 'Beam length must be positive';
  }

  if (input.numElements < 2) {
    return 'Number of elements must be at least 2';
  }

  const materialError = validateMaterial(input.material);
  if (materialError) {
    return materialError;
  }

  if (input.boundaryConditions.length === 0) {
    return 'At least one boundary condition required';
  }

  if (input.loads.length === 0) {
    return 'At least one load required';
  }

  return null;
}
