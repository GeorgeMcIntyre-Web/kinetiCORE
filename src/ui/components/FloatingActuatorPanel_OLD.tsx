/**
 * FloatingActuatorPanel - Actuator Control in Floating Panel
 * Owner: Edwin
 * 
 * Wraps the existing ActuatorControlPanel content in the new floating panel system
 */

import React, { useState, useEffect } from 'react';
import { Gamepad2, Play, Square, AlertTriangle, Thermometer, Zap, Grip } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { AssetLibraryDarkPanel } from './FloatingPanel/AssetLibraryDarkPanel';
import { ButtonTemplate } from './buttons/ButtonTemplate';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import './FloatingActuatorPanel.css';

export interface ActuatorState {
  deviceId: string;
  deviceName: string;
  deviceType: 'gripper' | 'valve' | 'fixture' | 'linear' | 'rotary' | 'pneumatic' | 'hydraulic' | 'electric';
  state: 'idle' | 'moving' | 'grasping' | 'clamped' | 'extended' | 'retracted' | 'open' | 'closed' | 'error';
  position: number; // 0-100%
  force: number; // Current force in N
  temperature: number; // Temperature in °C
  voltage: number; // Voltage in V
  pressure?: number; // Pressure in bar (for pneumatic/hydraulic)
  flow?: number; // Flow rate in L/min
  isEnabled: boolean;
  faultCode?: number;
  faultMessage?: string;
}

export interface JointState {
  jointId: string;
  jointName: string;
  position: number;
  velocity: number;
  torque: number;
  isMoving: boolean;
}

// Mock data for joint states (kept for demonstration purposes)
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

interface FloatingActuatorPanelProps {
  onClose?: () => void;
  isVisible?: boolean;
  zIndex?: number;
}

export const FloatingActuatorPanel: React.FC<FloatingActuatorPanelProps> = ({
  onClose,
  isVisible = true,
  zIndex = 1002,
}) => {
  const [availableActuators, setAvailableActuators] = useState<ActuatorState[]>([]);
  const [selectedActuatorId, setSelectedActuatorId] = useState<string>('');
  const [jointStates] = useState<JointState[]>(MOCK_JOINT_STATES);
  const [manualPosition, setManualPosition] = useState(0);
  const [manualForce, setManualForce] = useState(50);
  const [manualSpeed, setManualSpeed] = useState(50);

  // Fetch real actuators from ActuatorSystem
  useEffect(() => {
    const kinematicsManager = KinematicsManager.getInstance();
    const actuatorSystem = kinematicsManager.getActuatorSystem();

    const updateActuators = () => {
      const hardwareActuators = actuatorSystem.getAllActuators();

      // Convert HardwareActuator to ActuatorState
      const actuatorStates: ActuatorState[] = hardwareActuators.map(hw => ({
        deviceId: hw.id,
        deviceName: hw.name,
        deviceType: mapHardwareTypeToDeviceType(hw.type),
        state: hw.state.fault ? 'error' : hw.state.enabled ? 'idle' : 'idle',
        position: hw.state.value ?? 0,
        force: hw.state.force ?? 0,
        temperature: 25, // Default temperature (not in HardwareActuator yet)
        voltage: 24, // Default voltage
        pressure: hw.type === 'pneumatic_cylinder' ? hw.specs.pressure : undefined,
        isEnabled: hw.state.enabled,
        faultCode: hw.state.faultCode ? parseInt(hw.state.faultCode) : undefined,
        faultMessage: hw.state.faultCode,
      }));

      setAvailableActuators(actuatorStates);

      // Auto-select first actuator if none selected
      if (!selectedActuatorId && actuatorStates.length > 0) {
        setSelectedActuatorId(actuatorStates[0].deviceId);
      }
    };

    updateActuators();
    const interval = setInterval(updateActuators, 500);
    return () => clearInterval(interval);
  }, [selectedActuatorId]);

  // Helper: Map hardware actuator type to device type
  const mapHardwareTypeToDeviceType = (hwType: string): ActuatorState['deviceType'] => {
    switch (hwType) {
      case 'servo_motor': return 'rotary';
      case 'linear_actuator': return 'linear';
      case 'pneumatic_cylinder': return 'pneumatic';
      case 'hydraulic_cylinder': return 'hydraulic';
      case 'gripper': return 'gripper';
      default: return 'electric';
    }
  };

  const selectedActuator = availableActuators.find(a => a.deviceId === selectedActuatorId);

  // Update manual position when actuator state changes
  useEffect(() => {
    if (selectedActuator) {
      setManualPosition(selectedActuator.position);
    }
  }, [selectedActuator?.position]);

  const handleQuickAction = (action: string) => {
    if (!selectedActuatorId) return;

    const kinematicsManager = KinematicsManager.getInstance();
    const actuatorSystem = kinematicsManager.getActuatorSystem();

    console.log(`Actuator action: ${action} on ${selectedActuatorId}`);

    switch (action) {
      case 'open':
      case 'extend':
      case 'activate':
        actuatorSystem.sendCommand({
          actuatorId: selectedActuatorId,
          command: 'set_value',
          value: 1.0, // Fully open/extended
        });
        break;

      case 'close':
      case 'retract':
      case 'deactivate':
        actuatorSystem.sendCommand({
          actuatorId: selectedActuatorId,
          command: 'set_value',
          value: 0.0, // Fully closed/retracted
        });
        break;

      case 'emergency_stop':
        actuatorSystem.sendCommand({
          actuatorId: selectedActuatorId,
          command: 'disable',
        });
        break;

      default:
        console.warn(`Unknown action: ${action}`);
    }
  };

  const handleManualControl = (type: string, value: number) => {
    if (!selectedActuatorId) return;

    const kinematicsManager = KinematicsManager.getInstance();
    const actuatorSystem = kinematicsManager.getActuatorSystem();

    console.log(`Manual control: ${type} = ${value} on ${selectedActuatorId}`);

    if (type === 'position') {
      setManualPosition(value);
      actuatorSystem.sendCommand({
        actuatorId: selectedActuatorId,
        command: 'set_value',
        value: value / 100, // Convert percentage to 0-1 range
      });
    } else if (type === 'force') {
      setManualForce(value);
      actuatorSystem.sendCommand({
        actuatorId: selectedActuatorId,
        command: 'set_force',
        value: value / 100,
      });
    } else if (type === 'speed') {
      setManualSpeed(value);
      actuatorSystem.sendCommand({
        actuatorId: selectedActuatorId,
        command: 'set_velocity',
        value: value / 100,
      });
    }
  };

  const getStateColor = (state: string): string => {
    switch (state) {
      case 'idle': return 'state-idle';
      case 'moving': return 'state-moving';
      case 'grasping': return 'state-grasping';
      case 'clamped': return 'state-clamped';
      case 'error': return 'state-error';
      default: return 'state-idle';
    }
  };

  const getStateIcon = (state: string): React.ReactNode => {
    switch (state) {
      case 'idle': return <Square size={12} />;
      case 'moving': return <Play size={12} />;
      case 'grasping': return <Grip size={12} />;
      case 'clamped': return <Grip size={12} />;
      case 'error': return <AlertTriangle size={12} />;
      default: return <Square size={12} />;
    }
  };

  const getActuatorActions = (deviceType: string) => {
    switch (deviceType) {
      case 'gripper':
        return [
          { id: 'open', label: 'Open', icon: 'play' },
          { id: 'close', label: 'Close', icon: 'square' },
          { id: 'emergency_stop', label: 'Emergency Stop', icon: 'alert-triangle', variant: 'danger' }
        ];
      case 'valve':
      case 'pneumatic':
      case 'hydraulic':
        return [
          { id: 'open', label: 'Open', icon: 'play' },
          { id: 'close', label: 'Close', icon: 'square' },
          { id: 'emergency_stop', label: 'Emergency Stop', icon: 'alert-triangle', variant: 'danger' }
        ];
      case 'linear':
        return [
          { id: 'extend', label: 'Extend', icon: 'play' },
          { id: 'retract', label: 'Retract', icon: 'square' },
          { id: 'emergency_stop', label: 'Emergency Stop', icon: 'alert-triangle', variant: 'danger' }
        ];
      case 'rotary':
        return [
          { id: 'rotate_cw', label: 'Rotate CW', icon: 'play' },
          { id: 'rotate_ccw', label: 'Rotate CCW', icon: 'square' },
          { id: 'emergency_stop', label: 'Emergency Stop', icon: 'alert-triangle', variant: 'danger' }
        ];
      default:
        return [
          { id: 'activate', label: 'Activate', icon: 'play' },
          { id: 'deactivate', label: 'Deactivate', icon: 'square' },
          { id: 'emergency_stop', label: 'Emergency Stop', icon: 'alert-triangle', variant: 'danger' }
        ];
    }
  };

  const getControlLabels = (deviceType: string) => {
    switch (deviceType) {
      case 'gripper':
        return { position: 'Position', force: 'Force', speed: 'Speed' };
      case 'linear':
        return { position: 'Extension', force: 'Force', speed: 'Speed' };
      case 'rotary':
        return { position: 'Angle', force: 'Torque', speed: 'Speed' };
      case 'pneumatic':
      case 'hydraulic':
        return { position: 'Position', force: 'Pressure', speed: 'Flow' };
      default:
        return { position: 'Position', force: 'Force', speed: 'Speed' };
    }
  };

  const panelContent = (
    <div className="floating-actuator-content">
      {/* Device Selection */}
      <div className="actuator-device-selection">
        {availableActuators.length > 0 ? (
          <>
            <div className="device-selection-header">
              <label>Device:</label>
              <select
                className="device-selector"
                value={selectedActuatorId}
                onChange={(e) => setSelectedActuatorId(e.target.value)}
              >
                <option value="">-- Select Actuator --</option>
                {availableActuators.map((actuator) => (
                  <option key={actuator.deviceId} value={actuator.deviceId}>
                    {actuator.deviceName} ({actuator.deviceType})
                  </option>
                ))}
              </select>
            </div>

            {selectedActuator && (
              <div className="actuator-device-header">
                <div className="device-info">
                  <div className="device-name">
                    {selectedActuator.deviceName}
                  </div>
                  <div className="device-type">
                    {selectedActuator.deviceType.toUpperCase()}
                  </div>
                </div>
                <div className={`device-status ${getStateColor(selectedActuator.state)}`}>
                  {getStateIcon(selectedActuator.state)}
                  <span>{selectedActuator.state}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '12px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center' }}>
            No actuators available - load an MJCF robot first
          </div>
        )}
      </div>

      {/* Status Metrics - Always visible */}
      <div className="actuator-metrics">
        <div className="section-header">
          <h3>Status Metrics</h3>
          {!selectedActuator && (
            <span className="disabled-hint">Select an actuator to see data</span>
          )}
        </div>
        {selectedActuator ? (
          <div className="metrics-grid">
            <div className="metric-item">
              <div className="metric-icon">
                <Thermometer size={14} />
              </div>
              <div className="metric-info">
                <div className="metric-label">Temperature</div>
                <div className="metric-value">{selectedActuator.temperature}°C</div>
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-icon">
                <Zap size={14} />
              </div>
              <div className="metric-info">
                <div className="metric-label">Voltage</div>
                <div className="metric-value">{selectedActuator.voltage}V</div>
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-icon">
                <Grip size={14} />
              </div>
              <div className="metric-info">
                <div className="metric-label">Force</div>
                <div className="metric-value">{selectedActuator.force}N</div>
              </div>
            </div>
            {selectedActuator.pressure && (
              <div className="metric-item">
                <div className="metric-icon">
                  <Grip size={14} />
                </div>
                <div className="metric-info">
                  <div className="metric-label">Pressure</div>
                  <div className="metric-value">{selectedActuator.pressure} bar</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="disabled-controls">
            <div className="disabled-placeholder">
              <Gamepad2 size={24} />
              <span>No actuator selected</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions - Always visible */}
      <div className="actuator-quick-actions">
        <div className="section-header">
          <h3>Quick Actions</h3>
          {!selectedActuator && (
            <span className="disabled-hint">Select an actuator to enable</span>
          )}
        </div>
        {selectedActuator ? (
          <div className="action-buttons">
            {getActuatorActions(selectedActuator.deviceType).map(action => (
              <ButtonTemplate
                key={action.id}
                id={`actuator_${action.id}`}
                label={action.label}
                icon={action.icon}
                action={`${action.label} actuator`}
                stateKey={`actuator${action.id}`}
                initialState={false}
                stateType="boolean"
                variant={(action.variant as 'primary' | 'secondary' | 'danger' | 'ghost') || "primary"}
                size="sm"
                ariaLabel={`${action.label} actuator`}
                callback={() => handleQuickAction(action.id)}
              />
            ))}
          </div>
        ) : (
          <div className="disabled-controls">
            <div className="disabled-placeholder">
              <Gamepad2 size={24} />
              <span>No actuator selected</span>
            </div>
          </div>
        )}
      </div>

      {/* Manual Control - Always visible */}
      <div className="actuator-manual-control">
        <div className="section-header">
          <h3>Manual Control</h3>
          {!selectedActuator && (
            <span className="disabled-hint">Select an actuator to enable</span>
          )}
        </div>
        
        {selectedActuator ? (
          <div className="control-group">
            {(() => {
              const labels = getControlLabels(selectedActuator.deviceType);
              return (
                <>
                  {/* Position Control */}
                  <div className="control-item">
                    <div className="control-label">
                      <span>{labels.position}</span>
                      <span className="control-value">{manualPosition.toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={manualPosition}
                      onChange={(e) => handleManualControl('position', Number(e.target.value))}
                      disabled={!selectedActuator.isEnabled}
                      className="control-slider"
                    />
                  </div>

                  {/* Force Control */}
                  <div className="control-item">
                    <div className="control-label">
                      <span>{labels.force}</span>
                      <span className="control-value">{manualForce}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={manualForce}
                      onChange={(e) => handleManualControl('force', Number(e.target.value))}
                      disabled={!selectedActuator.isEnabled}
                      className="control-slider"
                    />
                  </div>

                  {/* Speed Control */}
                  <div className="control-item">
                    <div className="control-label">
                      <span>{labels.speed}</span>
                      <span className="control-value">{manualSpeed}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={manualSpeed}
                      onChange={(e) => handleManualControl('speed', Number(e.target.value))}
                      disabled={!selectedActuator.isEnabled}
                      className="control-slider"
                    />
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="disabled-controls">
            <div className="disabled-placeholder">
              <Gamepad2 size={24} />
              <span>No actuator selected</span>
            </div>
          </div>
        )}
      </div>

      {/* Joint States - Always visible */}
      <div className="actuator-joints">
        <div className="section-header">
          <h3>Joint States</h3>
          {!selectedActuator && (
            <span className="disabled-hint">Select an actuator to see joints</span>
          )}
        </div>
        {selectedActuator && jointStates.length > 0 ? (
          <div className="joints-list">
            {jointStates.map((joint) => (
              <div key={joint.jointId} className="joint-item">
                <div className="joint-info">
                  <div className="joint-name">{joint.jointName}</div>
                  <div className="joint-position">{joint.position.toFixed(3)}</div>
                </div>
                <div className="joint-status">
                  <div className={`joint-indicator ${joint.isMoving ? 'moving' : 'idle'}`} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="disabled-controls">
            <div className="disabled-placeholder">
              <Gamepad2 size={24} />
              <span>{selectedActuator ? 'No joints available' : 'No actuator selected'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <FloatingPanel
      title="Actuator Control"
      icon={<Gamepad2 size={20} />}
      onClose={onClose}
      isVisible={isVisible}
      zIndex={zIndex}
      defaultSize={{ width: 380, height: 550 }}
      minWidth={350}
      minHeight={450}
      maxWidth={600}
      maxHeight={750}
      draggable={true}
      resizable={true}
    >
      <AssetLibraryDarkPanel
        title=""
        onClose={undefined}
      >
        {panelContent}
      </AssetLibraryDarkPanel>
    </FloatingPanel>
  );
};
