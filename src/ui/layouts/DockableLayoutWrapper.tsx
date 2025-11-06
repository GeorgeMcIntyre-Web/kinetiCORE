// Dockable Layout Wrapper - Main docking system using dockview
// Owner: George (Architecture)

import React, { useRef, useEffect } from 'react';
import {
  DockviewReact,
  DockviewReadyEvent,
  DockviewApi,
} from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import { PANEL_REGISTRY, PanelType } from './PanelRegistry';
import './DockableLayoutWrapper.css';

export interface PanelDefinition {
  id: string;
  type: PanelType;
  title?: string;
}

export interface DockableLayoutConfig {
  leftPanels?: PanelDefinition[];
  rightPanels?: PanelDefinition[];
  bottomPanels?: PanelDefinition[];
  centerPanel?: PanelDefinition; // The main viewport/content area
  mainContent?: React.ReactNode; // Deprecated: use centerPanel instead
}

interface DockableLayoutWrapperProps {
  config: DockableLayoutConfig;
  onLayoutChange?: (layout: any) => void;
  savedLayout?: any;
  // Optional initial width for the left dock group (e.g., Scene Tree). If provided,
  // the first left panel is sized to this width and updated when the prop changes.
  leftGroupWidth?: number;
}

export const DockableLayoutWrapper: React.FC<DockableLayoutWrapperProps> = ({
  config,
  onLayoutChange,
  savedLayout,
  leftGroupWidth,
}) => {
  const apiRef = useRef<DockviewApi | null>(null);
  const leftPanelApiRef = useRef<any | null>(null);

  const components = Object.fromEntries(
    Object.entries(PANEL_REGISTRY).map(([key, panelConfig]) => [
      key,
      panelConfig.component as React.FunctionComponent<any>,
    ])
  ) as Record<string, React.FunctionComponent<any>>;

  const onReady = (event: DockviewReadyEvent) => {
    apiRef.current = event.api;

    // If we have a saved layout, restore it
    if (savedLayout) {
      try {
        event.api.fromJSON(savedLayout);
        return;
      } catch (error) {
        console.error('Failed to restore saved layout:', error);
      }
    }

    // Otherwise, create default layout
    createDefaultLayout(event.api);
  };

  const createDefaultLayout = (api: DockviewApi) => {
    // Add center panel first (usually the viewport) - this will be the main content area
    if (config.centerPanel) {
      api.addPanel({
        id: config.centerPanel.id,
        component: config.centerPanel.type,
        title: config.centerPanel.title || PANEL_REGISTRY[config.centerPanel.type].title,
        params: {},
      });
    }

    // Add left panels as a group on the left side
    if (config.leftPanels && config.leftPanels.length > 0) {
      const [firstPanel, ...restPanels] = config.leftPanels;

      // Add first panel to create the left group (240px - matching Essential Mode)
      const leftPanel = api.addPanel({
        id: firstPanel.id,
        component: firstPanel.type,
        title: firstPanel.title || PANEL_REGISTRY[firstPanel.type].title,
        params: {},
        position: { direction: 'left' },
      });
      // Remember API handle for later updates
      leftPanelApiRef.current = leftPanel.api;
      // Apply initial width if provided, otherwise fall back to compact default
      if (typeof leftGroupWidth === 'number' && isFinite(leftGroupWidth) && leftGroupWidth > 0) {
        leftPanel.api.setSize({ width: leftGroupWidth });
      } else if (leftPanel.api.width > 240) {
        leftPanel.api.setSize({ width: 240 });
      }

      // Add remaining left panels to the same group (they will be inactive tabs)
      for (const panelDef of restPanels) {
        api.addPanel({
          id: panelDef.id,
          component: panelDef.type,
          title: panelDef.title || PANEL_REGISTRY[panelDef.type].title,
          params: {},
          position: { referencePanel: leftPanel.id },
        });
      }

      // Ensure first panel (Scene Tree) is active
      leftPanel.api.setActive();
    }

    // Add right panels as a group on the right side
    if (config.rightPanels && config.rightPanels.length > 0) {
      const [firstPanel, ...restPanels] = config.rightPanels;

      // Add first panel to create the right group - keep title for now, CSS will hide text
      const rightPanel = api.addPanel({
        id: firstPanel.id,
        component: firstPanel.type,
        title: firstPanel.title || PANEL_REGISTRY[firstPanel.type].title,
        params: {},
        position: { direction: 'right' },
      });

      // Add icon class for CSS styling
      if (PANEL_REGISTRY[firstPanel.type].titleIcon) {
        rightPanel.api.updateParameters({ iconType: firstPanel.type });
      }

      // Calculate width based on icon-only tabs (much narrower)
      // Icon size: 16px + padding: 8px left/right = 16px per tab
      // Close button: ~20px per tab
      // Tab separator: ~2px between tabs
      const ICON_SIZE = 16;
      const TAB_PADDING = 16; // 8px left + 8px right (reduced for icons)
      const CLOSE_BUTTON = 20;
      const TAB_SEPARATOR = 2;
      const MIN_TAB_WIDTH = 40; // Reduced for icon-only
      const MIN_GROUP_WIDTH = 120; // Reduced minimum

      let totalTabWidth = 0;
      for (let i = 0; i < config.rightPanels.length; i++) {
        const tabWidth = Math.max(MIN_TAB_WIDTH, ICON_SIZE + TAB_PADDING + CLOSE_BUTTON);
        totalTabWidth += tabWidth + TAB_SEPARATOR;
      }

      // Reduce width by 0.5 (50%)
      const calculatedWidth = Math.max(MIN_GROUP_WIDTH, totalTabWidth * 0.5);
      if (rightPanel.api.width < calculatedWidth) {
        rightPanel.api.setSize({ width: calculatedWidth });
      }

      // Add remaining right panels to the same group (they will be inactive tabs)
      for (const panelDef of restPanels) {
        const panel = api.addPanel({
          id: panelDef.id,
          component: panelDef.type,
          title: panelDef.title || PANEL_REGISTRY[panelDef.type].title,
          params: {},
          position: { referencePanel: rightPanel.id },
        });

        // Add icon class for CSS styling
        if (PANEL_REGISTRY[panelDef.type].titleIcon) {
          panel.api.updateParameters({ iconType: panelDef.type });
        }
      }

      // Ensure first panel (Warehouse) is active by default
      rightPanel.api.setActive();
    }

    // Add bottom panels as a group at the bottom
    if (config.bottomPanels && config.bottomPanels.length > 0) {
      const [firstPanel, ...restPanels] = config.bottomPanels;

      // Add first panel to create the bottom group
      const bottomPanel = api.addPanel({
        id: firstPanel.id,
        component: firstPanel.type,
        title: firstPanel.title || PANEL_REGISTRY[firstPanel.type].title,
        params: {},
        position: { direction: 'below' },
      });

      // Add remaining bottom panels to the same group
      for (const panelDef of restPanels) {
        api.addPanel({
          id: panelDef.id,
          component: panelDef.type,
          title: panelDef.title || PANEL_REGISTRY[panelDef.type].title,
          params: {},
          position: { referencePanel: bottomPanel.id },
        });
      }
    }
  };

  // React to leftGroupWidth updates after layout is ready
  useEffect(() => {
    if (leftPanelApiRef.current && typeof leftGroupWidth === 'number' && isFinite(leftGroupWidth) && leftGroupWidth > 0) {
      try {
        leftPanelApiRef.current.setSize({ width: leftGroupWidth });
      } catch (e) {
        console.warn('[DockableLayoutWrapper] Failed to update left group width:', e);
      }
    }
  }, [leftGroupWidth]);

  useEffect(() => {
    if (!apiRef.current) return;

    const handleLayoutChange = () => {
      if (apiRef.current && onLayoutChange) {
        const layout = apiRef.current.toJSON();
        onLayoutChange(layout);
      }
    };

    // Listen for layout changes
    const disposables = [
      apiRef.current.onDidLayoutChange(handleLayoutChange),
      apiRef.current.onDidAddPanel(handleLayoutChange),
      apiRef.current.onDidRemovePanel(handleLayoutChange),
    ];

    return () => {
      disposables.forEach((d) => d.dispose());
    };
  }, [onLayoutChange]);

  return (
    <div className="dockable-layout-wrapper">
      {/* Main content (viewport) - rendered behind dockview */}
      {config.mainContent && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
        }}>
          {config.mainContent}
        </div>
      )}

      {/* Dockview panels - overlays on top with transparent areas */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
      }}>
        <DockviewReact
          className="dockview-theme-kineticore"
          components={components}
          onReady={onReady}
          disableFloatingGroups={false}
          defaultTabComponent={undefined}
          watermarkComponent={() => null}
        />
      </div>
    </div>
  );
};
