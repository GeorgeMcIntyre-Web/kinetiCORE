/**
 * Actuator Control Panel
 * Owner: Edwin (UI Lead)
 * 
 * Device-specific actuator controls with sliders, quick actions, and real-time status
 * Follows the systematic button process and design system
 */

import { useState, useEffect } from 'react';
import { Play, Square, AlertTriangle, Thermometer, Zap, Grip } from 'lucide-react';
import { ButtonTemplate } from './buttons/ButtonTemplate';

export interface ActuatorState {
  deviceId: string;
  deviceName: string;
  deviceType: 'gripper' | 'valve' | 'fixture';
  state: 'idle' | 'moving' | 'grasping' | 'clamped' | 'error';
  position: number; // 0-100%
  force: number; // Current force in N
  temperature: number; // Temperature in °C
  voltage: number; // Voltage in V
  isEnabled: boolean;
  faultCode?: number;
  faultMessage?: string;
}

export interface JointState {
  jointId: string;
  jointName: string;
  position: number; // Current position in radians or mm
  velocity: number; // Current velocity
  torque: number; // Current torque/force
  isMoving: boolean;
}

// Mock data - in real implementation, this would come from ActuatorSystem
const MOCK_ACTUATOR_STATE: ActuatorState = {
  deviceId: 'schunk-pgn-plus-125',
  deviceName: 'Schunk PGN-Plus 125',
  deviceType: 'gripper',
  state: 'idle',
  position: 45,
  force: 12.3,
  temperature: 32,
  voltage: 24.1,
  isEnabled: true
};

const MOCK_JOINT_STATES: JointState[] = [
  {
    jointId: 'finger_1_joint',
    jointName: 'Finger 1 Joint',
    position: 0.45,
    velocity: 0.0,
    torque: 2.1,
    isMoving: false
  },
  {
    jointId: 'finger_2_joint',
    jointName: 'Finger 2 Joint',
    position: 0.45,
    velocity: 0.0,
    torque: 2.1,
    isMoving: false
  }
];

export function ActuatorControlPanel() {
  const [actuatorState, setActuatorState] = useState<ActuatorState>(MOCK_ACTUATOR_STATE);
  const [jointStates] = useState<JointState[]>(MOCK_JOINT_STATES);
  const [manualPosition, setManualPosition] = useState(actuatorState.position);
  const [manualForce, setManualForce] = useState(50);
  const [manualSpeed, setManualSpeed] = useState(50);

  // Update manual position when actuator state changes
  useEffect(() => {
    setManualPosition(actuatorState.position);
  }, [actuatorState.position]);

  const handleQuickAction = (action: string) => {
    console.log(`[ActuatorControlPanel] Quick action: ${action}`);
    
    switch (action) {
      case 'open':
        setActuatorState(prev => ({ ...prev, state: 'moving' }));
        // Simulate opening
        setTimeout(() => {
          setActuatorState(prev => ({ ...prev, state: 'idle', position: 0 }));
        }, 1000);
        break;
        
      case 'close':
        setActuatorState(prev => ({ ...prev, state: 'moving' }));
        // Simulate closing
        setTimeout(() => {
          setActuatorState(prev => ({ ...prev, state: 'grasping', position: 100 }));
        }, 1000);
        break;
        
      case 'home':
        setActuatorState(prev => ({ ...prev, state: 'moving' }));
        // Simulate homing
        setTimeout(() => {
          setActuatorState(prev => ({ ...prev, state: 'idle', position: 0 }));
        }, 1500);
        break;
        
      case 'emergency_stop':
        setActuatorState(prev => ({ ...prev, state: 'error', isEnabled: false }));
        break;
    }
  };

  const handleManualControl = (type: 'position' | 'force' | 'speed', value: number) => {
    console.log(`[ActuatorControlPanel] Manual ${type}: ${value}`);
    
    switch (type) {
      case 'position':
        setManualPosition(value);
        setActuatorState(prev => ({ ...prev, state: 'moving', position: value }));
        break;
        
      case 'force':
        setManualForce(value);
        setActuatorState(prev => ({ ...prev, force: value * 0.5 })); // Convert to N
        break;
        
      case 'speed':
        setManualSpeed(value);
        break;
    }
  };

  const getStateColor = (state: ActuatorState['state']) => {
    switch (state) {
      case 'idle': return 'text-green-600 bg-green-100';
      case 'moving': return 'text-blue-600 bg-blue-100';
      case 'grasping': return 'text-yellow-600 bg-yellow-100';
      case 'clamped': return 'text-purple-600 bg-purple-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStateIcon = (state: ActuatorState['state']) => {
    switch (state) {
      case 'idle': return <Square className="w-4 h-4" />;
      case 'moving': return <Play className="w-4 h-4" />;
      case 'grasping': return <Grip className="w-4 h-4" />;
      case 'clamped': return <Grip className="w-4 h-4" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      default: return <Square className="w-4 h-4" />;
    }
  };

  const getDeviceIcon = (type: ActuatorState['deviceType']) => {
    switch (type) {
      case 'gripper': return <Grip className="w-5 h-5" />;
      case 'valve': return <Zap className="w-5 h-5" />;
      case 'fixture': return <Square className="w-5 h-5" />;
      default: return <Square className="w-5 h-5" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          {getDeviceIcon(actuatorState.deviceType)}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Actuator Control
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {actuatorState.deviceName}
            </p>
          </div>
        </div>
      </div>

      {/* Device Status */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Device Status
          </h3>
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${getStateColor(actuatorState.state)}`}>
            {getStateIcon(actuatorState.state)}
            <span className="capitalize">{actuatorState.state}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Position:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {actuatorState.position.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Force:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {actuatorState.force.toFixed(1)} N
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Temperature:</span>
              <span className="font-medium text-gray-900 dark:text-white flex items-center">
                <Thermometer className="w-3 h-3 mr-1" />
                {actuatorState.temperature}°C
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Voltage:</span>
              <span className="font-medium text-gray-900 dark:text-white flex items-center">
                <Zap className="w-3 h-3 mr-1" />
                {actuatorState.voltage.toFixed(1)} V
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Quick Actions
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <ButtonTemplate
            id="actuator_open"
            label="Open"
            icon="play"
            action="Open gripper"
            stateKey="actuatorOpen"
            initialState={false}
            stateType="boolean"
            variant="secondary"
            size="sm"
            disabled={!actuatorState.isEnabled || actuatorState.state === 'moving'}
            ariaLabel="Open gripper"
            callback={() => handleQuickAction('open')}
          />
          <ButtonTemplate
            id="actuator_close"
            label="Close"
            icon="square"
            action="Close gripper"
            stateKey="actuatorClose"
            initialState={false}
            stateType="boolean"
            variant="secondary"
            size="sm"
            disabled={!actuatorState.isEnabled || actuatorState.state === 'moving'}
            ariaLabel="Close gripper"
            callback={() => handleQuickAction('close')}
          />
          <ButtonTemplate
            id="actuator_home"
            label="Home"
            icon="home"
            action="Home gripper"
            stateKey="actuatorHome"
            initialState={false}
            stateType="boolean"
            variant="secondary"
            size="sm"
            disabled={!actuatorState.isEnabled || actuatorState.state === 'moving'}
            ariaLabel="Home gripper"
            callback={() => handleQuickAction('home')}
          />
        </div>
        
        <div className="mt-3">
          <ButtonTemplate
            id="actuator_emergency_stop"
            label="Emergency Stop"
            icon="alert-triangle"
            action="Emergency stop actuator"
            stateKey="actuatorEmergencyStop"
            initialState={false}
            stateType="boolean"
            variant="danger"
            size="sm"
            ariaLabel="Emergency stop actuator"
            callback={() => handleQuickAction('emergency_stop')}
          />
        </div>
      </div>

      {/* Manual Control */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Manual Control
        </h3>
        
        <div className="space-y-4">
          {/* Position Control */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Position
              </label>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {manualPosition.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={manualPosition}
              onChange={(e) => handleManualControl('position', Number(e.target.value))}
              disabled={!actuatorState.isEnabled}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Force Control */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Force
              </label>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {manualForce.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={manualForce}
              onChange={(e) => handleManualControl('force', Number(e.target.value))}
              disabled={!actuatorState.isEnabled}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Speed Control */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Speed
              </label>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {manualSpeed.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={manualSpeed}
              onChange={(e) => handleManualControl('speed', Number(e.target.value))}
              disabled={!actuatorState.isEnabled}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>
      </div>

      {/* Joint States */}
      <div className="flex-1 p-4 overflow-y-auto">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Joint States
        </h3>
        
        <div className="space-y-3">
          {jointStates.map(joint => (
            <div
              key={joint.jointId}
              className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  {joint.jointName}
                </h4>
                <div className={`w-2 h-2 rounded-full ${
                  joint.isMoving ? 'bg-blue-500' : 'bg-gray-400'
                }`} />
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Position:</span>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {joint.position.toFixed(3)} rad
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Velocity:</span>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {joint.velocity.toFixed(3)} rad/s
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Torque:</span>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {joint.torque.toFixed(2)} Nm
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {actuatorState.state === 'error' && (
        <div className="p-4 border-t border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {actuatorState.faultMessage || 'Device error detected'}
            </span>
          </div>
          {actuatorState.faultCode && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">
              Error Code: {actuatorState.faultCode}
            </p>
          )}
        </div>
      )}
    </div>
  );
}