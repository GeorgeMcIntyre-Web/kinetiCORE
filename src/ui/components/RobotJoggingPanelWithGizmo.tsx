// Robot Jogging Panel with TCP Gizmo Integration
// Owner: George
//
// Provides two jogging modes:
// - Joint Mode: Jog individual joints
// - TCP Mode: Jog tool center point in Cartesian space with visual gizmo

import { useState, useEffect, useRef } from 'react';
import { Move, RotateCw, Minus, Plus, Play, Save, Trash2, ChevronDown, ChevronRight, Target, PlayCircle, StopCircle, ArrowUp, ArrowDown, ArrowRight, Info } from 'lucide-react';
import * as BABYLON from '@babylonjs/core';
import { KinematicsManager, RobotKeyframe } from '../../kinematics/KinematicsManager';
import { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import { InverseKinematicsSolver } from '../../kinematics/InverseKinematicsSolver';
import { UnifiedGizmoManager } from '../../kinematics/UnifiedGizmoManager';
import { TransformDebugVisualizer } from '../../kinematics/TransformDebugVisualizer';
import { SceneManager } from '../../scene/SceneManager';
import { babylonToUser, userToBabylon } from '../../core/CoordinateSystem';
import { detectJointGroups, shouldUseJointGroups, JointGroup } from '../../kinematics/JointGroupDetector';
import {
  syncTcpGizmoAfterJointMove,
  syncTcpGizmoAfterLinearMove,
  validateLinearMotionTarget,
  isSixAxisRobot,
  getSixAxisJointConfiguration
} from '../../kinematics/utils/SixAxisRobotTargetHandler';
import { SixAxisTarget, MotionType } from '../../kinematics/utils/SixAxisTargetStorage';
import './RobotJoggingPanel.css';

type JogMode = 'joint' | 'tcp' | 'poses' | 'targets';
type JogAxis = 'X' | 'Y' | 'Z' | 'RX' | 'RY' | 'RZ';
type IKDebugMode = 'off' | 'summary' | 'verbose';

interface RobotJoggingPanelProps {
  joints: any[]; // Filtered joints for this specific robot
  fkSolver: ForwardKinematicsSolver;
  robotId: string; // Robot collection ID for filtering
  allowedModes?: JogMode[];
  hideModeSelector?: boolean;
}

export const RobotJoggingPanelWithGizmo: React.FC<RobotJoggingPanelProps> = ({
  joints: propsJoints,
  fkSolver,
  robotId,
  allowedModes: allowedModesProp,
  hideModeSelector = false,
}) => {
  const allowedModes: JogMode[] = (allowedModesProp && allowedModesProp.length > 0
    ? allowedModesProp
    : ['joint', 'tcp', 'poses', 'targets']);
  const [jogMode, setJogMode] = useState<JogMode>(allowedModes[0]);
  const [jogStepJoint, setJogStepJoint] = useState(5); // degrees
  const [jogStepTcpLinear, setJogStepTcpLinear] = useState(10); // mm for linear
  const [jogStepTcpRotary, setJogStepTcpRotary] = useState(5); // degrees for rotary
  const [joints, setJoints] = useState<any[]>([]);
  const [tcpPosition, setTcpPosition] = useState<string>('—');
  const [ikSolver] = useState(() => InverseKinematicsSolver.getInstance());
  const [keyframes, setKeyframes] = useState<RobotKeyframe[]>([]);
  const [newPoseName, setNewPoseName] = useState<string>('');
  // Toggles for target click actions
  const [moveOnSelectEnabled, setMoveOnSelectEnabled] = useState<boolean>(true);
  const [jumpOnSelectEnabled, setJumpOnSelectEnabled] = useState<boolean>(false);
  const [showPath, setShowPath] = useState<boolean>(true);

  // Targets (teaching points with motion type)
  const [targets, setTargets] = useState<SixAxisTarget[]>([]);
  const [newTargetMotionType, setNewTargetMotionType] = useState<MotionType>('JOINT');
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false); // Use ref for immediate stop detection in async loop
  const [showTargetDetails, setShowTargetDetails] = useState(false); // Toggle to show/hide Cartesian values
  const [jointGroups, setJointGroups] = useState<JointGroup[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [useGroups, setUseGroups] = useState<boolean>(false);
  const [debugMode] = useState<IKDebugMode>(() => (localStorage.getItem('ikDebugMode') as IKDebugMode) || 'none');
  const setJogModeSafe = (mode: JogMode) => {
    if (!allowedModes.includes(mode)) return;
    setJogMode(mode);
  };

  const renderTargetFrame = (target: SixAxisTarget) => {
    if (hiddenFrames[target.id]) return;
    if (!target.cartesian) return;
    const scene = (window as any).sceneManager?.getScene?.();
    if (!scene) return;

    if (!targetFrameMatRef.current) {
      const mat = new BABYLON.StandardMaterial('targetFrameMat', scene);
      const frameColor = new BABYLON.Color3(0.82, 0.32, 0.04); // deeper burnt orange for contrast
      mat.diffuseColor = frameColor;
      mat.emissiveColor = frameColor;
      mat.specularColor = new BABYLON.Color3(0, 0, 0);
      mat.backFaceCulling = false;
      targetFrameMatRef.current = mat;
    }

    const existing = targetFramesRef.current.get(target.id);
    if (existing) {
      existing.nodes.forEach(n => n.dispose(false, true));
      targetFramesRef.current.delete(target.id);
    }

    const pos = new BABYLON.Vector3(
      (target.cartesian.position?.[0] ?? 0) * 0.001,
      (target.cartesian.position?.[1] ?? 0) * 0.001,
      (target.cartesian.position?.[2] ?? 0) * 0.001
    );
    const quat = new BABYLON.Quaternion(
      target.cartesian.quaternion?.[0] ?? 0,
      target.cartesian.quaternion?.[1] ?? 0,
      target.cartesian.quaternion?.[2] ?? 0,
      target.cartesian.quaternion?.[3] ?? 1
    );
    const rotM = new BABYLON.Matrix();
    quat.toRotationMatrix(rotM);
    const xDir = new BABYLON.Vector3(rotM.m[0], rotM.m[1], rotM.m[2]);
    const yDir = new BABYLON.Vector3(rotM.m[4], rotM.m[5], rotM.m[6]);
    const zDir = new BABYLON.Vector3(rotM.m[8], rotM.m[9], rotM.m[10]);
    const axisLen = 0.12;

    const rotationFromTo = (from: BABYLON.Vector3, to: BABYLON.Vector3) => {
      const f = from.normalize();
      const t = to.normalize();
      const dot = BABYLON.Vector3.Dot(f, t);
      if (dot > 0.9999) return BABYLON.Quaternion.Identity();
      if (dot < -0.9999) {
        const orth = Math.abs(f.x) < 0.1 ? new BABYLON.Vector3(1, 0, 0) : new BABYLON.Vector3(0, 1, 0);
        const axis = BABYLON.Vector3.Cross(f, orth).normalize();
        return BABYLON.Quaternion.RotationAxis(axis, Math.PI);
      }
      const axis = BABYLON.Vector3.Cross(f, t).normalize();
      const angle = Math.acos(dot);
      return BABYLON.Quaternion.RotationAxis(axis, angle);
    };

      const createArrow = (key: 'x' | 'y' | 'z', dir: BABYLON.Vector3) => {
        const parent = new BABYLON.TransformNode(`target_frame_${key}_${target.id}`, scene);
        parent.position = pos.clone();
        parent.rotationQuaternion = rotationFromTo(BABYLON.Axis.Y, dir.normalize());

      const shaftLen = axisLen * 0.75;
      const headLen = axisLen * 0.25;
      const shaft = BABYLON.MeshBuilder.CreateCylinder(
        `target_frame_${key}_shaft_${target.id}`,
        { height: shaftLen, diameter: 0.006, tessellation: 8 },
        scene
      );
      shaft.position = new BABYLON.Vector3(0, shaftLen / 2, 0);
      shaft.material = targetFrameMatRef.current!;
      shaft.isPickable = false;
      shaft.parent = parent;

      const head = BABYLON.MeshBuilder.CreateCylinder(
        `target_frame_${key}_head_${target.id}`,
        { height: headLen, diameterTop: 0, diameterBottom: 0.012, tessellation: 8 },
        scene
      );
      head.position = new BABYLON.Vector3(0, shaftLen + headLen / 2, 0);
      head.material = targetFrameMatRef.current!;
      head.isPickable = false;
      head.parent = parent;

      return parent;
    };

    const nodes = [createArrow('x', xDir), createArrow('y', yDir), createArrow('z', zDir)];
    targetFramesRef.current.set(target.id, { nodes });
  };
  
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
  // Target frame visualization
  type TargetFrameSet = { nodes: BABYLON.TransformNode[] };
  const targetFramesRef = useRef<Map<string, TargetFrameSet>>(new Map());
  const targetFrameMatRef = useRef<BABYLON.StandardMaterial | null>(null);
  const [hiddenFrames, setHiddenFrames] = useState<Record<string, boolean>>({});
  const pathLineRef = useRef<BABYLON.LinesMesh | null>(null);

  // Cleanup debug/visual lines on unmount
  useEffect(() => {
    return () => {
      [ikAxisXRef, ikAxisYRef, ikAxisZRef, ikDeltaRef, ikErrorRef].forEach(ref => {
        if (ref.current) {
          ref.current.dispose(false, true);
          ref.current = null;
        }
      });
      targetFramesRef.current.forEach((frame) => {
        frame.nodes.forEach(node => node.dispose(false, true));
      });
      targetFramesRef.current.clear();
      if (targetFrameMatRef.current) {
        targetFrameMatRef.current.dispose(false, true);
        targetFrameMatRef.current = null;
      }
      if (pathLineRef.current) {
        pathLineRef.current.dispose(false, true);
        pathLineRef.current = null;
      }
    };
  }, []);

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

          // Update gizmo position and rotation in BOTH TCP and Joint modes
          // (TCP gizmo should always track the robot's TCP position)
          if (tcpPose.position) {
            if (jogMode === 'tcp') {
              setCurrentTcpPosition(tcpPose.position.clone());
              setCurrentChainName(robotChain.name);
            }

            // Update existing gizmo position and rotation in both modes
            const targetId = `tcp_${robotId}`;
            unifiedGizmo.updateTargetPosition(targetId, tcpPose.position);
            unifiedGizmo.updateTargetRotation(targetId, tcpPose.rotation);
          }
        }
      }
    };

    updateTcpPosition();
    // Fast updates for immediate gizmo tracking (50ms = 20 FPS)
    // This ensures minimal delay when joints move (e.g., Home button)
    const interval = setInterval(updateTcpPosition, 50);
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

              // For 6-axis robots, validate target before attempting IK
              if (isSixAxisRobot(robotId, robotChain.name)) {
                const validation = validateLinearMotionTarget(robotChain.name, newPosition, currentPose.position);
                if (!validation.valid) {
                  console.warn(`[RobotJoggingPanel] Target validation failed: ${validation.error}`);
                  // Revert gizmo to current position if validation fails
                  const targetId = `tcp_${robotId}`;
                  unifiedGizmo.updateTargetPosition(targetId, currentPose.position);
                  console.log('═══════════════════════════════════════════════════════════');
                  return;
                }
                if (validation.warnings && validation.warnings.length > 0) {
                  validation.warnings.forEach(warning => {
                    console.warn(`[RobotJoggingPanel] Warning: ${warning}`);
                  });
                }
              }

              // Apply IK to move robot to new TCP position
              console.log('[RobotJoggingPanel] Calling IK with delta:', delta);
              const success = ikSolver.moveTCP(robotChain.name, delta, 'jacobian');

              // Sync TCP gizmo after IK (use enhanced handler for 6-axis robots)
              if (isSixAxisRobot(robotId, robotChain.name)) {
                const syncResult = syncTcpGizmoAfterLinearMove(
                  robotId,
                  robotChain.name,
                  fkSolver,
                  unifiedGizmo,
                  newPosition,
                  success
                );
                
                if (!syncResult.success) {
                  console.warn('[RobotJoggingPanel] Failed to sync TCP gizmo:', syncResult.error);
                } else {
                  console.log('[RobotJoggingPanel] TCP gizmo synced to actual position');
                }
              } else {
                // Fallback for non-6-axis robots
                if (success) {
                  const finalPose = fkSolver.getTCPPose?.(robotChain.name) || fkSolver.getNullTCPPose(robotChain.name);
                  if (finalPose) {
                    const targetId = `tcp_${robotId}`;
                    unifiedGizmo.updateTargetPosition(targetId, finalPose.position);
                    unifiedGizmo.updateTargetRotation(targetId, finalPose.rotation);
                  }
                }
              }

              if (!success) {
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

    // Update TCP gizmo position immediately after joint move
    // Use enhanced 6-axis robot target handler for better synchronization
    const kinematicsManager = KinematicsManager.getInstance();
    const chains = kinematicsManager.getAllChains();
    const robotChain = chains.find(chain =>
      chain.joints.some((joint: any) => joint.id.startsWith(robotId))
    );

    if (robotChain) {
      // For 6-axis robots, use specialized sync function
      if (isSixAxisRobot(robotId, robotChain.name)) {
        const syncResult = syncTcpGizmoAfterJointMove(
          robotId,
          robotChain.name,
          fkSolver,
          unifiedGizmo
        );
        
        if (!syncResult.success) {
          console.warn('[RobotJoggingPanel] Failed to sync TCP gizmo after joint move:', syncResult.error);
        } else {
          logVerbose('[RobotJoggingPanel] TCP gizmo synced after joint move');
        }
      } else {
        // Fallback for non-6-axis robots
        const tcpPose = fkSolver.getTCPPose?.(robotChain.name) || fkSolver.getNullTCPPose(robotChain.name);
        if (tcpPose) {
          const targetId = `tcp_${robotId}`;
          unifiedGizmo.updateTargetPosition(targetId, tcpPose.position);
          unifiedGizmo.updateTargetRotation(targetId, tcpPose.rotation);
        }
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
      if (scene && (debugMode === 'verbose')) {
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
    
    // For 6-axis robots, validate target before attempting IK
    if (isSixAxisRobot(robotId, chainName)) {
      const validation = validateLinearMotionTarget(chainName, targetPos, currentPosWorld);
      if (!validation.valid) {
        console.warn(`[RobotJoggingPanel] Target validation failed: ${validation.error}`);
        logSummary(`[TCP Jog] ❌ VALIDATION FAILED: ${validation.error}`);
        logSummary(`═══════════════════════════════════════════════════════════`);
        return;
      }
      if (validation.warnings && validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          console.warn(`[RobotJoggingPanel] Warning: ${warning}`);
        });
      }
    }
    
    // Use Jacobian first (faster, more reliable for this robot), fallback to CCD
    success = ikSolver.moveTCP(chainName, positionDelta, 'jacobian');

    if (!success) {
      logSummary('[RobotJoggingPanel] Jacobian failed, trying CCD method...');
      success = ikSolver.moveTCP(chainName, positionDelta, 'ccd');
    }

    // Sync TCP gizmo after linear motion (use enhanced handler for 6-axis robots)
    if (isSixAxisRobot(robotId, chainName)) {
      const syncResult = syncTcpGizmoAfterLinearMove(
        robotId,
        chainName,
        fkSolver,
        unifiedGizmo,
        targetPos,
        success
      );
      
      if (!syncResult.success) {
        console.warn('[RobotJoggingPanel] Failed to sync TCP gizmo after linear move:', syncResult.error);
      }
    } else {
      // Fallback for non-6-axis robots
      const tcpPose = fkSolver.getTCPPose?.(chainName) || fkSolver.getNullTCPPose(chainName);
      if (tcpPose) {
        const targetId = `tcp_${robotId}`;
        unifiedGizmo.updateTargetPosition(targetId, tcpPose.position);
        unifiedGizmo.updateTargetRotation(targetId, tcpPose.rotation);
      }
    }

    if (!success) {
      console.warn(`[RobotJoggingPanel] IK failed for TCP jog: ${axis} ${direction > 0 ? '+' : '-'}`);
      console.warn('[RobotJoggingPanel] Target may be out of reach or robot in singular configuration');
      logSummary(`[TCP Jog] ❌ IK FAILED for ${axis}${direction > 0 ? '+' : '-'}`);
      logSummary(`═══════════════════════════════════════════════════════════`);
    } else {
      logSummary(`[RobotJoggingPanel] ✅ Successfully moved TCP ${axis} ${direction > 0 ? '+' : '-'}`);
      
      // Log actual final position for comparison
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
            if (scene && (debugMode === 'verbose')) {
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

  // Helper: auto-generate point names based on sequence position (P001, P002, ...)
  // Names are regenerated whenever the target list changes to reflect current order
  const generatePointName = (index: number) => {
    return `P${String(index + 1).padStart(3, '0')}`;
  };

  // Target (teaching point) handlers
  const handleTeachTarget = () => {
    if (!robotId) return;

    const kinematicsManager = KinematicsManager.getInstance();
    const fkSolver = ForwardKinematicsSolver.getInstance();
    const chains = kinematicsManager.getAllChains();
    const robotChain = chains.find(chain =>
      chain.joints.some((joint: any) => joint.id.startsWith(robotId))
    );

    if (!robotChain) return;

    // Get current joint positions
    const jointConfig = getSixAxisJointConfiguration(robotChain.name);
    if (!jointConfig) {
      console.warn('Cannot teach target: Not a 6-axis robot or invalid configuration');
      return;
    }

    // Get TCP pose
    const tcpPose = fkSolver.getTCPPose?.(robotChain.name) || fkSolver.getNullTCPPose(robotChain.name);
    if (!tcpPose) return;

    // Convert joint angles from radians to degrees
    const jointsDegrees: [number, number, number, number, number, number] = [
      jointConfig.jointAngles[0] * 180 / Math.PI,
      jointConfig.jointAngles[1] * 180 / Math.PI,
      jointConfig.jointAngles[2] * 180 / Math.PI,
      jointConfig.jointAngles[3] * 180 / Math.PI,
      jointConfig.jointAngles[4] * 180 / Math.PI,
      jointConfig.jointAngles[5] * 180 / Math.PI,
    ];

    // Create target with auto-generated name based on position in sequence
    const euler = tcpPose.rotation.toEulerAngles();
    const target: SixAxisTarget = {
      id: `target_${Date.now()}`,
      name: generatePointName(targets.length), // Auto-generate based on sequence position
      joints: jointsDegrees,
      configuration: {
        elbow: 'up',  // TODO: Detect from current configuration
        wrist: 'non-flip',
        front: 'front',
        turns: [0, 0, 0, 0, 0, 0],
      },
      frame: {
        type: 'WORLD',
      },
      motionType: newTargetMotionType,
      cartesian: {
        position: [
          tcpPose.position.x * 1000,  // m → mm
          tcpPose.position.y * 1000,
          tcpPose.position.z * 1000,
        ],
        orientation: [
          euler.x * 180 / Math.PI,  // rad → deg
          euler.y * 180 / Math.PI,
          euler.z * 180 / Math.PI,
        ],
        quaternion: [
          tcpPose.rotation.x,
          tcpPose.rotation.y,
          tcpPose.rotation.z,
          tcpPose.rotation.w,
        ],
      },
    };

    setTargets(prev => [...prev, target]);
    console.log(`✅ Target ${target.name} taught (${newTargetMotionType} motion)`);
  };

  const handleDeleteTarget = (targetId: string) => {
    setTargets(prev => prev.filter(t => t.id !== targetId));
    console.log(`✅ Target deleted`);
  };

  const handleMoveToTarget = async (target: SixAxisTarget) => {
    const km = KinematicsManager.getInstance();
    const chains = km.getAllChains();
    const chain = chains.find(c => c.joints.some((j: any) => j.id.startsWith(robotId)));
    if (!chain) {
      console.warn('[JumpToTarget] No kinematic chain found for robotId:', robotId);
      return;
    }

    const actuated = km.getActuatedJoints(chain.id).slice(0, 6);
    if (actuated.length === 0) return;

    // Draw oriented frame for the selected target (if cartesian is present)
    try {
      renderTargetFrame(target);
    } catch (err) {
      console.warn('[TargetFrame] Failed to render target frame', err);
    }
    // If neither move nor jump is enabled, only visualize frame
    if (!moveOnSelectEnabled && !jumpOnSelectEnabled) return;

    // If jump toggle is on (and move is off), apply immediate jump
    if (jumpOnSelectEnabled && !moveOnSelectEnabled) {
      actuated.forEach((joint, idx) => {
        const deg = target.joints[idx] ?? 0;
        const rad = (deg * Math.PI) / 180;
        fkSolver.updateJointPosition(joint.id, rad);
      });
    } else {
      // Animated move-to-target (single-target playback)
      const targetRad: number[] = target.joints.map(j => (j * Math.PI) / 180);
      const currentRad: number[] = actuated.map(j => j.position);

      const steps = 30;
      const stepDelay = 30;

      if (target.motionType === 'JOINT') {
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          for (let j = 0; j < actuated.length - 1; j++) {
            const jointId = actuated[j].id;
            const value = currentRad[j] + (targetRad[j] - currentRad[j]) * t;
            fkSolver.updateJointPosition(jointId, value, false);
          }
          const lastJoint = actuated[actuated.length - 1];
          const lastValue = currentRad[actuated.length - 1] + (targetRad[actuated.length - 1] - currentRad[actuated.length - 1]) * t;
          fkSolver.updateJointPosition(lastJoint.id, lastValue, true);
          await new Promise(res => setTimeout(res, stepDelay));
        }
      } else if (target.motionType === 'LINEAR' && target.cartesian) {
        const currentPose = fkSolver.getTCPPose?.(chain.name) || fkSolver.getNullTCPPose(chain.name);
        if (currentPose) {
          const targetPos = new BABYLON.Vector3(
            target.cartesian.position[0] * 0.001,
            target.cartesian.position[1] * 0.001,
            target.cartesian.position[2] * 0.001
          );
          const startPos = currentPose.position.clone();
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const intermediatePos = BABYLON.Vector3.Lerp(startPos, targetPos, t);
            const delta = intermediatePos.subtract(currentPose.position);
            ikSolver.moveTCP(chain.name, delta, 'jacobian');
            const newPose = fkSolver.getTCPPose?.(chain.name) || fkSolver.getNullTCPPose(chain.name);
            if (newPose) currentPose.position.copyFrom(newPose.position);
            await new Promise(res => setTimeout(res, stepDelay));
          }
        } else {
          actuated.forEach((joint, idx) => {
            const deg = target.joints[idx] ?? 0;
            const rad = (deg * Math.PI) / 180;
            fkSolver.updateJointPosition(joint.id, rad);
          });
        }
      } else {
        actuated.forEach((joint, idx) => {
          const deg = target.joints[idx] ?? 0;
          const rad = (deg * Math.PI) / 180;
          fkSolver.updateJointPosition(joint.id, rad);
        });
      }
    }

    // Refresh TCP gizmo to reflect new pose
    const tcpPose = fkSolver.getTCPPose?.(chain.name) || fkSolver.getNullTCPPose(chain.name);
    if (tcpPose) {
      const unifiedGizmo = UnifiedGizmoManager.getInstance();
      const targetId = `tcp_${robotId}`;
      unifiedGizmo.updateTargetPosition(targetId, tcpPose.position);
      unifiedGizmo.updateTargetRotation(targetId, tcpPose.rotation);
    }
  };

  const handleMoveTargetUp = (index: number) => {
    if (index === 0) return;
    setTargets(prev => {
      const newTargets = [...prev];
      [newTargets[index - 1], newTargets[index]] = [newTargets[index], newTargets[index - 1]];
      // Renumber all targets to reflect new order
      return newTargets.map((t, i) => ({ ...t, name: generatePointName(i) }));
    });
  };

  const handleMoveTargetDown = (index: number) => {
    if (index === targets.length - 1) return;
    setTargets(prev => {
      const newTargets = [...prev];
      [newTargets[index], newTargets[index + 1]] = [newTargets[index + 1], newTargets[index]];
      // Renumber all targets to reflect new order
      return newTargets.map((t, i) => ({ ...t, name: generatePointName(i) }));
    });
  };

  // Maintain frame visibility for all targets by default
  useEffect(() => {
    const scene = (window as any).sceneManager?.getScene?.();
    if (!scene) return;

    // Dispose frames for removed targets
    targetFramesRef.current.forEach((frame, id) => {
      if (!targets.find(t => t.id === id)) {
        frame.nodes.forEach(n => n.dispose(false, true));
        targetFramesRef.current.delete(id);
      }
    });

    // Ensure frames are drawn for existing targets when not hidden
    targets.forEach(target => {
      if (hiddenFrames[target.id]) return;
      renderTargetFrame(target);
    });

    // Draw path line through visible targets
    if (pathLineRef.current) {
      pathLineRef.current.dispose(false, true);
      pathLineRef.current = null;
    }

    if (showPath) {
      const scene = (window as any).sceneManager?.getScene?.();
      const points = targets
        .filter(t => t.cartesian && !hiddenFrames[t.id])
        .map(t => new BABYLON.Vector3(
          (t.cartesian!.position?.[0] ?? 0) * 0.001,
          (t.cartesian!.position?.[1] ?? 0) * 0.001,
          (t.cartesian!.position?.[2] ?? 0) * 0.001
        ));

      if (scene && points.length >= 2) {
        const line = BABYLON.MeshBuilder.CreateLines('target_path', { points, updatable: false }, scene) as BABYLON.LinesMesh;
        const pathColor = new BABYLON.Color3(1, 0.88, 0.62); // lighter amber for clear contrast
        line.color = pathColor;
        line.isPickable = false;
        pathLineRef.current = line;
      }
    }
  }, [targets, hiddenFrames, showPath]);

  const handlePlaySequence = async () => {
    if (targets.length === 0) return;
    setIsPlaying(true);
    isPlayingRef.current = true;
    console.log(`▶️ Playing sequence of ${targets.length} targets...`);

    // Resolve the kinematic chain for this robot
    const km = KinematicsManager.getInstance();
    const chains = km.getAllChains();
    const chain = chains.find(c => c.joints.some((j: any) => j.id.startsWith(robotId)));
    if (!chain) {
      console.warn('[PlaySequence] No kinematic chain found for robotId:', robotId);
      setIsPlaying(false);
      return;
    }

    // PERFORMANCE OPTIMIZATION: Disable joint visuals during playback for smooth motion
    // Joint debug frames cause significant overhead during rapid updates
    km.hideAllJointVisuals();

    // Helper: sleep using requestAnimationFrame for smoother animation
    const sleep = (ms: number) => new Promise<void>(res => {
      if (ms <= 16) {
        requestAnimationFrame(() => res());
      } else {
        setTimeout(() => res(), ms);
      }
    });

    // Determine actuated joints (revolute/prismatic) in order; cap at 6 for typical 6-axis
    const actuated = km.getActuatedJoints(chain.id).slice(0, 6);
    if (actuated.length === 0) {
      console.warn('[PlaySequence] Chain has no actuated joints');
      setIsPlaying(false);
      return;
    }

    // PERFORMANCE-OPTIMIZED Playback settings:
    // - Fewer steps (30 instead of 60) reduces IK calculations by 50%
    // - Longer step delay (50ms vs 25ms) gives render engine time to breathe
    // - Total duration stays same (1500ms), but smoother due to less thrashing
    const moveDurationMs = 1500; // per-target move time
    const steps = 30; // OPTIMIZED: fewer steps = less computation, smoother motion
    const stepDelay = Math.max(16, Math.floor(moveDurationMs / steps)); // Min 16ms (60 FPS)

    try {
      for (let i = 0; i < targets.length; i++) {
        if (!isPlayingRef.current) break; // allow stop
        const target = targets[i];
        console.log(`  ${i + 1}. ${target.name} (${target.motionType} motion)`);

        // Target joint angles are in degrees; convert to radians
        const targetRad: number[] = target.joints.map(j => (j * Math.PI) / 180);

        // Read current joint positions (radians)
        const currentRad: number[] = actuated.map(j => j.position);

        if (target.motionType === 'JOINT') {
          // JOINT motion: Linear interpolation in joint space
          // OPTIMIZED: Update all joints in a batch to reduce FK solver overhead
          for (let s = 1; s <= steps; s++) {
            if (!isPlayingRef.current) break;
            const t = s / steps;

            // Update all joints without triggering FK until the last one
            for (let j = 0; j < actuated.length - 1; j++) {
              const jointId = actuated[j].id;
              const value = currentRad[j] + (targetRad[j] - currentRad[j]) * t;
              fkSolver.updateJointPosition(jointId, value, false);
            }

            // Update last joint and trigger FK chain update
            const lastJoint = actuated[actuated.length - 1];
            const lastValue = currentRad[actuated.length - 1] + (targetRad[actuated.length - 1] - currentRad[actuated.length - 1]) * t;
            fkSolver.updateJointPosition(lastJoint.id, lastValue, true);

             
            await sleep(stepDelay);
          }
        } else if (target.motionType === 'LINEAR' && target.cartesian) {
          // LINEAR motion: Straight line in Cartesian space using IK
          // Get current TCP position
          const currentPose = fkSolver.getTCPPose?.(chain.name) || fkSolver.getNullTCPPose(chain.name);
          if (!currentPose) {
            console.warn(`[PlaySequence] Cannot get TCP pose for LINEAR motion, falling back to JOINT`);
            // Fallback to joint interpolation (optimized batch update)
            for (let s = 1; s <= steps; s++) {
              if (!isPlayingRef.current) break;
              const t = s / steps;

              // Update all joints without triggering FK until the last one
              for (let j = 0; j < actuated.length - 1; j++) {
                const jointId = actuated[j].id;
                const value = currentRad[j] + (targetRad[j] - currentRad[j]) * t;
                fkSolver.updateJointPosition(jointId, value, false);
              }

              // Update last joint and trigger FK chain update
              const lastJoint = actuated[actuated.length - 1];
              const lastValue = currentRad[actuated.length - 1] + (targetRad[actuated.length - 1] - currentRad[actuated.length - 1]) * t;
              fkSolver.updateJointPosition(lastJoint.id, lastValue, true);

               
              await sleep(stepDelay);
            }
          } else {
            // Convert target position from mm to meters (Babylon space)
            const targetPos = new BABYLON.Vector3(
              target.cartesian.position[0] * 0.001,
              target.cartesian.position[1] * 0.001,
              target.cartesian.position[2] * 0.001
            );
            const startPos = currentPose.position.clone();

            // Interpolate along straight line in Cartesian space
            for (let s = 1; s <= steps; s++) {
              if (!isPlayingRef.current) break;
              const t = s / steps;
              const intermediatePos = BABYLON.Vector3.Lerp(startPos, targetPos, t);
              const delta = intermediatePos.subtract(currentPose.position);

              // Use IK to move TCP to intermediate position
              const success = ikSolver.moveTCP(chain.name, delta, 'jacobian');
              if (!success) {
                console.warn(`[PlaySequence] IK failed at step ${s}/${steps}, continuing...`);
              }

              // Update current pose for next iteration
              const newPose = fkSolver.getTCPPose?.(chain.name) || fkSolver.getNullTCPPose(chain.name);
              if (newPose) {
                currentPose.position.copyFrom(newPose.position);
              }

               
              await sleep(stepDelay);
            }
          }
        } else {
          // Unknown motion type, fallback to joint interpolation (optimized batch update)
          console.warn(`[PlaySequence] Unknown motion type: ${target.motionType}, using JOINT interpolation`);
          for (let s = 1; s <= steps; s++) {
            if (!isPlayingRef.current) break;
            const t = s / steps;

            // Update all joints without triggering FK until the last one
            for (let j = 0; j < actuated.length - 1; j++) {
              const jointId = actuated[j].id;
              const value = currentRad[j] + (targetRad[j] - currentRad[j]) * t;
              fkSolver.updateJointPosition(jointId, value, false);
            }

            // Update last joint and trigger FK chain update
            const lastJoint = actuated[actuated.length - 1];
            const lastValue = currentRad[actuated.length - 1] + (targetRad[actuated.length - 1] - currentRad[actuated.length - 1]) * t;
            fkSolver.updateJointPosition(lastJoint.id, lastValue, true);

             
            await sleep(stepDelay);
          }
        }

        // Short dwell between targets
         
        await sleep(150);
      }
    } catch (err) {
      console.error('[PlaySequence] Error during playback:', err);
    } finally {
      // CLEANUP: Re-enable joint debug frames after playback
      const sceneManager = (window as any).sceneManager as SceneManager;
      if (sceneManager) {
        const scene = sceneManager.getScene();
        if (scene) {
          // Re-show joint debug frames for this robot's chain
          km.showAllJointDebugFrames(chain.id, scene);
        }
      }

      setIsPlaying(false);
      isPlayingRef.current = false;
      console.log(`✅ Playback complete`);
    }
  };

  const handleStopSequence = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    console.log(`⏹️ Sequence stopped`);
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
      {!hideModeSelector && allowedModes.length > 1 && (
        <div className="jog-mode-selector">
          {allowedModes.includes('joint') && (
            <button
              className={`mode-button ${jogMode === 'joint' ? 'active' : ''}`}
              onClick={() => setJogModeSafe('joint')}
            >
              <Move size={14} />
              <span>Joint</span>
            </button>
          )}
          {allowedModes.includes('tcp') && (
            <button
              className={`mode-button ${jogMode === 'tcp' ? 'active' : ''}`}
              onClick={() => setJogModeSafe('tcp')}
            >
              <RotateCw size={14} />
              <span>TCP</span>
            </button>
          )}
          {allowedModes.includes('targets') && (
            <button
              className={`mode-button ${jogMode === 'targets' ? 'active' : ''}`}
              onClick={() => setJogModeSafe('targets')}
            >
              <Target size={14} />
              <span>Targets</span>
            </button>
          )}
          {allowedModes.includes('poses') && (
            <button
              className={`mode-button ${jogMode === 'poses' ? 'active' : ''}`}
              onClick={() => setJogModeSafe('poses')}
            >
              <Play size={14} />
              <span>Poses</span>
            </button>
          )}
        </div>
      )}

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
          <div className="tcp-controls">
            <div className="tcp-section">
              <h4>Linear</h4>
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
              <div className="tcp-info-header">
                <div className="info-title">📍 Current TCP</div>
                <div className="info-badge">Live</div>
              </div>
              <div className="tcp-pos-grid">
                {[
                  { label: 'X', unit: 'mm' },
                  { label: 'Y', unit: 'mm' },
                  { label: 'Z', unit: 'mm' },
                  { label: 'Rx', unit: '°' },
                  { label: 'Ry', unit: '°' },
                  { label: 'Rz', unit: '°' },
                ].map(({ label, unit }) => {
                  const pattern = new RegExp(`${label}:([-0-9.+]+)`);
                  const match = tcpPosition.match(pattern);
                  const value = match ? match[1] : '—';
                  return (
                    <div key={label} className="tcp-pos-cell">
                      <div className="cell-label">{label}</div>
                      <div className="cell-value">{value === '—' ? '—' : `${value} ${unit}`}</div>
                    </div>
                  );
                })}
              </div>
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
                <Save size={16} />
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
                        <Play size={14} />
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

      {/* Targets Mode (Teaching/Waypoints) */
      }
      {jogMode === 'targets' && (
        <div className="targets-mode">
          <div className="targets-content">
            <div className="targets-header">
              <span className="targets-count">{targets.length} targets</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className={`targets-path-toggle ${showPath ? 'active' : ''}`}
                  onClick={() => setShowPath(!showPath)}
                  title="Show path through targets"
                  aria-pressed={showPath}
                >
                  P
                </button>
                <button
                  className="targets-detail-toggle"
                  onClick={() => setShowTargetDetails(!showTargetDetails)}
                  title={showTargetDetails ? "Hide Cartesian coordinates" : "Show Cartesian coordinates"}
                >
                  <Info size={12} />
                </button>
              </div>
            </div>

            {/* Playback controls */}
            <div className="playback-controls">
              <button
                className="playback-btn"
                onClick={handlePlaySequence}
                disabled={targets.length === 0 || isPlaying}
                title={isPlaying ? 'Playing sequence...' : 'Play sequence'}
              >
                <PlayCircle size={20} />
              </button>
              <button
                className="playback-btn stop-btn"
                onClick={handleStopSequence}
                disabled={!isPlaying}
                title="Stop sequence"
              >
                <StopCircle size={20} />
              </button>
            </div>

            {/* Teach new target - compact, icon-only controls */}
            <div className="target-teach-section" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div className="motion-type-toggle" style={{ display: 'flex', gap: 4 }}>
                <button
                  className={`targets-move-toggle ${moveOnSelectEnabled ? 'active' : ''}`}
                  onClick={() => {
                    setMoveOnSelectEnabled(prev => {
                      const next = !prev;
                      if (next) setJumpOnSelectEnabled(false);
                      return next;
                    });
                  }}
                  title="Move to selected target"
                  aria-pressed={moveOnSelectEnabled}
                >
                  M
                </button>
                <button
                  className={`targets-jump-toggle ${jumpOnSelectEnabled ? 'active' : ''}`}
                  onClick={() => {
                    setJumpOnSelectEnabled(prev => {
                      const next = !prev;
                      if (next) setMoveOnSelectEnabled(false);
                      return next;
                    });
                  }}
                  title="Jump on select"
                  aria-pressed={jumpOnSelectEnabled}
                >
                  J
                </button>
                <button
                  aria-label="Joint move"
                  title="Joint"
                  onClick={() => setNewTargetMotionType('JOINT')}
                  className={`icon-toggle ${newTargetMotionType === 'JOINT' ? 'active' : ''}`}
                  style={{ width: 24, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: newTargetMotionType === 'JOINT' ? '#3182ce' : '#4a5568', border: 'none', borderRadius: 3, color: '#fff' }}
                >
                  <Move size={16} color="#ffffff" stroke="#ffffff" strokeWidth={2} style={{ display: 'block', flexShrink: 0, pointerEvents: 'none' }} />
                </button>
                <button
                  aria-label="Linear move"
                  title="Linear"
                  onClick={() => setNewTargetMotionType('LINEAR')}
                  className={`icon-toggle ${newTargetMotionType === 'LINEAR' ? 'active' : ''}`}
                  style={{ width: 24, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: newTargetMotionType === 'LINEAR' ? '#3182ce' : '#4a5568', border: 'none', borderRadius: 3, color: '#fff' }}
                >
                  <ArrowRight size={16} color="#ffffff" stroke="#ffffff" strokeWidth={2} style={{ display: 'block', flexShrink: 0, pointerEvents: 'none' }} />
                </button>
              </div>
              <button
                className="target-teach-btn"
                onClick={handleTeachTarget}
                title="Teach current position as target"
                style={{ width: 28, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2f855a', border: 'none', borderRadius: 3, color: '#fff' }}
              >
                <Target size={16} color="#ffffff" stroke="#ffffff" strokeWidth={2} style={{ display: 'block', flexShrink: 0, pointerEvents: 'none' }} />
              </button>
            </div>

            {/* Targets list - Ultra compact single-line layout */}
            <div className="targets-list">
              {targets.length > 0 ? (
                targets.map((target, index) => (
                  <div
                    key={target.id}
                    className="target-item"
                    onClick={() => handleMoveToTarget(target)}
                  >
                    <div className="target-number">{index + 1}</div>
                    <div className="target-info">
                      <div className="target-title-row">
                        <span className="target-name">{target.name}</span>
                        <span className="motion-type">{target.motionType}</span>
                      </div>
                      {showTargetDetails && target.cartesian && (
                        <span className="target-position">
                          X:{target.cartesian.position[0].toFixed(0)} Y:{target.cartesian.position[1].toFixed(0)} Z:{target.cartesian.position[2].toFixed(0)}
                        </span>
                      )}
                    </div>
                    <div className="target-actions">
                      <button
                        className={`target-visibility-btn ${hiddenFrames[target.id] ? '' : 'active'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHiddenFrames(prev => {
                            const next = { ...prev, [target.id]: !prev[target.id] };
                            // Dispose frame when hiding
                            if (!prev[target.id]) {
                              const frame = targetFramesRef.current.get(target.id);
                              if (frame) {
                                frame.nodes.forEach(n => n.dispose(false, true));
                              }
                              targetFramesRef.current.delete(target.id);
                            }
                            return next;
                          });
                        }}
                        title={hiddenFrames[target.id] ? 'Show target frame' : 'Hide target frame'}
                      >
                        F
                      </button>
                      <button
                        className="target-move-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveTargetUp(index);
                        }}
                        disabled={index === 0}
                        title="Move up"
                      >
                        <ArrowUp size={8} />
                      </button>
                      <button
                        className="target-move-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveTargetDown(index);
                        }}
                        disabled={index === targets.length - 1}
                        title="Move down"
                      >
                        <ArrowDown size={8} />
                      </button>
                      <button
                        className="target-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTarget(target.id);
                        }}
                        title="Delete target"
                      >
                        <Trash2 size={8} />
                      </button>
                    </div>
                  </div>
                ))
              ) : null}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
