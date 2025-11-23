import React from 'react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { FlexibleDynamicsPanel } from './FlexibleDynamicsPanel';

interface FloatingFlexiblePanelProps {
    isVisible: boolean;
    onClose: () => void;
    zIndex?: number;
}

export const FloatingFlexiblePanel: React.FC<FloatingFlexiblePanelProps> = ({
    isVisible,
    onClose,
    zIndex = 1000
}) => {
    if (!isVisible) return null;

    return (
        <FloatingPanel
            title="Flexible Dynamics"
            onClose={onClose}
            defaultPosition={{ x: 100, y: 100 }}
            defaultSize={{ width: 400, height: 500 }}
            minWidth={300}
            minHeight={400}
            zIndex={zIndex}
        >
            <FlexibleDynamicsPanel />
        </FloatingPanel>
    );
};
