// Conduit Specifications - Sizing, materials, and constraint rules for electrical conduit
// Owner: Agent 3 (Specifications & Technical Spec Lead)

import { RouteConstraints, ClearanceRequirements } from '../core/types';

/**
 * Conduit types
 */
export type ConduitType = 'EMT' | 'IMC' | 'rigid' | 'PVC' | 'flexible' | 'liquidtight';

/**
 * Conduit material types
 */
export type ConduitMaterial = 'steel' | 'aluminum' | 'PVC' | 'fiberglass';

/**
 * Conduit size specification
 */
export interface ConduitSize {
  od: number;             // Outer diameter (meters)
  id: number;             // Inner diameter (meters)
  wallThickness: number;  // Wall thickness (meters)
  maxWires14AWG: number;  // Maximum 14 AWG wires (40% fill)
  maxWires12AWG: number;  // Maximum 12 AWG wires (40% fill)
}

/**
 * Standard conduit sizes
 * Reference: NEC (National Electrical Code) Article 344-358
 */
export const CONDUIT_SIZES: Record<string, ConduitSize> = {
  '1/2"': {
    od: 0.021,
    id: 0.016,
    wallThickness: 0.0025,
    maxWires14AWG: 9,
    maxWires12AWG: 7,
  },
  '3/4"': {
    od: 0.023,
    id: 0.020,
    wallThickness: 0.0015,
    maxWires14AWG: 16,
    maxWires12AWG: 12,
  },
  '1"': {
    od: 0.027,
    id: 0.027,
    wallThickness: 0.0025,
    maxWires14AWG: 26,
    maxWires12AWG: 20,
  },
  '1-1/4"': {
    od: 0.036,
    id: 0.036,
    wallThickness: 0.0025,
    maxWires14AWG: 44,
    maxWires12AWG: 33,
  },
  '1-1/2"': {
    od: 0.041,
    id: 0.041,
    wallThickness: 0.0030,
    maxWires14AWG: 61,
    maxWires12AWG: 46,
  },
  '2"': {
    od: 0.053,
    id: 0.053,
    wallThickness: 0.0035,
    maxWires14AWG: 99,
    maxWires12AWG: 75,
  },
  '2-1/2"': {
    od: 0.063,
    id: 0.063,
    wallThickness: 0.0040,
    maxWires14AWG: 148,
    maxWires12AWG: 112,
  },
  '3"': {
    od: 0.078,
    id: 0.078,
    wallThickness: 0.0045,
    maxWires14AWG: 223,
    maxWires12AWG: 169,
  },
  '3-1/2"': {
    od: 0.089,
    id: 0.089,
    wallThickness: 0.0050,
    maxWires14AWG: 285,
    maxWires12AWG: 216,
  },
  '4"': {
    od: 0.102,
    id: 0.102,
    wallThickness: 0.0055,
    maxWires14AWG: 365,
    maxWires12AWG: 277,
  },
};

/**
 * Conduit type specifications
 */
export interface ConduitTypeSpec {
  type: ConduitType;
  description: string;
  bendRadiusMultiplier: number;  // Multiplier × conduit OD for minimum bend radius
  maxBends: number;              // Maximum bends before junction box required
  threaded: boolean;
  color: string;                 // Hex color for visualization
}

/**
 * Conduit type database
 */
export const CONDUIT_TYPES: Record<ConduitType, ConduitTypeSpec> = {
  EMT: {
    type: 'EMT',
    description: 'Electrical Metallic Tubing (thin-wall)',
    bendRadiusMultiplier: 6.0,
    maxBends: 4, // 360° total
    threaded: false,
    color: '#90EE90', // Light green
  },
  IMC: {
    type: 'IMC',
    description: 'Intermediate Metal Conduit',
    bendRadiusMultiplier: 6.0,
    maxBends: 4,
    threaded: true,
    color: '#228B22', // Forest green
  },
  rigid: {
    type: 'rigid',
    description: 'Rigid Metal Conduit (RMC)',
    bendRadiusMultiplier: 6.0,
    maxBends: 4,
    threaded: true,
    color: '#006400', // Dark green
  },
  PVC: {
    type: 'PVC',
    description: 'Polyvinyl Chloride Conduit',
    bendRadiusMultiplier: 4.5,
    maxBends: 4,
    threaded: false,
    color: '#DCDCDC', // Light gray
  },
  flexible: {
    type: 'flexible',
    description: 'Flexible Metal Conduit (FMC)',
    bendRadiusMultiplier: 2.5,
    maxBends: 6, // More flexible
    threaded: false,
    color: '#A9A9A9', // Dark gray
  },
  liquidtight: {
    type: 'liquidtight',
    description: 'Liquidtight Flexible Metal Conduit (LFMC)',
    bendRadiusMultiplier: 3.0,
    maxBends: 6,
    threaded: false,
    color: '#696969', // Dim gray
  },
};

/**
 * Conduit material specifications
 */
export interface ConduitMaterialSpec {
  name: ConduitMaterial;
  maxTemperature: number;  // °C
  corrosionResistance: 'low' | 'medium' | 'high';
  indoorOutdoor: 'indoor' | 'outdoor' | 'both';
}

/**
 * Conduit material database
 */
export const CONDUIT_MATERIALS: Record<ConduitMaterial, ConduitMaterialSpec> = {
  steel: {
    name: 'steel',
    maxTemperature: 200,
    corrosionResistance: 'low',
    indoorOutdoor: 'indoor',
  },
  aluminum: {
    name: 'aluminum',
    maxTemperature: 150,
    corrosionResistance: 'medium',
    indoorOutdoor: 'both',
  },
  PVC: {
    name: 'PVC',
    maxTemperature: 60,
    corrosionResistance: 'high',
    indoorOutdoor: 'both',
  },
  fiberglass: {
    name: 'fiberglass',
    maxTemperature: 120,
    corrosionResistance: 'high',
    indoorOutdoor: 'both',
  },
};

/**
 * Support spacing rules by conduit size
 * Reference: NEC Table 344.30(B)(2) and equivalent for other conduit types
 */
export const CONDUIT_SUPPORT_SPACING: Record<string, number> = {
  '1/2"': 3.05,    // 10 feet
  '3/4"': 3.05,    // 10 feet
  '1"': 3.66,      // 12 feet
  '1-1/4"': 4.27,  // 14 feet
  '1-1/2"': 4.27,  // 14 feet
  '2"': 4.88,      // 16 feet
  '2-1/2"': 4.88,  // 16 feet
  '3"': 6.10,      // 20 feet
  '3-1/2"': 6.10,  // 20 feet
  '4"': 6.10,      // 20 feet
};

/**
 * Standard clearance requirements for conduit
 */
export const CONDUIT_CLEARANCE: ClearanceRequirements = {
  walls: 0.05,              // 2 inches (50mm)
  ceiling: 0.05,            // 2 inches (50mm)
  floor: 0.15,              // 6 inches (150mm)
  otherInfrastructure: 0.075, // 3 inches (75mm)
};

/**
 * Junction box spacing (maximum run length before junction box required)
 * NEC requires junction box when total bends exceed 360°
 */
export const MAX_RUN_LENGTH_BEFORE_JUNCTION = 30.48; // 100 feet

/**
 * Get constraint rules for a conduit route
 * This is the main API that other agents (Agent 2, Agent 6) will use
 * 
 * @param size - Conduit size (e.g., "3/4\"", "1\"")
 * @param conduitType - Conduit type (e.g., "EMT", "PVC")
 * @param material - Conduit material (e.g., "steel", "PVC")
 * @returns RouteConstraints object with all constraint values
 * 
 * @example
 * ```typescript
 * const rules = getConduitConstraintRules('3/4"', 'EMT', 'steel');
 * // Returns:
 * // {
 * //   minBendRadius: 0.138,  // 6x diameter for EMT
 * //   maxRunLength: 30.48,   // 100 feet before junction box
 * //   supportSpacing: 3.05,  // 10 feet for 3/4" conduit
 * //   clearance: { walls: 0.05, ceiling: 0.05, floor: 0.15, otherInfrastructure: 0.075 }
 * // }
 * ```
 */
export function getConduitConstraintRules(
  size: string,
  conduitType: ConduitType,
  material: ConduitMaterial
): RouteConstraints {
  // Look up conduit dimensions
  const conduitSize = CONDUIT_SIZES[size];
  if (!conduitSize) {
    throw new Error(`Unknown conduit size: ${size}`);
  }

  // Look up conduit type properties
  const typeSpec = CONDUIT_TYPES[conduitType];
  if (!typeSpec) {
    throw new Error(`Unknown conduit type: ${conduitType}`);
  }

  // Calculate minimum bend radius: type multiplier × outer diameter
  const minBendRadius = typeSpec.bendRadiusMultiplier * conduitSize.od;

  // Look up support spacing
  const supportSpacing = CONDUIT_SUPPORT_SPACING[size] || 3.05; // Default 10 feet

  // Return complete constraints
  return {
    minBendRadius,
    maxRunLength: MAX_RUN_LENGTH_BEFORE_JUNCTION,
    supportSpacing,
    clearance: CONDUIT_CLEARANCE,
  };
}

/**
 * Get conduit dimensions
 * Convenience function for geometry generators (Agent 6)
 * 
 * @param size - Conduit size
 * @returns Conduit size specification
 */
export function getConduitDimensions(size: string): ConduitSize {
  const conduitSize = CONDUIT_SIZES[size];
  if (!conduitSize) {
    throw new Error(`Unknown conduit size: ${size}`);
  }
  return conduitSize;
}

/**
 * Get conduit type specifications
 * Used by geometry generators for bend radius and visual appearance
 * 
 * @param conduitType - Conduit type
 * @returns Type specification with bend radius and properties
 */
export function getConduitTypeSpec(conduitType: ConduitType): ConduitTypeSpec {
  const typeSpec = CONDUIT_TYPES[conduitType];
  if (!typeSpec) {
    throw new Error(`Unknown conduit type: ${conduitType}`);
  }
  return typeSpec;
}

/**
 * Get conduit material specifications
 * Used for material properties and environment suitability
 * 
 * @param material - Conduit material
 * @returns Material specification
 */
export function getConduitMaterialSpec(material: ConduitMaterial): ConduitMaterialSpec {
  const materialSpec = CONDUIT_MATERIALS[material];
  if (!materialSpec) {
    throw new Error(`Unknown conduit material: ${material}`);
  }
  return materialSpec;
}

/**
 * Calculate recommended conduit size for wire fill
 * Based on NEC 40% fill rule (Chapter 9, Table 4)
 * 
 * @param wireCount - Number of wires
 * @param wireGauge - Wire gauge (e.g., "14 AWG", "12 AWG")
 * @returns Recommended conduit size
 */
export function recommendConduitSize(wireCount: number, wireGauge: '14 AWG' | '12 AWG'): string {
  const fillProperty = wireGauge === '14 AWG' ? 'maxWires14AWG' : 'maxWires12AWG';
  
  // Find smallest conduit that can accommodate the wires
  const sizes = Object.entries(CONDUIT_SIZES);
  for (const [size, spec] of sizes) {
    if (spec[fillProperty] >= wireCount) {
      return size;
    }
  }
  
  // If no conduit is large enough, return the largest
  return '4"';
}

/**
 * Get all available conduit sizes
 * Used for UI dropdowns and validation
 */
export function getAvailableConduitSizes(): string[] {
  return Object.keys(CONDUIT_SIZES);
}

/**
 * Get all available conduit types
 * Used for UI dropdowns and validation
 */
export function getAvailableConduitTypes(): ConduitType[] {
  return Object.keys(CONDUIT_TYPES) as ConduitType[];
}

/**
 * Get all available conduit materials
 * Used for UI dropdowns and validation
 */
export function getAvailableConduitMaterials(): ConduitMaterial[] {
  return Object.keys(CONDUIT_MATERIALS) as ConduitMaterial[];
}

/**
 * Validate if a conduit size exists
 */
export function isValidConduitSize(size: string): boolean {
  return size in CONDUIT_SIZES;
}

/**
 * Validate if a conduit type exists
 */
export function isValidConduitType(conduitType: string): conduitType is ConduitType {
  return conduitType in CONDUIT_TYPES;
}

/**
 * Validate if a conduit material exists
 */
export function isValidConduitMaterial(material: string): material is ConduitMaterial {
  return material in CONDUIT_MATERIALS;
}
