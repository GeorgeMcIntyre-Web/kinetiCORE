// Route Specifications - Physical properties and sizing for route types
// Owner: Routing System Team

/**
 * Connector/Plug Types for Electrical
 */
export type ConnectorType =
  | 'NEMA-5-15' // Standard US 120V 15A
  | 'NEMA-5-20' // US 120V 20A
  | 'NEMA-6-20' // US 240V 20A
  | 'IEC-C13' // Computer equipment
  | 'IEC-C19' // High current equipment
  | 'CEE-7/16' // European 2-pin
  | 'BS-1363' // UK 3-pin
  | 'terminal-block' // Industrial screw terminals
  | 'quick-disconnect' // Industrial quick disconnect
  | 'ring-terminal' // Ring/spade terminals
  | 'hardwired' // Direct connection (no plug)
  | 'custom'; // Custom connector

export interface ConnectorSpec {
  type: ConnectorType;
  rating: { voltage: number; current: number }; // Max V/A
  pinCount: number;
  gender: 'male' | 'female' | 'neutral';
  length: number; // Connector length in meters (for pre-order calculation)
  partNumber?: string; // Manufacturer part number
}

/**
 * Electrical/Cable Specifications
 */
export interface ElectricalSpec {
  // Wire properties
  coreCount: number; // Number of conductors (1, 2, 3, 4, etc.)
  wireGauge: string; // AWG or mm² (e.g., "14 AWG", "2.5mm²")
  wireDiameter: number; // Diameter in meters (calculated from gauge)

  // Bundle properties
  bundleType: 'single' | 'twisted-pair' | 'multi-core' | 'ribbon';
  insulationType: 'PVC' | 'XLPE' | 'rubber' | 'Teflon';
  outerDiameter: number; // Overall cable diameter in meters

  // Electrical properties
  voltage: number; // Voltage rating (V)
  current: number; // Current rating (A)
  ampacity: number; // Maximum current capacity (A)

  // Connector properties
  connectorA: ConnectorSpec; // End A connector/plug
  connectorB: ConnectorSpec; // End B connector/plug
  preOrderLength?: number; // Pre-calculated total length (meters) for ordering

  // Visual properties
  color: 'yellow' | 'copper' | 'silver' | 'black';
  shielded: boolean; // EMI/RFI shielding
}

/**
 * Pipe/Fluid Specifications
 */
export interface PipeSpec {
  // Pipe sizing
  nominalSize: string; // Nominal pipe size (e.g., "1/2\"", "DN20", "25mm")
  outerDiameter: number; // OD in meters
  innerDiameter: number; // ID in meters (for flow calculations)
  wallThickness: number; // Wall thickness in meters

  // Material properties
  material: 'steel' | 'copper' | 'PVC' | 'stainless' | 'aluminum';
  schedule: string; // Pipe schedule (e.g., "40", "80", "XXS")
  pressureRating: number; // Max pressure (PSI or bar)

  // Fluid properties
  fluidType: 'water' | 'oil' | 'gas' | 'steam' | 'compressed-air' | 'chemical';
  temperature: number; // Operating temperature (°C)
  flowRate: number; // Flow rate (L/min or GPM)
  viscosity: number; // Fluid viscosity (cP)

  // Visual properties
  color: 'blue' | 'gray' | 'copper' | 'white' | 'yellow';
  insulated: boolean; // Thermal insulation
}

/**
 * Cable Tray Specifications
 */
export interface CableTraySpec {
  // Tray sizing
  width: number; // Tray width in meters (standard: 100, 150, 200, 300, 400, 600mm)
  height: number; // Tray side height in meters (standard: 50, 75, 100mm)

  // Type
  trayType: 'ladder' | 'solid-bottom' | 'ventilated' | 'wire-mesh';
  rungSpacing: number; // Spacing between rungs for ladder type (meters)

  // Material
  material: 'galvanized-steel' | 'aluminum' | 'stainless' | 'fiberglass';
  finish: 'powder-coated' | 'hot-dip-galvanized' | 'electro-galvanized';

  // Load capacity
  loadRating: number; // Max cable weight (kg/m)
  maxCables: number; // Maximum number of cables

  // Visual properties
  color: 'orange' | 'silver' | 'yellow' | 'white';
}

/**
 * Conduit Specifications
 */
export interface ConduitSpec {
  // Conduit sizing
  nominalSize: string; // Conduit trade size (e.g., "3/4\"", "20mm")
  outerDiameter: number; // OD in meters
  innerDiameter: number; // ID in meters

  // Type
  conduitType: 'EMT' | 'IMC' | 'rigid' | 'PVC' | 'flexible' | 'liquidtight';
  material: 'steel' | 'aluminum' | 'PVC' | 'fiberglass';

  // Properties
  wallThickness: number; // Wall thickness in meters
  bendRadius: number; // Minimum bend radius (meters)

  // Fill capacity
  maxWires: number; // Maximum number of wires (40% fill rule)
  fillPercentage: number; // Current fill percentage

  // Visual properties
  color: 'green' | 'gray' | 'orange' | 'black';
  threaded: boolean; // Threaded or plain ends
}

/**
 * Default connector specifications
 */
export const DEFAULT_CONNECTOR_NEMA_5_15: ConnectorSpec = {
  type: 'NEMA-5-15',
  rating: { voltage: 125, current: 15 },
  pinCount: 3,
  gender: 'male',
  length: 0.05, // 50mm connector length
  partNumber: 'NEMA-5-15P',
};

export const DEFAULT_CONNECTOR_IEC_C13: ConnectorSpec = {
  type: 'IEC-C13',
  rating: { voltage: 250, current: 10 },
  pinCount: 3,
  gender: 'female',
  length: 0.04, // 40mm connector length
  partNumber: 'IEC-60320-C13',
};

/**
 * Connector database
 */
export const CONNECTOR_DATABASE: Record<ConnectorType, Omit<ConnectorSpec, 'partNumber'>> = {
  'NEMA-5-15': { type: 'NEMA-5-15', rating: { voltage: 125, current: 15 }, pinCount: 3, gender: 'male', length: 0.05 },
  'NEMA-5-20': { type: 'NEMA-5-20', rating: { voltage: 125, current: 20 }, pinCount: 3, gender: 'male', length: 0.055 },
  'NEMA-6-20': { type: 'NEMA-6-20', rating: { voltage: 250, current: 20 }, pinCount: 3, gender: 'male', length: 0.055 },
  'IEC-C13': { type: 'IEC-C13', rating: { voltage: 250, current: 10 }, pinCount: 3, gender: 'female', length: 0.04 },
  'IEC-C19': { type: 'IEC-C19', rating: { voltage: 250, current: 16 }, pinCount: 3, gender: 'female', length: 0.045 },
  'CEE-7/16': { type: 'CEE-7/16', rating: { voltage: 250, current: 6 }, pinCount: 2, gender: 'male', length: 0.04 },
  'BS-1363': { type: 'BS-1363', rating: { voltage: 230, current: 13 }, pinCount: 3, gender: 'male', length: 0.05 },
  'terminal-block': { type: 'terminal-block', rating: { voltage: 600, current: 30 }, pinCount: 0, gender: 'neutral', length: 0.02 },
  'quick-disconnect': { type: 'quick-disconnect', rating: { voltage: 600, current: 30 }, pinCount: 2, gender: 'neutral', length: 0.03 },
  'ring-terminal': { type: 'ring-terminal', rating: { voltage: 600, current: 50 }, pinCount: 1, gender: 'neutral', length: 0.015 },
  'hardwired': { type: 'hardwired', rating: { voltage: 600, current: 100 }, pinCount: 0, gender: 'neutral', length: 0 },
  'custom': { type: 'custom', rating: { voltage: 0, current: 0 }, pinCount: 0, gender: 'neutral', length: 0.05 },
};

/**
 * Default specifications for each route type
 */
export const DEFAULT_ELECTRICAL_SPEC: ElectricalSpec = {
  coreCount: 3,
  wireGauge: '14 AWG', // ~2.5mm²
  wireDiameter: 0.0025, // 2.5mm
  bundleType: 'multi-core',
  insulationType: 'PVC',
  outerDiameter: 0.008, // 8mm overall
  voltage: 120,
  current: 15,
  ampacity: 15,
  connectorA: DEFAULT_CONNECTOR_NEMA_5_15,
  connectorB: { ...DEFAULT_CONNECTOR_IEC_C13, gender: 'male' }, // Mate to IEC-C13
  preOrderLength: undefined, // Calculated from route
  color: 'yellow',
  shielded: false,
};

export const DEFAULT_PIPE_SPEC: PipeSpec = {
  nominalSize: '1/2"',
  outerDiameter: 0.021, // 21mm (DN15)
  innerDiameter: 0.016, // 16mm
  wallThickness: 0.0025, // 2.5mm
  material: 'steel',
  schedule: '40',
  pressureRating: 1000, // PSI
  fluidType: 'water',
  temperature: 20, // °C
  flowRate: 10, // L/min
  viscosity: 1.0, // Water at 20°C
  color: 'blue',
  insulated: false,
};

export const DEFAULT_CABLE_TRAY_SPEC: CableTraySpec = {
  width: 0.3, // 300mm
  height: 0.075, // 75mm
  trayType: 'ladder',
  rungSpacing: 0.15, // 150mm
  material: 'galvanized-steel',
  finish: 'hot-dip-galvanized',
  loadRating: 50, // kg/m
  maxCables: 20,
  color: 'orange',
};

export const DEFAULT_CONDUIT_SPEC: ConduitSpec = {
  nominalSize: '3/4"',
  outerDiameter: 0.023, // 23mm
  innerDiameter: 0.02, // 20mm
  conduitType: 'EMT',
  material: 'steel',
  wallThickness: 0.0015, // 1.5mm
  bendRadius: 0.12, // 120mm (6x diameter)
  maxWires: 4, // For 14 AWG
  fillPercentage: 0,
  color: 'green',
  threaded: false,
};

/**
 * Wire gauge tables (AWG to metric conversion)
 */
export const AWG_TO_METRIC: Record<string, { mm2: number; diameter: number }> = {
  '18 AWG': { mm2: 0.75, diameter: 0.001 }, // 1mm
  '16 AWG': { mm2: 1.5, diameter: 0.0015 }, // 1.5mm
  '14 AWG': { mm2: 2.5, diameter: 0.0025 }, // 2.5mm
  '12 AWG': { mm2: 4.0, diameter: 0.004 }, // 4mm
  '10 AWG': { mm2: 6.0, diameter: 0.006 }, // 6mm
  '8 AWG': { mm2: 10.0, diameter: 0.01 }, // 10mm
  '6 AWG': { mm2: 16.0, diameter: 0.016 }, // 16mm
  '4 AWG': { mm2: 25.0, diameter: 0.025 }, // 25mm
};

/**
 * Pipe size tables (Nominal to actual dimensions)
 */
export const PIPE_SIZES: Record<string, { od: number; id: number }> = {
  '1/4"': { od: 0.0135, id: 0.009 }, // DN6
  '3/8"': { od: 0.017, id: 0.012 }, // DN10
  '1/2"': { od: 0.021, id: 0.016 }, // DN15
  '3/4"': { od: 0.027, id: 0.021 }, // DN20
  '1"': { od: 0.033, id: 0.027 }, // DN25
  '1-1/4"': { od: 0.042, id: 0.036 }, // DN32
  '1-1/2"': { od: 0.048, id: 0.041 }, // DN40
  '2"': { od: 0.060, id: 0.053 }, // DN50
  '2-1/2"': { od: 0.073, id: 0.063 }, // DN65
  '3"': { od: 0.089, id: 0.078 }, // DN80
  '4"': { od: 0.114, id: 0.102 }, // DN100
};

/**
 * Fluid properties database
 */
export interface FluidProperties {
  density: number; // kg/m³
  viscosity: number; // cP (centipoise)
  specificHeat: number; // kJ/kg·K
  color: string; // Hex color for visualization
}

export const FLUID_PROPERTIES: Record<string, FluidProperties> = {
  water: {
    density: 1000,
    viscosity: 1.0,
    specificHeat: 4.18,
    color: '#00D9FF', // Blue
  },
  oil: {
    density: 900,
    viscosity: 50,
    specificHeat: 2.0,
    color: '#8B4513', // Brown
  },
  gas: {
    density: 0.8,
    viscosity: 0.01,
    specificHeat: 1.0,
    color: '#FFFF00', // Yellow
  },
  steam: {
    density: 0.6,
    viscosity: 0.015,
    specificHeat: 2.0,
    color: '#FFFFFF', // White
  },
  'compressed-air': {
    density: 1.2,
    viscosity: 0.018,
    specificHeat: 1.0,
    color: '#87CEEB', // Sky blue
  },
  chemical: {
    density: 1200,
    viscosity: 10,
    specificHeat: 2.5,
    color: '#FF00FF', // Magenta (warning)
  },
};

/**
 * Calculate cable bundle diameter from core count and wire gauge
 */
export function calculateCableDiameter(spec: ElectricalSpec): number {
  const singleWireDiameter = spec.wireDiameter;
  const coreCount = spec.coreCount;

  // Approximate bundle diameter using circle packing
  // For N wires: outer diameter ≈ (√N + 1) × wire diameter
  const bundleFactor = Math.sqrt(coreCount) + 1;
  const calculatedDiameter = bundleFactor * singleWireDiameter;

  // Add insulation thickness (typically 20-30% of wire diameter)
  const insulationThickness = singleWireDiameter * 0.25;

  return calculatedDiameter + (insulationThickness * 2);
}

/**
 * Calculate pipe flow velocity
 */
export function calculateFlowVelocity(spec: PipeSpec): number {
  // Q = A × v
  // v = Q / A
  const area = Math.PI * Math.pow(spec.innerDiameter / 2, 2); // m²
  const flowRateM3s = spec.flowRate / 60000; // L/min to m³/s

  return flowRateM3s / area; // m/s
}

/**
 * Validate pipe size for fluid and flow rate
 */
export function validatePipeSize(spec: PipeSpec): {
  valid: boolean;
  velocity: number;
  recommendation?: string;
} {
  const velocity = calculateFlowVelocity(spec);

  // Recommended velocities by fluid type (m/s)
  const maxVelocities: Record<string, number> = {
    water: 3.0,
    oil: 2.0,
    gas: 15.0,
    steam: 25.0,
    'compressed-air': 20.0,
    chemical: 1.5,
  };

  const maxVel = maxVelocities[spec.fluidType] || 2.0;

  if (velocity > maxVel) {
    return {
      valid: false,
      velocity,
      recommendation: `Velocity too high (${velocity.toFixed(2)} m/s). Increase pipe size.`,
    };
  }

  if (velocity < 0.5) {
    return {
      valid: true,
      velocity,
      recommendation: `Velocity low (${velocity.toFixed(2)} m/s). Consider smaller pipe.`,
    };
  }

  return { valid: true, velocity };
}

/**
 * Get recommended conduit size for wire bundle
 */
export function getRecommendedConduitSize(
  wireCount: number,
  wireGauge: string
): string {
  const wireDiameter = AWG_TO_METRIC[wireGauge]?.diameter || 0.0025;
  const wireArea = Math.PI * Math.pow(wireDiameter / 2, 2);
  const totalWireArea = wireArea * wireCount;

  // 40% fill rule for conduit
  const requiredConduitArea = totalWireArea / 0.4;
  const requiredConduitDiameter = Math.sqrt((requiredConduitArea * 4) / Math.PI);

  // Find smallest conduit that fits
  const conduitSizes = ['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"'];
  const conduitDiameters = [0.016, 0.020, 0.027, 0.036, 0.041, 0.053];

  for (let i = 0; i < conduitSizes.length; i++) {
    if (conduitDiameters[i] >= requiredConduitDiameter) {
      return conduitSizes[i];
    }
  }

  return '2"'; // Default to largest
}

/**
 * Calculate pre-order cable length including connectors and slack
 * @param routeLength - Measured route length in meters
 * @param connectorA - End A connector specification
 * @param connectorB - End B connector specification
 * @param slackPercentage - Additional slack percentage (default 10%)
 * @returns Total cable length to order in meters
 */
export function calculatePreOrderLength(
  routeLength: number,
  connectorA: ConnectorSpec,
  connectorB: ConnectorSpec,
  slackPercentage: number = 10
): { totalLength: number; breakdown: { route: number; connectors: number; slack: number } } {
  // Add connector lengths
  const connectorLength = connectorA.length + connectorB.length;

  // Add slack (typically 10% for routing flexibility, strain relief, termination)
  const slack = routeLength * (slackPercentage / 100);

  // Total length
  const totalLength = routeLength + connectorLength + slack;

  return {
    totalLength,
    breakdown: {
      route: routeLength,
      connectors: connectorLength,
      slack,
    },
  };
}

/**
 * Validate connector compatibility
 * @returns Compatibility status and any warnings
 */
export function validateConnectorPair(
  connectorA: ConnectorSpec,
  connectorB: ConnectorSpec,
  cableSpec: ElectricalSpec
): { compatible: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let compatible = true;

  // Check voltage rating
  if (
    connectorA.rating.voltage < cableSpec.voltage ||
    connectorB.rating.voltage < cableSpec.voltage
  ) {
    warnings.push(
      `Connector voltage rating (${Math.min(connectorA.rating.voltage, connectorB.rating.voltage)}V) below cable voltage (${cableSpec.voltage}V)`
    );
    compatible = false;
  }

  // Check current rating
  if (
    connectorA.rating.current < cableSpec.current ||
    connectorB.rating.current < cableSpec.current
  ) {
    warnings.push(
      `Connector current rating (${Math.min(connectorA.rating.current, connectorB.rating.current)}A) below cable current (${cableSpec.current}A)`
    );
    compatible = false;
  }

  // Check gender compatibility (male should mate with female)
  if (
    connectorA.gender === connectorB.gender &&
    connectorA.gender !== 'neutral' &&
    connectorB.gender !== 'neutral'
  ) {
    warnings.push(`Both connectors have same gender (${connectorA.gender}). May need adapter.`);
  }

  // Check pin count vs core count
  if (connectorA.pinCount > 0 && connectorA.pinCount < cableSpec.coreCount) {
    warnings.push(
      `Connector A has fewer pins (${connectorA.pinCount}) than cable cores (${cableSpec.coreCount})`
    );
  }
  if (connectorB.pinCount > 0 && connectorB.pinCount < cableSpec.coreCount) {
    warnings.push(
      `Connector B has fewer pins (${connectorB.pinCount}) than cable cores (${cableSpec.coreCount})`
    );
  }

  return { compatible, warnings };
}
