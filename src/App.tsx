import './App.css';
import { useState } from 'react';
import { KinematicsPanel } from './ui/components/KinematicsPanel';
import { KeyboardShortcuts } from './ui/components/KeyboardShortcuts';
import { QuickAddMenu } from './ui/components/QuickAddMenu';
import { ToastNotifications } from './ui/components/ToastNotifications';
import { LoadingIndicator } from './ui/components/LoadingIndicator';
import { SceneCanvas } from './ui/components/SceneCanvas';
import { UserLevelProvider, useUserLevel } from './ui/core/UserLevelContext';
import { EssentialModeLayout } from './ui/layouts/EssentialModeLayout';
import { ProfessionalModeLayout } from './ui/layouts/ProfessionalModeLayout';
import { ExpertModeLayout } from './ui/layouts/ExpertModeLayout';

// Main app content that switches layouts based on user level
const AppContent: React.FC = () => {
  const { userLevel } = useUserLevel();
  const [showKinematicsPanel, setShowKinematicsPanel] = useState(false);

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

  return (
    <>
      {renderLayout()}

      {/* Global UI Components - Always active */}
      <KeyboardShortcuts />
      <QuickAddMenu />
      <ToastNotifications />
      <LoadingIndicator />

      {/* Kinematics Panel - Overlay */}
      {showKinematicsPanel && (
        <KinematicsPanel onClose={() => setShowKinematicsPanel(false)} />
      )}

      {/* SceneCanvas rendered ONCE at root level - never unmounts during layout switches */}
      <SceneCanvas />
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
