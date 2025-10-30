/**
 * FloatingComplexIKPanel - Complex IK Systems Control in Floating Panel
 * Owner: George
 *
 * Provides advanced inverse kinematics controls for complex multi-joint systems
 */

import React, { useState, useEffect } from 'react';
import { GitBranch, Target, Move, RotateCw } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import {
  AssetLibraryDarkPanel,
  AssetLibraryDarkSection,
  AssetLibraryDarkDisabled,
} from './FloatingPanel/AssetLibraryDarkPanel';
import './FloatingComplexIKPanel.css';

interface FloatingComplexIKPanelProps {
  onClose?: () => void;
  isVisible?: boolean;
  zIndex?: number;
}

interface IKChain {
  chainId: string;
  name: string;
  jointCount: number;
  endEffector: string;
  ikType: 'analytical' | 'numerical' | 'hybrid';
  status: 'idle' | 'computing' | 'error';
  convergenceRate: number;
  maxIterations: number;
  tolerance: number;
}

interface IKTarget {
  targetId: string;
  name: string;
  position: { x: number; y: number; z: number };
  orientation: { rx: number; ry: number; rz: number };
  isReachable: boolean;
  distance: number;
}

export const FloatingComplexIKPanel: React.FC<FloatingComplexIKPanelProps> = ({
  onClose,
  isVisible = true,
  zIndex = 1003,
}) => {
  const [activeChain, setActiveChain] = useState<IKChain | null>(null);
  const [ikChains, setIkChains] = useState<IKChain[]>([]);
  const [ikTargets, setIkTargets] = useState<IKTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [ikSettings, setIkSettings] = useState({
    maxIterations: 100,
    tolerance: 0.001,
    damping: 0.1,
    enableCollisionAvoidance: true,
    enableJointLimits: true,
  });

  // Mock data for demonstration
  useEffect(() => {
    const mockChains: IKChain[] = [
      {
        chainId: 'chain-1',
        name: 'KR270 Main Chain',
        jointCount: 6,
        endEffector: 'TCP',
        ikType: 'analytical',
        status: 'idle',
        convergenceRate: 0.95,
        maxIterations: 100,
        tolerance: 0.001,
      },
      {
        chainId: 'chain-2',
        name: 'Gripper Chain',
        jointCount: 3,
        endEffector: 'Gripper',
        ikType: 'numerical',
        status: 'idle',
        convergenceRate: 0.88,
        maxIterations: 150,
        tolerance: 0.002,
      },
    ];

    const mockTargets: IKTarget[] = [
      {
        targetId: 'target-1',
        name: 'Pick Position',
        position: { x: 500, y: 200, z: 300 },
        orientation: { rx: 0, ry: 0, rz: 0 },
        isReachable: true,
        distance: 0.0,
      },
      {
        targetId: 'target-2',
        name: 'Place Position',
        position: { x: -200, y: 400, z: 250 },
        orientation: { rx: 0, ry: 0, rz: 90 },
        isReachable: true,
        distance: 0.0,
      },
    ];

    setIkChains(mockChains);
    setIkTargets(mockTargets);

    if (mockChains.length > 0) {
      setActiveChain(mockChains[0]);
    }
  }, []);

  const handleIKSolve = () => {
    if (!activeChain || !selectedTarget) return;

    const target = ikTargets.find((t) => t.targetId === selectedTarget);
    if (!target) return;

    // Update chain status to computing
    setActiveChain((prev) => (prev ? { ...prev, status: 'computing' } : null));

    // Simulate IK computation
    setTimeout(() => {
      setActiveChain((prev) => (prev ? { ...prev, status: 'idle' } : null));
      // Here you would call the actual IK solver
    }, 1000);
  };

  const handleAddTarget = () => {
    const newTarget: IKTarget = {
      targetId: `target-${Date.now()}`,
      name: `Target ${ikTargets.length + 1}`,
      position: { x: 0, y: 0, z: 0 },
      orientation: { rx: 0, ry: 0, rz: 0 },
      isReachable: true,
      distance: 0.0,
    };
    setIkTargets((prev) => [...prev, newTarget]);
    setSelectedTarget(newTarget.targetId);
  };

  const panelContent = (
    <div className="floating-complex-ik-content">
      {/* IK Chain Selection */}
      <AssetLibraryDarkSection title="IK Chains">
        {ikChains.length > 0 ? (
          <div className="ik-chains-list">
            {ikChains.map((chain) => (
              <div
                key={chain.chainId}
                className={`ik-chain-item ${activeChain?.chainId === chain.chainId ? 'active' : ''}`}
                onClick={() => setActiveChain(chain)}
              >
                <div className="chain-info">
                  <div className="chain-name">{chain.name}</div>
                  <div className="chain-details">
                    {chain.jointCount} joints • {chain.ikType} • {chain.endEffector}
                  </div>
                </div>
                <div className="chain-status">
                  <div className={`status-indicator ${chain.status}`} />
                  <span className="status-text">{chain.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AssetLibraryDarkDisabled message="No IK chains available" />
        )}
      </AssetLibraryDarkSection>

      {/* IK Targets */}
      <AssetLibraryDarkSection title="IK Targets">
        <div className="ik-targets-controls">
          <button className="add-target-btn" onClick={handleAddTarget} title="Add new IK target">
            <Target size={16} />
            Add Target
          </button>
        </div>

        {ikTargets.length > 0 ? (
          <div className="ik-targets-list">
            {ikTargets.map((target) => (
              <div
                key={target.targetId}
                className={`ik-target-item ${selectedTarget === target.targetId ? 'selected' : ''}`}
                onClick={() => setSelectedTarget(target.targetId)}
              >
                <div className="target-info">
                  <div className="target-name">{target.name}</div>
                  <div className="target-position">
                    ({target.position.x.toFixed(0)}, {target.position.y.toFixed(0)},{' '}
                    {target.position.z.toFixed(0)})
                  </div>
                </div>
                <div className="target-status">
                  <div
                    className={`reachability-indicator ${target.isReachable ? 'reachable' : 'unreachable'}`}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AssetLibraryDarkDisabled message="No IK targets defined" />
        )}
      </AssetLibraryDarkSection>

      {/* IK Settings */}
      <AssetLibraryDarkSection title="IK Settings">
        <div className="ik-settings">
          <div className="setting-item">
            <label>Max Iterations</label>
            <input
              type="number"
              value={ikSettings.maxIterations}
              onChange={(e) =>
                setIkSettings((prev) => ({
                  ...prev,
                  maxIterations: parseInt(e.target.value) || 100,
                }))
              }
              min="10"
              max="1000"
            />
          </div>

          <div className="setting-item">
            <label>Tolerance</label>
            <input
              type="number"
              value={ikSettings.tolerance}
              onChange={(e) =>
                setIkSettings((prev) => ({
                  ...prev,
                  tolerance: parseFloat(e.target.value) || 0.001,
                }))
              }
              min="0.0001"
              max="0.1"
              step="0.0001"
            />
          </div>

          <div className="setting-item">
            <label>Damping</label>
            <input
              type="number"
              value={ikSettings.damping}
              onChange={(e) =>
                setIkSettings((prev) => ({ ...prev, damping: parseFloat(e.target.value) || 0.1 }))
              }
              min="0.01"
              max="1.0"
              step="0.01"
            />
          </div>

          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={ikSettings.enableCollisionAvoidance}
                onChange={(e) =>
                  setIkSettings((prev) => ({ ...prev, enableCollisionAvoidance: e.target.checked }))
                }
              />
              Collision Avoidance
            </label>
          </div>

          <div className="setting-item checkbox">
            <label>
              <input
                type="checkbox"
                checked={ikSettings.enableJointLimits}
                onChange={(e) =>
                  setIkSettings((prev) => ({ ...prev, enableJointLimits: e.target.checked }))
                }
              />
              Joint Limits
            </label>
          </div>
        </div>
      </AssetLibraryDarkSection>

      {/* IK Actions */}
      <AssetLibraryDarkSection title="Actions">
        <div className="ik-actions">
          <button
            className="solve-ik-btn"
            onClick={handleIKSolve}
            disabled={!activeChain || !selectedTarget || activeChain.status === 'computing'}
          >
            <Move size={16} />
            Solve IK
          </button>

          <button
            className="reset-ik-btn"
            onClick={() => {
              setActiveChain((prev) => (prev ? { ...prev, status: 'idle' } : null));
            }}
          >
            <RotateCw size={16} />
            Reset
          </button>
        </div>
      </AssetLibraryDarkSection>
    </div>
  );

  return (
    <FloatingPanel
      title="Complex IK Systems"
      subtitle={
        activeChain ? `${activeChain.name} (${activeChain.jointCount} joints)` : 'Select IK chain'
      }
      icon={<GitBranch size={20} />}
      onClose={onClose}
      isVisible={isVisible}
      zIndex={zIndex}
      defaultSize={{ width: 350, height: 550 }}
      minWidth={320}
      minHeight={500}
      maxWidth={500}
      maxHeight={100}
      draggable={true}
      resizable={true}
    >
      <AssetLibraryDarkPanel title="" onClose={undefined}>
        <div
          style={{
            height: '100%',
            overflowY: 'auto',
            overflowX: 'auto',
            paddingRight: '4px',
          }}
        >
          {panelContent}
        </div>
      </AssetLibraryDarkPanel>
    </FloatingPanel>
  );
};
