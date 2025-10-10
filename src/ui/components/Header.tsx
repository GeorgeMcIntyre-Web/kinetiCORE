// Header component with user level selector and panel controls
// Owner: George (Architecture)

import React from 'react';
import { Panel, Eye, EyeOff } from 'lucide-react';
import { useUserLevel } from '../core/UserLevelContext';
import { useLayoutStore } from '../core/LayoutManager';
import { PanelRegistry } from '../core/PanelRegistry';
import './Header.css';

export const Header: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();
  const { panelStates, setPanelVisibility } = useLayoutStore();
  const registry = PanelRegistry.getInstance();

  // Get visible panels for current user level
  const visiblePanels = registry.getVisiblePanelsForUserLevel(userLevel);
  const sidePanels = visiblePanels.filter(p => p.getPosition() === 'left' || p.getPosition() === 'right');

  console.log('Header - visiblePanels:', visiblePanels.map(p => p.getName()));
  console.log('Header - sidePanels:', sidePanels.map(p => p.getName()));

  const handlePanelToggle = (panelId: string) => {
    const currentState = panelStates[panelId];
    setPanelVisibility(panelId, !currentState?.visible);
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="logo">kinetiCORE</h1>
        <p className="tagline">Web-based 3D Industrial Simulation Platform</p>
      </div>

      <div className="header-center">
        {/* Panel Visibility Controls */}
        <div className="panel-toggles">
          {console.log('Rendering panel toggles for:', sidePanels.map(p => p.getName()))}
          {sidePanels.map(panel => {
            const state = panelStates[panel.getId()];
            const isVisible = state?.visible !== false; // Default to visible if not set
            
            console.log(`Panel ${panel.getName()} toggle:`, { isVisible, state });
            
            return (
              <button
                key={panel.getId()}
                className={`panel-toggle-btn ${isVisible ? 'active' : ''}`}
                onClick={() => handlePanelToggle(panel.getId())}
                title={`${isVisible ? 'Hide' : 'Show'} ${panel.getName()}`}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  padding: '6px 12px',
                  background: isVisible ? '#646cff' : '#2a2a3e',
                  border: '1px solid #3a3a4e',
                  borderRadius: '6px',
                  color: isVisible ? 'white' : '#a0a0a0',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                <span>{panel.getName()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="header-right">
        <div className="user-level-selector">
          <label htmlFor="user-level-select">Experience Level:</label>
          <select
            id="user-level-select"
            value={userLevel}
            onChange={(e) => {
              const newLevel = e.target.value;
              if (newLevel === 'essential' || newLevel === 'professional' || newLevel === 'expert') {
                setUserLevel(newLevel);
              }
            }}
            className="user-level-dropdown"
          >
            <option value="essential">Essential</option>
            <option value="professional">Professional</option>
            <option value="expert">Expert</option>
          </select>
        </div>
      </div>
    </header>
  );
};
