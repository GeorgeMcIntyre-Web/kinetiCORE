/**
 * FloatingKinematicsPanel - Kinematics Control in Floating Panel
 * Owner: Edwin
 * 
 * Wraps the existing KinematicsPanel content in the new floating panel system
 */

import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { AssetLibraryDarkPanel, AssetLibraryDarkSection, AssetLibraryDarkDisabled } from './FloatingPanel/AssetLibraryDarkPanel';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import { SkeletonGizmoManager } from '../../kinematics/SkeletonGizmoManager';
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

  // Cleanup: Hide all joint gizmos and skeleton when panel closes
  useEffect(() => {
    if (!isVisible) {
      console.log('[FloatingKinematicsPanel] Panel closed - hiding all joint gizmos and skeleton');
      kinematicsManager.hideAllJointVisuals();
      // Clean up skeleton for active robot
      if (activeRobotId) {
        const skeletonGizmo = SkeletonGizmoManager.getInstance();
        skeletonGizmo.removeSkeleton(activeRobotId);
      }
    }
  }, [isVisible, activeRobotId]);

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
