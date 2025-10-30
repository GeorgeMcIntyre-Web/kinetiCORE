/**
 * KinematicExtractionPanel - Auto Kinematic Tooling Workflow
 * Owner: George
 *
 * Interactive UI for the kinematic extraction pipeline.
 * Guides user through the complete workflow:
 * 1. Analyze scene geometrically
 * 2. Position parts in retracted state → capture
 * 3. Position parts in extended state → capture
 * 4. Fit joints using ICP
 * 5. Export tooling JSON
 */

import React, { useState, useEffect, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import {
  Scan,
  Camera,
  Zap,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  RefreshCw,
} from 'lucide-react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { SceneManager } from '../../scene/SceneManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { KinematicExtractionPipeline } from '../../babylon/pipeline/KinematicExtractionPipeline';
import { downloadTreeReport, downloadMappedSceneTreeReport } from '../../babylon/sceneAnalysis/SceneTreeReporter';
import type { ToolGraph } from '../../babylon/sceneAnalysis/ToolGraphAnalyzer';
import type { KinematicModelExport } from '../../babylon/io/Schemas';
import { useEditorStore } from '../store/editorStore';

type WorkflowStep = 'analyze' | 'capture_retracted' | 'capture_extended' | 'fit_joints' | 'export';

interface StepStatus {
  step: WorkflowStep;
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  message?: string;
}

interface KinematicExtractionPanelProps {
  onClose?: () => void;
  isVisible?: boolean;
  zIndex?: number;
}

export const KinematicExtractionPanel: React.FC<KinematicExtractionPanelProps> = ({
  onClose,
  isVisible = true,
  zIndex = 1003,
}) => {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const [pipeline, setPipeline] = useState<KinematicExtractionPipeline | null>(null);
  const [toolGraph, setToolGraph] = useState<ToolGraph | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [stepStatuses, setStepStatuses] = useState<Record<WorkflowStep, StepStatus>>({
    analyze: { step: 'analyze', status: 'pending' },
    capture_retracted: { step: 'capture_retracted', status: 'pending' },
    capture_extended: { step: 'capture_extended', status: 'pending' },
    fit_joints: { step: 'fit_joints', status: 'pending' },
    export: { step: 'export', status: 'pending' },
  });
  const [exportedModel, setExportedModel] = useState<KinematicModelExport | null>(null);

  // Initialize pipeline when component mounts or becomes visible
  useEffect(() => {
    if (!isVisible) return;

    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();

    if (scene) {
      console.log('[KinematicExtractionPanel] Initializing pipeline with scene');
      setPipeline(new KinematicExtractionPipeline(scene));
    } else {
      console.warn('[KinematicExtractionPanel] Scene not ready yet');
    }
  }, [isVisible]);

  // Update step status helper
  const updateStepStatus = useCallback((step: WorkflowStep, status: StepStatus['status'], message?: string) => {
    setStepStatuses((prev) => ({
      ...prev,
      [step]: { step, status, message },
    }));
  }, []);

  // Step 1: Analyze Scene
  const handleAnalyzeScene = useCallback(async () => {
    console.log('[KinematicExtractionPanel] Analyze Scene clicked');

    // Check if user has selected a node
    if (!selectedNodeId) {
      console.error('[KinematicExtractionPanel] No node selected');
      updateStepStatus('analyze', 'error', 'Please select a device/unit in the scene tree first (e.g., 9X_110_GEO)');
      return;
    }

    const tree = SceneTreeManager.getInstance();
    const selectedNode = tree.getNode(selectedNodeId);

    if (!selectedNode) {
      console.error('[KinematicExtractionPanel] Selected node not found in tree');
      updateStepStatus('analyze', 'error', 'Selected node not found');
      return;
    }

    console.log('[KinematicExtractionPanel] Selected node:', selectedNode.name);

    // Try to initialize pipeline if not already done
    let activePipeline = pipeline;
    if (!activePipeline) {
      console.log('[KinematicExtractionPanel] Pipeline not initialized, trying to create...');
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();

      if (!scene) {
        console.error('[KinematicExtractionPanel] No scene available');
        updateStepStatus('analyze', 'error', 'No scene loaded. Please load a GLB file first.');
        return;
      }

      activePipeline = new KinematicExtractionPipeline(scene);
      setPipeline(activePipeline);
      console.log('[KinematicExtractionPanel] Pipeline created successfully');
    }

    console.log('[KinematicExtractionPanel] Starting scene analysis for selected node...');
    updateStepStatus('analyze', 'in_progress', `Analyzing ${selectedNode.name}...`);

    try {
      // Resolve Babylon transform node for the selected scene tree node
      const scene = SceneManager.getInstance().getScene();
      let rootBabylonNode: BABYLON.Node | null = null as any;
      if (scene) {
        // Prefer explicit transform node id if present
        const tnId = (selectedNode as any).babylonTransformNodeId ?? (selectedNode as any).babylonNodeId;
        if (tnId) {
          const uid = parseInt(String(tnId));
          rootBabylonNode = scene.transformNodes.find((n) => (n as any).uniqueId === uid) || null;
        }
        // Fallback to mesh unique id if available
        if (!rootBabylonNode && (selectedNode as any).babylonMeshId) {
          const meshUid = parseInt(String((selectedNode as any).babylonMeshId));
          const mesh = scene.getMeshByUniqueId(meshUid);
          rootBabylonNode = (mesh?.parent as any) || (mesh as any) || null;
        }
        // Final fallback by name
        if (!rootBabylonNode) {
          rootBabylonNode = scene.getTransformNodeByName(selectedNode.name) as any;
        }
      }

      if (!rootBabylonNode) {
        updateStepStatus('analyze', 'error', 'Selected node is not present in the scene.');
        return;
      }

      // If the chosen root has no meshes in its subtree, try to find
      // the first descendant that actually contains meshes (handles
      // cases where the user selects a container/asset folder node)
      const getDescMeshesCount = (n: BABYLON.Node) => {
        const desc = (n as any).getDescendants ? (n as any).getDescendants(true) as BABYLON.Node[] : [];
        return desc.filter((d) => d instanceof BABYLON.Mesh).length + (n instanceof BABYLON.Mesh ? 1 : 0);
      };

      if (getDescMeshesCount(rootBabylonNode) === 0) {
        const descendants = (rootBabylonNode as any).getDescendants ? (rootBabylonNode as any).getDescendants(true) as BABYLON.Node[] : [];
        let fallback: BABYLON.Node | null = null;
        for (const d of descendants) {
          if (getDescMeshesCount(d) > 0) {
            fallback = d;
            break;
          }
        }
        if (fallback) {
          console.log('[KinematicExtractionPanel] Selected node had no meshes; falling back to descendant with meshes:', fallback.name);
          rootBabylonNode = fallback;
        }
      }

      // Try multiple parameter sets and pick the result with the most units
      const paramSweep = [
        { minVolume: 1e-8, clusteringDistance: 0.03, similarityThreshold: 0.8 },
        { minVolume: 5e-9, clusteringDistance: 0.02, similarityThreshold: 0.8 },
        { minVolume: 1e-9, clusteringDistance: 0.015, similarityThreshold: 0.8 },
        { minVolume: 1e-9, clusteringDistance: 0.01, similarityThreshold: 0.75 },
      ];

      let bestGraph: ToolGraph | null = null;
      for (const params of paramSweep) {
        try {
          const g = await activePipeline.analyzeScene(params, rootBabylonNode);
          if (!bestGraph || g.units.length > bestGraph.units.length) {
            bestGraph = g;
          }
        } catch (e) {
          console.warn('[KinematicExtractionPanel] Param sweep analyze failed:', e);
        }
      }

      const graph = bestGraph!;

      console.log('[KinematicExtractionPanel] Analysis complete:', graph);
      setToolGraph(graph);

      const fixedCount = graph.units.filter((u) => u.isFixed).length;
      const movingCount = graph.units.filter((u) => !u.isFixed).length;

      if (graph.units.length === 0) {
        updateStepStatus('analyze', 'error', 'No tool units detected under the selected device. Check console for mesh counts and try selecting a deeper node.');
        return;
      }

      updateStepStatus(
        'analyze',
        'complete',
        `Found ${graph.units.length} units (${fixedCount} fixed, ${movingCount} moving)`
      );

      // Auto-select first moving unit
      const firstMoving = graph.units.find((u) => !u.isFixed);
      if (firstMoving) {
        setSelectedUnitId(firstMoving.id);
        console.log('[KinematicExtractionPanel] Auto-selected unit:', firstMoving.name);
      } else {
        console.warn('[KinematicExtractionPanel] No moving units found');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      updateStepStatus('analyze', 'error', `Error: ${errorMsg}`);
      console.error('[KinematicExtractionPanel] Analysis failed:', error);
    }
  }, [pipeline, updateStepStatus, selectedNodeId]);

  // Step 2: Capture Retracted State
  const handleCaptureRetracted = useCallback(async () => {
    if (!pipeline || !selectedUnitId) return;

    updateStepStatus('capture_retracted', 'in_progress', `Capturing retracted state...`);

    try {
      await pipeline.captureUnitState(selectedUnitId, 'retract', {
        samplePoints: true,
        stride: 10,
        maxPoints: 1000,
      });

      const statePairs = pipeline.getStatePairs();
      const statePair = statePairs.get(selectedUnitId);
      const pointCount = statePair?.retracted?.pointCloud.length || 0;

      updateStepStatus('capture_retracted', 'complete', `Captured ${pointCount} points`);
    } catch (error) {
      updateStepStatus('capture_retracted', 'error', `Error: ${(error as Error).message}`);
      console.error('[KinematicExtractionPanel] Retracted capture failed:', error);
    }
  }, [pipeline, selectedUnitId, updateStepStatus]);

  // Step 3: Capture Extended State
  const handleCaptureExtended = useCallback(async () => {
    if (!pipeline || !selectedUnitId) return;

    updateStepStatus('capture_extended', 'in_progress', `Capturing extended state...`);

    try {
      await pipeline.captureUnitState(selectedUnitId, 'advance', {
        samplePoints: true,
        stride: 10,
        maxPoints: 1000,
      });

      const statePairs = pipeline.getStatePairs();
      const statePair = statePairs.get(selectedUnitId);
      const pointCount = statePair?.extended?.pointCloud.length || 0;

      updateStepStatus('capture_extended', 'complete', `Captured ${pointCount} points`);
    } catch (error) {
      updateStepStatus('capture_extended', 'error', `Error: ${(error as Error).message}`);
      console.error('[KinematicExtractionPanel] Extended capture failed:', error);
    }
  }, [pipeline, selectedUnitId, updateStepStatus]);

  // Step 4: Fit Joints
  const handleFitJoints = useCallback(async () => {
    if (!pipeline) return;

    updateStepStatus('fit_joints', 'in_progress', 'Running ICP alignment...');

    try {
      await pipeline.fitJoints({
        minConfidence: 0.5,
        limitSafetyFactor: 1.1,
      });

      const icpResults = pipeline.getICPResults();
      const jointCount = icpResults.size;

      if (jointCount === 0) {
        updateStepStatus('fit_joints', 'error', 'No joints fitted (confidence too low or ICP failed)');
      } else {
        updateStepStatus('fit_joints', 'complete', `Fitted ${jointCount} joints`);
      }
    } catch (error) {
      updateStepStatus('fit_joints', 'error', `Error: ${(error as Error).message}`);
      console.error('[KinematicExtractionPanel] Joint fitting failed:', error);
    }
  }, [pipeline, updateStepStatus]);

  // Step 5: Export JSON
  const handleExport = useCallback(async () => {
    if (!pipeline) return;

    updateStepStatus('export', 'in_progress', 'Generating JSON...');

    try {
      const model = pipeline.exportToJSON();
      setExportedModel(model);

      updateStepStatus('export', 'complete', `Exported ${model.joints.length} joints`);
    } catch (error) {
      updateStepStatus('export', 'error', `Error: ${(error as Error).message}`);
      console.error('[KinematicExtractionPanel] Export failed:', error);
    }
  }, [pipeline, updateStepStatus]);

  // Download JSON file
  const handleDownloadJSON = useCallback(() => {
    if (!exportedModel) return;

    const json = JSON.stringify(exportedModel, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'kinematic_model.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportedModel]);

  // Reset workflow
  const handleReset = useCallback(() => {
    if (pipeline) {
      pipeline.reset();
    }
    setToolGraph(null);
    setSelectedUnitId(null);
    setExportedModel(null);
    setStepStatuses({
      analyze: { step: 'analyze', status: 'pending' },
      capture_retracted: { step: 'capture_retracted', status: 'pending' },
      capture_extended: { step: 'capture_extended', status: 'pending' },
      fit_joints: { step: 'fit_joints', status: 'pending' },
      export: { step: 'export', status: 'pending' },
    });
  }, [pipeline]);

  // Render step status indicator
  const renderStepIndicator = (step: WorkflowStep) => {
    const status = stepStatuses[step];

    switch (status.status) {
      case 'pending':
        return <div className="step-indicator pending" />;
      case 'in_progress':
        return <Loader2 className="step-indicator in-progress animate-spin" size={16} />;
      case 'complete':
        return <CheckCircle className="step-indicator complete" size={16} />;
      case 'error':
        return <AlertCircle className="step-indicator error" size={16} />;
    }
  };

  return (
    <FloatingPanel
      title="Auto Kinematic Extraction"
      subtitle="Generate kinematic model from scene geometry"
      icon={<Zap size={20} />}
      onClose={onClose}
      isVisible={isVisible}
      zIndex={zIndex}
      defaultSize={{ width: 450, height: 700 }}
      className="kinematic-extraction-panel"
    >
      <div className="kinematic-extraction-content">
        {/* Info Banner */}
        <div className="info-banner">
          <Info size={16} />
          <span>
            Select a device in the tree (e.g., 9X_110_GEO), then analyze to identify fixed/moving parts.
          </span>
        </div>

        {/* Workflow Steps */}
        <div className="workflow-steps">
          {/* Step 1: Analyze Scene */}
          <div className={`workflow-step ${stepStatuses.analyze.status}`}>
            <div className="step-header">
              {renderStepIndicator('analyze')}
              <span className="step-title">1. Analyze Selected Device</span>
            </div>
            <p className="step-description">
              Select a device in the scene tree first, then click to detect fixed/moving parts within it.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleAnalyzeScene}
              disabled={stepStatuses.analyze.status === 'in_progress' || !selectedNodeId}
              title={!selectedNodeId ? 'Please select a device in the scene tree first' : 'Analyze selected device'}
            >
              <Scan size={16} />
              Analyze Selected Device
            </button>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const scene = SceneManager.getInstance().getScene();
                  if (!scene || !selectedNodeId) return;
                  const tree = SceneTreeManager.getInstance();
                  const selectedNode = tree.getNode(selectedNodeId);
                  if (!selectedNode) return;
                  const tnId = (selectedNode as any).babylonTransformNodeId ?? (selectedNode as any).babylonNodeId;
                  let root: BABYLON.Node | null = null as any;
                  if (tnId) {
                    const uid = parseInt(String(tnId));
                    root = scene.transformNodes.find((n) => (n as any).uniqueId === uid) || null;
                  }
                  if (!root && (selectedNode as any).babylonMeshId) {
                    const meshUid = parseInt(String((selectedNode as any).babylonMeshId));
                    const mesh = scene.getMeshByUniqueId(meshUid);
                    root = (mesh?.parent as any) || (mesh as any) || null;
                  }
                  root = root || (scene.getTransformNodeByName(selectedNode.name) as any);
                  if (root) downloadTreeReport(root);
                }}
                disabled={!selectedNodeId}
                title={!selectedNodeId ? 'Select a node to generate tree report' : 'Download JSON report of subtree'}
              >
                Generate Tree Report
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const scene = SceneManager.getInstance().getScene();
                  if (!scene || !selectedNodeId) return;
                  downloadMappedSceneTreeReport(scene, selectedNodeId);
                }}
                disabled={!selectedNodeId}
                title={!selectedNodeId ? 'Select a node' : 'Download report mapped via SceneTree children'}
              >
                Generate Mapped Report
              </button>
            </div>
            {stepStatuses.analyze.message && (
              <p className={`step-message ${stepStatuses.analyze.status}`}>
                {stepStatuses.analyze.message}
              </p>
            )}
          </div>

          {/* Unit Selection */}
          {toolGraph && (
            <div className="unit-selection">
              <label htmlFor="unit-select">Select Moving Unit:</label>
              <select
                id="unit-select"
                value={selectedUnitId || ''}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="unit-select"
              >
                <option value="">-- Select Unit --</option>
                {toolGraph.units
                  .filter((u) => !u.isFixed)
                  .map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.type})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Step 2: Capture Retracted */}
          <div className={`workflow-step ${stepStatuses.capture_retracted.status}`}>
            <div className="step-header">
              {renderStepIndicator('capture_retracted')}
              <span className="step-title">2. Capture Retracted State</span>
            </div>
            <p className="step-description">
              Position the selected unit in its home (retracted) position, then capture.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleCaptureRetracted}
              disabled={
                !selectedUnitId ||
                stepStatuses.capture_retracted.status === 'in_progress' ||
                stepStatuses.analyze.status !== 'complete'
              }
            >
              <Camera size={16} />
              Capture Retracted
            </button>
            {stepStatuses.capture_retracted.message && (
              <p className={`step-message ${stepStatuses.capture_retracted.status}`}>
                {stepStatuses.capture_retracted.message}
              </p>
            )}
          </div>

          {/* Step 3: Capture Extended */}
          <div className={`workflow-step ${stepStatuses.capture_extended.status}`}>
            <div className="step-header">
              {renderStepIndicator('capture_extended')}
              <span className="step-title">3. Capture Extended State</span>
            </div>
            <p className="step-description">
              Position the selected unit in its actuated (extended) position, then capture.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleCaptureExtended}
              disabled={
                !selectedUnitId ||
                stepStatuses.capture_extended.status === 'in_progress' ||
                stepStatuses.capture_retracted.status !== 'complete'
              }
            >
              <Camera size={16} />
              Capture Extended
            </button>
            {stepStatuses.capture_extended.message && (
              <p className={`step-message ${stepStatuses.capture_extended.status}`}>
                {stepStatuses.capture_extended.message}
              </p>
            )}
          </div>

          {/* Step 4: Fit Joints */}
          <div className={`workflow-step ${stepStatuses.fit_joints.status}`}>
            <div className="step-header">
              {renderStepIndicator('fit_joints')}
              <span className="step-title">4. Fit Joints with ICP</span>
            </div>
            <p className="step-description">
              Automatically fit joint parameters using Iterative Closest Point alignment.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleFitJoints}
              disabled={
                stepStatuses.fit_joints.status === 'in_progress' ||
                stepStatuses.capture_extended.status !== 'complete'
              }
            >
              <Zap size={16} />
              Fit Joints
            </button>
            {stepStatuses.fit_joints.message && (
              <p className={`step-message ${stepStatuses.fit_joints.status}`}>
                {stepStatuses.fit_joints.message}
              </p>
            )}
          </div>

          {/* Step 5: Export */}
          <div className={`workflow-step ${stepStatuses.export.status}`}>
            <div className="step-header">
              {renderStepIndicator('export')}
              <span className="step-title">5. Export JSON</span>
            </div>
            <p className="step-description">
              Generate and download the kinematic model JSON file.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleExport}
              disabled={
                stepStatuses.export.status === 'in_progress' ||
                stepStatuses.fit_joints.status !== 'complete'
              }
            >
              <Download size={16} />
              Export JSON
            </button>
            {stepStatuses.export.message && (
              <p className={`step-message ${stepStatuses.export.status}`}>
                {stepStatuses.export.message}
              </p>
            )}
          </div>

          {/* Download Button */}
          {exportedModel && (
            <div className="download-section">
              <button className="btn btn-success" onClick={handleDownloadJSON}>
                <Download size={16} />
                Download kinematic_model.json
              </button>
              <p className="download-info">
                {exportedModel.joints.length} joints, {exportedModel.actuatorProgram.channels.length} channels
              </p>
            </div>
          )}
        </div>

        {/* Reset Button */}
        <div className="reset-section">
          <button className="btn btn-secondary" onClick={handleReset}>
            <RefreshCw size={16} />
            Reset Workflow
          </button>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        .kinematic-extraction-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          height: 100%;
          overflow-y: auto;
        }

        .info-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.375rem;
          color: #93c5fd;
          font-size: 0.875rem;
        }

        .workflow-steps {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .workflow-step {
          padding: 1rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          transition: all 0.2s;
        }

        .workflow-step.complete {
          border-color: rgba(34, 197, 94, 0.3);
          background: rgba(34, 197, 94, 0.05);
        }

        .workflow-step.error {
          border-color: rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.05);
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .step-title {
          font-weight: 600;
          font-size: 0.95rem;
          color: #e5e7eb;
        }

        .step-description {
          font-size: 0.85rem;
          color: #9ca3af;
          margin-bottom: 0.75rem;
        }

        .step-indicator {
          flex-shrink: 0;
        }

        .step-indicator.pending {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }

        .step-indicator.in-progress {
          color: #60a5fa;
        }

        .step-indicator.complete {
          color: #22c55e;
        }

        .step-indicator.error {
          color: #ef4444;
        }

        .step-message {
          margin-top: 0.5rem;
          font-size: 0.85rem;
          padding: 0.5rem;
          border-radius: 0.25rem;
          background: rgba(255, 255, 255, 0.05);
        }

        .step-message.complete {
          color: #22c55e;
        }

        .step-message.error {
          color: #ef4444;
        }

        .unit-selection {
          padding: 1rem;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .unit-selection label {
          font-size: 0.875rem;
          font-weight: 500;
          color: #e5e7eb;
        }

        .unit-select {
          padding: 0.5rem;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 0.375rem;
          color: #e5e7eb;
          font-size: 0.875rem;
        }

        .btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-success {
          background: #22c55e;
          color: white;
        }

        .btn-success:hover:not(:disabled) {
          background: #16a34a;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: #e5e7eb;
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
        }

        .download-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 1rem;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 0.5rem;
        }

        .download-info {
          font-size: 0.85rem;
          color: #86efac;
          text-align: center;
        }

        .reset-section {
          margin-top: auto;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </FloatingPanel>
  );
};
