// Route Debug Labels - Floating 3D labels for route inspection and debugging
// Owner: Routing System Team

import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { Route } from '../core/Route';
import { ElectricalSpec, PipeSpec, CableTraySpec, ConduitSpec } from '../specifications/RouteSpecifications';

/**
 * RouteDebugLabels creates professional floating labels above route meshes
 * showing specifications, dimensions, and validation status
 */
export class RouteDebugLabels {
  private scene: BABYLON.Scene;
  private advancedTexture: GUI.AdvancedDynamicTexture;
  private labels: Map<string, GUI.Rectangle> = new Map();

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI('route-labels', true, scene);
  }

  /**
   * Create a floating label for a route
   */
  createRouteLabel(route: Route, mesh: BABYLON.Mesh, specifications?: any): GUI.Rectangle {
    const labelContainer = new GUI.Rectangle(`label_${route.getId()}`);
    labelContainer.width = '320px';
    labelContainer.height = 'auto';
    labelContainer.cornerRadius = 8;
    labelContainer.thickness = 2;
    labelContainer.background = 'rgba(26, 26, 26, 0.95)';
    labelContainer.color = this.getRouteColor(route.type);
    labelContainer.paddingTop = '12px';
    labelContainer.paddingBottom = '12px';
    labelContainer.paddingLeft = '16px';
    labelContainer.paddingRight = '16px';

    // Add shadow effect
    const shadow = new GUI.Rectangle('label-shadow');
    shadow.width = '320px';
    shadow.height = labelContainer.height;
    shadow.cornerRadius = 8;
    shadow.thickness = 0;
    shadow.background = 'rgba(0, 0, 0, 0.5)';
    shadow.left = '2px';
    shadow.top = '2px';
    shadow.zIndex = -1;
    labelContainer.addControl(shadow);

    // Create label content
    const stackPanel = new GUI.StackPanel();
    stackPanel.width = '100%';
    stackPanel.isVertical = true;
    stackPanel.spacing = 6;

    // Route title
    const title = this.createTextBlock(
      `${this.formatRouteType(route.type)} Route`,
      '16px',
      'bold',
      this.getRouteColor(route.type)
    );
    stackPanel.addControl(title);

    // Route ID
    const id = this.createTextBlock(`ID: ${route.getId()}`, '12px', 'normal', '#999');
    stackPanel.addControl(id);

    // Add separator
    const separator = this.createSeparator();
    stackPanel.addControl(separator);

    // Add specifications if provided
    if (specifications) {
      this.addSpecifications(stackPanel, route, specifications);

      // Add separator
      const separator2 = this.createSeparator();
      stackPanel.addControl(separator2);
    }

    // Add geometry info
    const length = this.createTextBlock(
      `Length: ${route.getTotalLength().toFixed(2)} m`,
      '13px',
      'normal',
      '#e0e0e0'
    );
    stackPanel.addControl(length);

    const segments = this.createTextBlock(
      `Segments: ${route.segments.length}`,
      '13px',
      'normal',
      '#e0e0e0'
    );
    stackPanel.addControl(segments);

    // Add validation status (check if route has generated geometry)
    const statusContainer = new GUI.StackPanel();
    statusContainer.isVertical = false;
    statusContainer.spacing = 6;

    const isGenerated = route.generated;
    const statusIcon = this.createTextBlock(
      isGenerated ? '✓' : '⚠',
      '14px',
      'bold',
      isGenerated ? '#4CAF50' : '#FFC107'
    );
    statusContainer.addControl(statusIcon);

    const statusText = this.createTextBlock(
      isGenerated ? 'Generated' : 'Pending',
      '13px',
      'normal',
      isGenerated ? '#4CAF50' : '#FFC107'
    );
    statusContainer.addControl(statusText);

    stackPanel.addControl(statusContainer);

    labelContainer.addControl(stackPanel);

    // Link label to mesh (follow mesh position)
    labelContainer.linkWithMesh(mesh);
    labelContainer.linkOffsetY = -100; // Float above mesh

    this.advancedTexture.addControl(labelContainer);
    this.labels.set(route.getId(), labelContainer);

    return labelContainer;
  }

  /**
   * Add route-specific specifications to label
   */
  private addSpecifications(stackPanel: GUI.StackPanel, route: Route, spec: any): void {

    if (route.type === 'electrical' && this.isElectricalSpec(spec)) {
      // Electrical specifications
      const voltage = this.createTextBlock(
        `⚡ ${spec.voltage}V / ${spec.current}A`,
        '13px',
        'normal',
        '#FFD700'
      );
      stackPanel.addControl(voltage);

      const wire = this.createTextBlock(
        `Wire: ${spec.coreCount}-core ${spec.wireGauge}`,
        '12px',
        'normal',
        '#ccc'
      );
      stackPanel.addControl(wire);

      const diameter = this.createTextBlock(
        `Ø ${(spec.outerDiameter * 1000).toFixed(1)}mm`,
        '12px',
        'normal',
        '#ccc'
      );
      stackPanel.addControl(diameter);

      // Connector info
      if (spec.connectorA && spec.connectorB) {
        const connectors = this.createTextBlock(
          `${spec.connectorA.type} → ${spec.connectorB.type}`,
          '11px',
          'normal',
          '#999'
        );
        stackPanel.addControl(connectors);
      }

      // Pre-order length if calculated
      if (spec.preOrderLength) {
        const preOrder = this.createTextBlock(
          `📦 Order: ${spec.preOrderLength.toFixed(2)}m`,
          '12px',
          'bold',
          '#00D9FF'
        );
        stackPanel.addControl(preOrder);
      }

    } else if (route.type === 'pipe' && this.isPipeSpec(spec)) {
      // Pipe specifications
      const size = this.createTextBlock(
        `Size: ${spec.nominalSize} (${spec.material})`,
        '13px',
        'normal',
        '#00D9FF'
      );
      stackPanel.addControl(size);

      const diameter = this.createTextBlock(
        `Ø ${(spec.outerDiameter * 1000).toFixed(1)}mm OD / ${(spec.innerDiameter * 1000).toFixed(1)}mm ID`,
        '12px',
        'normal',
        '#ccc'
      );
      stackPanel.addControl(diameter);

      const fluid = this.createTextBlock(
        `Fluid: ${spec.fluidType} @ ${spec.flowRate} L/min`,
        '12px',
        'normal',
        '#ccc'
      );
      stackPanel.addControl(fluid);

      const pressure = this.createTextBlock(
        `Pressure: ${spec.pressureRating} PSI`,
        '12px',
        'normal',
        '#ccc'
      );
      stackPanel.addControl(pressure);

    } else if (route.type === 'cable_tray' && this.isCableTraySpec(spec)) {
      // Cable tray specifications
      const dimensions = this.createTextBlock(
        `${(spec.width * 1000).toFixed(0)}mm × ${(spec.height * 1000).toFixed(0)}mm`,
        '13px',
        'normal',
        '#FF8C00'
      );
      stackPanel.addControl(dimensions);

      const trayType = this.createTextBlock(
        `Type: ${this.formatTrayType(spec.trayType)} (${spec.material})`,
        '12px',
        'normal',
        '#ccc'
      );
      stackPanel.addControl(trayType);

      const load = this.createTextBlock(
        `Load: ${spec.loadRating} kg/m | Max Cables: ${spec.maxCables}`,
        '11px',
        'normal',
        '#999'
      );
      stackPanel.addControl(load);

    } else if (route.type === 'conduit' && this.isConduitSpec(spec)) {
      // Conduit specifications
      const size = this.createTextBlock(
        `Size: ${spec.nominalSize} (${spec.conduitType})`,
        '13px',
        'normal',
        '#00FF00'
      );
      stackPanel.addControl(size);

      const diameter = this.createTextBlock(
        `Ø ${(spec.outerDiameter * 1000).toFixed(1)}mm`,
        '12px',
        'normal',
        '#ccc'
      );
      stackPanel.addControl(diameter);

      const fill = this.createTextBlock(
        `Max Wires: ${spec.maxWires} (${spec.fillPercentage.toFixed(0)}% fill)`,
        '12px',
        'normal',
        '#ccc'
      );
      stackPanel.addControl(fill);
    }
  }

  /**
   * Create a text block with consistent styling
   */
  private createTextBlock(
    text: string,
    fontSize: string,
    fontWeight: string,
    color: string
  ): GUI.TextBlock {
    const textBlock = new GUI.TextBlock();
    textBlock.text = text;
    textBlock.fontSize = fontSize;
    textBlock.fontWeight = fontWeight;
    textBlock.color = color;
    textBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    textBlock.height = '20px';
    textBlock.paddingLeft = '4px';
    return textBlock;
  }

  /**
   * Create a separator line
   */
  private createSeparator(): GUI.Rectangle {
    const separator = new GUI.Rectangle();
    separator.width = '100%';
    separator.height = '1px';
    separator.thickness = 0;
    separator.background = 'rgba(255, 255, 255, 0.1)';
    return separator;
  }

  /**
   * Get color for route type
   */
  private getRouteColor(type: string): string {
    const colors: Record<string, string> = {
      electrical: '#FFD700', // Yellow/Gold
      pipe: '#00D9FF',       // Blue
      cable_tray: '#FF8C00', // Orange
      conduit: '#00FF00',    // Green
    };
    return colors[type] || '#FFFFFF';
  }

  /**
   * Format route type for display
   */
  private formatRouteType(type: string): string {
    const names: Record<string, string> = {
      electrical: 'Electrical',
      pipe: 'Pipe',
      cable_tray: 'Cable Tray',
      conduit: 'Conduit',
    };
    return names[type] || type;
  }

  /**
   * Format tray type for display
   */
  private formatTrayType(type: string): string {
    const names: Record<string, string> = {
      ladder: 'Ladder',
      'solid-bottom': 'Solid Bottom',
      ventilated: 'Ventilated',
      'wire-mesh': 'Wire Mesh',
    };
    return names[type] || type;
  }

  /**
   * Type guards for specifications
   */
  private isElectricalSpec(spec: any): spec is ElectricalSpec {
    return spec && 'voltage' in spec && 'current' in spec;
  }

  private isPipeSpec(spec: any): spec is PipeSpec {
    return spec && 'fluidType' in spec && 'flowRate' in spec;
  }

  private isCableTraySpec(spec: any): spec is CableTraySpec {
    return spec && 'trayType' in spec && 'loadRating' in spec;
  }

  private isConduitSpec(spec: any): spec is ConduitSpec {
    return spec && 'conduitType' in spec && 'maxWires' in spec;
  }

  /**
   * Update label for a route
   */
  updateLabel(route: Route): void {
    const label = this.labels.get(route.getId());
    if (label) {
      // Remove old label
      this.advancedTexture.removeControl(label);
      this.labels.delete(route.getId());
    }

    // Create new label if mesh exists
    const mesh = this.scene.getMeshByName(`${route.type}_${route.getId()}`);
    if (mesh) {
      this.createRouteLabel(route, mesh as BABYLON.Mesh);
    }
  }

  /**
   * Remove label for a route
   */
  removeLabel(routeId: string): void {
    const label = this.labels.get(routeId);
    if (label) {
      this.advancedTexture.removeControl(label);
      this.labels.delete(routeId);
    }
  }

  /**
   * Toggle labels visibility
   */
  setVisible(visible: boolean): void {
    this.labels.forEach(label => {
      label.isVisible = visible;
    });
  }

  /**
   * Clear all labels
   */
  clearAll(): void {
    this.labels.forEach(label => {
      this.advancedTexture.removeControl(label);
    });
    this.labels.clear();
  }

  /**
   * Create a compact label for performance mode
   */
  createCompactLabel(route: Route, mesh: BABYLON.Mesh): GUI.Rectangle {
    const labelContainer = new GUI.Rectangle(`compact_label_${route.getId()}`);
    labelContainer.width = '180px';
    labelContainer.height = '60px';
    labelContainer.cornerRadius = 6;
    labelContainer.thickness = 1;
    labelContainer.background = 'rgba(0, 0, 0, 0.8)';
    labelContainer.color = this.getRouteColor(route.type);
    labelContainer.paddingTop = '8px';
    labelContainer.paddingBottom = '8px';

    const stackPanel = new GUI.StackPanel();
    stackPanel.width = '100%';
    stackPanel.isVertical = true;
    stackPanel.spacing = 4;

    const title = this.createTextBlock(
      `${this.formatRouteType(route.type)}`,
      '13px',
      'bold',
      this.getRouteColor(route.type)
    );
    stackPanel.addControl(title);

    const length = this.createTextBlock(
      `${route.getTotalLength().toFixed(2)} m`,
      '11px',
      'normal',
      '#ccc'
    );
    stackPanel.addControl(length);

    labelContainer.addControl(stackPanel);
    labelContainer.linkWithMesh(mesh);
    labelContainer.linkOffsetY = -60;

    this.advancedTexture.addControl(labelContainer);
    this.labels.set(route.getId(), labelContainer);

    return labelContainer;
  }

  /**
   * Get label statistics
   */
  getStatistics(): { totalLabels: number; visibleLabels: number } {
    let visibleCount = 0;
    this.labels.forEach(label => {
      if (label.isVisible) visibleCount++;
    });

    return {
      totalLabels: this.labels.size,
      visibleLabels: visibleCount,
    };
  }
}
