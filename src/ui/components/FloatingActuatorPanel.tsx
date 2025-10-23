/**
 * FloatingActuatorPanel - Professional Actuator Control
 * Owner: George
 *
 * Professional actuator control panel matching Motion panel design standards
 * - Icon-only buttons
 * - Compact, efficient layout
 * - Device selection dropdown
 * - Full backend integration
 */

import React, { useState, useEffect } from 'react';
import {
  Gamepad2, Play, Square, Power, PowerOff, AlertTriangle,
  Gauge, Thermometer, Zap, ChevronDown, ChevronRight
} from 'lucide-react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { AssetLibraryDarkPanel } from './FloatingPanel/AssetLibraryDarkPanel';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { useEditorStore } from '../store/editorStore';
import './FloatingActuatorPanel.css';

interface ActuatorInfo {
  id: string;
  name: string;
  deviceName: string;
  type: 'servo_motor' | 'linear_actuator' | 'pneumatic_cylinder' | 'hydraulic_cylinder' | 'gripper';
  state: {
    enabled: boolean;
    value: number; // 0-1 range
    force?: number;
    velocity?: number;
    fault?: boolean;
    faultCode?: string;
  };
  specs: {
    maxForce?: number;
    maxVelocity?: number;
    pressure?: number;
  };
}

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
  const kinematicsManager = KinematicsManager.getInstance();
  const actuatorSystem = kinematicsManager.getActuatorSystem();
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);

  const [devices, setDevices] = useState<{ nodeId: string; name: string; actuatorCount: number }[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [actuators, setActuators] = useState<ActuatorInfo[]>([]);
  const [selectedActuatorId, setSelectedActuatorId] = useState<string>('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['metrics']));

  // Discover devices with actuators
  useEffect(() => {
    const discoverDevices = () => {
      const tree = SceneTreeManager.getInstance();
      const allActuators = actuatorSystem.getAllActuators();

      if (allActuators.length === 0) {
        setDevices([]);
        return;
      }

      // Group actuators by their device/robot
      const deviceMap: { [key: string]: { name: string; actuators: any[] } } = {};

      allActuators.forEach((actuator: any) => {
        // Extract robot/device ID from actuator ID
        // Format can be: robotId_joint_jointName OR robotId_actuator_actuatorName
        let robotId = '';

        if (actuator.id.includes('_joint_')) {
          robotId = actuator.id.split('_joint_')[0];
        } else if (actuator.id.includes('_actuator_')) {
          robotId = actuator.id.split('_actuator_')[0];
        } else {
          // Fallback: try to extract robotId from controlledJoints
          if (actuator.controlledJoints && actuator.controlledJoints.length > 0) {
            const jointId = actuator.controlledJoints[0];
            if (jointId.includes('_joint_')) {
              robotId = jointId.split('_joint_')[0];
            }
          }
        }

        if (!robotId) return;

        const node = tree.getNode(robotId);

        if (node) {
          if (!deviceMap[robotId]) {
            deviceMap[robotId] = { name: node.name, actuators: [] };
          }
          deviceMap[robotId].actuators.push(actuator);
        }
      });

      // Convert to device list
      const discoveredDevices = Object.entries(deviceMap).map(([nodeId, data]) => ({
        nodeId,
        name: data.name,
        actuatorCount: data.actuators.length,
      }));

      setDevices(discoveredDevices);
    };

    discoverDevices();
    const interval = setInterval(discoverDevices, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-select device based on scene tree selection
  useEffect(() => {
    if (!selectedNodeId) {
      setActiveDeviceId(null);
      return;
    }

    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(selectedNodeId);
    if (!node) {
      setActiveDeviceId(null);
      return;
    }

    // Walk up to find if selected node is under any device
    let checkNode = node;
    let foundDeviceId: string | null = null;

    while (checkNode && !foundDeviceId) {
      if (devices.some(d => d.nodeId === checkNode.id)) {
        foundDeviceId = checkNode.id;
        break;
      }

      if (!checkNode.parentId) {
        break;
      }
      const parent = tree.getNode(checkNode.parentId);
      if (!parent || parent.name === 'Assets') {
        break;
      }
      checkNode = parent;
    }

    // Only update if device actually changed
    setActiveDeviceId(prev => prev !== foundDeviceId ? foundDeviceId : prev);
  }, [selectedNodeId, devices]);

  // Update actuators for active device
  useEffect(() => {
    const updateActuators = () => {
      if (!activeDeviceId) {
        setActuators([]);
        return;
      }

      const allActuators = actuatorSystem.getAllActuators();
      const deviceActuators = allActuators.filter((a: any) =>
        a.id.startsWith(activeDeviceId)
      );

      const actuatorInfos: ActuatorInfo[] = deviceActuators.map((a: any) => ({
        id: a.id,
        name: a.name,
        deviceName: a.name.replace(/_joint_.*/, ''),
        type: a.type,
        state: {
          enabled: a.state.enabled,
          value: a.state.value ?? 0,
          force: a.state.force,
          velocity: a.state.velocity,
          fault: a.state.fault,
          faultCode: a.state.faultCode,
        },
        specs: {
          maxForce: a.specs.maxForce,
          maxVelocity: a.specs.maxVelocity,
          pressure: a.specs.pressure,
        },
      }));

      setActuators(actuatorInfos);

      // Auto-select first actuator if none selected
      if (!selectedActuatorId && actuatorInfos.length > 0) {
        setSelectedActuatorId(actuatorInfos[0].id);
      }
    };

    updateActuators();
    const interval = setInterval(updateActuators, 500);
    return () => clearInterval(interval);
  }, [activeDeviceId, selectedActuatorId]);

  const selectedActuator = actuators.find(a => a.id === selectedActuatorId);
  const activeDevice = devices.find(d => d.nodeId === activeDeviceId);

  // Control handlers
  const handleSetValue = (value: number) => {
    if (!selectedActuatorId) return;
    actuatorSystem.sendCommand({
      actuatorId: selectedActuatorId,
      command: 'set_value',
      value: value / 100, // Convert percentage to 0-1
    });
  };

  const handleQuickAction = (action: 'open' | 'close' | 'stop') => {
    if (!selectedActuatorId) return;

    switch (action) {
      case 'open':
        actuatorSystem.sendCommand({
          actuatorId: selectedActuatorId,
          command: 'set_value',
          value: 1.0,
        });
        break;
      case 'close':
        actuatorSystem.sendCommand({
          actuatorId: selectedActuatorId,
          command: 'set_value',
          value: 0.0,
        });
        break;
      case 'stop':
        actuatorSystem.sendCommand({
          actuatorId: selectedActuatorId,
          command: 'disable',
        });
        break;
    }
  };

  const handleEnableDisable = () => {
    if (!selectedActuatorId) return;
    const isEnabled = selectedActuator?.state.enabled;
    actuatorSystem.sendCommand({
      actuatorId: selectedActuatorId,
      command: isEnabled ? 'disable' : 'enable',
    });
  };

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'servo_motor': return 'SERVO';
      case 'linear_actuator': return 'LINEAR';
      case 'pneumatic_cylinder': return 'PNEUMATIC';
      case 'hydraulic_cylinder': return 'HYDRAULIC';
      case 'gripper': return 'GRIPPER';
      default: return type.toUpperCase();
    }
  };

  const panelContent = (
    <div className="actuator-panel-pro">
      {/* Device Selection */}
      <div className="device-select-section">
        {devices.length > 0 ? (
          <>
            <label className="section-label">Device</label>
            <select
              className="device-select"
              value={activeDeviceId || ''}
              onChange={(e) => setActiveDeviceId(e.target.value || null)}
            >
              <option value="">-- Select Device --</option>
              {devices.map((device) => (
                <option key={device.nodeId} value={device.nodeId}>
                  {device.name} ({device.actuatorCount} actuators)
                </option>
              ))}
            </select>
          </>
        ) : (
          <div className="no-devices">
            <Gamepad2 size={20} strokeWidth={1.5} />
            <span>No actuators found - load an MJCF robot</span>
          </div>
        )}
      </div>

      {/* Actuator Selection */}
      {activeDevice && actuators.length > 0 && (
        <div className="actuator-select-section">
          <label className="section-label">Actuator</label>
          <select
            className="actuator-select"
            value={selectedActuatorId}
            onChange={(e) => setSelectedActuatorId(e.target.value)}
          >
            {actuators.map((actuator) => (
              <option key={actuator.id} value={actuator.id}>
                {actuator.name} ({getTypeLabel(actuator.type)})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Selected Actuator Info */}
      {selectedActuator && (
        <>
          <div className="actuator-info-section">
            <div className="info-row">
              <span className="info-label">Type</span>
              <span className="info-badge">{getTypeLabel(selectedActuator.type)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Status</span>
              <div className="status-indicator">
                <div className={`status-dot ${selectedActuator.state.enabled ? 'enabled' : 'disabled'}`} />
                <span>{selectedActuator.state.enabled ? 'Enabled' : 'Disabled'}</span>
                {selectedActuator.state.fault && (
                  <AlertTriangle size={14} className="fault-icon" />
                )}
              </div>
            </div>
            <div className="info-row">
              <span className="info-label">Position</span>
              <span className="info-value">{(selectedActuator.state.value * 100).toFixed(1)}%</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions-section">
            <div className="action-buttons">
              <button
                className="action-btn open"
                onClick={() => handleQuickAction('open')}
                disabled={!selectedActuator.state.enabled}
                title="Fully open/extend"
              >
                <Play size={16} />
              </button>
              <button
                className="action-btn close"
                onClick={() => handleQuickAction('close')}
                disabled={!selectedActuator.state.enabled}
                title="Fully close/retract"
              >
                <Square size={16} />
              </button>
              <button
                className="action-btn stop"
                onClick={() => handleQuickAction('stop')}
                title="Emergency stop"
              >
                <AlertTriangle size={16} />
              </button>
              <button
                className={`action-btn power ${selectedActuator.state.enabled ? 'enabled' : ''}`}
                onClick={handleEnableDisable}
                title={selectedActuator.state.enabled ? 'Disable actuator' : 'Enable actuator'}
              >
                {selectedActuator.state.enabled ? <PowerOff size={16} /> : <Power size={16} />}
              </button>
            </div>
          </div>

          {/* Manual Control */}
          <div className="manual-control-section">
            <label className="section-label">Manual Position</label>
            <div className="slider-control">
              <input
                type="range"
                min="0"
                max="100"
                value={selectedActuator.state.value * 100}
                onChange={(e) => handleSetValue(Number(e.target.value))}
                disabled={!selectedActuator.state.enabled}
                className="position-slider"
              />
              <span className="slider-value">{(selectedActuator.state.value * 100).toFixed(1)}%</span>
            </div>
          </div>

          {/* Metrics (Collapsible) */}
          <div className="metrics-section">
            <div className="section-header" onClick={() => toggleSection('metrics')}>
              <span className="section-label">Metrics</span>
              {collapsedSections.has('metrics') ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </div>
            {!collapsedSections.has('metrics') && (
              <div className="metrics-grid">
                <div className="metric-card">
                  <Gauge size={14} />
                  <div className="metric-info">
                    <span className="metric-label">Force</span>
                    <span className="metric-value">{selectedActuator.state.force?.toFixed(1) ?? '—'} N</span>
                  </div>
                </div>
                <div className="metric-card">
                  <Zap size={14} />
                  <div className="metric-info">
                    <span className="metric-label">Velocity</span>
                    <span className="metric-value">{selectedActuator.state.velocity?.toFixed(2) ?? '—'} m/s</span>
                  </div>
                </div>
                <div className="metric-card">
                  <Thermometer size={14} />
                  <div className="metric-info">
                    <span className="metric-label">Temp</span>
                    <span className="metric-value">25°C</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* No Selection State */}
      {!selectedActuator && activeDevice && (
        <div className="no-selection">
          <Gamepad2 size={24} strokeWidth={1.5} />
          <span>Select an actuator to control</span>
        </div>
      )}
    </div>
  );

  return (
    <FloatingPanel
      title="Actuator Control"
      subtitle={activeDevice ? `${activeDevice.name} (${actuators.length} actuators)` : "No device selected"}
      icon={<Gamepad2 size={20} />}
      onClose={onClose}
      isVisible={isVisible}
      zIndex={zIndex}
      defaultSize={{ width: 340, height: 550 }}
      minWidth={320}
      minHeight={450}
      maxWidth={500}
      maxHeight={800}
      draggable={true}
      resizable={true}
    >
      <AssetLibraryDarkPanel title="" onClose={undefined}>
        {panelContent}
      </AssetLibraryDarkPanel>
    </FloatingPanel>
  );
};
