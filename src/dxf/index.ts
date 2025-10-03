/**
 * DXF Import Module
 * High-performance DXF/DWG import for foundation plans
 *
 * DWG Strategy:
 * - Server-side: Use ODA SDK to convert DWG → DXF → send to client
 * - Client-side: Use CAD Exchanger Cloud API for DWG → DXF conversion
 * - Recommended: Export DXF directly from CAD software (AutoCAD, LibreCAD)
 *
 * Performance Features:
 * - Web Worker parsing for large files (>1MB)
 * - Streaming parser with chunked processing
 * - Layer-based mesh merging (reduces draw calls)
 * - LOD support for massive datasets
 * - Douglas-Peucker polyline simplification
 *
 * @example
 * ```typescript
 * import { DXFController } from './dxf';
 *
 * const controller = new DXFController(scene);
 *
 * // Import with progress tracking
 * const result = await controller.importFile(
 *   dxfFile,
 *   {
 *     simplifyTolerance: 0.1,
 *     excludeLayers: ['HIDDEN', 'TEMP']
 *   },
 *   {
 *     enableLOD: true,
 *     lodDistances: [100, 500, 1000]
 *   },
 *   (progress) => {
 *     console.log(`${progress.percentage}% - ${progress.phase}`);
 *   }
 * );
 *
 * // Control layer visibility
 * result.layerController.setLayerVisibility('Foundation', true);
 * result.layerController.setLayerOpacity('Annotations', 0.5);
 * ```
 */

export { DXFController } from './DXFController';
export { DXFParser } from './DXFParser';
export { DXFToBabylonConverter } from './DXFToBabylonConverter';

export type {
  DXFDocument,
  DXFGeometryEntity,
  DXFLine,
  DXFPolyline,
  DXFCircle,
  DXFArc,
  DXFText,
  DXFInsert,
  DXFLayer,
  DXFBlock,
  DXFBounds,
  DXFParseOptions,
  DXFParseProgress,
  DXFToBabylonOptions,
  DXFConversionResult,
  DXFLayerController,
} from './types';

export type { DXFImportResult } from './DXFController';
