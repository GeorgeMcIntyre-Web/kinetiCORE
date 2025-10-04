// Robot Jogging Panel - Professional 6-axis robot control
// Owner: George
//
// Provides two jogging modes:
// - Joint Mode: Jog individual joints
// - TCP Mode: Jog tool center point in Cartesian space

import { useState } from 'react';
import { Move, RotateCw, Minus, Plus } from 'lucide-react';
import type { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import './RobotJoggingPanel.css';

type JogMode = 'joint' | 'tcp';
type JogAxis = 'X' | 'Y' | 'Z' | 'Rx' | 'Ry' | 'Rz';

interface RobotJoggingPanelProps {
  joints: any[];
  fkSolver: ForwardKinematicsSolver;
}

export const RobotJoggingPanel: React.FC<RobotJoggingPanelProps> = ({ joints, fkSolver }) => {
  const [jogMode, setJogMode] = useState<JogMode>('joint');
  const [jogStepJoint, setJogStepJoint] = useState(5); // degrees
  const [jogStepTcp, setJogStepTcp] = useState(10); // mm for linear, 5 deg for rotary

  // Filter to only show revolute joints (exclude fixed joints)
  const revoluteJoints = joints.filter(j => j.type === 'revolute');

  // Debug logging
  console.log('[RobotJoggingPanel] Total joints:', joints.length);
  console.log('[RobotJoggingPanel] Revolute joints:', revoluteJoints.length);
  console.log('[RobotJoggingPanel] Joint names:', revoluteJoints.map(j => j.name));

  const handleJogJoint = (jointId: string, direction: number) => {
    const joint = joints.find(j => j.id === jointId);
    if (!joint) return;

    const stepRadians = (jogStepJoint * Math.PI) / 180;
    const newValue = joint.position + (stepRadians * direction);
    fkSolver.updateJointPosition(jointId, newValue);
  };

  const handleJogTcp = (axis: JogAxis, direction: number) => {
    // TODO: Implement inverse kinematics for TCP jogging
    console.log(`Jog TCP: ${axis} ${direction > 0 ? '+' : '-'}${jogStepTcp}${axis.startsWith('R') ? '°' : 'mm'}`);
    alert('TCP (Cartesian) jogging requires inverse kinematics - coming soon!');
  };

  const handleResetAll = () => {
    revoluteJoints.forEach(joint => {
      fkSolver.updateJointPosition(joint.id, 0);
    });
  };

  return (
    <div className="robot-jogging-panel">
      {/* Mode Selector */}
      <div className="jog-mode-selector">
        <button
          className={`mode-button ${jogMode === 'joint' ? 'active' : ''}`}
          onClick={() => setJogMode('joint')}
        >
          <RotateCw size={18} />
          <span>Joint</span>
        </button>
        <button
          className={`mode-button ${jogMode === 'tcp' ? 'active' : ''}`}
          onClick={() => setJogMode('tcp')}
        >
          <Move size={18} />
          <span>TCP</span>
        </button>
      </div>

      {/* Joint Mode */}
      {jogMode === 'joint' && (
        <div className="joint-jog-mode">
          <div className="jog-step-control">
            <label>Jog Step</label>
            <div className="step-selector">
              <button onClick={() => setJogStepJoint(Math.max(1, jogStepJoint - 1))}>-</button>
              <input
                type="number"
                value={jogStepJoint}
                onChange={(e) => setJogStepJoint(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="90"
              />
              <span className="unit">°</span>
              <button onClick={() => setJogStepJoint(Math.min(90, jogStepJoint + 1))}>+</button>
            </div>
          </div>

          <div className="joints-grid">
            {revoluteJoints.map((joint, index) => (
              <div key={joint.id} className="joint-jog-item">
                <div className="joint-header">
                  <span className="joint-label">{joint.name}</span>
                  <span className="joint-value">
                    {(joint.position * 180 / Math.PI).toFixed(1)}°
                  </span>
                </div>
                <div className="jog-buttons">
                  <button
                    className="jog-btn jog-minus"
                    onMouseDown={() => handleJogJoint(joint.id, -1)}
                    title={`Jog ${joint.name} negative`}
                  >
                    <Minus size={16} />
                  </button>
                  <button
                    className="jog-btn jog-plus"
                    onMouseDown={() => handleJogJoint(joint.id, 1)}
                    title={`Jog ${joint.name} positive`}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="joint-limits">
                  <span className="limit-min">{(joint.limits.lower * 180 / Math.PI).toFixed(0)}°</span>
                  <div className="limit-bar">
                    <div
                      className="limit-indicator"
                      style={{
                        left: `${((joint.position - joint.limits.lower) / (joint.limits.upper - joint.limits.lower)) * 100}%`
                      }}
                    />
                  </div>
                  <span className="limit-max">{(joint.limits.upper * 180 / Math.PI).toFixed(0)}°</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TCP Mode */}
      {jogMode === 'tcp' && (
        <div className="tcp-jog-mode">
          <div className="jog-step-control">
            <label>Jog Step</label>
            <div className="step-selector">
              <button onClick={() => setJogStepTcp(Math.max(1, jogStepTcp - 1))}>-</button>
              <input
                type="number"
                value={jogStepTcp}
                onChange={(e) => setJogStepTcp(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="100"
              />
              <span className="unit">mm</span>
              <button onClick={() => setJogStepTcp(Math.min(100, jogStepTcp + 1))}>+</button>
            </div>
          </div>

          <div className="tcp-controls">
            <div className="tcp-section">
              <h4>Linear</h4>
              <div className="tcp-axis-group">
                {(['X', 'Y', 'Z'] as JogAxis[]).map(axis => (
                  <div key={axis} className="tcp-axis">
                    <span className="axis-label">{axis}</span>
                    <button
                      className="jog-btn jog-minus"
                      onMouseDown={() => handleJogTcp(axis, -1)}
                      title={`Jog ${axis} negative`}
                    >
                      <Minus size={16} />
                    </button>
                    <button
                      className="jog-btn jog-plus"
                      onMouseDown={() => handleJogTcp(axis, 1)}
                      title={`Jog ${axis} positive`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="tcp-section">
              <h4>Rotary</h4>
              <div className="tcp-axis-group">
                {(['Rx', 'Ry', 'Rz'] as JogAxis[]).map(axis => (
                  <div key={axis} className="tcp-axis">
                    <span className="axis-label">{axis}</span>
                    <button
                      className="jog-btn jog-minus"
                      onMouseDown={() => handleJogTcp(axis, -1)}
                      title={`Rotate ${axis} negative`}
                    >
                      <Minus size={16} />
                    </button>
                    <button
                      className="jog-btn jog-plus"
                      onMouseDown={() => handleJogTcp(axis, 1)}
                      title={`Rotate ${axis} positive`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="tcp-info">
              <p className="info-text">
                ⚠️ TCP jogging requires inverse kinematics solver
              </p>
              <p className="info-subtext">
                Currently under development. Use Joint mode for now.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reset Button */}
      <div className="panel-actions">
        <button className="reset-button" onClick={handleResetAll}>
          Reset All to Home
        </button>
      </div>
    </div>
  );
};
