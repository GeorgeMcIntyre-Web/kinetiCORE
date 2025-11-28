import React, { useState } from 'react';
import { FEASceneManager } from '../fea/feaSceneManager';

export const FEAPanel: React.FC = () => {
    const [status, setStatus] = useState("Ready");
    const [loadMagnitude, setLoadMagnitude] = useState(1000);
    const [exaggeration, setExaggeration] = useState(100);
    const [mode, setMode] = useState<"static" | "modal">("static");
    const [eigenvalues, setEigenvalues] = useState<number[]>([]);

    const runAnalysis = () => {
        setStatus("Solving...");
        setTimeout(() => {
            const manager = FEASceneManager.getInstance();
            if (mode === "static") {
                manager.solveStatic();
                setStatus("Static Analysis Complete");
            } else {
                manager.solveModal();
                if (manager.result?.eigenvalues) {
                    setEigenvalues(manager.result.eigenvalues);
                }
                setStatus("Modal Analysis Complete");
            }
        }, 10);
    };

    const updateVisualization = (val: number) => {
        setExaggeration(val);
        const manager = FEASceneManager.getInstance();
        if (manager.visualizer && manager.result) {
            manager.visualizer.update(manager.nodes, manager.elements, manager.result, val);
        }
    };

    return (
        <div className="p-4 bg-gray-800 text-white h-full overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Structural Analysis</h2>

            <div className="mb-6">
                <h3 className="font-semibold mb-2">Analysis Type</h3>
                <div className="flex space-x-2">
                    <button
                        className={`px-3 py-1 rounded ${mode === "static" ? "bg-blue-600" : "bg-gray-600"}`}
                        onClick={() => setMode("static")}
                    >
                        Static
                    </button>
                    <button
                        className={`px-3 py-1 rounded ${mode === "modal" ? "bg-blue-600" : "bg-gray-600"}`}
                        onClick={() => setMode("modal")}
                    >
                        Modal
                    </button>
                </div>
            </div>

            <div className="mb-6">
                <h3 className="font-semibold mb-2">Parameters</h3>
                <div className="space-y-2">
                    <div>
                        <label className="block text-sm">Load (N)</label>
                        <input
                            type="range" min="100" max="10000" step="100"
                            value={loadMagnitude}
                            onChange={(e) => setLoadMagnitude(Number(e.target.value))}
                            className="w-full"
                        />
                        <span className="text-xs">{loadMagnitude} N</span>
                    </div>
                    <div>
                        <label className="block text-sm">Exaggeration</label>
                        <input
                            type="range" min="1" max="500" step="1"
                            value={exaggeration}
                            onChange={(e) => updateVisualization(Number(e.target.value))}
                            className="w-full"
                        />
                        <span className="text-xs">{exaggeration}x</span>
                    </div>
                </div>
            </div>

            <button
                className="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-bold mb-4"
                onClick={runAnalysis}
            >
                Run Analysis
            </button>

            <div className="border-t border-gray-600 pt-4">
                <h3 className="font-semibold mb-2">Results</h3>
                <p className="text-sm text-gray-300">{status}</p>

                {mode === "modal" && eigenvalues.length > 0 && (
                    <div className="mt-2">
                        <h4 className="text-sm font-semibold">Frequencies (Hz)</h4>
                        <ul className="text-xs space-y-1">
                            {eigenvalues.map((ev, i) => (
                                <li key={i}>Mode {i + 1}: {(Math.sqrt(ev) / (2 * Math.PI)).toFixed(2)} Hz</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};
