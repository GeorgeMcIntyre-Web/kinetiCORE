import './App.css';
import { Toolbar } from './ui/components/Toolbar';
import { SceneCanvas } from './ui/components/SceneCanvas';
import { Inspector } from './ui/components/Inspector';

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>kinetiCORE</h1>
        <p>Web-based 3D Industrial Simulation Platform</p>
      </header>
      <Toolbar />
      <div className="content">
        <main className="viewport">
          <SceneCanvas />
        </main>
        <aside className="sidebar">
          <Inspector />
        </aside>
      </div>
    </div>
  );
}

export default App;
