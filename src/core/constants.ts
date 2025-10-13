// Application constants
export const APP_NAME = 'kinetiCORE';
export const APP_VERSION = '0.1.0';

// Unit system
// USER SPACE: Engineers work in Z-up, millimeters (CAD standard)
// INTERNAL: Babylon.js/Rapier use Y-up, meters (engine native)
// Conversion handled in CoordinateSystem.ts
export const UNITS = {
  DISPLAY: 'mm',
  INTERNAL: 'm',
  MM_TO_M: 0.001,
  M_TO_MM: 1000,
} as const;

// Physics constants (internal units: meters, Y-up)
// Internal gravity points down Y-axis (Babylon/Rapier standard)
// User sees this as Z-down via CoordinateSystem.ts
export const DEFAULT_GRAVITY = { x: 0, y: -9.81, z: 0 }; // Y-up (internal)
export const PHYSICS_TIMESTEP = 1 / 60; // 60 FPS

// Scene constants (internal units: meters)
export const GROUND_SIZE = 50; // 50 meters = 50,000mm
export const AXIS_LENGTH = 2; // 2 meters = 2,000mm

// Camera constants (internal units: meters, Y-up)
export const CAMERA_MIN_RADIUS = 0.01; // 1cm - allow very close inspection
export const CAMERA_MAX_RADIUS = 10000; // 10,000m - support very large layouts (10km)
export const CAMERA_WHEEL_PRECISION = 10; // Lower = faster zoom (changed from 50 for large scenes)
export const CAMERA_INERTIA = 0.9;
export const CAMERA_DEFAULT_ALPHA = -Math.PI / 2; // Look from side
export const CAMERA_DEFAULT_BETA = Math.PI / 4; // 45° angle from Y-axis
export const CAMERA_DEFAULT_RADIUS = 15; // 15m distance

// Command history
export const MAX_UNDO_STACK_SIZE = 50;

// UI constants
export const DEFAULT_TRANSFORM_MODE = 'translate' as const;
