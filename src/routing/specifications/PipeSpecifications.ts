// Pipe Specifications - Sizing, materials, and constraint rules for pipes
// Owner: Agent 3 (Specifications & Technical Spec Lead)

import { RouteConstraints, ClearanceRequirements } from '../core/types';

/**
 * Pipe size table (Nominal to actual dimensions)
 * Reference: ANSI/ASME B36.10M standard for steel pipe
 */
export const PIPE_SIZES: Record<string, { od: number; id: number; wallThickness: number }> = {
  '1/4"': { od: 0.0135, id: 0.009, wallThickness: 0.00225 },    // DN6
  '3/8"': { od: 0.017, id: 0.012, wallThickness: 0.0025 },      // DN10
  '1/2"': { od: 0.021, id: 0.016, wallThickness: 0.0025 },      // DN15
  '3/4"': { od: 0.027, id: 0.021, wallThickness: 0.003 },       // DN20
  '1"': { od: 0.033, id: 0.027, wallThickness: 0.003 },         // DN25
  '1-1/4"': { od: 0.042, id: 0.036, wallThickness: 0.003 },     // DN32
  '1-1/2"': { od: 0.048, id: 0.041, wallThickness: 0.0035 },    // DN40
  '2"': { od: 0.060, id: 0.053, wallThickness: 0.0035 },        // DN50
  '2-1/2"': { od: 0.073, id: 0.063, wallThickness: 0.005 },     // DN65
  '3"': { od: 0.089, id: 0.078, wallThickness: 0.0055 },        // DN80
  '4"': { od: 0.114, id: 0.102, wallThickness: 0.006 },         // DN100
  '6"': { od: 0.168, id: 0.154, wallThickness: 0.007 },         // DN150
  '8"': { od: 0.219, id: 0.203, wallThickness: 0.008 },         // DN200
};

/**
 * Material types for pipes
 */
export type PipeMaterial = 'steel' | 'stainless' | 'copper' | 'PVC' | 'aluminum';

/**
 * Material specifications
 */
export interface PipeMaterialSpec {
  name: PipeMaterial;
  color: string;           // Hex color for visualization
  bendRadiusMultiplier: number;  // Multiplier × OD for minimum bend radius
  maxTemperature: number;  // °C
  pressureRating: number;  // PSI (for Schedule 40)
}

/**
 * Material database
 */
export const PIPE_MATERIALS: Record<PipeMaterial, PipeMaterialSpec> = {
  steel: {
    name: 'steel',
    color: '#808080',      // Gray
    bendRadiusMultiplier: 4.0,
    maxTemperature: 250,
    pressureRating: 1000,
  },
  stainless: {
    name: 'stainless',
    color: '#C0C0C0',      // Silver
    bendRadiusMultiplier: 4.0,
    maxTemperature: 400,
    pressureRating: 1500,
  },
  copper: {
    name: 'copper',
    color: '#B87333',      // Copper
    bendRadiusMultiplier: 2.5,
    maxTemperature: 200,
    pressureRating: 500,
  },
  PVC: {
    name: 'PVC',
    color: '#FFFFFF',      // White
    bendRadiusMultiplier: 3.0,
    maxTemperature: 60,
    pressureRating: 200,
  },
  aluminum: {
    name: 'aluminum',
    color: '#D3D3D3',      // Light gray
    bendRadiusMultiplier: 3.5,
    maxTemperature: 150,
    pressureRating: 600,
  },
};

/**
 * Support spacing rules by pipe size
 * Reference: ASME B31.1 and B31.3 standards
 */
export const PIPE_SUPPORT_SPACING: Record<string, number> = {
  '1/4"': 2.13,    // 7 feet
  '3/8"': 2.13,    // 7 feet
  '1/2"': 2.44,    // 8 feet
  '3/4"': 3.05,    // 10 feet
  '1"': 3.66,      // 12 feet
  '1-1/4"': 4.27,  // 14 feet
  '1-1/2"': 4.57,  // 15 feet
  '2"': 5.18,      // 17 feet
  '2-1/2"': 5.79,  // 19 feet
  '3"': 6.10,      // 20 feet
  '4"': 6.71,      // 22 feet
  '6"': 7.62,      // 25 feet
  '8"': 8.53,      // 28 feet
};

/**
 * Standard clearance requirements for pipes
 */
export const PIPE_CLEARANCE: ClearanceRequirements = {
  walls: 0.05,              // 2 inches (50mm)
  ceiling: 0.05,            // 2 inches (50mm)
  floor: 0.15,              // 6 inches (150mm)
  otherInfrastructure: 0.075, // 3 inches (75mm)
};

/**
 * Get constraint rules for a pipe route
 * This is the main API that other agents (Agent 2, Agent 4) will use
 * 
 * @param size - Nominal pipe size (e.g., "3/4\"", "1\"")
 * @param material - Pipe material (e.g., "steel", "copper")
 * @returns RouteConstraints object with all constraint values
 * 
 * @example
 * ```typescript
 * const rules = getPipeConstraintRules('3/4"', 'steel');
 * // Returns:
 * // {
 * //   minBendRadius: 0.108,  // 4x diameter for steel
 * //   supportSpacing: 3.05,  // 10 feet for 3/4" pipe
 * //   clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 }
 * // }
 * ```
 */
export function getPipeConstraintRules(
  size: string,
  material: PipeMaterial
): RouteConstraints {
  // Look up pipe dimensions
  const pipeSize = PIPE_SIZES[size];
  if (!pipeSize) {
    throw new Error(`Unknown pipe size: ${size}`);
  }

  // Look up material properties
  const materialSpec = PIPE_MATERIALS[material];
  if (!materialSpec) {
    throw new Error(`Unknown pipe material: ${material}`);
  }

  // Calculate minimum bend radius: material multiplier × outer diameter
  const minBendRadius = materialSpec.bendRadiusMultiplier * pipeSize.od;

  // Look up support spacing
  const supportSpacing = PIPE_SUPPORT_SPACING[size] || 3.05; // Default 10 feet

  // Return complete constraints
  return {
    minBendRadius,
    supportSpacing,
    clearance: PIPE_CLEARANCE,
  };
}

/**
 * Get pipe outer diameter
 * Convenience function for geometry generators (Agent 4)
 * 
 * @param size - Nominal pipe size
 * @returns Outer diameter in meters
 */
export function getPipeOuterDiameter(size: string): number {
  const pipeSize = PIPE_SIZES[size];
  if (!pipeSize) {
    throw new Error(`Unknown pipe size: ${size}`);
  }
  return pipeSize.od;
}

/**
 * Get pipe inner diameter
 * Used for flow calculations
 * 
 * @param size - Nominal pipe size
 * @returns Inner diameter in meters
 */
export function getPipeInnerDiameter(size: string): number {
  const pipeSize = PIPE_SIZES[size];
  if (!pipeSize) {
    throw new Error(`Unknown pipe size: ${size}`);
  }
  return pipeSize.id;
}

/**
 * Get material visual properties
 * Used by geometry generators for material application
 * 
 * @param material - Pipe material
 * @returns Material specification with color and properties
 */
export function getPipeMaterialSpec(material: PipeMaterial): PipeMaterialSpec {
  const materialSpec = PIPE_MATERIALS[material];
  if (!materialSpec) {
    throw new Error(`Unknown pipe material: ${material}`);
  }
  return materialSpec;
}

/**
 * Get all available pipe sizes
 * Used for UI dropdowns and validation
 */
export function getAvailablePipeSizes(): string[] {
  return Object.keys(PIPE_SIZES);
}

/**
 * Get all available pipe materials
 * Used for UI dropdowns and validation
 */
export function getAvailablePipeMaterials(): PipeMaterial[] {
  return Object.keys(PIPE_MATERIALS) as PipeMaterial[];
}

/**
 * Validate if a pipe size exists
 */
export function isValidPipeSize(size: string): boolean {
  return size in PIPE_SIZES;
}

/**
 * Validate if a pipe material exists
 */
export function isValidPipeMaterial(material: string): material is PipeMaterial {
  return material in PIPE_MATERIALS;
}
