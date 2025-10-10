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
      defaultSize: 30, // Increased from 25% to 30%
      minSize: 20,
      maxSize: 40,
      resizable: true,
      collapsible: true,
      userLevels: ['essential', 'professional', 'expert'],
      workspaces: ['*'], // Available in all workspaces
      defaultCollapsed: false,
    };
    super(config);
  }

  render(): React.ReactNode {
    return <SceneTree />;
  }

  getDefaultState(): PanelState {
    return {
      id: this.config.id,
      visible: true,
      collapsed: this.config.defaultCollapsed || false,
      size: this.config.defaultSize || 30,
    };
  }
}
