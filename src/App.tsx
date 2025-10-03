import './App.css';
import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Toolbar } from './ui/components/Toolbar';
import { SceneCanvas } from './ui/components/SceneCanvas';
import { SceneTree } from './ui/components/SceneTree';
import { Inspector } from './ui/components/Inspector';
import { KinematicsPanel } from './ui/components/KinematicsPanel';
import { KeyboardShortcuts } from './ui/components/KeyboardShortcuts';
import { QuickAddMenu } from './ui/components/QuickAddMenu';
import { ToastNotifications } from './ui/components/ToastNotifications';
import { LoadingIndicator } from './ui/components/LoadingIndicator';

function App() {
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [showKinematicsPanel, setShowKinematicsPanel] = useState(false);

  return (
    <div className="app">
      <header className="header">
        <h1>kinetiCORE</h1>
        <p>Web-based 3D Industrial Simulation Platform</p>
      </header>
      <Toolbar onOpenKinematics={() => setShowKinematicsPanel(true)} />
      <div className="content">
        <PanelGroup direction="horizontal">
          {/* Scene Tree Panel - Left */}
          <Panel
            defaultSize={18}
            minSize={12}
            maxSize={30}
            collapsible={true}
            collapsedSize={0}
            onCollapse={() => setLeftPanelCollapsed(true)}
            onExpand={() => setLeftPanelCollapsed(false)}
            className="panel-left"
          >
            <SceneTree />
          </Panel>

          <PanelResizeHandle className="resize-handle resize-handle-vertical">
            <button
              className="panel-collapse-btn"
              onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
              title={
                leftPanelCollapsed ? 'Show Scene Tree' : 'Hide Scene Tree'
              }
            >
              {leftPanelCollapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronLeft size={14} />
              )}
            </button>
          </PanelResizeHandle>

          {/* Viewport Panel - Center */}
          <Panel defaultSize={62} minSize={40}>
            <SceneCanvas />
          </Panel>

          <PanelResizeHandle className="resize-handle resize-handle-vertical">
            <button
              className="panel-collapse-btn"
              onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
              title={
                rightPanelCollapsed ? 'Show Inspector' : 'Hide Inspector'
              }
            >
              {rightPanelCollapsed ? (
                <ChevronLeft size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
          </PanelResizeHandle>

          {/* Inspector Panel - Right */}
          <Panel
            defaultSize={20}
            minSize={15}
            maxSize={35}
            collapsible={true}
            collapsedSize={0}
            onCollapse={() => setRightPanelCollapsed(true)}
            onExpand={() => setRightPanelCollapsed(false)}
            className="panel-right"
          >
            <Inspector />
          </Panel>
        </PanelGroup>
      </div>

      {/* Global UI Components */}
      <KeyboardShortcuts />
      <QuickAddMenu />
      <ToastNotifications />
      <LoadingIndicator />

      {/* Kinematics Panel - Overlay */}
      {showKinematicsPanel && (
        <KinematicsPanel onClose={() => setShowKinematicsPanel(false)} />
      )}
    </div>
  );
}

export default App;
