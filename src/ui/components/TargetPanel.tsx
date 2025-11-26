import React, { useEffect, useRef, useState } from 'react';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import { ForwardKinematicsSolver } from '../../kinematics/ForwardKinematicsSolver';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { useEditorStore } from '../store/editorStore';
import { RobotJoggingPanelWithGizmo } from './RobotJoggingPanelWithGizmo';
import './TargetPanel.css';

export const TargetPanel: React.FC = () => {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const kinematicsManagerRef = useRef(KinematicsManager.getInstance());
  const fkSolverRef = useRef(ForwardKinematicsSolver.getInstance());

  const [kinActiveRobotId, setKinActiveRobotId] = useState<string | null>(null);
  const [kinJoints, setKinJoints] = useState<any[]>([]);
  const [kinActiveRobotMeta, setKinActiveRobotMeta] = useState<{ name: string; jointCount: number } | null>(null);

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
        <RobotJoggingPanelWithGizmo
          joints={kinJoints}
          fkSolver={fkSolverRef.current}
          robotId={kinActiveRobotId}
          allowedModes={['targets']}
          hideModeSelector
        />
      ) : (
        <div style={{ padding: '12px', color: '#cbd5e0', fontSize: 13 }}>
          Select a robot in the scene to manage targets.
        </div>
      )}
    </div>
  );
};
