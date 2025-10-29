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
import { TransformDebugPanel } from './TransformDebugPanel';
import { InverseKinematicsSolver } from '../../kinematics/InverseKinematicsSolver';
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

  const panelContent = (
    <div className="floating-kinematics-content">
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

      {/* Transform Debug Section */}
      <AssetLibraryDarkSection title="🔬 Transform Debug & IK Testing" hint={!activeRobotId ? "Select a device to enable" : undefined}>
        {activeRobotId ? (
          <TransformDebugPanel fkSolver={fkSolver} ikSolver={ikSolver} robotId={activeRobotId} />
        ) : (
          <AssetLibraryDarkDisabled icon={<Settings size={24} />} message="No device selected" />
        )}
      </AssetLibraryDarkSection>

      {/* Visualization Section */}
      <AssetLibraryDarkSection title="Visualization" hint={!activeRobotId ? 'Select a device to enable' : undefined}>
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
            <label title="Per-joint axis debug frames">Joint axes overlay</label>
            <input
              type="checkbox"
              checked={showJointAxesOverlay}
              onChange={(e) => setShowJointAxesOverlay(e.target.checked)}
              aria-label="Show joint axes overlay"
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
      </AssetLibraryDarkSection>

      {/* Edit Section (feature-flagged) */}
      {editableKinematicsFlag && (
        <AssetLibraryDarkSection title="Edit" hint={!activeRobotId ? 'Select a device to enable' : undefined}>
          <div className="viz-controls">
            <div className="viz-row">
              <label title="Enable editing tools for the active chain">Enable Edit Mode</label>
              <input
                type="checkbox"
                checked={editModeEnabled}
                onChange={(e) => setEditModeEnabled(e.target.checked)}
                aria-label="Enable edit mode"
              />
            </div>

            {editModeEnabled && (
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
            )}
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
