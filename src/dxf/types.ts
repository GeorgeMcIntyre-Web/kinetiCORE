/**
 * DXF Import Type Definitions
 * Optimized for large foundation plans with streaming support
 */

import type * as BABYLON from '@babylonjs/core';

// ===== Core DXF Types =====

export interface DXFEntity {
  type: string;
  handle: string;
  layer: string;
  color?: number;
  lineType?: string;
}

export interface DXFLine extends DXFEntity {
  type: 'LINE';
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
}

export interface DXFPolyline extends DXFEntity {
  type: 'POLYLINE' | 'LWPOLYLINE';
  vertices: Array<{ x: number; y: number; z?: number }>;
  closed: boolean;
}

export interface DXFCircle extends DXFEntity {
  type: 'CIRCLE';
  center: { x: number; y: number; z: number };
  radius: number;
}

export interface DXFArc extends DXFEntity {
  type: 'ARC';
  center: { x: number; y: number; z: number };
  radius: number;
  startAngle: number; // degrees
  endAngle: number;   // degrees
}

export interface DXFText extends DXFEntity {
  type: 'TEXT' | 'MTEXT';
  text: string;
  position: { x: number; y: number; z: number };
  height: number;
  rotation?: number;
}

export interface DXFInsert extends DXFEntity {
  type: 'INSERT';
  name: string;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  rotation: number;
}

export type DXFGeometryEntity =
  | DXFLine
  | DXFPolyline
  | DXFCircle
  | DXFArc
  | DXFText
  | DXFInsert;

export interface DXFLayer {
  name: string;
  color: number;
  lineType: string;
  frozen: boolean;
  locked: boolean;
}

export interface DXFBlock {
  name: string;
  basePoint: { x: number; y: number; z: number };
  entities: DXFGeometryEntity[];
}

export interface DXFBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

// ===== Parsed DXF Document =====

export interface DXFDocument {
  layers: Map<string, DXFLayer>;
  blocks: Map<string, DXFBlock>;
  entities: DXFGeometryEntity[];
  bounds: DXFBounds;
  metadata: {
    version: string;
    entityCount: number;
    layerCount: number;
    units?: string;
  };
}

// ===== Performance & Streaming =====

export interface DXFParseOptions {
  /** Maximum entities to parse (for large files) */
  maxEntities?: number;
  /** Layers to include (whitelist) */
  includeLayers?: string[];
  /** Layers to exclude (blacklist) */
  excludeLayers?: string[];
  /** Simplify polylines with Douglas-Peucker (tolerance in units) */
  simplifyTolerance?: number;
  /** Use Web Worker for parsing (recommended for >1MB files) */
  useWorker?: boolean;
  /** Chunk size for streaming (number of entities per batch) */
  chunkSize?: number;
}

export interface DXFParseProgress {
  phase: 'parsing' | 'converting' | 'rendering';
  entitiesParsed: number;
  totalEntities: number;
  percentage: number;
}

// ===== Babylon.js Conversion =====

export interface DXFToBabylonOptions {
  /** Enable Level of Detail for massive files */
  enableLOD?: boolean;
  /** LOD distances [near, mid, far] in scene units */
  lodDistances?: [number, number, number];
  /** Merge geometries per layer (reduces draw calls) */
  mergeByLayer?: boolean;
  /** Maximum vertices per merged mesh (split if exceeded) */
  maxVerticesPerMesh?: number;
  /** Extrude 2D geometry to 3D (thickness in units) */
  extrusionThickness?: number;
  /** Parent node for all created meshes */
  parent?: BABYLON.TransformNode;
  /** Material library for layers */
  materials?: Map<string, BABYLON.Material>;
}

export interface DXFConversionResult {
  meshes: BABYLON.Mesh[];
  /** Mesh groups organized by layer */
  layerGroups: Map<string, BABYLON.Mesh[]>;
  bounds: BABYLON.BoundingBox;
  stats: {
    totalVertices: number;
    totalIndices: number;
    meshCount: number;
    renderTime: number; // ms
  };
}

// ===== Web Worker Messages =====

export interface DXFWorkerRequest {
  type: 'parse';
  fileData: ArrayBuffer;
  options: DXFParseOptions;
}

export interface DXFWorkerResponse {
  type: 'progress' | 'complete' | 'error';
  data?: DXFDocument;
  progress?: DXFParseProgress;
  error?: string;
}

// ===== Layer Management =====

export interface LayerVisibility {
  layerName: string;
  visible: boolean;
  opacity: number;
}

export interface DXFLayerController {
  setLayerVisibility(layerName: string, visible: boolean): void;
  setLayerOpacity(layerName: string, opacity: number): void;
  getLayerMeshes(layerName: string): BABYLON.Mesh[];
  getAllLayers(): string[];
}
