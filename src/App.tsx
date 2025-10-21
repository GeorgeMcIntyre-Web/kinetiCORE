import './App.css';
import React, { useState } from 'react';
import { KinematicsPanel } from './ui/components/KinematicsPanel';
import { KeyboardShortcuts } from './ui/components/KeyboardShortcuts';
import { QuickAddMenu } from './ui/components/QuickAddMenu';
import { ToastNotifications } from './ui/components/ToastNotifications';
import { MJCFLoadingStatusPopup } from './ui/components/MJCFLoadingStatus';
import { LoadingIndicator } from './ui/components/LoadingIndicator';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { UserLevelProvider, useUserLevel } from './ui/core/UserLevelContext';
import { EssentialModeLayout } from './ui/layouts/EssentialModeLayout';
import { ProfessionalModeLayout } from './ui/layouts/ProfessionalModeLayout';
import { ExpertModeLayout } from './ui/layouts/ExpertModeLayout';
import { AssetLibraryPanelV2 } from './ui/components/AssetLibrary/AssetLibraryPanelV2';
import { ProjectManager } from './project/ProjectManager';

// Main app content that switches layouts based on user level
const AppContent: React.FC = () => {
  const { userLevel } = useUserLevel();
  const [showKinematicsPanel, setShowKinematicsPanel] = useState(false);
  const [projectManagerInitialized, setProjectManagerInitialized] = useState(false);

  // Initialize Project Manager on app startup
  React.useEffect(() => {
    const initializeProjectManager = async () => {
      try {
        const projectManager = ProjectManager.getInstance();
        await projectManager.initialize();
        setProjectManagerInitialized(true);
        console.log('[App] Project Manager initialized successfully');
      } catch (error) {
        console.error('[App] Failed to initialize Project Manager:', error);
        // Continue without project manager
        setProjectManagerInitialized(true);
      }
    };

    initializeProjectManager();
  }, []);

  // Render the appropriate layout based on user level
  const renderLayout = () => {
    switch (userLevel) {
      case 'essential':
        return <EssentialModeLayout />;
      case 'professional':
        return <ProfessionalModeLayout />;
      case 'expert':
        return <ExpertModeLayout />;
      default:
        return <EssentialModeLayout />;
    }
  };

  // Show loading screen while Project Manager initializes
  if (!projectManagerInitialized) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Initializing kinetiCORE</h2>
          <p className="text-gray-600">Setting up project management system...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ErrorBoundary fallbackMessage="The layout encountered an error">
        {renderLayout()}
      </ErrorBoundary>

      {/* Global UI Components - Always active */}
      <ErrorBoundary fallbackMessage="Keyboard shortcuts failed">
        <KeyboardShortcuts />
      </ErrorBoundary>

      <ErrorBoundary fallbackMessage="Quick add menu failed">
        <QuickAddMenu />
      </ErrorBoundary>

      <ToastNotifications />
      <MJCFLoadingStatusPopup />
      <LoadingIndicator />

      {/* Kinematics Panel - Overlay */}
      {showKinematicsPanel && (
        <ErrorBoundary fallbackMessage="Kinematics panel failed">
          <KinematicsPanel onClose={() => setShowKinematicsPanel(false)} />
        </ErrorBoundary>
      )}

      {/* Asset Library Panel V2 - Three-Pane Engineering UI */}
      <ErrorBoundary fallbackMessage="Asset library failed">
        <AssetLibraryPanelV2 />
      </ErrorBoundary>

    </>
  );
};

function App() {
  return (
    <UserLevelProvider defaultLevel="essential">
      <AppContent />
    </UserLevelProvider>
  );
}

export default App;
