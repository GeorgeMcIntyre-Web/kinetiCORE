/**
 * DWG to Babylon.js Converter
 * Owner: George/Cole
 *
 * Converts DWG entities to Babylon.js meshes
 * Following kinetiCORE Z-up coordinate system standard
 */

import * as BABYLON from '@babylonjs/core';
import { DwgDatabase } from '@mlightcad/libredwg-web';
import { DWGImportError } from './errors';
import { DWGErrorType, DWGLoaderOptions, DWGImportProgress } from './types';

/**
 * Convert DWG database to Babylon.js meshes
 */
export class DWGToBabylonConverter {
  private meshCounter = 0;
  private unsupportedEntityCounts: Map<string, number> = new Map();
  private blockDefinitions: Map<string, BABYLON.TransformNode> = new Map();
  private database: DwgDatabase | null = null;

  constructor(
    private scene: BABYLON.Scene,
    private options: DWGLoaderOptions = {}
  ) {}

  /**
   * Convert DWG database to Babylon meshes
   *
   * @param database - Parsed DWG database
   * @param onProgress - Progress callback
   * @returns Converted meshes and root nodes
   */
  async convert(
    database: DwgDatabase,
    onProgress?: (progress: DWGImportProgress) => void
  ): Promise<{ meshes: BABYLON.AbstractMesh[]; rootNodes: BABYLON.TransformNode[] }> {
    this.database = database;
    const entities = database.entities || [];

    if (entities.length === 0) {
      throw new DWGImportError(
        DWGErrorType.NoEntities,
        'No entities found in DWG file.\n' +
        'The file may be empty or contain only non-geometric data.'
      );
    }

    console.log(`[DWG Converter] Converting ${entities.length} entities to Babylon meshes...`);

    const meshes: BABYLON.AbstractMesh[] = [];
    const rootNode = new BABYLON.TransformNode('DWG_Root', this.scene);

    // Filter entities if needed
    const filteredEntities = this.filterEntities(entities);

    onProgress?.({
      percent: 75,
      message: `Batching ${filteredEntities.length} entities...`,
      stage: 'loading',
      entitiesProcessed: 0,
      totalEntities: filteredEntities.length
    });

    const startTime = performance.now();

    // Group line-based entities by color for batch creation (MASSIVE performance improvement)
    const linesByColor = new Map<string, BABYLON.Vector3[][]>();
    const nonBatchableEntities: any[] = [];

    // Debug: count entity types being processed
    const batchableTypeCounts = new Map<string, number>();

    filteredEntities.forEach(entity => {
      const color = this.getEntityColor(entity);
      const colorKey = `${color.r}_${color.g}_${color.b}`;

      if (entity.type === 'LINE') {
        batchableTypeCounts.set('LINE', (batchableTypeCounts.get('LINE') || 0) + 1);
        if (!linesByColor.has(colorKey)) {
          linesByColor.set(colorKey, []);
        }
        const start = this.convertPoint(entity.start);
        const end = this.convertPoint(entity.end);
        linesByColor.get(colorKey)!.push([start, end]);
      } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
        batchableTypeCounts.set('POLYLINE', (batchableTypeCounts.get('POLYLINE') || 0) + 1);
        // Add polylines to batch
        const vertices = entity.vertices || entity.points || [];
        const points = vertices.map((v: any) => this.convertPoint(v));
        if (points.length >= 2) {
          if (entity.closed && points.length > 2) {
            points.push(points[0]);
          }
          if (!linesByColor.has(colorKey)) {
            linesByColor.set(colorKey, []);
          }
          linesByColor.get(colorKey)!.push(points);
        }
      } else if (entity.type === 'CIRCLE') {
        batchableTypeCounts.set('CIRCLE', (batchableTypeCounts.get('CIRCLE') || 0) + 1);
        // Add circle as line segments
        const center = this.convertPoint(entity.center);
        const radius = entity.radius * (this.options.unitScale || 1);
        const segments = 24; // Reduced for better performance
        const points: BABYLON.Vector3[] = [];

        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const x = center.x + radius * Math.cos(angle);
          const y = center.y + radius * Math.sin(angle);
          const z = center.z;
          points.push(new BABYLON.Vector3(x, y, z));
        }

        if (!linesByColor.has(colorKey)) {
          linesByColor.set(colorKey, []);
        }
        linesByColor.get(colorKey)!.push(points);
      } else if (entity.type === 'ARC') {
        batchableTypeCounts.set('ARC', (batchableTypeCounts.get('ARC') || 0) + 1);
        // Add arc as line segments
        const center = this.convertPoint(entity.center);
        const radius = entity.radius * (this.options.unitScale || 1);
        const startAngle = entity.startAngle || 0;
        const endAngle = entity.endAngle || Math.PI * 2;
        const segments = 12;
        const points: BABYLON.Vector3[] = [];

        for (let i = 0; i <= segments; i++) {
          const angle = startAngle + (endAngle - startAngle) * (i / segments);
          const x = center.x + radius * Math.cos(angle);
          const y = center.y + radius * Math.sin(angle);
          const z = center.z;
          points.push(new BABYLON.Vector3(x, y, z));
        }

        if (!linesByColor.has(colorKey)) {
          linesByColor.set(colorKey, []);
        }
        linesByColor.get(colorKey)!.push(points);
      } else if (entity.type === 'MLINE') {
        batchableTypeCounts.set('MLINE', (batchableTypeCounts.get('MLINE') || 0) + 1);
        // MLINE (multiline) - treat as polyline using vertices
        const vertices = entity.vertices || [];
        if (vertices.length >= 2) {
          const points = vertices.map((v: any) => this.convertPoint(v));
          if (!linesByColor.has(colorKey)) {
            linesByColor.set(colorKey, []);
          }
          linesByColor.get(colorKey)!.push(points);
        }
      } else {
        // Only INSERT and SPLINE entities remain non-batched
        nonBatchableEntities.push(entity);
      }
    });

    // Debug output
    console.log('[DWG Converter] Batchable entities processed:', Object.fromEntries(batchableTypeCounts));
    console.log(`[DWG Converter] Total line segments collected: ${Array.from(linesByColor.values()).reduce((sum, lines) => sum + lines.length, 0)}`);

    // Create batched line meshes (one per color)
    linesByColor.forEach((lines, colorKey) => {
      const color = colorKey.split('_').map(Number);
      console.log(`[DWG Converter] Creating batched mesh for color ${colorKey} with ${lines.length} line segments`);
      const lineMesh = BABYLON.MeshBuilder.CreateLineSystem(
        `Lines_${colorKey}`,
        { lines, updatable: false },
        this.scene
      );
      lineMesh.color = new BABYLON.Color3(color[0], color[1], color[2]);
      lineMesh.parent = rootNode;
      lineMesh.doNotSyncBoundingInfo = true;
      meshes.push(lineMesh);
    });

    console.log(`[DWG Converter] Created ${linesByColor.size} batched meshes (lines, polylines, circles, arcs)`);

    onProgress?.({
      percent: 85,
      message: `Processing ${nonBatchableEntities.length} INSERT blocks and splines...`,
      stage: 'loading',
      entitiesProcessed: filteredEntities.length - nonBatchableEntities.length,
      totalEntities: filteredEntities.length
    });

    // Count entity types in nonBatchableEntities
    const entityTypeCounts = new Map<string, number>();
    nonBatchableEntities.forEach(e => {
      entityTypeCounts.set(e.type, (entityTypeCounts.get(e.type) || 0) + 1);
    });
    console.log('[DWG Converter] Non-batchable entity breakdown:', Object.fromEntries(entityTypeCounts));

    // Collect INSERT marker data for batching (avoid creating thousands of individual meshes)
    // CRITICAL: Process all INSERTs in ONE pass with minimal function calls for maximum speed
    const insertMarkerLines: BABYLON.Vector3[][] = [];
    let insertMissingDefinitions = 0;
    const markerSize = 0.2; // 200mm in meters
    const unitScale = this.options.unitScale || 1;

    // Fast pass: collect all INSERT marker data (no function calls, just data extraction)
    for (const entity of nonBatchableEntities) {
      if (entity.type === 'INSERT') {
        const blockName = entity.name;
        if (!blockName) continue;

        // Since LibreDWG error 68 means no block definitions are loaded, ALL INSERTs should get markers
        // Check if block definition exists in memory (will always be false on first load)
        const hasDefinition = this.blockDefinitions.has(blockName);

        if (!hasDefinition) {
          // Inline marker creation (avoid function call overhead)
          insertMissingDefinitions++;
          const pos = entity.insertionPoint;
          const x = (pos.x || 0) * unitScale;
          const y = (pos.y || 0) * unitScale;
          const z = (pos.z || 0) * unitScale;

          const xScale = entity.xScale || 1;
          const yScale = entity.yScale || 1;
          const scaledSize = markerSize * Math.max(xScale, yScale);

          // Create cross lines
          insertMarkerLines.push([
            new BABYLON.Vector3(x - scaledSize, y, z),
            new BABYLON.Vector3(x + scaledSize, y, z)
          ]);
          insertMarkerLines.push([
            new BABYLON.Vector3(x, y - scaledSize, z),
            new BABYLON.Vector3(x, y + scaledSize, z)
          ]);

          this.trackUnsupportedEntity(`INSERT:${blockName}_MISSING`);
        }
      }
    }

    // Convert SPLINEs and other non-batchable entities
    for (const entity of nonBatchableEntities) {
      if (entity.type === 'SPLINE') {
        try {
          const result = this.convertEntity(entity, rootNode);
          if (result instanceof BABYLON.AbstractMesh) {
            meshes.push(result);
          }
        } catch (error) {
          // Silently continue
        }
      }
    }

    // Create ONE batched mesh for all INSERT placeholder markers
    if (insertMarkerLines.length > 0) {
      const markerMesh = BABYLON.MeshBuilder.CreateLineSystem(
        'InsertPlaceholders',
        { lines: insertMarkerLines, updatable: false },
        this.scene
      );
      markerMesh.color = new BABYLON.Color3(1, 0, 1); // Magenta
      markerMesh.parent = rootNode;
      markerMesh.doNotSyncBoundingInfo = true;
      meshes.push(markerMesh);
      console.log(`[DWG Converter] Created batched markers for ${insertMissingDefinitions} missing INSERT blocks (${insertMarkerLines.length} line segments)`);
    }

    const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`[DWG Converter] Converted ${meshes.length} meshes in ${totalTime}s`);
    console.log(`[DWG Converter] Loaded ${this.blockDefinitions.size} unique block definitions on-demand`);

    // Center the model at origin by calculating bounding box
    // Use fast approximation instead of computing all bounding boxes
    if (meshes.length > 0) {
      onProgress?.({
        percent: 95,
        message: 'Centering model...',
        stage: 'loading',
        entitiesProcessed: filteredEntities.length,
        totalEntities: filteredEntities.length
      });

      // Sample a subset of meshes for faster centering approximation
      const SAMPLE_SIZE = Math.min(100, meshes.length);
      const step = Math.max(1, Math.floor(meshes.length / SAMPLE_SIZE));

      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

      for (let i = 0; i < meshes.length; i += step) {
        const mesh = meshes[i];
        mesh.computeWorldMatrix(true);
        const boundingInfo = mesh.getBoundingInfo();
        const min = boundingInfo.boundingBox.minimumWorld;
        const max = boundingInfo.boundingBox.maximumWorld;

        minX = Math.min(minX, min.x);
        minY = Math.min(minY, min.y);
        minZ = Math.min(minZ, min.z);
        maxX = Math.max(maxX, max.x);
        maxY = Math.max(maxY, max.y);
        maxZ = Math.max(maxZ, max.z);
      }

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;

      // Offset root node to center the model at origin
      rootNode.position = new BABYLON.Vector3(-centerX, -centerY, -centerZ);

      console.log(`[DWG Converter] Centered model at origin (offset: ${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)}m)`);
    }

    // Log unsupported entity summary
    if (this.unsupportedEntityCounts.size > 0) {
      console.warn('[DWG Converter] Unsupported entities (not converted):');
      this.unsupportedEntityCounts.forEach((count, type) => {
        console.warn(`  - ${type}: ${count} entities`);
      });
    }

    onProgress?.({
      percent: 100,
      message: `Loaded ${meshes.length} objects`,
      stage: 'loading',
      entitiesProcessed: filteredEntities.length,
      totalEntities: filteredEntities.length
    });

    return { meshes, rootNodes: [rootNode] };
  }

  /**
   * Filter entities based on options
   */
  private filterEntities(entities: any[]): any[] {
    let filtered = entities;

    // CRITICAL: Filter out unsupported entity types EARLY to avoid processing them
    // NOTE: MTEXT/TEXT removed since we skip text rendering for performance
    const SUPPORTED_TYPES = new Set(['LINE', 'LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC', 'SPLINE', 'INSERT', 'MLINE']);
    const unsupportedEntities: any[] = [];

    filtered = filtered.filter(e => {
      if (SUPPORTED_TYPES.has(e.type)) {
        return true;
      } else {
        unsupportedEntities.push(e);
        return false;
      }
    });

    // Count unsupported types
    unsupportedEntities.forEach(e => {
      this.trackUnsupportedEntity(e.type);
    });

    // Count filtered entity types for debugging
    const filteredTypeCounts = new Map<string, number>();
    filtered.forEach(e => {
      filteredTypeCounts.set(e.type, (filteredTypeCounts.get(e.type) || 0) + 1);
    });

    console.log(`[DWG Converter] Filtered to ${filtered.length} supported entities (skipped ${unsupportedEntities.length} unsupported)`);
    console.log(`[DWG Converter] Filtered entity types:`, Object.fromEntries(filteredTypeCounts));

    // Filter by layer
    if (this.options.layerFilter && this.options.layerFilter.length > 0) {
      filtered = filtered.filter(e =>
        this.options.layerFilter!.includes(e.layer)
      );
    }

    // Filter by type
    if (this.options.entityTypeFilter && this.options.entityTypeFilter.length > 0) {
      filtered = filtered.filter(e =>
        this.options.entityTypeFilter!.includes(e.type)
      );
    }

    // Filter invisible entities
    filtered = filtered.filter(e => e.isVisible !== false);

    return filtered;
  }

  /**
   * Convert single DWG entity to Babylon mesh or transform node
   */
  private convertEntity(entity: any, parent: BABYLON.TransformNode): BABYLON.AbstractMesh | BABYLON.TransformNode | null {
    switch (entity.type) {
      case 'LINE':
        return this.convertLine(entity, parent);

      case 'LWPOLYLINE':
      case 'POLYLINE':
        return this.convertPolyline(entity, parent);

      case 'CIRCLE':
        return this.convertCircle(entity, parent);

      case 'ARC':
        return this.convertArc(entity, parent);

      case 'MTEXT':
      case 'TEXT':
        // Text entities - create placeholder for now
        return this.convertText(entity, parent);

      case 'INSERT':
        return this.convertInsert(entity, parent);

      case 'HATCH':
        // Hatch patterns - complex, skip for now
        this.trackUnsupportedEntity('HATCH');
        return null;

      case 'SPLINE':
        return this.convertSpline(entity, parent);

      case 'DIMENSION':
        // Dimensions - would need special handling
        this.trackUnsupportedEntity('DIMENSION');
        return null;

      default:
        this.trackUnsupportedEntity(entity.type);
        return null;
    }
  }

  /**
   * Track unsupported entity type
   */
  private trackUnsupportedEntity(type: string): void {
    const count = this.unsupportedEntityCounts.get(type) || 0;
    this.unsupportedEntityCounts.set(type, count + 1);
  }

  /**
   * Get or create block definition (lazy loading)
   */
  private getBlockDefinition(blockName: string): BABYLON.TransformNode | null {
    // Return cached if exists
    if (this.blockDefinitions.has(blockName)) {
      return this.blockDefinitions.get(blockName)!;
    }

    // Find block record in database
    if (!this.database?.tables?.BLOCK_RECORD?.entries) {
      return null;
    }

    const blockRecord = this.database.tables.BLOCK_RECORD.entries.find(
      (record: any) => record.name === blockName
    );

    if (!blockRecord || !blockRecord.entities || blockRecord.entities.length === 0) {
      return null;
    }

    // Create block definition on demand
    const blockContainer = new BABYLON.TransformNode(`Block_${blockName}`, this.scene);
    blockContainer.setEnabled(false); // Hide the definition

    // Convert all entities in the block
    blockRecord.entities.forEach((entity: any) => {
      try {
        this.convertEntity(entity, blockContainer);
      } catch (error) {
        console.warn(`[DWG Converter] Failed to convert entity in block ${blockName}:`, error);
      }
    });

    this.blockDefinitions.set(blockName, blockContainer);
    return blockContainer;
  }

  /**
   * Convert LINE entity
   */
  private convertLine(entity: any, parent: BABYLON.TransformNode): BABYLON.AbstractMesh {
    const start = this.convertPoint(entity.start);
    const end = this.convertPoint(entity.end);

    const line = BABYLON.MeshBuilder.CreateLines(
      `Line_${this.meshCounter++}`,
      {
        points: [start, end],
        updatable: false
      },
      this.scene
    );

    line.parent = parent;
    line.color = this.getEntityColor(entity);
    line.doNotSyncBoundingInfo = true; // Disable automatic bounding info updates

    return line;
  }

  /**
   * Convert POLYLINE/LWPOLYLINE entity
   */
  private convertPolyline(entity: any, parent: BABYLON.TransformNode): BABYLON.AbstractMesh | null {
    const vertices = entity.vertices || entity.points || [];
    const points = vertices.map((v: any) => this.convertPoint(v));

    if (points.length < 2) {
      return null;
    }

    // Close polyline if specified
    if (entity.closed && points.length > 2) {
      points.push(points[0]);
    }

    const polyline = BABYLON.MeshBuilder.CreateLines(
      `Polyline_${this.meshCounter++}`,
      { points, updatable: false },
      this.scene
    );

    polyline.parent = parent;
    polyline.color = this.getEntityColor(entity);
    polyline.doNotSyncBoundingInfo = true;

    return polyline;
  }

  /**
   * Convert CIRCLE entity
   */
  private convertCircle(entity: any, parent: BABYLON.TransformNode): BABYLON.AbstractMesh {
    const center = this.convertPoint(entity.center);
    const radius = entity.radius * (this.options.unitScale || 1);

    // Use lines for circles - much faster than disc meshes
    const segments = 32; // Reduced from 64 for better performance
    const points: BABYLON.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);
      const z = center.z;
      points.push(new BABYLON.Vector3(x, y, z));
    }

    const circle = BABYLON.MeshBuilder.CreateLines(
      `Circle_${this.meshCounter++}`,
      { points, updatable: false },
      this.scene
    );

    circle.parent = parent;
    circle.color = this.getEntityColor(entity);
    circle.doNotSyncBoundingInfo = true;

    return circle;
  }

  /**
   * Convert ARC entity
   */
  private convertArc(entity: any, parent: BABYLON.TransformNode): BABYLON.AbstractMesh {
    // Create arc as polyline approximation
    const center = this.convertPoint(entity.center);
    const radius = entity.radius * (this.options.unitScale || 1);
    const startAngle = entity.startAngle || 0;
    const endAngle = entity.endAngle || Math.PI * 2;

    const segments = 16; // Reduced from 32 for better performance
    const points: BABYLON.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / segments);
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);
      const z = center.z;
      points.push(new BABYLON.Vector3(x, y, z));
    }

    const arc = BABYLON.MeshBuilder.CreateLines(
      `Arc_${this.meshCounter++}`,
      { points, updatable: false },
      this.scene
    );

    arc.parent = parent;
    arc.color = this.getEntityColor(entity);
    arc.doNotSyncBoundingInfo = true;

    return arc;
  }

  /**
   * Convert SPLINE entity
   */
  private convertSpline(entity: any, parent: BABYLON.TransformNode): BABYLON.AbstractMesh | null {
    const controlPoints = entity.controlPoints || [];
    const points = controlPoints.map((p: any) => this.convertPoint(p));

    if (points.length < 2) {
      return null;
    }

    const spline = BABYLON.MeshBuilder.CreateLines(
      `Spline_${this.meshCounter++}`,
      { points, updatable: false },
      this.scene
    );

    spline.parent = parent;
    spline.color = this.getEntityColor(entity);
    spline.doNotSyncBoundingInfo = true;

    return spline;
  }

  /**
   * Convert INSERT entity (block instance)
   */
  private convertInsert(entity: any, parent: BABYLON.TransformNode): BABYLON.TransformNode | null {
    const blockName = entity.name;
    if (!blockName) {
      return null;
    }

    const blockDefinition = this.getBlockDefinition(blockName);

    // Create instance container
    const instance = new BABYLON.TransformNode(`Insert_${this.meshCounter++}_${blockName}`, this.scene);
    instance.parent = parent;

    // Apply insertion point
    const insertionPoint = this.convertPoint(entity.insertionPoint);
    instance.position = insertionPoint;

    // Apply rotation (convert from radians)
    if (entity.rotation) {
      instance.rotation.z = entity.rotation;
    }

    // Apply scale
    const xScale = entity.xScale || 1;
    const yScale = entity.yScale || 1;
    const zScale = entity.zScale || 1;
    instance.scaling = new BABYLON.Vector3(xScale, yScale, zScale);

    if (blockDefinition) {
      // Use instancing for better performance (much faster than cloning)
      blockDefinition.getChildren().forEach((child) => {
        if (child instanceof BABYLON.Mesh) {
          // Use createInstance for meshes (shares geometry, separate transforms)
          const instancedMesh = child.createInstance(`${child.name}_inst_${this.meshCounter}`);
          instancedMesh.parent = instance;
          instancedMesh.setEnabled(true);
        } else if (child instanceof BABYLON.AbstractMesh) {
          // For LinesMesh and other AbstractMesh types, use clone
          const clonedMesh = child.clone(`${child.name}_inst_${this.meshCounter}`, instance);
          if (clonedMesh) {
            clonedMesh.setEnabled(true);
          }
        }
      });
    } else {
      // Block definition not available (LibreDWG parsing issue)
      // Create a placeholder cross marker so user can see block positions
      const markerSize = 0.2; // 200mm in meters

      // Create cross with 2 lines
      const line1 = BABYLON.MeshBuilder.CreateLines(
        `BlockMarker_${this.meshCounter++}`,
        {
          points: [
            new BABYLON.Vector3(-markerSize, 0, 0),
            new BABYLON.Vector3(markerSize, 0, 0)
          ],
          updatable: false
        },
        this.scene
      );
      line1.parent = instance;
      line1.color = new BABYLON.Color3(1, 0, 1); // Magenta for missing blocks
      line1.doNotSyncBoundingInfo = true;

      const line2 = BABYLON.MeshBuilder.CreateLines(
        `BlockMarker_${this.meshCounter++}`,
        {
          points: [
            new BABYLON.Vector3(0, -markerSize, 0),
            new BABYLON.Vector3(0, markerSize, 0)
          ],
          updatable: false
        },
        this.scene
      );
      line2.parent = instance;
      line2.color = new BABYLON.Color3(1, 0, 1); // Magenta for missing blocks
      line2.doNotSyncBoundingInfo = true;

      this.trackUnsupportedEntity(`INSERT:${blockName}_MISSING`);
    }

    return instance;
  }

  /**
   * Create INSERT block instance with full geometry
   *
   * TODO: This method is temporarily disabled pending block expansion feature implementation.
   * It will be used when we add support for expanding DWG block references into full geometry.
   *
   * @deprecated Currently using simplified INSERT marker approach
   */
  // @ts-expect-error - Method kept for future block expansion feature
  private createInsertInstance(
    entity: any,
    blockName: string,
    blockDefinition: BABYLON.TransformNode,
    parent: BABYLON.TransformNode
  ): BABYLON.TransformNode {
    const instance = new BABYLON.TransformNode(`Insert_${this.meshCounter++}_${blockName}`, this.scene);
    instance.parent = parent;

    // Apply transformations
    instance.position = this.convertPoint(entity.insertionPoint);
    if (entity.rotation) {
      instance.rotation.z = entity.rotation;
    }
    instance.scaling = new BABYLON.Vector3(
      entity.xScale || 1,
      entity.yScale || 1,
      entity.zScale || 1
    );

    // Use instancing for better performance
    blockDefinition.getChildren().forEach((child) => {
      if (child instanceof BABYLON.Mesh) {
        const instancedMesh = child.createInstance(`${child.name}_inst_${this.meshCounter}`);
        instancedMesh.parent = instance;
        instancedMesh.setEnabled(true);
      } else if (child instanceof BABYLON.AbstractMesh) {
        const clonedMesh = child.clone(`${child.name}_inst_${this.meshCounter}`, instance);
        if (clonedMesh) {
          clonedMesh.setEnabled(true);
        }
      }
    });

    return instance;
  }

  /**
   * Create marker line data for missing INSERT block (for batching)
   * Returns array of line segments (cross pattern)
   *
   * TODO: This will be used when batch rendering of INSERT markers is implemented
   * for performance optimization with large DWG files containing many block references.
   *
   * @deprecated Currently using individual meshes for INSERT markers
   */
  // @ts-expect-error - Method kept for future batching optimization
  private createInsertMarkerData(entity: any): BABYLON.Vector3[][] {
    const markerSize = 0.2; // 200mm in meters
    const position = this.convertPoint(entity.insertionPoint);

    // Apply scale
    const xScale = entity.xScale || 1;
    const yScale = entity.yScale || 1;
    const scaledSize = markerSize * Math.max(xScale, yScale);

    // Create cross with 2 perpendicular lines (in world space)
    const line1 = [
      new BABYLON.Vector3(position.x - scaledSize, position.y, position.z),
      new BABYLON.Vector3(position.x + scaledSize, position.y, position.z)
    ];

    const line2 = [
      new BABYLON.Vector3(position.x, position.y - scaledSize, position.z),
      new BABYLON.Vector3(position.x, position.y + scaledSize, position.z)
    ];

    return [line1, line2];
  }

  /**
   * Convert TEXT/MTEXT entity (placeholder)
   */
  private convertText(_entity: any, _parent: BABYLON.TransformNode): BABYLON.AbstractMesh | null {
    // Skip text rendering for performance - text entities don't add much visual value
    // and creating boxes for every text is expensive
    return null;
  }

  /**
   * Convert DWG point to Babylon Vector3 with coordinate system conversion
   * DWG uses XY plane (Z-up is implicit), kinetiCORE uses Z-up
   */
  private convertPoint(point: any): BABYLON.Vector3 {
    if (!point) {
      return BABYLON.Vector3.Zero();
    }

    const scale = this.options.unitScale || 1;
    const x = (point.x || 0) * scale;
    let y = (point.y || 0) * scale;
    let z = (point.z || 0) * scale;

    // DWG is typically Z-up already, but verify with actual data
    // If conversion needed, swap Y and Z
    if (this.options.convertToZUp) {
      [y, z] = [z, y];
    }

    return new BABYLON.Vector3(x, y, z);
  }

  /**
   * Get entity color
   */
  private getEntityColor(entity: any): BABYLON.Color3 {
    const colorIndex = entity.colorIndex || 7; // Default to white

    // AutoCAD color palette (simplified)
    const colors: Record<number, BABYLON.Color3> = {
      0: new BABYLON.Color3(0, 0, 0),       // ByBlock
      1: new BABYLON.Color3(1, 0, 0),       // Red
      2: new BABYLON.Color3(1, 1, 0),       // Yellow
      3: new BABYLON.Color3(0, 1, 0),       // Green
      4: new BABYLON.Color3(0, 1, 1),       // Cyan
      5: new BABYLON.Color3(0, 0, 1),       // Blue
      6: new BABYLON.Color3(1, 0, 1),       // Magenta
      7: new BABYLON.Color3(1, 1, 1),       // White
      256: new BABYLON.Color3(0.8, 0.8, 0.8) // ByLayer
    };

    return colors[colorIndex] || new BABYLON.Color3(1, 1, 1);
  }
}
