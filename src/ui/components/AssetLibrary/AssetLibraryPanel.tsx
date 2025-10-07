// Asset Library Panel - Glassmorphic Floating UI
// Owner: Edwin (UI), Foundation by George
// Modern asset browser with search, filters, and drag-drop

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Minimize2,
  Maximize2,
  Settings,
  Grid3x3,
  List,
  Package,
} from 'lucide-react';
import { AssetLibraryManager } from '../../../library/AssetLibraryManager';
import type { LibraryAsset, LibraryFilters } from '../../../library/types';
import './AssetLibraryPanel.css';

type ViewMode = 'grid' | 'comfortable' | 'list';
type DockPosition = 'floating' | 'left' | 'right' | 'bottom';

interface AssetLibraryPanelProps {
  onAssetSelect?: (asset: LibraryAsset) => void;
  onAssetDragStart?: (asset: LibraryAsset) => void;
  onAssetDragEnd?: () => void;
}

export function AssetLibraryPanel({
  onAssetSelect,
  onAssetDragStart,
  onAssetDragEnd,
}: AssetLibraryPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [dockPosition, setDockPosition] = useState<DockPosition>('floating');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [filteredAssets, setFilteredAssets] = useState<LibraryAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const libraryManager = AssetLibraryManager.getInstance();

  // Initialize library
  useEffect(() => {
    const init = async () => {
      try {
        await libraryManager.initialize();
        const allAssets = libraryManager.getAllAssets();
        setFilteredAssets(allAssets);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize library:', error);
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Filter assets when search or domain changes
  useEffect(() => {
    const filters: LibraryFilters = {
      searchQuery: searchQuery || undefined,
      domains: selectedDomain !== 'all' ? [selectedDomain as any] : undefined,
    };

    const results = libraryManager.search(filters);
    setFilteredAssets(results.map((r) => r.asset));
  }, [searchQuery, selectedDomain]);

  // Panel dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (
      dockPosition !== 'floating' ||
      !(e.target as HTMLElement).closest('.asset-library-header')
    ) {
      return;
    }

    setIsDragging(true);
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  }, [dockPosition]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (panelRef.current) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Asset drag and drop
  const handleAssetDragStart = (asset: LibraryAsset, e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
    onAssetDragStart?.(asset);
  };

  const handleAssetDragEnd = () => {
    onAssetDragEnd?.();
  };

  // Double-click to add
  const handleAssetDoubleClick = (asset: LibraryAsset) => {
    onAssetSelect?.(asset);
    libraryManager.recordUsage(asset.id);
  };

  if (isMinimized) {
    return (
      <div
        className="asset-library-panel minimized"
        onClick={() => setIsMinimized(false)}
        title="Open Asset Library"
      >
        <Package size={24} />
      </div>
    );
  }

  const panelClasses = [
    'asset-library-panel',
    dockPosition !== 'floating' && `docked-${dockPosition}`,
    isDragging && 'dragging',
  ]
    .filter(Boolean)
    .join(' ');

  const panelStyle =
    dockPosition === 'floating'
      ? {
          left: `${position.x}px`,
          top: `${position.y}px`,
        }
      : {};

  return (
    <div
      ref={panelRef}
      className={panelClasses}
      style={panelStyle}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="asset-library-header">
        <h3 className="asset-library-title">Asset Library</h3>
        <div className="asset-library-controls">
          <button
            className="asset-library-control-btn"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
          >
            <Minimize2 size={16} />
          </button>
          <button
            className="asset-library-control-btn"
            onClick={() =>
              setDockPosition(dockPosition === 'floating' ? 'right' : 'floating')
            }
            title={dockPosition === 'floating' ? 'Dock Right' : 'Float'}
          >
            <Maximize2 size={16} />
          </button>
          <button className="asset-library-control-btn" title="Settings">
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="asset-library-search">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            className="asset-library-search-input"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="asset-library-filters">
        <select
          className="filter-dropdown"
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
        >
          <option value="all">All Domains</option>
          <option value="manufacturing">Manufacturing</option>
          <option value="logistics">Logistics</option>
          <option value="medical">Medical</option>
          <option value="construction">Construction</option>
          <option value="primitives">Primitives</option>
        </select>

        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <Grid3x3 size={14} />
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="asset-library-content">
        {isLoading ? (
          <div className="asset-library-empty">
            <div className="asset-library-empty-icon">⏳</div>
            <div className="asset-library-empty-text">Loading library...</div>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="asset-library-empty">
            <div className="asset-library-empty-icon">📦</div>
            <div className="asset-library-empty-text">No assets found</div>
          </div>
        ) : viewMode === 'list' ? (
          <div className="asset-list">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className="asset-list-item"
                draggable
                onDragStart={(e) => handleAssetDragStart(asset, e)}
                onDragEnd={handleAssetDragEnd}
                onDoubleClick={() => handleAssetDoubleClick(asset)}
              >
                <div className="asset-list-thumbnail">
                  <Package size={24} className="asset-card-thumbnail-placeholder" />
                </div>
                <div className="asset-list-info">
                  <div className="asset-list-name">{asset.name}</div>
                  <div className="asset-list-specs">
                    {asset.assetClass} • {asset.manufacturer || 'Generic'}
                    {asset.capabilities?.dof && ` • ${asset.capabilities.dof} DOF`}
                    {asset.capabilities?.payload &&
                      ` • ${asset.capabilities.payload}kg`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`asset-grid ${viewMode}`}>
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className="asset-card"
                draggable
                onDragStart={(e) => handleAssetDragStart(asset, e)}
                onDragEnd={handleAssetDragEnd}
                onDoubleClick={() => handleAssetDoubleClick(asset)}
                title={asset.description || asset.name}
              >
                <div className="asset-card-thumbnail">
                  {asset.thumbnail ? (
                    <img src={asset.thumbnail} alt={asset.name} />
                  ) : (
                    <Package size={32} className="asset-card-thumbnail-placeholder" />
                  )}
                </div>
                <div className="asset-card-name">{asset.name}</div>
                {viewMode === 'comfortable' && (
                  <div className="asset-card-specs">
                    {asset.capabilities?.dof && `${asset.capabilities.dof}-axis`}
                    {asset.capabilities?.payload &&
                      ` • ${asset.capabilities.payload}kg`}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
