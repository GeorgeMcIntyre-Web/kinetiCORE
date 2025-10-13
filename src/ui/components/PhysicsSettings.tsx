/**
 * Physics Settings Panel
 * Owner: Edwin (UI Lead)
 * 
 * Physics engine selection, switching, and performance monitoring
 * Follows the systematic button process and design system
 */

import { useState, useEffect } from 'react';
import { Settings, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { ButtonTemplate } from './buttons/ButtonTemplate';

export interface PhysicsEngineInfo {
  id: 'rapier' | 'havok';
  name: string;
  description: string;
  status: 'available' | 'loading' | 'running' | 'error';
  bodies: number;
  joints: number;
  fps: number;
  memoryUsage: number; // MB
  stability: number; // 1-5 stars
  speed: number; // 1-5 stars
  features: number; // 1-5 stars
  bundleSize: number; // MB
}

export interface PhysicsSettings {
  currentEngine: 'rapier' | 'havok';
  gravity: { x: number; y: number; z: number };
  iterations: number;
  timeStep: number; // ms
  enableSleeping: boolean;
  enableCCD: boolean; // Continuous Collision Detection
}

// Mock data - in real implementation, this would come from PhysicsManager
const MOCK_ENGINE_INFO: PhysicsEngineInfo[] = [
  {
    id: 'rapier',
    name: 'Rapier',
    description: 'Fast, lightweight physics engine with good performance',
    status: 'running',
    bodies: 47,
    joints: 23,
    fps: 60,
    memoryUsage: 2.1,
    stability: 4,
    speed: 5,
    features: 4,
    bundleSize: 2
  },
  {
    id: 'havok',
    name: 'Havok',
    description: 'Industry-standard physics engine with advanced features',
    status: 'available',
    bodies: 0,
    joints: 0,
    fps: 0,
    memoryUsage: 0,
    stability: 5,
    speed: 4,
    features: 5,
    bundleSize: 5
  }
];

const MOCK_PHYSICS_SETTINGS: PhysicsSettings = {
  currentEngine: 'rapier',
  gravity: { x: 0, y: -9.81, z: 0 },
  iterations: 8,
  timeStep: 16.67,
  enableSleeping: true,
  enableCCD: false
};

export function PhysicsSettings() {
  const [engineInfo, setEngineInfo] = useState<PhysicsEngineInfo[]>(MOCK_ENGINE_INFO);
  const [physicsSettings, setPhysicsSettings] = useState<PhysicsSettings>(MOCK_PHYSICS_SETTINGS);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchProgress, setSwitchProgress] = useState(0);

  // Simulate FPS updates
  useEffect(() => {
    const interval = setInterval(() => {
      setEngineInfo(prev => prev.map(engine => {
        if (engine.status === 'running') {
          return {
            ...engine,
            fps: Math.floor(55 + Math.random() * 10), // Simulate 55-65 FPS
            bodies: engine.bodies + Math.floor(Math.random() * 3 - 1), // Simulate body changes
            memoryUsage: engine.memoryUsage + (Math.random() - 0.5) * 0.1 // Simulate memory changes
          };
        }
        return engine;
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleEngineSwitch = async (targetEngine: 'rapier' | 'havok') => {
    if (targetEngine === physicsSettings.currentEngine) return;

    console.log(`[PhysicsSettings] Switching to ${targetEngine} engine`);
    setIsSwitching(true);
    setSwitchProgress(0);

    // Simulate switching process
    const steps = [
      'Creating state snapshot...',
      'Disposing current engine...',
      'Loading new engine...',
      'Restoring state...',
      'Initializing physics...'
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setSwitchProgress(((i + 1) / steps.length) * 100);
      console.log(`[PhysicsSettings] ${steps[i]}`);
    }

    // Update engine status
    setEngineInfo(prev => prev.map(engine => {
      if (engine.id === targetEngine) {
        return { ...engine, status: 'running' };
      } else if (engine.id === physicsSettings.currentEngine) {
        return { ...engine, status: 'available', bodies: 0, joints: 0, fps: 0 };
      }
      return engine;
    }));

    setPhysicsSettings(prev => ({ ...prev, currentEngine: targetEngine }));
    setIsSwitching(false);
    setSwitchProgress(0);
  };

  const handleSettingChange = (key: keyof PhysicsSettings, value: any) => {
    console.log(`[PhysicsSettings] Changed ${key}:`, value);
    setPhysicsSettings(prev => ({ ...prev, [key]: value }));
  };

  const getStatusIcon = (status: PhysicsEngineInfo['status']) => {
    switch (status) {
      case 'running': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'loading': return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Settings className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: PhysicsEngineInfo['status']) => {
    switch (status) {
      case 'running': return 'text-green-600 bg-green-100';
      case 'loading': return 'text-blue-600 bg-blue-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-sm ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
      >
        ★
      </span>
    ));
  };

  const currentEngine = engineInfo.find(engine => engine.id === physicsSettings.currentEngine);
  const otherEngine = engineInfo.find(engine => engine.id !== physicsSettings.currentEngine);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Physics Settings
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Engine selection and performance monitoring
            </p>
          </div>
        </div>
      </div>

      {/* Engine Selection */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Physics Engine
        </h3>
        
        <div className="space-y-3">
          {engineInfo.map(engine => (
            <div
              key={engine.id}
              className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                engine.id === physicsSettings.currentEngine
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              onClick={() => !isSwitching && handleEngineSwitch(engine.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${getStatusColor(engine.status)}`}>
                    {getStatusIcon(engine.status)}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {engine.name}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {engine.description}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {engine.status === 'running' ? `${engine.fps} FPS` : engine.status}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {engine.bodies} bodies, {engine.joints} joints
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Engine Status */}
      {currentEngine && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Current Engine: {currentEngine.name}
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(currentEngine.status)}`}>
                  {currentEngine.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Bodies:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentEngine.bodies}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Joints:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentEngine.joints}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">FPS:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentEngine.fps}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Engine Comparison */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Engine Comparison
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 text-gray-600 dark:text-gray-400">Feature</th>
                <th className="text-center py-2 text-gray-600 dark:text-gray-400">Rapier</th>
                <th className="text-center py-2 text-gray-600 dark:text-gray-400">Havok</th>
              </tr>
            </thead>
            <tbody className="space-y-2">
              <tr>
                <td className="py-2 text-gray-600 dark:text-gray-400">Stability</td>
                <td className="text-center py-2">{renderStars(4)}</td>
                <td className="text-center py-2">{renderStars(5)}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600 dark:text-gray-400">Speed</td>
                <td className="text-center py-2">{renderStars(5)}</td>
                <td className="text-center py-2">{renderStars(4)}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600 dark:text-gray-400">Features</td>
                <td className="text-center py-2">{renderStars(4)}</td>
                <td className="text-center py-2">{renderStars(5)}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600 dark:text-gray-400">Bundle Size</td>
                <td className="text-center py-2 text-gray-900 dark:text-white">2MB</td>
                <td className="text-center py-2 text-gray-900 dark:text-white">5MB</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Switch Engine Button */}
      {otherEngine && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <ButtonTemplate
            id="physics_switch_engine"
            label={`Switch to ${otherEngine.name}`}
            icon="zap"
            action={`Switch to ${otherEngine.name} physics engine`}
            stateKey="physicsEngineSwitch"
            initialState={false}
            stateType="boolean"
            variant="primary"
            size="md"
            disabled={isSwitching}
            loading={isSwitching}
            ariaLabel={`Switch to ${otherEngine.name} physics engine`}
            callback={() => handleEngineSwitch(otherEngine.id)}
          />
          
          {isSwitching && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Switching engine...</span>
                <span>{switchProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${switchProgress}%` }}
                />
              </div>
            </div>
          )}
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            ⚠️ Switching will preserve all physics state
          </p>
        </div>
      )}

      {/* Advanced Settings */}
      <div className="flex-1 p-4 overflow-y-auto">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Advanced Settings
        </h3>
        
        <div className="space-y-4">
          {/* Gravity */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
              Gravity (m/s²)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">X</label>
                <input
                  type="number"
                  step="0.1"
                  value={physicsSettings.gravity.x}
                  onChange={(e) => handleSettingChange('gravity', {
                    ...physicsSettings.gravity,
                    x: Number(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Y</label>
                <input
                  type="number"
                  step="0.1"
                  value={physicsSettings.gravity.y}
                  onChange={(e) => handleSettingChange('gravity', {
                    ...physicsSettings.gravity,
                    y: Number(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Z</label>
                <input
                  type="number"
                  step="0.1"
                  value={physicsSettings.gravity.z}
                  onChange={(e) => handleSettingChange('gravity', {
                    ...physicsSettings.gravity,
                    z: Number(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Solver Iterations */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
              Solver Iterations: {physicsSettings.iterations}
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={physicsSettings.iterations}
              onChange={(e) => handleSettingChange('iterations', Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Time Step */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
              Time Step: {physicsSettings.timeStep.toFixed(2)} ms
            </label>
            <input
              type="range"
              min="1"
              max="50"
              step="0.1"
              value={physicsSettings.timeStep}
              onChange={(e) => handleSettingChange('timeStep', Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Toggle Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Enable Sleeping
              </label>
              <ButtonTemplate
                id="physics_enable_sleeping"
                label={physicsSettings.enableSleeping ? 'On' : 'Off'}
                action="Toggle physics sleeping"
                stateKey="physicsEnableSleeping"
                initialState={physicsSettings.enableSleeping}
                stateType="boolean"
                variant={physicsSettings.enableSleeping ? 'primary' : 'ghost'}
                size="sm"
                ariaLabel="Toggle physics sleeping"
                callback={() => handleSettingChange('enableSleeping', !physicsSettings.enableSleeping)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Continuous Collision Detection
              </label>
              <ButtonTemplate
                id="physics_enable_ccd"
                label={physicsSettings.enableCCD ? 'On' : 'Off'}
                action="Toggle continuous collision detection"
                stateKey="physicsEnableCCD"
                initialState={physicsSettings.enableCCD}
                stateType="boolean"
                variant={physicsSettings.enableCCD ? 'primary' : 'ghost'}
                size="sm"
                ariaLabel="Toggle continuous collision detection"
                callback={() => handleSettingChange('enableCCD', !physicsSettings.enableCCD)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
