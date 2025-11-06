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

      // Set data attribute for icon CSS styling (for all panels that need icons)
      rightPanel.api.updateParameters({ iconType: firstPanel.type });
      // Set data attribute on the tab element for CSS targeting - more aggressive approach
      const setIconAttribute = () => {
        requestAnimationFrame(() => {
          const title = PANEL_REGISTRY[firstPanel.type]?.title || '';
          // Try multiple selectors to find the tab
          let tabElement: HTMLElement | null = null;
          
          // Method 1: Find by panel ID
          const panelElement = document.querySelector(`[data-panel-id="${firstPanel.id}"]`);
          if (panelElement) {
            tabElement = panelElement.closest('.dv-default-tab') as HTMLElement;
          }
          
          // Method 2: Find by title text in right group
          if (!tabElement) {
            const rightGroup = document.querySelector('.dv-group[data-direction="right"]');
            if (rightGroup) {
              const allTabs = Array.from(rightGroup.querySelectorAll('.dv-default-tab'));
              tabElement = allTabs.find(tab => {
                const text = tab.textContent || '';
                return text.includes(title) && text.trim().length < 50; // Avoid matching too broadly
              }) as HTMLElement || null;
            }
          }
          
          // Method 3: Use index if we know the order
          if (!tabElement && config.rightPanels) {
            const index = config.rightPanels.findIndex(p => p.id === firstPanel.id);
            if (index >= 0) {
              const rightGroup = document.querySelector('.dv-group[data-direction="right"]');
              if (rightGroup) {
                const allTabs = Array.from(rightGroup.querySelectorAll('.dv-default-tab'));
                tabElement = allTabs[index] as HTMLElement || null;
              }
            }
          }
          
          if (tabElement) {
            tabElement.setAttribute('data-icon-type', firstPanel.type);
            tabElement.setAttribute('title', title);
            console.log(`[DockableLayoutWrapper] ✅ Set icon for ${firstPanel.type}: ${title}`);
          } else {
            console.warn(`[DockableLayoutWrapper] ⚠️ Could not find tab for ${firstPanel.type}: ${title}`);
          }
        });
      };
      // Multiple retries with increasing delays
      setTimeout(setIconAttribute, 50);
      setTimeout(setIconAttribute, 200);
      setTimeout(setIconAttribute, 500);
      setTimeout(setIconAttribute, 1000);
      setTimeout(setIconAttribute, 2000);

      // Set right panel width to 120px as requested
      rightPanel.api.setSize({ width: 120 });

      // Add remaining right panels to the same group (they will be inactive tabs)
      for (const panelDef of restPanels) {
        const panel = api.addPanel({
          id: panelDef.id,
          component: panelDef.type,
          title: panelDef.title || PANEL_REGISTRY[panelDef.type].title,
          params: {},
          position: { referencePanel: rightPanel.id },
        });

        // Set data attribute for icon CSS styling (for all panels that need icons)
        panel.api.updateParameters({ iconType: panelDef.type });
        // Set data attribute on the tab element for CSS targeting - more aggressive approach
        const setIconAttribute = () => {
          requestAnimationFrame(() => {
            const title = PANEL_REGISTRY[panelDef.type]?.title || '';
            // Try multiple selectors to find the tab
            let tabElement: HTMLElement | null = null;
            
            // Method 1: Find by panel ID
            const panelElement = document.querySelector(`[data-panel-id="${panelDef.id}"]`);
            if (panelElement) {
              tabElement = panelElement.closest('.dv-default-tab') as HTMLElement;
            }
            
            // Method 2: Find by title text in right group
            if (!tabElement) {
              const rightGroup = document.querySelector('.dv-group[data-direction="right"]');
              if (rightGroup) {
                const allTabs = Array.from(rightGroup.querySelectorAll('.dv-default-tab'));
                tabElement = allTabs.find(tab => {
                  const text = tab.textContent || '';
                  return text.includes(title) && text.trim().length < 50; // Avoid matching too broadly
                }) as HTMLElement || null;
              }
            }
            
            // Method 3: Use index if we know the order
            if (!tabElement && config.rightPanels) {
              const index = config.rightPanels.findIndex(p => p.id === panelDef.id);
              if (index >= 0) {
                const rightGroup = document.querySelector('.dv-group[data-direction="right"]');
                if (rightGroup) {
                  const allTabs = Array.from(rightGroup.querySelectorAll('.dv-default-tab'));
                  tabElement = allTabs[index] as HTMLElement || null;
                }
              }
            }
            
            if (tabElement) {
              tabElement.setAttribute('data-icon-type', panelDef.type);
              tabElement.setAttribute('title', title);
              console.log(`[DockableLayoutWrapper] ✅ Set icon for ${panelDef.type}: ${title}`);
            } else {
              console.warn(`[DockableLayoutWrapper] ⚠️ Could not find tab for ${panelDef.type}: ${title}`);
            }
          });
        };
        // Multiple retries with increasing delays
        setTimeout(setIconAttribute, 50);
        setTimeout(setIconAttribute, 200);
        setTimeout(setIconAttribute, 500);
        setTimeout(setIconAttribute, 1000);
        setTimeout(setIconAttribute, 2000);
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
