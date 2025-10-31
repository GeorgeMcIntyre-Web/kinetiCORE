import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { useEditorStore } from './ui/store/editorStore';
import { TransformDebugVisualizer } from './kinematics/TransformDebugVisualizer';
import { IKTestHarness } from './kinematics/IKTestHarness';
import { runAutoKinematicsFullTest } from './babylon/pipeline/AutoKinematicsFullPipelineTest';
import * as BABYLON from '@babylonjs/core';

// Expose debug tools to window for console access
if (typeof window !== 'undefined') {
  (window as any).useEditorStore = useEditorStore;
  (window as any).TransformDebugVisualizer = TransformDebugVisualizer;
  (window as any).IKTestHarness = IKTestHarness;
  (window as any).BABYLON = BABYLON; // Expose BABYLON for console commands
  (window as any).testAutoKinematics = runAutoKinematicsFullTest; // Auto kinematics test

  console.log('[DEV] Auto Kinematics test exposed: window.testAutoKinematics()');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);