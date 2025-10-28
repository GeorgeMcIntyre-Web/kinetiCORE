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
export const CAMERA_MIN_RADIUS = 0.01; // 1cm - reasonable minimum for close inspection
export const CAMERA_MAX_RADIUS = 10000; // 10,000m - support very large layouts (10km)
export const CAMERA_WHEEL_PRECISION = 50; // Higher = less sensitive mouse wheel zoom (was 15)
export const CAMERA_INERTIA = 0.85; // Slightly reduced inertia for less "sliding"
export const CAMERA_DEFAULT_ALPHA = -Math.PI / 2; // Look from side
export const CAMERA_DEFAULT_BETA = Math.PI / 4; // 45° angle from Y-axis
export const CAMERA_DEFAULT_RADIUS = 15; // 15m distance

// Camera behavior tuning (percentages and dynamic clipping)
// When set, Babylon uses percentage-based zoom deltas instead of fixed wheelPrecision
export const CAMERA_WHEEL_DELTA_PERCENTAGE = 0.02; // 2% of current radius per wheel step
export const CAMERA_PINCH_DELTA_PERCENTAGE = 0.02; // 2% of current radius per pinch step
export const CAMERA_ZOOM_TO_MOUSE = true; // Zoom towards cursor location for precision

// Adaptive clipping planes scale with camera distance to avoid near-plane clipping when close
export const CAMERA_NEAR_PLANE_RATIO = 0.01; // near = radius * 1%
export const CAMERA_NEAR_MIN = 0.001; // absolute floor for near plane in meters (1mm)
export const CAMERA_FAR_MIN = 2000; // minimum far plane in meters
export const CAMERA_FAR_SCENE_MULTIPLIER = 4; // far = scene diagonal * multiplier

// Collision-safe zoom-in buffer to keep camera outside surfaces
export const CAMERA_COLLISION_BUFFER = 0.02; // 2cm buffer

// Command history
export const MAX_UNDO_STACK_SIZE = 50;

// UI constants
export const DEFAULT_TRANSFORM_MODE = 'translate' as const;
