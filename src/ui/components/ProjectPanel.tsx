/**
 * Project Panel Component
 * Owner: Edwin
 * 
 * Main UI component for project management, including project browser,
 * creation, and collaboration features
 */

import React, { useState, useEffect } from 'react';
import { ProjectManager } from '../../project/ProjectManager';
import { ProjectLoadDialog } from './ProjectLoadDialog';
import type { Project, ProjectFilters, ProjectCategory, ProjectStatus, ProjectSave } from '../../project/types';
import './ProjectPanel.css';

interface ProjectPanelProps {
  onProjectSelect?: (project: Project) => void;
  onProjectCreate?: (project: Project) => void;
  onProjectLoad?: (save: ProjectSave) => void;
}

export const ProjectPanel: React.FC<ProjectPanelProps> = ({
  onProjectSelect,
  onProjectCreate,
  onProjectLoad,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProjectFilters>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const projectManager = ProjectManager.getInstance();

  // Load projects on component mount
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

  const handleProjectSelect = async (project: Project) => {
    try {
      await projectManager.setCurrentProject(project.id);
      setSelectedProject(project);
      onProjectSelect?.(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select project');
    }
  };

  const handleCreateProject = async (config: {
    name: string;
    description?: string;
    category: ProjectCategory;
    visibility: 'private' | 'team' | 'public';
    tags?: string[];
  }) => {
    try {
      const project = await projectManager.createProject(config);
      setProjects(prev => [project, ...prev]);
      setShowCreateDialog(false);
      onProjectCreate?.(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await projectManager.deleteProject(project.id);
      setProjects(prev => prev.filter(p => p.id !== project.id));
      if (selectedProject?.id === project.id) {
        setSelectedProject(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const handleLoadProject = (project: Project) => {
    setSelectedProject(project);
    setShowLoadDialog(true);
  };

  const handleProjectLoad = (save: ProjectSave) => {
    onProjectLoad?.(save);
    setShowLoadDialog(false);
  };

  const getStatusColor = (status: ProjectStatus): string => {
    switch (status) {
      case 'draft': return 'project-status-draft';
      case 'active': return 'project-status-active';
      case 'completed': return 'project-status-completed';
      case 'archived': return 'project-status-archived';
      default: return 'project-status-draft';
    }
  };

  const getStatusIcon = (status: ProjectStatus): string => {
    switch (status) {
      case 'draft': return '📝';
      case 'active': return '🔄';
      case 'completed': return '✅';
      case 'archived': return '📦';
      default: return '📝';
    }
  };

  const getCategoryIcon = (category: ProjectCategory): string => {
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

  return (
    <div className="project-panel-container">
      {/* Header */}
      <div className="project-panel-header">
        <h2 className="project-panel-title">Projects</h2>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="project-panel-new-btn"
        >
          New Project
        </button>
      </div>

      {/* Search and Filters */}
      <div className="project-panel-filters">
        <div className="project-panel-search">
          <div className="project-panel-search-icon">🔍</div>
          <input
            type="text"
            placeholder="Search projects..."
            value={filters.search || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="project-panel-search-input"
          />
        </div>
        
        <div className="project-panel-filter-row">
          <select
            value={filters.status?.[0] || ''}
            onChange={(e) => setFilters(prev => ({ 
              ...prev, 
              status: e.target.value ? [e.target.value as ProjectStatus] : undefined 
            }))}
            className="project-panel-filter-select"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={filters.category?.[0] || ''}
            onChange={(e) => setFilters(prev => ({ 
              ...prev, 
              category: e.target.value ? [e.target.value as ProjectCategory] : undefined 
            }))}
            className="project-panel-filter-select"
          >
            <option value="">All Categories</option>
            <option value="simulation">Simulation</option>
            <option value="layout">Layout</option>
            <option value="prototype">Prototype</option>
            <option value="production">Production</option>
            <option value="training">Training</option>
            <option value="research">Research</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="project-panel-error">
          <p className="project-panel-error-text">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="project-panel-content">
        {loading ? (
          <div className="project-panel-loading">
            <div className="project-panel-loading-spinner"></div>
            <div>Loading projects...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="project-panel-empty">
            <div className="project-panel-empty-icon">📁</div>
            <p className="project-panel-empty-text">No projects found</p>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="project-panel-empty-btn"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="project-panel-list">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`project-card ${
                  selectedProject?.id === project.id ? 'selected' : ''
                }`}
                onClick={() => handleProjectSelect(project)}
              >
                <div className="project-card-header">
                  <div className="project-card-info">
                    <div className="project-card-title-row">
                      <span className="project-card-icon">{getCategoryIcon(project.category)}</span>
                      <h3 className="project-card-name">{project.name}</h3>
                      <span className={`project-card-status ${getStatusColor(project.status)}`}>
                        {getStatusIcon(project.status)}
                      </span>
                    </div>
                    
                    {project.description && (
                      <p className="project-card-description">
                        {project.description}
                      </p>
                    )}

                    <div className="project-card-meta">
                      <span>{project.assetInstances.length} assets</span>
                      <span className="project-card-meta-separator">•</span>
                      <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                      {project.visibility !== 'private' && (
                        <>
                          <span className="project-card-meta-separator">•</span>
                          <span className="capitalize">{project.visibility}</span>
                        </>
                      )}
                    </div>

                    {project.tags.length > 0 && (
                      <div className="project-card-tags">
                        {project.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="project-card-tag">
                            {tag}
                          </span>
                        ))}
                        {project.tags.length > 3 && (
                          <span className="project-card-tag-more">
                            +{project.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="project-card-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadProject(project);
                      }}
                      className="project-card-action-btn load"
                      title="Load project saves"
                    >
                      📂
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project);
                      }}
                      className="project-card-action-btn delete"
                      title="Delete project"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Dialog */}
      {showCreateDialog && (
        <CreateProjectDialog
          onClose={() => setShowCreateDialog(false)}
          onCreate={handleCreateProject}
        />
      )}

      {/* Load Project Dialog */}
      {showLoadDialog && selectedProject && (
        <ProjectLoadDialog
          project={selectedProject}
          onClose={() => setShowLoadDialog(false)}
          onLoad={handleProjectLoad}
        />
      )}
    </div>
  );
};

// Create Project Dialog Component
interface CreateProjectDialogProps {
  onClose: () => void;
  onCreate: (config: {
    name: string;
    description?: string;
    category: ProjectCategory;
    visibility: 'private' | 'team' | 'public';
    tags?: string[];
  }) => void;
}

const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'simulation' as ProjectCategory,
    visibility: 'private' as 'private' | 'team' | 'public',
    tags: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const tags = formData.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    onCreate({
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      category: formData.category,
      visibility: formData.visibility,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  return (
    <div className="project-dialog-overlay">
      <div className="project-dialog-container">
        <div className="project-dialog-header">
          <h3 className="project-dialog-title">Create New Project</h3>
          <button
            onClick={onClose}
            className="project-dialog-close-btn"
          >
            ✕
          </button>
        </div>
        
        <div className="project-dialog-content">
          <form onSubmit={handleSubmit} className="project-dialog-form">
            <div className="project-dialog-field">
              <label className="project-dialog-label">
                Project Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="project-dialog-input"
                placeholder="Enter project name"
                required
              />
            </div>

            <div className="project-dialog-field">
              <label className="project-dialog-label">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="project-dialog-textarea"
                placeholder="Enter project description"
                rows={3}
              />
            </div>

            <div className="project-dialog-field">
              <label className="project-dialog-label">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as ProjectCategory }))}
                className="project-dialog-select"
              >
                <option value="simulation">🎮 Simulation</option>
                <option value="layout">🏗️ Layout</option>
                <option value="prototype">🔬 Prototype</option>
                <option value="production">🏭 Production</option>
                <option value="training">🎓 Training</option>
                <option value="research">🔬 Research</option>
              </select>
            </div>

            <div className="project-dialog-field">
              <label className="project-dialog-label">
                Visibility
              </label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value as 'private' | 'team' | 'public' }))}
                className="project-dialog-select"
              >
                <option value="private">🔒 Private</option>
                <option value="team">👥 Team</option>
                <option value="public">🌐 Public</option>
              </select>
            </div>

            <div className="project-dialog-field">
              <label className="project-dialog-label">
                Tags
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                className="project-dialog-input"
                placeholder="Enter tags separated by commas"
              />
            </div>

            <div className="project-dialog-actions">
              <button
                type="button"
                onClick={onClose}
                className="project-dialog-btn secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="project-dialog-btn primary"
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
