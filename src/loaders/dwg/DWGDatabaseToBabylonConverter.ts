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
      // Step 1: Process block definitions first
      await this.processBlockDefinitions(database);

      // Step 2: Process modelspace entities
      await this.processBlockRecord(database.modelspace(), 'ModelSpace', null);

      // Step 3: Process paperspace entities (optional)
      const paperspace = database.paperspace();
      if (paperspace) {
        await this.processBlockRecord(paperspace, 'PaperSpace', null);
      }

      // Step 4: Create batched meshes from accumulated geometry
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
   * Process all block definitions and cache them
   */
  private async processBlockDefinitions(database: any): Promise<void> {
    const blockTable = database.blockTable();
    if (!blockTable) {
      this.log('[DWG Database Converter] No block table found');
      return;
    }

    const blockIterator = blockTable.newIterator();
    let blockCount = 0;

    while (!blockIterator.done()) {
      const blockRecord = blockIterator.getRecord();
      if (blockRecord) {
        const blockName = blockRecord.name();

        // Skip system blocks (modelspace, paperspace)
        if (!blockName.startsWith('*')) {
          blockCount++;
          this.log(`[DWG Database Converter] Processing block definition: ${blockName}`);

          // Process block entities and cache geometry
          await this.processBlockRecord(blockRecord, blockName, null);
        }
      }
      blockIterator.step();
    }

    this.log(`[DWG Database Converter] Processed ${blockCount} block definitions`);
  }

  /**
   * Process all entities in a block record
   */
  private async processBlockRecord(
    blockRecord: any,
    blockName: string,
    transform: BABYLON.Matrix | null
  ): Promise<void> {
    if (!blockRecord) return;

    const iterator = blockRecord.newIterator();
    let entityCount = 0;

    while (!iterator.done()) {
      const entity = iterator.entity();
      if (entity) {
        await this.processEntity(entity, transform);
        entityCount++;
      }
      iterator.step();
    }

    this.log(`[DWG Database Converter] Processed ${entityCount} entities in block: ${blockName}`);
  }

  /**
   * Process a single entity
   */
  private async processEntity(entity: any, parentTransform: BABYLON.Matrix | null): Promise<void> {
    const entityType = entity.isA().name();
    this.entityCount++;

    try {
      switch (entityType) {
        case 'AcDbLine':
          this.processLine(entity, parentTransform);
          break;

        case 'AcDbPolyline':
        case 'AcDb2dPolyline':
        case 'AcDb3dPolyline':
        case 'AcDbLWPolyline':
          this.processPolyline(entity, parentTransform);
          break;

        case 'AcDbCircle':
          this.processCircle(entity, parentTransform);
          break;

        case 'AcDbArc':
          this.processArc(entity, parentTransform);
          break;

        case 'AcDbBlockReference':
          await this.processBlockReference(entity, parentTransform);
          break;

        case 'AcDbSpline':
          this.processSpline(entity, parentTransform);
          break;

        default:
          // Skip unsupported entity types
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
    const startPt = this.convertPoint(entity.startPoint(), transform);
    const endPt = this.convertPoint(entity.endPoint(), transform);
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

    // Try different methods to get vertices depending on polyline type
    if (typeof entity.numVertices === 'function') {
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
    const blockTableRecord = entity.blockTableRecord();
    if (!blockTableRecord) {
      console.warn('[DWG Database Converter] Block reference has no table record');
      return;
    }

    const blockName = blockTableRecord.name();
    this.log(`[DWG Database Converter] Processing INSERT: ${blockName}`);

    // Get transformation
    const position = entity.position();
    const scale = entity.scaleFactors?.() || { x: 1, y: 1, z: 1 };
    const rotation = entity.rotation?.() || 0;

    // Build transformation matrix
    const transform = BABYLON.Matrix.Compose(
      new BABYLON.Vector3(scale.x, scale.y, scale.z),
      BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Up(), rotation),
      this.convertPoint(position, null)
    );

    // Combine with parent transform if exists
    const combinedTransform = parentTransform
      ? transform.multiply(parentTransform)
      : transform;

    // Process block entities with transformation
    await this.processBlockRecord(blockTableRecord, blockName, combinedTransform);
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

    for (const [colorKey, lineArrays] of this.linesByColor.entries()) {
      if (lineArrays.length === 0) continue;

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
        `[DWG Database Converter] Created batched mesh ${colorKey}: ${lineArrays.length} line segments`
      );
    }

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
