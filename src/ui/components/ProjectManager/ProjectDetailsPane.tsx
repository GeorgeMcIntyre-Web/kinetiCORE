/**
 * Project Details Pane
 * Owner: Edwin
 * 
 * Right pane for project details and actions
 */

import React, { useState, useEffect } from 'react';
import { useProjectManagerStore } from '../../store/projectManagerStore';
import { ProjectManager } from '../../../project/ProjectManager';
import type { Project, ProjectSave } from '../../../project/types';
import './ProjectDetailsPane.css';

export const ProjectDetailsPane: React.FC = () => {
  const { 
    selectedProject, 
    setSelectedProject,
    setCurrentProject 
  } = useProjectManagerStore();

  const [saves, setSaves] = useState<ProjectSave[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectManager = ProjectManager.getInstance();

  // Load saves when project changes
  useEffect(() => {
    if (selectedProject) {
      loadProjectSaves();
    } else {
      setSaves([]);
    }
  }, [selectedProject]);

  const loadProjectSaves = async () => {
    if (!selectedProject) return;

    try {
      setLoading(true);
      setError(null);
      const savesList = await projectManager.listProjectSaves(selectedProject.id);
      setSaves(savesList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project saves');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadProject = async () => {
    if (!selectedProject) return;

    try {
      await projectManager.setCurrentProject(selectedProject.id);
      setCurrentProject(selectedProject);
      // Close the project manager
      useProjectManagerStore.getState().hide();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;

    if (!confirm(`Are you sure you want to delete "${selectedProject.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await projectManager.deleteProject(selectedProject.id);
      setSelectedProject(null);
      setCurrentProject(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const handleStatusChange = async (newStatus: Project['status']) => {
    if (!selectedProject) return;

    try {
      await projectManager.updateProject(selectedProject.id, { status: newStatus });
      // Update the selected project in the store
      const updatedProject = { ...selectedProject, status: newStatus };
      setSelectedProject(updatedProject);
      useProjectManagerStore.getState().setFilter('search', ''); // Trigger refresh
    } catch (error) {
      console.error('Failed to update project status:', error);
    }
  };

  const handleDuplicateProject = async () => {
    if (!selectedProject) return;

    const newName = prompt(`Enter name for duplicated project:`, `${selectedProject.name} (Copy)`);
    if (!newName) return;

    try {
      const duplicatedProject = await projectManager.duplicateProject(selectedProject.id, newName);
      setSelectedProject(duplicatedProject);
      useProjectManagerStore.getState().setFilter('search', ''); // Trigger refresh
    } catch (error) {
      console.error('Failed to duplicate project:', error);
    }
  };

  const handleExportProject = async () => {
    if (!selectedProject) return;

    try {
      const exportData = await projectManager.exportProject(selectedProject.id);
      
      // Create and download file
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedProject.name}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export project:', error);
    }
  };

  const handleImportProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const newName = prompt(`Enter name for imported project:`, file.name.replace('.json', ''));
        if (!newName) return;

        const importedProject = await projectManager.importProject(text, newName);
        setSelectedProject(importedProject);
        useProjectManagerStore.getState().setFilter('search', ''); // Trigger refresh
      } catch (error) {
        console.error('Failed to import project:', error);
        alert(`Failed to import project: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    input.click();
  };

  const handleLoadSave = async (save: ProjectSave) => {
    if (!selectedProject) return;

    try {
      await projectManager.loadProjectSave(selectedProject.id, save.id);
      // Close the project manager
      useProjectManagerStore.getState().hide();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project save');
    }
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


  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'draft': return 'project-status-draft';
      case 'active': return 'project-status-active';
      case 'completed': return 'project-status-completed';
      case 'archived': return 'project-status-archived';
      default: return 'project-status-draft';
    }
  };

  if (!selectedProject) {
    return (
      <div className="project-details-pane">
        <div className="project-details-empty">
          <div className="project-details-empty-icon">📁</div>
          <div className="project-details-empty-text">Select a project to view details</div>
        </div>
      </div>
    );
  }

  return (
    <div className="project-details-pane">
      {/* Header */}
      <div className="project-details-header">
        <div className="project-details-title-row">
          <span className="project-details-icon">{getCategoryIcon(selectedProject.category)}</span>
          <h3 className="project-details-title">{selectedProject.name}</h3>
        </div>
        <div className="project-details-status">
          <select
            value={selectedProject.status}
            onChange={(e) => handleStatusChange(e.target.value as Project['status'])}
            className={`project-details-status-select ${getStatusColor(selectedProject.status)}`}
          >
            <option value="draft">📝 Draft</option>
            <option value="active">🔄 Active</option>
            <option value="completed">✅ Completed</option>
            <option value="archived">📦 Archived</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="project-details-content">
        {/* Project Info */}
        <div className="project-details-section">
          <h4 className="project-details-section-title">Project Information</h4>
          <div className="project-details-info">
            <div className="project-details-info-row">
              <span className="project-details-info-label">Category:</span>
              <span className="project-details-info-value">{selectedProject.category}</span>
            </div>
            <div className="project-details-info-row">
              <span className="project-details-info-label">Visibility:</span>
              <span className="project-details-info-value">{selectedProject.visibility}</span>
            </div>
            <div className="project-details-info-row">
              <span className="project-details-info-label">Assets:</span>
              <span className="project-details-info-value">{selectedProject.assetInstances.length}</span>
            </div>
            <div className="project-details-info-row">
              <span className="project-details-info-label">Created:</span>
              <span className="project-details-info-value">
                {new Date(selectedProject.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="project-details-info-row">
              <span className="project-details-info-label">Updated:</span>
              <span className="project-details-info-value">
                {new Date(selectedProject.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {selectedProject.description && (
          <div className="project-details-section">
            <h4 className="project-details-section-title">Description</h4>
            <p className="project-details-description">{selectedProject.description}</p>
          </div>
        )}

        {/* Tags */}
        {selectedProject.tags.length > 0 && (
          <div className="project-details-section">
            <h4 className="project-details-section-title">Tags</h4>
            <div className="project-details-tags">
              {selectedProject.tags.map((tag, index) => (
                <span key={index} className="project-details-tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Project Saves */}
        <div className="project-details-section">
          <div className="project-details-section-header">
            <h4 className="project-details-section-title">Project Saves ({saves.length})</h4>
            <button
              className="project-details-new-save-btn"
              onClick={() => {/* TODO: Implement new save dialog */}}
            >
              New Save
            </button>
          </div>
          
          {loading ? (
            <div className="project-details-loading">
              <div className="project-details-loading-spinner"></div>
              <div>Loading saves...</div>
            </div>
          ) : error ? (
            <div className="project-details-error">
              <div className="project-details-error-text">{error}</div>
            </div>
          ) : saves.length === 0 ? (
            <div className="project-details-empty-saves">
              <div className="project-details-empty-saves-text">No saves found</div>
            </div>
          ) : (
            <div className="project-details-saves">
              {saves.map((save) => (
                <div
                  key={save.id}
                  className="project-details-save-item"
                  onClick={() => handleLoadSave(save)}
                >
                  <div className="project-details-save-info">
                    <div className="project-details-save-name">{save.name}</div>
                    <div className="project-details-save-meta">
                      Version {save.version} • {new Date(save.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="project-details-save-actions">
                    <button
                      className="project-details-save-load-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadSave(save);
                      }}
                      title="Load this save"
                    >
                      📂
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="project-details-actions">
        <div className="project-details-actions-row">
          <button
            className="project-details-action-btn primary"
            onClick={handleLoadProject}
          >
            Load Project
          </button>
          <button
            className="project-details-action-btn secondary"
            onClick={handleDuplicateProject}
          >
            Duplicate
          </button>
        </div>
        <div className="project-details-actions-row">
          <button
            className="project-details-action-btn secondary"
            onClick={handleExportProject}
          >
            Export
          </button>
          <button
            className="project-details-action-btn secondary"
            onClick={handleImportProject}
          >
            Import
          </button>
          <button
            className="project-details-action-btn danger"
            onClick={handleDeleteProject}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
