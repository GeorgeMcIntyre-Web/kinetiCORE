/**
 * VersionDisplay - Shows app version and build info
 *
 * Displays the current version from package.json in the UI.
 * Can be placed in footer, settings panel, or as overlay.
 *
 * @module ui/components/VersionDisplay
 */

import React from 'react';

export interface VersionDisplayProps {
  /** Display mode */
  mode?: 'footer' | 'overlay' | 'inline';
  /** Show additional build info */
  showBuildInfo?: boolean;
}

/**
 * VersionDisplay component
 *
 * Usage:
 * ```tsx
 * <VersionDisplay mode="footer" />
 * <VersionDisplay mode="overlay" showBuildInfo />
 * ```
 */
export const VersionDisplay: React.FC<VersionDisplayProps> = ({
  mode = 'footer',
  showBuildInfo = false,
}) => {
  // Version is injected at build time via Vite
  const version = import.meta.env.VITE_APP_VERSION || '0.1.0';
  const buildTime = import.meta.env.VITE_BUILD_TIME || 'dev';
  const gitCommit = import.meta.env.VITE_GIT_COMMIT || 'local';

  const footerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '8px',
    right: '12px',
    fontSize: '11px',
    color: '#9ca3af',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    zIndex: 1000,
    userSelect: 'none',
    pointerEvents: 'none',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
    marginBottom: '0px', // Ensure version stays at bottom
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: '12px',
    left: '12px',
    fontSize: '11px',
    color: '#9ca3af',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    zIndex: 10000,
    userSelect: 'none',
    pointerEvents: 'none',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
  };

  const inlineStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#9ca3af',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  };

  const style = mode === 'footer' ? footerStyle : mode === 'overlay' ? overlayStyle : inlineStyle;

  return (
    <div style={style}>
      <span style={{ color: '#60a5fa', fontWeight: '600' }}>kinetiCORE</span>
      {' '}
      <span style={{ color: '#9ca3af' }}>v{version}</span>
      {showBuildInfo && buildTime !== 'dev' && (
        <>
          {' • '}
          <span style={{ color: '#6b7280', fontSize: '10px' }}>
            {buildTime}
          </span>
        </>
      )}
      {showBuildInfo && gitCommit !== 'local' && (
        <>
          {' • '}
          <span style={{ color: '#6b7280', fontSize: '10px' }}>
            {gitCommit.substring(0, 7)}
          </span>
        </>
      )}
    </div>
  );
};

/**
 * Hook to get version info programmatically
 */
export function useVersion() {
  return {
    version: import.meta.env.VITE_APP_VERSION || '0.1.0',
    buildTime: import.meta.env.VITE_BUILD_TIME || 'dev',
    gitCommit: import.meta.env.VITE_GIT_COMMIT || 'local',
    isDev: import.meta.env.DEV,
  };
}
