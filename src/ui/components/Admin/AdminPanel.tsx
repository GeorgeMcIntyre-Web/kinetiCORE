/**
 * Admin Panel for Asset Management
 * Owner: George
 *
 * Web interface for bulk asset management, metadata extraction, and asset operations
 */

import { useState, useEffect, useCallback } from 'react';
import { Upload, Search, Trash2, Edit, Eye, FileText, Image, Database } from 'lucide-react';

// Placeholder type for LibraryAsset
interface LibraryAsset {
  id: string;
  name: string;
  description?: string;
  domain: string;
  assetClass: string;
  tags: string[];
  thumbnail?: string;
  usageCount?: number;
  fileSize?: number;
  manufacturer?: string;
  modelNumber?: string;
  customMetadata?: Record<string, any>;
}

// Placeholder types for metadata extraction
interface MetadataExtractionResult {
  success: boolean;
  confidence: 'high' | 'medium' | 'low';
  data: Partial<LibraryAsset>;
  errors?: string[];
}

// Simplified metadata service (inline implementation)
class SimpleMetadataService {
  async extractMetadata(_config: any): Promise<MetadataExtractionResult> {
    return {
      success: false,
      confidence: 'low',
      data: {},
    };
  }

  static getInstance() {
    return new SimpleMetadataService();
  }
}

/**
 * Admin Panel Props
 */
interface AdminPanelProps {
  onClose?: () => void;
}

/**
 * Asset upload configuration
 */
interface AssetUploadConfig {
  name: string;
  description?: string;
  domain: string;
  assetClass: string;
  tags: string[];
  manufacturer?: string;
  modelNumber?: string;
  generateThumbnail: boolean;
  extractMetadata: boolean;
}

/**
 * Admin Panel Component
 */
export function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'assets' | 'upload' | 'bulk' | 'analytics'>('assets');
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    domain: '',
    assetClass: '',
    tags: [] as string[],
  });

  // Metadata extraction state
  const [metadataQuery, setMetadataQuery] = useState('');
  const [metadataResult, setMetadataResult] = useState<MetadataExtractionResult | null>(null);
  const [extractingMetadata, setExtractingMetadata] = useState(false);

  // Upload state
  const [uploadConfig, setUploadConfig] = useState<AssetUploadConfig>({
    name: '',
    description: '',
    domain: 'custom',
    assetClass: 'structures',
    tags: [],
    generateThumbnail: true,
    extractMetadata: false,
  });
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Services
  const metadataService = SimpleMetadataService.getInstance();

  /**
   * Load assets from API
   */
  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/assets', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setAssets(data.assets || []);
      } else {
        console.error('Failed to load assets');
      }
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Extract metadata from query
   */
  const handleExtractMetadata = async () => {
    if (!metadataQuery.trim()) return;

    setExtractingMetadata(true);
    try {
      const result = await metadataService.extractMetadata({
        query: metadataQuery,
        includeSpecifications: true,
        includeImages: true,
      });

      setMetadataResult(result);

      if (result.success) {
        // Pre-fill upload form with extracted data
        setUploadConfig((prev) => ({
          ...prev,
          name: result.data.name || '',
          description: result.data.description || '',
          manufacturer: result.data.manufacturer || '',
          modelNumber: result.data.modelNumber || '',
          tags: result.data.tags || [],
          domain: result.data.domain || 'custom',
          assetClass: result.data.assetClass || 'structures',
        }));
      }
    } catch (error) {
      console.error('Metadata extraction failed:', error);
    } finally {
      setExtractingMetadata(false);
    }
  };

  /**
   * Handle file upload
   */
  const handleFileUpload = async () => {
    if (uploadFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of uploadFiles) {
        // Create asset
        const assetData = {
          name: uploadConfig.name || file.name,
          description: uploadConfig.description,
          domain: uploadConfig.domain,
          assetClass: uploadConfig.assetClass,
          tags: uploadConfig.tags,
          manufacturer: uploadConfig.manufacturer,
          modelNumber: uploadConfig.modelNumber,
          loaderType: getLoaderType(file.name),
          source: 'admin-upload',
        };

        const response = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assetData),
        });

        if (response.ok) {
          const result = await response.json();
          const assetId = result.assetId;

          // Upload file
          const formData = new FormData();
          formData.append('file', file);
          formData.append('assetId', assetId);

          const uploadResponse = await fetch('/api/admin/upload', {
            method: 'POST',
            body: formData,
          });

          if (uploadResponse.ok) {
            // Generate thumbnail if requested
            if (uploadConfig.generateThumbnail) {
              await fetch('/api/admin/generate-thumbnail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  assetId,
                  modelUrl: `/api/assets/file/${assetId}`,
                }),
              });
            }
          }
        }
      }

      // Reload assets
      await loadAssets();

      // Reset form
      setUploadFiles([]);
      setUploadConfig({
        name: '',
        description: '',
        domain: 'custom',
        assetClass: 'structures',
        tags: [],
        generateThumbnail: true,
        extractMetadata: false,
      });
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Delete asset
   */
  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadAssets();
      } else {
        console.error('Failed to delete asset');
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  /**
   * Get loader type from filename
   */
  const getLoaderType = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'glb':
        return 'glb';
      case 'gltf':
        return 'gltf';
      case 'obj':
        return 'obj';
      case 'stl':
        return 'stl';
      case 'urdf':
        return 'urdf';
      case 'xml':
        return 'mjcf';
      default:
        return 'glb';
    }
  };

  /**
   * Filter assets based on search and filters
   */
  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      !searchQuery ||
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDomain = !filters.domain || asset.domain === filters.domain;
    const matchesAssetClass = !filters.assetClass || asset.assetClass === filters.assetClass;
    const matchesTags =
      filters.tags.length === 0 || filters.tags.some((tag) => asset.tags.includes(tag));

    return matchesSearch && matchesDomain && matchesAssetClass && matchesTags;
  });

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  return (
    <div className="admin-panel m-3">
      <div className="admin-header">
        <h2>Asset Library Admin</h2>
        <div className="admin-tabs">
          <button
            className={activeTab === 'assets' ? 'active' : ''}
            onClick={() => setActiveTab('assets')}
          >
            <Database className="w-4 h-4" />
            Assets
          </button>
          <button
            className={activeTab === 'upload' ? 'active' : ''}
            onClick={() => setActiveTab('upload')}
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
          <button
            className={activeTab === 'bulk' ? 'active' : ''}
            onClick={() => setActiveTab('bulk')}
          >
            <FileText className="w-4 h-4" />
            Bulk Import
          </button>
          <button
            className={activeTab === 'analytics' ? 'active' : ''}
            onClick={() => setActiveTab('analytics')}
          >
            <Eye className="w-4 h-4" />
            Analytics
          </button>
        </div>
        {onClose && (
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      <div className="admin-content">
        {activeTab === 'assets' && (
          <div className="assets-tab">
            <div className="search-filters">
              <div className="search-box">
                <Search className="w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="filters">
                <select
                  value={filters.domain}
                  onChange={(e) => setFilters((prev) => ({ ...prev, domain: e.target.value }))}
                >
                  <option value="">All Domains</option>
                  <option value="manufacturing">Manufacturing</option>
                  <option value="logistics">Logistics</option>
                  <option value="medical">Medical</option>
                  <option value="construction">Construction</option>
                  <option value="custom">Custom</option>
                </select>
                <select
                  value={filters.assetClass}
                  onChange={(e) => setFilters((prev) => ({ ...prev, assetClass: e.target.value }))}
                >
                  <option value="">All Classes</option>
                  <option value="robots">Robots</option>
                  <option value="machinery">Machinery</option>
                  <option value="equipment">Equipment</option>
                  <option value="structures">Structures</option>
                </select>
              </div>
            </div>

            <div className="assets-list">
              {loading ? (
                <div className="loading">Loading assets...</div>
              ) : (
                <div className="assets-grid">
                  {filteredAssets.map((asset) => (
                    <div key={asset.id} className="asset-card">
                      <div className="asset-thumbnail">
                        {asset.thumbnail ? (
                          <img src={asset.thumbnail} alt={asset.name} />
                        ) : (
                          <div className="placeholder-thumbnail">
                            <Image className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="asset-info">
                        <h3>{asset.name}</h3>
                        <p className="asset-description">{asset.description}</p>
                        <div className="asset-tags">
                          {asset.tags.slice(0, 3).map((tag: string) => (
                            <span key={tag} className="tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="asset-stats">
                          <span>Usage: {asset.usageCount || 0}</span>
                          <span>Size: {asset.fileSize || 0}MB</span>
                        </div>
                      </div>
                      <div className="asset-actions">
                        <button
                          onClick={() => window.open(`/api/assets/file/${asset.id}`, '_blank')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            /* Edit asset */
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteAsset(asset.id)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="upload-tab">
            <div className="upload-section">
              <h3>AI-Assisted Metadata Extraction</h3>
              <div className="metadata-extraction">
                <div className="extraction-input">
                  <input
                    type="text"
                    placeholder="Enter part number, URL, or product name..."
                    value={metadataQuery}
                    onChange={(e) => setMetadataQuery(e.target.value)}
                  />
                  <button
                    onClick={handleExtractMetadata}
                    disabled={extractingMetadata || !metadataQuery.trim()}
                  >
                    {extractingMetadata ? 'Extracting...' : 'Extract Metadata'}
                  </button>
                </div>

                {metadataResult && (
                  <div className={`extraction-result confidence-${metadataResult.confidence}`}>
                    <div className="confidence-badge">Confidence: {metadataResult.confidence}</div>
                    {metadataResult.success ? (
                      <div className="extracted-data">
                        <h4>Extracted Data:</h4>
                        <pre>{JSON.stringify(metadataResult.data, null, 2)}</pre>
                      </div>
                    ) : (
                      <div className="extraction-error">
                        <p>Extraction failed: {metadataResult.errors?.join(', ')}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="upload-form">
              <h3>Asset Upload Configuration</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={uploadConfig.name}
                    onChange={(e) => setUploadConfig((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Asset name"
                  />
                </div>
                <div className="form-group">
                  <label>Manufacturer</label>
                  <input
                    type="text"
                    value={uploadConfig.manufacturer || ''}
                    onChange={(e) =>
                      setUploadConfig((prev) => ({ ...prev, manufacturer: e.target.value }))
                    }
                    placeholder="Manufacturer"
                  />
                </div>
                <div className="form-group">
                  <label>Model Number</label>
                  <input
                    type="text"
                    value={uploadConfig.modelNumber || ''}
                    onChange={(e) =>
                      setUploadConfig((prev) => ({ ...prev, modelNumber: e.target.value }))
                    }
                    placeholder="Model number"
                  />
                </div>
                <div className="form-group">
                  <label>Domain</label>
                  <select
                    value={uploadConfig.domain}
                    onChange={(e) =>
                      setUploadConfig((prev) => ({ ...prev, domain: e.target.value }))
                    }
                  >
                    <option value="manufacturing">Manufacturing</option>
                    <option value="logistics">Logistics</option>
                    <option value="medical">Medical</option>
                    <option value="construction">Construction</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Asset Class</label>
                  <select
                    value={uploadConfig.assetClass}
                    onChange={(e) =>
                      setUploadConfig((prev) => ({ ...prev, assetClass: e.target.value }))
                    }
                  >
                    <option value="robots">Robots</option>
                    <option value="machinery">Machinery</option>
                    <option value="equipment">Equipment</option>
                    <option value="structures">Structures</option>
                    <option value="tools">Tools</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={uploadConfig.description || ''}
                    onChange={(e) =>
                      setUploadConfig((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Asset description"
                    rows={3}
                  />
                </div>
              </div>

              <div className="upload-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={uploadConfig.generateThumbnail}
                    onChange={(e) =>
                      setUploadConfig((prev) => ({ ...prev, generateThumbnail: e.target.checked }))
                    }
                  />
                  Generate thumbnail automatically
                </label>
              </div>

              <div className="file-upload">
                <div className="upload-area">
                  <Upload className="w-8 h-8" />
                  <p>Drag & drop files here or click to browse</p>
                  <input
                    type="file"
                    multiple
                    accept=".glb,.gltf,.obj,.stl,.urdf,.xml"
                    onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                  />
                </div>
                {uploadFiles.length > 0 && (
                  <div className="upload-files">
                    <h4>Selected Files:</h4>
                    <ul>
                      {uploadFiles.map((file, index) => (
                        <li key={index}>
                          {file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <button
                className="upload-button"
                onClick={handleFileUpload}
                disabled={uploading || uploadFiles.length === 0}
              >
                {uploading ? 'Uploading...' : `Upload ${uploadFiles.length} File(s)`}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'bulk' && (
          <div className="bulk-tab">
            <h3>Bulk Import</h3>
            <div className="bulk-import">
              <div className="import-methods">
                <div className="import-method">
                  <h4>CSV Import</h4>
                  <p>Import assets from CSV file with metadata</p>
                  <button>Select CSV File</button>
                </div>
                <div className="import-method">
                  <h4>Folder Import</h4>
                  <p>Import all files from a folder</p>
                  <button>Select Folder</button>
                </div>
                <div className="import-method">
                  <h4>API Import</h4>
                  <p>Import from external API or database</p>
                  <button>Configure API</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="analytics-tab">
            <h3>Asset Analytics</h3>
            <div className="analytics-grid">
              <div className="analytics-card">
                <h4>Total Assets</h4>
                <div className="metric">{assets.length}</div>
              </div>
              <div className="analytics-card">
                <h4>Total Storage</h4>
                <div className="metric">
                  {assets.reduce((sum, asset) => sum + (asset.fileSize || 0), 0)}MB
                </div>
              </div>
              <div className="analytics-card">
                <h4>Most Used</h4>
                <div className="metric">
                  {assets.reduce((max, asset) => Math.max(max, asset.usageCount || 0), 0)}
                </div>
              </div>
              <div className="analytics-card">
                <h4>Recent Uploads</h4>
                <div className="metric">
                  {
                    assets.filter((asset) => {
                      const createdAt = new Date(asset.customMetadata?.exportedAt || '');
                      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                      return createdAt > weekAgo;
                    }).length
                  }
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
