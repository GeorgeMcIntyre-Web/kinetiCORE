// FilterPane - Left pane with category tree and filters
// Owner: Edwin + George (Agent 1 - Fixed search + updated categories)
// Engineering-focused filtering with hierarchical categories

import { useState } from 'react';
import { ChevronRight, ChevronDown, Search } from 'lucide-react';
import { useAssetLibraryStore } from '../../store/assetLibraryStore';
import type { Domain, AssetClass } from '../../../library/types';
import './FilterPane.css';

interface CategoryNode {
  id: string;
  label: string;
  count?: number;
  children?: CategoryNode[];
  domain?: Domain;
  assetClass?: AssetClass;
}

// Updated Category hierarchy - simplified and practical
const CATEGORY_TREE: CategoryNode[] = [
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    domain: 'manufacturing',
    children: [
      { id: 'robots-articulated', label: 'Articulated Robots', assetClass: 'robots' },
      { id: 'robots-scara', label: 'SCARA Robots', assetClass: 'robots' },
      { id: 'robots-delta', label: 'Delta Robots', assetClass: 'robots' },
      { id: 'robots-collaborative', label: 'Collaborative Robots', assetClass: 'robots' },
      { id: 'endeffectors', label: 'End Effectors & Grippers', assetClass: 'endEffectors' },
      { id: 'conveyors', label: 'Conveyors', assetClass: 'machinery' },
      { id: 'stations', label: 'Workstations', assetClass: 'structures' },
    ],
  },
  {
    id: 'logistics',
    label: 'Logistics & Warehousing',
    domain: 'logistics',
    children: [
      { id: 'vehicles-agv', label: 'AGVs / AMRs', assetClass: 'vehicles' },
      { id: 'vehicles-forklift', label: 'Forklifts', assetClass: 'vehicles' },
      { id: 'storage-racks', label: 'Storage Racks', assetClass: 'structures' },
      { id: 'storage-shelving', label: 'Shelving Systems', assetClass: 'structures' },
      { id: 'pallets', label: 'Pallets & Containers', assetClass: 'tools' },
    ],
  },
  {
    id: 'structures',
    label: 'Structural Components',
    domain: 'construction',
    children: [
      { id: 'framing', label: 'Framing (T-slot, I-beam)', assetClass: 'structures' },
      { id: 'panels', label: 'Panels & Plates', assetClass: 'structures' },
      { id: 'fasteners', label: 'Fasteners & Hardware', assetClass: 'tools' },
      { id: 'guards', label: 'Safety Guards & Fencing', assetClass: 'structures' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom & Imported',
    domain: 'custom',
    children: [
      { id: 'custom-user', label: 'My Imported Assets', assetClass: 'custom' },
      { id: 'custom-shared', label: 'Shared Assets', assetClass: 'custom' },
    ],
  },
];

export function FilterPaneFixed() {
  const { filters, setFilter, expandedCategories, toggleCategory, resetFilters } =
    useAssetLibraryStore();

  // Local state for search input to avoid any Zustand issues
  const [searchValue, setSearchValue] = useState(filters.searchQuery || '');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    setFilter('searchQuery', value);
  };

  const handleCategoryClick = (node: CategoryNode) => {
    toggleCategory(node.id);

    // Set domain/class filter when clicking a category
    if (node.domain) {
      setFilter('domains', [node.domain]);
    }
    if (node.assetClass) {
      setFilter('assetClasses', [node.assetClass]);
    }
  };

  const renderCategoryNode = (node: CategoryNode, depth: number = 0) => {
    const isExpanded = expandedCategories.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isActive =
      (node.domain && filters.domains?.includes(node.domain)) ||
      (node.assetClass && filters.assetClasses?.includes(node.assetClass));

    return (
      <div key={node.id} className="category-node">
        <div
          className={`category-item ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleCategoryClick(node)}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} className="category-chevron" />
            ) : (
              <ChevronRight size={14} className="category-chevron" />
            )
          ) : (
            <span className="category-spacer" />
          )}
          <span className="category-label">{node.label}</span>
          {node.count !== undefined && (
            <span className="category-count">{node.count}</span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="category-children">
            {node.children!.map((child) => renderCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="filter-pane">
      {/* Search - Fixed version with local state */}
      <div className="filter-search">
        <Search size={14} className="filter-search-icon" />
        <input
          type="text"
          className="filter-search-input"
          placeholder="Search assets..."
          value={searchValue}
          onChange={handleSearchChange}
          onKeyDown={(e) => {
            // Prevent event propagation to allow backspace/delete
            e.stopPropagation();
          }}
          onClick={(e) => {
            // Prevent click propagation
            e.stopPropagation();
          }}
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      {/* Category Tree */}
      <div className="filter-section">
        <div className="filter-section-header">
          <span>Categories</span>
          <button
            className="filter-reset-btn"
            onClick={(e) => {
              e.stopPropagation();
              setSearchValue('');
              resetFilters();
            }}
          >
            Reset
          </button>
        </div>
        <div className="category-tree">{CATEGORY_TREE.map((node) => renderCategoryNode(node))}</div>
      </div>

      {/* Filters */}
      <div className="filter-section">
        <div className="filter-section-header">Filters</div>

        {/* Payload Range */}
        <div className="filter-group">
          <label className="filter-label">
            Payload: {filters.payloadRange?.[0] || 0} - {filters.payloadRange?.[1] || 50} kg
          </label>
          <input
            type="range"
            className="filter-slider"
            min="0"
            max="50"
            step="5"
            value={filters.payloadRange?.[1] || 50}
            onChange={(e) =>
              setFilter('payloadRange', [0, parseInt(e.target.value)])
            }
          />
        </div>

        {/* Reach Range */}
        <div className="filter-group">
          <label className="filter-label">
            Reach: {filters.reachRange?.[0] || 0} - {filters.reachRange?.[1] || 3000} mm
          </label>
          <input
            type="range"
            className="filter-slider"
            min="0"
            max="3000"
            step="100"
            value={filters.reachRange?.[1] || 3000}
            onChange={(e) =>
              setFilter('reachRange', [0, parseInt(e.target.value)])
            }
          />
        </div>

        {/* DOF Range */}
        <div className="filter-group">
          <label className="filter-label">
            Degrees of Freedom: {filters.dofRange?.[0] || 1} - {filters.dofRange?.[1] || 7}
          </label>
          <input
            type="range"
            className="filter-slider"
            min="1"
            max="7"
            step="1"
            value={filters.dofRange?.[1] || 7}
            onChange={(e) =>
              setFilter('dofRange', [1, parseInt(e.target.value)])
            }
          />
        </div>

        {/* Has Kinematics */}
        <div className="filter-group">
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={filters.hasKinematics || false}
              onChange={(e) => setFilter('hasKinematics', e.target.checked || undefined)}
            />
            <span>Has Kinematics</span>
          </label>
        </div>
      </div>
    </div>
  );
}
