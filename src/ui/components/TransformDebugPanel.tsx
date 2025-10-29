/**
 * TransformDebugPanel.tsx
 * UI controls for visual transform debugging and IK testing
 */

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Target, TestTube, Download } from 'lucide-react';
import { TransformDebugVisualizer } from '../../kinematics/TransformDebugVisualizer';
import { IKTestHarness, type EulerPose } from '../../kinematics/IKTestHarness';
import type { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import type { InverseKinematicsSolver } from '../../kinematics/InverseKinematicsSolver';
import { KinematicsManager } from '../../kinematics/KinematicsManager';

interface TransformDebugPanelProps {
  fkSolver: ForwardKinematicsSolver;
  ikSolver: InverseKinematicsSolver;
  robotId: string;
}

export const TransformDebugPanel: React.FC<TransformDebugPanelProps> = ({
  fkSolver,
  ikSolver,
  robotId,
}) => {
  const [visualizer] = useState(() => TransformDebugVisualizer.getInstance());
  const [testHarness] = useState(() => IKTestHarness.getInstance());
  const [kinematicsManager] = useState(() => KinematicsManager.getInstance());

  // Visualization options
  const [visualizerEnabled, setVisualizerEnabled] = useState(false);
  const [showJointFrames, setShowJointFrames] = useState(false);
  const [showMeshFrames, setShowMeshFrames] = useState(true);
  const [showFKFrames, setShowFKFrames] = useState(true);
  const [showDivergence, setShowDivergence] = useState(true);
  const [frameSize, setFrameSize] = useState(0.1);

  // Test pose inputs
  const [targetPose, setTargetPose] = useState<EulerPose>({
    x: 0,
    y: 0,
    z: 0,
    rx: 0,
    ry: 0,
    rz: 0,
  });
  const [chainName, setChainName] = useState<string>('');

  // Initialize
  useEffect(() => {
    const scene = (window as any).sceneManager?.getScene();
    if (scene) {
      visualizer.initialize(scene, fkSolver, kinematicsManager);
      testHarness.initialize(fkSolver, ikSolver, kinematicsManager);
    }

    // Find chain for this robot
    const chains = kinematicsManager.getAllChains();
    const robotChain = chains.find(chain =>
      chain.joints.some((joint: any) => joint.id.startsWith(robotId))
    );
    if (robotChain) {
      setChainName(robotChain.name);

      // Load current pose as default
      const currentPose = testHarness.getCurrentEulerPose(robotChain.name);
      if (currentPose) {
        setTargetPose(currentPose);
      }
    }
  }, [fkSolver, ikSolver, kinematicsManager, robotId, visualizer, testHarness]);

  // Update visualizer when options change
  useEffect(() => {
    visualizer.setEnabled(visualizerEnabled, {
      showJointFrames,
      showMeshFrames,
      showFKFrames,
      showDivergence,
      frameSize,
      showBaseFrame: true,
      showTCPFrame: true,
      divergenceThreshold: 0.001,
    });
  }, [visualizerEnabled, showJointFrames, showMeshFrames, showFKFrames, showDivergence, frameSize, visualizer]);

  const handleToggleVisualizer = () => {
    setVisualizerEnabled(!visualizerEnabled);
  };

  const handleUpdateVisualizer = () => {
    visualizer.update();
  };

  const handleGetDivergenceReport = () => {
    const report = visualizer.getDivergenceReport();
    console.log(report);
    alert('Divergence report printed to console');
  };

  const handleTestPose = () => {
    if (!chainName) {
      alert('No kinematic chain found for this robot');
      return;
    }
    testHarness.testEulerPose(chainName, targetPose);
  };

  const handleRunTestSuite = () => {
    if (!chainName) {
      alert('No kinematic chain found for this robot');
      return;
    }
    testHarness.runTestSuite(chainName);
  };

  const handleTestConsistency = () => {
    if (!chainName) {
      alert('No kinematic chain found for this robot');
      return;
    }
    testHarness.testForwardBackwardConsistency(chainName);
  };

  const handleLoadCurrentPose = () => {
    if (!chainName) return;
    const currentPose = testHarness.getCurrentEulerPose(chainName);
    if (currentPose) {
      setTargetPose(currentPose);
    }
  };

  return (
    <div className="transform-debug-panel" style={{
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '16px',
      borderRadius: '8px',
      fontSize: '12px',
      maxWidth: '400px',
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 'bold' }}>
        Transform Debug Tools
      </h3>

      {/* Visual Debugger Section */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Eye size={16} />
          Visual Transform Debugger
        </h4>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={handleToggleVisualizer}
            style={{
              padding: '6px 12px',
              background: visualizerEnabled ? '#00d4aa' : '#333',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {visualizerEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
            {visualizerEnabled ? 'Enabled' : 'Disabled'}
          </button>

          {visualizerEnabled && (
            <>
              <button
                onClick={handleUpdateVisualizer}
                style={{
                  padding: '6px 12px',
                  background: '#444',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Update
              </button>
              <button
                onClick={handleGetDivergenceReport}
                style={{
                  padding: '6px 12px',
                  background: '#444',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Download size={12} />
                Report
              </button>
            </>
          )}
        </div>

        {visualizerEnabled && (
          <div style={{ paddingLeft: '12px', borderLeft: '2px solid #333' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <input
                type="checkbox"
                checked={showMeshFrames}
                onChange={(e) => setShowMeshFrames(e.target.checked)}
              />
              <span style={{ color: '#ff6b6b' }}>Mesh Frames (RGB)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <input
                type="checkbox"
                checked={showFKFrames}
                onChange={(e) => setShowFKFrames(e.target.checked)}
              />
              <span style={{ color: '#00ffff' }}>FK Frames (CMY)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <input
                type="checkbox"
                checked={showDivergence}
                onChange={(e) => setShowDivergence(e.target.checked)}
              />
              <span style={{ color: '#ff0000' }}>Show Divergence</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <input
                type="checkbox"
                checked={showJointFrames}
                onChange={(e) => setShowJointFrames(e.target.checked)}
              />
              <span>Joint Frames</span>
            </label>

            <div style={{ marginTop: '8px' }}>
              <label style={{ display: 'block', marginBottom: '4px' }}>
                Frame Size: {frameSize.toFixed(2)}m
              </label>
              <input
                type="range"
                min="0.02"
                max="0.3"
                step="0.01"
                value={frameSize}
                onChange={(e) => setFrameSize(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}

        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '4px',
          fontSize: '10px',
        }}>
          <strong>Legend:</strong>
          <div>• Mesh frames (RGB): Actual scene transforms</div>
          <div>• FK frames (CMY): Computed transforms</div>
          <div>• Red line: Divergence &gt;1mm</div>
        </div>
      </div>

      {/* IK Test Harness Section */}
      <div>
        <h4 style={{ fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TestTube size={16} />
          IK Test Harness
        </h4>

        <button
          onClick={handleLoadCurrentPose}
          style={{
            padding: '6px 12px',
            background: '#444',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '11px',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Target size={12} />
          Load Current Pose
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px' }}>X (m)</label>
            <input
              type="number"
              step="0.001"
              value={targetPose.x}
              onChange={(e) => setTargetPose({ ...targetPose, x: parseFloat(e.target.value) || 0 })}
              style={{ width: '100%', padding: '4px', background: '#222', border: '1px solid #444', color: 'white', borderRadius: '2px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px' }}>Y (m)</label>
            <input
              type="number"
              step="0.001"
              value={targetPose.y}
              onChange={(e) => setTargetPose({ ...targetPose, y: parseFloat(e.target.value) || 0 })}
              style={{ width: '100%', padding: '4px', background: '#222', border: '1px solid #444', color: 'white', borderRadius: '2px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px' }}>Z (m)</label>
            <input
              type="number"
              step="0.001"
              value={targetPose.z}
              onChange={(e) => setTargetPose({ ...targetPose, z: parseFloat(e.target.value) || 0 })}
              style={{ width: '100%', padding: '4px', background: '#222', border: '1px solid #444', color: 'white', borderRadius: '2px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px' }}>RX (°)</label>
            <input
              type="number"
              step="1"
              value={targetPose.rx}
              onChange={(e) => setTargetPose({ ...targetPose, rx: parseFloat(e.target.value) || 0 })}
              style={{ width: '100%', padding: '4px', background: '#222', border: '1px solid #444', color: 'white', borderRadius: '2px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px' }}>RY (°)</label>
            <input
              type="number"
              step="1"
              value={targetPose.ry}
              onChange={(e) => setTargetPose({ ...targetPose, ry: parseFloat(e.target.value) || 0 })}
              style={{ width: '100%', padding: '4px', background: '#222', border: '1px solid #444', color: 'white', borderRadius: '2px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', marginBottom: '2px' }}>RZ (°)</label>
            <input
              type="number"
              step="1"
              value={targetPose.rz}
              onChange={(e) => setTargetPose({ ...targetPose, rz: parseFloat(e.target.value) || 0 })}
              style={{ width: '100%', padding: '4px', background: '#222', border: '1px solid #444', color: 'white', borderRadius: '2px' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
          <button
            onClick={handleTestPose}
            style={{
              padding: '8px',
              background: '#00d4aa',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            Test This Pose
          </button>
          <button
            onClick={handleRunTestSuite}
            style={{
              padding: '6px',
              background: '#444',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Run Test Suite (6 poses)
          </button>
          <button
            onClick={handleTestConsistency}
            style={{
              padding: '6px',
              background: '#444',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Test FK/IK Consistency
          </button>
        </div>

        <div style={{
          marginTop: '12px',
          padding: '8px',
          background: 'rgba(0, 212, 170, 0.1)',
          borderRadius: '4px',
          fontSize: '10px',
          borderLeft: '2px solid #00d4aa',
        }}>
          <strong>💡 Tip:</strong> Check browser console for detailed results
        </div>
      </div>
    </div>
  );
};
