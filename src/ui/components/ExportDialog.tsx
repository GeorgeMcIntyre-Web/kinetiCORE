// Export Dialog - Format selection for exporting world
// Owner: George (Architecture)

import React, { useState } from 'react';
import { X, Download, FileJson, Box, Database } from 'lucide-react';
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
}

const exportOptions: ExportOption[] = [
  {
    format: 'basic',
    label: 'Basic World (JSON)',
    description: 'Scene tree and metadata only. Smallest file size.',
    icon: <FileJson size={24} />,
    fileExtension: '.json',
  },
  {
    format: 'babylon',
    label: 'Babylon Scene (JSON)',
    description: 'Full Babylon.js scene data. Can be loaded in Babylon Editor.',
    icon: <Box size={24} />,
    fileExtension: '.babylon.json',
  },
  {
    format: 'comprehensive',
    label: 'Comprehensive World (JSON)',
    description: 'Everything: scene, assets, physics, kinematics. Largest file size.',
    icon: <Database size={24} />,
    fileExtension: '.kineticore.json',
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

          <div className="export-options">
            {exportOptions.map((option) => (
              <div
                key={option.format}
                className={`export-option ${selectedFormat === option.format ? 'selected' : ''}`}
                onClick={() => setSelectedFormat(option.format)}
              >
                <div className="export-option-icon">{option.icon}</div>
                <div className="export-option-content">
                  <div className="export-option-label">{option.label}</div>
                  <div className="export-option-description">{option.description}</div>
                  <div className="export-option-extension">{option.fileExtension}</div>
                </div>
                <div className="export-option-radio">
                  <div className={`radio-circle ${selectedFormat === option.format ? 'checked' : ''}`} />
                </div>
              </div>
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

