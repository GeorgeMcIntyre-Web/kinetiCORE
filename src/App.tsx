import './App.css';
import { Toolbar } from './ui/components/Toolbar';
import { SceneCanvas } from './ui/components/SceneCanvas';
import { SceneTree } from './ui/components/SceneTree';
import { Inspector } from './ui/components/Inspector';
import { KeyboardShortcuts } from './ui/components/KeyboardShortcuts';
import { QuickAddMenu } from './ui/components/QuickAddMenu';
import { ToastNotifications } from './ui/components/ToastNotifications';
import { LoadingIndicator } from './ui/components/LoadingIndicator';

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>kinetiCORE</h1>
        <p>Web-based 3D Industrial Simulation Platform</p>
      </header>
      <Toolbar />
      <div className="content">
        <aside className="sidebar-left">
          <SceneTree />
        </aside>
        <main className="viewport">
          <SceneCanvas />
        </main>
        <aside className="sidebar-right">
          <Inspector />
        </aside>
      </div>

      {/* Global UI Components */}
      <KeyboardShortcuts />
      <QuickAddMenu />
      <ToastNotifications />
      <LoadingIndicator />
    </div>
  );
}

export default App;
