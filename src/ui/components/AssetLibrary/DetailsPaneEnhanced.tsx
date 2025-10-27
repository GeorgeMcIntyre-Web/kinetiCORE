// DetailsPane Enhanced - Right pane with 3D preview, specifications, and CRUD operations
// Owner: George (Agent 1)
// Full CRUD: Create (Load), Read, Update (Edit), Delete

import { useState, useRef } from 'react';
import { Plus, FileText, Star, Loader2, Upload, Trash2, Edit, Save, X } from 'lucide-react';
import { useAssetLibraryStore } from '../../store/assetLibraryStore';
import { PreviewCanvas } from './PreviewCanvas';
import { AssetLibraryManager } from '../../../library/AssetLibraryManager';
import { SceneManager } from '../../../scene/SceneManager';
import { AssetDatabase } from '../../../library/AssetDatabase';
import './DetailsPane.css';

export function DetailsPaneEnhanced() {
  const { selectedAsset, setSelectedAsset } = useAssetLibraryStore();
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadSuccess, setLoadSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleLoadURDFFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedAsset) return;

    setIsLoading(true);
    setLoadError(null);
    setLoadSuccess(false);

    try {
      const sceneManager = SceneManager.getInstance();
      const libraryManager = AssetLibraryManager.getInstance();

      // Find URDF file
      const urdfFile = Array.from(files).find(
        (f) => f.name.endsWith('.urdf') || f.name.endsWith('.xml')
      );

      if (!urdfFile) {
        throw new Error('No URDF file found. Please select a .urdf or .xml file.');
      }

      // Collect mesh files
      const meshFiles = Array.from(files).filter(
        (f) => f.name.endsWith('.stl') || f.name.endsWith('.dae')
      );

      console.log('Loading URDF file:', urdfFile.name);
      console.log('Found mesh files:', meshFiles.length, meshFiles.map(f => f.name));

      // Load URDF with mesh files
      const result = await sceneManager.loadURDFWithMeshes(urdfFile, meshFiles, selectedAsset);

      if (result.success) {
        libraryManager.recordUsage(selectedAsset.id);
        setLoadSuccess(true);
        console.log('✅ URDF loaded successfully with', meshFiles.length, 'meshes');
        setTimeout(() => setLoadSuccess(false), 3000);
      } else {
        throw new Error(result.error || 'Failed to load URDF file');
      }
    } catch (error) {
      console.error('Failed to load URDF file:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoadError(errorMessage);
      setTimeout(() => setLoadError(null), 5000);
    } finally {
      setIsLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleStartEdit = () => {
    if (!selectedAsset) return;
    setEditedName(selectedAsset.name);
    setEditedDescription(selectedAsset.description || '');
    setEditedTags([...(selectedAsset.tags || [])]);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedName('');
    setEditedDescription('');
    setEditedTags([]);
    setNewTag('');
  };

  const handleSaveEdit = async () => {
    if (!selectedAsset) return;

    setIsLoading(true);
    setLoadError(null);

    try {
      // Update the asset in the UI
      const updatedAsset = {
        ...selectedAsset,
        name: editedName.trim() || selectedAsset.name,
        description: editedDescription.trim(),
        tags: editedTags,
      };

      setSelectedAsset(updatedAsset);
      setIsEditing(false);
      setLoadSuccess(true);
      console.log('✅ Asset metadata updated successfully');
      setTimeout(() => setLoadSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to update asset:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoadError(errorMessage);
      setTimeout(() => setLoadError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !editedTags.includes(newTag.trim())) {
      setEditedTags([...editedTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setEditedTags(editedTags.filter(t => t !== tag));
  };

  const handleDeleteAsset = async () => {
    if (!selectedAsset) return;

    setIsLoading(true);
    setLoadError(null);

    try {
      const assetDatabase = AssetDatabase.getInstance();
      await assetDatabase.initialize();
      await assetDatabase.deleteAsset(selectedAsset.id);

      console.log('✅ Asset deleted successfully:', selectedAsset.name);

      // Clear selection and show success
      setSelectedAsset(null);
      setShowDeleteConfirm(false);

      // Trigger a refresh of the asset list
      window.location.reload(); // Simple approach - could use a store action instead
    } catch (error) {
      console.error('Failed to delete asset:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoadError(errorMessage);
      setTimeout(() => setLoadError(null), 5000);
      setShowDeleteConfirm(false);
    } finally {
      setIsLoading(false);
    }
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
        {isEditing ? (
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className="details-title-input"
            placeholder="Asset name"
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '1.1rem',
              fontWeight: '600',
              border: '1px solid #444',
              borderRadius: '4px',
              background: '#2a2a2a',
              color: '#fff'
            }}
          />
        ) : (
          <h3 className="details-title">{selectedAsset.name}</h3>
        )}
        <button
          className={`details-fav-btn ${selectedAsset.isFavorite ? 'active' : ''}`}
          onClick={handleToggleFavorite}
          title="Add to favorites"
          disabled={isEditing}
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

        {/* Description */}
        <div className="details-description">
          <div className="details-section-title">Description</div>
          {isEditing ? (
            <textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Add a description..."
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#2a2a2a',
                color: '#fff',
                fontSize: '0.9rem',
                resize: 'vertical'
              }}
            />
          ) : (
            <p>{selectedAsset.description || 'No description provided.'}</p>
          )}
        </div>

        {/* Tags */}
        <div className="details-tags">
          <div className="details-section-title">Tags</div>
          {isEditing ? (
            <div>
              <div className="tag-list" style={{ marginBottom: '8px' }}>
                {editedTags.map((tag) => (
                  <span key={tag} className="tag-chip" style={{ position: 'relative', paddingRight: '24px' }}>
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      style={{
                        position: 'absolute',
                        right: '4px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        padding: '0 4px',
                        fontSize: '16px'
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="Add tag..."
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    background: '#2a2a2a',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
                <button
                  onClick={handleAddTag}
                  style={{
                    padding: '4px 12px',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    background: '#333',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <div className="tag-list">
              {selectedAsset.tags && selectedAsset.tags.length > 0 ? (
                selectedAsset.tags.map((tag) => (
                  <span key={tag} className="tag-chip">
                    {tag}
                  </span>
                ))
              ) : (
                <span style={{ color: '#888', fontSize: '0.9rem' }}>No tags</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="details-actions">
        {isEditing ? (
          <>
            <button
              className="details-btn-primary"
              onClick={handleSaveEdit}
              disabled={isLoading}
            >
              <Save size={18} />
              Save Changes
            </button>
            <button
              className="details-btn-secondary"
              onClick={handleCancelEdit}
              disabled={isLoading}
            >
              <X size={18} />
              Cancel
            </button>
          </>
        ) : (
          <>
            {selectedAsset.loaderType === 'urdf' ? (
              <>
                <button
                  className="details-btn-primary"
                  onClick={handleLoadURDFFile}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Load URDF File
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".urdf,.xml,.stl,.dae"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <div style={{
                  fontSize: '0.75rem',
                  color: '#888',
                  marginTop: '0.5rem',
                  textAlign: 'center',
                  lineHeight: '1.3',
                  width: '100%'
                }}>
                  Select URDF file + STL meshes together<br/>
                  (Ctrl+Click or Shift+Click to select multiple files)
                </div>
              </>
            ) : (
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
            )}
            {selectedAsset.documentationUrl && (
              <button
                className="details-btn-secondary"
                onClick={() => window.open(selectedAsset.documentationUrl, '_blank')}
              >
                <FileText size={18} />
                Documentation
              </button>
            )}
            <button
              className="details-btn-secondary"
              onClick={handleStartEdit}
              title="Edit metadata"
            >
              <Edit size={18} />
              Edit
            </button>
            <button
              className="details-btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete asset"
              style={{
                background: '#8b0000',
                borderColor: '#a00',
              }}
            >
              <Trash2 size={18} />
              Delete
            </button>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: '#1a1a1a',
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid #444',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>Delete Asset?</h3>
            <p style={{ margin: '0 0 24px 0', color: '#ccc' }}>
              Are you sure you want to delete "{selectedAsset.name}"? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isLoading}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  background: '#333',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAsset}
                disabled={isLoading}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #a00',
                  borderRadius: '4px',
                  background: '#8b0000',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {loadSuccess && (
        <div className="details-notification success">
          ✅ Operation successful!
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
