/**
 * Collision Visualizer
 * Owner: Edwin (UI Lead)
 * 
 * Color-coded collision feedback with distance labels and visual indicators
 * Follows the systematic button process and design system
 */

import { useState, useEffect } from 'react';
import { Eye, AlertTriangle, CheckCircle, Clock, Target } from 'lucide-react';
import { ButtonTemplate } from './buttons/ButtonTemplate';

export interface CollisionPair {
  id: string;
  bodyA: string;
  bodyB: string;
  clearance: number; // mm
  warningDistance: number; // mm
  isColliding: boolean;
  isNearCollision: boolean;
  contactPoints: Array<{
    x: number;
    y: number;
    z: number;
  }>;
  lastUpdate: number;
}

export interface CollisionSettings {
  enabled: boolean;
  showDistanceLabels: boolean;
  showContactPoints: boolean;
  warningThreshold: number; // mm
  collisionThreshold: number; // mm
  updateFrequency: number; // ms
}

// Mock data - in real implementation, this would come from JointCollisionManager
const MOCK_COLLISION_PAIRS: CollisionPair[] = [
  {
    id: 'finger_1_finger_2',
    bodyA: 'finger_1_joint',
    bodyB: 'finger_2_joint',
    clearance: 2.5,
    warningDistance: 10.0,
    isColliding: false,
    isNearCollision: true,
    contactPoints: [],
    lastUpdate: Date.now()
  },
  {
    id: 'gripper_base_workpiece',
    bodyA: 'gripper_base',
    bodyB: 'workpiece_1',
    clearance: 0.8,
    warningDistance: 5.0,
    isColliding: true,
    isNearCollision: true,
    contactPoints: [
      { x: 10.5, y: 2.3, z: 8.1 },
      { x: 12.1, y: 2.1, z: 7.9 }
    ],
    lastUpdate: Date.now()
  },
  {
    id: 'valve_handle_fixture',
    bodyA: 'valve_handle',
    bodyB: 'fixture_clamp',
    clearance: 15.2,
    warningDistance: 20.0,
    isColliding: false,
    isNearCollision: false,
    contactPoints: [],
    lastUpdate: Date.now()
  }
];

const MOCK_COLLISION_SETTINGS: CollisionSettings = {
  enabled: true,
  showDistanceLabels: true,
  showContactPoints: true,
  warningThreshold: 5.0,
  collisionThreshold: 1.0,
  updateFrequency: 100
};

export function CollisionVisualizer() {
  const [collisionPairs, setCollisionPairs] = useState<CollisionPair[]>(MOCK_COLLISION_PAIRS);
  const [settings, setSettings] = useState<CollisionSettings>(MOCK_COLLISION_SETTINGS);
  const [selectedPair, setSelectedPair] = useState<CollisionPair | null>(null);

  // Simulate real-time collision updates
  useEffect(() => {
    if (!settings.enabled) return;

    const interval = setInterval(() => {
      setCollisionPairs(prev => prev.map(pair => {
        // Simulate clearance changes
        const clearanceChange = (Math.random() - 0.5) * 0.5;
        const newClearance = Math.max(0, pair.clearance + clearanceChange);
        
        return {
          ...pair,
          clearance: newClearance,
          isColliding: newClearance <= settings.collisionThreshold,
          isNearCollision: newClearance <= settings.warningThreshold && newClearance > settings.collisionThreshold,
          lastUpdate: Date.now()
        };
      }));
    }, settings.updateFrequency);

    return () => clearInterval(interval);
  }, [settings.enabled, settings.updateFrequency, settings.collisionThreshold, settings.warningThreshold]);

  const handleSettingChange = (key: keyof CollisionSettings, value: any) => {
    console.log(`[CollisionVisualizer] Changed ${key}:`, value);
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handlePairSelect = (pair: CollisionPair) => {
    setSelectedPair(pair);
    console.log(`[CollisionVisualizer] Selected collision pair: ${pair.id}`);
  };

  const getCollisionStatus = (pair: CollisionPair) => {
    if (pair.isColliding) return 'collision';
    if (pair.isNearCollision) return 'warning';
    return 'safe';
  };

  const getStatusColor = (status: 'safe' | 'warning' | 'collision') => {
    switch (status) {
      case 'safe': return 'text-green-600 bg-green-100 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'collision': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = (status: 'safe' | 'warning' | 'collision') => {
    switch (status) {
      case 'safe': return <CheckCircle className="w-4 h-4" />;
      case 'warning': return <Clock className="w-4 h-4" />;
      case 'collision': return <AlertTriangle className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: 'safe' | 'warning' | 'collision') => {
    switch (status) {
      case 'safe': return 'Safe';
      case 'warning': return 'Warning';
      case 'collision': return 'Collision';
      default: return 'Unknown';
    }
  };

  const getCollisionCounts = () => {
    const counts = collisionPairs.reduce((acc, pair) => {
      const status = getCollisionStatus(pair);
      acc[status]++;
      return acc;
    }, { safe: 0, warning: 0, collision: 0 });

    return counts;
  };

  const collisionCounts = getCollisionCounts();

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Collision Visualizer
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Real-time collision detection and visualization
              </p>
            </div>
          </div>
          
          <ButtonTemplate
            id="collision_visualizer_toggle"
            label={settings.enabled ? 'Hide' : 'Show'}
            icon={settings.enabled ? 'eye-off' : 'eye'}
            action="Toggle collision visualization"
            stateKey="collisionVisualizerEnabled"
            initialState={settings.enabled}
            stateType="boolean"
            variant={settings.enabled ? 'primary' : 'ghost'}
            size="sm"
            ariaLabel="Toggle collision visualization"
            callback={() => handleSettingChange('enabled', !settings.enabled)}
          />
        </div>
      </div>

      {/* Status Overview */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Collision Status
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {collisionCounts.safe}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">Safe</div>
          </div>
          <div className="text-center p-3 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {collisionCounts.warning}
            </div>
            <div className="text-xs text-yellow-600 dark:text-yellow-400">Warning</div>
          </div>
          <div className="text-center p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {collisionCounts.collision}
            </div>
            <div className="text-xs text-red-600 dark:text-red-400">Collision</div>
          </div>
        </div>
      </div>

      {/* Collision Pairs List */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Collision Pairs ({collisionPairs.length})
        </h3>
        
        <div className="space-y-3">
          {collisionPairs.map(pair => {
            const status = getCollisionStatus(pair);
            const isSelected = selectedPair?.id === pair.id;
            
            return (
              <div
                key={pair.id}
                className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : getStatusColor(status)
                }`}
                onClick={() => handlePairSelect(pair)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(status)}
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {pair.bodyA} ↔ {pair.bodyB}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(status)}`}>
                    {getStatusText(status)}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Clearance:</span>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {pair.clearance.toFixed(2)} mm
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Warning:</span>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {pair.warningDistance.toFixed(1)} mm
                    </div>
                  </div>
                </div>
                
                {pair.contactPoints.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    {pair.contactPoints.length} contact point(s)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Visualization Settings
        </h3>
        
        <div className="space-y-3">
          {/* Show Distance Labels */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              Show Distance Labels
            </label>
            <ButtonTemplate
              id="collision_show_labels"
              label={settings.showDistanceLabels ? 'On' : 'Off'}
              action="Toggle distance labels"
              stateKey="collisionShowLabels"
              initialState={settings.showDistanceLabels}
              stateType="boolean"
              variant={settings.showDistanceLabels ? 'primary' : 'ghost'}
              size="sm"
              ariaLabel="Toggle distance labels"
              callback={() => handleSettingChange('showDistanceLabels', !settings.showDistanceLabels)}
            />
          </div>
          
          {/* Show Contact Points */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              Show Contact Points
            </label>
            <ButtonTemplate
              id="collision_show_contacts"
              label={settings.showContactPoints ? 'On' : 'Off'}
              action="Toggle contact points"
              stateKey="collisionShowContacts"
              initialState={settings.showContactPoints}
              stateType="boolean"
              variant={settings.showContactPoints ? 'primary' : 'ghost'}
              size="sm"
              ariaLabel="Toggle contact points"
              callback={() => handleSettingChange('showContactPoints', !settings.showContactPoints)}
            />
          </div>
          
          {/* Warning Threshold */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
              Warning Threshold: {settings.warningThreshold.toFixed(1)} mm
            </label>
            <input
              type="range"
              min="1"
              max="50"
              step="0.5"
              value={settings.warningThreshold}
              onChange={(e) => handleSettingChange('warningThreshold', Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
          
          {/* Collision Threshold */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
              Collision Threshold: {settings.collisionThreshold.toFixed(1)} mm
            </label>
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={settings.collisionThreshold}
              onChange={(e) => handleSettingChange('collisionThreshold', Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
          
          {/* Update Frequency */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
              Update Frequency: {settings.updateFrequency} ms
            </label>
            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={settings.updateFrequency}
              onChange={(e) => handleSettingChange('updateFrequency', Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>
      </div>

      {/* Selected Pair Details */}
      {selectedPair && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            {selectedPair.bodyA} ↔ {selectedPair.bodyB}
          </h4>
          
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Clearance:</span>
              <div className="font-medium text-gray-900 dark:text-white">
                {selectedPair.clearance.toFixed(2)} mm
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Status:</span>
              <div className="font-medium text-gray-900 dark:text-white">
                {getStatusText(getCollisionStatus(selectedPair))}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Contact Points:</span>
              <div className="font-medium text-gray-900 dark:text-white">
                {selectedPair.contactPoints.length}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Last Update:</span>
              <div className="font-medium text-gray-900 dark:text-white">
                {new Date(selectedPair.lastUpdate).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
