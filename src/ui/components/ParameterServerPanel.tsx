/**
 * ROS 2 Parameter Server Panel
 * View and edit ROS 2 parameters
 */

import { useState, useEffect } from 'react';
import { Search, RefreshCw, Edit2, Check, X, Plus } from 'lucide-react';
import { ROSManager } from '../../ros2/bridge';
import './ParameterServerPanel.css';

interface ParameterServerPanelProps {
  rosManager: ROSManager;
  onClose?: () => void;
}

interface Parameter {
  name: string;
  value: unknown;
  type: string;
  editing: boolean;
  editValue: string;
}

export function ParameterServerPanel({ rosManager, onClose }: ParameterServerPanelProps) {
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [newParamName, setNewParamName] = useState('');
  const [newParamValue, setNewParamValue] = useState('');
  const [showAddParam, setShowAddParam] = useState(false);

  useEffect(() => {
    loadParameters();
  }, []);

  const loadParameters = async () => {
    setLoading(true);
    try {
      // Get list of all parameters (would need rosapi service)
      // For now, this is a placeholder for common robot parameters
      const commonParams = [
        '/robot/max_velocity',
        '/robot/max_acceleration',
        '/robot/joint_limits',
        '/controller/update_rate',
        '/use_sim_time'
      ];

      const loadedParams: Parameter[] = [];
      for (const paramName of commonParams) {
        try {
          const value = await rosManager.getParameter(paramName);
          if (value !== null) {
            loadedParams.push({
              name: paramName,
              value,
              type: typeof value,
              editing: false,
              editValue: JSON.stringify(value)
            });
          }
        } catch (error) {
          console.log(`Parameter ${paramName} not found`);
        }
      }

      setParameters(loadedParams);
    } catch (error) {
      console.error('Failed to load parameters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (index: number) => {
    setParameters((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, editing: true, editValue: JSON.stringify(p.value) } : p
      )
    );
  };

  const handleSave = async (index: number) => {
    const param = parameters[index];
    try {
      // Parse the edited value
      let newValue: unknown;
      try {
        newValue = JSON.parse(param.editValue);
      } catch {
        newValue = param.editValue; // Use as string if not valid JSON
      }

      // Update on ROS side
      await rosManager.setParameter(param.name, newValue);

      // Update local state
      setParameters((prev) =>
        prev.map((p, i) =>
          i === index ? { ...p, value: newValue, editing: false } : p
        )
      );
    } catch (error) {
      console.error('Failed to save parameter:', error);
      alert(`Failed to save parameter: ${error}`);
    }
  };

  const handleCancel = (index: number) => {
    setParameters((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, editing: false, editValue: JSON.stringify(p.value) } : p
      )
    );
  };

  const handleEditValueChange = (index: number, value: string) => {
    setParameters((prev) =>
      prev.map((p, i) => (i === index ? { ...p, editValue: value } : p))
    );
  };

  const handleAddParameter = async () => {
    if (!newParamName.trim()) {
      alert('Parameter name cannot be empty');
      return;
    }

    try {
      let value: unknown;
      try {
        value = JSON.parse(newParamValue);
      } catch {
        value = newParamValue;
      }

      await rosManager.setParameter(newParamName, value);

      // Add to list
      setParameters((prev) => [
        ...prev,
        {
          name: newParamName,
          value,
          type: typeof value,
          editing: false,
          editValue: JSON.stringify(value)
        }
      ]);

      // Reset form
      setNewParamName('');
      setNewParamValue('');
      setShowAddParam(false);
    } catch (error) {
      console.error('Failed to add parameter:', error);
      alert(`Failed to add parameter: ${error}`);
    }
  };

  const filteredParameters = parameters.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="parameter-server-panel">
      <div className="panel-header">
        <h3>ROS 2 Parameters</h3>
        {onClose && (
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      <div className="panel-content">
        {/* Search and Actions */}
        <div className="toolbar">
          <div className="search-box">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Search parameters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="toolbar-actions">
            <button
              className="toolbar-button"
              onClick={loadParameters}
              disabled={loading}
            >
              <RefreshCw className={`icon ${loading ? 'spinning' : ''}`} />
            </button>

            <button
              className="toolbar-button"
              onClick={() => setShowAddParam(!showAddParam)}
            >
              <Plus className="icon" />
            </button>
          </div>
        </div>

        {/* Add Parameter Form */}
        {showAddParam && (
          <div className="add-param-form">
            <input
              type="text"
              placeholder="Parameter name (e.g., /robot/max_speed)"
              value={newParamName}
              onChange={(e) => setNewParamName(e.target.value)}
              className="param-input"
            />
            <input
              type="text"
              placeholder="Value (JSON format)"
              value={newParamValue}
              onChange={(e) => setNewParamValue(e.target.value)}
              className="param-input"
            />
            <div className="form-actions">
              <button className="save-button" onClick={handleAddParameter}>
                Add
              </button>
              <button
                className="cancel-button"
                onClick={() => setShowAddParam(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Parameters List */}
        <div className="parameters-list">
          {loading && parameters.length === 0 ? (
            <div className="loading-message">Loading parameters...</div>
          ) : filteredParameters.length === 0 ? (
            <div className="empty-message">
              {searchQuery
                ? 'No parameters match your search'
                : 'No parameters loaded. Make sure ROS 2 is connected.'}
            </div>
          ) : (
            filteredParameters.map((param, index) => (
              <div key={param.name} className="parameter-item">
                <div className="param-name">{param.name}</div>
                <div className="param-type">{param.type}</div>

                {param.editing ? (
                  <div className="param-edit">
                    <input
                      type="text"
                      value={param.editValue}
                      onChange={(e) => handleEditValueChange(index, e.target.value)}
                      className="param-value-input"
                    />
                    <button
                      className="icon-button save"
                      onClick={() => handleSave(index)}
                    >
                      <Check className="icon" />
                    </button>
                    <button
                      className="icon-button cancel"
                      onClick={() => handleCancel(index)}
                    >
                      <X className="icon" />
                    </button>
                  </div>
                ) : (
                  <div className="param-display">
                    <span className="param-value">
                      {JSON.stringify(param.value)}
                    </span>
                    <button
                      className="icon-button edit"
                      onClick={() => handleEdit(index)}
                    >
                      <Edit2 className="icon" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
