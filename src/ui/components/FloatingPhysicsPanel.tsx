/**
 * FloatingPhysicsPanel - Physics Settings in Floating Panel
 * Owner: Edwin
 */

import React from 'react';
import { Settings } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { PhysicsSettings } from './PhysicsSettings';

interface FloatingPhysicsPanelProps {
  onClose?: () => void;
  isVisible?: boolean;
  zIndex?: number;
}

export const FloatingPhysicsPanel: React.FC<FloatingPhysicsPanelProps> = ({
  onClose,
  isVisible = true,
  zIndex = 1003,
}) => {
  return (
    <FloatingPanel
      title="Physics Settings"
      icon={<Settings size={20} />}
      onClose={onClose}
      isVisible={isVisible}
      zIndex={zIndex}
      defaultSize={{ width: 400, height: 500 }}
      minWidth={350}
      minHeight={400}
      maxWidth={600}
      maxHeight={700}
      className="floating-physics-panel"
    >
      <div className="floating-physics-content">
        <PhysicsSettings />
      </div>
    </FloatingPanel>
  );
};
