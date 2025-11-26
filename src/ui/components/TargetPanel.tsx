import React, { useEffect, useRef, useState } from 'react';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { useEditorStore } from '../store/editorStore';
import './TargetPanel.css';

type TargetTab = 'waypoints' | 'frames' | 'tcp';

export const TargetPanel: React.FC = () => {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const kinematicsManagerRef = useRef(KinematicsManager.getInstance());

  const [kinActiveRobotId, setKinActiveRobotId] = useState<string | null>(null);
  const [kinJoints, setKinJoints] = useState<any[]>([]);
  const [kinActiveRobotMeta, setKinActiveRobotMeta] = useState<{ name: string; jointCount: number } | null>(null);
  const [activeTab, setActiveTab] = useState<TargetTab>('waypoints');

  // Auto-select robot based on selection (same heuristic as Essentials)
  useEffect(() => {
    const resolveRobotFromSelection = () => {
      if (!selectedNodeId) return null;
      const tree = SceneTreeManager.getInstance();
      const chains = kinematicsManagerRef.current.getAllChains?.() || [];
      let node = tree.getNode(selectedNodeId);
      while (node) {
        const isRobotRoot = chains.some((chain: any) =>
          chain.joints?.some((j: any) => typeof j.id === 'string' && j.id.startsWith(node.id))
        );
        if (isRobotRoot) return node.id;
        if (!node.parentId) break;
        const parent = tree.getNode(node.parentId);
        if (!parent || parent.name === 'Assets') break;
        node = parent;
      }
      return null;
    };

    const updateActive = () => {
      const next = resolveRobotFromSelection();
      setKinActiveRobotId((prev) => (prev !== next ? next : prev));
    };

    updateActive();
    const onTree = () => updateActive();
    window.addEventListener('scenetree-update', onTree);
    window.addEventListener('model-import-complete', onTree);
    return () => {
      window.removeEventListener('scenetree-update', onTree);
      window.removeEventListener('model-import-complete', onTree);
    };
  }, [selectedNodeId]);

  // Track joints + metadata
  useEffect(() => {
    const updateJoints = () => {
      if (!kinActiveRobotId) {
        setKinJoints([]);
        setKinActiveRobotMeta(null);
        return;
      }
      const allJoints = kinematicsManagerRef.current.getAllJoints?.() || [];
      const jointsForRobot = allJoints.filter((j: any) => j.id?.startsWith?.(kinActiveRobotId));
      setKinJoints(jointsForRobot);
      const tree = SceneTreeManager.getInstance();
      const node = tree.getNode(kinActiveRobotId);
      const name = node?.name || 'Active Robot';
      setKinActiveRobotMeta({ name, jointCount: jointsForRobot.length });
    };

    updateJoints();
    const id = window.setInterval(updateJoints, 500);
    return () => window.clearInterval(id);
  }, [kinActiveRobotId]);

  return (
    <div className="target-panel">
      {kinActiveRobotId && kinJoints.length > 0 ? (
        <div className="target-tab-widget">
          <div className="target-tab-bar">
            <button
              className={`target-tab ${activeTab === 'waypoints' ? 'active' : ''}`}
              onClick={() => setActiveTab('waypoints')}
            >
              Waypoints
            </button>
            <button
              className={`target-tab ${activeTab === 'frames' ? 'active' : ''}`}
              onClick={() => setActiveTab('frames')}
            >
              Frames
            </button>
            <button
              className={`target-tab ${activeTab === 'tcp' ? 'active' : ''}`}
              onClick={() => setActiveTab('tcp')}
            >
              TCP
            </button>
          </div>

          <div className="target-tab-body">
            {activeTab === 'waypoints' && (
              <div className="target-tab-content">
                <div className="target-tab-heading">Waypoint Targets</div>
                <p className="target-tab-copy">
                  Use saved poses as named targets. Select a pose and apply it as the current target for jog or IK.
                </p>
                <div className="target-chip-row">
                  <span className="target-chip">Home</span>
                  <span className="target-chip">Approach</span>
                  <span className="target-chip">Pick</span>
                  <span className="target-chip">Place</span>
                </div>
                <button className="target-primary-btn">Apply Selected Target</button>
              </div>
            )}

            {activeTab === 'frames' && (
              <div className="target-tab-content">
                <div className="target-tab-heading">Frame Targets</div>
                <p className="target-tab-copy">
                  Lock the TCP to a reference frame. Use this for fixture-relative or part-relative programming.
                </p>
                <div className="target-frame-list">
                  <div className="target-frame-row">
                    <span className="frame-name">World</span>
                    <span className="frame-meta">Global origin</span>
                    <button className="target-secondary-btn">Set</button>
                  </div>
                  <div className="target-frame-row">
                    <span className="frame-name">Workobject A</span>
                    <span className="frame-meta">Part zero</span>
                    <button className="target-secondary-btn">Set</button>
                  </div>
                  <div className="target-frame-row">
                    <span className="frame-name">Tool 1</span>
                    <span className="frame-meta">Gripper TCP</span>
                    <button className="target-secondary-btn">Set</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tcp' && (
              <div className="target-tab-content">
                <div className="target-tab-heading">TCP Targeting</div>
                <p className="target-tab-copy">
                  Align the target directly with the live TCP pose. Capture the current TCP as a target or follow it
                  during motion.
                </p>
                <div className="target-actions">
                  <button className="target-primary-btn">Capture Current TCP</button>
                  <button className="target-secondary-btn">Follow TCP</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px', color: '#cbd5e0', fontSize: 13 }}>
          Select a robot in the scene to manage targets.
        </div>
      )}
    </div>
  );
};
