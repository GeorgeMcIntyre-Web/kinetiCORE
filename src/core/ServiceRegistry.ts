// Service Registration - Sets up dependency injection
// Owner: George

import { DIContainer } from '../core/DIContainer';
import { ProjectWorldLoader } from '../project/ProjectWorldLoader';

/**
 * Register all services in the dependency injection container
 */
export function registerServices(): void {
  const container = DIContainer.getInstance();

  // Register ProjectWorldLoader as a factory to avoid circular dependencies
  container.registerFactory('ProjectWorldLoader', () => {
    return ProjectWorldLoader.getInstance();
  });

  console.log('✅ Services registered in DI container');
}

/**
 * Initialize services after registration
 */
export function initializeServices(): void {
  registerServices();
  console.log('✅ Services initialized');
}
