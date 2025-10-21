/**
 * Project Browser Pane
 * Owner: Edwin
 * 
 * Center pane for project grid/list view
 */

import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Building2,
  FlaskConical,
  Factory,
  GraduationCap,
  Microscope,
  Palette,
  BarChart3,
  TestTube,
  Wrench,
  BookOpen,
  Network,
  TrendingUp,
  ShieldCheck,
  FileText,
  PlayCircle,
  CheckCircle,
  Archive,
  FolderOpen,
  AlertTriangle,
  Package,
  Calendar,
  Lock,
  Users,
  Globe,
  Eye
} from 'lucide-react';
import { useProjectManagerStore } from '../../store/projectManagerStore';
import { ProjectManager } from '../../../project/ProjectManager';
import type { Project } from '../../../project/types';
import './ProjectBrowserPane.css';

export const ProjectBrowserPane: React.FC<{ onCreateProject?: () => void }> = ({ onCreateProject }) => {
  const {
    filters,
    viewMode,
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

  const getCategoryIcon = (category: string): React.ReactNode => {
    switch (category) {
      case 'simulation': return <Gamepad2 size={20} />;
      case 'layout': return <Building2 size={20} />;
      case 'prototype': return <FlaskConical size={20} />;
      case 'production': return <Factory size={20} />;
      case 'training': return <GraduationCap size={20} />;
      case 'research': return <Microscope size={20} />;
      case 'design': return <Palette size={20} />;
      case 'analysis': return <BarChart3 size={20} />;
      case 'testing': return <TestTube size={20} />;
      case 'maintenance': return <Wrench size={20} />;
      case 'documentation': return <BookOpen size={20} />;
      case 'integration': return <Network size={20} />;
      case 'optimization': return <TrendingUp size={20} />;
      case 'compliance': return <ShieldCheck size={20} />;
      default: return <FolderOpen size={20} />;
    }
  };

  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
      case 'draft': return <FileText size={12} />;
      case 'active': return <PlayCircle size={12} />;
      case 'completed': return <CheckCircle size={12} />;
      case 'archived': return <Archive size={12} />;
      default: return <FileText size={12} />;
    }
  };

  const getStatusColor = (status: string): string => {
  switch (status) {
    case 'draft': return 'status-draft';
    case 'active': return 'status-active';
    case 'completed': return 'status-completed';
    case 'archived': return 'status-archived';
    default: return 'status-draft';
  }
};

const getVisibilityIcon = (visibility: string): React.ReactNode => {
    switch (visibility) {
      case 'private': return <Lock size={10} />;
      case 'team': return <Users size={10} />;
      case 'public': return <Globe size={10} />;
      default: return <Eye size={10} />;
    }
  };

  return (
    <div className="project-browser-pane">
      {/* Header */}
      <div className="project-browser-header">
        <h3 className="project-browser-title">Projects ({projects.length})</h3>
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
            <div className="project-browser-error-icon">
              <AlertTriangle size={48} />
            </div>
            <div className="project-browser-error-text">{error}</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="project-browser-empty">
            <div className="project-browser-empty-icon">
              <FolderOpen size={48} />
            </div>
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
                      <span className="project-spec-label">
                        <Package size={10} />
                        Assets:
                      </span>
                      <span className="project-spec-value">{project.assetInstances.length}</span>
                    </div>
                    <div className="project-spec-row">
                      <span className="project-spec-label">
                        Status:
                      </span>
                      <span className={`project-spec-value ${getStatusColor(project.status)}`}>
                        {getStatusIcon(project.status)} {project.status}
                      </span>
                    </div>
                    <div className="project-spec-row">
                      <span className="project-spec-label">
                        <Calendar size={10} />
                        Updated:
                      </span>
                      <span className="project-spec-value">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="project-spec-row">
                      <span className="project-spec-label">
                        Visibility:
                      </span>
                      <span className="project-spec-value">
                        {getVisibilityIcon(project.visibility)} {project.visibility}
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
                    <span className="project-spec-chip">
                      {getVisibilityIcon(project.visibility)} {project.visibility}
                    </span>
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
