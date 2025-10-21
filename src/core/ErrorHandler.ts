// Error Handler - Centralized error management
// Owner: George

/**
 * Custom error types for better error handling
 */
export class KinetiCoreError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'KinetiCoreError';
  }
}

export class PhysicsError extends KinetiCoreError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'PHYSICS_ERROR', context);
    this.name = 'PhysicsError';
  }
}

export class AssetLoadError extends KinetiCoreError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'ASSET_LOAD_ERROR', context);
    this.name = 'AssetLoadError';
  }
}

export class SceneError extends KinetiCoreError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'SCENE_ERROR', context);
    this.name = 'SceneError';
  }
}

export class ProjectError extends KinetiCoreError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'PROJECT_ERROR', context);
    this.name = 'ProjectError';
  }
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error context for better debugging
 */
export interface ErrorContext {
  component: string;
  operation: string;
  userId?: string;
  timestamp: Date;
  userAgent?: string;
  additionalData?: Record<string, any>;
}

/**
 * Centralized error handler
 */
export class ErrorHandler {
  private static instance: ErrorHandler | null = null;
  private errorLog: Array<{ error: Error; context: ErrorContext; severity: ErrorSeverity }> = [];
  private maxLogSize = 1000;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle and log an error
   */
  handleError(
    error: Error,
    context: Omit<ErrorContext, 'timestamp'>,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): void {
    const fullContext: ErrorContext = {
      ...context,
      timestamp: new Date(),
      userAgent: navigator.userAgent
    };

    // Add to log
    this.errorLog.push({ error, context: fullContext, severity });
    
    // Trim log if too large
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Log to console with appropriate level
    const logMessage = `[${context.component}] ${error.message}`;
    const logData = { error, context: fullContext, severity };

    switch (severity) {
      case ErrorSeverity.CRITICAL:
        console.error(logMessage, logData);
        // TODO: Send to monitoring service
        break;
      case ErrorSeverity.HIGH:
        console.error(logMessage, logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(logMessage, logData);
        break;
      case ErrorSeverity.LOW:
        console.info(logMessage, logData);
        break;
    }

    // Dispatch error event for UI handling
    window.dispatchEvent(new CustomEvent('kineticore-error', {
      detail: { error, context: fullContext, severity }
    }));
  }

  /**
   * Create a wrapped function with error handling
   */
  wrapFunction<T extends (...args: any[]) => any>(
    fn: T,
    component: string,
    operation: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): T {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn(...args);
        
        // Handle async functions
        if (result instanceof Promise) {
          return result.catch((error) => {
            this.handleError(error, { component, operation }, severity);
            throw error;
          });
        }
        
        return result;
      } catch (error) {
        this.handleError(error as Error, { component, operation }, severity);
        throw error;
      }
    }) as T;
  }

  /**
   * Get recent errors
   */
  getRecentErrors(count: number = 10): Array<{ error: Error; context: ErrorContext; severity: ErrorSeverity }> {
    return this.errorLog.slice(-count);
  }

  /**
   * Clear error log
   */
  clearLog(): void {
    this.errorLog = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): { total: number; bySeverity: Record<ErrorSeverity, number>; byComponent: Record<string, number> } {
    const stats = {
      total: this.errorLog.length,
      bySeverity: {} as Record<ErrorSeverity, number>,
      byComponent: {} as Record<string, number>
    };

    // Initialize counters
    Object.values(ErrorSeverity).forEach(severity => {
      stats.bySeverity[severity] = 0;
    });

    // Count errors
    this.errorLog.forEach(({ error, context, severity }) => {
      stats.bySeverity[severity]++;
      stats.byComponent[context.component] = (stats.byComponent[context.component] || 0) + 1;
    });

    return stats;
  }
}

/**
 * Convenience function for error handling
 */
export function handleError(
  error: Error,
  component: string,
  operation: string,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  additionalData?: Record<string, any>
): void {
  ErrorHandler.getInstance().handleError(error, {
    component,
    operation,
    additionalData
  }, severity);
}

/**
 * Create error with context
 */
export function createError(
  message: string,
  code: string,
  component: string,
  operation: string,
  context?: Record<string, any>
): KinetiCoreError {
  const error = new KinetiCoreError(message, code, context);
  handleError(error, component, operation, ErrorSeverity.MEDIUM, context);
  return error;
}
