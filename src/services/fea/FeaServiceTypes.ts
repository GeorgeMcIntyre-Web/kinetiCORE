/**
 * FeaServiceTypes.ts
 * Type definitions for FEA HTTP service client
 * Aligned with backend FastAPI + Celery architecture
 */

/**
 * FEA job status literals
 */
export type FeaJobStatusType = 'queued' | 'running' | 'completed' | 'error';

/**
 * Model types supported by FEA service
 */
export type FeaModelType = 'beam-demo' | 'shell-demo' | 'biw-proto';

/**
 * Material definition for FEA
 */
export interface FeaMaterial {
  /** Material identifier */
  id: string;
  /** Display name */
  name: string;
  /** Young's modulus (Pa) */
  youngsModulus: number;
  /** Poisson's ratio (dimensionless) */
  poissonsRatio: number;
  /** Density (kg/m³) */
  density?: number;
  /** Yield strength (Pa) - optional for FoS calculation */
  yieldStrength?: number;
}

/**
 * Boundary condition definition
 */
export interface FeaBoundaryCondition {
  /** Type of constraint */
  type: 'fixed' | 'pinned' | 'symmetry';
  /** Node IDs to constrain */
  nodeIds: number[];
  /** Constrained degrees of freedom */
  dofs?: ('ux' | 'uy' | 'uz' | 'rx' | 'ry' | 'rz')[];
}

/**
 * Load definition
 */
export interface FeaLoad {
  /** Load type */
  type: 'concentrated' | 'pressure' | 'gravity';
  /** Node IDs for concentrated loads */
  nodeIds?: number[];
  /** Element IDs for pressure loads */
  elementIds?: number[];
  /** Force vector (N) */
  force?: { x: number; y: number; z: number };
  /** Pressure magnitude (Pa) */
  pressure?: number;
}

/**
 * FEA job request metadata
 */
export interface FeaJobMeta {
  /** Job name */
  name: string;
  /** Optional description */
  description?: string;
  /** Estimated degrees of freedom (for routing) */
  estimatedDofs?: number;
  /** Model type */
  modelType: FeaModelType;
}

/**
 * Complete FEA job request
 */
export interface FeaJobRequest {
  /** Job metadata */
  meta: FeaJobMeta;
  /** Materials used in analysis */
  materials: FeaMaterial[];
  /** Boundary conditions */
  boundaryConditions: FeaBoundaryCondition[];
  /** Applied loads */
  loads: FeaLoad[];
  /** Additional solver options (optional) */
  solverOptions?: {
    /** Max iterations for iterative solver */
    maxIterations?: number;
    /** Convergence tolerance */
    tolerance?: number;
  };
}

/**
 * FEA job status response
 */
export interface FeaJobStatus {
  /** Unique job identifier */
  jobId: string;
  /** Current status */
  status: FeaJobStatusType;
  /** Progress percentage (0-100) if available */
  progress?: number;
  /** Status message */
  message?: string;
  /** Timestamp of last update */
  updatedAt?: string;
}

/**
 * FEA job result response
 */
export interface FeaJobResult {
  /** Job identifier */
  jobId: string;
  /** Final status */
  status: 'completed' | 'error';
  /** Error message if status is 'error' */
  error?: string;
  /** Maximum displacement magnitude (m) */
  maxDisplacement?: number;
  /** Maximum von Mises stress (Pa) */
  maxVonMises?: number;
  /** Factor of safety (if applicable) */
  factorOfSafety?: number;
  /** Nodal displacement field (optional) */
  fields?: {
    /** Node IDs */
    nodeIds?: number[];
    /** Displacement vectors */
    displacements?: Array<{ x: number; y: number; z: number }>;
    /** von Mises stress at nodes/elements */
    vonMises?: number[];
  };
  /** Result metadata */
  meta?: {
    /** Solve time (seconds) */
    solveTime?: number;
    /** Actual DOFs */
    dofs?: number;
  };
}

/**
 * Validation: Check if material is physically valid
 */
export function validateFeaMaterial(material: FeaMaterial): string | null {
  if (material.youngsModulus <= 0) {
    return `Material ${material.name}: Young's modulus must be positive`;
  }

  if (material.poissonsRatio < 0 || material.poissonsRatio >= 0.5) {
    return `Material ${material.name}: Poisson's ratio must be in [0, 0.5)`;
  }

  if (material.density !== undefined && material.density <= 0) {
    return `Material ${material.name}: Density must be positive`;
  }

  if (material.yieldStrength !== undefined && material.yieldStrength <= 0) {
    return `Material ${material.name}: Yield strength must be positive`;
  }

  return null;
}

/**
 * Validation: Check if FEA job request is valid
 */
export function validateFeaJobRequest(
  request: FeaJobRequest
): string | null {
  if (request.materials.length === 0) {
    return 'At least one material required';
  }

  for (const material of request.materials) {
    const error = validateFeaMaterial(material);
    if (error) {
      return error;
    }
  }

  if (request.boundaryConditions.length === 0) {
    return 'At least one boundary condition required';
  }

  if (request.loads.length === 0) {
    return 'At least one load required';
  }

  return null;
}
