/**
 * Physics Configuration
 * Owner: George
 * 
 * Centralized configuration for physics engines
 * Supports both Havok and Rapier with engine-specific settings
 */

import type { PhysicsEngineConfig } from '../physics/PhysicsManager';

/**
 * Default physics configuration
 */
export const defaultPhysicsConfig: PhysicsEngineConfig = {
  type: 'rapier',
  gravity: { x: 0, y: -9.81, z: 0 },
  enableWasm: true,
  solverIterations: 8,
  enableSleeping: true,
  enableCCD: false
};

/**
 * Havok-specific configuration
 */
export const havokConfig: Partial<PhysicsEngineConfig> = {
  type: 'havok',
  gravity: { x: 0, y: -9.81, z: 0 },
  enableWasm: false, // Havok uses native implementation
  solverIterations: 4, // Havok is more efficient
  enableSleeping: true,
  enableCCD: true // Havok has better CCD support
};

/**
 * Rapier-specific configuration
 */
export const rapierConfig: Partial<PhysicsEngineConfig> = {
  type: 'rapier',
  gravity: { x: 0, y: -9.81, z: 0 },
  enableWasm: true,
  solverIterations: 8,
  enableSleeping: true,
  enableCCD: false // Rapier CCD is experimental
};

/**
 * Performance-optimized configuration
 */
export const performanceConfig: Partial<PhysicsEngineConfig> = {
  solverIterations: 4,
  enableSleeping: true,
  enableCCD: false
};

/**
 * High-accuracy configuration
 */
export const accuracyConfig: Partial<PhysicsEngineConfig> = {
  solverIterations: 16,
  enableSleeping: false,
  enableCCD: true
};

/**
 * Debug configuration
 */
export const debugConfig: Partial<PhysicsEngineConfig> = {
  solverIterations: 1,
  enableSleeping: false,
  enableCCD: false
};

/**
 * Get configuration for specific use case
 */
export function getPhysicsConfig(
  engineType: 'havok' | 'rapier',
  preset: 'default' | 'performance' | 'accuracy' | 'debug' = 'default'
): PhysicsEngineConfig {
  const baseConfig = engineType === 'havok' ? havokConfig : rapierConfig;
  
  let presetConfig: Partial<PhysicsEngineConfig> = {};
  switch (preset) {
    case 'performance':
      presetConfig = performanceConfig;
      break;
    case 'accuracy':
      presetConfig = accuracyConfig;
      break;
    case 'debug':
      presetConfig = debugConfig;
      break;
    default:
      presetConfig = {};
  }
  
  return {
    ...defaultPhysicsConfig,
    ...baseConfig,
    ...presetConfig
  } as PhysicsEngineConfig;
}

/**
 * Validate physics configuration
 */
export function validatePhysicsConfig(config: Partial<PhysicsEngineConfig>): string[] {
  const errors: string[] = [];
  
  if (config.gravity) {
    if (typeof config.gravity.x !== 'number' || 
        typeof config.gravity.y !== 'number' || 
        typeof config.gravity.z !== 'number') {
      errors.push('Gravity must have numeric x, y, z components');
    }
  }
  
  if (config.solverIterations !== undefined) {
    if (config.solverIterations < 1 || config.solverIterations > 32) {
      errors.push('Solver iterations must be between 1 and 32');
    }
  }
  
  if (config.type && !['havok', 'rapier'].includes(config.type)) {
    errors.push('Engine type must be "havok" or "rapier"');
  }
  
  return errors;
}

/**
 * Get recommended configuration based on scene complexity
 */
export function getRecommendedConfig(
  engineType: 'havok' | 'rapier',
  sceneComplexity: 'low' | 'medium' | 'high'
): PhysicsEngineConfig {
  const baseConfig = getPhysicsConfig(engineType);
  
  switch (sceneComplexity) {
    case 'low':
      return {
        ...baseConfig,
        solverIterations: 4,
        enableSleeping: true,
        enableCCD: false
      };
      
    case 'medium':
      return {
        ...baseConfig,
        solverIterations: 8,
        enableSleeping: true,
        enableCCD: engineType === 'havok'
      };
      
    case 'high':
      return {
        ...baseConfig,
        solverIterations: 12,
        enableSleeping: false,
        enableCCD: true
      };
      
    default:
      return baseConfig;
  }
}
