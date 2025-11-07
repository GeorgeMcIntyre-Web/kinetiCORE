import './App.css';
import React, { useState } from 'react';
import { KinematicsPanel } from './ui/components/KinematicsPanel';
import { KeyboardShortcuts } from './ui/components/KeyboardShortcuts';
import { QuickAddMenu } from './ui/components/QuickAddMenu';
import { ToastNotifications } from './ui/components/ToastNotifications';
import { MJCFLoadingStatusPopup } from './ui/components/MJCFLoadingStatus';
import { LoadingIndicator } from './ui/components/LoadingIndicator';
import { SplashScreen } from './ui/components/SplashScreen';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { UserLevelProvider, useUserLevel } from './ui/core/UserLevelContext';
import { ThemeProvider } from './ui/core/ThemeContext';
import { EssentialModeLayout } from './ui/layouts/EssentialModeLayout';
import { ProfessionalModeLayout } from './ui/layouts/ProfessionalModeLayout';
import { ExpertModeLayout } from './ui/layouts/ExpertModeLayout';
import { AssetLibraryPanelV2 } from './ui/components/AssetLibrary/AssetLibraryPanelV2';
import { ProjectManager } from './project/ProjectManager';
import { initializeServices } from './core/ServiceRegistry';

// Main app content that switches layouts based on user level
const AppContent: React.FC = () => {
  const { userLevel } = useUserLevel();
  const [showKinematicsPanel, setShowKinematicsPanel] = useState(false);
  const [projectManagerInitialized, setProjectManagerInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | undefined>(undefined);

  // Initialize Project Manager on app startup
  React.useEffect(() => {
    const initializeProjectManager = async () => {
      try {
        // Initialize services first to resolve circular dependencies
        initializeServices();

        const projectManager = ProjectManager.getInstance();
        await projectManager.initialize();

        // Small delay to show splash screen (minimum 800ms for better UX)
        await new Promise(resolve => setTimeout(resolve, 800));

        // Remove static HTML splash screen
        const staticSplash = document.getElementById('initial-splash');
        if (staticSplash) {
          staticSplash.style.transition = 'opacity 0.5s ease-out';
          staticSplash.style.opacity = '0';
          setTimeout(() => staticSplash.remove(), 500);
        }

        setProjectManagerInitialized(true);
        console.log('[App] Project Manager initialized successfully');
      } catch (error) {
        console.error('[App] Failed to initialize Project Manager:', error);
        setInitializationError(error instanceof Error ? error.message : 'Unknown initialization error');
        // Continue without project manager after 2 seconds
        setTimeout(() => setProjectManagerInitialized(true), 2000);
      }
    };

    initializeProjectManager();
  }, []);

  const handleRetry = () => {
    setInitializationError(undefined);
    setProjectManagerInitialized(false);
    window.location.reload();
  };

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

  // Don't render anything while initializing - static HTML splash shows instead
  if (!projectManagerInitialized) {
    // Show error overlay if initialization failed
    if (initializationError) {
      return (
        <SplashScreen
          isVisible={true}
          message="Setting up project management system..."
          error={initializationError}
          onRetry={handleRetry}
        />
      );
    }
    // Otherwise, let static HTML splash screen stay visible
    return null;
  }

  return (
    <>
      <ErrorBoundary fallbackMessage="The layout encountered an error">
        <div className={`layout-container mode-transition ${userLevel}`}>
          {renderLayout()}
        </div>
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
    <ThemeProvider defaultTheme="cyan">
      <UserLevelProvider defaultLevel="professional">
        <AppContent />
      </UserLevelProvider>
    </ThemeProvider>
  );
}

export default App;
