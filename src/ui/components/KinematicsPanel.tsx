// src/ui/components/KinematicsPanel.tsx
// Kinematics Panel - Progressive workflow from grounding to motion
// Owner: Edwin

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { RobotJoggingPanel } from './RobotJoggingPanel';
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

  const [robots, setRobots] = useState<RobotInfo[]>([]);
  const [selectedRobotId, setSelectedRobotId] = useState<string | null>(null);
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
          jointCount: data.joints.length
        })
      );

      // Debug: Log discovered robots only when changed
      if (discoveredRobots.length !== robots.length) {
        console.log('[KinematicsPanel] Discovered robots:', discoveredRobots);
      }

      setRobots(discoveredRobots);

      // Auto-select first robot if nothing selected
      if (!selectedRobotId && discoveredRobots.length > 0) {
        console.log('[KinematicsPanel] Auto-selecting first robot:', discoveredRobots[0].name);
        setSelectedRobotId(discoveredRobots[0].nodeId);
      }

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
    const interval = setInterval(discoverRobots, 1000); // Reduced from 500ms to 1000ms
    return () => clearInterval(interval);
  }, [selectedRobotId, robots.length]); // Added robots.length dependency

  // Update joints for selected robot
  useEffect(() => {
    const updateJoints = () => {
      if (!selectedRobotId) {
        setJoints([]);
        return;
      }

      const allJoints = kinematicsManager.getAllJoints();
      const tree = SceneTreeManager.getInstance();

      // Filter joints that belong to the selected robot
      const robotJoints = allJoints.filter(joint => {
        const parentNode = tree.getNode(joint.parentNodeId);
        if (!parentNode) return false;

        // Check if this joint's parent is under the selected robot
        let node = parentNode;
        while (node) {
          if (node.id === selectedRobotId) return true;
          if (!node.parentId) break;
          const parent = tree.getNode(node.parentId);
          if (!parent) break;
          node = parent;
        }
        return false;
      });

      setJoints(robotJoints);
    };

    updateJoints();
    const interval = setInterval(updateJoints, 500); // Reduced from 200ms to 500ms
    return () => clearInterval(interval);
  }, [selectedRobotId]);

  const selectedRobot = robots.find(r => r.nodeId === selectedRobotId);

  return (
    <div className="kinematics-panel">
      {robots.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Robot Selector */}
          <div style={{
            padding: '8px',
            background: '#2d3748',
            borderBottom: '1px solid #4a5568'
          }}>
            <select
              value={selectedRobotId || ''}
              onChange={(e) => setSelectedRobotId(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: '#1a202c',
                border: '1px solid #4a5568',
                borderRadius: '4px',
                color: '#e2e8f0',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {robots.map(robot => (
                <option key={robot.nodeId} value={robot.nodeId}>
                  {robot.name} ({robot.jointCount} joints)
                </option>
              ))}
            </select>
          </div>

          {/* Robot Controls */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {selectedRobot ? (
              <RobotJoggingPanel joints={joints} fkSolver={fkSolver} />
            ) : (
              <div className="panel-content">
                <div className="info-box">
                  <AlertCircle size={20} />
                  <p>Select a robot from the dropdown</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="panel-content">
          <div className="info-box">
            <AlertCircle size={20} />
            <p>Import a URDF robot to control joints</p>
          </div>
        </div>
      )}
    </div>
  );
};
