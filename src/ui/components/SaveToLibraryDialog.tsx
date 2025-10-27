/**
 * Save to Library Dialog
 * Owner: Edwin
 *
 * Dialog form for saving assets to the library
 * Replaces basic prompt() calls with a proper UI
 */

import { useState } from 'react';
import { X, Save, Tag, FileText, Layers } from 'lucide-react';

export interface SaveToLibraryFormData {
  name: string;
  description: string;
  tags: string[];
  domain: string;
  assetClass: string;
}

interface SaveToLibraryDialogProps {
  isOpen: boolean;
  defaultName?: string;
  onSave: (data: SaveToLibraryFormData) => void;
  onCancel: () => void;
}

export const SaveToLibraryDialog: React.FC<SaveToLibraryDialogProps> = ({
  isOpen,
  defaultName = '',
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [domain, setDomain] = useState('custom');
  const [assetClass, setAssetClass] = useState('tools');

  if (!isOpen) return null;

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Asset name is required');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      tags,
      domain,
      assetClass,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-[500px] max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Save size={20} className="text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Save to Asset Library</h2>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Asset Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <div className="flex items-center gap-2">
                <FileText size={16} />
                Asset Name *
              </div>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., FANUC M-10iA Robot"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the asset..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          {/* Domain */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <div className="flex items-center gap-2">
                <Layers size={16} />
                Domain
              </div>
            </label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="custom">Custom</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="logistics">Logistics</option>
              <option value="medical">Medical</option>
              <option value="construction">Construction</option>
              <option value="aerospace">Aerospace</option>
              <option value="research">Research</option>
            </select>
          </div>

          {/* Asset Class */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Asset Class
            </label>
            <select
              value={assetClass}
              onChange={(e) => setAssetClass(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="robots">Robots</option>
              <option value="endEffectors">End Effectors</option>
              <option value="machinery">Machinery</option>
              <option value="equipment">Equipment</option>
              <option value="buildings">Buildings</option>
              <option value="structures">Structures</option>
              <option value="vehicles">Vehicles</option>
              <option value="tools">Tools</option>
              <option value="primitives">Primitives</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <div className="flex items-center gap-2">
                <Tag size={16} />
                Tags
              </div>
            </label>

            {/* Tag input */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add tag and press Enter"
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Add
              </button>
            </div>

            {/* Tag chips */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1 px-2 py-1 bg-cyan-600/20 border border-cyan-600/50 rounded text-cyan-400 text-sm"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-cyan-300"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              Save to Library
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
