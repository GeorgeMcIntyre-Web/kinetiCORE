/**
 * Asset Origin Indicator Component
 * Owner: Agent 2
 * 
 * Simple visual indicator for asset origin that fits into existing UI
 */

import React from 'react';
import { AssetOriginService } from '../../library/services/AssetOriginService';
import type { LibraryAsset } from '../../library/types';
import './AssetOriginIndicator.css';

interface AssetOriginIndicatorProps {
  asset: LibraryAsset;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  className?: string;
}

export const AssetOriginIndicator: React.FC<AssetOriginIndicatorProps> = ({
  asset,
  size = 'small',
  showLabel = false,
  className = ''
}) => {
  const originService = AssetOriginService.getInstance();
  
  if (!originService.hasOrigin(asset)) {
    return null; // Don't show anything if no origin info
  }

  const origin = asset.origin!;
  const icon = originService.getOriginIcon(origin.type);
  const label = originService.getOriginLabel(origin.type);

  return (
    <div 
      className={`asset-origin-indicator asset-origin-${size} ${className}`}
      title={originService.getOriginSummary(asset)}
    >
      <span className="asset-origin-icon">{icon}</span>
      {showLabel && (
        <span className="asset-origin-label">{label}</span>
      )}
    </div>
  );
};

/**
 * Simple origin badge for asset cards
 */
export const AssetOriginBadge: React.FC<{ asset: LibraryAsset }> = ({ asset }) => {
  return (
    <AssetOriginIndicator 
      asset={asset} 
      size="small" 
      className="asset-origin-badge"
    />
  );
};

/**
 * Origin summary for details pane
 */
export const AssetOriginSummary: React.FC<{ asset: LibraryAsset }> = ({ asset }) => {
  const originService = AssetOriginService.getInstance();
  
  if (!originService.hasOrigin(asset)) {
    return (
      <div className="asset-origin-summary">
        <p className="no-origin-info">No origin information available</p>
      </div>
    );
  }

  const origin = asset.origin!;

  return (
    <div className="asset-origin-summary">
      <h4>Asset Origin</h4>
      <div className="origin-details">
        <div className="origin-type">
          <span className="origin-icon">{originService.getOriginIcon(origin.type)}</span>
          <span className="origin-label">{originService.getOriginLabel(origin.type)}</span>
        </div>
        
        {origin.owner && (
          <div className="origin-field">
            <strong>Owner:</strong> {origin.owner}
          </div>
        )}
        
        {origin.supplier && (
          <div className="origin-field">
            <strong>Supplier:</strong> {origin.supplier}
          </div>
        )}
        
        {origin.sourceProject && (
          <div className="origin-field">
            <strong>Source Project:</strong> {origin.sourceProject}
          </div>
        )}
        
        {origin.notes && (
          <div className="origin-field">
            <strong>Notes:</strong> {origin.notes}
          </div>
        )}
        
        {origin.createdAt && (
          <div className="origin-field">
            <strong>Added:</strong> {origin.createdAt.toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
};
