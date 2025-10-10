// Header component with user level selector
// Owner: George (Architecture)

import React from 'react';
import { useUserLevel } from '../core/UserLevelContext';
import './Header.css';

export const Header: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();

  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="logo">kinetiCORE</h1>
        <p className="tagline">Web-based 3D Industrial Simulation Platform</p>
      </div>

      <div className="header-center">
        {/* Future: Add workspace selector, breadcrumbs, etc. */}
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
