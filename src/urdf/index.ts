/**
 * URDF Module
 * Unified Robot Description Format loader for kinetiCORE
 *
 * Provides complete URDF import functionality:
 * - XML parsing and robot model loading
 * - Conversion to Babylon.js scene
 * - Physics integration with IPhysicsEngine
 * - Joint control and animation
 *
 * @module urdf
 */

export * from './types';
export { URDFRobotLoader } from './URDFLoader';
export { URDFToBabylonConverter } from './URDFToBabylonConverter';
export { URDFPhysicsIntegration } from './URDFPhysicsIntegration';
export { URDFJointController } from './URDFJointController';
