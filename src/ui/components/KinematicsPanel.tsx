// src/ui/components/KinematicsPanel.tsx
// Kinematics Panel - Progressive workflow from grounding to motion
// Owner: Edwin

import { useState, useEffect } from 'react';
import { Pin, PinOff } from 'lucide-react';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { useEditorStore } from '../store/editorStore';
import { RobotJoggingPanel } from './RobotJoggingPanel';
import { KeyframePlaybackPanel } from './KeyframePlaybackPanel';
import './KinematicsPanel.css';

interface KinematicsPanelProps {
  onClose?: () => void;
}

interface RobotInfo {
  nodeId: string;
  name: string;
  jointCount: number;
}

export const KinematicsPanel: React.FC<KinematicsPanelProps> = () => {
  const kinematicsManager = KinematicsManager.getInstance();
  const fkSolver = ForwardKinematicsSolver.getInstance();
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);

  const [robots, setRobots] = useState<RobotInfo[]>([]);
  const [activeRobotId, setActiveRobotId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
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
      const robotMap = new Map<string, { name: string; joints: any[] }>();

      allJoints.forEach(joint => {
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
          if (!robotMap.has(rootId)) {
            robotMap.set(rootId, { name: rootNode.name, joints: [] });
          }
          robotMap.get(rootId)!.joints.push(joint);
        }
      });

      // Convert to array of RobotInfo
      const discoveredRobots: RobotInfo[] = Array.from(robotMap.entries()).map(
        ([nodeId, data]) => ({
          nodeId,
          name: data.name,
          // Count only movable joints (revolute, prismatic, continuous)
          jointCount: data.joints.filter(j =>
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
            console.log('[KinematicsPanel] Auto-grounding robot:', robot.name, 'node:', suggested);
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

  const activeDevice = robots.find(r => r.nodeId === activeRobotId);

  return (
    <div className="kinematics-panel">
      {robots.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Active Device Header */}
          {activeDevice ? (
            <>
              <div style={{
                padding: '8px 12px',
                background: isPinned ? '#2c4a5c' : '#2d3748',
                borderBottom: '1px solid #4a5568',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background 0.2s'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#e2e8f0',
                    marginBottom: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {activeDevice.name}
                    {isPinned && (
                      <span style={{
                        fontSize: '10px',
                        color: '#63b3ed',
                        fontWeight: '500',
                        background: 'rgba(66, 153, 225, 0.2)',
                        padding: '2px 6px',
                        borderRadius: '3px'
                      }}>
                        PINNED
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#a0aec0'
                  }}>
                    {activeDevice.jointCount} joints
                  </div>
                </div>
                <button
                  onClick={() => setIsPinned(!isPinned)}
                  title={isPinned ? "Unpin (follow selection)" : "Pin this device"}
                  style={{
                    background: isPinned ? '#4299e1' : 'transparent',
                    border: '1px solid ' + (isPinned ? '#4299e1' : '#4a5568'),
                    borderRadius: '4px',
                    padding: '6px',
                    cursor: 'pointer',
                    color: isPinned ? '#fff' : '#a0aec0',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isPinned) {
                      e.currentTarget.style.borderColor = '#63b3ed';
                      e.currentTarget.style.color = '#63b3ed';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isPinned) {
                      e.currentTarget.style.borderColor = '#4a5568';
                      e.currentTarget.style.color = '#a0aec0';
                    }
                  }}
                >
                  {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
                </button>
              </div>

              {/* Device Controls */}
              <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
                {/* Keyframe Playback Section */}
                {activeRobotId && activeDevice && (
                  <KeyframePlaybackPanel
                    robotId={activeRobotId}
                    robotName={activeDevice.name}
                    joints={joints}
                  />
                )}

                {/* Robot Jogging Section */}
                {activeRobotId && (
                  <div style={{
                    border: '1px solid #4a5568',
                    borderRadius: '8px',
                    padding: '12px',
                    background: '#1a1a1a'
                  }}>
                    <RobotJoggingPanel joints={joints} fkSolver={fkSolver} robotId={activeRobotId} />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* No active device - show list of all devices */
            <div style={{ padding: '12px' }}>
              <div style={{
                fontSize: '12px',
                color: '#a0aec0',
                marginBottom: '12px',
                textAlign: 'center'
              }}>
                Select a kinematic device from the scene tree
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {robots.map(device => (
                  <button
                    key={device.nodeId}
                    onClick={() => {
                      setActiveRobotId(device.nodeId);
                      setIsPinned(true);
                    }}
                    style={{
                      background: '#2d3748',
                      border: '1px solid #4a5568',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      color: '#e2e8f0',
                      textAlign: 'left',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#374151';
                      e.currentTarget.style.borderColor = '#6b7280';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#2d3748';
                      e.currentTarget.style.borderColor = '#4a5568';
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>
                      {device.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#a0aec0' }}>
                      {device.jointCount} joints
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
