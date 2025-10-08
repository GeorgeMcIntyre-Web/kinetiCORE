/**
 * ROS 2 Error Classes
 * Structured error handling for ROS 2 operations
 */

export enum ROSErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  MESSAGE_PARSE_ERROR = 'MESSAGE_PARSE_ERROR',
  SERVICE_CALL_FAILED = 'SERVICE_CALL_FAILED',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  NOT_CONNECTED = 'NOT_CONNECTED',
  SUBSCRIPTION_FAILED = 'SUBSCRIPTION_FAILED',
  TRAJECTORY_EXPORT_FAILED = 'TRAJECTORY_EXPORT_FAILED'
}

/**
 * Base ROS Error class
 */
export class ROSError extends Error {
  code: ROSErrorCode;
  details?: unknown;

  constructor(code: ROSErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ROSError';
    this.code = code;
    this.details = details;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ROSError);
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case ROSErrorCode.CONNECTION_FAILED:
        return 'Failed to connect to ROS 2 system. Please check that rosbridge is running.';

      case ROSErrorCode.TIMEOUT:
        return 'Operation timed out. The ROS 2 system may be overloaded or unresponsive.';

      case ROSErrorCode.NOT_CONNECTED:
        return 'Not connected to ROS 2. Please connect first.';

      case ROSErrorCode.SERVICE_CALL_FAILED:
        return 'ROS service call failed. The service may not be available.';

      case ROSErrorCode.TRAJECTORY_EXPORT_FAILED:
        return 'Failed to export trajectory. Please check joint names and trajectory data.';

      default:
        return this.message;
    }
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    return [
      ROSErrorCode.TIMEOUT,
      ROSErrorCode.CONNECTION_FAILED
    ].includes(this.code);
  }
}

/**
 * Connection error
 */
export class ROSConnectionError extends ROSError {
  constructor(message: string, details?: unknown) {
    super(ROSErrorCode.CONNECTION_FAILED, message, details);
    this.name = 'ROSConnectionError';
  }
}

/**
 * Timeout error
 */
export class ROSTimeoutError extends ROSError {
  constructor(message: string, details?: unknown) {
    super(ROSErrorCode.TIMEOUT, message, details);
    this.name = 'ROSTimeoutError';
  }
}

/**
 * Service call error
 */
export class ROSServiceError extends ROSError {
  constructor(message: string, details?: unknown) {
    super(ROSErrorCode.SERVICE_CALL_FAILED, message, details);
    this.name = 'ROSServiceError';
  }
}

/**
 * Message validation error
 */
export class ROSMessageError extends ROSError {
  constructor(message: string, details?: unknown) {
    super(ROSErrorCode.INVALID_MESSAGE, message, details);
    this.name = 'ROSMessageError';
  }
}
