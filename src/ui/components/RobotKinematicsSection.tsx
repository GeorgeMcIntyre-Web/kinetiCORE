/**
 * RobotKinematicsSection - Inline Kinematics Controls for Pro Mode
 * Mirrors the Motion panel functionality inside the Kinematics workspace tab.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Bug, Edit, Eye, EyeOff, Home, Pin, PinOff, Settings as SettingsIcon, ArrowLeft } from 'lucide-react';
import { AssetLibraryDarkPanel, AssetLibraryDarkSection, AssetLibraryDarkDisabled } from './FloatingPanel/AssetLibraryDarkPanel';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { InverseKinematicsSolver } from '../../kinematics/InverseKinematicsSolver';
import { TransformDebugVisualizer } from '../../kinematics/TransformDebugVisualizer';
import { IKTestHarness } from '../../kinematics/IKTestHarness';
import { RobotJoggingPanelWithGizmo } from './RobotJoggingPanelWithGizmo';
import { useEditorStore } from '../store/editorStore';
import './FloatingKinematicsPanel.css';

interface RobotInfo {
  nodeId: string;
  name: string;
  jointCount: number;
}

interface RobotKinematicsSectionProps {
  isVisible?: boolean;
}

export const RobotKinematicsSection: React.FC<RobotKinematicsSectionProps> = ({ isVisible = true }) => {
  const kinematicsManager = KinematicsManager.getInstance();
  const fkSolver = ForwardKinematicsSolver.getInstance();
  const ikSolver = InverseKinematicsSolver.getInstance();
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);

  const [robots, setRobots] = useState<RobotInfo[]>([]);
  const [activeRobotId, setActiveRobotId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
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
      console.log('[RobotKinematicsSection] Debug tools initialized for robot:', activeRobotId);
    } else {
      setDebugToolsReady(false);
      if (!activeRobotId) {
        console.debug('[RobotKinematicsSection] Cannot initialize debug tools: No active robot selected');
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

  const handleResetAll = () => {
    if (!activeRobotId) {
      alert('⚠️ No robot selected!\n\nPlease select a robot from the dropdown above.');
      console.error('[RobotKinematicsSection] Cannot reset: activeRobotId is null');
      return;
    }
    const robotChain = kinematicsManager.getAllChains().find(chain =>
      chain.joints.some((joint: any) => joint.id.startsWith(activeRobotId))
    );
    if (robotChain) {
      const robotJoints = kinematicsManager.getChainJoints(robotChain.id);
      let resetCount = 0;

      robotJoints.forEach((joint: any) => {
        if (joint.type === 'revolute' || joint.type === 'continuous') {
          fkSolver.updateJointPosition(joint.id, 0);
          resetCount++;
        }
      });

      const tcpPose = fkSolver.getNullTCPPose(robotChain.name);
      if (tcpPose) {
        (async () => {
          const { UnifiedGizmoManager } = await import('../../kinematics/UnifiedGizmoManager');
          const unifiedGizmo = UnifiedGizmoManager.getInstance();
          const targetId = `tcp_${activeRobotId}`;
          unifiedGizmo.updateTargetPosition(targetId, tcpPose.position);
          unifiedGizmo.updateTargetRotation(targetId, tcpPose.rotation);
        })();
      }

      visualizer.update();
      alert(`✅ Reset ${resetCount} joints to home position (0°)`);
    } else {
      alert('❌ Robot chain not found!');
      console.error('[RobotKinematicsSection] Cannot find robot chain for:', activeRobotId);
    }
  };

  const handleToggleVisualizer = () => {
    setVisualizerEnabled(!visualizerEnabled);
  };

  const handleShowJointDebug = () => {
    if (!activeRobotId) {
      alert('⚠️ No robot selected!\n\nPlease select a robot from the dropdown above.');
      console.error('[RobotKinematicsSection] Cannot show debug frames: activeRobotId is null');
      return;
    }
    const sceneManager = (window as any).sceneManager;
    const scene = sceneManager?.getScene?.();
    if (!scene) {
      alert('❌ Scene not available!\n\nPlease wait for the scene to load.');
      console.error('[RobotKinematicsSection] Scene not available');
      return;
    }
    const chains = kinematicsManager.getAllChains();
    const robotChain = chains.find(chain =>
      chain.joints.some((joint: any) => joint.id.startsWith(activeRobotId))
    );
    if (robotChain) {
      console.log(`[RobotKinematicsSection] Showing debug frames for chain: ${robotChain.id}, ${robotChain.name}`);
      kinematicsManager.showAllJointDebugFrames(robotChain.id, scene);
      alert(`✅ Debug frames added for ${robotChain.name}\n\nLook for RGB axes at each joint.`);
    } else {
      alert('❌ Robot chain not found!');
      console.error('[RobotKinematicsSection] Cannot find robot chain for:', activeRobotId);
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
        const parentNode = tree.getNode(joint.parentNodeId);
        if (parentNode) {
          let rootNode = parentNode;
          let attempts = 0;
          while (rootNode.parentId && attempts < 50) {
            const parent = tree.getNode(rootNode.parentId);
            if (!parent) break;
            if (parent.name === 'Assets') break;
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

      const discoveredRobots: RobotInfo[] = Object.entries(robotMap).map(
        ([nodeId, data]) => ({
          nodeId,
          name: data.name,
          jointCount: data.joints.filter((j: any) =>
            j.type === 'revolute' || j.type === 'prismatic' || j.type === 'continuous'
          ).length
        })
      );

      setRobots(discoveredRobots);

      if (discoveredRobots.length > robots.length) {
        discoveredRobots.forEach(robot => {
          const suggested = kinematicsManager.suggestGroundNode(robot.nodeId);
          if (suggested) {
            console.log('[RobotKinematicsSection] Auto-grounding robot:', robot.name, 'node:', suggested);
            kinematicsManager.groundNode(suggested);
          }
        });
      }
    };

    discoverRobots();
    const interval = setInterval(discoverRobots, 1000);
    return () => clearInterval(interval);
  }, [robots.length, kinematicsManager]);

  // Auto-select robot based on scene tree selection (unless pinned)
  useEffect(() => {
    if (isPinned) return;
    if (!selectedNodeId) {
      setActiveRobotId(null);
      return;
    }
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(selectedNodeId);
    if (!node) {
      setActiveRobotId(null);
      return;
    }

    let checkNode = node;
    let foundRobotId: string | null = null;

    while (checkNode && !foundRobotId) {
      if (robots.some(r => r.nodeId === checkNode.id)) {
        foundRobotId = checkNode.id;
        break;
      }

      if (!checkNode.parentId) break;
      const parent = tree.getNode(checkNode.parentId);
      if (!parent || parent.name === 'Assets') break;
      checkNode = parent;
    }

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
      const deviceJoints = allJoints.filter(joint => joint.id.startsWith(activeRobotId));
      setJoints(deviceJoints);
    };

    updateJoints();
    const interval = setInterval(updateJoints, 500);
    return () => clearInterval(interval);
  }, [activeRobotId, kinematicsManager]);

  // Cleanup: Hide all joint gizmos when section is hidden
  useEffect(() => {
    if (!isVisible) {
      kinematicsManager.hideAllJointVisuals();
      (async () => {
        try {
          const { UnifiedGizmoManager } = await import('../../kinematics/UnifiedGizmoManager');
          UnifiedGizmoManager.getInstance().setActivePanel('none');
        } catch {}
      })();
    }
  }, [isVisible, kinematicsManager]);

  // Ensure Motion context active when section is visible
  useEffect(() => {
    if (isVisible) {
      (async () => {
        try {
          const { UnifiedGizmoManager } = await import('../../kinematics/UnifiedGizmoManager');
          UnifiedGizmoManager.getInstance().setActivePanel('motion');
        } catch {}
      })();
    }
  }, [isVisible]);

  const activeChain = useMemo(() => {
    if (!activeRobotId) return null as null | { id: string; name: string };
    const chains = kinematicsManager.getAllChains();
    const robotChain = chains.find((chain: any) =>
      chain.joints?.some((j: any) => typeof j.id === 'string' && j.id.startsWith(activeRobotId))
    );
    return robotChain ? { id: (robotChain as any).id, name: (robotChain as any).name } : null;
  }, [activeRobotId, kinematicsManager]);

  const ready = isVisible && !!activeRobotId && !!activeChain;

  useEffect(() => {
    if (!ready || !skeletonEnabled) {
      if (ready && activeRobotId) {
        const renderer: any = (window as any).skeletonLinkRenderer;
        if (renderer && typeof renderer.removeSkeleton === 'function') {
          renderer.removeSkeleton(activeRobotId);
        }
      }
      return;
    }

    const renderLinks = () => {
      const renderer: any = (window as any).skeletonLinkRenderer;
      if (!renderer) {
        console.warn('[RobotKinematicsSection] SkeletonLinkRenderer not found');
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

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      renderLinks();
    });

    const unsubscribe = kinematicsManager.onFkUpdated((changedChainId) => {
      if (changedChainId === activeChain.id && !cancelled) {
        renderLinks();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (activeRobotId) {
        const renderer: any = (window as any).skeletonLinkRenderer;
        if (renderer) {
          try {
            renderer.removeSkeleton(activeRobotId);
          } catch (err) {
            console.warn('[RobotKinematicsSection] Cleanup error:', err);
          }
        }
      }
    };
  }, [ready, activeRobotId, activeChain, skeletonEnabled, skeletonStyle, skeletonThicknessMm, isVisible, kinematicsManager]);

  useEffect(() => {
    if (!isVisible) {
      kinematicsManager.hideAllJointVisuals();
      return;
    }

    const sceneManager = (window as any).sceneManager as any;
    const scene = sceneManager?.getScene?.();
    if (!activeChain || !scene) {
      return;
    }

    if (showJointAxesOverlay) {
      kinematicsManager.showAllJointDebugFrames(activeChain.id, scene);
    } else {
      kinematicsManager.hideAllJointVisuals();
    }
  }, [isVisible, showJointAxesOverlay, activeChain, kinematicsManager]);

  useEffect(() => {
    if (!editModeEnabled || !attachedJointId) return;
    const sceneManager = (window as any).sceneManager as any;
    const scene: BABYLON.Scene | null = sceneManager?.getScene?.() || null;
    if (!scene) return;

    const joint = kinematicsManager.getJoint(attachedJointId);
    if (!joint) return;

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

    const originLocal = new BABYLON.Vector3(joint.origin.x, joint.origin.y, joint.origin.z);
    const originWorld = BABYLON.Vector3.TransformCoordinates(originLocal, parentWorldMatrix);

    const localAxis = new BABYLON.Vector3(joint.axis.x, joint.axis.y, joint.axis.z).normalize();
    const worldAxis = BABYLON.Vector3.TransformNormal(localAxis, parentWorldMatrix).normalize();

    try {
      kinematicsManager.hideAllJointVisuals();
      kinematicsManager.showJointDebugFrame(attachedJointId, scene);
    } catch {}

    const tn = new BABYLON.TransformNode(`edit_joint_${attachedJointId}`, scene);
    tn.position.copyFrom(originWorld);
    tn.rotationQuaternion = BABYLON.Quaternion.Identity();

    const utility = new BABYLON.UtilityLayerRenderer(scene);
    const rotGizmo = new BABYLON.RotationGizmo(utility);
    rotGizmo.attachedNode = tn;
    rotGizmo.updateGizmoRotationToMatchAttachedMesh = false;
    rotGizmo.scaleRatio = 1.0;

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

    rotGizmo.onDragStartObservable.add(() => {
      const j = kinematicsManager.getJoint(attachedJointId);
      startAngleRef.value = j?.position ?? 0;
    });

    rotGizmo.onDragObservable.add(() => {
      if (!tn.rotationQuaternion) return;
      const delta = angleFromQuaternionAboutAxis(tn.rotationQuaternion, worldAxis);
      const preview = clampToLimits(startAngleRef.value + delta);
      fkSolver.updateJointPosition(attachedJointId, preview);

      if (activeRobotId) {
        const robotChain = kinematicsManager.getAllChains().find(chain =>
          chain.joints.some((j: any) => j.id.startsWith(activeRobotId))
        );
        if (robotChain) {
          const tcpPose = fkSolver.getTCPPose?.(robotChain.name) || fkSolver.getNullTCPPose(robotChain.name);
          if (tcpPose) {
            (async () => {
              const { UnifiedGizmoManager } = await import('../../kinematics/UnifiedGizmoManager');
              const unifiedGizmo = UnifiedGizmoManager.getInstance();
              const targetId = `tcp_${activeRobotId}`;
              unifiedGizmo.updateTargetPosition(targetId, tcpPose.position);
              unifiedGizmo.updateTargetRotation(targetId, tcpPose.rotation);
            })();
          }
        }
      }

      visualizer.update();
    });

    rotGizmo.onDragEndObservable.add(() => {
      const current = kinematicsManager.getJoint(attachedJointId)?.position ?? startAngleRef.value;
      const oldVal = startAngleRef.value;
      if (Math.abs(current - oldVal) > 1e-6) {
        (async () => {
          try {
            const { EditJointAngleCommand } = await import('../../history/commands/EditJointAngleCommand');
            const cmd = new EditJointAngleCommand(attachedJointId, oldVal, current);
            commandManager.execute(cmd);
          } catch (e) {
            // Fallback already updated via preview
          }
        })();
      }

      tn.rotationQuaternion = BABYLON.Quaternion.Identity();
    });

    return () => {
      try { rotGizmo.dispose(); } catch {}
      try { utility.dispose(); } catch {}
      try { tn.dispose(); } catch {}
      try { kinematicsManager.hideAllJointVisuals(); } catch {}
    };
  }, [editModeEnabled, attachedJointId, kinematicsManager, commandManager, activeRobotId, fkSolver, visualizer]);

  // Close settings popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vizSettingsRef.current && !vizSettingsRef.current.contains(event.target as Node)) {
        setShowVizSettings(false);
      }
    };

    if (showVizSettings) {
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showVizSettings]);

  const panelContent = (
    <div className="floating-kinematics-content motion-shell" style={{ position: 'relative' }}>
      <div className="motion-card">
        <div className="motion-header">
          <div className="motion-eyebrow">Robot kimenatics</div>
          <div className="motion-title">
            {activeRobotId ? (robots.find(r => r.nodeId === activeRobotId)?.name || 'Device') : 'Select a device'}
          </div>
          <div className="motion-meta">
            {activeRobotId
              ? `${robots.find(r => r.nodeId === activeRobotId)?.jointCount ?? 0} joints detected`
              : 'Waiting for kinematic device'}
            {isPinned && activeRobotId && (
              <span className="motion-pill">
                <Pin size={12} />
                Pinned
              </span>
            )}
          </div>
        </div>

        <div className="motion-device-row">
          <div className="motion-device-label">Device</div>
          <select
            className="motion-device-select"
            value={activeRobotId || ''}
            onChange={(e) => {
              const value = e.target.value || null;
              setActiveRobotId(value);
              setIsPinned(!!value);
            }}
            disabled={robots.length === 0}
          >
            <option value="">
              {robots.length === 0 ? 'No robots detected' : 'Follow scene selection'}
            </option>
            {robots.map((robot) => (
              <option key={robot.nodeId} value={robot.nodeId}>
                {robot.name} ({robot.jointCount} joints)
              </option>
            ))}
          </select>
          <button
            className={`motion-pin ${isPinned ? 'active' : ''}`}
            onClick={() => setIsPinned(!isPinned)}
            title={isPinned ? 'Unpin (follow selection)' : 'Pin device'}
            disabled={!activeRobotId}
          >
            {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
        </div>

        {!activeRobotId && robots.length > 0 && (
          <div className="motion-device-hint">
            <div className="motion-device-grid">
              {robots.map((device) => (
                <button
                  key={device.nodeId}
                  className="motion-device-chip"
                  onClick={() => {
                    setActiveRobotId(device.nodeId);
                    setIsPinned(true);
                  }}
                >
                  <div className="motion-chip-name">{device.name}</div>
                  <div className="motion-chip-meta">{device.jointCount} joints</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {activeRobotId && (
        <div className="motion-card motion-quickbar">
          <div className="motion-section-title">Quick actions</div>
          <div className="motion-quick-actions">
            <button className="motion-quick-btn" onClick={handleResetAll} title="Reset all to home">
              <Home size={14} />
              <span>Home</span>
            </button>
            <button
              className={`motion-quick-btn ${visualizerEnabled ? 'active' : ''}`}
              onClick={handleToggleVisualizer}
              title={visualizerEnabled ? 'Hide debug visualizer' : 'Show debug visualizer'}
            >
              {visualizerEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>Visualizer</span>
            </button>
            <button className="motion-quick-btn" onClick={handleShowJointDebug} title="Show joint debug frames">
              <Bug size={14} />
              <span>Joint debug</span>
            </button>
            {editableKinematicsFlag && (
              <button
                className={`motion-quick-btn ${editModeEnabled ? 'active' : ''}`}
                onClick={() => setEditModeEnabled(!editModeEnabled)}
                title="Toggle edit mode"
              >
                <Edit size={14} />
                <span>Edit</span>
              </button>
            )}
            <button
              className={`motion-quick-btn ${showVizSettings ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowVizSettings(!showVizSettings);
              }}
              title="Visualization settings"
            >
              <SettingsIcon size={14} />
              <span>Viz</span>
            </button>
          </div>
        </div>
      )}

      {showVizSettings && (
        <div
          ref={vizSettingsRef}
          className="motion-viz-overlay"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="motion-viz-header">
            <button
              className="motion-quick-btn"
              onClick={() => setShowVizSettings(false)}
              title="Back to motion panel"
            >
              <ArrowLeft size={14} />
            </button>
            <div className="motion-viz-title">Visualization</div>
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

      <AssetLibraryDarkSection
        title="Motion Control"
        hint={!activeRobotId ? 'Select a device to enable' : undefined}
      >
        {activeRobotId ? (
          joints.length > 0 ? (
            <RobotJoggingPanelWithGizmo joints={joints} fkSolver={fkSolver} robotId={activeRobotId} />
          ) : (
            <div className="motion-empty">No joints found for this device. Check console for debugging info.</div>
          )
        ) : (
          <AssetLibraryDarkDisabled icon={<SettingsIcon size={24} />} message="No device selected" />
        )}
      </AssetLibraryDarkSection>

      {editableKinematicsFlag && editModeEnabled && (
        <AssetLibraryDarkSection title="Edit" hint={!activeRobotId ? 'Select a device to enable' : undefined}>
          <div className="viz-controls">
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
              <input type="checkbox" checked readOnly aria-label="Dim non-active skeleton" />
            </div>
          </div>
        </AssetLibraryDarkSection>
      )}
    </div>
  );

  return (
    <div className="robot-kinematics-section">
      <AssetLibraryDarkPanel title="">
        {panelContent}
      </AssetLibraryDarkPanel>
    </div>
  );
};

