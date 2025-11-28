import React from 'react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { FEAPanel } from '../FEAPanel';

interface FloatingFEAPanelProps {
    onClose?: () => void;
    isVisible?: boolean;
    zIndex?: number;
}

export const FloatingFEAPanel: React.FC<FloatingFEAPanelProps> = ({
    onClose,
    isVisible = true,
    zIndex = 1001,
}) => {
    if (!isVisible) return null;

    return (
        <FloatingPanel
            title="Structural Analysis"
            onClose={onClose}
            defaultPosition={{ x: 100, y: 100 }}
            defaultSize={{ width: 400, height: 600 }}
            minWidth={300}
            minHeight={400}
            zIndex={zIndex}
        >
            <FEAPanel />
        </FloatingPanel>
    );
};
