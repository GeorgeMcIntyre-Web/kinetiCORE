/**
 * World Save Controls
 * Owner: Agent 3 (Edwin/Cursor)
 * 
 * UI controls for saving/loading/exporting world state
 */

import { useState } from 'react';
import { Save, Download, Upload, Settings, Clock } from 'lucide-react';
import { WorldSaveManager } from '../../scene/WorldSaveManager';
import { toast } from './ToastNotifications';
import './WorldSaveControls.css';

export function WorldSaveControls() {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  
  const saveManager = WorldSaveManager.getInstance();
  
  // Save to database
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const worldData = saveManager.captureWorldState();
      await saveManager.saveToDatabase(worldData);
      setLastSaveTime(new Date());
      toast.success('Project saved successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save project. Check console for details.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Export to file
  const handleExport = async () => {
    try {
      const worldData = saveManager.captureWorldState();
      await saveManager.exportToFile(worldData);
      toast.success('Project exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export project. Check console for details.');
    }
  };
  
  // Import from file
  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.kineticore.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      setIsLoading(true);
      try {
        await saveManager.importFromFile(file);
        toast.success('Project imported successfully!');
      } catch (error) {
        console.error('Import failed:', error);
        toast.error('Failed to import project. Check console for details.');
      } finally {
        setIsLoading(false);
      }
    };
    
    input.click();
  };
  
  // Toggle auto-save
  const handleToggleAutoSave = () => {
    const newState = !autoSaveEnabled;
    setAutoSaveEnabled(newState);
    
    if (newState) {
      saveManager.startAutoSave({
        enabled: true,
        frequency: 30,  // 30 seconds
        pauseDuringPlayback: true,
        saveOnlyIfChanged: true,
      });
      toast.success('Auto-save enabled (every 30s)');
    } else {
      saveManager.stopAutoSave();
      toast.info('Auto-save disabled');
    }
  };
  
  // Format last save time
  const formatLastSave = () => {
    if (!lastSaveTime) return 'Never';
    
    const seconds = Math.floor((Date.now() - lastSaveTime.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };
  
  return (
    <div className="world-save-controls">
      {/* Save Button */}
      <button
        className="save-btn"
        onClick={handleSave}
        disabled={isSaving}
        title="Save project to database"
      >
        <Save size={16} />
        {isSaving ? 'Saving...' : 'Save'}
      </button>
      
      {/* Export Button */}
      <button
        className="export-btn"
        onClick={handleExport}
        title="Export project as JSON file"
      >
        <Download size={16} />
        Export
      </button>
      
      {/* Import Button */}
      <button
        className="import-btn"
        onClick={handleImport}
        disabled={isLoading}
        title="Import project from JSON file"
      >
        <Upload size={16} />
        {isLoading ? 'Loading...' : 'Import'}
      </button>
      
      <div className="divider" />
      
      {/* Auto-Save Toggle */}
      <button
        className={`auto-save-toggle ${autoSaveEnabled ? 'active' : ''}`}
        onClick={handleToggleAutoSave}
        title={autoSaveEnabled ? 'Auto-save ON (every 30s)' : 'Auto-save OFF'}
      >
        <Clock size={16} />
        Auto-save {autoSaveEnabled ? 'ON' : 'OFF'}
      </button>
      
      {/* Last Save Time */}
      {lastSaveTime && (
        <div className="last-save">
          <Settings size={14} />
          Last saved: {formatLastSave()}
        </div>
      )}
    </div>
  );
}
