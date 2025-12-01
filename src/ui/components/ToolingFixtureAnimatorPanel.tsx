/**
 * ToolingFixtureAnimatorPanel - Auto tooling kinematics → valves → animation
 * Owner: Cursor Agent (integration layer)
 *
 * Guided UI to capture retracted/extended states, fit joints via ICP,
 * and play demo animation for a loaded GLB fixture.
 */

import React, { useState, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Play, Loader2, AlertCircle, CheckCircle, Camera, Cog, RotateCcw, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { SceneManager } from '../../scene/SceneManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import './ToolingFixtureAnimatorPanel.css';
import {
  ToolingFixtureAnimator,
  type CaptureWorkflowState,
  type MovingUnitInfo,
  type JointFitResultInfo,
  type AutoFitResult,
} from '../../babylon/pipeline/ToolingFixtureAnimator';
import { buildToolingStructureFromScene, buildGeometryIndex } from '../../domain/tooling/babylonAdapter';
import { runUnitsV2Pipeline } from '../../domain/tooling/unitsV2Pipeline';
import { ToolingKinematicsAdapter, type KinematicsAdapterContext } from '../../kinematics/toolingKinematicsAdapter';
import { useEditorStore } from '../store/editorStore';
import { toast } from './ToastNotifications';

interface ToolingFixtureAnimatorPanelProps {
  onClose?: () => void;
  isVisible?: boolean;
  zIndex?: number;
}

export const ToolingFixtureAnimatorPanel: React.FC<ToolingFixtureAnimatorPanelProps> = ({
  onClose,
  isVisible = true,
  zIndex = 1004,
}) => {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const [animator, setAnimator] = useState<ToolingFixtureAnimator | null>(null);
  const [workflowState, setWorkflowState] = useState<CaptureWorkflowState>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [movingUnits, setMovingUnits] = useState<MovingUnitInfo[]>([]);
  const [jointDetails, setJointDetails] = useState<JointFitResultInfo[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    jointCount: number;
    channelCount: number;
    highErrorJoints: Array<{ id: string; error?: number }>;
  } | null>(null);
  const [autoFitResult, setAutoFitResult] = useState<AutoFitResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  /**
   * Resolve root node from selection or scene.
   */
  const getRootNode = useCallback((): BABYLON.TransformNode | null => {
    const scene = SceneManager.getInstance().getScene();
    if (!scene) {
      return null;
    }

    // If node selected, use it
    if (selectedNodeId) {
      const tree = SceneTreeManager.getInstance();
      const selectedNode = tree.getNode(selectedNodeId);
      if (selectedNode) {
        const tnId = (selectedNode as any).babylonTransformNodeId ?? (selectedNode as any).babylonNodeId;
        if (tnId) {
          const uid = parseInt(String(tnId));
          const transformNode = scene.transformNodes.find((n) => (n as any).uniqueId === uid);
          if (transformNode) {
            return transformNode;
          }
        }
      }
    }

    // Fallback: use scene root (first root node)
    const rootNodes = scene.getNodes().filter(n => !n.parent && n instanceof BABYLON.TransformNode);
    return (rootNodes[0] as BABYLON.TransformNode) || null;
  }, [selectedNodeId]);

  /**
   * Step 1: Analyze fixture to detect units.
   */
  const handleAnalyze = useCallback(async () => {
    setLastError(null);
    const scene = SceneManager.getInstance().getScene();
    if (!scene) {
      toast.error('No scene loaded. Please load a GLB file first.');
      return;
    }

    const rootNode = getRootNode();
    if (!rootNode) {
      toast.error('No root node found. Please select a fixture in the scene tree.');
      return;
    }

    setIsProcessing(true);
    try {
      const newAnimator = new ToolingFixtureAnimator({ scene, rootNode });
      const result = await newAnimator.analyzeFixture();

      if (!result.success) {
        setLastError(result.error || 'Analysis failed');
        toast.error(result.error || 'Analysis failed');
        setIsProcessing(false);
        return;
      }

      setAnimator(newAnimator);
      setWorkflowState(newAnimator.getWorkflowState());
      setMovingUnits(newAnimator.getMovingUnitsInfo());

      console.log('[ToolingFixtureAnimatorPanel] Analysis complete:', result);
      toast.success(`Found ${result.fixedUnits.length} fixed + ${result.movingUnits.length} moving units`);

      if (result.movingUnits.length === 0) {
        toast.warning('No moving units detected. Check fixture structure.');
      }
    } catch (error: any) {
      console.error('[ToolingFixtureAnimatorPanel] Analysis failed:', error);
      setLastError(error.message || 'Unknown error');
      toast.error(`Analysis failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [getRootNode]);

  /**
   * Step 2a: Capture retracted state.
   */
  const handleCaptureRetracted = useCallback(async () => {
    setLastError(null);
    if (!animator) {
      toast.error('Must analyze fixture first');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await animator.captureRetractedState();
      setWorkflowState(animator.getWorkflowState());
      setMovingUnits(animator.getMovingUnitsInfo());

      if (result.success) {
        toast.success(`Retracted state captured: ${result.totalPoints} points`);
      } else {
        setLastError(result.error || 'Failed to capture retracted state');
        toast.error(result.error || 'Failed to capture retracted state');
      }
    } catch (error: any) {
      console.error('[ToolingFixtureAnimatorPanel] Capture failed:', error);
      setLastError(error.message || 'Unknown error');
      toast.error(`Capture failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [animator]);

  /**
   * Step 2b: Capture extended state.
   */
  const handleCaptureExtended = useCallback(async () => {
    setLastError(null);
    if (!animator) {
      toast.error('Must analyze fixture first');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await animator.captureExtendedState();
      setWorkflowState(animator.getWorkflowState());
      setMovingUnits(animator.getMovingUnitsInfo());

      if (result.success) {
        toast.success(`Extended state captured: ${result.totalPoints} points`);
      } else {
        setLastError(result.error || 'Failed to capture extended state');
        toast.error(result.error || 'Failed to capture extended state');
      }
    } catch (error: any) {
      console.error('[ToolingFixtureAnimatorPanel] Capture failed:', error);
      setLastError(error.message || 'Unknown error');
      toast.error(`Capture failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [animator]);

  /**
   * Step 3: Fit joints via ICP.
   */
  const handleFitJoints = useCallback(async () => {
    setLastError(null);
    if (!animator) {
      toast.error('Must capture both states first');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await animator.fitJoints();
      setWorkflowState(animator.getWorkflowState());
      setJointDetails(result.details);

      if (!result.success) {
        // Show detailed failure reason
        const failedUnits = result.details.filter(d => !d.success);
        const failureReasons = failedUnits.map(d => `${d.unitName}: ${d.reason}`).join('; ');
        const error = result.error || failureReasons || 'No joints fitted';
        setLastError(error);
        toast.error(error);
        setIsProcessing(false);
        return;
      }

      // Setup animation after fitting
      animator.setupAnimation();
      setWorkflowState(animator.getWorkflowState());

      const summaryData = animator.getSummary();
      setSummary(summaryData);

      // Show success with angle info
      const successfulJoints = result.details.filter(d => d.success);
      const angleInfo = successfulJoints.map(j => `${j.unitName}: ${j.angleDeg.toFixed(1)}°`).join(', ');
      toast.success(`Fitted ${result.jointCount} joints (${angleInfo}). Ready to play!`);

      // Register chains with KinematicsManager
      const scene = SceneManager.getInstance().getScene();
      const rootNode = getRootNode();
      if (scene && rootNode) {
        try {
          const structure = buildToolingStructureFromScene(scene, rootNode);
          const geometryIndex = await buildGeometryIndex(structure, scene, {
            stride: 10,
            maxPointsPerNode: 5000,
            useWorldSpace: true,
          });
          const pipelineResult = runUnitsV2Pipeline(structure, geometryIndex, {
            includeJointPairs: true,
            includeMotionJoints: false,
          });

          const adapterContext: KinematicsAdapterContext = {
            getNodeWorldMatrix: (nodeId: string) => {
              const mesh = scene.getMeshByUniqueId(parseInt(nodeId));
              if (mesh) {
                mesh.computeWorldMatrix(true);
                return mesh.getWorldMatrix();
              }
              const tn = scene.transformNodes.find(tn => String(tn.uniqueId) === nodeId);
              if (tn) {
                tn.computeWorldMatrix(true);
                return tn.getWorldMatrix();
              }
              const byName = scene.getTransformNodeByName(nodeId) || scene.getMeshByName(nodeId);
              if (byName) {
                byName.computeWorldMatrix(true);
                return byName.getWorldMatrix();
              }
              return null;
            },
          };

          // Register from auto-fitted joints (primary method for U112 GOLD workflow)
          try {
            const jointsOut = animator.getJoints();
            if (jointsOut.length > 0) {
              const chainId = ToolingKinematicsAdapter.registerSingleChainFromAnimator(
                String(rootNode.uniqueId),
                jointsOut as any,
                adapterContext
              );
              if (chainId) {
                console.log('[ToolingFixtureAnimatorPanel] Successfully registered tooling chain:', chainId);
                toast.success(`Registered ${jointsOut.length} joint(s) - open Motion Panel to control`);
              } else {
                console.warn('[ToolingFixtureAnimatorPanel] Registration returned null chainId');
              }
            }
          } catch (error: any) {
            console.error('[ToolingFixtureAnimatorPanel] Failed to register animator chain:', error);
            toast.warning(`Joint registration failed: ${error.message}. Motion Panel may not show controls.`);
          }

          // Also try to register from pipeline output (secondary method)
          try {
            if (pipelineResult.motionJoints && pipelineResult.motionJoints.length > 0) {
              const chainIds = ToolingKinematicsAdapter.registerChains(pipelineResult, adapterContext);
              if (chainIds.length > 0) {
                console.log('[ToolingFixtureAnimatorPanel] Also registered pipeline chains:', chainIds);
              }
            }
          } catch (error: any) {
            console.warn('[ToolingFixtureAnimatorPanel] Pipeline chain registration failed (non-critical):', error);
          }
        } catch (error: any) {
          console.error('[ToolingFixtureAnimatorPanel] Failed to build structure for registration:', error);
        }
      }

      if (summaryData.highErrorJoints.length > 0) {
        toast.warning(`${summaryData.highErrorJoints.length} joints have high RMS errors`);
      }
    } catch (error: any) {
      console.error('[ToolingFixtureAnimatorPanel] Joint fitting failed:', error);
      setLastError(error.message || 'Unknown error');
      toast.error(`Joint fitting failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [animator, getRootNode]);

  /**
   * Play demo cycle.
   */
  const handlePlayDemo = useCallback(async () => {
    if (!animator) {
      toast.error('Must complete setup first');
      return;
    }

    setIsPlaying(true);
    try {
      await animator.playDemoCycle();
      toast.success('Demo cycle complete');
    } catch (error: any) {
      console.error('[ToolingFixtureAnimatorPanel] Playback failed:', error);
      toast.error(`Playback failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsPlaying(false);
    }
  }, [animator]);

  /**
   * ONE-CLICK AUTO-FIT: Analyze and register all detected joints automatically.
   * This is the PRIMARY workflow - no manual state capture required.
   */
  const handleAutoFit = useCallback(async () => {
    setLastError(null);
    setAutoFitResult(null);

    const scene = SceneManager.getInstance().getScene();
    if (!scene) {
      toast.error('No scene loaded. Please load a GLB file first.');
      return;
    }

    const rootNode = getRootNode();
    if (!rootNode) {
      toast.error('No root node found. Please select a fixture in the scene tree.');
      return;
    }

    setIsProcessing(true);
    try {
      const newAnimator = new ToolingFixtureAnimator({ scene, rootNode });
      const result = await newAnimator.autoFitAllToolingJoints();

      setAutoFitResult(result);
      setAnimator(newAnimator);
      setWorkflowState(result.success ? 'joints_fitted' : 'idle');

      if (result.success) {
        toast.success(result.message || `Auto-fitted ${result.jointsCreated} joint(s)`);
      } else {
        setLastError(result.message || 'Auto-fit failed');
        toast.error(result.message || 'Auto-fit failed');
      }
    } catch (error: any) {
      console.error('[ToolingFixtureAnimatorPanel] Auto-fit failed:', error);
      setLastError(error.message || 'Unknown error');
      toast.error(`Auto-fit failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [getRootNode]);

  /**
   * Reset workflow.
   */
  const handleReset = useCallback(() => {
    setAnimator(null);
    setWorkflowState('idle');
    setMovingUnits([]);
    setJointDetails([]);
    setLastError(null);
    setSummary(null);
    setAutoFitResult(null);
    setShowAdvanced(false);
    toast.info('Workflow reset');
  }, []);

  /**
   * Get step status for visual feedback.
   */
  const getStepStatus = (step: number): 'pending' | 'active' | 'complete' => {
    switch (step) {
      case 1: // Analyze
        if (workflowState === 'idle') return 'active';
        return 'complete';
      case 2: // Capture Retracted
        if (workflowState === 'idle') return 'pending';
        if (workflowState === 'analyzed') return 'active';
        return 'complete';
      case 3: // Capture Extended
        if (['idle', 'analyzed'].includes(workflowState)) return 'pending';
        if (workflowState === 'retracted_captured') return 'active';
        return 'complete';
      case 4: // Fit Joints
        if (['idle', 'analyzed', 'retracted_captured'].includes(workflowState)) return 'pending';
        if (workflowState === 'extended_captured') return 'active';
        return 'complete';
      case 5: // Play
        if (workflowState !== 'ready_to_play') return 'pending';
        return 'active';
      default:
        return 'pending';
    }
  };

  const StepIndicator = ({ step, label }: { step: number; label: string }) => {
    const status = getStepStatus(step);
    const colors = {
      pending: { bg: '#333', border: '#555', text: '#888' },
      active: { bg: '#00aaff', border: '#00aaff', text: '#fff' },
      complete: { bg: '#00aa00', border: '#00aa00', text: '#fff' },
    };
    const c = colors[status];

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: c.bg,
            border: `2px solid ${c.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            color: c.text,
          }}
        >
          {status === 'complete' ? '✓' : step}
        </div>
        <span style={{ fontSize: '12px', color: status === 'pending' ? '#888' : '#fff' }}>
          {label}
        </span>
      </div>
    );
  };

  return (
    <FloatingPanel
      title="Tooling Fixture Animator"
      subtitle="Guided state capture and joint fitting"
      icon={<Play size={20} />}
      onClose={onClose}
      isVisible={isVisible}
      zIndex={zIndex}
      defaultSize={{ width: 420, height: 600 }}
      data-testid="tooling-animator-panel"
    >
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* ONE-CLICK AUTO-FIT - PRIMARY WORKFLOW */}
        <div style={{ padding: '12px', background: 'rgba(0, 200, 100, 0.1)', border: '1px solid rgba(0, 200, 100, 0.3)', borderRadius: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Zap size={16} color="#00cc66" />
            <strong style={{ color: '#00cc66' }}>One-Click Auto-Fit</strong>
          </div>
          <p style={{ fontSize: '12px', margin: '0 0 12px 0', lineHeight: '1.5', color: '#ccc' }}>
            Automatically detect and register all tooling joints from embedded fixture states.
            No manual movement required.
          </p>
          <button
            data-testid="auto-fit-tooling-joints-button"
            onClick={handleAutoFit}
            disabled={isProcessing || (workflowState !== 'idle' && workflowState !== 'analyzed')}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: (workflowState === 'idle' || workflowState === 'analyzed') && !isProcessing ? '#00cc66' : '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: (workflowState === 'idle' || workflowState === 'analyzed') && !isProcessing ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isProcessing ? (
              <><Loader2 size={16} className="spin" /> Auto-Fitting...</>
            ) : (
              <><Zap size={16} /> Analyze & Auto-Fit Joints</>
            )}
          </button>
        </div>

        {/* Auto-Fit Result */}
        {autoFitResult && (
          <div style={{
            padding: '10px',
            background: autoFitResult.success ? 'rgba(0, 200, 100, 0.1)' : 'rgba(255, 100, 100, 0.1)',
            border: `1px solid ${autoFitResult.success ? 'rgba(0, 200, 100, 0.3)' : 'rgba(255, 100, 100, 0.3)'}`,
            borderRadius: '4px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              {autoFitResult.success ? <CheckCircle size={14} color="#00cc66" /> : <AlertCircle size={14} color="#ff6666" />}
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: autoFitResult.success ? '#00cc66' : '#ff6666' }}>
                {autoFitResult.success ? 'Auto-Fit Complete' : 'Auto-Fit Failed'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#ccc', lineHeight: '1.5' }}>
              {autoFitResult.message}
            </div>
            {autoFitResult.success && (
              <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                Units: {autoFitResult.totalUnits} | With Joints: {autoFitResult.unitsWithJoints} | Joints Created: {autoFitResult.jointsCreated}
              </div>
            )}
          </div>
        )}

        {/* Selected Node Info */}
        {selectedNodeId && (
          <div style={{ padding: '8px', background: 'rgba(0, 255, 255, 0.1)', borderRadius: '4px' }}>
            <div style={{ fontSize: '12px', color: '#00ffff' }}>
              Selected: {SceneTreeManager.getInstance().getNode(selectedNodeId)?.name || selectedNodeId}
            </div>
          </div>
        )}

        {/* Advanced / Manual Debug Section - Collapsed by default */}
        <div style={{ borderTop: '1px solid #333', paddingTop: '12px' }}>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'transparent',
              color: '#888',
              border: '1px solid #444',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Advanced / Manual Debug
          </button>
        </div>

        {showAdvanced && (
          <>
            {/* Manual Workflow Steps */}
            <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                Manual state capture workflow (for debugging):
              </div>
              <StepIndicator step={1} label="Analyze Fixture" />
              <StepIndicator step={2} label="Capture Retracted State" />
              <StepIndicator step={3} label="Capture Extended State" />
              <StepIndicator step={4} label="Fit Joints (ICP)" />
              <StepIndicator step={5} label="Play Animation" />
            </div>

            {/* Step 1: Analyze */}
            <button
              data-testid="animator-analyze-button"
              onClick={handleAnalyze}
              disabled={isProcessing || workflowState !== 'idle'}
              style={{
                padding: '10px 16px',
                background: workflowState === 'idle' ? '#00aaff' : '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: workflowState === 'idle' && !isProcessing ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isProcessing && workflowState === 'idle' ? (
                <><Loader2 size={14} className="spin" /> Analyzing...</>
              ) : (
                <><Cog size={14} /> 1. Analyze Fixture</>
              )}
            </button>

            {/* Step 2a: Capture Retracted */}
            <button
              data-testid="capture-retracted-button"
              onClick={handleCaptureRetracted}
              disabled={isProcessing || workflowState !== 'analyzed'}
              style={{
                padding: '10px 16px',
                background: workflowState === 'analyzed' ? '#00aaff' : '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: workflowState === 'analyzed' && !isProcessing ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isProcessing && workflowState === 'analyzed' ? (
                <><Loader2 size={14} className="spin" /> Capturing...</>
              ) : (
                <><Camera size={14} /> 2a. Capture Retracted (Home)</>
              )}
            </button>

            {/* Instructions: Move clamp manually before capturing extended state */}
            {workflowState === 'retracted_captured' && movingUnits.length > 0 && (
              <div style={{
                padding: '10px',
                background: 'rgba(255, 170, 0, 0.1)',
                border: '1px solid rgba(255, 170, 0, 0.3)',
                borderRadius: '4px',
              }}>
                <div style={{ fontSize: '11px', color: '#ffaa00', marginBottom: '8px' }}>
                  <strong>⚠️ Move the clamp before capturing!</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#ccc', lineHeight: '1.5' }}>
                  Manually move the clamp to the fully extended/open position using:
                  <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                    <li>The transform gizmo in the 3D viewport</li>
                    <li>The Motion Panel joint slider (if joints already exist)</li>
                  </ul>
                </div>
                <div style={{ fontSize: '10px', color: '#888', marginTop: '8px', fontStyle: 'italic' }}>
                  Then click "Capture Extended" below.
                </div>
              </div>
            )}

            {/* Step 2b: Capture Extended */}
            <button
              data-testid="capture-extended-button"
              onClick={handleCaptureExtended}
              disabled={isProcessing || workflowState !== 'retracted_captured'}
              style={{
                padding: '10px 16px',
                background: workflowState === 'retracted_captured' ? '#ffaa00' : '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: workflowState === 'retracted_captured' && !isProcessing ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isProcessing && workflowState === 'retracted_captured' ? (
                <><Loader2 size={14} className="spin" /> Capturing...</>
              ) : (
                <><Camera size={14} /> 2b. Capture Extended (Actuated)</>
              )}
            </button>

            {/* Step 3: Fit Joints */}
            <button
              data-testid="fit-joints-button"
              onClick={handleFitJoints}
              disabled={isProcessing || workflowState !== 'extended_captured'}
              style={{
                padding: '10px 16px',
                background: workflowState === 'extended_captured' ? '#00aa00' : '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: workflowState === 'extended_captured' && !isProcessing ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isProcessing && workflowState === 'extended_captured' ? (
                <><Loader2 size={14} className="spin" /> Fitting...</>
              ) : (
                <><Cog size={14} /> 3. Fit Joints (ICP)</>
              )}
            </button>

            {/* Step 4: Play Demo */}
            <button
              onClick={handlePlayDemo}
              disabled={isPlaying || workflowState !== 'ready_to_play'}
              style={{
                padding: '12px 16px',
                background: workflowState === 'ready_to_play' ? '#00aaff' : '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: workflowState === 'ready_to_play' && !isPlaying ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isPlaying ? (
                <><Loader2 size={16} className="spin" /> Playing...</>
              ) : (
                <><Play size={16} /> 4. Play Demo</>
              )}
            </button>
          </>
        )}

        {/* Error Display */}
        {lastError && (
          <div style={{
            padding: '12px',
            background: 'rgba(255, 50, 50, 0.15)',
            borderRadius: '4px',
            border: '1px solid #ff5555',
            boxShadow: '0 2px 8px rgba(255, 50, 50, 0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertCircle size={16} color="#ff5555" />
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ff5555' }}>Error</span>
            </div>
            <div style={{ fontSize: '12px', color: '#ffaaaa', lineHeight: '1.5' }}>
              {lastError}
            </div>
            {/* Actionable hints based on error type */}
            {lastError.includes('No motion') && (
              <div style={{ fontSize: '11px', color: '#ffcc00', marginTop: '10px', background: 'rgba(255, 204, 0, 0.1)', padding: '8px', borderRadius: '4px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>No motion detected between states</div>
                <div style={{ fontStyle: 'normal', lineHeight: '1.6' }}>
                  Make sure you:
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    <li>Capture Retracted with the clamp fully closed</li>
                    <li>Manually move the clamp in the 3D view (gizmo or Motion Panel)</li>
                    <li>Then capture Extended with the clamp fully open</li>
                  </ul>
                </div>
                {movingUnits.length <= 1 && (
                  <div style={{ marginTop: '8px', fontSize: '10px', color: '#aaa' }}>
                    This fixture may be purely static (no moving units), or the clamp was not actually moved between captures.
                  </div>
                )}
              </div>
            )}
            {lastError.includes('No units detected') && (
              <div style={{ fontSize: '11px', color: '#ffcc00', marginTop: '8px', fontStyle: 'italic' }}>
                💡 Tip: Ensure the fixture contains UNIT_* named nodes.
              </div>
            )}
            {lastError.includes('No points captured') && (
              <div style={{ fontSize: '11px', color: '#ffcc00', marginTop: '8px', fontStyle: 'italic' }}>
                💡 Tip: Check that moving units contain visible mesh geometry.
              </div>
            )}
            <button
              onClick={() => setLastError(null)}
              style={{
                marginTop: '8px',
                padding: '4px 8px',
                background: 'transparent',
                color: '#ff8888',
                border: '1px solid #ff5555',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Moving Units Info */}
        {movingUnits.length > 0 && (
          <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
              Moving Units ({movingUnits.length})
            </div>
            {movingUnits.map((unit) => (
              <div key={unit.id} style={{ fontSize: '11px', marginBottom: '4px', paddingLeft: '8px' }} data-testid={`moving-unit-${unit.id}`}>
                <span style={{ color: '#00ffff' }} data-testid="moving-unit-indicator">{unit.name}</span>
                <span style={{ color: '#888', marginLeft: '8px' }}>
                  R: {unit.retractedPointCount} pts | E: {unit.extendedPointCount} pts
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Joint Details */}
        {jointDetails.length > 0 && (
          <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
              Joint Fitting Results
            </div>
            {jointDetails.map((joint) => (
              <div key={joint.unitId} style={{
                fontSize: '11px',
                marginBottom: '8px',
                paddingLeft: '8px',
                borderLeft: joint.success ? '2px solid #00aa00' : '2px solid #ff5555',
              }} data-testid={`joint-result-${joint.unitId}`}>
                <div style={{ color: joint.success ? '#00ffaa' : '#ffaa00' }}>
                  {joint.unitName} - {joint.success ? joint.jointType.toUpperCase() : 'FAILED'}
                </div>
                {joint.success ? (
                  <div style={{ color: '#888', fontSize: '10px' }} data-testid={`joint-angle-${joint.unitId.toLowerCase()}`}>
                    Angle: {joint.angleDeg.toFixed(1)}° | Confidence: {(joint.confidence * 100).toFixed(0)}% | RMS: {joint.rmsErrorMm.toFixed(1)}mm
                  </div>
                ) : (
                  <div style={{ color: '#ff8888', fontSize: '10px' }}>
                    {joint.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <CheckCircle size={16} color="#00ff00" />
              <strong>Results</strong>
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
              <div data-testid="fitted-joints-count">Joints: {summary.jointCount}</div>
              <div>Channels: {summary.channelCount}</div>
              {summary.highErrorJoints.length > 0 && (
                <div style={{ color: '#ffaa00', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={14} />
                    High RMS errors:
                  </div>
                  {summary.highErrorJoints.map((j) => (
                    <div key={j.id} style={{ marginLeft: '18px', fontSize: '12px' }}>
                      {j.id}: {(j.error! * 1000).toFixed(2)}mm
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reset Button */}
        {workflowState !== 'idle' && (
          <button
            onClick={handleReset}
            disabled={isProcessing || isPlaying}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: '#888',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <RotateCcw size={12} /> Reset Workflow
          </button>
        )}

        {/* Console Log Note */}
        <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', marginTop: '4px' }}>
          Check browser console for detailed ICP logs
        </div>
      </div>

    </FloatingPanel>
  );
};
