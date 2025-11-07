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

// Helper function to modify saved layout JSON to update right panel width
const modifyLayoutWidth = (layout: any, targetWidth: number, rightPanelIds: string[]): any => {
  if (!layout || typeof layout !== 'object') return layout;
  
  try {
    const layoutStr = JSON.stringify(layout);
    const layoutObj = JSON.parse(layoutStr);
    
    // Recursively find and update width in the layout structure
    const updateWidthRecursive = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(updateWidthRecursive);
      }
      
      const updated = { ...obj };
      
      // Check if this is a panel/group that might be the right panel
      if (updated.id && rightPanelIds.includes(updated.id)) {
        if (updated.size) {
          updated.size = { ...updated.size, width: targetWidth };
        }
        // Also check for width property directly
        if (updated.width) {
          updated.width = targetWidth;
        }
      }
      
      // Check for groups containing right panels
      if (updated.views && Array.isArray(updated.views)) {
        updated.views = updated.views.map((view: any) => {
          if (view.id && rightPanelIds.includes(view.id)) {
            return {
              ...view,
              size: view.size ? { ...view.size, width: targetWidth } : { width: targetWidth },
              width: targetWidth,
            };
          }
          return updateWidthRecursive(view);
        });
      }
      
      // Recursively update nested objects
      for (const key in updated) {
        if (updated[key] && typeof updated[key] === 'object' && key !== 'views') {
          updated[key] = updateWidthRecursive(updated[key]);
        }
      }
      
      return updated;
    };
    
    return updateWidthRecursive(layoutObj);
  } catch (e) {
    console.warn('[DockableLayoutWrapper] Failed to modify layout width:', e);
    return layout;
  }
};

export const DockableLayoutWrapper: React.FC<DockableLayoutWrapperProps> = ({
  config,
  onLayoutChange,
  savedLayout,
  leftGroupWidth,
}) => {
  const apiRef = useRef<DockviewApi | null>(null);
  const leftPanelApiRef = useRef<any | null>(null);
  const rightPanelApiRef = useRef<any | null>(null);

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
        // Modify saved layout to update right panel width to 300px BEFORE restoring
        const rightPanelIds = config.rightPanels?.map(p => p.id) || [];
        const modifiedLayout = modifyLayoutWidth(savedLayout, 300, rightPanelIds);
        event.api.fromJSON(modifiedLayout);
        // Immediately enforce width after restore (no delay)
        requestAnimationFrame(() => {
          if (config.rightPanels && config.rightPanels.length > 0) {
            const firstRightPanelId = config.rightPanels[0].id;
            const panel = event.api.getPanel(firstRightPanelId);
            if (panel) {
              rightPanelApiRef.current = panel.api;
              panel.api.setSize({ width: 300 });
            }
          }
        });
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

      // Add first panel to create the right group
      const rightPanel = api.addPanel({
        id: firstPanel.id,
        component: firstPanel.type,
        title: firstPanel.title || PANEL_REGISTRY[firstPanel.type].title,
        params: {},
        position: { direction: 'right' },
      });

      // Remember API handle for later updates
      rightPanelApiRef.current = rightPanel.api;

      // Set right panel width to 300px IMMEDIATELY - no delay
      // Use requestAnimationFrame to ensure DOM is ready but without visible delay
      requestAnimationFrame(() => {
        rightPanel.api.setSize({ width: 300 });
      });

      // Add remaining right panels to the same group (they will be inactive tabs)
      for (const panelDef of restPanels) {
        api.addPanel({
          id: panelDef.id,
          component: panelDef.type,
          title: panelDef.title || PANEL_REGISTRY[panelDef.type].title,
          params: {},
          position: { referencePanel: rightPanel.id },
        });
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

  // Ensure right panel width is 300px after layout is ready (backup enforcement)
  useEffect(() => {
    if (!apiRef.current) return;
    
    const updateRightPanelWidth = () => {
      try {
        if (config.rightPanels && config.rightPanels.length > 0 && apiRef.current) {
          const firstRightPanelId = config.rightPanels[0].id;
          const panel = apiRef.current.getPanel(firstRightPanelId);
          if (panel && panel.api.width !== 300) {
            panel.api.setSize({ width: 300 });
            rightPanelApiRef.current = panel.api;
          }
        }
      } catch (e) {
        // Silently fail - don't spam console
      }
    };

    // Single immediate check as backup (primary enforcement happens in onReady)
    requestAnimationFrame(updateRightPanelWidth);
  }, [config.rightPanels]);

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

      // AGGRESSIVE PADDING REMOVAL - Force zero padding/margin on right panel tabs
      const rightGroup = document.querySelector('.dv-group:last-of-type');
      if (rightGroup) {
        // Hide overflow menu buttons completely
        const overflowButtons = rightGroup.querySelectorAll('[class*="overflow"], [aria-label*="overflow"], [aria-label*="More"]');
        overflowButtons.forEach(btn => {
          if (btn instanceof HTMLElement) {
            btn.style.display = 'none';
            btn.style.visibility = 'hidden';
            btn.style.width = '0';
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none';
          }
        });

        // Remove padding from all tab elements - NUCLEAR OPTION using setProperty with priority
        const tabs = rightGroup.querySelectorAll('.dv-default-tab');
        console.log(`[DockableLayoutWrapper] Found ${tabs.length} tabs in right panel`);
        tabs.forEach((tab, index) => {
          if (tab instanceof HTMLElement) {
            console.log(`[DockableLayoutWrapper] Processing tab ${index}: ${tab.textContent?.trim()}`);

            // Use setProperty with 'important' priority - most aggressive approach
            tab.style.setProperty('padding', '0 2px', 'important');
            tab.style.setProperty('margin', '0', 'important');
            tab.style.setProperty('gap', '0', 'important');
            tab.style.setProperty('column-gap', '0', 'important');
            tab.style.setProperty('row-gap', '0', 'important');
            tab.style.setProperty('flex-grow', '0', 'important');
            tab.style.setProperty('flex-shrink', '0', 'important');
            tab.style.setProperty('width', 'auto', 'important');
            tab.style.setProperty('max-width', 'fit-content', 'important');

            // CRITICAL FIX: Disable flex-grow on tab content wrapper
            const tabContent = tab.querySelector('.dv-default-tab-content');
            if (tabContent instanceof HTMLElement) {
              tabContent.style.setProperty('flex-grow', '0', 'important');
              tabContent.style.setProperty('flex-shrink', '1', 'important');
              tabContent.style.setProperty('flex-basis', 'auto', 'important');
              tabContent.style.setProperty('width', 'auto', 'important');
              tabContent.style.setProperty('max-width', 'fit-content', 'important');
              tabContent.style.setProperty('padding', '0', 'important');
              tabContent.style.setProperty('margin', '0', 'important');
            }

            // Force all child elements to have zero spacing
            Array.from(tab.children).forEach(child => {
              if (child instanceof HTMLElement && !child.classList.contains('dv-tab-close')) {
                child.style.setProperty('padding', '0', 'important');
                child.style.setProperty('margin', '0', 'important');
                child.style.setProperty('flex-grow', '0', 'important');
                child.style.setProperty('width', 'auto', 'important');
                child.style.setProperty('max-width', 'fit-content', 'important');
              }
            });

            // Target tab action container (close button wrapper)
            const tabAction = tab.querySelector('.dv-default-tab-action');
            if (tabAction instanceof HTMLElement) {
              tabAction.style.setProperty('flex-grow', '0', 'important');
              tabAction.style.setProperty('flex-shrink', '0', 'important');
              tabAction.style.setProperty('margin-left', '0', 'important');
              tabAction.style.setProperty('padding', '0', 'important');
            }

            // Add minimal gap between text and close button
            const closeBtn = tab.querySelector('.dv-tab-close');
            if (closeBtn instanceof HTMLElement) {
              closeBtn.style.setProperty('margin-left', '0px', 'important');
              closeBtn.style.setProperty('margin-right', '0', 'important');
              closeBtn.style.setProperty('padding', '0', 'important');
            }
          }
        });

        // Remove padding from tab containers
        const containers = rightGroup.querySelectorAll('.dv-tabs-container, .dv-tabs-and-actions-container, .dv-scrollable, .dv-tab');
        containers.forEach(container => {
          if (container instanceof HTMLElement) {
            container.style.padding = '0';
            container.style.paddingRight = '0';
            container.style.margin = '0';
            container.style.marginRight = '0';
          }
        });

        // Set minimal gap between tabs
        const tabsContainer = rightGroup.querySelector('.dv-tabs-container');
        if (tabsContainer instanceof HTMLElement) {
          tabsContainer.style.gap = '2px';
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Initial pass to set icons AND enforce compact styling - multiple retries
    const setIconsAndCompactStyling = () => {
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

      // ENFORCE COMPACT STYLING ON RIGHT PANEL TABS
      const rightGroup = document.querySelector('.dv-group:last-of-type');
      if (rightGroup) {
        // Hide overflow buttons
        const overflowButtons = rightGroup.querySelectorAll('[class*="overflow"], [aria-label*="overflow"], [aria-label*="More"]');
        overflowButtons.forEach(btn => {
          if (btn instanceof HTMLElement) {
            btn.style.display = 'none';
            btn.style.visibility = 'hidden';
            btn.style.width = '0';
          }
        });

        // Compact tab styling - NUCLEAR OPTION using setProperty with priority
        const tabs = rightGroup.querySelectorAll('.dv-default-tab');
        tabs.forEach(tab => {
          if (tab instanceof HTMLElement) {
            tab.style.setProperty('padding', '0 2px', 'important');
            tab.style.setProperty('margin', '0', 'important');
            tab.style.setProperty('gap', '0', 'important');
            tab.style.setProperty('flex-grow', '0', 'important');
            tab.style.setProperty('flex-shrink', '0', 'important');
            tab.style.setProperty('width', 'auto', 'important');
            tab.style.setProperty('max-width', 'fit-content', 'important');

            // CRITICAL: Disable flex-grow on tab content wrapper
            const tabContent = tab.querySelector('.dv-default-tab-content');
            if (tabContent instanceof HTMLElement) {
              tabContent.style.setProperty('flex-grow', '0', 'important');
              tabContent.style.setProperty('flex-shrink', '1', 'important');
              tabContent.style.setProperty('width', 'auto', 'important');
              tabContent.style.setProperty('max-width', 'fit-content', 'important');
              tabContent.style.setProperty('padding', '0', 'important');
              tabContent.style.setProperty('margin', '0', 'important');
            }

            Array.from(tab.children).forEach(child => {
              if (child instanceof HTMLElement && !child.classList.contains('dv-tab-close')) {
                child.style.setProperty('padding', '0', 'important');
                child.style.setProperty('margin', '0', 'important');
                child.style.setProperty('flex-grow', '0', 'important');
                child.style.setProperty('width', 'auto', 'important');
                child.style.setProperty('max-width', 'fit-content', 'important');
              }
            });

            // Tab action container
            const tabAction = tab.querySelector('.dv-default-tab-action');
            if (tabAction instanceof HTMLElement) {
              tabAction.style.setProperty('flex-grow', '0', 'important');
              tabAction.style.setProperty('margin-left', '0', 'important');
              tabAction.style.setProperty('padding', '0', 'important');
            }

            const closeBtn = tab.querySelector('.dv-tab-close');
            if (closeBtn instanceof HTMLElement) {
              closeBtn.style.setProperty('margin-left', '0px', 'important');
            }
          }
        });

        // Remove container padding
        const containers = rightGroup.querySelectorAll('.dv-tabs-container, .dv-tabs-and-actions-container');
        containers.forEach(container => {
          if (container instanceof HTMLElement) {
            container.style.padding = '0';
            container.style.margin = '0';
          }
        });

        const tabsContainer = rightGroup.querySelector('.dv-tabs-container');
        if (tabsContainer instanceof HTMLElement) {
          tabsContainer.style.gap = '2px';
        }
      }
    };
    
    setTimeout(setIconsAndCompactStyling, 100);
    setTimeout(setIconsAndCompactStyling, 500);
    setTimeout(setIconsAndCompactStyling, 1000);
    setTimeout(setIconsAndCompactStyling, 2000);

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
