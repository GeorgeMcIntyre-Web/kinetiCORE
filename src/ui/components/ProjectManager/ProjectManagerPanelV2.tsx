/**
 * Project Manager Panel V2 - Three-Pane Engineering UI
 * Owner: Edwin
 * Modern project browser with Filter | Browser | Details layout
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { useProjectManagerStore } from '../../store/projectManagerStore';
import { ProjectFilterPane } from './ProjectFilterPane';
import { ProjectBrowserPane } from './ProjectBrowserPane';
import { ProjectDetailsPane } from './ProjectDetailsPane';
import { CreateProjectDialog } from './CreateProjectDialog';
import { ProjectManager } from '../../../project/ProjectManager';
import './ProjectManagerPanelV2.css';

export function ProjectManagerPanelV2() {
  const { isVisible, hide } = useProjectManagerStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const projectManager = ProjectManager.getInstance();

  const handleCreateProject = async (config: {
    name: string;
    description?: string;
    category: 'simulation' | 'layout' | 'prototype' | 'production' | 'training' | 'research';
    visibility: 'private' | 'team' | 'public';
    tags?: string[];
  }) => {
    try {
      const project = await projectManager.createProject(config);
      console.log('Project created:', project);
      // Refresh the project list by triggering a re-render
      // The ProjectBrowserPane will reload projects when filters change
      useProjectManagerStore.getState().setFilter('search', '');
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="project-manager-overlay" onClick={hide}>
      <div
        className="project-manager-container-v2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="project-manager-header-v2">
          <h2 className="project-manager-title-v2">Project Manager</h2>
          <button className="project-manager-close-btn" onClick={hide} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Three-pane layout */}
        <div className="project-manager-body-v2">
          <ProjectFilterPane />
          <ProjectBrowserPane onCreateProject={() => setShowCreateDialog(true)} />
          <ProjectDetailsPane />
        </div>
      </div>

      {/* Create Project Dialog */}
      <CreateProjectDialog
        isVisible={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}
