/**
 * DWG Database to Babylon Converter
 * Owner: George
 *
 * Converts AcDbDatabase (from libredwg-converter) to Babylon.js meshes
 * Handles block definitions and INSERT entities with transformations
 */

import * as BABYLON from '@babylonjs/core';
import { DWGTextEntity } from './DWGTextRenderer';

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
  textEntities: DWGTextEntity[]; // TEXT entities for rendering
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
  private textEntities: DWGTextEntity[] = []; // Collected TEXT entities
  private entityCount = 0;
  private blockInstanceCount = 0;
  private entityTypeStats = new Map<string, number>(); // Track entity types encountered

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
    this.textEntities = [];
    this.entityCount = 0;
    this.blockInstanceCount = 0;
    this.entityTypeStats.clear();

    const meshes: BABYLON.Mesh[] = [];

    try {
      // Step 1: Process modelspace entities using correct API
      const entityProcessingStart = performance.now();
      const tables = (database as any)._tables;
      const modelSpace = tables?.blockTable?.modelSpace;
      if (modelSpace) {
        await this.processModelSpace(modelSpace);
      } else {
        console.warn('[DWG Database Converter] No modelSpace found in database');
      }
      const entityProcessingTime = performance.now() - entityProcessingStart;

      // Step 2: Create batched meshes from accumulated geometry
      const meshCreationStart = performance.now();
      const batchedMeshes = this.createBatchedMeshes();
      meshes.push(...batchedMeshes);
      const meshCreationTime = performance.now() - meshCreationStart;

      const conversionTime = performance.now() - startTime;

      console.log(`[DWG Performance] Entity processing: ${entityProcessingTime.toFixed(2)}ms`);
      console.log(`[DWG Performance] Mesh creation: ${meshCreationTime.toFixed(2)}ms`);
      console.log(`[DWG Performance] Total conversion: ${conversionTime.toFixed(2)}ms`);

      this.log(`[DWG Database Converter] Conversion complete:`, {
        meshes: meshes.length,
        entities: this.entityCount,
        blockInstances: this.blockInstanceCount,
        time: `${conversionTime.toFixed(2)}ms`
      });

      return {
        meshes,
        textEntities: this.textEntities,
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

    // Log entity type statistics
    this.log(`[DWG Database Converter] Entity type breakdown:`);
    const sortedStats = Array.from(this.entityTypeStats.entries()).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sortedStats) {
      this.log(`[DWG Database Converter]   ${type}: ${count}`);
    }

    const totalPolylines = Array.from(this.linesByColor.values()).reduce((sum, lines) => sum + lines.length, 0);
    this.log(`[DWG Database Converter] Geometry extracted:`);
    this.log(`[DWG Database Converter]   Total polylines: ${totalPolylines}`);
    this.log(`[DWG Database Converter]   Layer groups: ${this.linesByColor.size}`);
  }

  /**
   * Process a single entity
   */
  private async processEntity(entity: any, parentTransform: BABYLON.Matrix | null): Promise<void> {
    // Get entity type - optimized for speed
    const entityType = entity.constructor?.name || 'Unknown';

    this.entityCount++;

    // Track entity type statistics
    const currentCount = this.entityTypeStats.get(entityType) || 0;
    this.entityTypeStats.set(entityType, currentCount + 1);

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
        case 'ba2': // CIRCLE entity (ba2 has _geo with _center, _radius, full arc)
          this.processCircle(entity, parentTransform);
          break;

        case 'AcDbArc':
        case 'Va2': // ARC entity in LibreDWG
        case 'xa2': // ARC entity (xa2 has _geo with _center, _radius, partial arc)
          this.processArc(entity, parentTransform);
          break;

        case 'AcDbEllipse':
        case 'ya2': // ELLIPSE entity (ya2 has _geo with major/minor axis)
          this.processEllipse(entity, parentTransform);
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

        case 'AcDbHatch':
        case 'Pa2': // HATCH entity (solid fills and patterns)
        case 'wa2': // HATCH entity (wa2 has _loops, _patternName, _patternType)
          this.processHatch(entity, parentTransform);
          break;

        case 'AcDbText':
        case 'Sa2': // TEXT entity (has _contents, _height, _width, _location)
          this.processText(entity, parentTransform);
          break;

        case 'AcDbMText':
          // MTEXT rendering not yet implemented - would need font system
          // No MTEXT entities found in this file (ba2 was actually CIRCLE)
          break;

        case 'AcDbDimension':
        case 'Da2': // DIMENSION entity - skip for now (complex rendering)
          break;

        case 'Ia2': // Unknown entity type - need to investigate
        case 'ka2': // Unknown entity type
        case 'Na2': // Unknown entity type
          // Log first occurrence to understand structure
          if (this.entityTypeStats.get(entityType) === 1 && this.entityCount <= 100) {
            console.log(`[DWG Converter] Unknown entity ${entityType}:`, entity);
            console.log(`  Properties:`, Object.keys(entity));
            console.log(`  _geo keys:`, entity._geo ? Object.keys(entity._geo) : 'no _geo');
          }
          break;

        case 'AcDbBlockBegin':
        case 'AcDbBlockEnd':
        case 'qa2': // BLOCK markers - skip these, they're structural
        case 'ra2':
          break; // Skip block markers

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
    // LibreDWG stores LINE data in _geo._start and _geo._end
    let startPoint, endPoint;

    if (entity._geo && entity._geo._start && entity._geo._end) {
      // LibreDWG format: _geo._start and _geo._end
      startPoint = entity._geo._start;
      endPoint = entity._geo._end;
    } else {
      // Fallback: try method-based or direct property access
      startPoint = typeof entity.startPoint === 'function' ? entity.startPoint() :
                   (entity.startPoint || entity._startPoint);
      endPoint = typeof entity.endPoint === 'function' ? entity.endPoint() :
                 (entity.endPoint || entity._endPoint);
    }

    if (!startPoint || !endPoint) {
      if (this.entityCount <= 10) {
        this.log(`[DWG Database Converter] LINE entity missing start/end points`);
      }
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
    // Only process circles with method API (top-level entities)
    // Block entities with different API are skipped to avoid wrong coordinates
    try {
      if (typeof entity.center !== 'function' || typeof entity.radius !== 'function') {
        return; // Skip - wrong API type
      }

      const centerPoint = entity.center();
      const radiusValue = entity.radius();

      if (!centerPoint || radiusValue === undefined) {
        return; // Skip invalid geometry
      }

      const center = this.convertPoint(centerPoint, transform);
      const radius = radiusValue * this.unitScale;

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
    } catch (error) {
      // Skip circles that fail to process
      return;
    }
  }

  /**
   * Process ARC entity
   */
  private processArc(entity: any, transform: BABYLON.Matrix | null): void {
    // Extract arc properties from _geo
    const centerPoint = entity._geo?._center || entity.center?.();
    const radius = (entity._geo?._radius || entity.radius?.()) * this.unitScale;
    const startAngle = entity._geo?._startAngle ?? entity.startAngle?.();
    const endAngle = entity._geo?._endAngle ?? entity.endAngle?.();

    if (!centerPoint || radius === undefined || startAngle === undefined || endAngle === undefined) {
      return;
    }

    const center = this.convertPoint(centerPoint, transform);

    // Sanity check: Skip arcs with center far from origin (>5km) or excessive radius (>5km)
    // Most industrial layouts are <5km, anything larger is likely construction/reference geometry
    const distanceFromOrigin = Math.sqrt(center.x * center.x + center.y * center.y + center.z * center.z);
    if (distanceFromOrigin > 5000 || radius > 5000) {
      return; // Silently skip bad geometry
    }

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
   * Process ELLIPSE entity
   */
  private processEllipse(entity: any, transform: BABYLON.Matrix | null): void {
    // Extract ellipse properties from _geo
    const centerPoint = entity._geo?._center;
    const majorAxisRadius = entity._geo?._majorAxisRadius * this.unitScale;
    const minorAxisRadius = entity._geo?._minorAxisRadius * this.unitScale;
    const startAngle = entity._geo?._startAngle ?? 0;
    const endAngle = entity._geo?._endAngle ?? Math.PI * 2;

    if (!centerPoint || !majorAxisRadius || !minorAxisRadius) {
      return;
    }

    const center = this.convertPoint(centerPoint, transform);

    // Sanity check: Skip ellipses with center far from origin (>5km) or excessive size (>5km)
    // Most industrial layouts are <5km, anything larger is likely construction/reference geometry
    const distanceFromOrigin = Math.sqrt(center.x * center.x + center.y * center.y + center.z * center.z);
    if (distanceFromOrigin > 5000 || majorAxisRadius > 5000 || minorAxisRadius > 5000) {
      return; // Silently skip bad geometry
    }

    // Create ellipse as polyline approximation
    const segments = 32;
    const points: BABYLON.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = startAngle + (endAngle - startAngle) * t;
      const x = Math.cos(angle) * majorAxisRadius;
      const y = Math.sin(angle) * minorAxisRadius;
      points.push(center.add(new BABYLON.Vector3(x, y, 0)));
    }

    const colorKey = this.getEntityColorKey(entity);
    if (!this.linesByColor.has(colorKey)) {
      this.linesByColor.set(colorKey, []);
    }
    this.linesByColor.get(colorKey)!.push(points);
  }

  /**
   * Process HATCH entity (solid fills and patterns)
   */
  private processHatch(entity: any, transform: BABYLON.Matrix | null): void {
    // Hatch entities have boundary loops that define the filled area
    // For now, extract the boundary as polylines

    // Try to access boundary loops via _geo._boundaryPaths or similar
    if (entity._geo && entity._geo._boundaryPaths && Array.isArray(entity._geo._boundaryPaths)) {
      // Process each boundary path as a polyline
      for (const boundaryPath of entity._geo._boundaryPaths) {
        if (boundaryPath._edges && Array.isArray(boundaryPath._edges)) {
          const vertices: BABYLON.Vector3[] = [];

          // Extract vertices from edges
          for (const edge of boundaryPath._edges) {
            // Edges could be lines, arcs, ellipses, etc.
            // For now, just extract start/end points
            if (edge._startPoint) {
              const pt = {
                x: edge._startPoint.x || 0,
                y: edge._startPoint.y || 0,
                z: entity._elevation || 0
              };
              vertices.push(this.convertPoint(pt, transform));
            }
          }

          if (vertices.length >= 2) {
            const colorKey = this.getEntityColorKey(entity);
            if (!this.linesByColor.has(colorKey)) {
              this.linesByColor.set(colorKey, []);
            }
            this.linesByColor.get(colorKey)!.push(vertices);
          }
        } else if (boundaryPath._vertices && Array.isArray(boundaryPath._vertices)) {
          // Boundary defined by vertices directly
          const vertices: BABYLON.Vector3[] = [];
          for (const vertex of boundaryPath._vertices) {
            const pt = { x: vertex.x || 0, y: vertex.y || 0, z: entity._elevation || 0 };
            vertices.push(this.convertPoint(pt, transform));
          }

          if (vertices.length >= 2) {
            const colorKey = this.getEntityColorKey(entity);
            if (!this.linesByColor.has(colorKey)) {
              this.linesByColor.set(colorKey, []);
            }
            this.linesByColor.get(colorKey)!.push(vertices);
          }
        }
      }
    } else if (entity._geo && entity._geo._loops && Array.isArray(entity._geo._loops)) {
      // Alternative structure: _loops instead of _boundaryPaths
      for (const loop of entity._geo._loops) {
        if (loop._vertices && Array.isArray(loop._vertices)) {
          const vertices: BABYLON.Vector3[] = [];
          for (const vertex of loop._vertices) {
            const pt = { x: vertex.x || 0, y: vertex.y || 0, z: entity._elevation || 0 };
            vertices.push(this.convertPoint(pt, transform));
          }

          if (vertices.length >= 2) {
            const colorKey = this.getEntityColorKey(entity);
            if (!this.linesByColor.has(colorKey)) {
              this.linesByColor.set(colorKey, []);
            }
            this.linesByColor.get(colorKey)!.push(vertices);
          }
        }
      }
    }

    // Log first few hatches to understand structure
    if (this.entityTypeStats.get('Pa2') <= 3) {
      this.log(`[DWG Database Converter] HATCH #${this.entityTypeStats.get('Pa2')} entity:`, entity);
      this.log(`[DWG Database Converter] HATCH #${this.entityTypeStats.get('Pa2')} entity._geo:`, entity._geo);
      this.log(`[DWG Database Converter] HATCH #${this.entityTypeStats.get('Pa2')} keys:`, Object.keys(entity));
      if (entity._geo) {
        this.log(`[DWG Database Converter] HATCH #${this.entityTypeStats.get('Pa2')} _geo keys:`, Object.keys(entity._geo));
      }
    }
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
   * Process TEXT entity
   */
  private processText(entity: any, transform: BABYLON.Matrix | null): void {
    // Extract TEXT properties from Sa2 entity
    // Sa2 entities have: _contents, _location, _height, _rotation, _layer

    const contents = entity._contents || '';
    if (!contents || contents.trim().length === 0) {
      return; // Skip empty text
    }

    // Get text location
    let locationPoint = entity._location;
    if (!locationPoint) {
      return; // Skip text without position
    }

    let position = this.convertPoint(locationPoint, transform);

    // Apply DWG Z-up to Babylon Y-up rotation (-90° around X)
    // This matches the root node rotation applied in DWGLoader
    const rotatedPosition = new BABYLON.Vector3(
      position.x,
      -position.z,  // Y becomes -Z
      position.y    // Z becomes Y
    );

    // Get text height (in world units after scaling)
    const height = (entity._height || 1.0) * this.unitScale;

    // Get rotation (in radians)
    const rotation = entity._rotation || 0;

    // Get layer for grouping/styling
    const layer = entity._layer || '0';

    // Create text entity data
    const textEntity: DWGTextEntity = {
      contents,
      position: rotatedPosition,
      height,
      rotation,
      layer
    };

    this.textEntities.push(textEntity);
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
   * Get entity color/layer as string key for batching
   */
  private getEntityColorKey(entity: any): string {
    // Try to use layer name for grouping (most reliable in DWG files)
    if (entity._layer && typeof entity._layer === 'string') {
      return `layer_${entity._layer}`;
    }

    // Fallback: try to get color
    try {
      // Try _color property first
      if (entity._color) {
        const color = entity._color;
        if (typeof color.colorIndex === 'function') {
          return `color_${color.colorIndex()}`;
        } else if (typeof color.colorIndex === 'number') {
          return `color_${color.colorIndex}`;
        }
      }

      // Try color() method
      const color = entity.color?.();
      if (color && typeof color.colorIndex === 'function') {
        return `color_${color.colorIndex()}`;
      }
    } catch (e) {
      // Ignore color errors
    }

    return 'layer_0'; // Default layer
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

      // Calculate bounding box for debugging
      mesh.computeWorldMatrix(true);
      const boundingInfo = mesh.getBoundingInfo();
      const min = boundingInfo.minimum;
      const max = boundingInfo.maximum;
      const size = max.subtract(min);

      this.log(
        `[DWG Database Converter] Created batched mesh ${colorKey}: ${lineArrays.length} line segments -> ${mesh.name}`
      );
      this.log(
        `[DWG Database Converter] Bounding box: min(${min.x.toFixed(2)}, ${min.y.toFixed(2)}, ${min.z.toFixed(2)}) max(${max.x.toFixed(2)}, ${max.y.toFixed(2)}, ${max.z.toFixed(2)}) size(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`
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
