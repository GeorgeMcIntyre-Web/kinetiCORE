// Export Dialog - Format selection for exporting world
// Owner: George (Architecture)

import React, { useState } from 'react';
import { X, Download, FileJson, Database, Package } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { toast } from './ToastNotifications';
import { loading } from './LoadingIndicator';
import './ExportDialog.css';

export type ExportFormat = 'basic' | 'babylon' | 'comprehensive';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExportOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  fileExtension: string;
  estimatedSize: string;
  badge?: string;
}

const exportOptions: ExportOption[] = [
  {
    format: 'basic',
    label: 'Basic World (JSON)',
    description: 'Scene tree and metadata only.',
    icon: <FileJson size={32} />,
    fileExtension: '.json',
    estimatedSize: '~500 KB',
    badge: 'Fastest',
  },
  {
    format: 'babylon',
    label: 'Babylon Scene',
    description: 'Full Babylon.js scene data.',
    icon: <Database size={32} />,
    fileExtension: '.babylon',
    estimatedSize: '~2 MB',
    badge: 'Recommended',
  },
  {
    format: 'comprehensive',
    label: 'Comprehensive',
    description: 'Everything including physics and kinematics.',
    icon: <Package size={32} />,
    fileExtension: '.kineticore',
    estimatedSize: '~5 MB',
    badge: 'Complete',
  },
];

export const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('basic');
  const saveWorld = useEditorStore((state) => state.saveWorld);
  const saveBabylonWorld = useEditorStore((state) => state.saveBabylonWorld);
  const saveComprehensiveWorld = useEditorStore((state) => state.saveComprehensiveWorld);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      loading.start(`Exporting world as ${exportOptions.find(o => o.format === selectedFormat)?.label}...`, 'processing');
      
      switch (selectedFormat) {
        case 'basic':
          saveWorld();
          break;
        case 'babylon':
          saveBabylonWorld();
          break;
        case 'comprehensive':
          await saveComprehensiveWorld();
          break;
      }
      
      loading.end();
      toast.success(`World exported as ${exportOptions.find(o => o.format === selectedFormat)?.label}`);
      onClose();
    } catch (error) {
      loading.end();
      console.error('Export failed:', error);
      toast.error(`Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="export-dialog-overlay" onClick={onClose}>
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="export-dialog-header">
          <h2>Export World</h2>
          <button className="export-dialog-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="export-dialog-content">
          <p className="export-dialog-description">
            Choose the export format. The file will be downloaded to your default download folder.
          </p>

          <div className="export-format-grid">
            {exportOptions.map((option) => (
              <label
                key={option.format}
                className={`export-format-card ${selectedFormat === option.format ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="exportFormat"
                  value={option.format}
                  checked={selectedFormat === option.format}
                  onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
                />
                <div className="format-icon">{option.icon}</div>
                <div className="format-content">
                  <div className="format-header">
                    <h4>{option.label}</h4>
                    {option.badge && <span className="format-badge">{option.badge}</span>}
                  </div>
                  <p className="format-description">{option.description}</p>
                  <div className="format-meta">
                    <span className="format-size">{option.estimatedSize}</span>
                    <span className="format-ext">{option.fileExtension}</span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="export-dialog-footer">
          <button className="export-dialog-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="export-dialog-export" onClick={handleExport}>
            <Download size={18} />
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

