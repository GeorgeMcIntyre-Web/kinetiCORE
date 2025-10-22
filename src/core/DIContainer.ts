// Dependency Injection Container
// Owner: George

/**
 * Simple dependency injection container to resolve circular dependencies
 */
export class DIContainer {
  private static instance: DIContainer | null = null;
  private services = new Map<string, any>();
  private factories = new Map<string, () => any>();

  private constructor() {}

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * Register a service instance
   */
  register<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  /**
   * Register a factory function for lazy initialization
   */
  registerFactory<T>(name: string, factory: () => T): void {
    this.factories.set(name, factory);
  }

  /**
   * Get a service instance
   */
  get<T>(name: string): T {
    // Return existing instance if available
    if (this.services.has(name)) {
      return this.services.get(name);
    }

    // Create instance using factory if available
    if (this.factories.has(name)) {
      const factory = this.factories.get(name)!;
      const instance = factory();
      this.services.set(name, instance);
      return instance;
    }

    throw new Error(`Service '${name}' not registered`);
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name) || this.factories.has(name);
  }

  /**
   * Clear all services (for testing)
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
  }
}
