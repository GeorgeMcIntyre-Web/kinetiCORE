import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { useEditorStore } from './ui/store/editorStore';
import { TransformDebugVisualizer } from './kinematics/TransformDebugVisualizer';
import { IKTestHarness } from './kinematics/IKTestHarness';
import { runAutoKinematicsFullTest } from './babylon/pipeline/AutoKinematicsFullPipelineTest';
import { analyzeGLBJoints } from './dev/findJointsByGeometry';
import { inspectGLBStructure } from './dev/inspectGLBStructure';
import { analyzeUnitStructure } from './dev/analyzeUnitStructure';
import { testHierarchicalAnalyzer } from './dev/testHierarchicalAnalyzer';
import { extractJointTransforms } from './dev/extractJointTransforms';
import { visualizeJoints, clearJointVisualizations } from './dev/visualizeJoints';
import * as BABYLON from '@babylonjs/core';

// Expose debug tools to window for console access
if (typeof window !== 'undefined') {
  (window as any).useEditorStore = useEditorStore;
  (window as any).TransformDebugVisualizer = TransformDebugVisualizer;
  (window as any).IKTestHarness = IKTestHarness;
  (window as any).BABYLON = BABYLON; // Expose BABYLON for console commands
  (window as any).testAutoKinematics = runAutoKinematicsFullTest; // Auto kinematics test
  (window as any).analyzeGLBJoints = analyzeGLBJoints; // Geometry-based joint finder
  (window as any).inspectGLBStructure = inspectGLBStructure; // Full GLB structure inspector
  (window as any).analyzeUnitStructure = analyzeUnitStructure; // Correct unit/joint analyzer
  (window as any).testHierarchicalAnalyzer = testHierarchicalAnalyzer; // NEW: Test hierarchical analyzer
  (window as any).extractJointTransforms = extractJointTransforms; // NEW: Extract joint 3D transforms
  (window as any).visualizeJoints = visualizeJoints; // NEW: Visualize joints with gizmos
  (window as any).clearJointVisualizations = clearJointVisualizations; // NEW: Clear joint gizmos

  console.log('[DEV] Auto Kinematics test exposed: window.testAutoKinematics()');
  console.log('[DEV] GLB Analysis tools:');
  console.log('  - window.testHierarchicalAnalyzer() - Test NEW hierarchical analyzer (RECOMMENDED)');
  console.log('  - window.extractJointTransforms() - Extract 3D transform matrices for joints');
  console.log('  - window.visualizeJoints() - Visualize joints with 3D gizmos');
  console.log('  - window.clearJointVisualizations() - Clear joint visualizations');
  console.log('  - window.analyzeUnitStructure(scene) - Analyze UNIT_XXX structure');
  console.log('  - window.analyzeGLBJoints(path, scene) - Find joint pairs by geometry');
  console.log('  - window.inspectGLBStructure(path, scene) - Full structure inspection');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);