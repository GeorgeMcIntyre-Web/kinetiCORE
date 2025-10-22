/**
 * Asset Origin Editor Component
 * Owner: Agent 2
 * 
 * Simple form for setting asset origin information
 */

import React, { useState } from 'react';
import { AssetOriginService } from '../../library/services/AssetOriginService';
import type { LibraryAsset, AssetOrigin, AssetOriginType } from '../../library/types';
import './AssetOriginEditor.css';

interface AssetOriginEditorProps {
  asset: LibraryAsset;
  onOriginChange: (origin: AssetOrigin) => void;
  onCancel?: () => void;
}

export const AssetOriginEditor: React.FC<AssetOriginEditorProps> = ({
  asset,
  onOriginChange,
  onCancel
}) => {
  const originService = AssetOriginService.getInstance();
  const [origin, setOrigin] = useState<AssetOrigin>(asset.origin || {});
  const [isEditing, setIsEditing] = useState(!originService.hasOrigin(asset));

  const originTypes: { value: AssetOriginType; label: string; icon: string }[] = [
    { value: 'freeIssue', label: 'Free Issue', icon: '🎁' },
    { value: 'reused', label: 'Reused', icon: '♻️' },
    { value: 'purchased', label: 'Purchased', icon: '🛒' },
    { value: 'internal', label: 'Internal', icon: '🏭' },
    { value: 'custom', label: 'Custom', icon: '⚙️' }
  ];

  const handleSave = () => {
    onOriginChange(origin);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      setIsEditing(false);
    }
  };

  if (!isEditing && originService.hasOrigin(asset)) {
    return (
      <div className="asset-origin-display">
        <div className="origin-summary">
          <span className="origin-icon">{originService.getOriginIcon(origin.type)}</span>
          <span className="origin-label">{originService.getOriginLabel(origin.type)}</span>
          {origin.owner && <span className="origin-detail">({origin.owner})</span>}
        </div>
        <button 
          className="edit-origin-btn"
          onClick={() => setIsEditing(true)}
          title="Edit origin information"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="asset-origin-editor">
      <h4>Asset Origin</h4>
      
      <div className="origin-form">
        <div className="form-group">
          <label>Origin Type</label>
          <div className="origin-type-buttons">
            {originTypes.map(type => (
              <button
                key={type.value}
                className={`origin-type-btn ${origin.type === type.value ? 'active' : ''}`}
                onClick={() => setOrigin({ ...origin, type: type.value })}
              >
                <span className="type-icon">{type.icon}</span>
                <span className="type-label">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="owner">Owner (Optional)</label>
          <input
            id="owner"
            type="text"
            value={origin.owner || ''}
            onChange={(e) => setOrigin({ ...origin, owner: e.target.value })}
            placeholder="Company or person name"
            className="origin-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="supplier">Supplier (Optional)</label>
          <input
            id="supplier"
            type="text"
            value={origin.supplier || ''}
            onChange={(e) => setOrigin({ ...origin, supplier: e.target.value })}
            placeholder="Supplier company name"
            className="origin-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="sourceProject">Source Project (For reused assets)</label>
          <input
            id="sourceProject"
            type="text"
            value={origin.sourceProject || ''}
            onChange={(e) => setOrigin({ ...origin, sourceProject: e.target.value })}
            placeholder="Project ID or name"
            className="origin-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="notes">Notes (Optional)</label>
          <textarea
            id="notes"
            value={origin.notes || ''}
            onChange={(e) => setOrigin({ ...origin, notes: e.target.value })}
            placeholder="Additional notes about this asset's origin"
            className="origin-textarea"
            rows={3}
          />
        </div>

        <div className="form-actions">
          <button 
            className="save-btn"
            onClick={handleSave}
            disabled={!origin.type}
          >
            Save Origin
          </button>
          <button 
            className="cancel-btn"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
