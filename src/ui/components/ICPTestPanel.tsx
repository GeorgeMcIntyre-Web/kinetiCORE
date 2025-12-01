/**
 * ICPTestPanel - Manual ICP Testing Tool
 * Owner: George
 *
 * Interactive UI for manually testing ICP alignment with selected FIXED and MOVING nodes.
 * Provides detailed debugging output to diagnose transformation extraction.
 */

import React, { useState, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import {
  TestTube,
  Plus,
  Trash2,
  Zap,
  Info,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { SceneManager } from '../../scene/SceneManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { useEditorStore } from '../store/editorStore';
import { ICP } from '../../babylon/pointCloud/ICP';
import { PCLICPSolver } from '../../babylon/pointCloud/PCLICPSolver';
import { WorldSpace } from '../../babylon/utils/WorldSpace';
import './ICPTestPanel.css';

interface ICPTestPanelProps {
  onClose?: () => void;
  isVisible?: boolean;
  zIndex?: number;
}

interface NodeSelection {
  id: string;
  name: string;
  uniqueId: number;
  type: 'fixed' | 'moving';
  pointCount?: number;
}

export const ICPTestPanel: React.FC<ICPTestPanelProps> = ({
  onClose,
  isVisible = true,
  zIndex = 1004,
}) => {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const [fixedNodes, setFixedNodes] = useState<NodeSelection[]>([]);
  const [movingNodes, setMovingNodes] = useState<NodeSelection[]>([]);
  const [testResult, setTestResult] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);

  // Algorithm selection
  const [usePCL, setUsePCL] = useState(true); // Use PCL.js by default (proven implementation)

  // ICP parameters (adjustable)
  const [maxIterations, setMaxIterations] = useState(200); // PCL default from ModelAnalyzer3D
  const [tolerance, setTolerance] = useState(1e-7); // PCL default
  const [trimFraction, setTrimFraction] = useState(0.8);
  const [rejectThreshold, setRejectThreshold] = useState(0.1); // 100mm for automotive (PCL default)

  // Add selected node as FIXED
  const handleAddFixed = useCallback(() => {
    if (!selectedNodeId) return;

    const scene = SceneManager.getInstance().getScene();
    if (!scene) return;

    // Get the scene tree node first
    const tree = SceneTreeManager.getInstance();
    const selectedNode = tree.getNode(selectedNodeId);
    if (!selectedNode) {
      setTestResult('ERROR: Selected node not found in scene tree');
      return;
    }

    // Resolve Babylon node using the same logic as KinematicExtractionPanel
    let babylonNode: BABYLON.Node | null = null;

    // Prefer explicit transform node id if present
    const tnId = (selectedNode as any).babylonTransformNodeId ?? (selectedNode as any).babylonNodeId;
    if (tnId) {
      const uid = parseInt(String(tnId));
      babylonNode = scene.transformNodes.find((n) => n.uniqueId === uid) || null;
    }

    // Fallback to mesh unique id if available
    if (!babylonNode && (selectedNode as any).babylonMeshId) {
      const meshUid = parseInt(String((selectedNode as any).babylonMeshId));
      const mesh = scene.getMeshByUniqueId(meshUid);
      babylonNode = (mesh?.parent as BABYLON.Node) || (mesh as BABYLON.Node) || null;
    }

    // Final fallback by name
    if (!babylonNode) {
      babylonNode = scene.getTransformNodeByName(selectedNode.name) as BABYLON.Node;
    }

    if (!babylonNode) {
      setTestResult(`ERROR: Could not resolve Babylon node for '${selectedNode.name}'`);
      return;
    }

    // Count meshes
    const meshes = (babylonNode as any).getChildMeshes ? (babylonNode as any).getChildMeshes() as BABYLON.AbstractMesh[] : [];
    const pointCount = meshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0);

    const selection: NodeSelection = {
      id: babylonNode.id || babylonNode.name,
      name: babylonNode.name,
      uniqueId: babylonNode.uniqueId,
      type: 'fixed',
      pointCount,
    };

    setFixedNodes((prev) => [...prev, selection]);
    setTestResult(`Added FIXED: ${babylonNode.name} (${meshes.length} meshes, ${pointCount} vertices)`);
  }, [selectedNodeId]);

  // Add selected node as MOVING
  const handleAddMoving = useCallback(() => {
    if (!selectedNodeId) return;

    const scene = SceneManager.getInstance().getScene();
    if (!scene) return;

    // Get the scene tree node first
    const tree = SceneTreeManager.getInstance();
    const selectedNode = tree.getNode(selectedNodeId);
    if (!selectedNode) {
      setTestResult('ERROR: Selected node not found in scene tree');
      return;
    }

    // Resolve Babylon node using the same logic as KinematicExtractionPanel
    let babylonNode: BABYLON.Node | null = null;

    // Prefer explicit transform node id if present
    const tnId = (selectedNode as any).babylonTransformNodeId ?? (selectedNode as any).babylonNodeId;
    if (tnId) {
      const uid = parseInt(String(tnId));
      babylonNode = scene.transformNodes.find((n) => n.uniqueId === uid) || null;
    }

    // Fallback to mesh unique id if available
    if (!babylonNode && (selectedNode as any).babylonMeshId) {
      const meshUid = parseInt(String((selectedNode as any).babylonMeshId));
      const mesh = scene.getMeshByUniqueId(meshUid);
      babylonNode = (mesh?.parent as BABYLON.Node) || (mesh as BABYLON.Node) || null;
    }

    // Final fallback by name
    if (!babylonNode) {
      babylonNode = scene.getTransformNodeByName(selectedNode.name) as BABYLON.Node;
    }

    if (!babylonNode) {
      setTestResult(`ERROR: Could not resolve Babylon node for '${selectedNode.name}'`);
      return;
    }

    // Count meshes
    const meshes = (babylonNode as any).getChildMeshes ? (babylonNode as any).getChildMeshes() as BABYLON.AbstractMesh[] : [];
    const pointCount = meshes.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0);

    const selection: NodeSelection = {
      id: babylonNode.id || babylonNode.name,
      name: babylonNode.name,
      uniqueId: babylonNode.uniqueId,
      type: 'moving',
      pointCount,
    };

    setMovingNodes((prev) => [...prev, selection]);
    setTestResult(`Added MOVING: ${babylonNode.name} (${meshes.length} meshes, ${pointCount} vertices)`);
  }, [selectedNodeId]);

  // Remove node from lists
  const handleRemove = useCallback((uniqueId: number, type: 'fixed' | 'moving') => {
    if (type === 'fixed') {
      setFixedNodes((prev) => prev.filter((n) => n.uniqueId !== uniqueId));
    } else {
      setMovingNodes((prev) => prev.filter((n) => n.uniqueId !== uniqueId));
    }
  }, []);

  // Run ICP test with detailed debugging
  const handleRunTest = useCallback(async () => {
    if (fixedNodes.length === 0 || movingNodes.length === 0) {
      setTestResult('ERROR: Please select at least one FIXED and one MOVING node');
      return;
    }

    setIsRunning(true);
    setTestResult('Running ICP test with full debugging...\n\n');

    try {
      const scene = SceneManager.getInstance().getScene();
      if (!scene) {
        setTestResult('ERROR: Scene not available');
        setIsRunning(false);
        return;
      }

      // Helper to find node by uniqueId
      const findNodeByUniqueId = (uniqueId: number): BABYLON.Node | null => {
        // Search in transform nodes
        const transformNode = scene.transformNodes.find(n => n.uniqueId === uniqueId);
        if (transformNode) return transformNode;

        // Search in meshes
        const mesh = scene.meshes.find(m => m.uniqueId === uniqueId);
        if (mesh) return mesh;

        return null;
      };

      // Collect point clouds from FIXED nodes
      console.log('[ICPTest] ===== COLLECTING FIXED POINT CLOUD =====');
      const fixedPoints: BABYLON.Vector3[] = [];
      for (const nodeInfo of fixedNodes) {
        const node = findNodeByUniqueId(nodeInfo.uniqueId);
        if (!node) {
          console.warn(`[ICPTest] FIXED node not found: ${nodeInfo.name}`);
          continue;
        }

        const meshes = (node as any).getChildMeshes ? (node as any).getChildMeshes() as BABYLON.AbstractMesh[] : [];
        console.log(`[ICPTest] FIXED node: ${nodeInfo.name}, meshes: ${meshes.length}`);

        for (const mesh of meshes) {
          const points = WorldSpace.sampleMeshWorldPoints(mesh, { stride: 10, maxPoints: 1000 });
          console.log(`[ICPTest]   - Mesh ${mesh.name}: ${points.length} points`);
          fixedPoints.push(...points);
        }
      }

      // Collect point clouds from MOVING nodes
      console.log('[ICPTest] ===== COLLECTING MOVING POINT CLOUD =====');
      const movingPoints: BABYLON.Vector3[] = [];
      for (const nodeInfo of movingNodes) {
        const node = findNodeByUniqueId(nodeInfo.uniqueId);
        if (!node) {
          console.warn(`[ICPTest] MOVING node not found: ${nodeInfo.name}`);
          continue;
        }

        const meshes = (node as any).getChildMeshes ? (node as any).getChildMeshes() as BABYLON.AbstractMesh[] : [];
        console.log(`[ICPTest] MOVING node: ${nodeInfo.name}, meshes: ${meshes.length}`);

        for (const mesh of meshes) {
          const points = WorldSpace.sampleMeshWorldPoints(mesh, { stride: 10, maxPoints: 1000 });
          console.log(`[ICPTest]   - Mesh ${mesh.name}: ${points.length} points`);
          movingPoints.push(...points);
        }
      }

      console.log('[ICPTest] ===== RUNNING ICP ALIGNMENT =====');
      console.log(`[ICPTest] FIXED points: ${fixedPoints.length}`);
      console.log(`[ICPTest] MOVING points: ${movingPoints.length}`);

      if (fixedPoints.length === 0 || movingPoints.length === 0) {
        const msg = `ERROR: Empty point clouds\n  FIXED: ${fixedPoints.length} points\n  MOVING: ${movingPoints.length} points\n\nCheck console for mesh collection details.`;
        setTestResult(msg);
        setIsRunning(false);
        return;
      }

      // Run ICP with selected algorithm
      console.log('[ICPTest] Using algorithm:', usePCL ? 'icpts (TypeScript, cascaded)' : 'Custom ICP');
      console.log('[ICPTest] ICP Parameters:', { maxIterations, tolerance, rejectThreshold });

      let result;

      if (usePCL) {
        // Use icpts (TypeScript, cascaded registration)
        const icptsResult = await PCLICPSolver.align(movingPoints, fixedPoints, {
          maxIterations,
          errorTolerance: tolerance,
          enableDebug: true,
        });

        console.log('[ICPTest] ===== ICPTS ICP RESULT =====');
        console.log('[ICPTest] Success:', icptsResult.success);
        console.log('[ICPTest] Error:', icptsResult.error);
        console.log('[ICPTest] Iterations:', icptsResult.iterations);

        result = {
          success: icptsResult.success,
          rmsError: icptsResult.error,
          iterations: icptsResult.iterations,
          correspondences: movingPoints.length, // Approximate
          transform: icptsResult.transform,
        };
      } else {
        // Use custom ICP
        const customResult = ICP.align(movingPoints, fixedPoints, {
          maxIterations,
          tolerance,
          trimFraction,
          rejectThreshold,
          enableDebug: true,
        });

        console.log('[ICPTest] ===== CUSTOM ICP RESULT =====');
        console.log('[ICPTest] Success:', customResult.success);
        console.log('[ICPTest] RMS Error:', customResult.rmsError);
        console.log('[ICPTest] Iterations:', customResult.iterations);
        console.log('[ICPTest] Correspondences:', customResult.correspondences);

        result = customResult;
      }

      // Build result message
      let msg = '===== ICP TEST RESULT =====\n\n';
      msg += `Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}\n`;
      msg += `RMS Error: ${result.rmsError.toFixed(6)} m\n`;
      msg += `Iterations: ${result.iterations}\n`;
      msg += `Correspondences: ${result.correspondences}\n\n`;

      if (result.debug) {
        msg += '===== POINT CLOUD INFO =====\n';
        msg += `FIXED points: ${fixedPoints.length}\n`;
        msg += `  Centroid: [${result.debug.targetCentroid.x.toFixed(4)}, ${result.debug.targetCentroid.y.toFixed(4)}, ${result.debug.targetCentroid.z.toFixed(4)}]\n`;
        msg += `  Bounds: ${result.debug.pointCloudBounds.target.size.x.toFixed(3)} x ${result.debug.pointCloudBounds.target.size.y.toFixed(3)} x ${result.debug.pointCloudBounds.target.size.z.toFixed(3)} m\n\n`;

        msg += `MOVING points: ${movingPoints.length}\n`;
        msg += `  Centroid: [${result.debug.sourceCentroid.x.toFixed(4)}, ${result.debug.sourceCentroid.y.toFixed(4)}, ${result.debug.sourceCentroid.z.toFixed(4)}]\n`;
        msg += `  Bounds: ${result.debug.pointCloudBounds.source.size.x.toFixed(3)} x ${result.debug.pointCloudBounds.source.size.y.toFixed(3)} x ${result.debug.pointCloudBounds.source.size.z.toFixed(3)} m\n\n`;

        msg += '===== TRANSFORMATION =====\n';
        msg += `Rotation (deg): [${result.debug.finalRotationDegrees.x.toFixed(2)}, ${result.debug.finalRotationDegrees.y.toFixed(2)}, ${result.debug.finalRotationDegrees.z.toFixed(2)}]\n`;
        msg += `Translation (m): [${result.debug.finalTranslation.x.toFixed(4)}, ${result.debug.finalTranslation.y.toFixed(4)}, ${result.debug.finalTranslation.z.toFixed(4)}]\n\n`;

        msg += '===== ITERATION HISTORY =====\n';
        for (const iter of result.debug.iterationHistory.slice(0, 10)) {
          msg += `Iter ${iter.iteration}: RMS=${iter.rmsError.toFixed(6)}m, correspondences=${iter.correspondences}, trimmed=${iter.trimmedOutliers}\n`;
        }
        if (result.debug.iterationHistory.length > 10) {
          msg += `... (${result.debug.iterationHistory.length - 10} more iterations)\n`;
        }

        msg += '\n===== DIAGNOSIS =====\n';
        if (result.rmsError < 0.001) {
          msg += '⚠ Very low RMS error - point clouds might be identical (no motion)\n';
        }
        if (result.correspondences < 10) {
          msg += '⚠ Very few correspondences - geometries might be too different\n';
        }
        const rotMag = Math.sqrt(
          result.debug.finalRotationDegrees.x ** 2 +
          result.debug.finalRotationDegrees.y ** 2 +
          result.debug.finalRotationDegrees.z ** 2
        );
        const transMag = Math.sqrt(
          result.debug.finalTranslation.x ** 2 +
          result.debug.finalTranslation.y ** 2 +
          result.debug.finalTranslation.z ** 2
        );
        if (rotMag < 1 && transMag < 0.01) {
          msg += '⚠ Almost no transformation - FIXED and MOVING might be in the same position\n';
        }
        msg += `\nRotation magnitude: ${rotMag.toFixed(2)}°\n`;
        msg += `Translation magnitude: ${transMag.toFixed(4)} m\n`;
      }

      msg += '\nSee browser console for full debug output.';

      setTestResult(msg);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setTestResult(`ERROR: ${errorMsg}\n\nSee console for details.`);
      console.error('[ICPTest] Test failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [fixedNodes, movingNodes, maxIterations, tolerance, trimFraction, rejectThreshold, usePCL]);

  return (
    <FloatingPanel
      title="ICP Test Tool"
      subtitle="Manual FIXED/MOVING selection with detailed debugging"
      icon={<TestTube size={20} />}
      onClose={onClose}
      isVisible={isVisible}
      zIndex={zIndex}
      defaultSize={{ width: 550, height: 750 }}
      className="icp-test-panel"
    >
      <div className="icp-test-content">
        {/* Info Banner */}
        <div className="info-banner">
          <Info size={16} />
          <span>
            Select nodes in the scene tree, then add them as FIXED (base) or MOVING (actuated) parts. Click "Run ICP Test" to see detailed transformation analysis.
          </span>
        </div>

        {/* Selection Controls */}
        <div className="selection-controls">
          <div className="control-row">
            <button
              className="btn btn-primary"
              onClick={handleAddFixed}
              disabled={!selectedNodeId}
              title="Add selected node as FIXED (base part)"
            >
              <Plus size={16} />
              Add as FIXED
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAddMoving}
              disabled={!selectedNodeId}
              title="Add selected node as MOVING (actuated part)"
            >
              <Plus size={16} />
              Add as MOVING
            </button>
          </div>
          {!selectedNodeId && (
            <p className="hint">Select a node in the scene tree first</p>
          )}
        </div>

        {/* FIXED Nodes List */}
        <div className="node-list">
          <h3>FIXED Nodes ({fixedNodes.length})</h3>
          {fixedNodes.length === 0 ? (
            <p className="empty-state">No FIXED nodes selected</p>
          ) : (
            <ul>
              {fixedNodes.map((node) => (
                <li key={node.uniqueId}>
                  <span className="node-name">{node.name}</span>
                  <span className="node-info">{node.pointCount?.toLocaleString()} vertices</span>
                  <button
                    className="btn-icon"
                    onClick={() => handleRemove(node.uniqueId, 'fixed')}
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* MOVING Nodes List */}
        <div className="node-list">
          <h3>MOVING Nodes ({movingNodes.length})</h3>
          {movingNodes.length === 0 ? (
            <p className="empty-state">No MOVING nodes selected</p>
          ) : (
            <ul>
              {movingNodes.map((node) => (
                <li key={node.uniqueId}>
                  <span className="node-name">{node.name}</span>
                  <span className="node-info">{node.pointCount?.toLocaleString()} vertices</span>
                  <button
                    className="btn-icon"
                    onClick={() => handleRemove(node.uniqueId, 'moving')}
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ICP Parameters */}
        <div className="params-panel">
          <h3>ICP Parameters</h3>

          {/* Algorithm Selection */}
          <div className="algorithm-toggle">
            <label>
              <input
                type="checkbox"
                checked={usePCL}
                onChange={(e) => setUsePCL(e.target.checked)}
              />
              <span>Use icpts (TypeScript ICP - Recommended)</span>
            </label>
            <p className="toggle-hint">
              {usePCL
                ? '✓ Using TypeScript ICP with cascaded registration (ModelAnalyzer3D patterns)'
                : '⚠ Using experimental custom ICP implementation'}
            </p>
          </div>

          <div className="param-row">
            <label title="Maximum distance (in meters) for point correspondences">
              Reject Threshold (m):
              <input
                type="number"
                min="0.001"
                max="5.0"
                step="0.01"
                value={rejectThreshold}
                onChange={(e) => setRejectThreshold(parseFloat(e.target.value))}
              />
            </label>
            <label title="Fraction of closest point pairs to keep (0.8 = keep best 80%, discard worst 20%)">
              Trim Fraction:
              <input
                type="number"
                min="0.2"
                max="1.0"
                step="0.05"
                value={trimFraction}
                onChange={(e) => setTrimFraction(parseFloat(e.target.value))}
              />
            </label>
          </div>
          <div className="param-row">
            <label title="Maximum number of alignment iterations">
              Max Iterations:
              <input
                type="number"
                min="10"
                max="200"
                step="10"
                value={maxIterations}
                onChange={(e) => setMaxIterations(parseInt(e.target.value))}
              />
            </label>
            <label title="Convergence threshold - stop when RMS error change is below this value">
              Tolerance:
              <input
                type="number"
                min="0.000001"
                max="0.01"
                step="0.000001"
                value={tolerance}
                onChange={(e) => setTolerance(parseFloat(e.target.value))}
              />
            </label>
          </div>
          <p className="param-hint">
            💡 Tip: For large automotive tooling, try increasing Reject Threshold to 0.5m or higher if you see "0 correspondences" errors.
          </p>
        </div>

        {/* Run Test Button */}
        <button
          className="btn btn-success btn-large"
          onClick={handleRunTest}
          disabled={isRunning || fixedNodes.length === 0 || movingNodes.length === 0}
        >
          {isRunning ? (
            <>
              <div className="spinner" />
              Running ICP Test...
            </>
          ) : (
            <>
              <Zap size={16} />
              Run ICP Test
            </>
          )}
        </button>

        {/* Result Display */}
        {testResult && (
          <div className={`result-panel ${testResult.includes('ERROR') ? 'error' : testResult.includes('SUCCESS') ? 'success' : 'info'}`}>
            <div className="result-header">
              {testResult.includes('ERROR') ? (
                <AlertCircle size={16} />
              ) : testResult.includes('SUCCESS') ? (
                <CheckCircle size={16} />
              ) : (
                <Info size={16} />
              )}
              <span>Test Result</span>
            </div>
            <pre className="result-text">{testResult}</pre>
          </div>
          )}
        </div>

    </FloatingPanel>
  );
};
