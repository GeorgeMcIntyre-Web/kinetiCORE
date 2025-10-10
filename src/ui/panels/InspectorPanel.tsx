// InspectorPanel - Wraps the existing Inspector component in BasePanel
// Owner: George (Architecture)

import React from 'react';
import { BasePanel, PanelConfig, PanelState } from '../core/BasePanel';
import { Inspector } from '../components/Inspector';

export class InspectorPanel extends BasePanel {
  constructor() {
    const config: PanelConfig = {
      id: 'inspector',
      name: 'Inspector',
      position: 'right',
      defaultSize: 20, // 20% width
      minSize: 15,
      maxSize: 35,
      resizable: true,
      collapsible: true,
      userLevels: ['essential', 'professional', 'expert'],
      workspaces: ['*'], // Available in all workspaces
      defaultCollapsed: false,
    };
    super(config);
  }

  render(): React.ReactNode {
    return <Inspector />;
  }

  getDefaultState(): PanelState {
    return {
      id: this.config.id,
      visible: true,
      collapsed: this.config.defaultCollapsed || false,
      size: this.config.defaultSize || 20,
    };
  }
}
