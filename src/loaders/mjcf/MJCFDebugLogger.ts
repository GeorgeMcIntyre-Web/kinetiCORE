/**
 * MJCF Debug Logger
 * Owner: George
 *
 * Enhanced logging utility for debugging MJCF model loading in the browser
 * Provides structured console logging with groups and downloadable log files
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

export class MJCFDebugLogger {
  private static instance: MJCFDebugLogger;
  private logs: LogEntry[] = [];
  private enabled: boolean = true;
  private groupStack: string[] = [];

  private constructor() {
    // Check if debug mode is enabled via localStorage or URL param
    const urlParams = new URLSearchParams(window.location.search);
    this.enabled = localStorage.getItem('mjcf_debug') === 'true' ||
                   urlParams.has('mjcf_debug');

    if (this.enabled) {
      console.log('%c[MJCF Debug Logger] Enabled', 'color: #00ff00; font-weight: bold');
    }
  }

  static getInstance(): MJCFDebugLogger {
    if (!MJCFDebugLogger.instance) {
      MJCFDebugLogger.instance = new MJCFDebugLogger();
    }
    return MJCFDebugLogger.instance;
  }

  /**
   * Enable debug logging
   */
  enable(): void {
    this.enabled = true;
    localStorage.setItem('mjcf_debug', 'true');
    console.log('%c[MJCF Debug Logger] Enabled', 'color: #00ff00; font-weight: bold');
  }

  /**
   * Disable debug logging
   */
  disable(): void {
    this.enabled = false;
    localStorage.removeItem('mjcf_debug');
    console.log('%c[MJCF Debug Logger] Disabled', 'color: #ff0000; font-weight: bold');
  }

  /**
   * Start a collapsible console group
   */
  group(category: string, title: string): void {
    if (!this.enabled) return;

    this.groupStack.push(title);
    console.group(`%c[${category}] ${title}`, this.getStyleForCategory(category));

    this.logs.push({
      timestamp: Date.now(),
      level: 'debug',
      category,
      message: `GROUP START: ${title}`,
    });
  }

  /**
   * End the current console group
   */
  groupEnd(): void {
    if (!this.enabled) return;

    const title = this.groupStack.pop();
    console.groupEnd();

    if (title) {
      this.logs.push({
        timestamp: Date.now(),
        level: 'debug',
        category: 'GROUP',
        message: `GROUP END: ${title}`,
      });
    }
  }

  /**
   * Log a message
   */
  log(level: LogLevel, category: string, message: string, data?: any): void {
    if (!this.enabled) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(entry);

    const style = this.getStyleForLevel(level);
    const prefix = `[${category}]`;

    if (data !== undefined) {
      console.log(`%c${prefix} ${message}`, style, data);
    } else {
      console.log(`%c${prefix} ${message}`, style);
    }
  }

  /**
   * Log info message
   */
  info(category: string, message: string, data?: any): void {
    this.log('info', category, message, data);
  }

  /**
   * Log warning message
   */
  warn(category: string, message: string, data?: any): void {
    this.log('warn', category, message, data);
  }

  /**
   * Log error message
   */
  error(category: string, message: string, data?: any): void {
    this.log('error', category, message, data);
  }

  /**
   * Log debug message
   */
  debug(category: string, message: string, data?: any): void {
    this.log('debug', category, message, data);
  }

  /**
   * Log success message
   */
  success(category: string, message: string, data?: any): void {
    this.log('success', category, message, data);
  }

  /**
   * Log XML structure
   */
  logXMLStructure(category: string, element: Element, depth: number = 0): void {
    if (!this.enabled) return;

    const indent = '  '.repeat(depth);
    const attrs = Array.from(element.attributes)
      .map(attr => `${attr.name}="${attr.value}"`)
      .join(' ');

    const tag = attrs ? `<${element.tagName} ${attrs}>` : `<${element.tagName}>`;
    this.debug(category, `${indent}${tag}`);

    Array.from(element.children).forEach(child => {
      this.logXMLStructure(category, child, depth + 1);
    });
  }

  /**
   * Log joint mapping details
   */
  logJointMapping(
    category: string,
    jointName: string,
    parentBody: string,
    childBody: string,
    jointElement: Element
  ): void {
    if (!this.enabled) return;

    this.group(category, `Joint: ${jointName}`);

    this.info(category, `Parent Body: ${parentBody}`);
    this.info(category, `Child Body: ${childBody}`);
    this.info(category, `Joint Type: ${jointElement.getAttribute('type')}`);
    this.info(category, `Joint Axis: ${jointElement.getAttribute('axis')}`);
    this.info(category, `Joint Range: ${jointElement.getAttribute('range')}`);

    // Log parent element structure
    if (jointElement.parentElement) {
      this.debug(category, 'Parent Element Children:',
        Array.from(jointElement.parentElement.children).map(c =>
          `${c.tagName}:${c.getAttribute('name') || 'unnamed'}`
        )
      );
    }

    this.groupEnd();
  }

  /**
   * Log scene tree node mapping
   */
  logSceneTreeMapping(
    category: string,
    bodyName: string,
    nodeId: string,
    nodeName: string
  ): void {
    if (!this.enabled) return;
    this.debug(category, `Body Mapping: ${bodyName} → Node(${nodeId}, "${nodeName}")`);
  }

  /**
   * Log kinematic chain details
   */
  logKinematicChain(
    category: string,
    chainId: string,
    joints: any[]
  ): void {
    if (!this.enabled) return;

    this.group(category, `Kinematic Chain: ${chainId}`);
    this.info(category, `Total Joints: ${joints.length}`);

    joints.forEach((joint, index) => {
      this.debug(category,
        `  [${index}] ${joint.name} (${joint.type}) - ${joint.parentNodeId} → ${joint.childNodeId}`
      );
    });

    this.groupEnd();
  }

  /**
   * Log actuator integration
   */
  logActuatorIntegration(
    category: string,
    actuatorName: string,
    jointName: string,
    jointId: string | null,
    success: boolean
  ): void {
    if (!this.enabled) return;

    if (success) {
      this.success(category,
        `✅ Actuator "${actuatorName}" → Joint "${jointName}" (${jointId})`
      );
    } else {
      this.error(category,
        `❌ Actuator "${actuatorName}" → Joint "${jointName}" NOT FOUND`
      );
    }
  }

  /**
   * Log keyframe integration
   */
  logKeyframeIntegration(
    category: string,
    keyframeName: string,
    jointCount: number,
    qposLength: number
  ): void {
    if (!this.enabled) return;

    this.group(category, `Keyframe: ${keyframeName}`);
    this.info(category, `Joints: ${jointCount}`);
    this.info(category, `Qpos Values: ${qposLength}`);
    this.groupEnd();
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
    console.clear();
    this.info('MJCF Debug', 'Logs cleared');
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return this.logs;
  }

  /**
   * Download logs as JSON file
   */
  downloadLogs(filename: string = 'mjcf-debug-logs.json'): void {
    const json = JSON.stringify(this.logs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);

    this.success('MJCF Debug', `Downloaded ${this.logs.length} log entries to ${filename}`);
  }

  /**
   * Download logs as readable text file
   */
  downloadLogsAsText(filename: string = 'mjcf-debug-logs.txt'): void {
    const lines = this.logs.map(entry => {
      const date = new Date(entry.timestamp).toISOString();
      const dataStr = entry.data !== undefined ? `\n  Data: ${JSON.stringify(entry.data, null, 2)}` : '';
      return `[${date}] [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}${dataStr}`;
    });

    const text = lines.join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);

    this.success('MJCF Debug', `Downloaded ${this.logs.length} log entries to ${filename}`);
  }

  /**
   * Get summary of errors and warnings
   */
  getSummary(): { errors: number; warnings: number; info: number; debug: number; success: number } {
    return {
      errors: this.logs.filter(l => l.level === 'error').length,
      warnings: this.logs.filter(l => l.level === 'warn').length,
      info: this.logs.filter(l => l.level === 'info').length,
      debug: this.logs.filter(l => l.level === 'debug').length,
      success: this.logs.filter(l => l.level === 'success').length,
    };
  }

  /**
   * Print summary to console
   */
  printSummary(): void {
    const summary = this.getSummary();

    console.log('%c=== MJCF Debug Log Summary ===', 'color: #00ffff; font-weight: bold; font-size: 14px');
    console.log(`%c✅ Success: ${summary.success}`, 'color: #00ff00');
    console.log(`%cℹ️  Info: ${summary.info}`, 'color: #0080ff');
    console.log(`%c🐛 Debug: ${summary.debug}`, 'color: #808080');
    console.log(`%c⚠️  Warnings: ${summary.warnings}`, 'color: #ffaa00');
    console.log(`%c❌ Errors: ${summary.errors}`, 'color: #ff0000');
    console.log(`%c📊 Total Logs: ${this.logs.length}`, 'color: #00ffff');

    if (this.logs.length > 0) {
      console.log('\n%cUse MJCFDebugLogger.getInstance().downloadLogs() to save logs',
        'color: #ffaa00; font-style: italic');
    }
  }

  private getStyleForLevel(level: LogLevel): string {
    switch (level) {
      case 'error':
        return 'color: #ff0000; font-weight: bold';
      case 'warn':
        return 'color: #ffaa00; font-weight: bold';
      case 'success':
        return 'color: #00ff00; font-weight: bold';
      case 'debug':
        return 'color: #808080';
      case 'info':
      default:
        return 'color: #0080ff';
    }
  }

  private getStyleForCategory(category: string): string {
    // Different colors for different categories
    const categoryColors: Record<string, string> = {
      'MJCF Loader': 'color: #00ffff; font-weight: bold',
      'MJCF Parse': 'color: #ff00ff; font-weight: bold',
      'MJCF Kinematic': 'color: #ffff00; font-weight: bold',
      'MJCF Actuator': 'color: #ff8800; font-weight: bold',
      'MJCF Keyframe': 'color: #00ff88; font-weight: bold',
      'EditorStore': 'color: #8800ff; font-weight: bold',
    };

    return categoryColors[category] || 'color: #ffffff; font-weight: bold';
  }
}

// Export singleton instance for convenience
export const mjcfLogger = MJCFDebugLogger.getInstance();

// Expose to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).MJCFDebugLogger = MJCFDebugLogger;
  (window as any).mjcfLogger = mjcfLogger;
}
