/**
 * High-Performance Streaming DXF Parser
 * Optimized for large foundation plans (100k+ entities)
 * Uses chunked processing to avoid blocking main thread
 */

import type {
  DXFDocument,
  DXFGeometryEntity,
  DXFLayer,
  DXFBlock,
  DXFLine,
  DXFPolyline,
  DXFCircle,
  DXFArc,
  DXFText,
  DXFParseOptions,
  DXFParseProgress,
  DXFBounds,
} from './types';

interface GroupCode {
  code: number;
  value: string;
}

export class DXFParser {
  private lines: string[] = [];
  private currentIndex = 0;
  private layers = new Map<string, DXFLayer>();
  private blocks = new Map<string, DXFBlock>();
  private entities: DXFGeometryEntity[] = [];
  private bounds: DXFBounds = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity },
  };

  constructor(private options: DXFParseOptions = {}) {}

  /**
   * Parse DXF file with streaming support
   * Yields progress updates for large files
   */
  async parse(
    fileContent: string,
    onProgress?: (progress: DXFParseProgress) => void
  ): Promise<DXFDocument> {
    this.lines = fileContent.split('\n').map((l) => l.trim());
    this.currentIndex = 0;

    // Parse sections
    await this.parseHeader();
    await this.parseTables();
    await this.parseBlocks();
    await this.parseEntities(onProgress);

    return {
      layers: this.layers,
      blocks: this.blocks,
      entities: this.entities,
      bounds: this.bounds,
      metadata: {
        version: 'AC1015', // AutoCAD 2000
        entityCount: this.entities.length,
        layerCount: this.layers.size,
      },
    };
  }

  private async parseHeader(): Promise<void> {
    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair) break;

      if (pair.code === 0 && pair.value === 'SECTION') {
        const sectionPair = this.readPair();
        if (sectionPair?.value === 'HEADER') {
          // Skip header for now
          this.skipToEndSection();
          return;
        }
      }
    }
  }

  private async parseTables(): Promise<void> {
    this.seekToSection('TABLES');
    if (this.currentIndex >= this.lines.length) return;

    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair) break;

      if (pair.code === 0 && pair.value === 'ENDSEC') break;

      if (pair.code === 0 && pair.value === 'TABLE') {
        const tableName = this.readPair();
        if (tableName?.value === 'LAYER') {
          await this.parseLayerTable();
        }
      }
    }
  }

  private async parseLayerTable(): Promise<void> {
    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair) break;

      if (pair.code === 0 && pair.value === 'ENDTAB') break;

      if (pair.code === 0 && pair.value === 'LAYER') {
        const layer = this.parseLayer();
        if (layer) {
          this.layers.set(layer.name, layer);
        }
      }
    }
  }

  private parseLayer(): DXFLayer | null {
    let name = '';
    let color = 7; // Default white
    let lineType = 'CONTINUOUS';
    let frozen = false;

    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair) break;

      if (pair.code === 0) {
        this.currentIndex -= 2; // Step back
        break;
      }

      switch (pair.code) {
        case 2:
          name = pair.value;
          break;
        case 62:
          color = parseInt(pair.value);
          break;
        case 6:
          lineType = pair.value;
          break;
        case 70:
          frozen = (parseInt(pair.value) & 1) !== 0;
          break;
      }
    }

    return name ? { name, color, lineType, frozen, locked: false } : null;
  }

  private async parseBlocks(): Promise<void> {
    this.seekToSection('BLOCKS');
    if (this.currentIndex >= this.lines.length) return;

    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair) break;

      if (pair.code === 0 && pair.value === 'ENDSEC') break;

      if (pair.code === 0 && pair.value === 'BLOCK') {
        const block = this.parseBlock();
        if (block) {
          this.blocks.set(block.name, block);
        }
      }
    }
  }

  private parseBlock(): DXFBlock | null {
    let name = '';
    const basePoint = { x: 0, y: 0, z: 0 };
    const entities: DXFGeometryEntity[] = [];

    // Read block header
    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair) break;

      if (pair.code === 0) {
        this.currentIndex -= 2;
        break;
      }

      switch (pair.code) {
        case 2:
          name = pair.value;
          break;
        case 10:
          basePoint.x = parseFloat(pair.value);
          break;
        case 20:
          basePoint.y = parseFloat(pair.value);
          break;
        case 30:
          basePoint.z = parseFloat(pair.value);
          break;
      }
    }

    // Read block entities
    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair) break;

      if (pair.code === 0 && pair.value === 'ENDBLK') break;

      if (pair.code === 0) {
        const entity = this.parseEntity(pair.value);
        if (entity) {
          entities.push(entity);
        }
      }
    }

    return name ? { name, basePoint, entities } : null;
  }

  private async parseEntities(
    onProgress?: (progress: DXFParseProgress) => void
  ): Promise<void> {
    this.seekToSection('ENTITIES');
    if (this.currentIndex >= this.lines.length) return;

    const chunkSize = this.options.chunkSize || 1000;
    let entityCount = 0;

    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair) break;

      if (pair.code === 0 && pair.value === 'ENDSEC') break;

      if (pair.code === 0) {
        const entity = this.parseEntity(pair.value);
        if (entity && this.shouldIncludeEntity(entity)) {
          this.entities.push(entity);
          this.updateBounds(entity);
          entityCount++;

          // Yield to event loop periodically
          if (entityCount % chunkSize === 0) {
            if (onProgress) {
              onProgress({
                phase: 'parsing',
                entitiesParsed: entityCount,
                totalEntities: entityCount * 2, // Estimate
                percentage: 50,
              });
            }
            await this.yield();
          }

          if (
            this.options.maxEntities &&
            entityCount >= this.options.maxEntities
          ) {
            break;
          }
        }
      }
    }
  }

  private parseEntity(type: string): DXFGeometryEntity | null {
    switch (type) {
      case 'LINE':
        return this.parseLine();
      case 'POLYLINE':
      case 'LWPOLYLINE':
        return this.parsePolyline(type);
      case 'CIRCLE':
        return this.parseCircle();
      case 'ARC':
        return this.parseArc();
      case 'TEXT':
      case 'MTEXT':
        return this.parseText(type);
      default:
        this.skipEntity();
        return null;
    }
  }

  private parseLine(): DXFLine | null {
    let handle = '';
    let layer = '0';
    const start = { x: 0, y: 0, z: 0 };
    const end = { x: 0, y: 0, z: 0 };

    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair || pair.code === 0) {
        this.currentIndex -= 2;
        break;
      }

      switch (pair.code) {
        case 5:
          handle = pair.value;
          break;
        case 8:
          layer = pair.value;
          break;
        case 10:
          start.x = parseFloat(pair.value);
          break;
        case 20:
          start.y = parseFloat(pair.value);
          break;
        case 30:
          start.z = parseFloat(pair.value);
          break;
        case 11:
          end.x = parseFloat(pair.value);
          break;
        case 21:
          end.y = parseFloat(pair.value);
          break;
        case 31:
          end.z = parseFloat(pair.value);
          break;
      }
    }

    return { type: 'LINE', handle, layer, start, end };
  }

  private parsePolyline(type: string): DXFPolyline | null {
    let handle = '';
    let layer = '0';
    const vertices: Array<{ x: number; y: number; z?: number }> = [];
    let closed = false;

    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair || pair.code === 0) {
        if (pair?.value === 'VERTEX') {
          const vertex = this.parseVertex();
          if (vertex) vertices.push(vertex);
          continue;
        }
        this.currentIndex -= 2;
        break;
      }

      switch (pair.code) {
        case 5:
          handle = pair.value;
          break;
        case 8:
          layer = pair.value;
          break;
        case 70:
          closed = (parseInt(pair.value) & 1) !== 0;
          break;
        case 10:
          vertices.push({
            x: parseFloat(pair.value),
            y: parseFloat(this.readPair()!.value),
          });
          break;
      }
    }

    // Apply simplification if requested
    if (this.options.simplifyTolerance && vertices.length > 2) {
      const simplified = this.simplifyPolyline(
        vertices,
        this.options.simplifyTolerance
      );
      vertices.length = 0;
      vertices.push(...simplified);
    }

    return {
      type: type as 'POLYLINE' | 'LWPOLYLINE',
      handle,
      layer,
      vertices,
      closed,
    };
  }

  private parseVertex(): { x: number; y: number; z?: number } | null {
    let x = 0,
      y = 0,
      z = 0;

    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair || pair.code === 0) {
        this.currentIndex -= 2;
        break;
      }

      switch (pair.code) {
        case 10:
          x = parseFloat(pair.value);
          break;
        case 20:
          y = parseFloat(pair.value);
          break;
        case 30:
          z = parseFloat(pair.value);
          break;
      }
    }

    return { x, y, z };
  }

  private parseCircle(): DXFCircle | null {
    let handle = '';
    let layer = '0';
    const center = { x: 0, y: 0, z: 0 };
    let radius = 0;

    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair || pair.code === 0) {
        this.currentIndex -= 2;
        break;
      }

      switch (pair.code) {
        case 5:
          handle = pair.value;
          break;
        case 8:
          layer = pair.value;
          break;
        case 10:
          center.x = parseFloat(pair.value);
          break;
        case 20:
          center.y = parseFloat(pair.value);
          break;
        case 30:
          center.z = parseFloat(pair.value);
          break;
        case 40:
          radius = parseFloat(pair.value);
          break;
      }
    }

    return { type: 'CIRCLE', handle, layer, center, radius };
  }

  private parseArc(): DXFArc | null {
    let handle = '';
    let layer = '0';
    const center = { x: 0, y: 0, z: 0 };
    let radius = 0;
    let startAngle = 0;
    let endAngle = 360;

    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair || pair.code === 0) {
        this.currentIndex -= 2;
        break;
      }

      switch (pair.code) {
        case 5:
          handle = pair.value;
          break;
        case 8:
          layer = pair.value;
          break;
        case 10:
          center.x = parseFloat(pair.value);
          break;
        case 20:
          center.y = parseFloat(pair.value);
          break;
        case 30:
          center.z = parseFloat(pair.value);
          break;
        case 40:
          radius = parseFloat(pair.value);
          break;
        case 50:
          startAngle = parseFloat(pair.value);
          break;
        case 51:
          endAngle = parseFloat(pair.value);
          break;
      }
    }

    return { type: 'ARC', handle, layer, center, radius, startAngle, endAngle };
  }

  private parseText(type: string): DXFText | null {
    let handle = '';
    let layer = '0';
    let text = '';
    const position = { x: 0, y: 0, z: 0 };
    let height = 1;
    let rotation = 0;

    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair || pair.code === 0) {
        this.currentIndex -= 2;
        break;
      }

      switch (pair.code) {
        case 5:
          handle = pair.value;
          break;
        case 8:
          layer = pair.value;
          break;
        case 1:
          text = pair.value;
          break;
        case 10:
          position.x = parseFloat(pair.value);
          break;
        case 20:
          position.y = parseFloat(pair.value);
          break;
        case 30:
          position.z = parseFloat(pair.value);
          break;
        case 40:
          height = parseFloat(pair.value);
          break;
        case 50:
          rotation = parseFloat(pair.value);
          break;
      }
    }

    return {
      type: type as 'TEXT' | 'MTEXT',
      handle,
      layer,
      text,
      position,
      height,
      rotation,
    };
  }

  // ===== Helper Methods =====

  private readPair(): GroupCode | null {
    if (this.currentIndex + 1 >= this.lines.length) return null;

    const code = parseInt(this.lines[this.currentIndex]);
    const value = this.lines[this.currentIndex + 1];
    this.currentIndex += 2;

    return { code, value };
  }

  private seekToSection(sectionName: string): void {
    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (!pair) break;

      if (pair.code === 0 && pair.value === 'SECTION') {
        const namePair = this.readPair();
        if (namePair?.value === sectionName) {
          return;
        }
      }
    }
  }

  private skipToEndSection(): void {
    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (pair?.code === 0 && pair.value === 'ENDSEC') {
        return;
      }
    }
  }

  private skipEntity(): void {
    while (this.currentIndex < this.lines.length) {
      const pair = this.readPair();
      if (pair?.code === 0) {
        this.currentIndex -= 2;
        return;
      }
    }
  }

  private shouldIncludeEntity(entity: DXFGeometryEntity): boolean {
    if (this.options.includeLayers?.length) {
      return this.options.includeLayers.includes(entity.layer);
    }
    if (this.options.excludeLayers?.length) {
      return !this.options.excludeLayers.includes(entity.layer);
    }
    return true;
  }

  private updateBounds(entity: DXFGeometryEntity): void {
    const updatePoint = (x: number, y: number, z: number) => {
      this.bounds.min.x = Math.min(this.bounds.min.x, x);
      this.bounds.min.y = Math.min(this.bounds.min.y, y);
      this.bounds.min.z = Math.min(this.bounds.min.z, z);
      this.bounds.max.x = Math.max(this.bounds.max.x, x);
      this.bounds.max.y = Math.max(this.bounds.max.y, y);
      this.bounds.max.z = Math.max(this.bounds.max.z, z);
    };

    switch (entity.type) {
      case 'LINE':
        updatePoint(entity.start.x, entity.start.y, entity.start.z);
        updatePoint(entity.end.x, entity.end.y, entity.end.z);
        break;
      case 'CIRCLE':
      case 'ARC':
        updatePoint(
          entity.center.x - entity.radius,
          entity.center.y - entity.radius,
          entity.center.z
        );
        updatePoint(
          entity.center.x + entity.radius,
          entity.center.y + entity.radius,
          entity.center.z
        );
        break;
      case 'POLYLINE':
      case 'LWPOLYLINE':
        entity.vertices.forEach((v) =>
          updatePoint(v.x, v.y, v.z ?? 0)
        );
        break;
    }
  }

  private simplifyPolyline(
    points: Array<{ x: number; y: number; z?: number }>,
    tolerance: number
  ): Array<{ x: number; y: number; z?: number }> {
    // Douglas-Peucker algorithm
    if (points.length <= 2) return points;

    let maxDist = 0;
    let index = 0;

    const first = points[0];
    const last = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.perpendicularDistance(points[i], first, last);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }

    if (maxDist > tolerance) {
      const left = this.simplifyPolyline(points.slice(0, index + 1), tolerance);
      const right = this.simplifyPolyline(points.slice(index), tolerance);
      return [...left.slice(0, -1), ...right];
    } else {
      return [first, last];
    }
  }

  private perpendicularDistance(
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number }
  ): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;

    const num = Math.abs(
      dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
    );
    const den = Math.sqrt(dx * dx + dy * dy);

    return num / den;
  }

  private yield(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
}
