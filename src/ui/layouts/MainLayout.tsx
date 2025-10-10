// MainLayout - Main application layout using the panel system
// Owner: George (Architecture)

import React, { useEffect } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X } from 'lucide-react';
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
  const { panelStates, setPanelState, togglePanelCollapse, setPanelVisibility } = useLayoutStore();

  // Register panels synchronously - not in useEffect
  if (registry.getPanelCount() === 0) {
    registry.register(new InspectorPanel());
    registry.register(new SceneTreePanel());
    registry.register(new ToolbarPanel());
    
    console.log('Panels registered:', registry.getPanelCount());
  }

  // Get panels visible for current user level
  const visiblePanels = registry.getVisiblePanelsForUserLevel(userLevel);
  
  const leftPanels = visiblePanels.filter(p => p.getPosition() === 'left');
  const rightPanels = visiblePanels.filter(p => p.getPosition() === 'right');
  const topPanels = visiblePanels.filter(p => p.getPosition() === 'top');

  // Calculate center panel size dynamically
  const leftPanelSize = leftPanels.reduce((sum, panel) => {
    const state = panelStates[panel.getId()];
    if (state?.visible !== false) { // Include if visible (default to true)
      return sum + (state?.size || panel.getDefaultSize());
    }
    return sum;
  }, 0);
  
  const rightPanelSize = rightPanels.reduce((sum, panel) => {
    const state = panelStates[panel.getId()];
    if (state?.visible !== false) { // Include if visible (default to true)
      return sum + (state?.size || panel.getDefaultSize());
    }
    return sum;
  }, 0);
  
  const centerPanelSize = Math.max(40, 100 - leftPanelSize - rightPanelSize);

  // Debug logging
  console.log('Layout calculation:', {
    leftPanelSize,
    rightPanelSize,
    centerPanelSize,
    leftPanels: leftPanels.length,
    rightPanels: rightPanels.length,
    userLevel,
    visiblePanels: visiblePanels.length,
    allPanels: registry.getAll().length,
    panelDetails: visiblePanels.map(p => ({
      id: p.getId(),
      name: p.getName(),
      position: p.getPosition(),
      userLevels: p.getConfig().userLevels
    }))
  });

  // Additional detailed logging
  console.log('Panel details:', visiblePanels.map(p => ({
    id: p.getId(),
    name: p.getName(),
    position: p.getPosition(),
    userLevels: p.getConfig().userLevels,
    isVisibleForUserLevel: p.isVisibleForUserLevel(userLevel)
  })));

  console.log('Left panels:', leftPanels.map(p => p.getName()));
  console.log('Right panels:', rightPanels.map(p => p.getName()));

  // Initialize panel states synchronously - not in useEffect
  visiblePanels.forEach(panel => {
    if (!panelStates[panel.getId()]) {
      setPanelState(panel.getId(), panel.getDefaultState());
    }
  });

  // Panel control functions
  const handlePanelToggle = (panelId: string) => {
    togglePanelCollapse(panelId);
  };

  const handlePanelClose = (panelId: string) => {
    setPanelVisibility(panelId, false);
  };

  const getPanelIcon = (position: string) => {
    switch (position) {
      case 'left': return <ChevronLeft size={16} />;
      case 'right': return <ChevronRight size={16} />;
      case 'top': return <ChevronUp size={16} />;
      case 'bottom': return <ChevronDown size={16} />;
      default: return <ChevronLeft size={16} />;
    }
  };

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
            const isVisible = state?.visible !== false; // Default to visible if not set
            console.log(`Left panel ${panel.getName()}:`, { isVisible, state });
            if (!isVisible) return null;
            
            // Use default state if state is undefined
            const panelState = state || panel.getDefaultState();
            
            return (
              <React.Fragment key={panel.getId()}>
                <Panel
                  defaultSize={panelState.size}
                  minSize={panel.getMinSize()}
                  maxSize={panel.getMaxSize()}
                  collapsible={panel.canCollapse()}
                  collapsed={panelState.collapsed}
                >
                  <div className="panel-container">
                    <div className="panel-header">
                      <h3>{panel.getName()}</h3>
                      <div className="panel-controls">
                        {panel.canCollapse() && (
                          <button
                            className="panel-control-btn"
                            onClick={() => handlePanelToggle(panel.getId())}
                            title={state.collapsed ? 'Expand panel' : 'Collapse panel'}
                          >
                            {getPanelIcon(panel.getPosition())}
                          </button>
                        )}
                        <button
                          className="panel-control-btn close-btn"
                          onClick={() => handlePanelClose(panel.getId())}
                          title="Close panel"
                        >
                          <X size={14} />
                        </button>
                      </div>
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
          <Panel defaultSize={centerPanelSize} minSize={40}>
            <div className="viewport-container">
              <SceneCanvas />
            </div>
          </Panel>

          {/* Right Sidebar */}
          {rightPanels.map(panel => {
            const state = panelStates[panel.getId()];
            const isVisible = state?.visible !== false; // Default to visible if not set
            console.log(`Right panel ${panel.getName()}:`, { isVisible, state });
            if (!isVisible) return null;
            
            // Use default state if state is undefined
            const panelState = state || panel.getDefaultState();
            
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
                      <div className="panel-controls">
                        {panel.canCollapse() && (
                          <button
                            className="panel-control-btn"
                            onClick={() => handlePanelToggle(panel.getId())}
                            title={state.collapsed ? 'Expand panel' : 'Collapse panel'}
                          >
                            {getPanelIcon(panel.getPosition())}
                          </button>
                        )}
                        <button
                          className="panel-control-btn close-btn"
                          onClick={() => handlePanelClose(panel.getId())}
                          title="Close panel"
                        >
                          <X size={14} />
                        </button>
                      </div>
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
