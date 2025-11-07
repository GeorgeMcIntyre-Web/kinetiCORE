// ValidationResult - Comprehensive validation result types
// Owner: Agent 2 - Constraint Validator
// Purpose: Detailed validation results with violation tracking

import { Vector3 } from '../../core/types';
// import type { RouteSegment } from '../core/types'; // Unused for now

/**
 * Constraint violation types
 */
export type ViolationType = 'bend_radius' | 'clearance' | 'support_spacing' | 'length';

/**
 * Severity levels for constraint violations
 */
export type ViolationSeverity = 'error' | 'warning' | 'info';

/**
 * A constraint violation found during route validation
 */
export interface ConstraintViolation {
  /** Unique identifier for this violation */
  id: string;
  /** Type of violation */
  type: ViolationType;
  /** Severity of the violation */
  severity: ViolationSeverity;
  /** Location where the violation occurs (Z-up coordinates) */
  location: Vector3;
  /** Human-readable message describing the violation */
  message: string;
  /** Actual measured value (e.g., 1.5" clearance) */
  actualValue?: number;
  /** Required value per specifications (e.g., 2.0" clearance) */
  requiredValue?: number;
  /** Reference to affected segment (if applicable) */
  segmentRef?: { from: Vector3; to: Vector3 };
  /** ID of obstacle causing violation (if applicable) */
  obstacleId?: string;
}

/**
 * Result of route validation
 */
export interface ValidationResult {
  /** Whether the route is valid (no errors) */
  isValid: boolean;
  /** List of all constraint violations */
  violations: ConstraintViolation[];
}

/**
 * Enhanced validation result with segment-level detail
 * Used for detailed UI feedback and visual warnings
 */
export interface EnhancedValidationResult extends ValidationResult {
  /** Segment-specific violations (segment ID -> violations) */
  segmentViolations: Map<string, ConstraintViolation[]>;
  /** Overall validation status */
  status: 'valid' | 'warning' | 'error';
  /** Timestamp when validation was performed */
  timestamp: number;
  /** Route ID that was validated */
  routeId: string;
}

/**
 * Batch validation result for multiple routes
 */
export interface BatchValidationResult {
  /** Map of route ID to validation result */
  results: Map<string, ValidationResult>;
  /** Overall statistics */
  statistics: ValidationStatistics;
  /** Timestamp when batch validation started */
  startTime: number;
  /** Timestamp when batch validation completed */
  endTime: number;
}

/**
 * Statistics for batch validation
 */
export interface ValidationStatistics {
  /** Total number of routes validated */
  totalRoutes: number;
  /** Number of routes with no violations */
  validRoutes: number;
  /** Number of routes with warnings only */
  routesWithWarnings: number;
  /** Number of routes with errors */
  routesWithErrors: number;
  /** Total number of violations found */
  totalViolations: number;
  /** Violations by type */
  violationsByType: Record<ViolationType, number>;
  /** Violations by severity */
  violationsBySeverity: Record<ViolationSeverity, number>;
}

/**
 * Validation options for fine-tuning validation behavior
 */
export interface ValidationOptions {
  /** Skip clearance checking (faster validation) */
  skipClearance?: boolean;
  /** Skip support spacing checking */
  skipSupportSpacing?: boolean;
  /** Skip bend radius checking */
  skipBendRadius?: boolean;
  /** Treat warnings as errors */
  strictMode?: boolean;
  /** Include detailed segment-level violations */
  includeSegmentDetails?: boolean;
  /** Maximum number of violations to report per route (0 = unlimited) */
  maxViolations?: number;
}

/**
 * Helper to create a unique violation ID
 */
export function createViolationId(type: ViolationType, location: Vector3): string {
  return `${type}-${location.x.toFixed(2)}-${location.y.toFixed(2)}-${location.z.toFixed(2)}-${Date.now()}`;
}

/**
 * Helper to calculate validation statistics from batch results
 */
export function calculateStatistics(
  results: Map<string, ValidationResult>
): ValidationStatistics {
  const stats: ValidationStatistics = {
    totalRoutes: results.size,
    validRoutes: 0,
    routesWithWarnings: 0,
    routesWithErrors: 0,
    totalViolations: 0,
    violationsByType: {
      bend_radius: 0,
      clearance: 0,
      support_spacing: 0,
      length: 0,
    },
    violationsBySeverity: {
      error: 0,
      warning: 0,
      info: 0,
    },
  };

  // Convert to array for iteration
  const resultsArray = Array.from(results.values());
  
  for (const result of resultsArray) {
    stats.totalViolations += result.violations.length;

    const hasErrors = result.violations.some((v) => v.severity === 'error');
    const hasWarnings = result.violations.some((v) => v.severity === 'warning');

    if (result.violations.length === 0) {
      stats.validRoutes++;
    } else if (hasErrors) {
      stats.routesWithErrors++;
    } else if (hasWarnings) {
      stats.routesWithWarnings++;
    }

    // Count by type and severity
    for (const violation of result.violations) {
      stats.violationsByType[violation.type]++;
      stats.violationsBySeverity[violation.severity]++;
    }
  }

  return stats;
}

/**
 * Helper to format a violation message for display
 */
export function formatViolationMessage(violation: ConstraintViolation): string {
  const location = `(${violation.location.x.toFixed(2)}, ${violation.location.y.toFixed(2)}, ${violation.location.z.toFixed(2)})`;
  
  if (violation.actualValue !== undefined && violation.requiredValue !== undefined) {
    return `${violation.message} at ${location} - Actual: ${violation.actualValue.toFixed(2)}m, Required: ${violation.requiredValue.toFixed(2)}m`;
  }
  
  return `${violation.message} at ${location}`;
}
