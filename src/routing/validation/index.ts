// Validation module exports
// Owner: Agent 2 - Constraint Validator

export { ConstraintValidator } from './ConstraintValidator';
export type {
  ValidationResult,
  ConstraintViolation,
  EnhancedValidationResult,
  BatchValidationResult,
  ValidationOptions,
  ValidationStatistics,
  ViolationType,
  ViolationSeverity,
} from './ValidationResult';
export {
  createViolationId,
  calculateStatistics,
  formatViolationMessage,
} from './ValidationResult';
export { RouteValidator } from './RouteValidator';
export { RouteVisualWarnings } from './RouteVisualWarnings';




