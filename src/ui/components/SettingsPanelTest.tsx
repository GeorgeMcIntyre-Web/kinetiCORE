/**
 * Settings Panel Integration Test
 * Owner: George
 * 
 * Test component to verify the admin panel integration in settings
 */

import React from 'react';
import { FloatingSettingsPanel } from './FloatingSettingsPanel';

export const SettingsPanelTest: React.FC = () => {
  const [showSettings, setShowSettings] = React.useState(false);

  return (
    <div className="p-4">
      <button 
        onClick={() => setShowSettings(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Open Settings Panel
      </button>
      
      {showSettings && (
        <FloatingSettingsPanel 
          isVisible={showSettings}
          onClose={() => setShowSettings(false)}
          zIndex={1000}
        />
      )}
    </div>
  );
};
