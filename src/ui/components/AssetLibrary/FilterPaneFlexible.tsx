// FilterPane - Flexible category system with user-defined categories
// Owner: George (Agent 1)
// Allows users to create custom categories and organize assets

import { useState } from 'react';
import { ChevronRight, ChevronDown, Search, Plus, Settings } from 'lucide-react';
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
  userDefined?: boolean;
}

// Simplified, generic category structure
const DEFAULT_CATEGORIES: CategoryNode[] = [
  {
    id: 'robots',
    label: 'Robots',
    domain: 'manufacturing',
    assetClass: 'robots',
  },
  {
    id: 'equipment',
    label: 'Equipment & Machinery',
    domain: 'manufacturing',
    assetClass: 'machinery',
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    domain: 'logistics',
    assetClass: 'vehicles',
  },
  {
    id: 'structures',
    label: 'Structures & Buildings',
    domain: 'construction',
    assetClass: 'structures',
  },
  {
    id: 'tools',
    label: 'Tools & Accessories',
    domain: 'manufacturing',
    assetClass: 'tools',
  },
  {
    id: 'custom',
    label: 'My Assets',
    domain: 'custom',
    assetClass: 'custom',
    children: [
      { id: 'custom-imported', label: 'Imported', assetClass: 'custom' },
      { id: 'custom-created', label: 'Created in Scene', assetClass: 'custom' },
    ],
  },
];

export function FilterPaneFlexible() {
  const { filters, setFilter, expandedCategories, toggleCategory, resetFilters } =
    useAssetLibraryStore();

  // Local state for search input to avoid Zustand issues
  const [searchValue, setSearchValue] = useState(filters.searchQuery || '');
  const [categories, setCategories] = useState<CategoryNode[]>(DEFAULT_CATEGORIES);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

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

  const handleAddCategory = () => {
    const newCategoryName = prompt('Enter category name:');
    if (!newCategoryName) return;

    const newCategory: CategoryNode = {
      id: `user-${Date.now()}`,
      label: newCategoryName,
      domain: 'custom',
      assetClass: 'custom',
      userDefined: true,
    };

    setCategories([...categories, newCategory]);
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
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      {/* Category Tree */}
      <div className="filter-section">
        <div className="filter-section-header">
          <span>Categories</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="filter-reset-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleAddCategory();
              }}
              title="Add custom category"
              style={{ padding: '4px' }}
            >
              <Plus size={14} />
            </button>
            <button
              className="filter-reset-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowCategoryManager(!showCategoryManager);
              }}
              title="Manage categories"
              style={{ padding: '4px' }}
            >
              <Settings size={14} />
            </button>
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
        </div>

        {showCategoryManager && (
          <div
            style={{
              padding: '8px',
              marginBottom: '8px',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '4px',
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            💡 Tip: Click <Plus size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> to create custom categories.
            Assets are auto-categorized by their metadata.
          </div>
        )}

        <div className="category-tree">{categories.map((node) => renderCategoryNode(node))}</div>
      </div>

      {/* Filters */}
      <div className="filter-section">
        <div className="filter-section-header">Filters</div>

        {/* Asset Type Quick Filters */}
        <div className="filter-group">
          <label className="filter-label">Asset Type</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={filters.assetTypes?.includes('articulated') || false}
                onChange={(e) => {
                  const current = filters.assetTypes || [];
                  const updated = e.target.checked
                    ? [...current, 'articulated']
                    : current.filter((t) => t !== 'articulated');
                  setFilter('assetTypes', updated.length > 0 ? updated : undefined);
                }}
              />
              <span>Articulated Robots</span>
            </label>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={filters.assetTypes?.includes('scara') || false}
                onChange={(e) => {
                  const current = filters.assetTypes || [];
                  const updated = e.target.checked
                    ? [...current, 'scara']
                    : current.filter((t) => t !== 'scara');
                  setFilter('assetTypes', updated.length > 0 ? updated : undefined);
                }}
              />
              <span>SCARA Robots</span>
            </label>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={filters.assetTypes?.includes('delta') || false}
                onChange={(e) => {
                  const current = filters.assetTypes || [];
                  const updated = e.target.checked
                    ? [...current, 'delta']
                    : current.filter((t) => t !== 'delta');
                  setFilter('assetTypes', updated.length > 0 ? updated : undefined);
                }}
              />
              <span>Delta Robots</span>
            </label>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={filters.assetTypes?.includes('collaborative') || false}
                onChange={(e) => {
                  const current = filters.assetTypes || [];
                  const updated = e.target.checked
                    ? [...current, 'collaborative']
                    : current.filter((t) => t !== 'collaborative');
                  setFilter('assetTypes', updated.length > 0 ? updated : undefined);
                }}
              />
              <span>Collaborative Robots</span>
            </label>
          </div>
        </div>

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
