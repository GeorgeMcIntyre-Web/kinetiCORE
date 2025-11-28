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
// NOTE: These files were deprecated as part of Statistical Pairing Engine migration:
// import { testHierarchicalAnalyzer } from './dev/testHierarchicalAnalyzer'; // DEPRECATED
// import { extractJointTransforms } from './dev/extractJointTransforms'; // DEPRECATED
// import { visualizeJoints, clearJointVisualizations } from './dev/visualizeJoints'; // DEPRECATED
import { debugTools } from './dev/globalDebugTools';
import * as BABYLON from '@babylonjs/core';
// Side-effect imports: ensure Inspector bundle is loaded on cold refresh
import '@babylonjs/core/Debug/debugLayer';

// Expose BABYLON to window FIRST, before Inspector import
// Inspector bundle needs window.BABYLON to exist when it loads to register itself
if (typeof window !== 'undefined') {
  (window as any).BABYLON = BABYLON;
}

// Side-effect import so Inspector registers its class on window.BABYLON
// Must come AFTER window.BABYLON is set (imports are hoisted, but execution order matters for side-effects)
import '@babylonjs/inspector';

// Verify Inspector bundle is loaded
// Note: In Babylon.js 8.x, Inspector is integrated into DebugLayer
// There may not be a separate window.BABYLON.Inspector class
if (typeof window !== 'undefined') {
  Promise.resolve().then(async () => {
    const winB = (window as any).BABYLON;
    if (!winB) {
      console.warn('⚠️ window.BABYLON not found');
      return;
    }

    // Check if Inspector class exists (older versions)
    if (winB.Inspector) {
      console.log('✅ Inspector class found on window.BABYLON');
      return;
    }

    // In Babylon.js 8.x, Inspector is integrated into DebugLayer
    // The bundle just needs to be loaded for DebugLayer.show() to work
    if (winB.DebugLayer) {
      console.log('ℹ️ Inspector bundle loaded - Inspector integrated into DebugLayer (Babylon.js 8.x)');
      // Try to manually add Inspector class for compatibility if needed
      try {
        const inspectorModule = await import('@babylonjs/inspector');
        const InspectorClass = 
          (inspectorModule as any).Inspector ||
          (inspectorModule as any).default?.Inspector ||
          (inspectorModule as any).default;
        
        if (InspectorClass) {
          winB.Inspector = InspectorClass;
          console.log('✅ Inspector class manually registered for compatibility');
        }
      } catch (err) {
        // Bundle is loaded, DebugLayer can use it even without Inspector class
        console.log('ℹ️ Inspector bundle loaded (no separate Inspector class needed)');
      }
    } else {
      console.warn('⚠️ DebugLayer not found - Inspector may not work');
    }
  });
}

// Expose debug tools to window for console access
if (typeof window !== 'undefined') {
  (window as any).useEditorStore = useEditorStore;
  (window as any).TransformDebugVisualizer = TransformDebugVisualizer;
  (window as any).IKTestHarness = IKTestHarness;
  // Auto kinematics tools (BABYLON already exposed above for Inspector)
  (window as any).testAutoKinematics = runAutoKinematicsFullTest; // Auto kinematics test
  (window as any).analyzeGLBJoints = analyzeGLBJoints; // Geometry-based joint finder
  (window as any).inspectGLBStructure = inspectGLBStructure; // Full GLB structure inspector
  (window as any).analyzeUnitStructure = analyzeUnitStructure; // Correct unit/joint analyzer
  // NOTE: Deprecated tools removed (use Statistical Pairing Engine instead):
  // (window as any).testHierarchicalAnalyzer = testHierarchicalAnalyzer; // DEPRECATED
  // (window as any).extractJointTransforms = extractJointTransforms; // DEPRECATED
  // (window as any).visualizeJoints = visualizeJoints; // DEPRECATED
  // (window as any).clearJointVisualizations = clearJointVisualizations; // DEPRECATED
  (window as any).debugTools = debugTools; // Unified debug tools API

  console.log('[DEV] Auto Kinematics test exposed: window.testAutoKinematics()');
  console.log('[DEV] GLB Analysis tools:');
  console.log('  - window.analyzeUnitStructure(scene) - Analyze UNIT_XXX structure');
  console.log('  - window.analyzeGLBJoints(path, scene) - Find joint pairs by geometry');
  console.log('  - window.inspectGLBStructure(path, scene) - Full structure inspection');
  console.log('  - window.debugTools - Unified debug API (see docs/STATISTICAL_PAIRING_COMPLETE.md)');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  // Temporarily removed StrictMode for Inspector stability (prevents double-mount race)
  <App />
);
