// Create Connection Point Command - Undo/redo for connection point creation
// Owner: Routing System Team

import { Command } from '../../history/Command';
import { ConnectionManager } from '../core/ConnectionManager';
import { ConnectionPoint } from '../core/ConnectionPoint';
import { ConnectionPointConfig } from '../core/types';
import { useRoutingStore } from '../../ui/store/routingStore';
import { EntityRegistry } from '../../entities/EntityRegistry';

/**
 * Command for creating a connection point
 */
export class CreateConnectionPointCommand extends Command {
  description = 'Create Connection Point';

  private connectionPoint: ConnectionPoint | null = null;
  private config: ConnectionPointConfig;
  private entityId?: string;

  constructor(config: ConnectionPointConfig, entityId?: string) {
    super();
    this.config = { ...config };
    this.entityId = entityId;
  }

  getConnectionPoint(): ConnectionPoint | null {
    return this.connectionPoint;
  }

  execute(): void {
    console.log(`[CreateConnectionPointCommand] 📍 Creating connection point with type: ${this.config.type}`);
    console.log(`[CreateConnectionPointCommand]   Position:`, this.config.position);
    console.log(`[CreateConnectionPointCommand]   Specifications:`, this.config.specifications);

    const connectionManager = ConnectionManager.getInstance();
    this.connectionPoint = connectionManager.addConnectionPoint(this.config);

    if (this.connectionPoint) {
      console.log(`[CreateConnectionPointCommand] ✅ Connection point created:`, this.connectionPoint.getId());
      console.log(`[CreateConnectionPointCommand]   Stored type: ${this.connectionPoint.getType()}`);
    }

    // Add to entity if specified
    if (this.entityId && this.connectionPoint) {
      const registry = EntityRegistry.getInstance();
      const entity = registry.get(this.entityId);
      if (entity) {
        entity.addConnectionPointId(this.connectionPoint.getId());
      }
    }

    // Add to store
    const addConnectionPoint = useRoutingStore.getState().addConnectionPoint;
    if (this.connectionPoint) {
      addConnectionPoint(this.connectionPoint);
    }

    this.onExecuted();
  }

  undo(): void {
    if (!this.connectionPoint) return;

    // Remove from entity if specified
    if (this.entityId) {
      const registry = EntityRegistry.getInstance();
      const entity = registry.get(this.entityId);
      if (entity) {
        entity.removeConnectionPointId(this.connectionPoint!.getId());
      }
    }

    // Remove from connection manager
    const connectionManager = ConnectionManager.getInstance();
    connectionManager.removeConnectionPoint(this.connectionPoint.getId());

    // Remove from store
    const removeConnectionPoint = useRoutingStore.getState().removeConnectionPoint;
    removeConnectionPoint(this.connectionPoint.getId());

    this.onUndone();
  }
}

