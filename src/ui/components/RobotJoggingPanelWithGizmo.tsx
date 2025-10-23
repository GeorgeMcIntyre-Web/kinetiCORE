// TCP Gizmo Integration for Motion Panel
// This adds visual TCP gizmo to RobotJoggingPanel to fix jumping behavior

import React, { useState, useEffect } from 'react';
import { Move, RotateCw, Minus, Plus, Play, Save, Trash2, ChevronDown, ChevronRight, Target, Eye, EyeOff } from 'lucide-react';
import * as BABYLON from '@babylonjs/core';
import { KinematicsManager, RobotKeyframe } from '../../kinematics/KinematicsManager';
import type { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import { InverseKinematicsSolver } from '../../kinematics/InverseKinematicsSolver';
import { IKTargetGizmoManager } from '../../kinematics/IKTargetGizmoManager';
import { SceneManager } from '../../scene/SceneManager';
import { babylonToUser, userToBabylon } from '../../core/CoordinateSystem';
import { detectJointGroups, shouldUseJointGroups, JointGroup } from '../../kinematics/JointGroupDetector';
import './RobotJoggingPanel.css';

type JogMode = 'joint' | 'tcp' | 'poses';
type JogAxis = 'X' | 'Y' | 'Z' | 'RX' | 'RY' | 'RZ';

interface RobotJoggingPanelProps {
  joints: any[]; // Filtered joints for this specific robot
  fkSolver: ForwardKinematicsSolver;
  robotId: string; // Robot collection ID for filtering
}

export const RobotJoggingPanel: React.FC<RobotJoggingPanelProps> = ({ joints: propsJoints, fkSolver, robotId }) => {
  const [jogMode, setJogMode] = useState<JogMode>('joint');
  const [jogStepJoint, setJogStepJoint] = useState(5); // degrees
  const [jogStepTcpLinear, setJogStepTcpLinear] = useState(10); // mm for linear
  const [jogStepTcpRotary, setJogStepTcpRotary] = useState(5); // degrees for rotary
  const [joints, setJoints] = useState<any[]>([]);
  const [tcpPosition, setTcpPosition] = useState<string>('—');
  const [ikSolver] = useState(() => InverseKinematicsSolver.getInstance());
  const [keyframes, setKeyframes] = useState<RobotKeyframe[]>([]);
  const [newPoseName, setNewPoseName] = useState<string>('');
  const [jointGroups, setJointGroups] = useState<JointGroup[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [useGroups, setUseGroups] = useState<boolean>(false);
  
  // TCP Gizmo State
  const [showTcpGizmo, setShowTcpGizmo] = useState<boolean>(false);
  const [tcpGizmoPosition, setTcpGizmoPosition] = useState<BABYLON.Vector3 | null>(null);
  const [gizmoManager] = useState(() => IKTargetGizmoManager.getInstance());
  const [sceneManager] = useState(() => SceneManager.getInstance());

  // Use filtered joints from props
  useEffect(() => {
    // Filter to only show movable joints (not fixed joints)
    const movableJoints = propsJoints.filter(j =>
      j.type === 'revolute' || j.type === 'prismatic' || j.type === 'continuous'
    );
    setJoints(movableJoints);

    // Detect joint groups for complex robots
    const shouldGroup = shouldUseJointGroups(movableJoints.length);
    setUseGroups(shouldGroup);

    if (shouldGroup) {
      const groups = detectJointGroups(movableJoints);
      setJointGroups(groups);
      console.log(`[RobotJoggingPanel] Detected ${groups.length} joint groups for ${movableJoints.length} joints`);
    }
  }, [propsJoints]);

  // Initialize gizmo manager when TCP mode is active
  useEffect(() => {
    if (jogMode === 'tcp' && showTcpGizmo) {
      const scene = sceneManager.getScene();
      if (scene && !gizmoManager.isInitialized()) {
        gizmoManager.initialize(scene);
      }
    }
  }, [jogMode, showTcpGizmo]);

  // Update TCP position display and gizmo
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
          // Convert from Babylon space (Y-up, meters) to User space (Z-up, mm)
          const userPos = babylonToUser(endEffectorPose.position);
          setTcpPosition(
            `X:${userPos.x.toFixed(1)} Y:${userPos.y.toFixed(1)} Z:${userPos.z.toFixed(1)} mm`
          );
          
          // Update gizmo position if it's visible
          if (showTcpGizmo && jogMode === 'tcp') {
            setTcpGizmoPosition(endEffectorPose.position.clone());
            updateTcpGizmo(robotChain.name, endEffectorPose.position);
          }
        }
      }
    };

    updateTcpPosition();
    const interval = setInterval(updateTcpPosition, 500);
    return () => clearInterval(interval);
  }, [fkSolver, robotId, showTcpGizmo, jogMode]);

  // Update TCP gizmo in 3D scene
  const updateTcpGizmo = (chainName: string, position: BABYLON.Vector3) => {
    if (!showTcpGizmo || jogMode !== 'tcp') return;

    const targetId = `tcp_${robotId}`;
    
    // Ensure gizmo is positioned at the actual TCP (end-effector) location
    console.log(`[TCP Gizmo] Positioning at TCP: (${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)})`);
    
    gizmoManager.createTarget({
      targetId,
      chainName,
      position: position.clone(), // This should be the end-effector position, not robot base
      enabled: true,
      onPositionChange: (id, newPos) => {
        // When gizmo is dragged, move robot to new position
        console.log(`[TCP Gizmo] Moving robot TCP to: (${newPos.x.toFixed(3)}, ${newPos.y.toFixed(3)}, ${newPos.z.toFixed(3)})`);
        
        // Solve IK to reach new TCP position
        const success = ikSolver.solveAndApply(chainName, {
          position: newPos,
          rotation: fkSolver.getEndEffectorPose(chainName)?.rotation // Maintain current orientation
        }, 'ccd');
        
        if (!success) {
          console.warn('[TCP Gizmo] IK failed - TCP position may be unreachable');
          // Revert gizmo to last valid TCP position
          const currentPose = fkSolver.getEndEffectorPose(chainName);
          if (currentPose) {
            console.log(`[TCP Gizmo] Reverting to valid TCP position: (${currentPose.position.x.toFixed(3)}, ${currentPose.position.y.toFixed(3)}, ${currentPose.position.z.toFixed(3)})`);
            gizmoManager.updateTargetPosition(targetId, currentPose.position);
          }
        } else {
          console.log(`[TCP Gizmo] ✅ Robot TCP moved successfully to: (${newPos.x.toFixed(3)}, ${newPos.y.toFixed(3)}, ${newPos.z.toFixed(3)})`);
        }
      },
    });
  };

  // Toggle TCP gizmo visibility
  const toggleTcpGizmo = () => {
    const newShowGizmo = !showTcpGizmo;
    setShowTcpGizmo(newShowGizmo);
    
    if (!newShowGizmo) {
      // Remove gizmo when hiding
      const targetId = `tcp_${robotId}`;
      gizmoManager.removeTarget(targetId);
    }
  };

  // Load keyframes for this robot
  useEffect(() => {
    const kinematicsManager = KinematicsManager.getInstance();
    const updateKeyframes = () => {
      const chains = kinematicsManager.getAllChains();
      const robotChain = chains.find(chain => {
        return chain.joints.some((joint: any) => joint.id.startsWith(robotId));
      });

      if (robotChain) {
        const chainKeyframes = kinematicsManager.getKeyframesForChain(robotChain.id);
        setKeyframes(chainKeyframes);
      }
    };

    updateKeyframes();
    const interval = setInterval(updateKeyframes, 1000);
    return () => clearInterval(interval);
  }, [robotId]);

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

    // Create delta in USER space (Z-up, mm)
    const userDelta = { x: 0, y: 0, z: 0 };

    // Linear motion in USER space
    if (axis === 'X') {
      userDelta.x = jogStepTcpLinear * direction; // mm
    } else if (axis === 'Y') {
      userDelta.y = jogStepTcpLinear * direction; // mm
    } else if (axis === 'Z') {
      userDelta.z = jogStepTcpLinear * direction; // mm
    }

    // Convert USER delta (Z-up, mm) to BABYLON delta (Y-up, meters)
    const positionDelta = userToBabylon(userDelta);

    let success = false;

    // Rotary motion (orientation IK)
    if (axis.startsWith('R')) {
      // Convert rotation step from degrees to radians
      const angleRadians = (jogStepTcpRotary * Math.PI / 180) * direction;

      // Determine rotation axis in USER coordinate system (Z-up)
      let rotationAxis = new BABYLON.Vector3(0, 0, 0);
      if (axis === 'RX') {
        rotationAxis = new BABYLON.Vector3(1, 0, 0); // Roll (around X)
      } else if (axis === 'RY') {
        rotationAxis = new BABYLON.Vector3(0, 1, 0); // Pitch (around Y)
      } else if (axis === 'RZ') {
        rotationAxis = new BABYLON.Vector3(0, 0, 1); // Yaw (around Z)
      }

      // Convert axis from USER (Z-up) to BABYLON (Y-up)
      const babylonAxis = userToBabylon(rotationAxis);

      // Create rotation quaternion
      const rotationDelta = BABYLON.Quaternion.RotationAxis(babylonAxis.normalize(), angleRadians);

      // Apply rotation using Jacobian method (supports orientation control)
      success = ikSolver.rotateEndEffector(chainName, rotationDelta, 'jacobian');

      if (!success) {
        console.warn(`Rotary IK failed for: ${axis} ${direction > 0 ? '+' : '-'}${jogStepTcpRotary}°`);
      }

      return;
    }

    // Linear motion (position IK)
    // Try CCD first (more robust), fallback to Jacobian
    success = ikSolver.moveEndEffector(chainName, positionDelta, 'ccd');

    if (!success) {
      console.log('CCD failed, trying Jacobian method...');
      success = ikSolver.moveEndEffector(chainName, positionDelta, 'jacobian');
    }

    if (!success) {
      console.warn(`IK failed for TCP jog: ${axis} ${direction > 0 ? '+' : '-'}`);
      console.warn('Target may be out of reach or robot in singular configuration');
    }
  };

  const handleResetAll = () => {
    revoluteJoints.forEach(joint => {
      fkSolver.updateJointPosition(joint.id, 0);
    });
  };

  const handleLoadPose = (keyframeId: string) => {
    console.log(`Loading pose: ${keyframeId}`);
    const success = fkSolver.loadPose(keyframeId);
    if (success) {
      console.log('✅ Pose loaded successfully');
    } else {
      console.error('❌ Failed to load pose');
    }
  };

  const handleSavePose = () => {
    if (!newPoseName.trim()) {
      console.warn('Pose name cannot be empty');
      return;
    }

    const kinematicsManager = KinematicsManager.getInstance();
    const chains = kinematicsManager.getAllChains();
    const robotChain = chains.find(chain => {
      return chain.joints.some((joint: any) => joint.id.startsWith(robotId));
    });

    if (robotChain) {
      const keyframe = kinematicsManager.captureCurrentPose(robotChain.id, newPoseName.trim());
      console.log(`✅ Saved pose: ${keyframe.name}`);
      setNewPoseName('');
    } else {
      console.error('❌ No kinematic chain found for robot');
    }
  };

  const handleDeletePose = (keyframeId: string) => {
    const kinematicsManager = KinematicsManager.getInstance();
    const success = kinematicsManager.deleteKeyframe(keyframeId);
    if (success) {
      console.log('✅ Pose deleted');
    }
  };

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
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
          <Move size={14} />
          <span>Joint</span>
        </button>
        <button
          className={`mode-button ${jogMode === 'tcp' ? 'active' : ''}`}
          onClick={() => setJogMode('tcp')}
        >
          <RotateCw size={14} />
          <span>TCP</span>
        </button>
        <button
          className={`mode-button ${jogMode === 'poses' ? 'active' : ''}`}
          onClick={() => setJogMode('poses')}
        >
          <Play size={14} />
          <span>Poses</span>
        </button>
      </div>

      {/* Joint Mode */}
      {jogMode === 'joint' && (
        <div className="joint-jog-mode">
          <div className="jog-step-control">
            <label>Step</label>
            <div className="step-selector">
              <button onClick={() => setJogStepJoint(Math.max(1, jogStepJoint - 1))}>-</button>
              <input
                type="number"
                value={jogStepJoint}
                onChange={(e) => setJogStepJoint(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="90"
                placeholder="5"
                defaultValue="5"
              />
              <span className="unit">°</span>
              <button onClick={() => setJogStepJoint(Math.min(90, jogStepJoint + 1))}>+</button>
            </div>
          </div>

          {/* Joint groups for complex robots */}
          {useGroups && jointGroups.length > 0 ? (
            <div className="joint-groups">
              {jointGroups.map((group) => {
                const isCollapsed = collapsedGroups.has(group.name);
                return (
                  <div key={group.name} className="joint-group">
                    <div
                      className="joint-group-header"
                      onClick={() => toggleGroupCollapse(group.name)}
                    >
                      <div className="joint-group-info">
                        {group.icon && <span className="group-icon">{group.icon}</span>}
                        <span className="group-name">{group.displayName}</span>
                        <span className="group-count">({group.joints.length})</span>
                      </div>
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </div>
                    {!isCollapsed && (
                      <div className="joint-group-content">
                        {group.joints.map((joint) => (
                          <div key={joint.id} className="joint-jog-item">
                            <span className="joint-label">{joint.name}</span>
                            <span className="joint-value">
                              {(joint.position * 180 / Math.PI).toFixed(1)}°
                            </span>
                            <div className="jog-buttons">
                              <button
                                className="jog-btn jog-minus"
                                onMouseDown={() => handleJogJoint(joint.id, -1)}
                                title={`Jog ${joint.name} negative`}
                              >
                                -
                              </button>
                              <button
                                className="jog-btn jog-plus"
                                onMouseDown={() => handleJogJoint(joint.id, 1)}
                                title={`Jog ${joint.name} positive`}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
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
                      -
                    </button>
                    <button
                      className="jog-btn jog-plus"
                      onMouseDown={() => handleJogJoint(joint.id, 1)}
                      title={`Jog ${joint.name} positive`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TCP Mode */}
      {jogMode === 'tcp' && (
        <div className="tcp-jog-mode">
          {/* TCP Gizmo Controls */}
          <div className="tcp-gizmo-controls">
            <button
              className={`gizmo-toggle-btn ${showTcpGizmo ? 'active' : ''}`}
              onClick={toggleTcpGizmo}
              title={showTcpGizmo ? 'Hide TCP gizmo' : 'Show TCP gizmo'}
            >
              {showTcpGizmo ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{showTcpGizmo ? 'Hide Gizmo' : 'Show Gizmo'}</span>
            </button>
            {showTcpGizmo && (
              <div className="gizmo-info">
                <Target size={12} />
                <span>Drag gizmo to move TCP</span>
              </div>
            )}
          </div>

          <div className="jog-step-control">
            <label>Step</label>
            <div className="step-selector">
              <button onClick={() => setJogStepTcpLinear(Math.max(1, jogStepTcpLinear - 1))}>-</button>
              <input
                type="number"
                value={jogStepTcpLinear}
                onChange={(e) => setJogStepTcpLinear(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="100"
                placeholder="10"
                defaultValue="10"
              />
              <span className="unit">mm</span>
              <button onClick={() => setJogStepTcpLinear(Math.min(100, jogStepTcpLinear + 1))}>+</button>
            </div>
          </div>

          <div className="jog-step-control">
            <label>Step</label>
            <div className="step-selector">
              <button onClick={() => setJogStepTcpRotary(Math.max(1, jogStepTcpRotary - 1))}>-</button>
              <input
                type="number"
                value={jogStepTcpRotary}
                onChange={(e) => setJogStepTcpRotary(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="90"
                placeholder="5"
                defaultValue="5"
              />
              <span className="unit">°</span>
              <button onClick={() => setJogStepTcpRotary(Math.min(90, jogStepTcpRotary + 1))}>+</button>
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
                {(['RX', 'RY', 'RZ'] as JogAxis[]).map(axis => (
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

      {/* Poses Mode */}
      {jogMode === 'poses' && (
        <div className="poses-mode">
          <div className="poses-content">
            <div className="poses-header">
              <h4>Pose Library</h4>
              <span className="poses-count">{keyframes.length} poses</span>
            </div>

            {/* Add new pose */}
            <div className="pose-add-section">
              <input
                type="text"
                className="pose-name-input"
                placeholder="New pose name..."
                value={newPoseName}
                onChange={(e) => setNewPoseName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSavePose()}
              />
              <button
                className="pose-save-btn"
                onClick={handleSavePose}
                disabled={!newPoseName.trim()}
                title="Save current joint positions"
              >
                <Save size={14} />
                Save Current
              </button>
            </div>

            {/* Poses list */}
            <div className="poses-list">
              {keyframes.length > 0 ? (
                keyframes.map((keyframe) => (
                  <div key={keyframe.id} className="pose-item">
                    <div className="pose-info">
                      <span className="pose-name">{keyframe.name}</span>
                      <span className="pose-joints">
                        {Object.keys(keyframe.jointPositions).length} joints
                      </span>
                    </div>
                    <div className="pose-actions">
                      <button
                        className="pose-load-btn"
                        onClick={() => handleLoadPose(keyframe.id)}
                        title="Load this pose"
                      >
                        <Play size={12} />
                        Load
                      </button>
                      <button
                        className="pose-delete-btn"
                        onClick={() => handleDeletePose(keyframe.id)}
                        title="Delete this pose"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="poses-empty">
                  <p>No poses saved</p>
                  <p className="poses-hint">
                    {joints.length > 0
                      ? 'Set joint positions and save a pose'
                      : 'Load a robot with joints to save poses'}
                  </p>
                </div>
              )}
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
