/**
 * Development Helper - Expose Auto Kinematics Test to Window
 *
 * This makes the test available in browser console as:
 * window.testAutoKinematics()
 *
 * Usage in console:
 * > window.testAutoKinematics()
 *
 * Owner: George (Claude Code Agent 1)
 */

import { runAutoKinematicsFullTest } from '../babylon/pipeline/AutoKinematicsFullPipelineTest';

// Expose to window for console access
(window as any).testAutoKinematics = runAutoKinematicsFullTest;

console.log('[DEV] Auto Kinematics test exposed to window');
console.log('[DEV] Run with: window.testAutoKinematics()');
