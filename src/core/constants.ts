// Application constants
export const APP_NAME = 'kinetiCORE';
export const APP_VERSION = '0.1.0';

// Physics constants
export const DEFAULT_GRAVITY = { x: 0, y: -9.81, z: 0 };
export const PHYSICS_TIMESTEP = 1 / 60; // 60 FPS

// Scene constants
export const GROUND_SIZE = 10;
export const AXIS_LENGTH = 5;

// Camera constants
export const CAMERA_MIN_RADIUS = 2;
export const CAMERA_MAX_RADIUS = 50;
export const CAMERA_WHEEL_PRECISION = 50;
export const CAMERA_INERTIA = 0.9;

// Command history
export const MAX_UNDO_STACK_SIZE = 50;

// UI constants
export const DEFAULT_TRANSFORM_MODE = 'translate' as const;
