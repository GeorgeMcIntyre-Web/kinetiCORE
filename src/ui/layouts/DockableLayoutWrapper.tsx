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

  // Helper function to get icon path for right panel tabs
  const getIconPath = (panelType: PanelType): string | null => {
    const iconMap: Record<string, string> = {
      'warehouse': '/icons/Warehouse.png',
      'routingControl': '/icons/RoutingControl.png',
      'routeStats': '/icons/Route Statistics.png',
      'inspector': '/icons/inspector.png',
    };
    return iconMap[panelType] || null;
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

      // Add first panel to create the right group
      const iconPath = getIconPath(firstPanel.type);
      const rightPanel = api.addPanel({
        id: firstPanel.id,
        component: firstPanel.type,
        title: iconPath ? '⬜' : (firstPanel.title || PANEL_REGISTRY[firstPanel.type].title), // White square placeholder for icon tabs
        params: { iconPath, panelTitle: PANEL_REGISTRY[firstPanel.type].title },
        position: { direction: 'right' },
      });

      // Set right panel width to 120px as requested
      rightPanel.api.setSize({ width: 120 });

      // Add remaining right panels to the same group (they will be inactive tabs)
      for (const panelDef of restPanels) {
        const iconPath = getIconPath(panelDef.type);
        api.addPanel({
          id: panelDef.id,
          component: panelDef.type,
          title: iconPath ? '⬜' : (panelDef.title || PANEL_REGISTRY[panelDef.type].title), // White square placeholder for icon tabs
          params: { iconPath, panelTitle: PANEL_REGISTRY[panelDef.type].title },
          position: { referencePanel: rightPanel.id },
        });
      }

      // Ensure first panel (Warehouse) is active by default
      rightPanel.api.setActive();

      // Apply icons with retry logic
      const applyIcons = (attempt = 1, maxAttempts = 10) => {
        // Debug: Log all groups
        const allGroups = document.querySelectorAll('.dv-group');
        console.log(`[DockableLayoutWrapper] 🔍 Attempt ${attempt}: Found ${allGroups.length} groups`);

        if (allGroups.length === 0 && attempt < maxAttempts) {
          // Retry after delay if groups haven't rendered yet
          setTimeout(() => applyIcons(attempt + 1, maxAttempts), 200);
          return;
        }

        allGroups.forEach((group, i) => {
          const tabs = group.querySelectorAll('.dv-default-tab');
          console.log(`[DockableLayoutWrapper] 🔍 Group ${i}: ${tabs.length} tabs`);
        });

        // Apply icons directly to right panel tabs
        let successCount = 0;
        config.rightPanels?.forEach((panelDef, index) => {
          const iconPath = getIconPath(panelDef.type);
          if (!iconPath) return;

          const panelElement = document.querySelector(`[data-panel-id="${panelDef.id}"]`);
          if (panelElement) {
            const tabElement = panelElement.closest('.dv-default-tab') as HTMLElement;
            if (tabElement) {
              // Apply icon directly via JavaScript
              tabElement.style.backgroundImage = `url("${iconPath}")`;
              tabElement.style.backgroundRepeat = 'no-repeat';
              tabElement.style.backgroundPosition = 'center';
              tabElement.style.backgroundSize = '16px 16px';
              tabElement.style.fontSize = '0';
              tabElement.style.lineHeight = '0';
              console.log(`[DockableLayoutWrapper] ✅ Applied icon for ${panelDef.type}: ${iconPath}`);
              successCount++;
            }
          }
        });

        // Retry if we didn't find all panels yet
        if (successCount < (config.rightPanels?.length || 0) && attempt < maxAttempts) {
          console.log(`[DockableLayoutWrapper] ⚠️ Only applied ${successCount}/${config.rightPanels?.length} icons, retrying...`);
          setTimeout(() => applyIcons(attempt + 1, maxAttempts), 200);
        } else {
          console.log(`[DockableLayoutWrapper] 🎉 Icon application complete: ${successCount}/${config.rightPanels?.length} icons applied`);
        }
      };

      // Start applying icons after a short initial delay
      setTimeout(() => applyIcons(), 100);
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
      apiRef.current.onDidAddPanel((event) => {
        handleLayoutChange();
        // Set icon attributes when panels are added
        const panelType = config.rightPanels?.find(p => p.id === event.id)?.type ||
                         config.leftPanels?.find(p => p.id === event.id)?.type;
        if (panelType && PANEL_REGISTRY[panelType]) {
          setTimeout(() => {
            const tabElement = Array.from(document.querySelectorAll('.dv-default-tab')).find(tab => 
              tab.textContent?.includes(PANEL_REGISTRY[panelType].title)
            );
            if (tabElement) {
              (tabElement as HTMLElement).setAttribute('data-icon-type', panelType);
            }
          }, 100);
        }
      }),
      apiRef.current.onDidRemovePanel(handleLayoutChange),
    ];

    // Also use MutationObserver to catch tabs as they're created
    const observer = new MutationObserver(() => {
      // Set icon attributes on all right panel tabs
      if (config.rightPanels) {
        config.rightPanels.forEach(panelDef => {
          const title = PANEL_REGISTRY[panelDef.type]?.title || '';
          if (!title) return;
          
          // Find tabs in right panel group
          const rightGroup = document.querySelector('.dv-group[data-direction="right"]');
          if (!rightGroup) return;
          
          const allTabs = Array.from(rightGroup.querySelectorAll('.dv-default-tab'));
          const tabElement = allTabs.find(tab => {
            const text = tab.textContent || '';
            const hasIcon = (tab as HTMLElement).hasAttribute('data-icon-type');
            return text.includes(title) && text.trim().length < 50 && !hasIcon;
          }) as HTMLElement | undefined;
          
          if (tabElement) {
            tabElement.setAttribute('data-icon-type', panelDef.type);
            tabElement.setAttribute('title', title);
            console.log(`[DockableLayoutWrapper] MutationObserver set icon for ${panelDef.type}: ${title}`);
          }
        });
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Initial pass to set icons - multiple retries
    const setIconsInitial = () => {
      if (config.rightPanels) {
        config.rightPanels.forEach(panelDef => {
          const title = PANEL_REGISTRY[panelDef.type]?.title || '';
          if (!title) return;
          
          const rightGroup = document.querySelector('.dv-group[data-direction="right"]');
          if (!rightGroup) return;
          
          const allTabs = Array.from(rightGroup.querySelectorAll('.dv-default-tab'));
          const tabElement = allTabs.find(tab => {
            const text = tab.textContent || '';
            return text.includes(title) && text.trim().length < 50;
          }) as HTMLElement | undefined;
          
          if (tabElement) {
            tabElement.setAttribute('data-icon-type', panelDef.type);
            tabElement.setAttribute('title', title);
            console.log(`[DockableLayoutWrapper] Initial set icon for ${panelDef.type}: ${title}`);
          }
        });
      }
    };
    
    setTimeout(setIconsInitial, 100);
    setTimeout(setIconsInitial, 500);
    setTimeout(setIconsInitial, 1000);
    setTimeout(setIconsInitial, 2000);

    return () => {
      disposables.forEach((d) => d.dispose());
      observer.disconnect();
    };
  }, [onLayoutChange, config]);

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
