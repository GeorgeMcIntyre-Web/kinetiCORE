// Expert Mode Layout - Power User/Enterprise interface
// Owner: George (Architecture)

import React, { useState, useRef, useEffect } from 'react';
import { Layout } from 'lucide-react';
import { useUserLevel } from '../core/UserLevelContext';
import { useEditorStore } from '../store/editorStore';
import { DockableLayoutWrapper } from './DockableLayoutWrapper';
import { ExportDialog } from '../components/ExportDialog';
import { SelectionIndicator } from '../components/SelectionIndicator';
import Header from '../components/Header';
import type { RibbonToolbarProps } from '../components/RibbonToolbar';
import './ExpertModeLayout.css';

export const ExpertModeLayout: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const savePanelLayout = useEditorStore((state) => state.savePanelLayout);
  const loadPanelLayout = useEditorStore((state) => state.loadPanelLayout);

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [savedLayout, setSavedLayout] = useState<any>(null);
  const [activeViewport, setActiveViewport] = useState<'top' | 'front' | 'right' | 'perspective'>('perspective');

  const topViewportRef = useRef<HTMLDivElement | null>(null);
  const frontViewportRef = useRef<HTMLDivElement | null>(null);
  const rightViewportRef = useRef<HTMLDivElement | null>(null);
  const perspectiveViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const layout = loadPanelLayout();
    if (!layout) {
      return;
    }
    setSavedLayout(layout);
  }, [loadPanelLayout]);

  const handleModeChange = (mode: 'essential' | 'professional' | 'expert') => {
    setUserLevel(mode);
  };

  const ribbonProps: RibbonToolbarProps = {
    onProjectManagerClick: () => {},
    onKinematicsClick: () => {},
    onKinematicsAnalysisClick: () => {},
    onActuatorPanelClick: () => {},
    onPhysicsClick: () => {},
    onCollisionClick: () => {},
    onSettingsClick: () => {},
    onSnapSetupClick: () => {},
    onQuickMoveClick: () => {},
    onAssetLibraryClick: () => {},
    onResetViewClick: () => {},
    onZoomFitClick: () => {},
    onZoomToSelectedClick: () => {},
    onWarehouseClick: () => {},
    onPipingClick: () => {},
  };

  const handleSettingsClick = () => {};

  const handleHelpClick = () => {};

  const headerClassName = userLevel === 'expert' ? 'header-expert' : '';

  return (
    <div className="expert-layout bg-slate-900 text-slate-100">
      <SelectionIndicator selectedNodeIds={selectedNodeIds} />

      <Header
        currentMode={userLevel}
        onModeChange={handleModeChange}
        onSettingsClick={handleSettingsClick}
        onHelpClick={handleHelpClick}
        className={headerClassName}
        ribbonProps={ribbonProps}
      />

      <div className="expert-content pt-[var(--app-header-height,3.5rem)]">
        <DockableLayoutWrapper
          config={{
            leftPanels: [
              { id: 'sceneTree-expert', type: 'sceneTree', title: 'Scene' },
            ],
            rightPanels: [
              { id: 'inspector-expert', type: 'inspector', title: 'Properties' },
            ],
            bottomPanels: [
              { id: 'kinematics-expert', type: 'kinematics', title: 'Timeline/Kinematics' },
            ],
            mainContent: (
              <main className="expert-center">
                <div className="quad-viewport">
                  <div
                    className={`viewport-quad ${activeViewport === 'top' ? 'active' : ''}`}
                    onClick={() => setActiveViewport('top')}
                  >
                    <div className="viewport-label">
                      <Layout className="viewport-label-icon" size={14} />
                      <span className="viewport-label-text">Top View</span>
                    </div>
                    <div className="viewport-content" ref={topViewportRef}>
                      <div className="grid-overlay" />
                      <div className="axis-indicator">
                        <span className="axis-x">X</span>
                        <span className="axis-y">Y</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`viewport-quad ${activeViewport === 'front' ? 'active' : ''}`}
                    onClick={() => setActiveViewport('front')}
                  >
                    <div className="viewport-label">
                      <Layout className="viewport-label-icon" size={14} />
                      <span className="viewport-label-text">Front View</span>
                    </div>
                    <div className="viewport-content" ref={frontViewportRef}>
                      <div className="grid-overlay" />
                      <div className="axis-indicator">
                        <span className="axis-x">X</span>
                        <span className="axis-y">Z</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`viewport-quad ${activeViewport === 'right' ? 'active' : ''}`}
                    onClick={() => setActiveViewport('right')}
                  >
                    <div className="viewport-label">
                      <Layout className="viewport-label-icon" size={14} />
                      <span className="viewport-label-text">Right View</span>
                    </div>
                    <div className="viewport-content" ref={rightViewportRef}>
                      <div className="grid-overlay" />
                      <div className="axis-indicator">
                        <span className="axis-y">Y</span>
                        <span className="axis-z">Z</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`viewport-quad ${activeViewport === 'perspective' ? 'active' : ''}`}
                    onClick={() => setActiveViewport('perspective')}
                  >
                    <div className="viewport-label">
                      <Layout className="viewport-label-icon" size={14} />
                      <span className="viewport-label-text">Perspective</span>
                    </div>
                    <div id="viewport-expert" className="viewport-content" ref={perspectiveViewportRef}>
                      <div className="grid-overlay" />
                      <div className="axis-indicator">
                        <span className="axis-x">X</span>
                        <span className="axis-y">Y</span>
                        <span className="axis-z">Z</span>
                      </div>
                    </div>
                  </div>
                </div>
              </main>
            ),
          }}
          onLayoutChange={savePanelLayout}
          savedLayout={savedLayout}
        />
      </div>

      <ExportDialog isOpen={showExportDialog} onClose={() => setShowExportDialog(false)} />
    </div>
  );
};

