// AssetLibraryPanel V2 - Three-Pane Engineering UI
// Owner: Edwin
// Modern asset browser with Filter | Browser | Details layout

import { useState } from 'react';
import { X, Minimize2, Maximize2, Pin, PinOff, LayoutGrid, List, Crown } from 'lucide-react';
import { useAssetLibraryStore } from '../../store/assetLibraryStore';
import { FilterPane } from './FilterPane';
import { BrowserPane } from './BrowserPane';
import { DetailsPane } from './DetailsPane';
import { AssetLibraryAuth } from '../AssetLibraryAuth';
import './AssetLibraryPanelV2.css';

export function AssetLibraryPanelV2() {
  const { isVisible, hide, viewMode, setViewMode } = useAssetLibraryStore();
  const [isPinned, setIsPinned] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="asset-library-overlay" onClick={hide}>
      <div
        className="asset-library-container-v2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="asset-library-header-v2">
          <h2 className="asset-library-title-v2">Asset Library</h2>

          <div className="asset-library-header-actions">
            {/* Login/Auth */}
            <div className="asset-library-action-group">
              <AssetLibraryAuth 
                onAuthChange={setAuthenticatedUser}
                className="asset-library-auth-component"
              />
            </div>

            {/* View Buttons */}
            <div className="asset-library-action-group">
              <button
                className={`asset-library-action-btn view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
                aria-label="Switch to grid view"
              >
                <LayoutGrid size={16} />
              </button>

              <button
                className={`asset-library-action-btn view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
                aria-label="Switch to list view"
              >
                <List size={16} />
              </button>
            </div>

            {/* Window Control Buttons */}
            <div className="asset-library-header-controls">
              {/* Pro Icon */}
              <button
                className="asset-library-control-btn pro-btn"
                onClick={() => {
                  // TODO: Implement pro features or upgrade flow
                  console.log('Pro features clicked');
                }}
                title="Pro Features - Premium Asset Library Access"
                aria-label="Pro features"
              >
                <Crown size={16} />
              </button>

              <button
                className={`asset-library-control-btn pin-btn ${isPinned ? 'pinned' : ''}`}
                onClick={() => setIsPinned(!isPinned)}
                title={isPinned ? "Unpin" : "Pin"}
                aria-label={isPinned ? "Unpin panel" : "Pin panel"}
              >
                {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
              </button>

              <button
                className="asset-library-control-btn minimize-btn"
                onClick={() => setIsMinimized(!isMinimized)}
                title="Minimize"
                aria-label="Minimize panel"
              >
                <Minimize2 size={16} />
              </button>

              <button
                className="asset-library-control-btn maximize-btn"
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? "Restore" : "Maximize"}
                aria-label={isMaximized ? "Restore panel" : "Maximize panel"}
              >
                <Maximize2 size={16} />
              </button>

              <button
                className="asset-library-control-btn close-btn"
                onClick={hide}
                title="Close"
                aria-label="Close panel"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Three-pane layout */}
        <div className="asset-library-body-v2">
          <FilterPane />
          <BrowserPane />
          <DetailsPane />
        </div>
      </div>
    </div>
  );
}
