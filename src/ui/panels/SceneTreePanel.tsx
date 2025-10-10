// SceneTreePanel - Wraps the existing SceneTree component in BasePanel
// Owner: George (Architecture)

import React from 'react';
import { BasePanel, PanelConfig, PanelState } from '../core/BasePanel';
import { SceneTree } from '../components/SceneTree';

export class SceneTreePanel extends BasePanel {
  constructor() {
    const config: PanelConfig = {
      id: 'sceneTree',
      name: 'Scene',
      position: 'left',
      defaultSize: 18, // 18% width
      minSize: 12,
      maxSize: 30,
      resizable: true,
      collapsible: true,
      userLevels: ['essential', 'professional', 'expert'],
      workspaces: ['*'], // Available in all workspaces
      defaultCollapsed: false,
    };
    super(config);
  }

  render(): React.ReactNode {
    return (
      <div style={{ padding: '20px', color: 'white', background: '#2a2a3e' }}>
        <h4>Scene Tree Panel</h4>
        <p>This is a test to see if the panel content renders.</p>
        <SceneTree />
      </div>
    );
  }

  getDefaultState(): PanelState {
    return {
      id: this.config.id,
      visible: true,
      collapsed: this.config.defaultCollapsed || false,
      size: this.config.defaultSize || 18,
    };
  }
}
