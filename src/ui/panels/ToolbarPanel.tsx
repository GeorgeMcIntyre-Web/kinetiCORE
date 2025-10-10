// ToolbarPanel - Wraps the existing Toolbar component in BasePanel
// Owner: George (Architecture)

import React from 'react';
import { BasePanel, PanelConfig, PanelState } from '../core/BasePanel';
import { Toolbar } from '../components/Toolbar';

export class ToolbarPanel extends BasePanel {
  constructor() {
    const config: PanelConfig = {
      id: 'toolbar',
      name: 'Toolbar',
      position: 'top',
      defaultSize: 60, // pixels
      minSize: 60,
      maxSize: 120,
      resizable: false, // Toolbar height is fixed
      collapsible: false, // Toolbar always visible
      userLevels: ['essential', 'professional', 'expert'],
      workspaces: ['*'], // Available in all workspaces
      defaultCollapsed: false,
    };
    super(config);
  }

  render(): React.ReactNode {
    return <Toolbar onOpenKinematics={() => {/* TODO: Implement kinematics panel */}} />;
  }

  getDefaultState(): PanelState {
    return {
      id: this.config.id,
      visible: true,
      collapsed: false, // Toolbar never collapsed
      size: this.config.defaultSize || 60,
    };
  }
}
