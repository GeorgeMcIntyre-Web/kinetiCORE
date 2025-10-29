// Robot Jogging Panel with TCP Gizmo Integration
// Owner: George
//
// Provides two jogging modes:
// - Joint Mode: Jog individual joints
// - TCP Mode: Jog tool center point in Cartesian space with visual gizmo

import { useState, useEffect, useRef } from 'react';
import { Move, RotateCw, Minus, Plus, Play, Save, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import * as BABYLON from '@babylonjs/core';
import { KinematicsManager, RobotKeyframe } from '../../kinematics/KinematicsManager';
import type { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import { InverseKinematicsSolver } from '../../kinematics/InverseKinematicsSolver';
import { UnifiedGizmoManager } from '../../kinematics/UnifiedGizmoManager';
import { TransformDebugVisualizer } from '../../kinematics/TransformDebugVisualizer';
import { SceneManager } from '../../scene/SceneManager';
import { babylonToUser, userToBabylon } from '../../core/CoordinateSystem';
import { detectJointGroups, shouldUseJointGroups, JointGroup } from '../../kinematics/JointGroupDetector';
import './RobotJoggingPanel.css';

type JogMode = 'joint' | 'tcp' | 'poses';
type JogAxis = 'X' | 'Y' | 'Z' | 'RX' | 'RY' | 'RZ';
type IKDebugMode = 'off' | 'summary' | 'verbose';

interface RobotJoggingPanelProps {
  joints: any[]; // Filtered joints for this specific robot
  fkSolver: ForwardKinematicsSolver;
  robotId: string; // Robot collection ID for filtering
}

export const RobotJoggingPanelWithGizmo: React.FC<RobotJoggingPanelProps> = ({ joints: propsJoints, fkSolver, robotId }) => {
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
  const [debugMode] = useState<IKDebugMode>(() => (localStorage.getItem('ikDebugMode') as IKDebugMode) || 'summary');
  
  // Gizmo management
  const [unifiedGizmo] = useState(() => UnifiedGizmoManager.getInstance());
  const [_currentTcpPosition, setCurrentTcpPosition] = useState<BABYLON.Vector3 | null>(null);
  const [_currentChainName, setCurrentChainName] = useState<string | null>(null);
  const gizmoInitialized = useRef(false);
  // IK debug overlay meshes
  const ikAxisXRef = useRef<BABYLON.LinesMesh | null>(null);
  const ikAxisYRef = useRef<BABYLON.LinesMesh | null>(null);
  const ikAxisZRef = useRef<BABYLON.LinesMesh | null>(null);
  const ikDeltaRef = useRef<BABYLON.LinesMesh | null>(null);
  const ikErrorRef = useRef<BABYLON.LinesMesh | null>(null);

  // Logging helpers
  const logSummary = (...args: any[]) => {
    if (debugMode === 'summary' || debugMode === 'verbose') console.log(...args);
  };
  const logVerbose = (...args: any[]) => {
    if (debugMode === 'verbose') console.log(...args);
  };

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

  // Initialize gizmo system
  useEffect(() => {
    if (!gizmoInitialized.current) {
      // Get scene from window (assuming it's available globally)
      const sceneManager = (window as any).sceneManager;
      if (sceneManager && sceneManager.getScene) {
        const scene = sceneManager.getScene();
        if (scene) {
          unifiedGizmo.initialize(scene);
          gizmoInitialized.current = true;
          console.log('[RobotJoggingPanel] Gizmo system initialized');
        }
      }
    }
  }, [unifiedGizmo]);

  // Show TCP gizmo in joint mode if device has TCP
  useEffect(() => {
    if (jogMode === 'joint') {
      // Switch to motion panel context
      unifiedGizmo.setActivePanel('motion');
      
      // Get current TCP position and create gizmo if device has TCP
      const kinematicsManager = KinematicsManager.getInstance();
      const chains = kinematicsManager.getAllChains();
      const robotChain = chains.find(chain => {
        return chain.joints.some((joint: any) => joint.id.startsWith(robotId));
      });
      
      if (robotChain) {
        // Check if device has TCP
        const tcpPose = fkSolver.getTCPPose?.(robotChain.name) || fkSolver.getNullTCPPose(robotChain.name);
        if (tcpPose) {
          // Create TCP gizmo even in joint mode
          unifiedGizmo.createTcpControl(
            robotId,
            robotChain.name,
            tcpPose.position,
            (newPosition) => {
              // In joint mode, TCP gizmo movement should still work for visual reference
              // but we don't apply IK automatically
              const targetId = `tcp_${robotId}`;
              unifiedGizmo.updateTargetPosition(targetId, newPosition);
            },
            tcpPose.rotation,
            undefined // No rotation callback in joint mode
          );
          console.log('[RobotJoggingPanel] TCP gizmo shown in joint mode');
        }
      }
    }
  }, [jogMode, robotId, unifiedGizmo, fkSolver]);

  // Automatically show joint debug frames when panel opens
  useEffect(() => {
    const kinematicsManager = KinematicsManager.getInstance();
    const sceneManager = (window as any).sceneManager as SceneManager;

    if (sceneManager && kinematicsManager && robotId) {
      const scene = sceneManager.getScene();
      if (scene) {
        const chains = kinematicsManager.getAllChains();
        const robotChain = chains.find(chain =>
          chain.joints.some((joint: any) => joint.id.startsWith(robotId))
        );

        if (robotChain) {
          console.log(`[RobotJoggingPanel] Auto-showing joint gizmos for chain: ${robotChain.id}`);
          kinematicsManager.showAllJointDebugFrames(robotChain.id, scene);
        }
      }
    }
  }, [robotId]); // Run when robotId changes or component mounts

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
        // Use getTCPPose() to get TCP frame with offset and rotation applied
        const tcpPose = fkSolver.getTCPPose?.(robotChain.name) || fkSolver.getNullTCPPose(robotChain.name);
        if (tcpPose) {
          // Convert from Babylon space (Y-up, meters) to User space (Z-up, mm)
          const userPos = babylonToUser(tcpPose.position);

          // Convert quaternion to RPY (Roll-Pitch-Yaw) Euler angles
          // ROS/URDF convention: Roll around X, Pitch around Y, Yaw around Z
          const quat = tcpPose.rotation;
          const qx = quat.x, qy = quat.y, qz = quat.z, qw = quat.w;
          
          // Convert quaternion to RPY (intrinsic XYZ order - Roll, Pitch, Yaw)
          // This matches ROS/URDF conventions
          const sinr_cosp = 2 * (qw * qx + qy * qz);
          const cosr_cosp = 1 - 2 * (qx * qx + qy * qy);
          const roll = Math.atan2(sinr_cosp, cosr_cosp);
          
          const sinp = 2 * (qw * qy - qz * qx);
          const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);
          
          const siny_cosp = 2 * (qw * qz + qx * qy);
          const cosy_cosp = 1 - 2 * (qy * qy + qz * qz);
          const yaw = Math.atan2(siny_cosp, cosy_cosp);
          
          // Convert to degrees
          const rxDeg = (roll * 180) / Math.PI;   // Roll around X
          const ryDeg = (pitch * 180) / Math.PI;  // Pitch around Y  
          const rzDeg = (yaw * 180) / Math.PI;    // Yaw around Z
          
          setTcpPosition(
            `X:${userPos.x.toFixed(1)} Y:${userPos.y.toFixed(1)} Z:${userPos.z.toFixed(1)} mm | Rx:${rxDeg.toFixed(1)}° Ry:${ryDeg.toFixed(1)}° Rz:${rzDeg.toFixed(1)}°`
          );
          
          // Update gizmo position and rotation if in TCP mode
          if (jogMode === 'tcp' && tcpPose.position) {
            setCurrentTcpPosition(tcpPose.position.clone());
            setCurrentChainName(robotChain.name);

          // Update existing gizmo position and rotation instead of recreating
          const targetId = `tcp_${robotId}`;
          // Removed excessive logging - only log on significant changes
          unifiedGizmo.updateTargetPosition(targetId, tcpPose.position);
          unifiedGizmo.updateTargetRotation(targetId, tcpPose.rotation);
          }
        }
      }
    };

    updateTcpPosition();
    // More frequent updates for smoother gizmo tracking
    // Increased to 500ms to reduce spam and allow IK to complete
    const interval = setInterval(updateTcpPosition, 500);
    return () => clearInterval(interval);
  }, [fkSolver, robotId, jogMode, ikSolver, unifiedGizmo]);

  // Handle mode changes
  useEffect(() => {
    if (jogMode === 'tcp') {
      // Switch to motion panel context
      unifiedGizmo.setActivePanel('motion');
      
      // Get current TCP position and create gizmo
      const kinematicsManager = KinematicsManager.getInstance();
      const chains = kinematicsManager.getAllChains();
      const robotChain = chains.find(chain => {
        return chain.joints.some((joint: any) => joint.id.startsWith(robotId));
      });
      
      if (robotChain) {
        // Use getTCPPose() to get TCP frame with offset and rotation applied
        const tcpPose = fkSolver.getTCPPose?.(robotChain.name) || fkSolver.getNullTCPPose(robotChain.name);
        if (tcpPose) {
          console.log(`[RobotJoggingPanel] Creating TCP gizmo for robot: ${robotId}, chain: ${robotChain.name}`);
          console.log(`[RobotJoggingPanel] TCP position: (${tcpPose.position.x.toFixed(3)}, ${tcpPose.position.y.toFixed(3)}, ${tcpPose.position.z.toFixed(3)})`);
          const euler = tcpPose.rotation.toEulerAngles();
          console.log(`[RobotJoggingPanel] TCP rotation: Rx=${(euler.x*180/Math.PI).toFixed(1)}° Ry=${(euler.y*180/Math.PI).toFixed(1)}° Rz=${(euler.z*180/Math.PI).toFixed(1)}°`);
          // Create TCP gizmo with move and rotate callbacks
          unifiedGizmo.createTcpControl(
            robotId,
            robotChain.name,
            tcpPose.position,
            (newPosition) => {
              console.log('═══════════════════════════════════════════════════════════');
              console.log('[RobotJoggingPanel] TCP gizmo moved to:', newPosition);

              // Get the ACTUAL current TCP position from FK solver
              // (robots might have moved via previous IK solves)
              const currentPose = fkSolver.getTCPPose?.(robotChain.name) || fkSolver.getNullTCPPose(robotChain.name);
              if (!currentPose) {
                console.error('[RobotJoggingPanel] Failed to get current TCP pose');
                console.error('[RobotJoggingPanel] Chain name:', robotChain.name);
                console.error('[RobotJoggingPanel] Robot ID:', robotId);
                return;
              }

              // Both gizmo and IK solver work in Babylon space (Y-up, meters)
              // Compute delta from current position
              const delta = newPosition.subtract(currentPose.position);

              console.log('[RobotJoggingPanel] Current TCP:', currentPose.position);
              console.log('[RobotJoggingPanel] New position:', newPosition);
              console.log('[RobotJoggingPanel] Delta:', delta);
              console.log('[RobotJoggingPanel] Delta magnitude:', delta.length());

              // Apply IK to move robot to new TCP position
              console.log('[RobotJoggingPanel] Calling IK with delta:', delta);
              const success = ikSolver.moveTCP(robotChain.name, delta, 'jacobian');

              if (success) {
                // After successful IK, get the actual achieved position
                const finalPose = fkSolver.getTCPPose?.(robotChain.name) || fkSolver.getNullTCPPose(robotChain.name);
                if (finalPose) {
                  console.log('[RobotJoggingPanel] Final TCP after IK:', finalPose.position);
                  // Update gizmo to match where robot actually ended up
                  const targetId = `tcp_${robotId}`;
                  unifiedGizmo.updateTargetPosition(targetId, finalPose.position);
                  console.log('[RobotJoggingPanel] Gizmo synced to final TCP:', finalPose.position);
                }
              } else {
                console.error('[RobotJoggingPanel] IK failed for TCP gizmo movement');
              }
              console.log('═══════════════════════════════════════════════════════════');
            },
            tcpPose.rotation,
            (_newRotation) => {
              console.log('[RobotJoggingPanel] TCP gizmo rotated');
              // TODO: Apply rotation-based IK when support is added
              // For now, just log the rotation change
            }
          );
          console.log('[RobotJoggingPanel] Created TCP gizmo at:', tcpPose.position);
        }
      }
    } else if (jogMode === 'joint') {
      // Keep TCP gizmo visible in joint mode (handled by separate effect)
      // Just ensure motion panel context is active
      unifiedGizmo.setActivePanel('motion');
    } else {
      // Clear TCP gizmo when not in TCP or joint mode
      unifiedGizmo.removeTarget(`tcp_${robotId}`);
      unifiedGizmo.setActivePanel('none');
      console.log('[RobotJoggingPanel] Switched away from TCP/Joint mode - gizmo cleared');
    }
  }, [jogMode, robotId, unifiedGizmo, fkSolver, ikSolver]);

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

    // Update TCP gizmo position immediately after joint move (both joint and TCP mode)
    const kinematicsManager = KinematicsManager.getInstance();
    const chains = kinematicsManager.getAllChains();
    const robotChain = chains.find(chain =>
      chain.joints.some((joint: any) => joint.id.startsWith(robotId))
    );

    if (robotChain) {
      const tcpPose = fkSolver.getTCPPose?.(robotChain.name) || fkSolver.getNullTCPPose(robotChain.name);
      if (tcpPose) {
        const targetId = `tcp_${robotId}`;
        unifiedGizmo.updateTargetPosition(targetId, tcpPose.position);
        unifiedGizmo.updateTargetRotation(targetId, tcpPose.rotation);
      }
    }

    // Update debug visualizer if enabled
    const visualizer = TransformDebugVisualizer.getInstance();
    if (visualizer) {
      visualizer.update();
    }
  };

  const handleJogTcp = (axis: JogAxis, direction: number) => {
    logSummary(`[RobotJoggingPanel] TCP Jog: ${axis} ${direction > 0 ? '+' : '-'}`);
    
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
    logVerbose(`[RobotJoggingPanel] Found chain: ${chainName}`);

    // Get TCP WORLD rotation from actual mesh (getNullTCPPose)
    const chain = kinematicsManager.getChain(chainName);
    if (!chain) {
      console.error('[RobotJoggingPanel] Chain not found for TCP jog:', chainName);
      return;
    }
    
    // Get current joint angles to update meshes to correct position
    const actuatedJoints = kinematicsManager.getActuatedJoints(chain.id);
    const currentJointAngles = actuatedJoints.map((j: any) => j.position);
    const currentPoseLocal = fkSolver.solve(chainName, currentJointAngles);
    if (!currentPoseLocal) {
      console.error('[RobotJoggingPanel] FK solve failed for TCP jog');
      return;
    }
    
    // Get actual null TCP pose from mesh (world space)
    const nullTCPPose = fkSolver.getNullTCPPose(chainName);
    if (!nullTCPPose) {
      console.error('[RobotJoggingPanel] Could not get null TCP pose');
      return;
    }
    
    const currentPosWorld = nullTCPPose.position;
    const tcpWorldRotation = nullTCPPose.rotation;

    // DEBUG: Log TCP world rotation for debugging
    const tcpEuler = tcpWorldRotation.toEulerAngles();
    
    // Get TCP local X axis direction in world space
    const tcpRotMatrix = new BABYLON.Matrix();
    tcpWorldRotation.toRotationMatrix(tcpRotMatrix);
    const tcpLocalXAxis = new BABYLON.Vector3(tcpRotMatrix.m[0], tcpRotMatrix.m[1], tcpRotMatrix.m[2]);
    
    logSummary(`═══════════════════════════════════════════════════════════`);
    logSummary(`[TCP Jog] ${axis}${direction > 0 ? '+' : '-'} ${jogStepTcpLinear}mm`);
    logSummary(`[TCP Jog] Current null TCP WORLD position: (${currentPosWorld.x.toFixed(4)}, ${currentPosWorld.y.toFixed(4)}, ${currentPosWorld.z.toFixed(4)})`);
    logSummary(`[TCP Jog] Current null TCP WORLD rotation: Rx=${(tcpEuler.x*180/Math.PI).toFixed(1)}° Ry=${(tcpEuler.y*180/Math.PI).toFixed(1)}° Rz=${(tcpEuler.z*180/Math.PI).toFixed(1)}°`);
    logSummary(`[TCP Jog] TCP local X-axis direction (world): (${tcpLocalXAxis.x.toFixed(3)}, ${tcpLocalXAxis.y.toFixed(3)}, ${tcpLocalXAxis.z.toFixed(3)})`);
    logVerbose(`[TCP Jog] TCP world rotation quaternion: (${tcpWorldRotation.x.toFixed(3)}, ${tcpWorldRotation.y.toFixed(3)}, ${tcpWorldRotation.z.toFixed(3)}, ${tcpWorldRotation.w.toFixed(3)})`);

    // Create delta in TCP LOCAL frame (meters)
    const stepMeters = (jogStepTcpLinear * 0.001) * direction;
    const localDeltaBabylon = new BABYLON.Vector3(0, 0, 0);

    // Linear motion in TCP LOCAL frame (follows null TCP orientation)
    if (axis === 'X') {
      localDeltaBabylon.x = stepMeters; // along TCP local X
    } else if (axis === 'Y') {
      localDeltaBabylon.y = stepMeters; // along TCP local Y
    } else if (axis === 'Z') {
      localDeltaBabylon.z = stepMeters; // along TCP local Z
    }

    // DEBUG: Log local delta before transformation
    logVerbose(`[RobotJoggingPanel] Local delta (TCP frame): (${localDeltaBabylon.x.toFixed(3)}, ${localDeltaBabylon.y.toFixed(3)}, ${localDeltaBabylon.z.toFixed(3)})`);

    // Rotate TCP-local delta by WORLD TCP rotation to get WORLD-space delta
    const rotationMatrix = new BABYLON.Matrix();
    tcpWorldRotation.toRotationMatrix(rotationMatrix);
    const positionDelta = BABYLON.Vector3.TransformCoordinates(
      localDeltaBabylon,
      rotationMatrix
    );

    // DEBUG: Log world delta after transformation
    const targetPos = currentPosWorld.add(positionDelta);
    logSummary(`[TCP Jog] Local delta in TCP frame: (${localDeltaBabylon.x.toFixed(4)}, ${localDeltaBabylon.y.toFixed(4)}, ${localDeltaBabylon.z.toFixed(4)})`);
    logSummary(`[TCP Jog] World delta after rotation: (${positionDelta.x.toFixed(4)}, ${positionDelta.y.toFixed(4)}, ${positionDelta.z.toFixed(4)})`);
    logSummary(`[TCP Jog] Target position should be: (${targetPos.x.toFixed(4)}, ${targetPos.y.toFixed(4)}, ${targetPos.z.toFixed(4)})`);

    // Draw IK debug overlay (axes at TCP and intended delta)
    try {
      const scene = (window as any).sceneManager?.getScene?.();
      if (scene && (debugMode === 'summary' || debugMode === 'verbose')) {
        const rotM = new BABYLON.Matrix();
        tcpWorldRotation.toRotationMatrix(rotM);
        const xDir = new BABYLON.Vector3(rotM.m[0], rotM.m[1], rotM.m[2]);
        const yDir = new BABYLON.Vector3(rotM.m[4], rotM.m[5], rotM.m[6]);
        const zDir = new BABYLON.Vector3(rotM.m[8], rotM.m[9], rotM.m[10]);

        const axisLen = 0.05; // 5 cm visuals
        const mkLine = (ref: React.MutableRefObject<BABYLON.LinesMesh | null>, from: BABYLON.Vector3, to: BABYLON.Vector3, color: BABYLON.Color3) => {
          if (ref.current && !ref.current.isDisposed()) {
            ref.current.dispose(false, true);
            ref.current = null;
          }
          const line = BABYLON.MeshBuilder.CreateLines('ik_debug_line', { points: [from, to], updatable: false }, scene);
          line.color = color;
          line.isPickable = false;
          ref.current = line as BABYLON.LinesMesh;
        };

        mkLine(ikAxisXRef, currentPosWorld, currentPosWorld.add(xDir.scale(axisLen)), BABYLON.Color3.Red());
        mkLine(ikAxisYRef, currentPosWorld, currentPosWorld.add(yDir.scale(axisLen)), BABYLON.Color3.Green());
        mkLine(ikAxisZRef, currentPosWorld, currentPosWorld.add(zDir.scale(axisLen)), BABYLON.Color3.Blue());

        // Intended world delta (cyan)
        mkLine(ikDeltaRef, currentPosWorld, currentPosWorld.add(positionDelta), new BABYLON.Color3(0, 1, 1));
      }
    } catch {}

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
      success = ikSolver.rotateTCP(chainName, rotationDelta, 'jacobian');

      if (!success) {
        console.warn(`Rotary IK failed for: ${axis} ${direction > 0 ? '+' : '-'}${jogStepTcpRotary}°`);
      }

      return;
    }

    // Linear motion (position IK)
    logSummary(`[RobotJoggingPanel] Moving TCP by ${axis} delta: (${positionDelta.x.toFixed(3)}, ${positionDelta.y.toFixed(3)}, ${positionDelta.z.toFixed(3)})`);
    
    // Use Jacobian first (faster, more reliable for this robot), fallback to CCD
    success = ikSolver.moveTCP(chainName, positionDelta, 'jacobian');

    if (!success) {
      logSummary('[RobotJoggingPanel] Jacobian failed, trying CCD method...');
      success = ikSolver.moveTCP(chainName, positionDelta, 'ccd');
    }

    if (!success) {
      console.warn(`[RobotJoggingPanel] IK failed for TCP jog: ${axis} ${direction > 0 ? '+' : '-'}`);
      console.warn('[RobotJoggingPanel] Target may be out of reach or robot in singular configuration');
      logSummary(`[TCP Jog] ❌ IK FAILED for ${axis}${direction > 0 ? '+' : '-'}`);
      logSummary(`═══════════════════════════════════════════════════════════`);
    } else {
      logSummary(`[RobotJoggingPanel] ✅ Successfully moved TCP ${axis} ${direction > 0 ? '+' : '-'}`);
      
      // Log actual final position for comparison
      if (true) {
        try {
          const kinematicsManager = KinematicsManager.getInstance();
          const chain = kinematicsManager.getChain(chainName);
          if (chain) {
            const joints = kinematicsManager.getActuatedJoints(chain.id);
            const jointAngles = joints.map((j: any) => j.position);
            const achievedLocal = fkSolver.solve(chainName, jointAngles);
            if (achievedLocal) {
              const baseWM = kinematicsManager.getBaseWorldMatrix(chain.id) || BABYLON.Matrix.Identity();
              const achievedWorld = BABYLON.Vector3.TransformCoordinates(achievedLocal.position, baseWM);
              const errorVec = targetPos.subtract(achievedWorld);
              const errorMag = errorVec.length();
              logSummary(`[TCP Jog] ✅ Actual final position: (${achievedWorld.x.toFixed(4)}, ${achievedWorld.y.toFixed(4)}, ${achievedWorld.z.toFixed(4)})`);
              logSummary(`[TCP Jog] Position error: ${errorMag.toFixed(4)}m (${(errorMag*1000).toFixed(2)}mm)`);
              logSummary(`═══════════════════════════════════════════════════════════`);

              // After solve, draw error vector (magenta) from achieved to target
              const scene = (window as any).sceneManager?.getScene?.();
              if (scene && (debugMode === 'summary' || debugMode === 'verbose')) {
                if (ikErrorRef.current && !ikErrorRef.current.isDisposed()) {
                  ikErrorRef.current.dispose(false, true);
                  ikErrorRef.current = null;
                }
                const errLine = BABYLON.MeshBuilder.CreateLines('ik_error_line', { points: [achievedWorld, targetPos], updatable: false }, scene);
                errLine.color = new BABYLON.Color3(1, 0, 1);
                errLine.isPickable = false;
                ikErrorRef.current = errLine as BABYLON.LinesMesh;
              }
            }
          }
        } catch (e) {
          logVerbose(`[TCP Jog] Error computing final position: ${e}`);
        }
      }
    }
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

      {/* TCP Mode with Gizmo */}
      {jogMode === 'tcp' && (
        <div className="tcp-jog-mode">
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

    </div>
  );
};