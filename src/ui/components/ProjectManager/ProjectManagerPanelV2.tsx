/**
 * Project Manager Panel V2 - Three-Pane Engineering UI
 * Owner: Edwin
 * Modern project browser with Filter | Browser | Details layout
 */

import { useState } from 'react';
import { X, Minimize2, Maximize2, Pin, PinOff, LayoutGrid, List, PlusCircle } from 'lucide-react';
import { useProjectManagerStore } from '../../store/projectManagerStore';
import { ProjectFilterPane } from './ProjectFilterPane';
import { ProjectBrowserPane } from './ProjectBrowserPane';
import { ProjectDetailsPane } from './ProjectDetailsPane';
import { CreateProjectDialog } from './CreateProjectDialog';
import { ProjectManager } from '../../../project/ProjectManager';
import { ProjectCategory } from '../../../project/types';
import './ProjectManagerPanelV2.css';

export function ProjectManagerPanelV2() {
  const { isVisible, hide, viewMode, setViewMode } = useProjectManagerStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const projectManager = ProjectManager.getInstance();

  const handleCreateProject = async (config: {
    name: string;
    description?: string;
    category: ProjectCategory;
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

          <div className="project-manager-header-actions">
            {/* Action Buttons */}
            <div className="project-manager-action-group">
              <button
                className="project-manager-action-btn create-btn"
                onClick={() => setShowCreateDialog(true)}
                title="Create New Project"
                aria-label="Create new project"
              >
                <PlusCircle size={16} />
              </button>

              <button
                className={`project-manager-action-btn view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
                aria-label="Switch to grid view"
              >
                <LayoutGrid size={16} />
              </button>

              <button
                className={`project-manager-action-btn view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
                aria-label="Switch to list view"
              >
                <List size={16} />
              </button>
            </div>

            {/* Window Control Buttons */}
            <div className="project-manager-header-controls">
              <button
                className={`project-manager-control-btn pin-btn ${isPinned ? 'pinned' : ''}`}
                onClick={() => setIsPinned(!isPinned)}
                title={isPinned ? "Unpin" : "Pin"}
                aria-label={isPinned ? "Unpin panel" : "Pin panel"}
              >
                {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
              </button>

              <button
                className="project-manager-control-btn minimize-btn"
                onClick={() => setIsMinimized(!isMinimized)}
                title="Minimize"
                aria-label="Minimize panel"
              >
                <Minimize2 size={16} />
              </button>

              <button
                className="project-manager-control-btn maximize-btn"
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? "Restore" : "Maximize"}
                aria-label={isMaximized ? "Restore panel" : "Maximize panel"}
              >
                <Maximize2 size={16} />
              </button>

              <button
                className="project-manager-control-btn close-btn"
                onClick={hide}
                title="Close"
                aria-label="Close panel"
              >
                <X size={16} />
              </button>
            </div>
          </div>
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
