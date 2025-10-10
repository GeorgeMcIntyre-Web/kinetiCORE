// BasePanel - Abstract base class for all UI panels
// Owner: George (Architecture)

import { ReactNode } from 'react';
import { UserLevel } from './UserLevelContext';

export interface PanelConfig {
  id: string;
  name: string;
  position: 'left' | 'right' | 'center' | 'top' | 'bottom' | 'floating';
  defaultSize?: number; // percentage or pixels
  minSize: number;
  maxSize?: number;
  resizable: boolean;
  collapsible: boolean;
  userLevels: UserLevel[]; // Which levels can see this panel
  workspaces: string[]; // Which workspaces include this panel
  defaultCollapsed?: boolean;
}

export interface PanelState {
  id: string;
  visible: boolean;
  collapsed: boolean;
  size: number;
  position?: { x?: number; y?: number }; // For floating panels
}

export abstract class BasePanel {
  protected config: PanelConfig;

  constructor(config: PanelConfig) {
    this.config = config;
  }

  // Abstract methods that subclasses must implement
  abstract render(): ReactNode;
  abstract getDefaultState(): PanelState;

  // Common methods available to all panels
  getId(): string {
    return this.config.id;
  }

  getName(): string {
    return this.config.name;
  }

  getConfig(): PanelConfig {
    return { ...this.config };
  }

  isVisibleForUserLevel(userLevel: UserLevel): boolean {
    return this.config.userLevels.includes(userLevel);
  }

  isVisibleForWorkspace(workspace: string): boolean {
    return this.config.workspaces.includes(workspace) ||
           this.config.workspaces.includes('*'); // Wildcard for all workspaces
  }

  canResize(): boolean {
    return this.config.resizable;
  }

  canCollapse(): boolean {
    return this.config.collapsible;
  }

  getDefaultSize(): number {
    return this.config.defaultSize || 20;
  }

  getMinSize(): number {
    return this.config.minSize;
  }

  getMaxSize(): number | undefined {
    return this.config.maxSize;
  }

  getPosition(): string {
    return this.config.position;
  }

  isDefaultCollapsed(): boolean {
    return this.config.defaultCollapsed || false;
  }
}
