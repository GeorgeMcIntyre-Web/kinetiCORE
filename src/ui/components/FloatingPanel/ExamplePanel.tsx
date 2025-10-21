/**
 * ExamplePanel - Example of using BasePanel system
 * This shows how to create new panels using the reusable BasePanel system
 */

import React, { useState } from 'react';
import { Settings, Play, Pause, RotateCcw } from 'lucide-react';
import { BasePanel, BasePanelSection, BasePanelButton, BasePanelSelect, BasePanelDisabled } from './BasePanel';

interface ExamplePanelProps {
  onClose?: () => void;
}

export const ExamplePanel: React.FC<ExamplePanelProps> = ({ onClose }) => {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  const devices = [
    { value: 'robot1', label: 'Robot Arm 1' },
    { value: 'robot2', label: 'Robot Arm 2' },
    { value: 'gripper1', label: 'Gripper 1' },
  ];

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    // Reset logic here
  };

  return (
    <BasePanel
      title="Example Control Panel"
      icon={<Settings size={20} />}
      onClose={onClose}
    >
      {/* Device Selection Section */}
      <BasePanelSection
        title="Device Selection"
        hint="Choose a device to control"
      >
        <BasePanelSelect
          value={selectedDevice}
          onChange={setSelectedDevice}
          options={devices}
          placeholder="Select a device..."
        />
      </BasePanelSection>

      {/* Control Section */}
      <BasePanelSection
        title="Controls"
        hint={!selectedDevice ? "Select a device to enable controls" : undefined}
      >
        {selectedDevice ? (
          <div className="base-panel-grid base-panel-grid-3">
            <BasePanelButton
              onClick={handlePlayPause}
              variant="primary"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              {isPlaying ? 'Pause' : 'Play'}
            </BasePanelButton>
            
            <BasePanelButton
              onClick={handleReset}
            >
              <RotateCcw size={16} />
              Reset
            </BasePanelButton>
            
            <BasePanelButton
              onClick={() => console.log('Custom action')}
            >
              <Settings size={16} />
              Custom
            </BasePanelButton>
          </div>
        ) : (
          <BasePanelDisabled
            icon={<Settings size={24} />}
            message="No device selected"
          />
        )}
      </BasePanelSection>

      {/* Status Section */}
      <BasePanelSection title="Status">
        <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>
            Current Status:
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)' }}>
            {selectedDevice ? `Device: ${devices.find(d => d.value === selectedDevice)?.label}` : 'No device selected'}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px' }}>
            State: {isPlaying ? 'Playing' : 'Stopped'}
          </div>
        </div>
      </BasePanelSection>
    </BasePanel>
  );
};
