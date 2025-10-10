import './App.css';
import { useState } from 'react';
import { KinematicsPanel } from './ui/components/KinematicsPanel';
import { KeyboardShortcuts } from './ui/components/KeyboardShortcuts';
import { QuickAddMenu } from './ui/components/QuickAddMenu';
import { ToastNotifications } from './ui/components/ToastNotifications';
import { LoadingIndicator } from './ui/components/LoadingIndicator';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { UserLevelProvider, useUserLevel } from './ui/core/UserLevelContext';
import { MainLayout } from './ui/layouts/MainLayout';
import { AssetLibraryPanel } from './ui/components/AssetLibrary/AssetLibraryPanel';
import { useAssetLibrary } from './ui/hooks/useAssetLibrary';
import { useAssetLibraryStore } from './ui/store/assetLibraryStore';

// Main app content using the new BasePanel system
const AppContent: React.FC = () => {
  const { userLevel } = useUserLevel();
  const [showKinematicsPanel, setShowKinematicsPanel] = useState(false);
  const showAssetLibrary = useAssetLibraryStore((state) => state.isVisible);
  const {
    handleAssetSelect,
    handleAssetDragStart,
    handleAssetDragEnd,
  } = useAssetLibrary();

  return (
    <>
      {/* Main Layout with BasePanel System */}
      <ErrorBoundary fallbackMessage="The layout encountered an error">
        <MainLayout />
      </ErrorBoundary>

      {/* Global UI Components - Always active */}
      <ErrorBoundary fallbackMessage="Keyboard shortcuts failed">
        <KeyboardShortcuts />
      </ErrorBoundary>

      <ErrorBoundary fallbackMessage="Quick add menu failed">
        <QuickAddMenu />
      </ErrorBoundary>

      <ToastNotifications />
      <LoadingIndicator />

      {/* Kinematics Panel - Overlay */}
      {showKinematicsPanel && (
        <ErrorBoundary fallbackMessage="Kinematics panel failed">
          <KinematicsPanel onClose={() => setShowKinematicsPanel(false)} />
        </ErrorBoundary>
      )}

      {/* Asset Library Panel - Floating Glassmorphic */}
      {showAssetLibrary && (
        <ErrorBoundary fallbackMessage="Asset library failed">
          <AssetLibraryPanel
            onAssetSelect={handleAssetSelect}
            onAssetDragStart={handleAssetDragStart}
            onAssetDragEnd={handleAssetDragEnd}
          />
        </ErrorBoundary>
      )}
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
