/**
 * MJCF Kinematic System Integration
 * Owner: George & Edwin
 * 
 * Main integration component that brings together all the MJCF kinematic system components
 * Follows the systematic button process and design system
 */

import { useState } from 'react';
import { DeviceLibrary } from './DeviceLibrary';
import { ActuatorControlPanel } from './ActuatorControlPanel';
import { PhysicsSettings } from './PhysicsSettings';
import { CollisionVisualizer } from './CollisionVisualizer';
import { ButtonSystemInitializer } from './ButtonSystemInitializer';

export interface MJCFIntegrationProps {
  className?: string;
}

export function MJCFIntegration({ className }: MJCFIntegrationProps) {
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [collisionVisualizerEnabled, setCollisionVisualizerEnabled] = useState(false);

  const handleOpenDeviceLibrary = () => {
    console.log('[MJCFIntegration] Opening device library');
    setActivePanel(activePanel === 'deviceLibrary' ? null : 'deviceLibrary');
  };

  const handleOpenActuatorControl = () => {
    console.log('[MJCFIntegration] Opening actuator control panel');
    setActivePanel(activePanel === 'actuatorControl' ? null : 'actuatorControl');
  };

  const handleOpenPhysicsSettings = () => {
    console.log('[MJCFIntegration] Opening physics settings');
    setActivePanel(activePanel === 'physicsSettings' ? null : 'physicsSettings');
  };

  const handleToggleCollisionVisualizer = () => {
    console.log('[MJCFIntegration] Toggling collision visualizer');
    setCollisionVisualizerEnabled(!collisionVisualizerEnabled);
  };

  const handleClosePanel = () => {
    setActivePanel(null);
  };

  return (
    <div className={`mjcf-integration ${className || ''}`}>
      {/* Initialize Button System */}
      <ButtonSystemInitializer />
      
      {/* Collision Visualizer Overlay */}
      {collisionVisualizerEnabled && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <CollisionVisualizer />
        </div>
      )}

      {/* Panel Container */}
      <div className="panel-container">
        {/* Device Library Panel */}
        {activePanel === 'deviceLibrary' && (
          <div className="fixed top-4 right-4 w-96 h-[calc(100vh-2rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-40">
            <DeviceLibrary />
          </div>
        )}

        {/* Actuator Control Panel */}
        {activePanel === 'actuatorControl' && (
          <div className="fixed top-4 right-4 w-96 h-[calc(100vh-2rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-40">
            <ActuatorControlPanel />
          </div>
        )}

        {/* Physics Settings Panel */}
        {activePanel === 'physicsSettings' && (
          <div className="fixed top-4 right-4 w-96 h-[calc(100vh-2rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-40">
            <PhysicsSettings />
          </div>
        )}
      </div>

      {/* Panel Controls */}
      <div className="fixed bottom-4 right-4 z-30">
        <div className="flex flex-col space-y-2">
          <button
            onClick={handleOpenDeviceLibrary}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activePanel === 'deviceLibrary'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            📚 Device Library
          </button>
          
          <button
            onClick={handleOpenActuatorControl}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activePanel === 'actuatorControl'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            🎮 Actuator Control
          </button>
          
          <button
            onClick={handleOpenPhysicsSettings}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activePanel === 'physicsSettings'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            ⚙️ Physics Settings
          </button>
          
          <button
            onClick={handleToggleCollisionVisualizer}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              collisionVisualizerEnabled
                ? 'bg-red-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            💥 Collision Visualizer
          </button>
        </div>
      </div>

      {/* Close Panel Button */}
      {activePanel && (
        <button
          onClick={handleClosePanel}
          className="fixed top-6 right-6 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold hover:bg-red-700 transition-colors duration-200 z-50"
          aria-label="Close panel"
        >
          ×
        </button>
      )}
    </div>
  );
}

// Export individual components for use in other parts of the application
export {
  DeviceLibrary,
  ActuatorControlPanel,
  PhysicsSettings,
  CollisionVisualizer,
  ButtonSystemInitializer
};
