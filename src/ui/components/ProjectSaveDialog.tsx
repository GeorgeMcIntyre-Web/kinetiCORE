/**
 * Project Save Dialog Component
 * Owner: Edwin
 * 
 * Dialog for saving project states with metadata and version control
 */

import React, { useState } from 'react';
import { ProjectManager } from '../../project/ProjectManager';
import type { Project, ProjectSave } from '../../project/types';

interface ProjectSaveDialogProps {
  project: Project;
  onClose: () => void;
  onSave?: (save: ProjectSave) => void;
}

export const ProjectSaveDialog: React.FC<ProjectSaveDialogProps> = ({
  project,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isAutoSave: false,
    includeComments: true,
    includeAnnotations: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSaves, setRecentSaves] = useState<ProjectSave[]>([]);

  const projectManager = ProjectManager.getInstance();

  // Load recent saves on mount
  React.useEffect(() => {
    loadRecentSaves();
  }, [project.id]);

  const loadRecentSaves = async () => {
    try {
      const saves = await projectManager.listProjectSaves(project.id);
      setRecentSaves(saves.slice(0, 5)); // Show last 5 saves
    } catch (err) {
      console.error('Failed to load recent saves:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const save = await projectManager.saveProject(project.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        isAutoSave: formData.isAutoSave,
        includeComments: formData.includeComments,
        includeAnnotations: formData.includeAnnotations,
      });

      onSave?.(save);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  const generateSaveName = () => {
    const now = new Date();
    const timestamp = now.toLocaleString();
    return `${project.name} - ${timestamp}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Save Project</h3>
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

        <form onSubmit={handleSave} className="space-y-4">
          {/* Save Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Save Name *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter save name"
                required
              />
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, name: generateSaveName() }))}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Auto
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe what changed in this save"
              rows={3}
            />
          </div>

          {/* Save Options */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Save Options</h4>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.includeComments}
                onChange={(e) => setFormData(prev => ({ ...prev, includeComments: e.target.checked }))}
                className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Include comments and discussions</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.includeAnnotations}
                onChange={(e) => setFormData(prev => ({ ...prev, includeAnnotations: e.target.checked }))}
                className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Include annotations and markups</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.isAutoSave}
                onChange={(e) => setFormData(prev => ({ ...prev, isAutoSave: e.target.checked }))}
                className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Mark as auto-save</span>
            </label>
          </div>

          {/* Recent Saves */}
          {recentSaves.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Saves</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {recentSaves.map((save) => (
                  <div
                    key={save.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{save.name}</p>
                      <p className="text-gray-600">
                        Version {save.version} • {new Date(save.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500 ml-2">
                      {formatFileSize(save.fileSize)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </div>
              ) : (
                'Save Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
