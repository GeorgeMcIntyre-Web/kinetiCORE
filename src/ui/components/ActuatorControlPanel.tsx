/**
 * Actuator Control Panel
 * Professional control interface for hardware actuators
 * Asset Library styling with real-time feedback
 */

import { useState, useEffect } from 'react';
import { Power, PowerOff, Home, AlertTriangle, RefreshCw } from 'lucide-react';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import type { HardwareActuator } from '../../kinematics/device/UnifiedDeviceDefinition';
import './ActuatorControlPanel.css';

interface ActuatorControlPanelProps {
  onClose?: () => void;
}

export function ActuatorControlPanel({ onClose }: ActuatorControlPanelProps) {
  const [actuators, setActuators] = useState<HardwareActuator[]>([]);
  const [systemStatus, setSystemStatus] = useState({
    totalActuators: 0,
    enabledActuators: 0,
    faultedActuators: 0,
    groups: 0,
  });

  const kinematicsManager = KinematicsManager.getInstance();
  const actuatorSystem = kinematicsManager.getActuatorSystem();

  useEffect(() => {
    // Load actuators
    loadActuators();

    // Set up polling for status updates (only if there are actuators)
    const interval = setInterval(() => {
      const allActuators = actuatorSystem.getAllActuators();
      if (allActuators.length > 0) {
        loadActuators();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadActuators = () => {
    const allActuators = actuatorSystem.getAllActuators();
    setActuators(allActuators);

    const status = actuatorSystem.getSystemStatus();
    setSystemStatus(status);
  };

  const handleToggle = (actuatorId: string, enabled: boolean) => {
    actuatorSystem.sendCommand({
      actuatorId,
      command: enabled ? 'disable' : 'enable',
    });
    loadActuators();
  };

  const handleValueChange = (actuatorId: string, value: number) => {
    const actuator = actuators.find(a => a.id === actuatorId);
    if (!actuator) return;

    if (!actuator.state.enabled) {
      console.warn('Actuator is disabled');
      return;
    }

    actuatorSystem.sendCommand({
      actuatorId,
      command: 'set_value',
      value,
    });

    // Trigger re-render
    loadActuators();
  };

  const handleHome = (actuatorId: string) => {
    actuatorSystem.sendCommand({
      actuatorId,
      command: 'home',
    });
    loadActuators();
  };

  const handleResetFault = (actuatorId: string) => {
    actuatorSystem.sendCommand({
      actuatorId,
      command: 'reset_fault',
    });
    loadActuators();
  };

  const handleEmergencyStop = () => {
    actuatorSystem.emergencyStop();
    loadActuators();
  };

  const handleHomeAll = () => {
    actuatorSystem.homeAll();
    loadActuators();
  };

  const getActuatorIcon = (type: string): string => {
    switch (type) {
      case 'pneumatic_cylinder':
        return '💨';
      case 'servo_motor':
        return '🔄';
      case 'linear_actuator':
        return '↕️';
      case 'stepper_motor':
        return '⚙️';
      case 'electric_gripper':
        return '🤏';
      case 'hydraulic_cylinder':
        return '💧';
      default:
        return '⚡';
    }
  };

  return (
    <div className="actuator-panel">
      <div className="panel-header">
        <h2>Actuator Control</h2>
        {onClose && (
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      {/* System Status */}
      <div className="system-status">
        <div className="status-card">
          <div className="status-label">Total</div>
          <div className="status-value">{systemStatus.totalActuators}</div>
        </div>
        <div className="status-card enabled">
          <div className="status-label">Enabled</div>
          <div className="status-value">{systemStatus.enabledActuators}</div>
        </div>
        <div className="status-card faulted">
          <div className="status-label">Faulted</div>
          <div className="status-value">{systemStatus.faultedActuators}</div>
        </div>
        <div className="status-card">
          <div className="status-label">Groups</div>
          <div className="status-value">{systemStatus.groups}</div>
        </div>
      </div>

      {/* Global Controls */}
      <div className="global-controls">
        <button className="emergency-stop" onClick={handleEmergencyStop}>
          <PowerOff size={18} />
          Emergency Stop
        </button>
        <button className="home-all" onClick={handleHomeAll}>
          <Home size={18} />
          Home All
        </button>
      </div>

      {/* Actuators List */}
      <div className="panel-content">
        {actuators.length === 0 ? (
          <div className="empty-state">
            <p>No actuators configured</p>
            <p className="hint">Create a device with actuators to see controls here</p>
          </div>
        ) : (
          <div className="actuators-grid">
            {actuators.map((actuator) => (
              <div
                key={actuator.id}
                className={`actuator-card ${actuator.state.enabled ? 'enabled' : ''} ${
                  actuator.state.fault ? 'faulted' : ''
                }`}
              >
                {/* Card Header */}
                <div className="card-header">
                  <div className="actuator-title">
                    <span className="actuator-icon">{getActuatorIcon(actuator.type)}</span>
                    <span className="actuator-name">{actuator.name}</span>
                  </div>
                  <div className="status-badges">
                    {actuator.state.enabled && (
                      <span className="badge badge-enabled">ON</span>
                    )}
                    {actuator.state.fault && (
                      <span className="badge badge-fault">FAULT</span>
                    )}
                  </div>
                </div>

                {/* Actuator Type & Mode */}
                <div className="actuator-meta">
                  <span className="meta-item">{actuator.type.replace('_', ' ')}</span>
                  <span className="meta-separator">•</span>
                  <span className="meta-item">{actuator.controlMode}</span>
                </div>

                {/* Manufacturer Info */}
                {actuator.manufacturer && (
                  <div className="manufacturer-info">
                    {actuator.manufacturer} {actuator.modelNumber}
                  </div>
                )}

                {/* Value Control */}
                <div className="control-section">
                  <label>Control Value</label>
                  <div className="slider-group">
                    <input
                      type="range"
                      min={actuator.specs.ctrlRange.min}
                      max={actuator.specs.ctrlRange.max}
                      step={0.01}
                      value={actuator.state.value}
                      onChange={(e) =>
                        handleValueChange(actuator.id, parseFloat(e.target.value))
                      }
                      disabled={!actuator.state.enabled || actuator.state.fault}
                    />
                    <span className="value">
                      {actuator.state.value.toFixed(3)}
                    </span>
                  </div>
                  <div className="range-labels">
                    <span>{actuator.specs.ctrlRange.min}</span>
                    <span>{actuator.specs.ctrlRange.max}</span>
                  </div>
                </div>

                {/* Controlled Joints */}
                {actuator.controlledJoints.length > 0 && (
                  <div className="controlled-joints">
                    <span className="joints-label">
                      Controls: {actuator.controlledJoints.length} joint(s)
                    </span>
                  </div>
                )}

                {/* Coordination Info */}
                {actuator.coordination.length > 0 && (
                  <div className="coordination-info">
                    {actuator.coordination.map((coord, idx) => (
                      <div key={idx} className="coord-item">
                        <span className="coord-joint">{coord.jointId.substring(0, 12)}</span>
                        <span className="coord-ratio">
                          ×{coord.ratio.toFixed(2)}
                          {coord.offset !== 0 && ` +${coord.offset.toFixed(2)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Fault Message */}
                {actuator.state.fault && actuator.state.faultCode && (
                  <div className="fault-message">
                    <AlertTriangle size={14} />
                    <span>{actuator.state.faultCode}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="card-actions">
                  <button
                    className={`action-button ${actuator.state.enabled ? 'disable' : 'enable'}`}
                    onClick={() => handleToggle(actuator.id, actuator.state.enabled)}
                  >
                    {actuator.state.enabled ? (
                      <>
                        <PowerOff size={14} />
                        Disable
                      </>
                    ) : (
                      <>
                        <Power size={14} />
                        Enable
                      </>
                    )}
                  </button>
                  <button
                    className="action-button"
                    onClick={() => handleHome(actuator.id)}
                    disabled={!actuator.state.enabled}
                  >
                    <Home size={14} />
                    Home
                  </button>
                  {actuator.state.fault && (
                    <button
                      className="action-button reset"
                      onClick={() => handleResetFault(actuator.id)}
                    >
                      <RefreshCw size={14} />
                      Reset
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
