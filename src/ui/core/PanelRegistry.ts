// PanelRegistry - Singleton registry for managing all UI panels
// Owner: George (Architecture)

import { BasePanel } from './BasePanel';
import { UserLevel } from './UserLevelContext';

export class PanelRegistry {
  private static instance: PanelRegistry;
  private panels: Map<string, BasePanel> = new Map();

  private constructor() {}

  static getInstance(): PanelRegistry {
    if (!PanelRegistry.instance) {
      PanelRegistry.instance = new PanelRegistry();
    }
    return PanelRegistry.instance;
  }

  register(panel: BasePanel): void {
    const id = panel.getId();
    if (this.panels.has(id)) {
      console.warn(`Panel with id "${id}" already registered. Overwriting.`);
    }
    this.panels.set(id, panel);
    console.log(`Panel registered: ${id}`);
  }

  unregister(id: string): void {
    this.panels.delete(id);
    console.log(`Panel unregistered: ${id}`);
  }

  get(id: string): BasePanel | undefined {
    return this.panels.get(id);
  }

  getAll(): BasePanel[] {
    return Array.from(this.panels.values());
  }

  getPanelsForUserLevel(userLevel: UserLevel): BasePanel[] {
    return this.getAll().filter(panel =>
      panel.isVisibleForUserLevel(userLevel)
    );
  }

  getPanelsForWorkspace(workspace: string): BasePanel[] {
    return this.getAll().filter(panel =>
      panel.isVisibleForWorkspace(workspace)
    );
  }

  getPanelsByPosition(position: string): BasePanel[] {
    return this.getAll().filter(panel =>
      panel.getPosition() === position
    );
  }

  getVisiblePanelsForUserLevel(userLevel: UserLevel): BasePanel[] {
    return this.getPanelsForUserLevel(userLevel).filter(panel => {
      // Additional filtering logic can be added here
      return true;
    });
  }

  clear(): void {
    this.panels.clear();
    console.log('All panels cleared from registry');
  }

  getPanelCount(): number {
    return this.panels.size;
  }

  hasPanel(id: string): boolean {
    return this.panels.has(id);
  }
}
