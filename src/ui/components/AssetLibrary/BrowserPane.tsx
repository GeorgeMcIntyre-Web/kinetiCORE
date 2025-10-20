// BrowserPane - Center pane with asset grid/list
// Owner: Edwin
// Card-based view showing key specs at a glance

import { useState, useEffect } from 'react';
import { Grid3x3, List, Package } from 'lucide-react';
import { useAssetLibraryStore } from '../../store/assetLibraryStore';
import { AssetLibraryManager } from '../../../library/AssetLibraryManager';
import type { LibraryAsset } from '../../../library/types';
import './BrowserPane.css';

export function BrowserPane() {
  const { viewMode, setViewMode, filters, setSelectedAsset, selectedAsset } =
    useAssetLibraryStore();
  const [filteredAssets, setFilteredAssets] = useState<LibraryAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const libraryManager = AssetLibraryManager.getInstance();

  // Initialize and filter assets
  useEffect(() => {
    const init = async () => {
      try {
        await libraryManager.initialize();
        updateFilteredAssets();
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load assets:', error);
        setIsLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    updateFilteredAssets();
  }, [filters]);

  const updateFilteredAssets = () => {
    const results = libraryManager.search(filters);
    setFilteredAssets(results.map((r) => r.asset));
  };

  const handleAssetClick = (asset: LibraryAsset) => {
    setSelectedAsset(asset);
  };

  const handleAssetDragStart = (asset: LibraryAsset, e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (isLoading) {
    return (
      <div className="browser-pane">
        <div className="browser-header">
          <span className="browser-title">Assets (Loading...)</span>
        </div>
        <div className="browser-content empty">
          <div className="browser-empty-icon">⏳</div>
          <div className="browser-empty-text">Loading asset library...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="browser-pane">
      {/* Header with view toggles */}
      <div className="browser-header">
        <span className="browser-title">
          Assets ({filteredAssets.length})
        </span>
        <div className="browser-view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <Grid3x3 size={16} />
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="browser-content">
        {filteredAssets.length === 0 ? (
          <div className="browser-empty">
            <div className="browser-empty-icon">📦</div>
            <div className="browser-empty-text">No assets match your filters</div>
          </div>
        ) : viewMode === 'list' ? (
          <div className="asset-list-view">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className={`asset-list-item ${selectedAsset?.id === asset.id ? 'selected' : ''}`}
                onClick={() => handleAssetClick(asset)}
                draggable
                onDragStart={(e) => handleAssetDragStart(asset, e)}
              >
                <div className="asset-list-thumbnail">
                  {asset.thumbnail ? (
                    <img src={asset.thumbnail} alt={asset.name} />
                  ) : (
                    <Package size={20} />
                  )}
                </div>
                <div className="asset-list-info">
                  <div className="asset-list-name">{asset.name}</div>
                  <div className="asset-list-meta">
                    {asset.manufacturer || 'Generic'} • {asset.assetClass}
                  </div>
                </div>
                <div className="asset-list-specs">
                  {asset.capabilities?.payload && (
                    <span className="spec-chip">{asset.capabilities.payload}kg</span>
                  )}
                  {asset.capabilities?.reach && (
                    <span className="spec-chip">{asset.capabilities.reach}mm</span>
                  )}
                  {asset.capabilities?.dof && (
                    <span className="spec-chip">{asset.capabilities.dof} DOF</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="asset-grid-view">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className={`asset-card ${selectedAsset?.id === asset.id ? 'selected' : ''}`}
                onClick={() => handleAssetClick(asset)}
                draggable
                onDragStart={(e) => handleAssetDragStart(asset, e)}
                title={asset.description}
              >
                <div className="asset-card-thumbnail">
                  {asset.thumbnail ? (
                    <img src={asset.thumbnail} alt={asset.name} />
                  ) : (
                    <Package size={40} />
                  )}
                </div>
                <div className="asset-card-content">
                  <div className="asset-card-name">{asset.name}</div>
                  <div className="asset-card-manufacturer">
                    {asset.manufacturer || 'Generic'}
                  </div>
                  <div className="asset-card-specs">
                    {asset.capabilities?.payload && (
                      <div className="spec-row">
                        <span className="spec-label">Payload:</span>
                        <span className="spec-value">{asset.capabilities.payload}kg</span>
                      </div>
                    )}
                    {asset.capabilities?.reach && (
                      <div className="spec-row">
                        <span className="spec-label">Reach:</span>
                        <span className="spec-value">{asset.capabilities.reach}mm</span>
                      </div>
                    )}
                    {asset.capabilities?.dof && (
                      <div className="spec-row">
                        <span className="spec-label">DOF:</span>
                        <span className="spec-value">{asset.capabilities.dof}</span>
                      </div>
                    )}
                  </div>
                  {asset.tags && asset.tags.length > 0 && (
                    <div className="asset-card-tags">
                      {asset.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
