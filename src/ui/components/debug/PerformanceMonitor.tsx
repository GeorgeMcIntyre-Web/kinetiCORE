/**
 * PerformanceMonitor - Real-time performance overlay
 * 
 * Displays real-time performance metrics including FPS, memory usage,
 * draw calls, and entity counts. This is a development-only component.
 * 
 * @module ui/components/debug/PerformanceMonitor
 */

import React, { useEffect, useState, useRef } from 'react';
import { performanceMetrics, FrameMetrics, MemorySnapshot } from '../../../core/PerformanceMetrics';

export interface PerformanceMonitorProps {
  /** Enable/disable the monitor */
  enabled?: boolean;
  /** Position of the overlay */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Update interval in ms */
  updateInterval?: number;
  /** Show detailed metrics */
  detailed?: boolean;
}

interface DisplayMetrics {
  fps: number;
  frameTime: number;
  memory: number; // MB
  drawCalls: number;
  entities: number;
  physicsBodies: number;
  triangles: number;
}

/**
 * PerformanceMonitor component
 * 
 * Usage:
 * ```tsx
 * <PerformanceMonitor enabled={isDev} position="top-right" />
 * ```
 */
export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  enabled = true,
  position = 'top-right',
  updateInterval = 200,
  detailed = false,
}) => {
  const [metrics, setMetrics] = useState<DisplayMetrics>({
    fps: 0,
    frameTime: 0,
    memory: 0,
    drawCalls: 0,
    entities: 0,
    physicsBodies: 0,
    triangles: 0,
  });
  
  const [isExpanded, setIsExpanded] = useState(false);
  const intervalRef = useRef<number>();
  
  useEffect(() => {
    if (!enabled) return;
    
    // Update metrics at specified interval
    intervalRef.current = window.setInterval(() => {
      const currentFrame = performanceMetrics.getCurrentFrame();
      const currentMemory = performanceMetrics.getCurrentMemory();
      
      if (currentFrame) {
        setMetrics({
          fps: currentFrame.fps,
          frameTime: currentFrame.frameTime,
          memory: currentMemory ? currentMemory.usedJSHeapSize / 1024 / 1024 : 0,
          drawCalls: currentFrame.drawCalls,
          entities: currentFrame.entities,
          physicsBodies: currentFrame.physicsBodies,
          triangles: currentFrame.triangles,
        });
      }
    }, updateInterval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, updateInterval]);
  
  if (!enabled) return null;
  
  // Position styles
  const positionStyles: Record<string, React.CSSProperties> = {
    'top-left': { top: 10, left: 10 },
    'top-right': { top: 10, right: 10 },
    'bottom-left': { bottom: 10, left: 10 },
    'bottom-right': { bottom: 10, right: 10 },
  };
  
  // FPS color coding
  const getFpsColor = (fps: number): string => {
    if (fps >= 55) return '#22c55e'; // green
    if (fps >= 30) return '#eab308'; // yellow
    return '#ef4444'; // red
  };
  
  // Memory color coding
  const getMemoryColor = (mb: number): string => {
    if (mb < 100) return '#22c55e'; // green
    if (mb < 300) return '#eab308'; // yellow
    return '#ef4444'; // red
  };
  
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    ...positionStyles[position],
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    color: '#ffffff',
    padding: '12px',
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '12px',
    zIndex: 10000,
    minWidth: '200px',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
    userSelect: 'none',
  };
  
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isExpanded ? '8px' : '0',
    paddingBottom: isExpanded ? '8px' : '0',
    borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
    cursor: 'pointer',
  };
  
  const titleStyle: React.CSSProperties = {
    fontWeight: 'bold',
    fontSize: '13px',
    color: '#60a5fa',
  };
  
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '3px 0',
  };
  
  const labelStyle: React.CSSProperties = {
    color: '#9ca3af',
  };
  
  const valueStyle: React.CSSProperties = {
    fontWeight: 'bold',
    marginLeft: '12px',
  };
  
  const handleExport = () => {
    const data = performanceMetrics.exportStatsSummary();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div style={containerStyle}>
      <div style={headerStyle} onClick={() => setIsExpanded(!isExpanded)}>
        <span style={titleStyle}>⚡ Performance</span>
        <span style={{ fontSize: '10px', color: '#9ca3af' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>
      
      {isExpanded && (
        <>
          <div style={rowStyle}>
            <span style={labelStyle}>FPS:</span>
            <span style={{ ...valueStyle, color: getFpsColor(metrics.fps) }}>
              {metrics.fps.toFixed(1)}
            </span>
          </div>
          
          <div style={rowStyle}>
            <span style={labelStyle}>Frame Time:</span>
            <span style={valueStyle}>
              {metrics.frameTime.toFixed(2)} ms
            </span>
          </div>
          
          {metrics.memory > 0 && (
            <div style={rowStyle}>
              <span style={labelStyle}>Memory:</span>
              <span style={{ ...valueStyle, color: getMemoryColor(metrics.memory) }}>
                {metrics.memory.toFixed(1)} MB
              </span>
            </div>
          )}
          
          {detailed && (
            <>
              <div style={rowStyle}>
                <span style={labelStyle}>Draw Calls:</span>
                <span style={valueStyle}>{metrics.drawCalls}</span>
              </div>
              
              <div style={rowStyle}>
                <span style={labelStyle}>Triangles:</span>
                <span style={valueStyle}>
                  {(metrics.triangles / 1000).toFixed(1)}k
                </span>
              </div>
              
              <div style={rowStyle}>
                <span style={labelStyle}>Entities:</span>
                <span style={valueStyle}>{metrics.entities}</span>
              </div>
              
              <div style={rowStyle}>
                <span style={labelStyle}>Physics Bodies:</span>
                <span style={valueStyle}>{metrics.physicsBodies}</span>
              </div>
            </>
          )}
          
          <div
            style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              gap: '8px',
            }}
          >
            <button
              onClick={() => performanceMetrics.clear()}
              style={{
                flex: 1,
                padding: '4px 8px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
            
            <button
              onClick={handleExport}
              style={{
                flex: 1,
                padding: '4px 8px',
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.5)',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              Export
            </button>
          </div>
        </>
      )}
      
      {!isExpanded && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
          <span style={{ color: getFpsColor(metrics.fps), fontWeight: 'bold' }}>
            {metrics.fps.toFixed(0)} FPS
          </span>
          {metrics.memory > 0 && (
            <span style={{ color: getMemoryColor(metrics.memory) }}>
              {metrics.memory.toFixed(0)} MB
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Hook to enable/disable performance monitoring based on URL parameter
 */
export function usePerformanceMonitor(): boolean {
  const [enabled, setEnabled] = useState(false);
  
  useEffect(() => {
    // Check for ?debug=true or ?perf=true in URL
    const params = new URLSearchParams(window.location.search);
    const debug = params.get('debug') === 'true';
    const perf = params.get('perf') === 'true';
    
    const shouldEnable = debug || perf || import.meta.env.DEV;
    setEnabled(shouldEnable);
    performanceMetrics.setEnabled(shouldEnable);
  }, []);
  
  return enabled;
}
