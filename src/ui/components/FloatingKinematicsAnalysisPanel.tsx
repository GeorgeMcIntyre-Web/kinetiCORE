import React, { useState, useEffect } from 'react';
import { Calculator, RotateCcw, Map, Shield, Settings } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { AssetLibraryDarkPanel } from './FloatingPanel/AssetLibraryDarkPanel';
import { AssetLibraryDarkSection } from './FloatingPanel/AssetLibraryDarkPanel';
import { AssetLibraryDarkButton } from './FloatingPanel/AssetLibraryDarkPanel';
import { AssetLibraryDarkDisabled } from './FloatingPanel/AssetLibraryDarkPanel';
import { useEditorStore } from '../store/editorStore';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import './FloatingKinematicsAnalysisPanel.css';

interface FloatingKinematicsAnalysisPanelProps {
  isVisible: boolean;
  onClose: () => void;
  zIndex?: number;
}

export const FloatingKinematicsAnalysisPanel: React.FC<FloatingKinematicsAnalysisPanelProps> = ({
  isVisible,
  onClose,
  zIndex = 1000
}) => {
  const { selectedNodeIds } = useEditorStore();
  const kinematicsManager = KinematicsManager.getInstance();
  
  const [activeRobotId, setActiveRobotId] = useState<string | null>(null);
  const [robots, setRobots] = useState<any[]>([]);

  // Discover all robots in the scene
  useEffect(() => {
    const chains = kinematicsManager.getAllChains();
    const robotInfos = chains.map((chain: any) => ({
      id: chain.id,
      nodeId: chain.rootNodeId,
      name: chain.name,
      dof: chain.dof
    }));
    setRobots(robotInfos);
  }, [selectedNodeIds]);

  // Find robots from selected nodes
  const selectedRobots = robots.filter(robot => 
    selectedNodeIds.includes(robot.nodeId)
  );

  // Update active robot when selection changes
  useEffect(() => {
    if (selectedRobots.length > 0) {
      setActiveRobotId(selectedRobots[0].id);
    } else {
      setActiveRobotId(null);
    }
  }, [selectedNodeIds, selectedRobots]);

  const activeDevice = robots.find(r => r.id === activeRobotId);

  const handleForwardKinematics = () => {
    if (!activeRobotId) return;
    console.log('Forward Kinematics analysis for robot:', activeRobotId);
    // TODO: Implement forward kinematics analysis
  };

  const handleInverseKinematics = () => {
    if (!activeRobotId) return;
    console.log('Inverse Kinematics analysis for robot:', activeRobotId);
    // TODO: Implement inverse kinematics analysis
  };

  const handleWorkspaceAnalysis = () => {
    if (!activeRobotId) return;
    console.log('Workspace analysis for robot:', activeRobotId);
    // TODO: Implement workspace analysis
  };

  const handleCollisionDetection = () => {
    if (!activeRobotId) return;
    console.log('Collision detection for robot:', activeRobotId);
    // TODO: Implement collision detection
  };

  const panelContent = (
    <div className="floating-kinematics-analysis-content">
      {/* Analysis Tools */}
      <AssetLibraryDarkSection 
        title="Kinematics Analysis" 
        hint={!activeRobotId ? "Select a device to enable analysis tools" : undefined}
      >
        {activeRobotId ? (
          <div className="analysis-tools-grid">
            <AssetLibraryDarkButton 
              icon={<Calculator size={16} />} 
              onClick={handleForwardKinematics}
              title="Calculate end-effector position from joint angles"
            >
              Forward Kinematics
            </AssetLibraryDarkButton>
            <AssetLibraryDarkButton 
              icon={<RotateCcw size={16} />} 
              onClick={handleInverseKinematics}
              title="Calculate joint angles to reach target position"
            >
              Inverse Kinematics
            </AssetLibraryDarkButton>
            <AssetLibraryDarkButton 
              icon={<Map size={16} />} 
              onClick={handleWorkspaceAnalysis}
              title="Analyze robot's reachable workspace"
            >
              Workspace Analysis
            </AssetLibraryDarkButton>
            <AssetLibraryDarkButton 
              icon={<Shield size={16} />} 
              onClick={handleCollisionDetection}
              title="Check for collisions during motion"
            >
              Collision Detection
            </AssetLibraryDarkButton>
          </div>
        ) : (
          <AssetLibraryDarkDisabled icon={<Settings size={24} />} message="No device selected" />
        )}
      </AssetLibraryDarkSection>

      {/* Advanced Analysis Options */}
      {activeRobotId && (
        <AssetLibraryDarkSection title="Analysis Options">
          <div className="analysis-options">
            <div className="option-group">
              <label className="option-label">Precision</label>
              <select className="option-select" defaultValue="medium">
                <option value="low">Low (Fast)</option>
                <option value="medium">Medium</option>
                <option value="high">High (Slow)</option>
              </select>
            </div>
            <div className="option-group">
              <label className="option-label">Coordinate System</label>
              <select className="option-select" defaultValue="world">
                <option value="world">World Frame</option>
                <option value="base">Base Frame</option>
                <option value="tcp">TCP Frame</option>
              </select>
            </div>
          </div>
        </AssetLibraryDarkSection>
      )}

      {/* Analysis Results Placeholder */}
      {activeRobotId && (
        <AssetLibraryDarkSection title="Results">
          <div className="analysis-results">
            <div className="result-placeholder">
              <p>Run an analysis to see results here</p>
            </div>
          </div>
        </AssetLibraryDarkSection>
      )}
    </div>
  );

  return (
    <FloatingPanel
      title="Kinematics Analysis"
      subtitle={activeDevice ? `${activeDevice.name} (${activeDevice.dof} DOF)` : "Select device from scene tree"}
      icon={<Calculator size={20} />}
      onClose={onClose}
      isVisible={isVisible}
      zIndex={zIndex}
      defaultSize={{ width: 400, height: 500 }}
      minWidth={350}
      minHeight={400}
      maxWidth={600}
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
