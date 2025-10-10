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
    try {
      return (
        <div style={{ padding: '20px', color: 'white', background: '#2a2a3e' }}>
          <h4>Toolbar Panel</h4>
          <p>This is a test to see if the toolbar panel renders.</p>
          <Toolbar onOpenKinematics={() => {/* TODO: Implement kinematics panel */}} />
        </div>
      );
    } catch (error) {
      console.error('ToolbarPanel render error:', error);
      return (
        <div style={{ padding: '20px', color: 'white', background: '#2a2a3e' }}>
          <h4>Toolbar Panel</h4>
          <p>Toolbar failed to render due to icon errors.</p>
        </div>
      );
    }
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
