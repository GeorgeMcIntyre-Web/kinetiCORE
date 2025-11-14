/**
 * Auto Kinematics Test Page
 *
 * Standalone page for running comprehensive auto kinematics pipeline tests.
 *
 * Usage: Navigate to /test-auto-kinematics in development mode
 *
 * Owner: George (Claude Code Agent 1)
 */

import React from 'react';
import { AutoKinematicsTestButton } from '../components/AutoKinematicsTestButton';

export const AutoKinematicsTestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-cyan-400 mb-2">
            Auto Kinematics Pipeline - Test Suite
          </h1>
          <p className="text-gray-400">
            Comprehensive testing for the complete kinematic extraction workflow on 9X_110_GEO.glb
          </p>
        </header>

        <div className="space-y-6">
          {/* Test Runner */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Test Runner</h2>
            <AutoKinematicsTestButton />
          </section>

          {/* Test Overview */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Test Stages</h2>
            <ol className="space-y-3 text-sm text-gray-300">
              <li className="flex gap-3">
                <span className="font-mono text-cyan-400">Stage 0:</span>
                <span>Setup - Initialize Babylon scene and test environment</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-cyan-400">Stage 1:</span>
                <span>Load GLB - Load and validate 9X_110_GEO.glb structure</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-cyan-400">Stage 2:</span>
                <span>Analyze Scene - Geometric detection of fixed/moving units</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-cyan-400">Stage 3:</span>
                <span>Validate SceneTree - Verify node ID mappings</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-cyan-400">Stage 4:</span>
                <span>Capture Retracted - Sample point clouds in home position</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-cyan-400">Stage 5:</span>
                <span>Capture Extended - Sample point clouds in actuated position</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-cyan-400">Stage 6:</span>
                <span>Fit Joints - ICP alignment and joint type inference</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-cyan-400">Stage 7:</span>
                <span>Export JSON - Generate tooling JSON output</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-cyan-400">Stage 8:</span>
                <span>Validate Output - Verify JSON structure and schema</span>
              </li>
            </ol>
          </section>

          {/* Expected Results */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Expected Results</h2>
            <div className="space-y-4 text-sm text-gray-300">
              <div>
                <h3 className="font-semibold text-green-400 mb-2">✅ Success Criteria:</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Detects 3 tool units (BASEPLATE, UNIT_118, UNIT_112)</li>
                  <li>Classifies 1 fixed unit (BASEPLATE)</li>
                  <li>Classifies 2 moving units (UNIT_118_MOVING, UNIT_112_MOVING)</li>
                  <li>Captures point clouds for both states (total: 1000-3000 points)</li>
                  <li>Fits 2 prismatic joints with confidence &gt; 0.5</li>
                  <li>Exports valid JSON with 2 joint definitions</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-yellow-400 mb-2">⚠️ Known Warnings:</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Using simulated GLB structure (not actual file load)</li>
                  <li>Point cloud sampling may vary (stride-based)</li>
                  <li>ICP error may be higher on simple box geometries</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-red-400 mb-2">❌ Failure Modes:</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>No moving units detected → Check geometric analysis thresholds</li>
                  <li>Empty point clouds → Verify mesh data and sampling stride</li>
                  <li>ICP fails to converge → Increase max iterations or adjust tolerance</li>
                  <li>Low confidence joints → Motion magnitude too small (&lt;1mm)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Debugging Tips */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Debugging Tips</h2>
            <div className="space-y-3 text-sm text-gray-300">
              <div>
                <h3 className="font-semibold text-cyan-400 mb-1">Console Output:</h3>
                <p>Open browser DevTools (F12) to see detailed logging for each stage.</p>
              </div>
              <div>
                <h3 className="font-semibold text-cyan-400 mb-1">Test Report JSON:</h3>
                <p>
                  After test completion, a JSON file will download automatically with full diagnostic data.
                  Search for <code className="bg-gray-700 px-1 rounded">auto_kinematics_test_report_*.json</code> in Downloads.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-cyan-400 mb-1">Key Log Patterns:</h3>
                <ul className="list-disc list-inside ml-2 mt-1">
                  <li><code className="bg-gray-700 px-1 rounded">[TEST]</code> - Test harness messages</li>
                  <li><code className="bg-gray-700 px-1 rounded">[Pipeline]</code> - Pipeline execution logs</li>
                  <li><code className="bg-gray-700 px-1 rounded">[GeometricToolAnalyzer]</code> - Analysis details</li>
                  <li><code className="bg-gray-700 px-1 rounded">[JointExtractor]</code> - Joint inference logs</li>
                  <li><code className="bg-gray-700 px-1 rounded">[ICP]</code> - ICP convergence logs</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Test Parameters */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Test Parameters</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-semibold text-cyan-400 mb-2">Geometric Analysis:</h3>
                <ul className="space-y-1 text-gray-300 font-mono text-xs">
                  <li>minVolume: 0.00001 m³</li>
                  <li>clusteringDistance: 0.5 m</li>
                  <li>similarityThreshold: 0.90</li>
                  <li>fixedProximityThreshold: 1.0 m</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-cyan-400 mb-2">ICP Options:</h3>
                <ul className="space-y-1 text-gray-300 font-mono text-xs">
                  <li>maxIterations: 100</li>
                  <li>tolerance: 1e-6</li>
                  <li>useProfessionalICP: true</li>
                  <li>enableDebug: true</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-cyan-400 mb-2">Joint Extraction:</h3>
                <ul className="space-y-1 text-gray-300 font-mono text-xs">
                  <li>translationThreshold: 0.001 m</li>
                  <li>rotationThreshold: 0.05 rad</li>
                  <li>minConfidence: 0.3</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-cyan-400 mb-2">State Capture:</h3>
                <ul className="space-y-1 text-gray-300 font-mono text-xs">
                  <li>stride: 10 (every 10th vertex)</li>
                  <li>maxPoints: 1000</li>
                  <li>samplePoints: true</li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-12 pt-6 border-t border-gray-700 text-center text-sm text-gray-500">
          <p>Auto Kinematics Pipeline Test Suite v1.0</p>
          <p>Owner: George (Claude Code Agent 1)</p>
        </footer>
      </div>
    </div>
  );
};

export default AutoKinematicsTestPage;
