import React, { useState } from 'react';
import { CoSimulationManager } from '../../fea/simulation/coSimulationManager';
import { FlexibleUR10eDemo } from '../../demo/FlexibleUR10eDemo';
import { SceneManager } from '../../scene/SceneManager';
import { Play, Square, Activity } from 'lucide-react';

export const FlexibleDynamicsPanel: React.FC = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [reductionOrder, setReductionOrder] = useState(10);
    const [damping, setDamping] = useState(0.01);
    const [exaggeration, setExaggeration] = useState(10);

    const handleToggleSimulation = () => {
        const manager = CoSimulationManager.getInstance();
        if (isRunning) {
            manager.stop();
        } else {
            manager.start();
        }
        setIsRunning(!isRunning);
    };

    const handleLoadDemo = () => {
        const scene = SceneManager.getInstance().getScene();
        if (scene) {
            FlexibleUR10eDemo.setup(scene);
        }
    };

    return (
        <div className="fea-panel">
            <div className="fea-header">
                <h3>Flexible Dynamics</h3>
            </div>

            <div className="fea-section">
                <h4>Simulation Control</h4>
                <div className="fea-controls">
                    <button
                        className={`fea-btn ${isRunning ? 'active' : ''}`}
                        onClick={handleToggleSimulation}
                    >
                        {isRunning ? <Square size={16} /> : <Play size={16} />}
                        <span>{isRunning ? "Stop Simulation" : "Run Co-Simulation"}</span>
                    </button>

                    <button className="fea-btn" onClick={handleLoadDemo}>
                        <Activity size={16} />
                        <span>Load Flexible UR10e Demo</span>
                    </button>
                </div>
            </div>

            <div className="fea-section">
                <h4>Parameters</h4>
                <div className="fea-input-group">
                    <label>Reduction Order (Modes)</label>
                    <input
                        type="range"
                        min="0" max="50"
                        value={reductionOrder}
                        onChange={(e) => setReductionOrder(parseInt(e.target.value))}
                    />
                    <span>{reductionOrder}</span>
                </div>

                <div className="fea-input-group">
                    <label>Damping Ratio</label>
                    <input
                        type="range"
                        min="0" max="0.1" step="0.001"
                        value={damping}
                        onChange={(e) => setDamping(parseFloat(e.target.value))}
                    />
                    <span>{(damping * 100).toFixed(1)}%</span>
                </div>

                <div className="fea-input-group">
                    <label>Exaggeration</label>
                    <input
                        type="range"
                        min="1" max="100"
                        value={exaggeration}
                        onChange={(e) => setExaggeration(parseInt(e.target.value))}
                    />
                    <span>{exaggeration}x</span>
                </div>
            </div>

            <div className="fea-section">
                <h4>Real-time Metrics</h4>
                <div className="fea-metrics">
                    <div className="metric-row">
                        <span>Tip Deflection:</span>
                        <span className="metric-value">0.00 mm</span>
                    </div>
                    <div className="metric-row">
                        <span>Max Stress:</span>
                        <span className="metric-value">0.00 MPa</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
