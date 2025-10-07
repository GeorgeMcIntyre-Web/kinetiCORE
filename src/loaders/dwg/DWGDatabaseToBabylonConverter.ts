/**
 * DWG Database to Babylon Converter
 * Owner: George
 *
 * Converts AcDbDatabase (from libredwg-converter) to Babylon.js meshes
 * Handles block definitions and INSERT entities with transformations
 */

import * as BABYLON from '@babylonjs/core';
import { CoordinateSystem } from '../../core/CoordinateSystem';

/**
 * Options for DWG database conversion
 */
export interface DWGDatabaseConversionOptions {
  scene: BABYLON.Scene;
  unitScale?: number; // Scale factor for unit conversion (default: 0.001 for mm to m)
  batchByColor?: boolean; // Batch entities by color (default: true)
  expandBlocks?: boolean; // Expand block references inline (default: true)
  debugLogging?: boolean; // Enable debug logging (default: false)
}

/**
 * Result of database conversion
 */
export interface DWGDatabaseConversionResult {
  meshes: BABYLON.Mesh[];
  entityCount: number;
  blockInstanceCount: number;
  conversionTime: number;
}

/**
 * Converter that transforms AcDbDatabase to Babylon.js meshes
 */
export class DWGDatabaseToBabylonConverter {
  private scene: BABYLON.Scene;
  private unitScale: number;
  private batchByColor: boolean;
  private expandBlocks: boolean;
  private debugLogging: boolean;

  // Block definition cache: blockName -> mesh template
  private blockDefinitions = new Map<string, BABYLON.Mesh>();

  // Batching structures
  private linesByColor = new Map<string, BABYLON.Vector3[][]>();
  private entityCount = 0;
  private blockInstanceCount = 0;

  constructor(options: DWGDatabaseConversionOptions) {
    this.scene = options.scene;
    this.unitScale = options.unitScale ?? 0.001; // Default: mm to meters
    this.batchByColor = options.batchByColor ?? true;
    this.expandBlocks = options.expandBlocks ?? true;
    this.debugLogging = options.debugLogging ?? false;
  }

  /**
   * Convert AcDbDatabase to Babylon meshes
   */
  async convert(database: any): Promise<DWGDatabaseConversionResult> {
    const startTime = performance.now();

    this.log('[DWG Database Converter] Starting conversion...');

    // Reset state
    this.blockDefinitions.clear();
    this.linesByColor.clear();
    this.entityCount = 0;
    this.blockInstanceCount = 0;

    const meshes: BABYLON.Mesh[] = [];

    try {
      // Step 1: Process modelspace entities using correct API
      // Access database structure: database._tables.blockTable.modelSpace
      const tables = (database as any)._tables;
      const modelSpace = tables?.blockTable?.modelSpace;
      if (modelSpace) {
        await this.processModelSpace(modelSpace);
      } else {
        console.warn('[DWG Database Converter] No modelSpace found in database');
      }

      // Step 2: Create batched meshes from accumulated geometry
      const batchedMeshes = this.createBatchedMeshes();
      meshes.push(...batchedMeshes);

      const conversionTime = performance.now() - startTime;

      this.log(`[DWG Database Converter] Conversion complete:`, {
        meshes: meshes.length,
        entities: this.entityCount,
        blockInstances: this.blockInstanceCount,
        time: `${conversionTime.toFixed(2)}ms`
      });

      return {
        meshes,
        entityCount: this.entityCount,
        blockInstanceCount: this.blockInstanceCount,
        conversionTime
      };
    } catch (error) {
      console.error('[DWG Database Converter] Conversion failed:', error);
      throw error;
    }
  }

  /**
   * Process modelSpace entities
   */
  private async processModelSpace(modelSpace: any): Promise<void> {
    // modelSpace._entities is a Map, not an array
    if (!modelSpace || !modelSpace._entities) {
      this.log('[DWG Database Converter] No entities in modelSpace');
      return;
    }

    const entitiesMap = modelSpace._entities as Map<any, any>;
    this.log(`[DWG Database Converter] Processing ${entitiesMap.size} entities...`);

    // Process all entities in modelSpace (iterate Map)
    for (const [id, entity] of entitiesMap) {
      if (entity) {
        await this.processEntity(entity, null);
      }
    }

    this.log(`[DWG Database Converter] Processed ${this.entityCount} entities from modelSpace`);
  }

  /**
   * Process a single entity
   */
  private async processEntity(entity: any, parentTransform: BABYLON.Matrix | null): Promise<void> {
    // Get entity type - handle different API formats
    let entityType = 'Unknown';
    try {
      if (entity.isA && typeof entity.isA === 'function') {
        const typeObj = entity.isA();
        entityType = typeObj?.name?.() || typeObj?.toString?.() || entity.constructor?.name || 'Unknown';
      } else if (entity.constructor?.name) {
        entityType = entity.constructor.name;
      }
    } catch (e) {
      entityType = entity.constructor?.name || 'Unknown';
    }

    this.entityCount++;

    // Log first few entities to understand the structure
    if (this.entityCount <= 3) {
      this.log(`[DWG Database Converter] Entity ${this.entityCount}: ${entityType}`, entity);
      this.log(`[DWG Database Converter] Entity ${this.entityCount} keys:`, Object.keys(entity));

      // Check for common geometry methods/properties
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(entity))
        .filter(name => typeof entity[name] === 'function' && !name.startsWith('_'));
      this.log(`[DWG Database Converter] Entity ${this.entityCount} methods:`, methods.slice(0, 20));
    }

    try {
      switch (entityType) {
        case 'AcDbLine':
        case 'Wa2': // LINE entity in LibreDWG
          this.processLine(entity, parentTransform);
          break;

        case 'AcDbPolyline':
        case 'AcDb2dPolyline':
        case 'AcDb3dPolyline':
        case 'AcDbLWPolyline':
        case 'Ta2': // LWPOLYLINE entity in LibreDWG (has getPoint2dAt/getPoint3dAt)
        case 'Ma2': // POLYLINE entity
          this.processPolyline(entity, parentTransform);
          break;

        case 'AcDbCircle':
        case 'Ua2': // CIRCLE entity in LibreDWG
          this.processCircle(entity, parentTransform);
          break;

        case 'AcDbArc':
        case 'Va2': // ARC entity in LibreDWG
          this.processArc(entity, parentTransform);
          break;

        case 'AcDbBlockReference':
        case 'AcDbInsert':
        case '_a2': // INSERT entity in LibreDWG (has _blockName, _position, _rotation)
          await this.processBlockReference(entity, parentTransform);
          break;

        case 'AcDbSpline':
        case 'bb2': // SPLINE entity in LibreDWG
          this.processSpline(entity, parentTransform);
          break;

        default:
          // Skip unsupported entity types (only log once per type)
          if (this.entityCount <= 10) {
            this.log(`[DWG Database Converter] Skipping unsupported entity type: ${entityType}`);
          }
          break;
      }
    } catch (error) {
      console.warn(`[DWG Database Converter] Failed to process ${entityType}:`, error);
    }
  }

  /**
   * Process LINE entity
   */
  private processLine(entity: any, transform: BABYLON.Matrix | null): void {
    // Get start and end points - could be methods or properties
    const startPoint = typeof entity.startPoint === 'function' ? entity.startPoint() :
                       (entity.startPoint || entity._startPoint);
    const endPoint = typeof entity.endPoint === 'function' ? entity.endPoint() :
                     (entity.endPoint || entity._endPoint);

    if (!startPoint || !endPoint) {
      this.log(`[DWG Database Converter] LINE entity missing start/end points`);
      return;
    }

    const startPt = this.convertPoint(startPoint, transform);
    const endPt = this.convertPoint(endPoint, transform);
    const colorKey = this.getEntityColorKey(entity);

    if (!this.linesByColor.has(colorKey)) {
      this.linesByColor.set(colorKey, []);
    }

    this.linesByColor.get(colorKey)!.push([startPt, endPt]);
  }

  /**
   * Process POLYLINE entity
   */
  private processPolyline(entity: any, transform: BABYLON.Matrix | null): void {
    const vertices: BABYLON.Vector3[] = [];

    // Debug first polyline
    if (this.entityCount <= 5) {
      this.log('[DWG Database Converter] Polyline entity._geo:', entity._geo);
    }

    // LibreDWG polylines have _geo._vertices array (preferred) or getPoint2dAt/getPoint3dAt methods
    if (entity._geo && entity._geo._vertices && Array.isArray(entity._geo._vertices)) {
      // Direct access to _vertices array (most reliable)
      if (this.entityCount <= 5) {
        this.log(`[DWG Database Converter] Using _geo._vertices (${entity._geo._vertices.length} vertices)`);
      }
      for (const vertex of entity._geo._vertices) {
        // Vertices are Vector2 objects with x, y properties
        const point = { x: vertex.x || 0, y: vertex.y || 0, z: entity._elevation || 0 };
        vertices.push(this.convertPoint(point, transform));
      }
    } else if (entity._geo && entity._geo.vertices && Array.isArray(entity._geo.vertices)) {
      // Fallback: try .vertices (without underscore)
      if (this.entityCount <= 5) {
        this.log(`[DWG Database Converter] Using _geo.vertices (${entity._geo.vertices.length} vertices)`);
      }
      for (const vertex of entity._geo.vertices) {
        const point = { x: vertex.x || vertex[0] || 0, y: vertex.y || vertex[1] || 0, z: vertex.z || vertex[2] || 0 };
        vertices.push(this.convertPoint(point, transform));
      }
    } else if (typeof entity.getPoint3dAt === 'function') {
      // Use getPoint3dAt method (Ta2 LWPOLYLINE)
      let i = 0;
      try {
        while (true) {
          const point = entity.getPoint3dAt(i);
          if (!point) break;
          if (i === 0 && this.entityCount <= 5) {
            this.log('[DWG Database Converter] First point from getPoint3dAt:', point);
          }
          vertices.push(this.convertPoint(point, transform));
          i++;
          if (i > 10000) break; // Safety limit
        }
        if (this.entityCount <= 5) {
          this.log(`[DWG Database Converter] getPoint3dAt extracted ${i} vertices`);
        }
      } catch (e) {
        // End of vertices
        if (this.entityCount <= 5) {
          this.log('[DWG Database Converter] getPoint3dAt threw exception:', e);
        }
      }
    } else if (typeof entity.numVertices === 'function') {
      // Legacy method
      const numVerts = entity.numVertices();
      for (let i = 0; i < numVerts; i++) {
        if (typeof entity.vertexAt === 'function') {
          const vertex = entity.vertexAt(i);
          vertices.push(this.convertPoint(vertex, transform));
        }
      }
    }

    if (vertices.length >= 2) {
      const colorKey = this.getEntityColorKey(entity);
      if (!this.linesByColor.has(colorKey)) {
        this.linesByColor.set(colorKey, []);
      }
      this.linesByColor.get(colorKey)!.push(vertices);

      // Debug: log batching progress
      if (this.entityCount <= 5) {
        this.log(`[DWG Database Converter] Added polyline (${vertices.length} vertices) to ${colorKey}. Total in group: ${this.linesByColor.get(colorKey)!.length}`);
      }
    } else if (this.entityCount <= 5) {
      this.log(`[DWG Database Converter] Polyline has insufficient vertices: ${vertices.length}`);
    }
  }

  /**
   * Process CIRCLE entity
   */
  private processCircle(entity: any, transform: BABYLON.Matrix | null): void {
    const center = this.convertPoint(entity.center(), transform);
    const radius = entity.radius() * this.unitScale;
    const normal = entity.normal();

    // Create circle as polyline approximation
    const segments = 32;
    const points: BABYLON.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      points.push(center.add(new BABYLON.Vector3(x, y, 0)));
    }

    const colorKey = this.getEntityColorKey(entity);
    if (!this.linesByColor.has(colorKey)) {
      this.linesByColor.set(colorKey, []);
    }
    this.linesByColor.get(colorKey)!.push(points);
  }

  /**
   * Process ARC entity
   */
  private processArc(entity: any, transform: BABYLON.Matrix | null): void {
    const center = this.convertPoint(entity.center(), transform);
    const radius = entity.radius() * this.unitScale;
    const startAngle = entity.startAngle();
    const endAngle = entity.endAngle();

    // Create arc as polyline approximation
    const segments = 24;
    const points: BABYLON.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = startAngle + (endAngle - startAngle) * t;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      points.push(center.add(new BABYLON.Vector3(x, y, 0)));
    }

    const colorKey = this.getEntityColorKey(entity);
    if (!this.linesByColor.has(colorKey)) {
      this.linesByColor.set(colorKey, []);
    }
    this.linesByColor.get(colorKey)!.push(points);
  }

  /**
   * Process SPLINE entity
   */
  private processSpline(entity: any, transform: BABYLON.Matrix | null): void {
    // For now, approximate spline with control points
    const points: BABYLON.Vector3[] = [];

    if (typeof entity.numControlPoints === 'function') {
      const numPts = entity.numControlPoints();
      for (let i = 0; i < numPts; i++) {
        if (typeof entity.controlPointAt === 'function') {
          const pt = entity.controlPointAt(i);
          points.push(this.convertPoint(pt, transform));
        }
      }
    }

    if (points.length >= 2) {
      const colorKey = this.getEntityColorKey(entity);
      if (!this.linesByColor.has(colorKey)) {
        this.linesByColor.set(colorKey, []);
      }
      this.linesByColor.get(colorKey)!.push(points);
    }
  }

  /**
   * Process BLOCK REFERENCE (INSERT) entity
   */
  private async processBlockReference(
    entity: any,
    parentTransform: BABYLON.Matrix | null
  ): Promise<void> {
    this.blockInstanceCount++;

    // Get block name
    const blockName = entity._blockName;
    if (!blockName) {
      if (this.entityCount <= 10) {
        this.log('[DWG Database Converter] INSERT entity missing block name');
      }
      return;
    }

    if (this.entityCount <= 10) {
      this.log(`[DWG Database Converter] Processing INSERT: block="${blockName}"`);
    }

    // Get transformation from INSERT entity
    const position = entity._position; // Vector3
    const rotation = entity._rotation || 0; // Rotation angle in radians
    const scale = entity._scaleFactors || { x: 1, y: 1, z: 1 }; // Scale factors

    // Build transformation matrix
    const transform = BABYLON.Matrix.Identity();

    // Apply scale
    const scaleMatrix = BABYLON.Matrix.Scaling(scale.x || 1, scale.y || 1, scale.z || 1);

    // Apply rotation (around Z axis)
    const rotationMatrix = BABYLON.Matrix.RotationZ(rotation);

    // Apply translation
    const translationMatrix = BABYLON.Matrix.Translation(
      (position?.x || 0) * this.unitScale,
      (position?.y || 0) * this.unitScale,
      (position?.z || 0) * this.unitScale
    );

    // Combine: Scale * Rotation * Translation
    scaleMatrix.multiplyToRef(rotationMatrix, transform);
    transform.multiplyToRef(translationMatrix, transform);

    // Combine with parent transform if exists
    const finalTransform = parentTransform
      ? transform.multiply(parentTransform)
      : transform;

    // Get block definition from database
    const database = entity._database;
    if (!database || !database._tables || !database._tables.blockTable) {
      if (this.entityCount <= 10) {
        this.log('[DWG Database Converter] INSERT entity missing database reference');
      }
      return;
    }

    const blockTable = database._tables.blockTable;
    const blockRecord = blockTable._recordsByName?.get(blockName);

    if (!blockRecord || !blockRecord._entities) {
      if (this.entityCount <= 10) {
        this.log(`[DWG Database Converter] Block "${blockName}" not found or has no entities`);
      }
      return;
    }

    // Process all entities in the block with the transformation
    const blockEntities = blockRecord._entities as Map<any, any>;
    if (this.entityCount <= 10) {
      this.log(`[DWG Database Converter] Expanding block "${blockName}" with ${blockEntities.size} entities`);
    }

    for (const [id, blockEntity] of blockEntities) {
      if (blockEntity) {
        await this.processEntity(blockEntity, finalTransform);
      }
    }
  }

  /**
   * Convert point from DWG coordinate system to Babylon (Z-up)
   */
  private convertPoint(point: any, transform: BABYLON.Matrix | null): BABYLON.Vector3 {
    let vec = new BABYLON.Vector3(
      point.x * this.unitScale,
      point.y * this.unitScale,
      point.z * this.unitScale
    );

    // Apply transformation if provided
    if (transform) {
      vec = BABYLON.Vector3.TransformCoordinates(vec, transform);
    }

    return vec;
  }

  /**
   * Get entity color as string key for batching
   */
  private getEntityColorKey(entity: any): string {
    try {
      const color = entity.color?.();
      if (color && typeof color.colorIndex === 'function') {
        return `color_${color.colorIndex()}`;
      }
    } catch (e) {
      // Ignore color errors
    }
    return 'color_7'; // Default white
  }

  /**
   * Create batched meshes from accumulated geometry
   */
  private createBatchedMeshes(): BABYLON.Mesh[] {
    const meshes: BABYLON.Mesh[] = [];

    this.log(
      `[DWG Database Converter] Creating batched meshes from ${this.linesByColor.size} color groups...`
    );

    // Debug: Show detailed breakdown of what we have
    for (const [colorKey, lineArrays] of this.linesByColor.entries()) {
      this.log(`[DWG Database Converter] Color group ${colorKey}: ${lineArrays.length} polylines`);
    }

    for (const [colorKey, lineArrays] of this.linesByColor.entries()) {
      if (lineArrays.length === 0) continue;

      this.log(
        `[DWG Database Converter] Creating mesh ${colorKey} with ${lineArrays.length} line segments...`
      );

      const mesh = BABYLON.MeshBuilder.CreateLineSystem(
        `dwg_lines_${colorKey}`,
        {
          lines: lineArrays,
          updatable: false
        },
        this.scene
      );

      // Apply color
      const colorIndex = parseInt(colorKey.split('_')[1]);
      const color = this.getColorFromIndex(colorIndex);
      mesh.color = color;

      meshes.push(mesh);

      this.log(
        `[DWG Database Converter] Created batched mesh ${colorKey}: ${lineArrays.length} line segments -> ${mesh.name}`
      );
    }

    this.log(`[DWG Database Converter] Total meshes created: ${meshes.length}`);

    return meshes;
  }

  /**
   * Convert AutoCAD color index to Babylon color
   */
  private getColorFromIndex(colorIndex: number): BABYLON.Color3 {
    // AutoCAD standard colors
    const colors: { [key: number]: BABYLON.Color3 } = {
      1: new BABYLON.Color3(1, 0, 0), // Red
      2: new BABYLON.Color3(1, 1, 0), // Yellow
      3: new BABYLON.Color3(0, 1, 0), // Green
      4: new BABYLON.Color3(0, 1, 1), // Cyan
      5: new BABYLON.Color3(0, 0, 1), // Blue
      6: new BABYLON.Color3(1, 0, 1), // Magenta
      7: new BABYLON.Color3(1, 1, 1), // White/Black
      8: new BABYLON.Color3(0.5, 0.5, 0.5) // Gray
    };

    return colors[colorIndex] || colors[7];
  }

  /**
   * Log message if debug logging enabled
   */
  private log(...args: any[]): void {
    if (this.debugLogging) {
      console.log(...args);
    }
  }
}
