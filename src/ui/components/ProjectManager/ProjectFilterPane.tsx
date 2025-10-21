/**
 * Project Filter Pane
 * Owner: Edwin
 * 
 * Left pane for project filtering and categorization
 */

import React from 'react';
import { useProjectManagerStore } from '../../store/projectManagerStore';
import type { ProjectCategory, ProjectStatus } from '../../../project/types';
import './ProjectFilterPane.css';

export const ProjectFilterPane: React.FC = () => {
  const { 
    filters, 
    setFilter, 
    resetFilters
  } = useProjectManagerStore();

  const categories: { key: ProjectCategory; label: string; icon: string; count?: number }[] = [
    { key: 'simulation', label: 'Simulation', icon: '🎮', count: 12 },
    { key: 'layout', label: 'Layout', icon: '🏗️', count: 8 },
    { key: 'prototype', label: 'Prototype', icon: '🔬', count: 5 },
    { key: 'production', label: 'Production', icon: '🏭', count: 15 },
    { key: 'training', label: 'Training', icon: '🎓', count: 3 },
    { key: 'research', label: 'Research', icon: '🔬', count: 7 },
  ];

  const statuses: { key: ProjectStatus; label: string; icon: string; count?: number }[] = [
    { key: 'draft', label: 'Draft', icon: '📝', count: 8 },
    { key: 'active', label: 'Active', icon: '🔄', count: 25 },
    { key: 'completed', label: 'Completed', icon: '✅', count: 12 },
    { key: 'archived', label: 'Archived', icon: '📦', count: 5 },
  ];

  return (
    <div className="project-filter-pane">
      {/* Search */}
      <div className="project-filter-search">
        <div className="project-filter-search-icon">🔍</div>
        <input
          type="text"
          placeholder="Q Search..."
          value={filters.search || ''}
          onChange={(e) => setFilter('search', e.target.value || undefined)}
          className="project-filter-search-input"
        />
      </div>

      {/* Categories */}
      <div className="project-filter-section">
        <div className="project-filter-section-header">
          <span>CATEGORIES</span>
          <button className="project-filter-reset-btn" onClick={resetFilters}>
            Reset
          </button>
        </div>
        <div className="project-category-tree">
          {categories.map((category) => (
            <div key={category.key} className="project-category-node">
              <div 
                className={`project-category-item ${
                  filters.category?.includes(category.key) ? 'active' : ''
                }`}
                onClick={() => {
                  const currentCategories = filters.category || [];
                  const newCategories = currentCategories.includes(category.key)
                    ? currentCategories.filter(c => c !== category.key)
                    : [...currentCategories, category.key];
                  setFilter('category', newCategories.length > 0 ? newCategories : undefined);
                }}
              >
                <span className="project-category-label">{category.label}</span>
                {category.count && (
                  <span className="project-category-count">{category.count}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div className="project-filter-section">
        <div className="project-filter-section-header">
          <span>STATUS</span>
        </div>
        <div className="project-status-tree">
          {statuses.map((status) => (
            <div key={status.key} className="project-status-node">
              <div 
                className={`project-status-item ${
                  filters.status?.includes(status.key) ? 'active' : ''
                }`}
                onClick={() => {
                  const currentStatuses = filters.status || [];
                  const newStatuses = currentStatuses.includes(status.key)
                    ? currentStatuses.filter(s => s !== status.key)
                    : [...currentStatuses, status.key];
                  setFilter('status', newStatuses.length > 0 ? newStatuses : undefined);
                }}
              >
                <span className="project-status-icon">{status.icon}</span>
                <span className="project-status-label">{status.label}</span>
                {status.count && (
                  <span className="project-status-count">{status.count}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visibility Filter */}
      <div className="project-filter-section">
        <div className="project-filter-section-header">
          <span>VISIBILITY</span>
        </div>
        <div className="project-visibility-tree">
          <div 
            className={`project-visibility-item ${
              filters.visibility?.includes('private') ? 'active' : ''
            }`}
            onClick={() => {
              const currentVisibility = filters.visibility || [];
              const newVisibility = currentVisibility.includes('private')
                ? currentVisibility.filter(v => v !== 'private')
                : [...currentVisibility, 'private'];
              setFilter('visibility', newVisibility.length > 0 ? newVisibility as ('private' | 'team' | 'public')[] : undefined);
            }}
          >
            <span className="project-visibility-icon">🔒</span>
            <span className="project-visibility-label">Private</span>
            <span className="project-visibility-count">32</span>
          </div>
          <div 
            className={`project-visibility-item ${
              filters.visibility?.includes('team') ? 'active' : ''
            }`}
            onClick={() => {
              const currentVisibility = filters.visibility || [];
              const newVisibility = currentVisibility.includes('team')
                ? currentVisibility.filter(v => v !== 'team')
                : [...currentVisibility, 'team'];
              setFilter('visibility', newVisibility.length > 0 ? newVisibility as ('private' | 'team' | 'public')[] : undefined);
            }}
          >
            <span className="project-visibility-icon">👥</span>
            <span className="project-visibility-label">Team</span>
            <span className="project-visibility-count">15</span>
          </div>
          <div 
            className={`project-visibility-item ${
              filters.visibility?.includes('public') ? 'active' : ''
            }`}
            onClick={() => {
              const currentVisibility = filters.visibility || [];
              const newVisibility = currentVisibility.includes('public')
                ? currentVisibility.filter(v => v !== 'public')
                : [...currentVisibility, 'public'];
              setFilter('visibility', newVisibility.length > 0 ? newVisibility as ('private' | 'team' | 'public')[] : undefined);
            }}
          >
            <span className="project-visibility-icon">🌐</span>
            <span className="project-visibility-label">Public</span>
            <span className="project-visibility-count">8</span>
          </div>
        </div>
      </div>
    </div>
  );
};
