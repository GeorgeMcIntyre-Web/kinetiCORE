/**
 * Save Dropdown Component
 * Owner: Agent 1 (George)
 *
 * Consolidates World Save options (Save, Export, Import, Auto-save) into a single dropdown
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Save, Download, Upload, Clock } from 'lucide-react';
import { WorldSaveManager } from '../../scene/WorldSaveManager';
import './SaveDropdown.css';

export interface SaveOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  description: string;
}

export interface SaveDropdownProps {
  onSave?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onToggleAutoSave?: () => void;
  autoSaveEnabled?: boolean;
}

export const SaveDropdown: React.FC<SaveDropdownProps> = ({
  onSave,
  onExport,
  onImport,
  onToggleAutoSave,
  autoSaveEnabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const saveManager = WorldSaveManager.getInstance();

  // Handle save to database
  const handleSave = async () => {
    try {
      const worldData = saveManager.captureWorldState();
      await saveManager.saveToDatabase(worldData);
      console.log('✅ Project saved to database');
    } catch (error) {
      console.error('❌ Save failed:', error);
    }
    if (onSave) onSave();
  };

  // Handle export to file
  const handleExport = async () => {
    try {
      const worldData = saveManager.captureWorldState();
      await saveManager.exportToFile(worldData);
      console.log('✅ Project exported to file');
    } catch (error) {
      console.error('❌ Export failed:', error);
    }
    if (onExport) onExport();
  };

  // Handle import from file
  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.kineticore.json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        await saveManager.importFromFile(file);
        console.log('✅ Project imported from file');
      } catch (error) {
        console.error('❌ Import failed:', error);
      }
    };

    input.click();
    if (onImport) onImport();
  };

  // Handle auto-save toggle
  const handleToggleAutoSave = () => {
    const newState = !autoSaveEnabled;

    if (newState) {
      saveManager.startAutoSave({
        enabled: true,
        frequency: 30,  // 30 seconds
        pauseDuringPlayback: true,
        saveOnlyIfChanged: true,
      });
      console.log('✅ Auto-save enabled (every 30s)');
    } else {
      saveManager.stopAutoSave();
      console.log('ℹ️ Auto-save disabled');
    }

    if (onToggleAutoSave) onToggleAutoSave();
  };

  const saveOptions: SaveOption[] = [
    {
      id: 'save',
      label: 'Save',
      icon: <Save size={20} />,
      onClick: handleSave,
      description: 'Save project to database'
    },
    {
      id: 'export',
      label: 'Export',
      icon: <Download size={20} />,
      onClick: handleExport,
      description: 'Export project to JSON file'
    },
    {
      id: 'import',
      label: 'Import',
      icon: <Upload size={20} />,
      onClick: handleImport,
      description: 'Import project from JSON file'
    },
    {
      id: 'autosave',
      label: autoSaveEnabled ? 'Auto-save: ON' : 'Auto-save: OFF',
      icon: <Clock size={20} />,
      onClick: handleToggleAutoSave,
      description: autoSaveEnabled ? 'Disable auto-save' : 'Enable auto-save (every 30s)'
    }
  ];

  // Calculate menu position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleItemClick = (option: SaveOption) => {
    option.onClick();
    setIsOpen(false);
  };

  const handleMainButtonClick = () => {
    // Clicking the main button executes quick save
    handleSave();
  };

  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className="save-dropdown" ref={dropdownRef}>
      <div className="save-dropdown-button-group">
        {/* Main button - quick save */}
        <button
          ref={buttonRef}
          className="save-dropdown-main-btn"
          onClick={handleMainButtonClick}
          title="Save project to database (Click to save)"
        >
          <Save size={32} />
        </button>

        {/* Dropdown arrow button */}
        <button
          className="save-dropdown-arrow-btn"
          onClick={handleDropdownClick}
          title="Save Options"
        >
          <ChevronDown size={8} className={`dropdown-chevron ${isOpen ? 'open' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div
          className="save-dropdown-menu"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`
          }}
        >
          {saveOptions.map(option => (
            <button
              key={option.id}
              className={`save-dropdown-item ${option.id === 'autosave' && autoSaveEnabled ? 'active' : ''}`}
              onClick={() => handleItemClick(option)}
              title={option.description}
            >
              <span className="item-icon">{option.icon}</span>
              <span className="item-label">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
