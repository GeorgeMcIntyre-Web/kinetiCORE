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
import { KinematicExtractionPipeline, type ToolGraph } from '../../babylon/pipeline/KinematicExtractionPipeline';

import type { KinematicModelExport } from '../../babylon/io/Schemas';
import { useEditorStore } from '../store/editorStore';

type WorkflowStep = 'analyze' | 'detect_joints' | 'export';

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
  const [stepStatuses, setStepStatuses] = useState<Record<WorkflowStep, StepStatus>>({
    analyze: { step: 'analyze', status: 'pending' },
    detect_joints: { step: 'detect_joints', status: 'pending' },
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

      console.log('[KinematicExtractionPanel] Resolved Babylon node:', rootBabylonNode.name, 'uniqueId:', rootBabylonNode.uniqueId);

      // Use statistical pairing analysis
      console.log('[KinematicExtractionPanel] Using statistical pairing analysis');

      const graph = await activePipeline.analyzeScene(
        { minConfidence: 0.5 },
        rootBabylonNode as BABYLON.TransformNode
      );

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
        `Found ${graph.units.length} units (${fixedCount} fixed, ${movingCount} moving). Ready to detect joints.`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      updateStepStatus('analyze', 'error', `Error: ${errorMsg}`);
      console.error('[KinematicExtractionPanel] Analysis failed:', error);
    }
  }, [pipeline, updateStepStatus, selectedNodeId]);

  // Step 2: Detect Joints (Statistical)
  const handleDetectJoints = useCallback(async () => {
    if (!pipeline || !toolGraph) return;

    updateStepStatus('detect_joints', 'in_progress', 'Detecting joints statistically...');

    try {
      const joints = await pipeline.detectJointsStatistically({ minConfidence: 0.3 });

      if (joints.length === 0) {
        updateStepStatus('detect_joints', 'error', 'No joints detected. Ensure the GLB contains multiple states (siblings or keyframes).');
      } else {
        updateStepStatus('detect_joints', 'complete', `Detected ${joints.length} joints.`);
      }
    } catch (error) {
      updateStepStatus('detect_joints', 'error', `Error: ${(error as Error).message}`);
      console.error('[KinematicExtractionPanel] Joint detection failed:', error);
    }
  }, [pipeline, toolGraph, updateStepStatus]);

  // Step 3: Export JSON
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
      // pipeline.reset(); // If reset exists
    }
    setToolGraph(null);
    setExportedModel(null);
    setStepStatuses({
      analyze: { step: 'analyze', status: 'pending' },
      detect_joints: { step: 'detect_joints', status: 'pending' },
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

            {stepStatuses.analyze.message && (
              <p className={`step-message ${stepStatuses.analyze.status}`}>
                {stepStatuses.analyze.message}
              </p>
            )}
          </div>

          {/* Step 2: Detect Joints */}
          <div className={`workflow-step ${stepStatuses.detect_joints.status}`}>
            <div className="step-header">
              {renderStepIndicator('detect_joints')}
              <span className="step-title">2. Detect Joints (Statistical)</span>
            </div>
            <p className="step-description">
              Automatically detect joints by analyzing statistical variations in point clouds across the unit hierarchy.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleDetectJoints}
              disabled={
                !toolGraph ||
                stepStatuses.detect_joints.status === 'in_progress' ||
                stepStatuses.analyze.status !== 'complete'
              }
            >
              <Zap size={16} />
              Detect Joints
            </button>
            {stepStatuses.detect_joints.message && (
              <p className={`step-message ${stepStatuses.detect_joints.status}`}>
                {stepStatuses.detect_joints.message}
              </p>
            )}
          </div>

          {/* Step 3: Export */}
          <div className={`workflow-step ${stepStatuses.export.status}`}>
            <div className="step-header">
              {renderStepIndicator('export')}
              <span className="step-title">3. Export JSON</span>
            </div>
            <p className="step-description">
              Generate and download the kinematic model JSON file.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleExport}
              disabled={
                stepStatuses.export.status === 'in_progress' ||
                stepStatuses.detect_joints.status !== 'complete'
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
