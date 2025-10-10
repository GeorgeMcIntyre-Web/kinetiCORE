// MainLayout - Main application layout using the panel system
// Owner: George (Architecture)

import React, { useEffect } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { PanelRegistry } from '../core/PanelRegistry';
import { useUserLevel } from '../core/UserLevelContext';
import { useLayoutStore } from '../core/LayoutManager';
import { InspectorPanel } from '../panels/InspectorPanel';
import { SceneTreePanel } from '../panels/SceneTreePanel';
import { ToolbarPanel } from '../panels/ToolbarPanel';
import { Header } from '../components/Header';
import { SceneCanvas } from '../components/SceneCanvas';
import './MainLayout.css';

export const MainLayout: React.FC = () => {
  const { userLevel } = useUserLevel();
  const registry = PanelRegistry.getInstance();
  const { panelStates, setPanelState } = useLayoutStore();

  // Register panels on mount
  useEffect(() => {
    registry.register(new InspectorPanel());
    registry.register(new SceneTreePanel());
    registry.register(new ToolbarPanel());
    
    console.log('Panels registered:', registry.getPanelCount());
    
    return () => {
      registry.clear();
    };
  }, [registry]);

  // Get panels visible for current user level
  const visiblePanels = registry.getVisiblePanelsForUserLevel(userLevel);
  
  const leftPanels = visiblePanels.filter(p => p.getPosition() === 'left');
  const rightPanels = visiblePanels.filter(p => p.getPosition() === 'right');
  const topPanels = visiblePanels.filter(p => p.getPosition() === 'top');

  // Initialize panel states if not present
  useEffect(() => {
    visiblePanels.forEach(panel => {
      if (!panelStates[panel.getId()]) {
        setPanelState(panel.getId(), panel.getDefaultState());
      }
    });
  }, [visiblePanels, panelStates, setPanelState]);

  return (
    <div className="main-layout">
      {/* Header */}
      <Header />

      {/* Top Panels (Toolbar) */}
      {topPanels.map(panel => {
        const state = panelStates[panel.getId()];
        if (!state?.visible) return null;
        
        return (
          <div key={panel.getId()} className="top-panel">
            {panel.render()}
          </div>
        );
      })}

      {/* Main Content Area */}
      <div className="main-content">
        <PanelGroup direction="horizontal">
          {/* Left Sidebar */}
          {leftPanels.map(panel => {
            const state = panelStates[panel.getId()];
            if (!state?.visible) return null;
            
            return (
              <React.Fragment key={panel.getId()}>
                <Panel
                  defaultSize={state.size}
                  minSize={panel.getMinSize()}
                  maxSize={panel.getMaxSize()}
                  collapsible={panel.canCollapse()}
                  collapsed={state.collapsed}
                >
                  <div className="panel-container">
                    <div className="panel-header">
                      <h3>{panel.getName()}</h3>
                    </div>
                    <div className="panel-content">
                      {panel.render()}
                    </div>
                  </div>
                </Panel>
                <PanelResizeHandle className="resize-handle" />
              </React.Fragment>
            );
          })}

          {/* Center Viewport */}
          <Panel defaultSize={62} minSize={40}>
            <div className="viewport-container">
              <SceneCanvas />
            </div>
          </Panel>

          {/* Right Sidebar */}
          {rightPanels.map(panel => {
            const state = panelStates[panel.getId()];
            if (!state?.visible) return null;
            
            return (
              <React.Fragment key={panel.getId()}>
                <PanelResizeHandle className="resize-handle" />
                <Panel
                  defaultSize={state.size}
                  minSize={panel.getMinSize()}
                  maxSize={panel.getMaxSize()}
                  collapsible={panel.canCollapse()}
                  collapsed={state.collapsed}
                >
                  <div className="panel-container">
                    <div className="panel-header">
                      <h3>{panel.getName()}</h3>
                    </div>
                    <div className="panel-content">
                      {panel.render()}
                    </div>
                  </div>
                </Panel>
              </React.Fragment>
            );
          })}
        </PanelGroup>
      </div>
    </div>
  );
};
