// DetailsPane - Right pane with 3D preview and specifications
// Owner: Edwin
// Full asset details, interactive preview, and action buttons

import { useState } from 'react';
import { Plus, FileText, Star, Loader2 } from 'lucide-react';
import { useAssetLibraryStore } from '../../store/assetLibraryStore';
import { PreviewCanvas } from './PreviewCanvas';
import { AssetLibraryManager } from '../../../library/AssetLibraryManager';
import { SceneManager } from '../../../scene/SceneManager';
import './DetailsPane.css';

export function DetailsPane() {
  const { selectedAsset, setSelectedAsset } = useAssetLibraryStore();
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadSuccess, setLoadSuccess] = useState(false);

  const handleAddToScene = async () => {
    if (!selectedAsset) return;

    setIsLoading(true);
    setLoadError(null);
    setLoadSuccess(false);

    try {
      const sceneManager = SceneManager.getInstance();
      const libraryManager = AssetLibraryManager.getInstance();

      console.log('Loading asset to scene:', selectedAsset.name);
      console.log('File path:', selectedAsset.filePath);
      console.log('Loader type:', selectedAsset.loaderType);

      // Load asset into scene
      const result = await sceneManager.loadAssetFromLibrary(selectedAsset);

      if (result.success) {
        // Record usage
        libraryManager.recordUsage(selectedAsset.id);

        // Show success
        setLoadSuccess(true);
        console.log('✅ Asset loaded successfully:', selectedAsset.name);

        // Clear success message after 3 seconds
        setTimeout(() => setLoadSuccess(false), 3000);
      } else {
        throw new Error(result.error || 'Failed to load asset');
      }
    } catch (error) {
      console.error('Failed to add asset to scene:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoadError(errorMessage);

      // Clear error after 5 seconds
      setTimeout(() => setLoadError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = () => {
    if (!selectedAsset) return;
    const libraryManager = AssetLibraryManager.getInstance();
    libraryManager.toggleFavorite(selectedAsset.id);
    // Force re-render by updating the selected asset
    setSelectedAsset({ ...selectedAsset, isFavorite: !selectedAsset.isFavorite });
  };

  if (!selectedAsset) {
    return (
      <div className="details-pane">
        <div className="details-empty">
          <div className="details-empty-icon">📦</div>
          <div className="details-empty-text">Select an asset to view details</div>
        </div>
      </div>
    );
  }

  return (
    <div className="details-pane">
      {/* Asset name header */}
      <div className="details-header">
        <h3 className="details-title">{selectedAsset.name}</h3>
        <button
          className={`details-fav-btn ${selectedAsset.isFavorite ? 'active' : ''}`}
          onClick={handleToggleFavorite}
          title="Add to favorites"
        >
          <Star size={18} fill={selectedAsset.isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* 3D Preview */}
      <div className="details-preview">
        <PreviewCanvas asset={selectedAsset} />
      </div>

      {/* Specifications */}
      <div className="details-specs">
        <div className="details-section-title">Specifications</div>

        <div className="spec-grid">
          {selectedAsset.manufacturer && (
            <div className="spec-item">
              <span className="spec-item-label">Manufacturer:</span>
              <span className="spec-item-value">{selectedAsset.manufacturer}</span>
            </div>
          )}

          {selectedAsset.modelNumber && (
            <div className="spec-item">
              <span className="spec-item-label">Model:</span>
              <span className="spec-item-value">{selectedAsset.modelNumber}</span>
            </div>
          )}

          {selectedAsset.assetClass && (
            <div className="spec-item">
              <span className="spec-item-label">Class:</span>
              <span className="spec-item-value">{selectedAsset.assetClass}</span>
            </div>
          )}

          {selectedAsset.capabilities?.payload !== undefined && (
            <div className="spec-item highlight">
              <span className="spec-item-label">Payload:</span>
              <span className="spec-item-value">{selectedAsset.capabilities.payload} kg</span>
            </div>
          )}

          {selectedAsset.capabilities?.reach !== undefined && (
            <div className="spec-item highlight">
              <span className="spec-item-label">Reach:</span>
              <span className="spec-item-value">{selectedAsset.capabilities.reach} mm</span>
            </div>
          )}

          {selectedAsset.capabilities?.dof !== undefined && (
            <div className="spec-item">
              <span className="spec-item-label">DOF:</span>
              <span className="spec-item-value">{selectedAsset.capabilities.dof}</span>
            </div>
          )}

          {selectedAsset.capabilities?.mass !== undefined && (
            <div className="spec-item">
              <span className="spec-item-label">Mass:</span>
              <span className="spec-item-value">{selectedAsset.capabilities.mass} kg</span>
            </div>
          )}

          {selectedAsset.capabilities?.powerRequirement && (
            <div className="spec-item">
              <span className="spec-item-label">Power:</span>
              <span className="spec-item-value">
                {selectedAsset.capabilities.powerRequirement}
              </span>
            </div>
          )}

          {selectedAsset.capabilities?.dimensions && (
            <div className="spec-item">
              <span className="spec-item-label">Dimensions:</span>
              <span className="spec-item-value">
                {selectedAsset.capabilities.dimensions.length} ×{' '}
                {selectedAsset.capabilities.dimensions.width} ×{' '}
                {selectedAsset.capabilities.dimensions.height} mm
              </span>
            </div>
          )}

          {selectedAsset.capabilities?.precision !== undefined && (
            <div className="spec-item">
              <span className="spec-item-label">Precision:</span>
              <span className="spec-item-value">
                ±{selectedAsset.capabilities.precision} mm
              </span>
            </div>
          )}

          {selectedAsset.capabilities?.cycleTime !== undefined && (
            <div className="spec-item">
              <span className="spec-item-label">Cycle Time:</span>
              <span className="spec-item-value">
                {selectedAsset.capabilities.cycleTime}s
              </span>
            </div>
          )}
        </div>

        {selectedAsset.description && (
          <div className="details-description">
            <div className="details-section-title">Description</div>
            <p>{selectedAsset.description}</p>
          </div>
        )}

        {selectedAsset.tags && selectedAsset.tags.length > 0 && (
          <div className="details-tags">
            <div className="details-section-title">Tags</div>
            <div className="tag-list">
              {selectedAsset.tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="details-actions">
        <button
          className="details-btn-primary"
          onClick={handleAddToScene}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Plus size={18} />
              Add to Scene
            </>
          )}
        </button>
        {selectedAsset.documentationUrl && (
          <button
            className="details-btn-secondary"
            onClick={() => window.open(selectedAsset.documentationUrl, '_blank')}
          >
            <FileText size={18} />
            Documentation
          </button>
        )}
      </div>

      {/* Success/Error Messages */}
      {loadSuccess && (
        <div className="details-notification success">
          ✅ Asset loaded successfully!
        </div>
      )}
      {loadError && (
        <div className="details-notification error">
          ❌ {loadError}
        </div>
      )}
    </div>
  );
}
