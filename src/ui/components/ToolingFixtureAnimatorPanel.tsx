/**
 * ToolingFixtureAnimatorPanel - Auto tooling kinematics → valves → animation
 * Owner: Cursor Agent (integration layer)
 *
 * Simple UI to trigger auto-kinematics extraction and play demo animation
 * for a loaded GLB fixture.
 */

import React, { useState, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Play, Loader2, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { SceneManager } from '../../scene/SceneManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { ToolingFixtureAnimator } from '../../babylon/pipeline/ToolingFixtureAnimator';
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
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [summary, setSummary] = useState<{
    jointCount: number;
    channelCount: number;
    highErrorJoints: Array<{ id: string; error?: number }>;
  } | null>(null);

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
   * Prepare animator (run extraction if needed).
   */
  const handlePrepare = useCallback(async () => {
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

    setIsPreparing(true);
    try {
      const newAnimator = new ToolingFixtureAnimator({
        scene,
        rootNode,
        // Optionally provide toolingJson here if precomputed
      });

      await newAnimator.prepare();
      setAnimator(newAnimator);

      const summaryData = newAnimator.getSummary();
      setSummary(summaryData);

      console.log('[ToolingFixtureAnimatorPanel] Preparation complete:', summaryData);
      toast.success(`Setup complete: ${summaryData.jointCount} joints created`);

      if (summaryData.highErrorJoints.length > 0) {
        console.warn(
          `[ToolingFixtureAnimatorPanel] High RMS errors detected:`,
          summaryData.highErrorJoints
        );
        toast.warning(
          `${summaryData.highErrorJoints.length} joints have high RMS errors (>1cm)`
        );
      }
    } catch (error: any) {
      console.error('[ToolingFixtureAnimatorPanel] Preparation failed:', error);
      toast.error(`Preparation failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsPreparing(false);
    }
  }, [getRootNode]);

  /**
   * Play demo cycle.
   */
  const handlePlayDemo = useCallback(async () => {
    if (!animator) {
      toast.error('Must prepare animator first');
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
   * Handle "Auto-fit joints & play demo" button (all-in-one).
   */
  const handleAutoFitAndPlay = useCallback(async () => {
    // First prepare
    await handlePrepare();

    // Then play (if prepare succeeded)
    if (animator || summary) {
      // Small delay to let prepare finish
      setTimeout(() => {
        handlePlayDemo();
      }, 500);
    }
  }, [handlePrepare, handlePlayDemo, animator, summary]);

  return (
    <FloatingPanel
      title="Tooling Fixture Animator"
      subtitle="Auto-fit joints from GLB and play demo animation"
      icon={<Play size={20} />}
      onClose={onClose}
      isVisible={isVisible}
      zIndex={zIndex}
      defaultSize={{ width: 400, height: 500 }}
    >
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Instructions */}
        <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Info size={16} />
            <strong>Instructions</strong>
          </div>
          <p style={{ fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
            Select a fixture root node in the scene tree, then click the button below to:
          </p>
          <ol style={{ fontSize: '13px', margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>Run auto-kinematics extraction</li>
            <li>Convert to joint definitions</li>
            <li>Create ValveBank channels</li>
            <li>Play extend/retract demo</li>
          </ol>
        </div>

        {/* Selected Node Info */}
        {selectedNodeId && (
          <div style={{ padding: '8px', background: 'rgba(0, 255, 255, 0.1)', borderRadius: '4px' }}>
            <div style={{ fontSize: '12px', color: '#00ffff' }}>
              Selected: {SceneTreeManager.getInstance().getNode(selectedNodeId)?.name || selectedNodeId}
            </div>
          </div>
        )}

        {/* Main Action Button */}
        <button
          onClick={handleAutoFitAndPlay}
          disabled={isPreparing || isPlaying}
          style={{
            padding: '12px 24px',
            background: isPreparing || isPlaying ? '#444' : '#00aaff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isPreparing || isPlaying ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {isPreparing ? (
            <>
              <Loader2 size={16} className="spin" />
              Preparing...
            </>
          ) : isPlaying ? (
            <>
              <Loader2 size={16} className="spin" />
              Playing...
            </>
          ) : (
            <>
              <Play size={16} />
              Auto-fit joints & play demo
            </>
          )}
        </button>

        {/* Separate Prepare/Play Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handlePrepare}
            disabled={isPreparing || isPlaying}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: isPreparing ? 'not-allowed' : 'pointer',
              fontSize: '12px',
            }}
          >
            {isPreparing ? 'Preparing...' : 'Prepare Only'}
          </button>
          <button
            onClick={handlePlayDemo}
            disabled={!animator || isPlaying || isPreparing}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: animator ? '#00aaff' : '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: animator && !isPlaying ? 'pointer' : 'not-allowed',
              fontSize: '12px',
            }}
          >
            {isPlaying ? 'Playing...' : 'Play Demo'}
          </button>
        </div>

        {/* Summary */}
        {summary && (
          <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <CheckCircle size={16} color="#00ff00" />
              <strong>Summary</strong>
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
              <div>Joints: {summary.jointCount}</div>
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

        {/* Console Log Note */}
        <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', marginTop: '8px' }}>
          Check browser console for detailed logs
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </FloatingPanel>
  );
};
