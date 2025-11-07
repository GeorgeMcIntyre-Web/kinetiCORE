// Route Templates Panel - Library of predefined route templates
// Owner: Routing System Team

import React, { useState, useCallback } from 'react';
import { X, Download, Upload, Save } from 'lucide-react';
import { useRoutingStore } from '../../ui/store/routingStore';
import { useEditorStore } from '../../ui/store/editorStore';
import { RouteTemplate, getTemplatesByCategory, TemplateCategory } from '../templates/RouteTemplates';
import { Route } from '../core/Route';
import { CreateRouteCommand } from '../commands/CreateRouteCommand';
import { CreateConnectionPointCommand } from '../commands/CreateConnectionPointCommand';
import { createSegmentsFromTemplate } from '../templates/RouteTemplates';
import { SceneManager } from '../../scene/SceneManager';
import { toast } from '../../ui/components/ToastNotifications';
import './RouteTemplatesPanel.css';

interface RouteTemplatesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RouteTemplatesPanel: React.FC<RouteTemplatesPanelProps> = ({ isOpen, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('common');
  const [selectedTemplate, setSelectedTemplate] = useState<RouteTemplate | null>(null);
  const [customTemplates, setCustomTemplates] = useState<RouteTemplate[]>([]);
  const currentRouteType = useRoutingStore((state) => state.currentRouteType);
  const commandManager = useEditorStore((state) => state.commandManager);
  const setRoutingMode = useRoutingStore((state) => state.setRoutingMode);
  const selectedRoute = useRoutingStore((state) => state.activeRoutes.find(() => {
    // Get selected route if there's a selection mechanism
    return false; // Will implement selection later
  }));

  // Listen for template placement events from RoutingWorkflowHandler
  React.useEffect(() => {
    if (!selectedTemplate) return;

    const handleTemplatePlace = (event: CustomEvent) => {
      if (selectedTemplate && event.detail?.position) {
        handlePlaceTemplate(event.detail.position, event.detail.endPosition);
      }
    };

    window.addEventListener('route-template-place', handleTemplatePlace as EventListener);
    return () => {
      window.removeEventListener('route-template-place', handleTemplatePlace as EventListener);
    };
  }, [selectedTemplate]);

  // Combine built-in and custom templates
  const templatesToShow = selectedCategory === 'custom'
    ? customTemplates
    : getTemplatesByCategory(selectedCategory);

  const handleTemplateClick = useCallback((template: RouteTemplate) => {
    setSelectedTemplate(template);
    setRoutingMode('placing_template');
    toast.info(`Click in viewport to place ${template.name}`);
  }, [setRoutingMode]);

  const handlePlaceTemplate = useCallback((position: { x: number; y: number; z: number }, endPosition?: { x: number; y: number; z: number }) => {
    if (!selectedTemplate) return;

    try {
      const scene = SceneManager.getInstance().getScene();
      if (!scene) {
        toast.error('Scene not available');
        return;
      }

      const routeType = currentRouteType;
      
      // Create source connection point
      const sourceConfig = {
        type: routeType,
        position,
        direction: { x: 1, y: 0, z: 0 }, // Default horizontal
        specifications: selectedTemplate.defaultSpecifications,
      };
      const sourceCmd = new CreateConnectionPointCommand(sourceConfig);
      commandManager.execute(sourceCmd);
      const sourcePoint = sourceCmd.getConnectionPoint();
      if (!sourcePoint) {
        toast.error('Failed to create source connection point');
        return;
      }

      // Create destination connection point (use end position if provided, otherwise calculate from template)
      const destPosition = endPosition || {
        x: position.x + 1,
        y: position.y,
        z: position.z,
      };

      const destConfig = {
        type: routeType,
        position: destPosition,
        direction: { x: -1, y: 0, z: 0 },
        specifications: selectedTemplate.defaultSpecifications,
      };
      const destCmd = new CreateConnectionPointCommand(destConfig);
      commandManager.execute(destCmd);
      const destPoint = destCmd.getConnectionPoint();
      if (!destPoint) {
        toast.error('Failed to create destination connection point');
        return;
      }

      // Create segments from template
      const segments = createSegmentsFromTemplate(
        selectedTemplate,
        position,
        destPosition,
        selectedTemplate.parameters
      );

      // Create route
      const route = new Route(
        sourcePoint,
        destPoint,
        segments,
        selectedTemplate.defaultMaterial,
        selectedTemplate.defaultConstraints
      );

      // Execute command to add route
      const routeCmd = new CreateRouteCommand(route);
      commandManager.execute(routeCmd);

      toast.success(`Placed ${selectedTemplate.name} template`);
      setSelectedTemplate(null);
      setRoutingMode('off');
    } catch (error) {
      console.error('Failed to place template:', error);
      toast.error(`Failed to place template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [selectedTemplate, currentRouteType, commandManager, setRoutingMode]);

  const handleSaveAsTemplate = useCallback(() => {
    if (!selectedRoute) {
      toast.info('Select a route first to save as template');
      return;
    }

    // Create template from selected route
    const template: RouteTemplate = {
      id: `custom_${Date.now()}`,
      name: `Custom Route ${customTemplates.length + 1}`,
      description: 'User-created template',
      category: 'custom',
      icon: '📝',
      segments: selectedRoute.segments.map(seg => ({
        id: seg.id,
        startPoint: seg.startPoint,
        endPoint: seg.endPoint,
        segmentType: seg.segmentType,
        bendRadius: seg.bendRadius,
        length: seg.length,
      })),
      defaultSpecifications: selectedRoute.source.specifications,
      defaultMaterial: selectedRoute.material,
      defaultConstraints: selectedRoute.constraints,
    };

    setCustomTemplates([...customTemplates, template]);
    toast.success(`Saved "${template.name}" as template`);
  }, [selectedRoute, customTemplates]);

  const handleExportTemplates = useCallback(() => {
    const templatesToExport = customTemplates;
    if (templatesToExport.length === 0) {
      toast.info('No custom templates to export');
      return;
    }

    const dataStr = JSON.stringify(templatesToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'route-templates.json';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Templates exported');
  }, [customTemplates]);

  const handleImportTemplates = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string) as RouteTemplate[];
          setCustomTemplates([...customTemplates, ...imported]);
          toast.success(`Imported ${imported.length} template(s)`);
        } catch (error) {
          toast.error('Failed to import templates: Invalid JSON');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [customTemplates]);

  if (!isOpen) return null;

  return (
    <div className="route-templates-panel-overlay" onClick={onClose}>
      <div className="route-templates-panel" onClick={(e) => e.stopPropagation()}>
        <div className="route-templates-panel-header">
          <h2>Route Templates</h2>
          <button className="route-templates-panel-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="route-templates-panel-content">
          <p className="route-templates-panel-description">
            Select a template to place in the viewport. Click in the scene to position it.
          </p>

          {/* Category Tabs */}
          <div className="template-category-tabs">
            <button
              className={`category-tab ${selectedCategory === 'common' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('common')}
            >
              Common
            </button>
            <button
              className={`category-tab ${selectedCategory === 'industrial' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('industrial')}
            >
              Industrial
            </button>
            <button
              className={`category-tab ${selectedCategory === 'custom' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('custom')}
            >
              Custom
            </button>
          </div>

          {/* Template Grid */}
          <div className="template-grid">
            {templatesToShow.map((template) => (
              <div
                key={template.id}
                className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                onClick={() => handleTemplateClick(template)}
                onMouseEnter={() => {
                  // Show tooltip with template info
                }}
              >
                <div className="template-icon">{template.icon}</div>
                <div className="template-content">
                  <div className="template-header">
                    <h4>{template.name}</h4>
                    {template.category === 'custom' && (
                      <span className="template-badge">Custom</span>
                    )}
                  </div>
                  <p className="template-description">{template.description}</p>
                  <div className="template-meta">
                    <span className="template-type">{template.defaultSpecifications.size || 'Standard'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Custom Templates Actions */}
          {selectedCategory === 'custom' && (
            <div className="custom-templates-actions">
              <button
                className="template-action-btn"
                onClick={handleExportTemplates}
                disabled={customTemplates.length === 0}
              >
                <Download size={16} />
                Export Templates
              </button>
              <button className="template-action-btn" onClick={handleImportTemplates}>
                <Upload size={16} />
                Import Templates
              </button>
              <button
                className="template-action-btn"
                onClick={handleSaveAsTemplate}
                disabled={!selectedRoute}
              >
                <Save size={16} />
                Save as Template
              </button>
            </div>
          )}
        </div>

        <div className="route-templates-panel-footer">
          {selectedTemplate && (
            <div className="selected-template-info">
              <span>Selected: {selectedTemplate.name}</span>
              <button
                className="template-cancel-btn"
                onClick={() => {
                  setSelectedTemplate(null);
                  setRoutingMode('off');
                }}
              >
                Cancel
              </button>
            </div>
          )}
          <button className="route-templates-panel-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

