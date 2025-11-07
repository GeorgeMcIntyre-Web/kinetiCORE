// Cable Tray Specifications - Sizing, materials, and constraint rules for cable trays
// Owner: Agent 3 (Specifications & Technical Spec Lead)

import { RouteConstraints, ClearanceRequirements } from '../core/types';

/**
 * Cable tray types
 */
export type CableTrayType = 'ladder' | 'solid-bottom' | 'ventilated' | 'wire-mesh';

/**
 * Cable tray material types
 */
export type CableTrayMaterial = 'galvanized-steel' | 'aluminum' | 'stainless' | 'fiberglass';

/**
 * Cable tray size specification
 */
export interface CableTraySize {
  width: number;      // meters
  height: number;     // meters
  loadRating: number; // kg/m
}

/**
 * Standard cable tray sizes
 * Reference: NEMA VE-1 and IEC 61537 standards
 */
export const CABLE_TRAY_SIZES: Record<string, CableTraySize> = {
  '4"x2"': { width: 0.1, height: 0.05, loadRating: 30 },      // 100mm × 50mm
  '6"x2"': { width: 0.15, height: 0.05, loadRating: 40 },     // 150mm × 50mm
  '6"x3"': { width: 0.15, height: 0.075, loadRating: 50 },    // 150mm × 75mm
  '8"x3"': { width: 0.2, height: 0.075, loadRating: 60 },     // 200mm × 75mm
  '12"x3"': { width: 0.3, height: 0.075, loadRating: 75 },    // 300mm × 75mm
  '12"x4"': { width: 0.3, height: 0.1, loadRating: 85 },      // 300mm × 100mm
  '16"x4"': { width: 0.4, height: 0.1, loadRating: 100 },     // 400mm × 100mm
  '18"x4"': { width: 0.45, height: 0.1, loadRating: 110 },    // 450mm × 100mm
  '24"x4"': { width: 0.6, height: 0.1, loadRating: 125 },     // 600mm × 100mm
  '24"x6"': { width: 0.6, height: 0.15, loadRating: 150 },    // 600mm × 150mm
  '30"x6"': { width: 0.75, height: 0.15, loadRating: 175 },   // 750mm × 150mm
  '36"x6"': { width: 0.9, height: 0.15, loadRating: 200 },    // 900mm × 150mm
};

/**
 * Material specifications
 */
export interface CableTrayMaterialSpec {
  name: CableTrayMaterial;
  color: string;           // Hex color for visualization
  bendRadiusMultiplier: number;  // Multiplier × width for minimum bend radius
  maxTemperature: number;  // °C
  corrosionResistance: 'low' | 'medium' | 'high';
}

/**
 * Material database
 */
export const CABLE_TRAY_MATERIALS: Record<CableTrayMaterial, CableTrayMaterialSpec> = {
  'galvanized-steel': {
    name: 'galvanized-steel',
    color: '#909090',      // Gray
    bendRadiusMultiplier: 1.5,
    maxTemperature: 200,
    corrosionResistance: 'medium',
  },
  aluminum: {
    name: 'aluminum',
    color: '#C0C0C0',      // Silver
    bendRadiusMultiplier: 2.0,
    maxTemperature: 150,
    corrosionResistance: 'high',
  },
  stainless: {
    name: 'stainless',
    color: '#B8B8B8',      // Light gray
    bendRadiusMultiplier: 1.5,
    maxTemperature: 300,
    corrosionResistance: 'high',
  },
  fiberglass: {
    name: 'fiberglass',
    color: '#FFFACD',      // Light yellow
    bendRadiusMultiplier: 2.5,
    maxTemperature: 120,
    corrosionResistance: 'high',
  },
};

/**
 * Cable tray type specifications
 */
export interface CableTrayTypeSpec {
  type: CableTrayType;
  description: string;
  rungSpacing?: number;    // For ladder type (meters)
  ventilationPercentage?: number; // For ventilated type
}

/**
 * Cable tray type database
 */
export const CABLE_TRAY_TYPES: Record<CableTrayType, CableTrayTypeSpec> = {
  ladder: {
    type: 'ladder',
    description: 'Ladder-style with rungs',
    rungSpacing: 0.15,  // 150mm typical
  },
  'solid-bottom': {
    type: 'solid-bottom',
    description: 'Solid bottom with no ventilation',
  },
  ventilated: {
    type: 'ventilated',
    description: 'Ventilated bottom with holes',
    ventilationPercentage: 40, // 40% open area
  },
  'wire-mesh': {
    type: 'wire-mesh',
    description: 'Wire mesh construction',
    ventilationPercentage: 70, // 70% open area
  },
};

/**
 * Support spacing rules by cable tray width
 * Reference: NEMA VE-1 standard
 */
export const CABLE_TRAY_SUPPORT_SPACING: Record<string, number> = {
  '4"x2"': 3.05,    // 10 feet
  '6"x2"': 3.05,    // 10 feet
  '6"x3"': 3.66,    // 12 feet
  '8"x3"': 3.66,    // 12 feet
  '12"x3"': 3.66,   // 12 feet
  '12"x4"': 3.66,   // 12 feet
  '16"x4"': 3.66,   // 12 feet
  '18"x4"': 3.66,   // 12 feet
  '24"x4"': 3.66,   // 12 feet
  '24"x6"': 3.66,   // 12 feet
  '30"x6"': 3.05,   // 10 feet (heavier loads)
  '36"x6"': 3.05,   // 10 feet (heavier loads)
};

/**
 * Standard clearance requirements for cable trays
 */
export const CABLE_TRAY_CLEARANCE: ClearanceRequirements = {
  walls: 0.05,              // 2 inches (50mm)
  ceiling: 0.075,           // 3 inches (75mm) - more clearance for cable access
  floor: 0.3,               // 12 inches (300mm) - avoid floor obstructions
  otherInfrastructure: 0.1, // 4 inches (100mm)
};

/**
 * Get constraint rules for a cable tray route
 * This is the main API that other agents (Agent 2, Agent 5) will use
 * 
 * @param size - Cable tray size (e.g., "12\"x4\"", "24\"x6\"")
 * @param material - Cable tray material (e.g., "aluminum", "galvanized-steel")
 * @param trayType - Cable tray type (e.g., "ladder", "solid-bottom")
 * @returns RouteConstraints object with all constraint values
 * 
 * @example
 * ```typescript
 * const rules = getCableTrayConstraintRules('12"x4"', 'aluminum', 'ladder');
 * // Returns:
 * // {
 * //   minBendRadius: 0.6,    // 2x width for aluminum
 * //   supportSpacing: 3.66,  // 12 feet for 12" tray
 * //   clearance: { walls: 0.05, ceiling: 0.075, floor: 0.3, otherInfrastructure: 0.1 }
 * // }
 * ```
 */
export function getCableTrayConstraintRules(
  size: string,
  material: CableTrayMaterial,
  _trayType: CableTrayType
): RouteConstraints {
  // Look up tray dimensions
  const traySize = CABLE_TRAY_SIZES[size];
  if (!traySize) {
    throw new Error(`Unknown cable tray size: ${size}`);
  }

  // Look up material properties
  const materialSpec = CABLE_TRAY_MATERIALS[material];
  if (!materialSpec) {
    throw new Error(`Unknown cable tray material: ${material}`);
  }

  // Calculate minimum bend radius: material multiplier × tray width
  const minBendRadius = materialSpec.bendRadiusMultiplier * traySize.width;

  // Look up support spacing
  const supportSpacing = CABLE_TRAY_SUPPORT_SPACING[size] || 3.66; // Default 12 feet

  // Return complete constraints
  return {
    minBendRadius,
    supportSpacing,
    clearance: CABLE_TRAY_CLEARANCE,
  };
}

/**
 * Get cable tray dimensions
 * Convenience function for geometry generators (Agent 5)
 * 
 * @param size - Cable tray size
 * @returns Tray size specification
 */
export function getCableTrayDimensions(size: string): CableTraySize {
  const traySize = CABLE_TRAY_SIZES[size];
  if (!traySize) {
    throw new Error(`Unknown cable tray size: ${size}`);
  }
  return traySize;
}

/**
 * Get material visual properties
 * Used by geometry generators for material application
 * 
 * @param material - Cable tray material
 * @returns Material specification with color and properties
 */
export function getCableTrayMaterialSpec(material: CableTrayMaterial): CableTrayMaterialSpec {
  const materialSpec = CABLE_TRAY_MATERIALS[material];
  if (!materialSpec) {
    throw new Error(`Unknown cable tray material: ${material}`);
  }
  return materialSpec;
}

/**
 * Get cable tray type specifications
 * Used by geometry generators for tray construction details
 * 
 * @param trayType - Cable tray type
 * @returns Type specification with construction details
 */
export function getCableTrayTypeSpec(trayType: CableTrayType): CableTrayTypeSpec {
  return CABLE_TRAY_TYPES[trayType];
}

/**
 * Get all available cable tray sizes
 * Used for UI dropdowns and validation
 */
export function getAvailableCableTraySizes(): string[] {
  return Object.keys(CABLE_TRAY_SIZES);
}

/**
 * Get all available cable tray materials
 * Used for UI dropdowns and validation
 */
export function getAvailableCableTrayMaterials(): CableTrayMaterial[] {
  return Object.keys(CABLE_TRAY_MATERIALS) as CableTrayMaterial[];
}

/**
 * Get all available cable tray types
 * Used for UI dropdowns and validation
 */
export function getAvailableCableTrayTypes(): CableTrayType[] {
  return Object.keys(CABLE_TRAY_TYPES) as CableTrayType[];
}

/**
 * Validate if a cable tray size exists
 */
export function isValidCableTraySize(size: string): boolean {
  return size in CABLE_TRAY_SIZES;
}

/**
 * Validate if a cable tray material exists
 */
export function isValidCableTrayMaterial(material: string): material is CableTrayMaterial {
  return material in CABLE_TRAY_MATERIALS;
}

/**
 * Validate if a cable tray type exists
 */
export function isValidCableTrayType(trayType: string): trayType is CableTrayType {
  return trayType in CABLE_TRAY_TYPES;
}
