// Specifications Index - Main API exports for all route specifications
// Owner: Agent 3 (Specifications & Technical Spec Lead)

// Re-export specification modules (avoiding duplicate exports)
export * from './PipeSpecifications';
export * from './CableTraySpecifications';
export * from './WiringSpecifications';
export * from './ConduitSpecifications';
// RouteSpecifications has duplicates with the above, so selectively export
export type {
  ConnectorType,
  ConnectorSpec,
  ElectricalSpec,
  PipeSpec,
  CableTraySpec,
  ConduitSpec,
  FluidProperties,
} from './RouteSpecifications';
export {
  DEFAULT_CONNECTOR_NEMA_5_15,
  DEFAULT_CONNECTOR_IEC_C13,
  CONNECTOR_DATABASE,
  DEFAULT_ELECTRICAL_SPEC,
  DEFAULT_PIPE_SPEC,
  DEFAULT_CABLE_TRAY_SPEC,
  DEFAULT_CONDUIT_SPEC,
  FLUID_PROPERTIES,
  calculateFlowVelocity,
  validatePipeSize,
} from './RouteSpecifications';

// Import constraint rule functions
import { getPipeConstraintRules } from './PipeSpecifications';
import { getCableTrayConstraintRules } from './CableTraySpecifications';
import { getCableConstraintRules } from './WiringSpecifications';
import { getConduitConstraintRules } from './ConduitSpecifications';

import type { RouteType, RouteConstraints } from '../core/types';

/**
 * Unified constraint rules API
 * This is the main function that other agents should use to get constraint rules
 * for any route type. It dispatches to the appropriate specification module.
 * 
 * @param routeType - Type of route ('pipe', 'electrical', 'cable_tray', 'conduit')
 * @param specifications - Route-specific specifications object
 * @returns RouteConstraints object with all constraint values
 * 
 * @example
 * ```typescript
 * // For pipes
 * const pipeRules = getConstraintRules('pipe', {
 *   size: '3/4"',
 *   material: 'steel'
 * });
 * 
 * // For cable trays
 * const trayRules = getConstraintRules('cable_tray', {
 *   size: '12"x4"',
 *   material: 'aluminum',
 *   trayType: 'ladder'
 * });
 * 
 * // For electrical cables
 * const cableRules = getConstraintRules('electrical', {
 *   gauge: '14 AWG',
 *   coreCount: 3,
 *   voltage: 120,
 *   insulationType: 'PVC'
 * });
 * 
 * // For conduits
 * const conduitRules = getConstraintRules('conduit', {
 *   size: '3/4"',
 *   conduitType: 'EMT',
 *   material: 'steel'
 * });
 * ```
 */
export function getConstraintRules(
  routeType: RouteType,
  specifications: Record<string, any>
): RouteConstraints {
  switch (routeType) {
    case 'pipe': {
      const size = specifications.size || '1/2"';
      const material = specifications.material || 'steel';
      return getPipeConstraintRules(size, material);
    }

    case 'cable_tray': {
      const size = specifications.size || '12"x4"';
      const material = specifications.material || 'aluminum';
      const trayType = specifications.trayType || 'ladder';
      return getCableTrayConstraintRules(size, material, trayType);
    }

    case 'electrical': {
      const gauge = specifications.gauge || specifications.wireGauge || '14 AWG';
      const coreCount = specifications.coreCount || 3;
      const voltage = specifications.voltage || 120;
      const insulationType = specifications.insulationType || 'PVC';
      return getCableConstraintRules(gauge, coreCount, voltage, insulationType);
    }

    case 'conduit': {
      const size = specifications.size || '3/4"';
      const conduitType = specifications.conduitType || 'EMT';
      const material = specifications.material || 'steel';
      return getConduitConstraintRules(size, conduitType, material);
    }

    default:
      throw new Error(`Unknown route type: ${routeType}`);
  }
}

/**
 * BOM (Bill of Materials) export schema
 * Used by Agent 9 for BOM generation
 */
export interface BOMEntry {
  routeType: RouteType;
  routeId: string;
  size: string;
  material: string;
  totalLength: number;        // meters
  totalLengthFeet: number;    // feet (for display)
  fittings: FittingEntry[];
  supports: SupportEntry[];
  estimatedCost?: number;     // USD (optional)
}

export interface FittingEntry {
  type: 'elbow' | 'tee' | 'reducer' | 'coupling' | 'junction-box';
  angle?: number;             // For elbows: 90, 45, etc.
  count: number;
  specification: string;      // e.g., "90° Elbow 3/4\""
  unitCost?: number;          // USD per unit
}

export interface SupportEntry {
  type: 'hanger' | 'clamp' | 'bracket' | 'strut';
  specification: string;      // e.g., "Pipe Hanger 3/4\""
  count: number;
  spacing: number;            // meters
  unitCost?: number;          // USD per unit
}

/**
 * BOM summary for export
 */
export interface BOMSummary {
  entries: BOMEntry[];
  totals: {
    totalLength: number;      // meters
    totalLengthFeet: number;  // feet
    totalFittings: number;
    totalSupports: number;
    totalEstimatedCost: number; // USD
  };
  metadata: {
    generatedAt: string;      // ISO date string
    projectName?: string;
    version: string;
  };
}

/**
 * Generate CSV header for BOM export
 */
export function getBOMCSVHeader(): string {
  return 'Route Type,Route ID,Size,Material,Length (ft),Elbows,Tees,Reducers,Couplings,Junction Boxes,Supports,Estimated Cost';
}

/**
 * Convert BOM entry to CSV row
 */
export function bomEntryToCSVRow(entry: BOMEntry): string {
  const elbows = entry.fittings.filter(f => f.type === 'elbow').reduce((sum, f) => sum + f.count, 0);
  const tees = entry.fittings.filter(f => f.type === 'tee').reduce((sum, f) => sum + f.count, 0);
  const reducers = entry.fittings.filter(f => f.type === 'reducer').reduce((sum, f) => sum + f.count, 0);
  const couplings = entry.fittings.filter(f => f.type === 'coupling').reduce((sum, f) => sum + f.count, 0);
  const junctionBoxes = entry.fittings.filter(f => f.type === 'junction-box').reduce((sum, f) => sum + f.count, 0);
  const supports = entry.supports.reduce((sum, s) => sum + s.count, 0);
  const cost = entry.estimatedCost?.toFixed(2) || '0.00';

  return `${entry.routeType},${entry.routeId},${entry.size},${entry.material},${entry.totalLengthFeet.toFixed(2)},${elbows},${tees},${reducers},${couplings},${junctionBoxes},${supports},$${cost}`;
}

/**
 * Generate complete CSV from BOM summary
 */
export function generateBOMCSV(summary: BOMSummary): string {
  const lines: string[] = [];
  
  // Header
  lines.push(getBOMCSVHeader());
  
  // Entries
  for (const entry of summary.entries) {
    lines.push(bomEntryToCSVRow(entry));
  }
  
  // Totals row
  lines.push(`TOTALS,,,,${ summary.totals.totalLengthFeet.toFixed(2)},,,,,,${summary.totals.totalSupports},$${summary.totals.totalEstimatedCost.toFixed(2)}`);
  
  // Metadata
  lines.push('');
  lines.push(`Generated: ${summary.metadata.generatedAt}`);
  if (summary.metadata.projectName) {
    lines.push(`Project: ${summary.metadata.projectName}`);
  }
  lines.push(`Version: ${summary.metadata.version}`);
  
  return lines.join('\n');
}
