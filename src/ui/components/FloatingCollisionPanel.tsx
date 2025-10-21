/**
 * FloatingCollisionPanel - Collision Visualizer in Floating Panel
 * Owner: Edwin
 */

import React from 'react';
import { Circle } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { CollisionVisualizer } from './CollisionVisualizer';

interface FloatingCollisionPanelProps {
  onClose?: () => void;
  isVisible?: boolean;
  zIndex?: number;
}

export const FloatingCollisionPanel: React.FC<FloatingCollisionPanelProps> = ({
  onClose,
  isVisible = true,
  zIndex = 1004,
}) => {
  return (
    <FloatingPanel
      title="Collision Visualizer"
      icon={<Circle size={20} />}
      onClose={onClose}
      isVisible={isVisible}
      zIndex={zIndex}
      defaultSize={{ width: 350, height: 400 }}
      minWidth={300}
      minHeight={300}
      maxWidth={500}
      maxHeight={600}
      className="floating-collision-panel"
    >
      <div className="floating-collision-content">
        <CollisionVisualizer />
      </div>
    </FloatingPanel>
  );
};
