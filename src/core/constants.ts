// Application constants
export const APP_NAME = 'kinetiCORE';
export const APP_VERSION = '0.1.0';

// Unit system
// USER SPACE: Engineers work in millimeters (mm) with Z-up
// INTERNAL: Babylon.js/Rapier use meters (m) with Y-up
export const UNITS = {
  DISPLAY: 'mm',
  INTERNAL: 'm',
  MM_TO_M: 0.001,
  M_TO_MM: 1000,
} as const;

// Physics constants (internal units: meters, Y-up in Babylon space)
// Note: In user space, gravity is on Z-axis, but internally it's Y-axis
export const DEFAULT_GRAVITY = { x: 0, y: -9.81, z: 0 }; // Babylon Y-up
export const PHYSICS_TIMESTEP = 1 / 60; // 60 FPS

// Scene constants (internal units: meters)
export const GROUND_SIZE = 10; // 10 meters = 10,000mm
export const AXIS_LENGTH = 2; // 2 meters = 2,000mm

// Camera constants (internal units: meters)
export const CAMERA_MIN_RADIUS = 2; // 2m
export const CAMERA_MAX_RADIUS = 50; // 50m
export const CAMERA_WHEEL_PRECISION = 50;
export const CAMERA_INERTIA = 0.9;
export const CAMERA_DEFAULT_ALPHA = -Math.PI / 2; // Look from side
export const CAMERA_DEFAULT_BETA = Math.PI / 4; // 45° angle
export const CAMERA_DEFAULT_RADIUS = 15; // 15m distance

// Command history
export const MAX_UNDO_STACK_SIZE = 50;

// UI constants
export const DEFAULT_TRANSFORM_MODE = 'translate' as const;
