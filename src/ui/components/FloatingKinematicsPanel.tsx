/**
 * FloatingKinematicsPanel - Kinematics Control in Floating Panel
 * Owner: Edwin
 * 
 * Wraps the existing KinematicsPanel content in the new floating panel system
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Settings } from 'lucide-react';
import * as BABYLON from '@babylonjs/core';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { AssetLibraryDarkPanel, AssetLibraryDarkSection, AssetLibraryDarkDisabled } from './FloatingPanel/AssetLibraryDarkPanel';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { useEditorStore } from '../store/editorStore';
import { RobotJoggingPanelWithGizmo } from './RobotJoggingPanelWithGizmo';
import { InverseKinematicsSolver } from '../../kinematics/InverseKinematicsSolver';
import { Eye, EyeOff, TestTube, Download, Bug, Settings as SettingsIcon, ArrowLeft, Home, Edit } from 'lucide-react';
import { TransformDebugVisualizer } from '../../kinematics/TransformDebugVisualizer';
import { IKTestHarness } from '../../kinematics/IKTestHarness';
import './FloatingKinematicsPanel.css';

interface FloatingKinematicsPanelProps {
  onClose?: () => void;
  isVisible?: boolean;
  zIndex?: number;
}

interface RobotInfo {
  nodeId: string;
  name: string;
  jointCount: number;
}

export const FloatingKinematicsPanel: React.FC<FloatingKinematicsPanelProps> = ({
  onClose,
  isVisible = true,
  zIndex = 1001,
}) => {
  const kinematicsManager = KinematicsManager.getInstance();
  const fkSolver = ForwardKinematicsSolver.getInstance();
  const ikSolver = InverseKinematicsSolver.getInstance();
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);

  const [robots, setRobots] = useState<RobotInfo[]>([]);
  const [activeRobotId, setActiveRobotId] = useState<string | null>(null);
  const [isPinned] = useState(false);
  const [joints, setJoints] = useState<any[]>([]);

  // Visualization state from store
  const skeletonEnabled = useEditorStore((s) => s.skeletonEnabled);
  const skeletonStyle = useEditorStore((s) => s.skeletonStyle);
  const skeletonThicknessMm = useEditorStore((s) => s.skeletonThicknessMm);
  const skeletonAnimationSpeed = useEditorStore((s) => s.skeletonAnimationSpeed);
  const skeletonHighlightActiveJoint = useEditorStore((s) => s.skeletonHighlightActiveJoint);
  const showCoordinateOverlay = useEditorStore((s) => s.showCoordinateOverlay);
  const showJointAxesOverlay = useEditorStore((s) => s.showJointAxesOverlay);
  const showLinkLengthLabels = useEditorStore((s) => s.showLinkLengthLabels);
  const showOrientationLabels = useEditorStore((s) => s.showOrientationLabels);

  const setSkeletonEnabled = useEditorStore((s) => s.setSkeletonEnabled);
  const setSkeletonStyle = useEditorStore((s) => s.setSkeletonStyle);
  const setSkeletonThicknessMm = useEditorStore((s) => s.setSkeletonThicknessMm);
  const setSkeletonAnimationSpeed = useEditorStore((s) => s.setSkeletonAnimationSpeed);
  const setSkeletonHighlightActiveJoint = useEditorStore((s) => s.setSkeletonHighlightActiveJoint);
  const setShowCoordinateOverlay = useEditorStore((s) => s.setShowCoordinateOverlay);
  const setShowJointAxesOverlay = useEditorStore((s) => s.setShowJointAxesOverlay);
  const setShowLinkLengthLabels = useEditorStore((s) => s.setShowLinkLengthLabels);
  const setShowOrientationLabels = useEditorStore((s) => s.setShowOrientationLabels);

  // Edit mode feature flag and state
  const editableKinematicsFlag = useEditorStore((s) => s.editableKinematicsFlag);
  const editModeEnabled = useEditorStore((s) => s.editModeEnabled);
  const attachedJointId = useEditorStore((s) => s.attachedJointId);
  const setEditModeEnabled = useEditorStore((s) => s.setEditModeEnabled);
  const attachJoint = useEditorStore((s) => s.attachJoint);
  const commandManager = useEditorStore((s) => s.commandManager);

  // Debug tools state
  const [visualizerEnabled, setVisualizerEnabled] = useState(false);
  const [visualizer] = useState(() => TransformDebugVisualizer.getInstance());
  const [testHarness] = useState(() => IKTestHarness.getInstance());
  const [debugToolsReady, setDebugToolsReady] = useState(false);

  // Visualization settings popover state
  const [showVizSettings, setShowVizSettings] = useState(false);
  const vizSettingsRef = useRef<HTMLDivElement>(null);

  // Initialize debug tools
  useEffect(() => {
    const sceneManager = (window as any).sceneManager;
    const scene = sceneManager?.getScene?.();
    if (scene && activeRobotId) {
      visualizer.initialize(scene, fkSolver, kinematicsManager);
      testHarness.initialize(fkSolver, ikSolver, kinematicsManager);
      setDebugToolsReady(true);
      console.log('[FloatingKinematicsPanel] Debug tools initialized for robot:', activeRobotId);
    } else {
      setDebugToolsReady(false);
      if (!activeRobotId) {
        console.warn('[FloatingKinematicsPanel] Cannot initialize debug tools: No active robot selected');
      }
    }
  }, [fkSolver, ikSolver, kinematicsManager, activeRobotId, visualizer, testHarness]);

  // Update visualizer when enabled
  useEffect(() => {
    if (visualizerEnabled && activeRobotId) {
      visualizer.setEnabled(true, {
        showJointFrames: false,
        showMeshFrames: true,
        showFKFrames: true,
        showDivergence: true,
        frameSize: 0.1,
        showBaseFrame: true,
        showTCPFrame: true,
        divergenceThreshold: 0.001,
      });
    } else {
      visualizer.setEnabled(false, {});
    }
  }, [visualizerEnabled, activeRobotId, visualizer]);

  const handleToggleVisualizer = () => {
    setVisualizerEnabled(!visualizerEnabled);
  };

  const handleRunTestSuite = () => {
    if (!activeRobotId) {
      alert('⚠️ No robot selected!\n\nPlease select a robot from the dropdown above.');
      console.error('[FloatingKinematicsPanel] Cannot run test suite: activeRobotId is null');
      return;
    }
    if (!debugToolsReady) {
      alert('⚠️ Debug tools not initialized!\n\nPlease wait a few seconds and try again.');
      console.error('[FloatingKinematicsPanel] Debug tools not ready');
      return;
    }
    const chains = kinematicsManager.getAllChains();
    const robotChain = chains.find(chain =>
      chain.joints.some((joint: any) => joint.id.startsWith(activeRobotId))
    );
    if (robotChain) {
      console.log('[FloatingKinematicsPanel] Running IK test suite...');
      testHarness.runTestSuite(robotChain.name);
      alert(`✅ Test suite running for ${robotChain.name}\n\nCheck console (F12) for detailed results.`);
    } else {
      alert('❌ Robot chain not found!');
      console.error('[FloatingKinematicsPanel] Cannot find robot chain for:', activeRobotId);
    }
  };

  const handleTestConsistency = () => {
    if (!activeRobotId) {
      alert('⚠️ No robot selected!\n\nPlease select a robot from the dropdown above.');
      console.error('[FloatingKinematicsPanel] Cannot test consistency: activeRobotId is null');
      return;
    }
    if (!debugToolsReady) {
      alert('⚠️ Debug tools not initialized!\n\nPlease wait a few seconds and try again.');
      console.error('[FloatingKinematicsPanel] Debug tools not ready');
      return;
    }
    const chains = kinematicsManager.getAllChains();
    const robotChain = chains.find(chain =>
      chain.joints.some((joint: any) => joint.id.startsWith(activeRobotId))
    );
    if (robotChain) {
      console.log('[FloatingKinematicsPanel] Testing FK/IK consistency...');
      testHarness.testForwardBackwardConsistency(robotChain.name);
      alert(`✅ Consistency test running for ${robotChain.name}\n\nCheck console (F12) for results.`);
    } else {
      alert('❌ Robot chain not found!');
      console.error('[FloatingKinematicsPanel] Cannot find robot chain for:', activeRobotId);
    }
  };

  const handleGetDivergenceReport = () => {
    if (!debugToolsReady) {
      alert('⚠️ Debug tools not initialized!\n\nPlease:\n1. Select a robot\n2. Enable visualizer (Eye button)\n3. Try again');
      console.warn('[FloatingKinematicsPanel] Cannot get divergence report: Debug tools not ready');
      return;
    }
    const report = visualizer.getDivergenceReport();

    // Check if report indicates failure
    if (report.includes('not initialized') || report.includes('No debug data')) {
      alert(`⚠️ ${report}\n\nSteps to fix:\n1. Enable visualizer (Eye button)\n2. Move some joints\n3. Try again`);
      console.warn('[FloatingKinematicsPanel]', report);
      return;
    }

    console.log('═══════════════════════════════════════════════');
    console.log('           DIVERGENCE REPORT');
    console.log('═══════════════════════════════════════════════');
    console.log(report);
    console.log('═══════════════════════════════════════════════');
    alert('✅ Divergence report printed to console\n\nOpen DevTools (F12) → Console tab to view.');
  };

  const handleResetAll = () => {
    if (!activeRobotId) {
      alert('⚠️ No robot selected!\n\nPlease select a robot from the dropdown above.');
      console.error('[FloatingKinematicsPanel] Cannot reset: activeRobotId is null');
      return;
    }
    const robotChain = kinematicsManager.getAllChains().find(chain =>
      chain.joints.some((joint: any) => joint.id.startsWith(activeRobotId))
    );
    if (robotChain) {
      const robotJoints = kinematicsManager.getChainJoints(robotChain.id);
      let resetCount = 0;
      robotJoints.forEach((joint: any) => {
        if (joint.type === 'revolute' || joint.type === 'prismatic' || joint.type === 'continuous') {
          fkSolver.updateJointPosition(joint.id, 0);
          resetCount++;
        }
      });
      console.log(`[FloatingKinematicsPanel] Reset ${resetCount} joints to home position (0°)`);

      // Update TCP gizmo position after resetting all joints
      const tcpPose = fkSolver.getTCPPose?.(robotChain.name) || fkSolver.getNullTCPPose(robotChain.name);
      if (tcpPose) {
        const { UnifiedGizmoManager } = require('../../kinematics/UnifiedGizmoManager');
        const unifiedGizmo = UnifiedGizmoManager.getInstance();
        const targetId = `tcp_${activeRobotId}`;
        unifiedGizmo.updateTargetPosition(targetId, tcpPose.position);
        unifiedGizmo.updateTargetRotation(targetId, tcpPose.rotation);
      }

      // Update debug visualizer if enabled
      visualizer.update();

      alert(`✅ Reset ${resetCount} joints to home position (0°)`);
    } else {
      alert('❌ Robot chain not found!');
      console.error('[FloatingKinematicsPanel] Cannot find robot chain for:', activeRobotId);
    }
  };

  const handleShowJointDebug = () => {
    if (!activeRobotId) {
      alert('⚠️ No robot selected!\n\nPlease select a robot from the dropdown above.');
      console.error('[FloatingKinematicsPanel] Cannot show debug frames: activeRobotId is null');
      return;
    }
    const sceneManager = (window as any).sceneManager;
    const scene = sceneManager?.getScene?.();
    if (!scene) {
      alert('❌ Scene not available!\n\nPlease wait for the scene to load.');
      console.error('[FloatingKinematicsPanel] Scene not available');
      return;
    }
    const chains = kinematicsManager.getAllChains();
    const robotChain = chains.find(chain =>
      chain.joints.some((joint: any) => joint.id.startsWith(activeRobotId))
    );
    if (robotChain) {
      console.log(`[DEBUG] Showing debug frames for chain: ${robotChain.id}, ${robotChain.name}`);
      kinematicsManager.showAllJointDebugFrames(robotChain.id, scene);
      console.log('[DEBUG] Debug frames added! Check console for XYZ/RPY values at each joint.');
      console.log('[DEBUG] You should now see red/green/blue axis lines at each joint.');
      alert(`✅ Debug frames added for ${robotChain.name}\n\nLook for RGB axes at each joint.`);
    } else {
      alert('❌ Robot chain not found!');
      console.error('[FloatingKinematicsPanel] Cannot find robot chain for:', activeRobotId);
    }
  };

  // Discover all robots in the scene
  useEffect(() => {
    const discoverRobots = () => {
      const tree = SceneTreeManager.getInstance();
      const allJoints = kinematicsManager.getAllJoints();

      if (allJoints.length === 0) {
        setRobots([]);
        return;
      }

      // Group joints by their root node (robot)
      const robotMap: { [key: string]: { name: string; joints: any[] } } = {};

      allJoints.forEach((joint: any) => {
        // Find the root parent for this joint by walking all the way to the top
        const parentNode = tree.getNode(joint.parentNodeId);
        if (parentNode) {
          // Walk up to find the highest level collection (the robot itself)
          let rootNode = parentNode;
          let attempts = 0;
          while (rootNode.parentId && attempts < 50) {
            const parent = tree.getNode(rootNode.parentId);
            if (!parent) break;
            // Stop if parent is Assets root
            if (parent.name === 'Assets') break;
            // Keep going up, the last collection we find is the robot
            rootNode = parent;
            attempts++;
          }

          const rootId = rootNode.id;
          if (!robotMap[rootId]) {
            robotMap[rootId] = { name: rootNode.name, joints: [] };
          }
          robotMap[rootId].joints.push(joint);
        }
      });

      // Convert to array of RobotInfo
      const discoveredRobots: RobotInfo[] = Object.entries(robotMap).map(
        ([nodeId, data]) => ({
          nodeId,
          name: data.name,
          // Count only movable joints (revolute, prismatic, continuous)
          jointCount: data.joints.filter((j: any) =>
            j.type === 'revolute' || j.type === 'prismatic' || j.type === 'continuous'
          ).length
        })
      );

      setRobots(discoveredRobots);

      // Auto-ground robots ONCE
      if (discoveredRobots.length > robots.length) {
        discoveredRobots.forEach(robot => {
          const suggested = kinematicsManager.suggestGroundNode(robot.nodeId);
          if (suggested) {
            console.log('[FloatingKinematicsPanel] Auto-grounding robot:', robot.name, 'node:', suggested);
            kinematicsManager.groundNode(suggested);
          }
        });
      }
    };

    discoverRobots();
    const interval = setInterval(discoverRobots, 1000);
    return () => clearInterval(interval);
  }, [robots.length]);

  // Auto-select robot based on scene tree selection (unless pinned)
  useEffect(() => {
    if (isPinned) return; // Don't change if pinned

    if (!selectedNodeId) {
      setActiveRobotId(null);
      return;
    }

    // Check if selected node is under any robot in our list
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(selectedNodeId);
    if (!node) {
      setActiveRobotId(null);
      return;
    }

    // Walk up from selected node to find if it's under any robot collection
    let checkNode = node;
    let foundRobotId: string | null = null;

    while (checkNode && !foundRobotId) {
      // Check if this node IS one of the robot collections
      if (robots.some(r => r.nodeId === checkNode.id)) {
        foundRobotId = checkNode.id;
        break;
      }

      // Move to parent
      if (!checkNode.parentId) break;
      const parent = tree.getNode(checkNode.parentId);
      if (!parent || parent.name === 'Assets') break;
      checkNode = parent;
    }

    // Update active robot if changed
    if (foundRobotId !== activeRobotId) {
      setActiveRobotId(foundRobotId);
    }
  }, [selectedNodeId, robots, isPinned, activeRobotId]);

  // Update joints for active device
  useEffect(() => {
    const updateJoints = () => {
      if (!activeRobotId) {
        setJoints([]);
        return;
      }

      const allJoints = kinematicsManager.getAllJoints();

      // Filter joints that belong to the active device
      // Joint IDs now include robot collection ID prefix: "collection_xxx_joint_yyy"
      const deviceJoints = allJoints.filter(joint => joint.id.startsWith(activeRobotId));

      setJoints(deviceJoints);
    };

    updateJoints();
    const interval = setInterval(updateJoints, 500);
    return () => clearInterval(interval);
  }, [activeRobotId]);

  // Cleanup: Hide all joint gizmos when panel closes
  useEffect(() => {
    if (!isVisible) {
      console.log('[FloatingKinematicsPanel] Panel closed - hiding all joint gizmos');
      kinematicsManager.hideAllJointVisuals();
      // Clear Motion panel gizmos context
      try {
        const { UnifiedGizmoManager } = require('../../kinematics/UnifiedGizmoManager');
        UnifiedGizmoManager.getInstance().setActivePanel('none');
      } catch {}
    }
  }, [isVisible]);

  // Ensure Motion context active when panel is visible
  useEffect(() => {
    if (isVisible) {
      try {
        const { UnifiedGizmoManager } = require('../../kinematics/UnifiedGizmoManager');
        UnifiedGizmoManager.getInstance().setActivePanel('motion');
      } catch {}
    }
  }, [isVisible]);

  // Resolve active chain id/name for current robot
  const activeChain = useMemo(() => {
    if (!activeRobotId) return null as null | { id: string; name: string };
    const chains = kinematicsManager.getAllChains();
    const robotChain = chains.find((chain: any) =>
      chain.joints?.some((j: any) => typeof j.id === 'string' && j.id.startsWith(activeRobotId))
    );
    return robotChain ? { id: (robotChain as any).id, name: (robotChain as any).name } : null;
  }, [activeRobotId]);

  // Note: skeleton config is now handled via the skeleton link renderer

  // Ready-gated skeleton link rendering
  const ready = isVisible && !!activeRobotId && !!activeChain;
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    console.log('[FloatingKinematicsPanel] Skeleton link effect:', { ready, isVisible, hasRobotId: !!activeRobotId, hasChain: !!activeChain, skeletonEnabled });
    
    if (!ready || !skeletonEnabled) {
      // Cleanup when not ready or disabled
      if (ready && activeRobotId) {
        const renderer: any = (window as any).skeletonLinkRenderer;
        if (renderer && typeof renderer.removeSkeleton === 'function') {
          renderer.removeSkeleton(activeRobotId);
        }
      }
      wasVisibleRef.current = isVisible;
      return;
    }

    wasVisibleRef.current = isVisible;
    
    // Function to render skeleton links
    const renderLinks = () => {
      const renderer: any = (window as any).skeletonLinkRenderer;
      if (!renderer) {
        console.warn('[FloatingKinematicsPanel] SkeletonLinkRenderer not found');
        return;
      }

      renderer.updateChain({
        robotId: activeRobotId,
        chainId: activeChain.id,
        enabled: skeletonEnabled,
        style: skeletonStyle,
        thicknessMm: skeletonThicknessMm,
        opacity: 0.9,
        showJointSpheres: true,
      });
    };
    
    // Use microtask to ensure KM has built the chain before rendering
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      renderLinks();
    });

    // Subscribe to FK updates
    const unsubscribe = kinematicsManager.onFkUpdated((changedChainId) => {
      if (changedChainId === activeChain.id && !cancelled) {
        console.log('[FloatingKinematicsPanel] FK updated, re-rendering skeleton links');
        renderLinks();
      }
    });

    // Cleanup on unmount or when robot/chain changes
    return () => {
      cancelled = true;
      unsubscribe();
      if (activeRobotId) {
        const renderer: any = (window as any).skeletonLinkRenderer;
        if (renderer) {
          try {
            renderer.removeSkeleton(activeRobotId);
          } catch (err) {
            console.warn('[FloatingKinematicsPanel] Cleanup error:', err);
          }
        }
      }
    };
  }, [ready, activeRobotId, activeChain, skeletonEnabled, skeletonStyle, skeletonThicknessMm, isVisible, kinematicsManager]);

  // Toggle joint axes overlay using KinematicsManager (this IS the skeleton visualization)
  useEffect(() => {
    if (!isVisible) {
      console.log('[FloatingKinematicsPanel] Panel not visible, hiding joint visuals');
      kinematicsManager.hideAllJointVisuals();
      return;
    }
    
    const sceneManager = (window as any).sceneManager as any;
    const scene = sceneManager?.getScene?.();
    if (!activeChain || !scene) {
      console.log('[FloatingKinematicsPanel] No active chain or scene');
      return;
    }
    
    if (showJointAxesOverlay) {
      console.log('[FloatingKinematicsPanel] Showing joint debug frames for chain:', activeChain.id);
      kinematicsManager.showAllJointDebugFrames(activeChain.id, scene);
    } else {
      console.log('[FloatingKinematicsPanel] Hiding joint debug frames');
      kinematicsManager.hideAllJointVisuals();
    }
  }, [isVisible, showJointAxesOverlay, activeChain, kinematicsManager]);

  // Edit mode: attach rotation gizmo to selected joint and render limit arc
  useEffect(() => {
    if (!editModeEnabled || !attachedJointId) return;
    const sceneManager = (window as any).sceneManager as any;
    const scene: BABYLON.Scene | null = sceneManager?.getScene?.() || null;
    if (!scene) return;

    const joint = kinematicsManager.getJoint(attachedJointId);
    if (!joint) return;

    // Resolve parent Babylon node (copied from KinematicsManager.showJointDebugFrame)
    const tree = SceneTreeManager.getInstance();
    const parentNode = tree.getNode(joint.parentNodeId);
    let parentBabylonNode: BABYLON.TransformNode | null = null;
    if (parentNode?.babylonMeshId) {
      parentBabylonNode = scene.getMeshByUniqueId(parseInt(parentNode.babylonMeshId)) as BABYLON.TransformNode;
    }
    if (!parentBabylonNode && parentNode?.babylonTransformNodeId) {
      parentBabylonNode = scene.transformNodes.find(tn => tn.uniqueId === parseInt(parentNode!.babylonTransformNodeId!)) || null;
    }
    if (!parentBabylonNode && parentNode?.type === 'collection') {
      parentBabylonNode = scene.transformNodes.find(tn => tn.name === parentNode!.name) || null;
    }
    if (!parentBabylonNode) return;

    parentBabylonNode.computeWorldMatrix(true);
    const parentWorldMatrix = parentBabylonNode.getWorldMatrix();

    // Joint origin (user data assumed mm in KinematicsManager; convert to meters for Babylon)
    const originLocal = new BABYLON.Vector3(joint.origin.x, joint.origin.y, joint.origin.z);
    const originWorld = BABYLON.Vector3.TransformCoordinates(originLocal, parentWorldMatrix);

    const localAxis = new BABYLON.Vector3(joint.axis.x, joint.axis.y, joint.axis.z).normalize();
    const worldAxis = BABYLON.Vector3.TransformNormal(localAxis, parentWorldMatrix).normalize();

    // Show limit arc for feedback (single joint)
    try {
      kinematicsManager.hideAllJointVisuals();
      kinematicsManager.showJointDebugFrame(attachedJointId, scene);
    } catch {}

    // Create an isolated transform node at joint origin for rotation handle
    const tn = new BABYLON.TransformNode(`edit_joint_${attachedJointId}`, scene);
    tn.position.copyFrom(originWorld);
    tn.rotationQuaternion = BABYLON.Quaternion.Identity();

    // Create rotation gizmo
    const utility = new BABYLON.UtilityLayerRenderer(scene);
    const rotGizmo = new BABYLON.RotationGizmo(utility);
    rotGizmo.attachedNode = tn;
    rotGizmo.updateGizmoRotationToMatchAttachedMesh = false;
    rotGizmo.scaleRatio = 1.0;

    // Visual emphasis: active joint bold color already standard; keep defaults

    // Live preview + commit
    const startAngleRef = { value: joint.position };

    const angleFromQuaternionAboutAxis = (q: BABYLON.Quaternion, axis: BABYLON.Vector3) => {
      const v = new BABYLON.Vector3(q.x, q.y, q.z);
      const s = BABYLON.Vector3.Dot(v, axis);
      const angle = 2 * Math.atan2(s, q.w);
      return angle;
    };

    const clampToLimits = (val: number) => {
      const lower = joint.limits?.lower ?? -Math.PI;
      const upper = joint.limits?.upper ?? Math.PI;
      return Math.max(lower, Math.min(upper, val));
    };

    const fk = ForwardKinematicsSolver.getInstance();

    // Drag start
    rotGizmo.onDragStartObservable.add(() => {
      const j = kinematicsManager.getJoint(attachedJointId);
      startAngleRef.value = j?.position ?? 0;
    });

    // Dragging (live preview)
    rotGizmo.onDragObservable.add(() => {
      if (!tn.rotationQuaternion) return;
      const delta = angleFromQuaternionAboutAxis(tn.rotationQuaternion, worldAxis);
      const preview = clampToLimits(startAngleRef.value + delta);
      fk.updateJointPosition(attachedJointId, preview);

      // Update TCP gizmo position during drag for live feedback
      if (activeRobotId) {
        const robotChain = kinematicsManager.getAllChains().find(chain =>
          chain.joints.some((j: any) => j.id.startsWith(activeRobotId))
        );
        if (robotChain) {
          const tcpPose = fk.getTCPPose?.(robotChain.name) || fk.getNullTCPPose(robotChain.name);
          if (tcpPose) {
            const { UnifiedGizmoManager } = require('../../kinematics/UnifiedGizmoManager');
            const unifiedGizmo = UnifiedGizmoManager.getInstance();
            const targetId = `tcp_${activeRobotId}`;
            unifiedGizmo.updateTargetPosition(targetId, tcpPose.position);
            unifiedGizmo.updateTargetRotation(targetId, tcpPose.rotation);
          }
        }
      }

      // Update debug visualizer during drag for live feedback
      visualizer.update();
    });

    // Drag end (commit)
    rotGizmo.onDragEndObservable.add(() => {
      const current = kinematicsManager.getJoint(attachedJointId)?.position ?? startAngleRef.value;
      const oldVal = startAngleRef.value;
      if (Math.abs(current - oldVal) > 1e-6) {
        try {
          const { EditJointAngleCommand } = require('../../history/commands/EditJointAngleCommand');
          const cmd = new EditJointAngleCommand(attachedJointId, oldVal, current);
          commandManager.execute(cmd);
        } catch (e) {
          // Fallback: already updated via preview
        }
      }

      // Reset gizmo local rotation for next drag measurement
      tn.rotationQuaternion = BABYLON.Quaternion.Identity();
    });

    // Cleanup on detach/disable
    return () => {
      try { rotGizmo.dispose(); } catch {}
      try { utility.dispose(); } catch {}
      try { tn.dispose(); } catch {}
      // Hide joint visuals when leaving edit state
      try { kinematicsManager.hideAllJointVisuals(); } catch {}
    };
  }, [editModeEnabled, attachedJointId, kinematicsManager, commandManager]);

  const activeDevice = robots.find(r => r.nodeId === activeRobotId);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vizSettingsRef.current && !vizSettingsRef.current.contains(event.target as Node)) {
        setShowVizSettings(false);
      }
    };

    if (showVizSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showVizSettings]);

  const panelContent = (
    <div className="floating-kinematics-content" style={{ position: 'relative' }}>
      {/* Compact Icon-Only Debug Buttons at Top */}
      {activeRobotId && (
        <div style={{
          display: 'flex',
          gap: '2px',
          padding: '4px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
        }}>
          <div style={{ display: 'flex', gap: '2px' }}>
          <button
            onClick={handleResetAll}
            style={{
              padding: '4px',
              width: '24px',
              height: '24px',
              background: '#444',
              border: 'none',
              borderRadius: '3px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Reset All to Home"
          >
            <Home size={14} />
          </button>
          <button
            onClick={handleToggleVisualizer}
            style={{
              padding: '4px',
              width: '24px',
              height: '24px',
              background: visualizerEnabled ? '#00d4aa' : '#333',
              border: 'none',
              borderRadius: '3px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={visualizerEnabled ? 'Disable Debug Visualizer' : 'Enable Debug Visualizer'}
          >
            {visualizerEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            onClick={handleShowJointDebug}
            style={{
              padding: '4px',
              width: '24px',
              height: '24px',
              background: '#444',
              border: 'none',
              borderRadius: '3px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Show Joint Debug Frames"
          >
            <Bug size={14} />
          </button>
          {editableKinematicsFlag && (
            <button
              onClick={() => setEditModeEnabled(!editModeEnabled)}
              style={{
                padding: '4px',
                width: '24px',
                height: '24px',
                background: editModeEnabled ? '#00d4aa' : '#444',
                border: 'none',
                borderRadius: '3px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '2px',
              }}
              title="Enable Edit Mode"
            >
              <Edit size={14} />
            </button>
          )}
          </div>
          
          {/* Visualization Settings Button (Top Right) */}
          <div ref={vizSettingsRef} style={{ position: 'relative' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowVizSettings(!showVizSettings);
              }}
              style={{
                padding: '4px',
                width: '24px',
                height: '24px',
                background: showVizSettings ? '#00d4aa' : '#444',
                border: 'none',
                borderRadius: '3px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Visualization Settings"
            >
              <SettingsIcon size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Visualization Settings - Full Panel Overlay (outside button container) */}
      {showVizSettings && (
        <div style={{
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          background: 'rgba(20, 20, 25, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          padding: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          zIndex: 10001,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                }}>
                  <button
                    onClick={() => setShowVizSettings(false)}
                    style={{
                      padding: '4px',
                      width: '24px',
                      height: '24px',
                      background: '#444',
                      border: 'none',
                      borderRadius: '3px',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Back to Motion Panel"
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: 'rgba(255, 255, 255, 0.9)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Visualization
                  </div>
                </div>
                
                <div className="viz-controls">
                  <div className="viz-row">
                    <label title="Toggle kinematic skeleton overlay (mm units)">Skeleton</label>
                    <input
                      type="checkbox"
                      checked={skeletonEnabled}
                      onChange={(e) => setSkeletonEnabled(e.target.checked)}
                      aria-label="Show skeleton"
                    />
                  </div>

                  <div className="viz-row">
                    <label title="Cylinder, tube, or line rendering">Style</label>
                    <select
                      value={skeletonStyle}
                      onChange={(e) => setSkeletonStyle(e.target.value as any)}
                      aria-label="Skeleton style"
                    >
                      <option value="cylinder">Cylinder</option>
                      <option value="tube">Tube</option>
                      <option value="line">Line</option>
                    </select>
                  </div>

                  <div className="viz-row">
                    <label title="Visual thickness in millimeters">Thickness</label>
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={skeletonThicknessMm}
                      onChange={(e) => setSkeletonThicknessMm(parseInt(e.target.value, 10))}
                      aria-label="Skeleton thickness"
                    />
                    <span className="viz-value">{skeletonThicknessMm} mm</span>
                  </div>

                  <div className="viz-row">
                    <label title="Animation speed for link transitions">Speed</label>
                    <input
                      type="range"
                      min={0.1}
                      max={3}
                      step={0.1}
                      value={skeletonAnimationSpeed}
                      onChange={(e) => setSkeletonAnimationSpeed(parseFloat(e.target.value))}
                      aria-label="Skeleton animation speed"
                    />
                    <span className="viz-value">{skeletonAnimationSpeed.toFixed(1)}×</span>
                  </div>

                  <div className="viz-row">
                    <label title="Highlight currently active joint">Active joint highlight</label>
                    <input
                      type="checkbox"
                      checked={skeletonHighlightActiveJoint}
                      onChange={(e) => setSkeletonHighlightActiveJoint(e.target.checked)}
                      aria-label="Highlight active joint"
                    />
                  </div>

                  <div className="viz-row">
                    <label title="Corner XYZ compass overlay">Coordinate overlay</label>
                    <input
                      type="checkbox"
                      checked={showCoordinateOverlay}
                      onChange={(e) => setShowCoordinateOverlay(e.target.checked)}
                      aria-label="Show coordinate overlay"
                    />
                  </div>

                  <div className="viz-row">
                    <label title="Per-joint axis debug frames">Joint indicators</label>
                    <input
                      type="checkbox"
                      checked={showJointAxesOverlay}
                      onChange={(e) => setShowJointAxesOverlay(e.target.checked)}
                      aria-label="Show joint indicators"
                    />
                  </div>

                  <div className="viz-row">
                    <label title="Display link/skeleton visualization">Link indicators</label>
                    <input
                      type="checkbox"
                      checked={skeletonEnabled}
                      onChange={(e) => setSkeletonEnabled(e.target.checked)}
                      aria-label="Show link indicators"
                    />
                  </div>

                  <div className="viz-row">
                    <label title="Display link lengths in mm">Link length labels</label>
                    <input
                      type="checkbox"
                      checked={showLinkLengthLabels}
                      onChange={(e) => setShowLinkLengthLabels(e.target.checked)}
                      aria-label="Show link length labels"
                    />
                  </div>

                  <div className="viz-row">
                    <label title="Display orientation labels (XYZ/RPY)">Orientation labels</label>
                    <input
                      type="checkbox"
                      checked={showOrientationLabels}
                      onChange={(e) => setShowOrientationLabels(e.target.checked)}
                      aria-label="Show orientation labels"
                    />
                  </div>
                </div>
        </div>
      )}

      {/* Joint Control Section - Now at the top */}
      <AssetLibraryDarkSection title="Joint Control" hint={!activeRobotId ? "Select a device to enable" : undefined}>
        {activeRobotId ? (
          joints.length > 0 ? (
            <RobotJoggingPanelWithGizmo joints={joints} fkSolver={fkSolver} robotId={activeRobotId} />
          ) : (
            <div style={{ padding: '12px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center' }}>
              No joints found for this device. Check console for debugging info.
            </div>
          )
        ) : (
          <AssetLibraryDarkDisabled icon={<Settings size={24} />} message="No device selected" />
        )}
      </AssetLibraryDarkSection>

      {/* Edit Section - Conditional, only show joint selection when edit mode is enabled */}
      {editableKinematicsFlag && editModeEnabled && (
        <AssetLibraryDarkSection title="Edit" hint={!activeRobotId ? 'Select a device to enable' : undefined}>
          <div className="viz-controls">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="viz-row">
                <label title="Attach to a joint to edit">Attached Joint</label>
                <select
                  value={attachedJointId || ''}
                  onChange={(e) => attachJoint(e.target.value || null)}
                  aria-label="Select joint to attach"
                >
                  <option value="">None</option>
                  {joints.filter(j => j.type === 'revolute' || j.type === 'prismatic').map((j) => (
                    <option key={j.id} value={j.id}>{j.name || j.id}</option>
                  ))}
                </select>
              </div>

              <div className="viz-row">
                <label title="Dim non-active skeleton while editing">Dim non-active</label>
                <input type="checkbox" checked={true} readOnly aria-label="Dim non-active skeleton" />
              </div>
            </div>
          </div>
        </AssetLibraryDarkSection>
      )}
    </div>
  );

  return (
    <FloatingPanel
        title="Motion"
        subtitle={activeDevice ? `${activeDevice.name} (${activeDevice.jointCount} joints)` : "Select device from scene tree"}
        onClose={onClose}
      isVisible={isVisible}
      zIndex={zIndex}
      defaultSize={{ width: 250, height: 500 }}
      minWidth={220}
      minHeight={400}
      maxWidth={350}
      maxHeight={700}
      draggable={true}
      resizable={true}
    >
      <AssetLibraryDarkPanel
        title=""
        onClose={undefined}
      >
        {panelContent}
      </AssetLibraryDarkPanel>
    </FloatingPanel>
  );
};
