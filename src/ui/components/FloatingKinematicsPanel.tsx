/**
 * FloatingKinematicsPanel - Kinematics Control in Floating Panel
 * Owner: Edwin
 * 
 * Wraps the existing KinematicsPanel content in the new floating panel system
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Settings } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { AssetLibraryDarkPanel, AssetLibraryDarkSection, AssetLibraryDarkDisabled } from './FloatingPanel/AssetLibraryDarkPanel';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { useEditorStore } from '../store/editorStore';
import { RobotJoggingPanelWithGizmo } from './RobotJoggingPanelWithGizmo';
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

  // Bridge to Skeleton Gizmo (if available globally)
  const applySkeletonConfig = useMemo(() => {
    return (enabled: boolean) => {
      if (!activeRobotId || !activeChain) return;
      const mgr: any = (window as any).skeletonGizmoManager || (window as any).skeletonGizmo;
      if (!mgr) return;

      const payload = {
        robotId: activeRobotId,
        chainId: activeChain.id,
        enabled,
        style: skeletonStyle,
        thicknessMm: skeletonThicknessMm,
        animationSpeed: skeletonAnimationSpeed,
        highlightActiveJoint: skeletonHighlightActiveJoint,
        showLinkLengthLabels,
        showOrientationLabels,
      };

      // Try common method names defensively
      try { if (typeof mgr.updateConfig === 'function') mgr.updateConfig(payload); } catch {}
      try { if (typeof mgr.setEnabled === 'function') mgr.setEnabled(activeRobotId, activeChain.id, enabled); } catch {}
      try { if (typeof mgr.setStyle === 'function') mgr.setStyle(activeRobotId, activeChain.id, skeletonStyle); } catch {}
      try { if (typeof mgr.setThicknessMm === 'function') mgr.setThicknessMm(activeRobotId, activeChain.id, skeletonThicknessMm); } catch {}
      try { if (typeof mgr.setAnimationSpeed === 'function') mgr.setAnimationSpeed(activeRobotId, activeChain.id, skeletonAnimationSpeed); } catch {}
      try { if (typeof mgr.setHighlightActiveJoint === 'function') mgr.setHighlightActiveJoint(activeRobotId, activeChain.id, skeletonHighlightActiveJoint); } catch {}
      try { if (typeof mgr.setLabelsVisibility === 'function') mgr.setLabelsVisibility(activeRobotId, activeChain.id, { linkLength: showLinkLengthLabels, orientation: showOrientationLabels }); } catch {}
      try { if (typeof mgr.refresh === 'function') mgr.refresh(activeRobotId, activeChain.id); } catch {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRobotId, activeChain, skeletonStyle, skeletonThicknessMm, skeletonAnimationSpeed, skeletonHighlightActiveJoint, showLinkLengthLabels, showOrientationLabels]);

  // Apply skeleton config when relevant state changes
  useEffect(() => {
    applySkeletonConfig(skeletonEnabled);
  }, [applySkeletonConfig, skeletonEnabled]);

  // Toggle joint axes overlay using KinematicsManager
  useEffect(() => {
    const sceneManager = (window as any).sceneManager as any;
    const scene = sceneManager?.getScene?.();
    if (!activeChain || !scene) return;
    if (showJointAxesOverlay) {
      kinematicsManager.showAllJointDebugFrames(activeChain.id, scene);
    } else {
      kinematicsManager.hideAllJointVisuals();
    }
  }, [showJointAxesOverlay, activeChain, kinematicsManager]);

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
