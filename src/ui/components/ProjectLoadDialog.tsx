/**
 * Project Load Dialog Component
 * Owner: Edwin
 * 
 * Dialog for loading project saves and restoring world states
 */

import React, { useState, useEffect } from 'react';
import { ProjectManager } from '../../project/ProjectManager';
import type { Project, ProjectSave } from '../../project/types';

interface ProjectLoadDialogProps {
  project: Project;
  onClose: () => void;
  onLoad?: (save: ProjectSave) => void;
}

export const ProjectLoadDialog: React.FC<ProjectLoadDialogProps> = ({
  project,
  onClose,
  onLoad,
}) => {
  const [saves, setSaves] = useState<ProjectSave[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSave, setSelectedSave] = useState<ProjectSave | null>(null);
  const [loadingSave, setLoadingSave] = useState<string | null>(null);

  const projectManager = ProjectManager.getInstance();

  // Load project saves on mount
  useEffect(() => {
    loadProjectSaves();
  }, [project.id]);

  const loadProjectSaves = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectSaves = await projectManager.listProjectSaves(project.id);
      setSaves(projectSaves);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project saves');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSave = async (save: ProjectSave) => {
    try {
      setLoadingSave(save.id);
      setError(null);

      await projectManager.loadProjectSave(project.id, save.id);
      
      onLoad?.(save);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project save');
    } finally {
      setLoadingSave(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSaveIcon = (save: ProjectSave): string => {
    if (save.isAutoSave) return '🔄';
    if (save.comments.length > 0) return '💬';
    if (save.annotations.length > 0) return '📌';
    return '💾';
  };

  const getSaveType = (save: ProjectSave): string => {
    if (save.isAutoSave) return 'Auto-save';
    if (save.comments.length > 0 || save.annotations.length > 0) return 'Collaborative';
    return 'Manual';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Load Project Save</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        {/* Project Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📁</span>
            <div>
              <h4 className="font-medium text-gray-900">{project.name}</h4>
              <p className="text-sm text-gray-600">
                Version {project.currentVersion} • {project.assetInstances.length} assets
              </p>
            </div>
          </div>
          {project.description && (
            <p className="text-sm text-gray-600 mt-2">{project.description}</p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Saves List */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700">Available Saves</h4>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              Loading saves...
            </div>
          ) : saves.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">💾</div>
              <p>No saves found for this project</p>
              <p className="text-sm">Create a save first to load it</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {saves.map((save) => (
                <div
                  key={save.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedSave?.id === save.id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedSave(save)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-xl">{getSaveIcon(save)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-medium text-gray-900 truncate">{save.name}</h5>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {getSaveType(save)}
                          </span>
                          <span className="text-xs text-gray-500">
                            v{save.version}
                          </span>
                        </div>
                        
                        {save.description && (
                          <p className="text-sm text-gray-600 mb-2">{save.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{save.assetInstances.length} assets</span>
                          <span>•</span>
                          <span>{new Date(save.createdAt).toLocaleString()}</span>
                          <span>•</span>
                          <span>{formatFileSize(save.fileSize)}</span>
                          {save.comments.length > 0 && (
                            <>
                              <span>•</span>
                              <span>{save.comments.length} comments</span>
                            </>
                          )}
                          {save.annotations.length > 0 && (
                            <>
                              <span>•</span>
                              <span>{save.annotations.length} annotations</span>
                            </>
                          )}
                        </div>

                        {/* Save Details */}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {save.isAutoSave && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                              Auto-save
                            </span>
                          )}
                          {save.comments.length > 0 && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                              {save.comments.length} comments
                            </span>
                          )}
                          {save.annotations.length > 0 && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                              {save.annotations.length} annotations
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ml-4 flex items-center gap-2">
                      {loadingSave === save.id ? (
                        <div className="flex items-center gap-2 text-blue-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm">Loading...</span>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadSave(save);
                          }}
                          disabled={loadingSave !== null}
                          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Load
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          {selectedSave && (
            <button
              onClick={() => handleLoadSave(selectedSave)}
              disabled={loadingSave !== null}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingSave === selectedSave.id ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Loading...
                </div>
              ) : (
                `Load "${selectedSave.name}"`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
