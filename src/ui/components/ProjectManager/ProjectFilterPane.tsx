/**
 * Project Filter Pane
 * Owner: Edwin
 * 
 * Left pane for project filtering and categorization
 */

import React from 'react';
import { 
  Search, 
  Gamepad2, 
  Building2, 
  FlaskConical, 
  Factory, 
  GraduationCap, 
  Microscope,
  FileText,
  PlayCircle,
  CheckCircle,
  Archive,
  Lock,
  Users,
  Globe,
  RotateCcw,
  FolderOpen,
  Activity,
  Eye,
  Palette,
  BarChart3,
  TestTube,
  Wrench,
  BookOpen,
  Network,
  TrendingUp,
  ShieldCheck,
  Gift,
  ShoppingCart
} from 'lucide-react';
import { useProjectManagerStore } from '../../store/projectManagerStore';
import type { ProjectCategory, ProjectStatus } from '../../../project/types';
import './ProjectFilterPane.css';

export const ProjectFilterPane: React.FC = () => {
  const { 
    filters, 
    setFilter, 
    resetFilters
  } = useProjectManagerStore();

  const categories: { key: ProjectCategory; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'simulation', label: 'Simulation', icon: <Gamepad2 size={14} />, count: 12 },
    { key: 'layout', label: 'Layout', icon: <Building2 size={14} />, count: 8 },
    { key: 'prototype', label: 'Prototype', icon: <FlaskConical size={14} />, count: 5 },
    { key: 'production', label: 'Production', icon: <Factory size={14} />, count: 15 },
    { key: 'training', label: 'Training', icon: <GraduationCap size={14} />, count: 3 },
    { key: 'research', label: 'Research', icon: <Microscope size={14} />, count: 7 },
    { key: 'design', label: 'Design', icon: <Palette size={14} />, count: 9 },
    { key: 'analysis', label: 'Analysis', icon: <BarChart3 size={14} />, count: 6 },
    { key: 'testing', label: 'Testing', icon: <TestTube size={14} />, count: 4 },
    { key: 'maintenance', label: 'Maintenance', icon: <Wrench size={14} />, count: 8 },
    { key: 'documentation', label: 'Documentation', icon: <BookOpen size={14} />, count: 2 },
    { key: 'integration', label: 'Integration', icon: <Network size={14} />, count: 5 },
    { key: 'optimization', label: 'Optimization', icon: <TrendingUp size={14} />, count: 3 },
    { key: 'compliance', label: 'Compliance', icon: <ShieldCheck size={14} />, count: 1 },
  ];

  const statuses: { key: ProjectStatus; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'draft', label: 'Draft', icon: <FileText size={14} />, count: 8 },
    { key: 'active', label: 'Active', icon: <PlayCircle size={14} />, count: 25 },
    { key: 'completed', label: 'Completed', icon: <CheckCircle size={14} />, count: 12 },
    { key: 'archived', label: 'Archived', icon: <Archive size={14} />, count: 5 },
  ];

  return (
    <div className="project-filter-pane">
      {/* Search */}
      <div className="project-filter-search">
        <div className="project-filter-search-icon">
          <Search size={14} />
        </div>
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
          <div className="project-filter-section-title">
            <FolderOpen size={12} />
            <span>CATEGORIES</span>
          </div>
          <button className="project-filter-reset-btn" onClick={resetFilters}>
            <RotateCcw size={10} />
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
                <span className="project-category-icon">{category.icon}</span>
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
          <div className="project-filter-section-title">
            <Activity size={12} />
            <span>STATUS</span>
          </div>
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
          <div className="project-filter-section-title">
            <Eye size={12} />
            <span>VISIBILITY</span>
          </div>
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
            <span className="project-visibility-icon"><Lock size={14} /></span>
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
            <span className="project-visibility-icon"><Users size={14} /></span>
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
            <span className="project-visibility-icon"><Globe size={14} /></span>
            <span className="project-visibility-label">Public</span>
            <span className="project-visibility-count">8</span>
          </div>
        </div>
      </div>

      {/* Asset Origin Filter */}
      <div className="project-filter-section">
        <div className="project-filter-section-header">
          <div className="project-filter-section-title">
            <Factory size={12} />
            <span>ASSET ORIGIN</span>
          </div>
        </div>
        <div className="project-origin-tree">
          <div 
            className={`project-origin-item ${
              filters.assetOriginTypes?.includes('freeIssue') ? 'active' : ''
            }`}
            onClick={() => {
              const currentOrigins = filters.assetOriginTypes || [];
              const newOrigins = currentOrigins.includes('freeIssue')
                ? currentOrigins.filter(o => o !== 'freeIssue')
                : [...currentOrigins, 'freeIssue'];
              setFilter('assetOriginTypes', newOrigins.length > 0 ? newOrigins as ('freeIssue' | 'reused' | 'purchased' | 'internal' | 'custom')[] : undefined);
            }}
          >
            <span className="project-origin-icon"><Gift size={14} /></span>
            <span className="project-origin-label">Free Issue</span>
            <span className="project-origin-count">3</span>
          </div>
          <div 
            className={`project-origin-item ${
              filters.assetOriginTypes?.includes('reused') ? 'active' : ''
            }`}
            onClick={() => {
              const currentOrigins = filters.assetOriginTypes || [];
              const newOrigins = currentOrigins.includes('reused')
                ? currentOrigins.filter(o => o !== 'reused')
                : [...currentOrigins, 'reused'];
              setFilter('assetOriginTypes', newOrigins.length > 0 ? newOrigins as ('freeIssue' | 'reused' | 'purchased' | 'internal' | 'custom')[] : undefined);
            }}
          >
            <span className="project-origin-icon"><RotateCcw size={14} /></span>
            <span className="project-origin-label">Reused</span>
            <span className="project-origin-count">7</span>
          </div>
          <div 
            className={`project-origin-item ${
              filters.assetOriginTypes?.includes('purchased') ? 'active' : ''
            }`}
            onClick={() => {
              const currentOrigins = filters.assetOriginTypes || [];
              const newOrigins = currentOrigins.includes('purchased')
                ? currentOrigins.filter(o => o !== 'purchased')
                : [...currentOrigins, 'purchased'];
              setFilter('assetOriginTypes', newOrigins.length > 0 ? newOrigins as ('freeIssue' | 'reused' | 'purchased' | 'internal' | 'custom')[] : undefined);
            }}
          >
            <span className="project-origin-icon"><ShoppingCart size={14} /></span>
            <span className="project-origin-label">Purchased</span>
            <span className="project-origin-count">15</span>
          </div>
          <div 
            className={`project-origin-item ${
              filters.assetOriginTypes?.includes('internal') ? 'active' : ''
            }`}
            onClick={() => {
              const currentOrigins = filters.assetOriginTypes || [];
              const newOrigins = currentOrigins.includes('internal')
                ? currentOrigins.filter(o => o !== 'internal')
                : [...currentOrigins, 'internal'];
              setFilter('assetOriginTypes', newOrigins.length > 0 ? newOrigins as ('freeIssue' | 'reused' | 'purchased' | 'internal' | 'custom')[] : undefined);
            }}
          >
            <span className="project-origin-icon"><Factory size={14} /></span>
            <span className="project-origin-label">Internal</span>
            <span className="project-origin-count">5</span>
          </div>
        </div>
      </div>
    </div>
  );
};
