// Robot Jogging Panel - Professional 6-axis robot control
// Owner: George
//
// Provides two jogging modes:
// - Joint Mode: Jog individual joints
// - TCP Mode: Jog tool center point in Cartesian space

import { useState, useEffect } from 'react';
import { Move, RotateCw, Minus, Plus } from 'lucide-react';
import * as BABYLON from '@babylonjs/core';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import type { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import { InverseKinematicsSolver } from '../../kinematics/InverseKinematicsSolver';
import './RobotJoggingPanel.css';

type JogMode = 'joint' | 'tcp';
type JogAxis = 'X' | 'Y' | 'Z' | 'Rx' | 'Ry' | 'Rz';

interface RobotJoggingPanelProps {
  joints: any[]; // Filtered joints for this specific robot
  fkSolver: ForwardKinematicsSolver;
  robotId: string; // Robot collection ID for filtering
}

export const RobotJoggingPanel: React.FC<RobotJoggingPanelProps> = ({ joints: propsJoints, fkSolver, robotId }) => {
  const [jogMode, setJogMode] = useState<JogMode>('joint');
  const [jogStepJoint, setJogStepJoint] = useState(5); // degrees
  const [jogStepTcp, setJogStepTcp] = useState(10); // mm for linear, 5 deg for rotary
  const [joints, setJoints] = useState<any[]>([]);
  const [tcpPosition, setTcpPosition] = useState<string>('—');
  const [ikSolver] = useState(() => InverseKinematicsSolver.getInstance());

  // Use filtered joints from props
  useEffect(() => {
    // Filter to only show movable joints (not fixed joints)
    const movableJoints = propsJoints.filter(j =>
      j.type === 'revolute' || j.type === 'prismatic' || j.type === 'continuous'
    );
    setJoints(movableJoints);
  }, [propsJoints]);

  // Update TCP position display
  useEffect(() => {
    const kinematicsManager = KinematicsManager.getInstance();
    const updateTcpPosition = () => {
      const chains = kinematicsManager.getAllChains();
      // Find the chain for this specific robot
      const robotChain = chains.find(chain => {
        // Check if this chain belongs to this robot by checking joint IDs
        return chain.joints.some((joint: any) => joint.id.startsWith(robotId));
      });

      if (robotChain) {
        const endEffectorPose = fkSolver.getEndEffectorPose(robotChain.name);
        if (endEffectorPose) {
          const pos = endEffectorPose.position;
          setTcpPosition(
            `X:${(pos.x * 1000).toFixed(1)} Y:${(pos.y * 1000).toFixed(1)} ` +
            `Z:${(pos.z * 1000).toFixed(1)} mm`
          );
        }
      }
    };

    updateTcpPosition();
    const interval = setInterval(updateTcpPosition, 500);
    return () => clearInterval(interval);
  }, [fkSolver, robotId]);

  // Filter to only show revolute joints (exclude fixed joints)
  const revoluteJoints = joints.filter(j => j.type === 'revolute');

  const handleJogJoint = (jointId: string, direction: number) => {
    const joint = joints.find(j => j.id === jointId);
    if (!joint) {
      console.error('Joint not found:', jointId);
      return;
    }

    const stepRadians = (jogStepJoint * Math.PI) / 180;
    const newValue = joint.position + (stepRadians * direction);
    fkSolver.updateJointPosition(jointId, newValue);
  };

  const handleJogTcp = (axis: JogAxis, direction: number) => {
    const kinematicsManager = KinematicsManager.getInstance();
    const chains = kinematicsManager.getAllChains();

    if (chains.length === 0) {
      console.warn('No kinematic chains available');
      return;
    }

    // Find the chain for this specific robot
    const robotChain = chains.find(chain =>
      chain.joints.some((joint: any) => joint.id.startsWith(robotId))
    );

    if (!robotChain) {
      console.warn('No kinematic chain found for this robot');
      return;
    }

    const chainName = robotChain.name;

    // Convert mm to meters for position deltas
    const stepMeters = jogStepTcp / 1000.0;

    // eslint-disable-next-line prefer-const -- object properties are mutated below
    let positionDelta = new BABYLON.Vector3(0, 0, 0);

    // Linear motion
    if (axis === 'X') {
      positionDelta.x = stepMeters * direction;
    } else if (axis === 'Y') {
      positionDelta.y = stepMeters * direction;
    } else if (axis === 'Z') {
      positionDelta.z = stepMeters * direction;
    }

    // Rotary motion (TODO: requires orientation IK)
    if (axis.startsWith('R')) {
      console.log(
        `Rotary TCP jogging (${axis}) not yet implemented - requires orientation IK`
      );
      return;
    }

    // Solve IK for new position
    const success = ikSolver.moveEndEffector(chainName, positionDelta, 'jacobian');

    if (!success) {
      console.warn(`IK failed for TCP jog: ${axis} ${direction > 0 ? '+' : '-'}`);
    }
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
                <span className="joint-label">J{index + 1}</span>
                <span className="joint-value">
                  {(joint.position * 180 / Math.PI).toFixed(1)}°
                </span>
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
                📍 Current TCP Position
              </p>
              <p className="info-subtext">
                {tcpPosition}
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
