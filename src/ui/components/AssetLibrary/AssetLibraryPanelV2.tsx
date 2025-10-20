// AssetLibraryPanel V2 - Three-Pane Engineering UI
// Owner: Edwin
// Modern asset browser with Filter | Browser | Details layout

import { X } from 'lucide-react';
import { useAssetLibraryStore } from '../../store/assetLibraryStore';
import { FilterPane } from './FilterPane';
import { BrowserPane } from './BrowserPane';
import { DetailsPane } from './DetailsPane';
import './AssetLibraryPanelV2.css';

export function AssetLibraryPanelV2() {
  const { isVisible, hide } = useAssetLibraryStore();

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
          <button className="asset-library-close-btn" onClick={hide} title="Close">
            <X size={20} />
          </button>
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
