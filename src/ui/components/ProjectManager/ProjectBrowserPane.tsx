/**
 * Project Browser Pane
 * Owner: Edwin
 * 
 * Center pane for project grid/list view
 */

import React, { useState, useEffect } from 'react';
import { useProjectManagerStore } from '../../store/projectManagerStore';
import { ProjectManager } from '../../../project/ProjectManager';
import type { Project } from '../../../project/types';
import './ProjectBrowserPane.css';

export const ProjectBrowserPane: React.FC<{ onCreateProject?: () => void }> = ({ onCreateProject }) => {
  const { 
    filters, 
    viewMode, 
    setViewMode, 
    selectedProject, 
    setSelectedProject 
  } = useProjectManagerStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectManager = ProjectManager.getInstance();

  // Load projects when filters change
  useEffect(() => {
    loadProjects();
  }, [filters]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await projectManager.listProjects(filters);
      setProjects(projectList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'simulation': return '🎮';
      case 'layout': return '🏗️';
      case 'prototype': return '🔬';
      case 'production': return '🏭';
      case 'training': return '🎓';
      case 'research': return '🔬';
      default: return '📁';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'draft': return '📝';
      case 'active': return '🔄';
      case 'completed': return '✅';
      case 'archived': return '📦';
      default: return '📝';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'draft': return 'project-status-draft';
      case 'active': return 'project-status-active';
      case 'completed': return 'project-status-completed';
      case 'archived': return 'project-status-archived';
      default: return 'project-status-draft';
    }
  };

  return (
    <div className="project-browser-pane">
      {/* Header */}
      <div className="project-browser-header">
        <h3 className="project-browser-title">Projects ({projects.length})</h3>
        <div className="project-browser-header-actions">
          {projects.length > 0 && (
            <button
              className="project-browser-add-btn"
              onClick={onCreateProject}
              title="Create New Project"
            >
              +
            </button>
          )}
          <div className="project-browser-view-toggle">
            <button
              className={`project-view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              ⊞
            </button>
            <button
              className={`project-view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="project-browser-content">
        {loading ? (
          <div className="project-browser-loading">
            <div className="project-browser-loading-spinner"></div>
            <div>Loading projects...</div>
          </div>
        ) : error ? (
          <div className="project-browser-error">
            <div className="project-browser-error-icon">⚠️</div>
            <div className="project-browser-error-text">{error}</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="project-browser-empty">
            <div className="project-browser-empty-icon">📁</div>
            <div className="project-browser-empty-text">No projects found</div>
            <button
              className="project-browser-empty-btn"
              onClick={onCreateProject}
            >
              Create your first project
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="project-grid-view">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`project-card ${
                  selectedProject?.id === project.id ? 'selected' : ''
                }`}
                onClick={() => handleProjectSelect(project)}
              >
                <div className="project-card-thumbnail">
                  <div className="project-card-thumbnail-icon">
                    {getCategoryIcon(project.category)}
                  </div>
                </div>
                <div className="project-card-content">
                  <div className="project-card-name">{project.name}</div>
                  <div className="project-card-category">{project.category}</div>
                  <div className="project-card-specs">
                    <div className="project-spec-row">
                      <span className="project-spec-label">Assets:</span>
                      <span className="project-spec-value">{project.assetInstances.length}</span>
                    </div>
                    <div className="project-spec-row">
                      <span className="project-spec-label">Status:</span>
                      <span className={`project-spec-value ${getStatusColor(project.status)}`}>
                        {getStatusIcon(project.status)} {project.status}
                      </span>
                    </div>
                    <div className="project-spec-row">
                      <span className="project-spec-label">Updated:</span>
                      <span className="project-spec-value">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="project-card-tags">
                    {project.tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="project-tag-chip">
                        {tag}
                      </span>
                    ))}
                    {project.tags.length > 3 && (
                      <span className="project-tag-chip">
                        +{project.tags.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="project-list-view">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`project-list-item ${
                  selectedProject?.id === project.id ? 'selected' : ''
                }`}
                onClick={() => handleProjectSelect(project)}
              >
                <div className="project-list-thumbnail">
                  <div className="project-list-thumbnail-icon">
                    {getCategoryIcon(project.category)}
                  </div>
                </div>
                <div className="project-list-info">
                  <div className="project-list-name">{project.name}</div>
                  <div className="project-list-meta">
                    {project.category} • {project.assetInstances.length} assets • 
                    Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </div>
                  <div className="project-list-specs">
                    <span className={`project-spec-chip ${getStatusColor(project.status)}`}>
                      {getStatusIcon(project.status)} {project.status}
                    </span>
                    {project.visibility !== 'private' && (
                      <span className="project-spec-chip">
                        {project.visibility}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
