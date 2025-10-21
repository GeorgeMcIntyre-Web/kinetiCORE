/**
 * Create Project Dialog
 * Owner: Edwin
 * 
 * Modal dialog for creating new projects
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { ProjectCategory } from '../../../project/types';
import './CreateProjectDialog.css';

interface CreateProjectDialogProps {
  isVisible: boolean;
  onClose: () => void;
  onCreate: (config: {
    name: string;
    description?: string;
    category: ProjectCategory;
    visibility: 'private' | 'team' | 'public';
    tags?: string[];
  }) => Promise<void>;
}

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({
  isVisible,
  onClose,
  onCreate,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'simulation' as ProjectCategory,
    visibility: 'private' as 'private' | 'team' | 'public',
    tags: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setIsSubmitting(true);
      
      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      await onCreate({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category,
        visibility: formData.visibility,
        tags: tags.length > 0 ? tags : undefined,
      });

      // Reset form
      setFormData({
        name: '',
        description: '',
        category: 'simulation',
        visibility: 'private',
        tags: '',
      });
      
      onClose();
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="create-project-overlay" onClick={onClose}>
      <div
        className="create-project-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="create-project-header">
          <h3 className="create-project-title">Create New Project</h3>
          <button className="create-project-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="create-project-content">
          <form onSubmit={handleSubmit} className="create-project-form">
            <div className="create-project-field">
              <label className="create-project-label">
                Project Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="create-project-input"
                placeholder="Enter project name"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="create-project-field">
              <label className="create-project-label">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="create-project-textarea"
                placeholder="Enter project description"
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="create-project-field">
              <label className="create-project-label">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as ProjectCategory }))}
                className="create-project-select"
                disabled={isSubmitting}
              >
                <option value="simulation">🎮 Simulation</option>
                <option value="layout">🏗️ Layout</option>
                <option value="prototype">🔬 Prototype</option>
                <option value="production">🏭 Production</option>
                <option value="training">🎓 Training</option>
                <option value="research">🔬 Research</option>
              </select>
            </div>

            <div className="create-project-field">
              <label className="create-project-label">
                Visibility
              </label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value as 'private' | 'team' | 'public' }))}
                className="create-project-select"
                disabled={isSubmitting}
              >
                <option value="private">🔒 Private</option>
                <option value="team">👥 Team</option>
                <option value="public">🌐 Public</option>
              </select>
            </div>

            <div className="create-project-field">
              <label className="create-project-label">
                Tags
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                className="create-project-input"
                placeholder="Enter tags separated by commas"
                disabled={isSubmitting}
              />
            </div>

            <div className="create-project-actions">
              <button
                type="button"
                onClick={onClose}
                className="create-project-btn secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="create-project-btn primary"
                disabled={isSubmitting || !formData.name.trim()}
              >
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
