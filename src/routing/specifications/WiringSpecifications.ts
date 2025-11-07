// Wiring Specifications - Sizing, materials, and constraint rules for electrical wiring
// Owner: Agent 3 (Specifications & Technical Spec Lead)

import { RouteConstraints, ClearanceRequirements } from '../core/types';

/**
 * Wire gauge to metric conversion table
 * Reference: American Wire Gauge (AWG) standard
 */
export const AWG_TO_METRIC: Record<string, { mm2: number; diameter: number; maxCurrent: number }> = {
  '18 AWG': { mm2: 0.75, diameter: 0.001, maxCurrent: 10 },    // 1mm diameter, 10A
  '16 AWG': { mm2: 1.5, diameter: 0.0015, maxCurrent: 13 },    // 1.5mm, 13A
  '14 AWG': { mm2: 2.5, diameter: 0.0025, maxCurrent: 15 },    // 2.5mm, 15A
  '12 AWG': { mm2: 4.0, diameter: 0.004, maxCurrent: 20 },     // 4mm, 20A
  '10 AWG': { mm2: 6.0, diameter: 0.006, maxCurrent: 30 },     // 6mm, 30A
  '8 AWG': { mm2: 10.0, diameter: 0.01, maxCurrent: 40 },      // 10mm, 40A
  '6 AWG': { mm2: 16.0, diameter: 0.016, maxCurrent: 55 },     // 16mm, 55A
  '4 AWG': { mm2: 25.0, diameter: 0.025, maxCurrent: 70 },     // 25mm, 70A
  '2 AWG': { mm2: 35.0, diameter: 0.035, maxCurrent: 95 },     // 35mm, 95A
  '1 AWG': { mm2: 50.0, diameter: 0.050, maxCurrent: 110 },    // 50mm, 110A
  '1/0 AWG': { mm2: 55.0, diameter: 0.055, maxCurrent: 125 },  // 55mm, 125A
  '2/0 AWG': { mm2: 70.0, diameter: 0.070, maxCurrent: 145 },  // 70mm, 145A
  '3/0 AWG': { mm2: 85.0, diameter: 0.085, maxCurrent: 165 },  // 85mm, 165A
  '4/0 AWG': { mm2: 107.0, diameter: 0.107, maxCurrent: 195 }, // 107mm, 195A
};

/**
 * Wire bundle types
 */
export type WireBundleType = 'single' | 'twisted-pair' | 'multi-core' | 'ribbon' | 'shielded';

/**
 * Wire insulation types
 */
export type WireInsulationType = 'PVC' | 'XLPE' | 'rubber' | 'Teflon' | 'silicone';

/**
 * Electrical wire specification
 */
export interface ElectricalWireSpec {
  gauge: string;           // e.g., "14 AWG"
  coreCount: number;       // Number of conductors
  bundleType: WireBundleType;
  insulationType: WireInsulationType;
  voltage: number;         // Voltage rating (V)
  current: number;         // Current rating (A)
  outerDiameter: number;   // Overall cable diameter (meters)
  color: string;           // Hex color for visualization
}

/**
 * Insulation material specifications
 */
export interface InsulationMaterialSpec {
  name: WireInsulationType;
  maxTemperature: number;  // °C
  flexibilityRating: 'rigid' | 'flexible' | 'extra-flexible';
  bendRadiusMultiplier: number; // Multiplier × cable diameter for minimum bend radius
  color: string;
}

/**
 * Insulation material database
 */
export const WIRE_INSULATION_MATERIALS: Record<WireInsulationType, InsulationMaterialSpec> = {
  PVC: {
    name: 'PVC',
    maxTemperature: 70,
    flexibilityRating: 'flexible',
    bendRadiusMultiplier: 6.0,
    color: '#000000', // Black
  },
  XLPE: {
    name: 'XLPE',
    maxTemperature: 90,
    flexibilityRating: 'flexible',
    bendRadiusMultiplier: 5.0,
    color: '#404040', // Dark gray
  },
  rubber: {
    name: 'rubber',
    maxTemperature: 80,
    flexibilityRating: 'extra-flexible',
    bendRadiusMultiplier: 4.0,
    color: '#1C1C1C', // Very dark gray
  },
  Teflon: {
    name: 'Teflon',
    maxTemperature: 200,
    flexibilityRating: 'flexible',
    bendRadiusMultiplier: 6.0,
    color: '#FFFFFF', // White
  },
  silicone: {
    name: 'silicone',
    maxTemperature: 180,
    flexibilityRating: 'extra-flexible',
    bendRadiusMultiplier: 3.0,
    color: '#FF4444', // Red
  },
};

/**
 * Voltage-based color coding standards
 * Reference: NEC (National Electrical Code) and IEC standards
 */
export const VOLTAGE_COLOR_CODING: Record<string, string> = {
  // Low voltage (< 50V)
  'LV': '#00FF00',          // Green
  // 120V AC (North America)
  '120V': '#FFFF00',        // Yellow
  // 208V AC
  '208V': '#FFA500',        // Orange
  // 240V AC
  '240V': '#FF8C00',        // Dark orange
  // 277V AC
  '277V': '#FF6600',        // Orange-red
  // 480V AC (3-phase)
  '480V': '#FF0000',        // Red
  // 600V+ (High voltage)
  'HV': '#8B0000',          // Dark red
};

/**
 * Calculate cable bundle outer diameter from wire specifications
 * 
 * @param gauge - Wire gauge (e.g., "14 AWG")
 * @param coreCount - Number of conductors in bundle
 * @param insulationType - Type of insulation
 * @returns Calculated outer diameter in meters
 */
export function calculateCableDiameter(
  gauge: string,
  coreCount: number,
  _insulationType: WireInsulationType
): number {
  // Look up wire diameter
  const wireSpec = AWG_TO_METRIC[gauge];
  if (!wireSpec) {
    throw new Error(`Unknown wire gauge: ${gauge}`);
  }

  const singleWireDiameter = wireSpec.diameter;

  // Calculate bundle diameter using circle packing formula
  // For N wires: outer diameter ≈ (√N + 1) × wire diameter
  const bundleFactor = Math.sqrt(coreCount) + 1;
  const calculatedDiameter = bundleFactor * singleWireDiameter;

  // Add insulation thickness (typically 20-30% of wire diameter)
  const insulationThickness = singleWireDiameter * 0.25;

  return calculatedDiameter + (insulationThickness * 2);
}

/**
 * Get color for voltage level
 * 
 * @param voltage - Voltage in volts
 * @returns Hex color code for visualization
 */
export function getColorForVoltage(voltage: number): string {
  if (voltage < 50) return VOLTAGE_COLOR_CODING['LV'];
  if (voltage <= 120) return VOLTAGE_COLOR_CODING['120V'];
  if (voltage <= 208) return VOLTAGE_COLOR_CODING['208V'];
  if (voltage <= 240) return VOLTAGE_COLOR_CODING['240V'];
  if (voltage <= 277) return VOLTAGE_COLOR_CODING['277V'];
  if (voltage <= 480) return VOLTAGE_COLOR_CODING['480V'];
  return VOLTAGE_COLOR_CODING['HV'];
}

/**
 * Standard clearance requirements for electrical wiring
 */
export const WIRING_CLEARANCE: ClearanceRequirements = {
  walls: 0.05,              // 2 inches (50mm)
  ceiling: 0.05,            // 2 inches (50mm)
  floor: 0.2,               // 8 inches (200mm) - avoid foot traffic
  otherInfrastructure: 0.1, // 4 inches (100mm)
};

/**
 * High voltage clearance requirements (> 480V)
 */
export const HIGH_VOLTAGE_CLEARANCE: ClearanceRequirements = {
  walls: 0.15,              // 6 inches (150mm)
  ceiling: 0.15,            // 6 inches (150mm)
  floor: 0.3,               // 12 inches (300mm)
  otherInfrastructure: 0.3, // 12 inches (300mm)
};

/**
 * Support spacing for cables based on weight
 * Generally cables need support every 4.5 feet (1.37m) for horizontal runs
 */
export const CABLE_SUPPORT_SPACING = 1.37; // 4.5 feet

/**
 * Get constraint rules for an electrical cable route
 * This is the main API that other agents (Agent 2, Agent 6) will use
 * 
 * @param gauge - Wire gauge (e.g., "14 AWG")
 * @param coreCount - Number of conductors
 * @param voltage - Voltage rating (V)
 * @param insulationType - Insulation material
 * @returns RouteConstraints object with all constraint values
 * 
 * @example
 * ```typescript
 * const rules = getCableConstraintRules('14 AWG', 3, 120, 'PVC');
 * // Returns:
 * // {
 * //   minBendRadius: 0.048,  // 6x cable diameter for PVC
 * //   supportSpacing: 1.37,  // 4.5 feet
 * //   clearance: { walls: 0.05, ceiling: 0.05, floor: 0.2, otherInfrastructure: 0.1 }
 * // }
 * ```
 */
export function getCableConstraintRules(
  gauge: string,
  coreCount: number,
  voltage: number,
  insulationType: WireInsulationType
): RouteConstraints {
  // Look up wire specifications
  const wireSpec = AWG_TO_METRIC[gauge];
  if (!wireSpec) {
    throw new Error(`Unknown wire gauge: ${gauge}`);
  }

  // Look up insulation properties
  const insulationSpec = WIRE_INSULATION_MATERIALS[insulationType];
  if (!insulationSpec) {
    throw new Error(`Unknown insulation type: ${insulationType}`);
  }

  // Calculate cable diameter
  const cableDiameter = calculateCableDiameter(gauge, coreCount, insulationType);

  // Calculate minimum bend radius: insulation multiplier × cable diameter
  const minBendRadius = insulationSpec.bendRadiusMultiplier * cableDiameter;

  // Use high voltage clearance for voltages above 480V
  const clearance = voltage > 480 ? HIGH_VOLTAGE_CLEARANCE : WIRING_CLEARANCE;

  // Return complete constraints
  return {
    minBendRadius,
    supportSpacing: CABLE_SUPPORT_SPACING,
    clearance,
  };
}

/**
 * Get wire specifications from gauge
 * 
 * @param gauge - Wire gauge (e.g., "14 AWG")
 * @returns Wire specifications with diameter and current rating
 */
export function getWireSpec(gauge: string): { mm2: number; diameter: number; maxCurrent: number } {
  const wireSpec = AWG_TO_METRIC[gauge];
  if (!wireSpec) {
    throw new Error(`Unknown wire gauge: ${gauge}`);
  }
  return wireSpec;
}

/**
 * Get insulation material specifications
 * 
 * @param insulationType - Insulation material type
 * @returns Insulation specifications
 */
export function getInsulationSpec(insulationType: WireInsulationType): InsulationMaterialSpec {
  const insulationSpec = WIRE_INSULATION_MATERIALS[insulationType];
  if (!insulationSpec) {
    throw new Error(`Unknown insulation type: ${insulationType}`);
  }
  return insulationSpec;
}

/**
 * Get all available wire gauges
 * Used for UI dropdowns and validation
 */
export function getAvailableWireGauges(): string[] {
  return Object.keys(AWG_TO_METRIC);
}

/**
 * Get all available insulation types
 * Used for UI dropdowns and validation
 */
export function getAvailableInsulationTypes(): WireInsulationType[] {
  return Object.keys(WIRE_INSULATION_MATERIALS) as WireInsulationType[];
}

/**
 * Get all available bundle types
 * Used for UI dropdowns and validation
 */
export function getAvailableBundleTypes(): WireBundleType[] {
  return ['single', 'twisted-pair', 'multi-core', 'ribbon', 'shielded'];
}

/**
 * Validate if a wire gauge exists
 */
export function isValidWireGauge(gauge: string): boolean {
  return gauge in AWG_TO_METRIC;
}

/**
 * Validate if an insulation type exists
 */
export function isValidInsulationType(insulationType: string): insulationType is WireInsulationType {
  return insulationType in WIRE_INSULATION_MATERIALS;
}

/**
 * Recommend wire gauge for current requirement
 * 
 * @param requiredCurrent - Required current capacity (A)
 * @returns Recommended wire gauge
 */
export function recommendWireGauge(requiredCurrent: number): string {
  const gauges = Object.entries(AWG_TO_METRIC);
  
  // Find smallest gauge that can handle the current
  for (const [gauge, spec] of gauges) {
    if (spec.maxCurrent >= requiredCurrent) {
      return gauge;
    }
  }
  
  // If no gauge is sufficient, return the largest
  return '4/0 AWG';
}
