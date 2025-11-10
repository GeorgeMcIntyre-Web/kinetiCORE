// Snap performance telemetry HUD
// Owner: George (core) + Edwin (UI styling)
// Displays real-time snap query performance metrics

import React from 'react';
import type { SnapTelemetry } from '../../manipulation/snap';

interface SnapTelemetryHUDProps {
  telemetry: SnapTelemetry | null;
  visible?: boolean;
}

/**
 * Lightweight HUD for monitoring snap query performance
 * Useful for debugging performance issues and validating budgets
 */
export const SnapTelemetryHUD: React.FC<SnapTelemetryHUDProps> = ({
  telemetry,
  visible = false,
}) => {
  if (!visible || !telemetry) return null;

  const isDegraded = telemetry.degradedQueries > 0;
  const degradedPercent = telemetry.totalQueries > 0
    ? (telemetry.degradedQueries / telemetry.totalQueries) * 100
    : 0;

  // Color coding for performance
  const getColor = (avgMs: number): string => {
    if (avgMs < 2) return '#00ff00'; // Green: excellent
    if (avgMs < 4) return '#ffff00'; // Yellow: acceptable
    if (avgMs < 8) return '#ff9900'; // Orange: warning
    return '#ff0000'; // Red: poor
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#fff',
        padding: '8px 12px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '11px',
        lineHeight: '1.4',
        zIndex: 10000,
        pointerEvents: 'none',
        minWidth: '180px',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '4px', borderBottom: '1px solid #444' }}>
        Snap Performance
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span>Avg:</span>
        <span style={{ color: getColor(telemetry.avgQueryTimeMs), fontWeight: 'bold' }}>
          {telemetry.avgQueryTimeMs.toFixed(2)}ms
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>P99:</span>
        <span style={{ color: getColor(telemetry.p99QueryTimeMs), fontWeight: 'bold' }}>
          {telemetry.p99QueryTimeMs.toFixed(2)}ms
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Candidates:</span>
        <span>{telemetry.avgCandidateCount.toFixed(1)}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Queries:</span>
        <span>{telemetry.totalQueries}</span>
      </div>

      {isDegraded && (
        <div
          style={{
            marginTop: '4px',
            paddingTop: '4px',
            borderTop: '1px solid #444',
            color: '#ff9900',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Degraded:</span>
            <span style={{ fontWeight: 'bold' }}>
              {degradedPercent.toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: '6px',
          paddingTop: '4px',
          borderTop: '1px solid #444',
          fontSize: '9px',
          color: '#888',
        }}
      >
        Toggle with Ctrl+Shift+S
      </div>
    </div>
  );
};
