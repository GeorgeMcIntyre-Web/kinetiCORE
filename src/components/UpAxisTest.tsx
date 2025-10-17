import React, { useState, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { loadGLBFromFile } from '../loaders/glb/GLBLoader';
import { diagnoseUpAxis } from '../loaders/glb/upAxis';

interface TestResult {
  filename: string;
  expectedUpAxis: string;
  detectedUpAxis: string;
  confidence: number;
  method: string;
  applied: boolean;
  isCorrect: boolean;
  position: string;
  bounds?: {
    center: string;
    size: string;
  };
  extents?: {
    x: number;
    y: number;
    z: number;
  };
  expectedFromExtents?: string;
  error?: string;
}

export const UpAxisTest: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>(['Ready to test files...']);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);

  // Initialize Babylon.js scene
  const initScene = () => {
    if (!canvasRef.current || sceneRef.current) return;

    const canvas = canvasRef.current;
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera("camera", 0, Math.PI / 3, 10, BABYLON.Vector3.Zero(), scene);
    camera.attachControls(canvas, true);

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Add ground plane
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, scene);
    ground.position.y = -2;
    const groundMaterial = new BABYLON.StandardMaterial("groundMat", scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    ground.material = groundMaterial;

    engine.runRenderLoop(() => {
      scene.render();
    });

    engineRef.current = engine;
    sceneRef.current = scene;

    log('Scene initialized');
  };

  // Logging function
  const log = (message: string, type: 'success' | 'error' | 'warning' | 'info' | '' = '') => {
    const timestamp = new Date().toLocaleTimeString();
    const className = type ? `text-${type === 'success' ? 'green' : type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'blue'}-400` : '';
    setConsoleOutput(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  // Test files
  const testFiles = async (files: FileList) => {
    if (!sceneRef.current) {
      initScene();
    }

    setIsLoading(true);
    setTestResults([]);
    setConsoleOutput(['Starting test...']);

    log(`\n=== Testing ${files.length} files ===`, 'warning');

    const results: TestResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await testSingleFile(file, i, results);
    }

    setTestResults(results);
    setIsLoading(false);

    // Summary
    const successful = results.filter(r => !r.error);
    const correct = successful.filter(r => r.isCorrect);
    const incorrect = successful.filter(r => !r.isCorrect);
    const errors = results.filter(r => r.error);

    log(`\n=== SUMMARY ===`, 'warning');
    log(`Total files: ${results.length}`);
    log(`Successful loads: ${successful.length}`);
    log(`Correct detections: ${correct.length}`);
    log(`Incorrect detections: ${incorrect.length}`);
    log(`Errors: ${errors.length}`);
    log(`Success rate: ${successful.length > 0 ? Math.round((correct.length / successful.length) * 100) : 0}%`);
  };

  // Test a single file
  const testSingleFile = async (file: File, index: number, results: TestResult[]) => {
    log(`\n--- Testing ${file.name} ---`, 'warning');

    try {
      // Determine expected up-axis from filename
      const expectedUpAxis = file.name.toLowerCase().includes('_yup') ? 'Y' : 
                            file.name.toLowerCase().includes('_zup') ? 'Z' : 'UNKNOWN';
      
      log(`Expected: ${expectedUpAxis}-up`, expectedUpAxis === 'UNKNOWN' ? 'warning' : 'info');

      // Load the file
      const result = await loadGLBFromFile(file, sceneRef.current!, {
        enableUpAxisDetection: true,
        upAxisVerbose: true,
        enableBoundsCalculation: true
      });

      if (!result.success) {
        log(`❌ Failed to load: ${result.errors.join(', ')}`, 'error');
        results.push({
          filename: file.name,
          expectedUpAxis,
          detectedUpAxis: 'ERROR',
          confidence: 0,
          method: 'ERROR',
          applied: false,
          isCorrect: false,
          error: result.errors.join(', ')
        });
        return;
      }

      log(`✅ Loaded successfully`, 'success');

      // Get detection results
      const detection = result.upAxisDetection;
      if (detection) {
        log(`Detected: ${detection.detected}-up (${Math.round(detection.confidence * 100)}%)`, 'info');
        log(`Method: ${detection.method}`, 'info');
        log(`Applied: ${detection.applied ? 'Yes' : 'No'}`, 'info');
        
        // Check if correct
        const isCorrect = expectedUpAxis === 'UNKNOWN' || detection.detected === expectedUpAxis;
        if (isCorrect) {
          log(`✅ CORRECT`, 'success');
        } else {
          log(`❌ INCORRECT - Expected ${expectedUpAxis}-up, got ${detection.detected}-up`, 'error');
        }
      } else {
        log(`❌ No detection result`, 'error');
      }

      // Position the model
      const rootNode = result.rootNodes[0];
      if (rootNode) {
        rootNode.position.x = (index % 3) * 5 - 5;
        rootNode.position.z = Math.floor(index / 3) * 5;
        log(`Positioned at: ${rootNode.position.toString()}`, 'info');
      }

      // Run diagnosis
      if (rootNode) {
        try {
          const diagnosis = diagnoseUpAxis(rootNode);
          log(`Diagnosis:`, 'info');
          log(`  PCA: ${diagnosis.pca.detected}-up (${Math.round(diagnosis.pca.confidence * 100)}%)`, 'info');
          log(`  AABB: ${diagnosis.aabb.detected}-up (${Math.round(diagnosis.aabb.confidence * 100)}%)`, 'info');
          log(`  Normals: ${diagnosis.normals.detected}-up (${Math.round(diagnosis.normals.confidence * 100)}%)`, 'info');
          log(`  Final: ${diagnosis.recommendation.detected}-up (${Math.round(diagnosis.recommendation.confidence * 100)}%)`, 'info');
        } catch (error) {
          log(`  Diagnosis error: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
      }

      // Store result
      results.push({
        filename: file.name,
        expectedUpAxis,
        detectedUpAxis: detection?.detected || 'UNKNOWN',
        confidence: Math.round((detection?.confidence || 0) * 100),
        method: detection?.method || 'UNKNOWN',
        applied: detection?.applied || false,
        isCorrect: expectedUpAxis === 'UNKNOWN' || detection?.detected === expectedUpAxis,
        position: rootNode ? rootNode.position.toString() : 'Unknown',
        bounds: result.bounds ? {
          center: result.bounds.center.toString(),
          size: result.bounds.maximum.subtract(result.bounds.minimum).toString()
        } : undefined
      });

    } catch (error) {
      log(`❌ Exception: ${error instanceof Error ? error.message : String(error)}`, 'error');
      results.push({
        filename: file.name,
        expectedUpAxis: 'UNKNOWN',
        detectedUpAxis: 'ERROR',
        confidence: 0,
        method: 'ERROR',
        applied: false,
        isCorrect: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  // Handle file input
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      testFiles(files);
    }
  };

  // Clear results
  const clearResults = () => {
    setTestResults([]);
    setConsoleOutput(['Console cleared...']);
    
    // Clear scene
    if (sceneRef.current) {
      const glbFiles = sceneRef.current.transformNodes.filter(node => 
        node.name.endsWith('.glb') || node.name.endsWith('.GLB')
      );
      glbFiles.forEach(node => node.dispose());
    }
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔍 Up-Axis Detection Test</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">Test Files</h3>
              <p className="text-gray-300 mb-4">
                Select your test GLB files to validate up-axis detection:
              </p>
              <ul className="text-sm text-gray-400 mb-4">
                <li>• UNIT_104L_Yup.glb (should be detected as Y-up)</li>
                <li>• UNIT_104L_Zup.glb (should be detected as Z-up)</li>
                <li>• UNIT_101_Yup.glb (should be detected as Y-up)</li>
              </ul>
              
              <input
                type="file"
                multiple
                accept=".glb"
                onChange={handleFileChange}
                disabled={isLoading}
                className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              
              <div className="mt-4 space-x-2">
                <button
                  onClick={clearResults}
                  disabled={isLoading}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  Clear Results
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">Test Results</h3>
              {testResults.length === 0 ? (
                <p className="text-gray-400">No test results yet</p>
              ) : (
                <div className="space-y-2">
                  {testResults.map((result, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded border-l-4 ${
                        result.isCorrect ? 'border-green-500 bg-green-900/20' : 'border-red-500 bg-red-900/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">
                          {result.isCorrect ? '✅' : '❌'} {result.filename}
                        </span>
                        <span className="text-sm text-gray-400">
                          {result.confidence}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-300 mt-1">
                        Expected: {result.expectedUpAxis}-up | Detected: {result.detectedUpAxis}-up
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Method: {result.method} | Applied: {result.applied ? 'Yes' : 'No'}
                      </div>
                      {result.error && (
                        <div className="text-xs text-red-400 mt-1">
                          Error: {result.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3D View and Console */}
          <div className="space-y-4">
            {/* 3D View */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">3D View</h3>
              <canvas
                ref={canvasRef}
                className="w-full h-64 border border-gray-600 rounded"
                style={{ background: '#1a1a1a' }}
              />
            </div>

            {/* Console */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-4">Console Output</h3>
              <div className="bg-black p-3 rounded font-mono text-sm h-64 overflow-y-auto">
                {consoleOutput.map((line, index) => (
                  <div key={index} className="text-green-400">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
