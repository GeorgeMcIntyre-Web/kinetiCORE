/**
 * FeaBackendDemoPanel.tsx
 * Debug/demo panel for testing FEA backend integration
 * Owner: George (Agent 1 - Claude Code)
 *
 * Demonstrates:
 * - Submitting FEA jobs to FastAPI backend
 * - Polling for job status updates
 * - Displaying results (maxDisplacement, maxVonMises, FoS)
 * - Optional field data (node/element counts)
 */

import React, { useState } from 'react';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import {
  getDefaultFeaBaseUrl,
  submitAndWaitForResult,
  FeaPollTimeoutError,
  FeaHttpError,
  FeaJobError,
} from '../../services/fea/FeaServiceClient';
import type {
  FeaJobRequest,
  FeaJobResult,
} from '../../services/fea/FeaServiceTypes';

interface FeaBackendDemoPanelProps {
  onClose?: () => void;
}

export const FeaBackendDemoPanel: React.FC<FeaBackendDemoPanelProps> = ({
  onClose,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<string>('Ready');
  const [result, setResult] = useState<FeaJobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'timeout' | 'backend' | 'http' | 'job' | null>(null);

  const runMockBeamDemo = async () => {
    setIsRunning(true);
    setStatus('Submitting job...');
    setResult(null);
    setError(null);
    setErrorType(null);

    const baseUrl = getDefaultFeaBaseUrl();

    // Build a mock beam-demo request
    const request: FeaJobRequest = {
      meta: {
        name: 'Mock Beam Demo',
        modelType: 'beam-demo',
        description: 'Cantilever beam with tip load',
        estimatedDofs: 63,
      },
      materials: [
        {
          id: 'steel',
          name: 'Structural Steel',
          youngsModulus: 200e9, // 200 GPa
          poissonsRatio: 0.3,
          density: 7850, // kg/m³
          yieldStrength: 250e6, // 250 MPa
        },
      ],
      boundaryConditions: [
        {
          type: 'fixed',
          nodeIds: [0],
        },
      ],
      loads: [
        {
          type: 'concentrated',
          nodeIds: [20],
          force: { x: 0, y: -1000, z: 0 }, // 1000 N downward
        },
      ],
    };

    try {
      setStatus('Job submitted. Polling for result...');

      const jobResult = await submitAndWaitForResult(baseUrl, request, {
        pollIntervalMs: 500,
        timeoutMs: 60000,
      });

      if (jobResult.status === 'error') {
        setError(jobResult.error ?? 'Unknown error');
        setErrorType('backend');
        setStatus('Job failed');
        return;
      }

      setResult(jobResult);
      setStatus('Job completed successfully');
    } catch (err) {
      // Handle different error types with specific messages
      if (err instanceof FeaPollTimeoutError) {
        setError(
          `Job ${err.jobId} is taking longer than expected (>${err.timeoutMs / 1000}s). ` +
          'The job may still be running. Please check backend logs or try again with a longer timeout.'
        );
        setErrorType('timeout');
        setStatus('Timeout');
      } else if (err instanceof FeaJobError) {
        setError(
          `Job failed during execution: ${err.errorMessage}. ` +
          'Check server logs for detailed error information.'
        );
        setErrorType('job');
        setStatus('Job failed');
      } else if (err instanceof FeaHttpError) {
        setError(
          `Backend error (HTTP ${err.statusCode}): ${err.body}. ` +
          'Please ensure the backend service is running and accessible.'
        );
        setErrorType('http');
        setStatus('Backend error');
      } else {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        setErrorType('backend');
        setStatus('Error occurred');
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <FloatingPanel
      title="FEA Backend Demo (Mock)"
      subtitle="Test FastAPI + Celery + Redis integration"
      onClose={onClose}
      defaultPosition={{ x: 100, y: 100 }}
      defaultSize={{ width: 450, height: 550 }}
      draggable={true}
      closable={true}
      minimizable={true}
      zIndex={1000}
    >
      <div style={{ padding: '16px', color: '#e0e0e0' }}>
        {/* Run Button */}
        <button
          onClick={runMockBeamDemo}
          disabled={isRunning}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: 600,
            color: isRunning ? '#888' : '#fff',
            backgroundColor: isRunning ? '#444' : '#00acc1',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            marginBottom: '16px',
            transition: 'background-color 0.2s',
          }}
        >
          {isRunning ? 'Running...' : 'Run Beam FEA (Mock Backend)'}
        </button>

        {/* Status Display */}
        <div
          style={{
            padding: '12px',
            backgroundColor: '#1e1e1e',
            borderRadius: '4px',
            marginBottom: '16px',
            border: '1px solid #333',
          }}
        >
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
            Status:
          </div>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#00acc1' }}>
            {status}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: errorType === 'timeout' ? '#2d2a1a' : '#2d1a1a',
              borderRadius: '4px',
              marginBottom: '16px',
              border: `1px solid ${errorType === 'timeout' ? '#ff9800' : '#c62828'}`,
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: errorType === 'timeout' ? '#ffb74d' : '#ef5350',
                marginBottom: '4px',
                fontWeight: 600,
              }}
            >
              {errorType === 'timeout' && '⏱️ Timeout'}
              {errorType === 'job' && '❌ Job Failed'}
              {errorType === 'http' && '🌐 Backend Error'}
              {errorType === 'backend' && '⚠️ Error'}
            </div>
            <div
              style={{
                fontSize: '13px',
                color: errorType === 'timeout' ? '#ffe0b2' : '#ffcdd2',
                wordBreak: 'break-word',
                lineHeight: '1.5',
              }}
            >
              {error}
            </div>
            {errorType === 'timeout' && (
              <div
                style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid #3d3a2a',
                  fontSize: '12px',
                  color: '#bcaaa4',
                }}
              >
                💡 Tip: You can increase the timeout in the code or check if the backend is processing normally.
              </div>
            )}
            {(errorType === 'http' || errorType === 'backend') && (
              <div
                style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid #3d2a2a',
                  fontSize: '12px',
                  color: '#bcaaa4',
                }}
              >
                💡 Tip: Ensure Redis, Celery worker, and FastAPI server are running (see server/README.md).
              </div>
            )}
          </div>
        )}

        {/* Results Display */}
        {result && result.status === 'completed' && (
          <div
            style={{
              padding: '16px',
              backgroundColor: '#1e1e1e',
              borderRadius: '4px',
              border: '1px solid #333',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#00acc1',
                marginBottom: '12px',
              }}
            >
              Results
            </div>

            {/* Max Displacement */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: '#999' }}>
                Max Displacement:
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>
                {result.maxDisplacement !== undefined
                  ? `${(result.maxDisplacement * 1000).toFixed(4)} mm`
                  : 'N/A'}
              </div>
            </div>

            {/* Max von Mises Stress */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: '#999' }}>
                Max von Mises Stress:
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>
                {result.maxVonMises !== undefined
                  ? `${(result.maxVonMises / 1e6).toFixed(2)} MPa`
                  : 'N/A'}
              </div>
            </div>

            {/* Factor of Safety */}
            {result.factorOfSafety !== undefined && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: '#999' }}>
                  Factor of Safety:
                </div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>
                  {result.factorOfSafety.toFixed(2)}
                </div>
              </div>
            )}

            {/* Field Data Counts */}
            {result.fields && (
              <div
                style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #333',
                }}
              >
                <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px' }}>
                  Field Data:
                </div>
                <div style={{ fontSize: '13px' }}>
                  {result.fields.nodeIds && (
                    <div>Nodes: {result.fields.nodeIds.length}</div>
                  )}
                  {result.fields.displacements && (
                    <div>Displacements: {result.fields.displacements.length}</div>
                  )}
                  {result.fields.vonMises && (
                    <div>Von Mises values: {result.fields.vonMises.length}</div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            {result.meta && (
              <div
                style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #333',
                }}
              >
                <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px' }}>
                  Metadata:
                </div>
                <div style={{ fontSize: '13px' }}>
                  {result.meta.solveTime !== undefined && (
                    <div>Solve Time: {result.meta.solveTime.toFixed(2)}s</div>
                  )}
                  {result.meta.dofs !== undefined && (
                    <div>DOFs: {result.meta.dofs}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!result && !error && !isRunning && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#1a2332',
              borderRadius: '4px',
              border: '1px solid #2d4a6b',
            }}
          >
            <div style={{ fontSize: '12px', color: '#90caf9', marginBottom: '8px' }}>
              📋 Requirements:
            </div>
            <div style={{ fontSize: '11px', color: '#b0bec5', lineHeight: '1.6' }}>
              1. Redis running on localhost:6379
              <br />
              2. Celery worker running (server/ directory)
              <br />
              3. FastAPI server on localhost:8050
              <br />
              <br />
              See{' '}
              <code
                style={{
                  backgroundColor: '#263238',
                  padding: '2px 4px',
                  borderRadius: '2px',
                }}
              >
                server/README.md
              </code>{' '}
              for setup
            </div>
          </div>
        )}
      </div>
    </FloatingPanel>
  );
};
