/**
 * DXF to Babylon.js Converter with LOD Support
 * Optimized for massive foundation plans with layer-based merging
 */

import * as BABYLON from '@babylonjs/core';
import type {
  DXFDocument,
  DXFGeometryEntity,
  DXFLine,
  DXFPolyline,
  DXFCircle,
  DXFArc,
  DXFToBabylonOptions,
  DXFConversionResult,
} from './types';

interface MeshBuilder {
  positions: number[];
  indices: number[];
  colors: number[];
}

export class DXFToBabylonConverter {
  private scene: BABYLON.Scene;
  private materialCache = new Map<string, BABYLON.Material>();

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Convert DXF document to Babylon.js meshes
   * Creates optimized merged meshes per layer for performance
   */
  convert(
    document: DXFDocument,
    options: DXFToBabylonOptions = {}
  ): DXFConversionResult {
    const startTime = performance.now();
    const meshes: BABYLON.Mesh[] = [];
    const layerGroups = new Map<string, BABYLON.Mesh[]>();

    if (options.mergeByLayer) {
      // Group entities by layer for merging
      const entitiesByLayer = this.groupByLayer(document.entities);

      entitiesByLayer.forEach((entities, layerName) => {
        const layerMeshes = this.createMergedLayerMesh(
          layerName,
          entities,
          document,
          options
        );
        meshes.push(...layerMeshes);
        layerGroups.set(layerName, layerMeshes);
      });
    } else {
      // Create individual meshes
      document.entities.forEach((entity) => {
        const mesh = this.createEntityMesh(entity, document, options);
        if (mesh) {
          meshes.push(mesh);
          const layerMeshes = layerGroups.get(entity.layer) || [];
          layerMeshes.push(mesh);
          layerGroups.set(entity.layer, layerMeshes);
        }
      });
    }

    // Apply LOD if requested
    if (options.enableLOD && options.lodDistances) {
      this.applyLOD(meshes, options.lodDistances);
    }

    // Calculate bounds
    const bounds = this.calculateBounds(meshes);

    // Calculate stats
    const stats = this.calculateStats(meshes, performance.now() - startTime);

    return { meshes, layerGroups, bounds, stats };
  }

  private groupByLayer(
    entities: DXFGeometryEntity[]
  ): Map<string, DXFGeometryEntity[]> {
    const groups = new Map<string, DXFGeometryEntity[]>();

    entities.forEach((entity) => {
      const layer = entity.layer || '0';
      if (!groups.has(layer)) {
        groups.set(layer, []);
      }
      groups.get(layer)!.push(entity);
    });

    return groups;
  }

  private createMergedLayerMesh(
    layerName: string,
    entities: DXFGeometryEntity[],
    document: DXFDocument,
    options: DXFToBabylonOptions
  ): BABYLON.Mesh[] {
    const maxVertices = options.maxVerticesPerMesh || 65535;
    const builders: MeshBuilder[] = [
      { positions: [], indices: [], colors: [] },
    ];
    let currentBuilder = 0;

    const layer = document.layers.get(layerName);
    const color = this.dxfColorToRGB(layer?.color || 7);

    entities.forEach((entity) => {
      const builder = builders[currentBuilder];
      const vertexCount = builder.positions.length / 3;

      // Check if we need a new builder to avoid vertex limit
      if (vertexCount > maxVertices - 1000) {
        currentBuilder++;
        builders.push({ positions: [], indices: [], colors: [] });
      }

      this.addEntityToBuilder(builders[currentBuilder], entity, color, options);
    });

    // Create meshes from builders
    return builders
      .filter((b) => b.positions.length > 0)
      .map((builder, index) => {
        const meshName = `${layerName}_${index}`;
        return this.createMeshFromBuilder(meshName, builder, layerName, options);
      });
  }

  private addEntityToBuilder(
    builder: MeshBuilder,
    entity: DXFGeometryEntity,
    color: BABYLON.Color3,
    options: DXFToBabylonOptions
  ): void {
    const baseIndex = builder.positions.length / 3;

    switch (entity.type) {
      case 'LINE':
        this.addLine(builder, entity, color, options.extrusionThickness);
        break;
      case 'POLYLINE':
      case 'LWPOLYLINE':
        this.addPolyline(builder, entity, color, options.extrusionThickness);
        break;
      case 'CIRCLE':
        this.addCircle(builder, entity, color, options.extrusionThickness);
        break;
      case 'ARC':
        this.addArc(builder, entity, color, options.extrusionThickness);
        break;
    }
  }

  private addLine(
    builder: MeshBuilder,
    line: DXFLine,
    color: BABYLON.Color3,
    thickness = 0.1
  ): void {
    const start = new BABYLON.Vector3(line.start.x, line.start.z, line.start.y);
    const end = new BABYLON.Vector3(line.end.x, line.end.z, line.end.y);

    // Create line as thin box for visibility
    const direction = end.subtract(start);
    const length = direction.length();
    const center = BABYLON.Vector3.Lerp(start, end, 0.5);

    this.addBox(builder, center, length, thickness, thickness, direction, color);
  }

  private addPolyline(
    builder: MeshBuilder,
    polyline: DXFPolyline,
    color: BABYLON.Color3,
    thickness = 0.1
  ): void {
    const vertices = polyline.vertices;

    for (let i = 0; i < vertices.length - 1; i++) {
      const v1 = vertices[i];
      const v2 = vertices[i + 1];

      const start = new BABYLON.Vector3(v1.x, v1.z ?? 0, v1.y);
      const end = new BABYLON.Vector3(v2.x, v2.z ?? 0, v2.y);

      const direction = end.subtract(start);
      const length = direction.length();
      const center = BABYLON.Vector3.Lerp(start, end, 0.5);

      this.addBox(builder, center, length, thickness, thickness, direction, color);
    }

    // Close if needed
    if (polyline.closed && vertices.length > 2) {
      const v1 = vertices[vertices.length - 1];
      const v2 = vertices[0];

      const start = new BABYLON.Vector3(v1.x, v1.z ?? 0, v1.y);
      const end = new BABYLON.Vector3(v2.x, v2.z ?? 0, v2.y);

      const direction = end.subtract(start);
      const length = direction.length();
      const center = BABYLON.Vector3.Lerp(start, end, 0.5);

      this.addBox(builder, center, length, thickness, thickness, direction, color);
    }
  }

  private addCircle(
    builder: MeshBuilder,
    circle: DXFCircle,
    color: BABYLON.Color3,
    thickness = 0.1
  ): void {
    const center = new BABYLON.Vector3(
      circle.center.x,
      circle.center.z,
      circle.center.y
    );
    const segments = Math.max(16, Math.floor(circle.radius * 8));

    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;

      const p1 = center.add(
        new BABYLON.Vector3(
          Math.cos(angle1) * circle.radius,
          0,
          Math.sin(angle1) * circle.radius
        )
      );
      const p2 = center.add(
        new BABYLON.Vector3(
          Math.cos(angle2) * circle.radius,
          0,
          Math.sin(angle2) * circle.radius
        )
      );

      const direction = p2.subtract(p1);
      const length = direction.length();
      const midpoint = BABYLON.Vector3.Lerp(p1, p2, 0.5);

      this.addBox(builder, midpoint, length, thickness, thickness, direction, color);
    }
  }

  private addArc(
    builder: MeshBuilder,
    arc: DXFArc,
    color: BABYLON.Color3,
    thickness = 0.1
  ): void {
    const center = new BABYLON.Vector3(arc.center.x, arc.center.z, arc.center.y);
    const startRad = (arc.startAngle * Math.PI) / 180;
    const endRad = (arc.endAngle * Math.PI) / 180;

    let totalAngle = endRad - startRad;
    if (totalAngle < 0) totalAngle += Math.PI * 2;

    const segments = Math.max(8, Math.floor((totalAngle / (Math.PI * 2)) * 32));

    for (let i = 0; i < segments; i++) {
      const angle1 = startRad + (i / segments) * totalAngle;
      const angle2 = startRad + ((i + 1) / segments) * totalAngle;

      const p1 = center.add(
        new BABYLON.Vector3(
          Math.cos(angle1) * arc.radius,
          0,
          Math.sin(angle1) * arc.radius
        )
      );
      const p2 = center.add(
        new BABYLON.Vector3(
          Math.cos(angle2) * arc.radius,
          0,
          Math.sin(angle2) * arc.radius
        )
      );

      const direction = p2.subtract(p1);
      const length = direction.length();
      const midpoint = BABYLON.Vector3.Lerp(p1, p2, 0.5);

      this.addBox(builder, midpoint, length, thickness, thickness, direction, color);
    }
  }

  private addBox(
    builder: MeshBuilder,
    center: BABYLON.Vector3,
    length: number,
    width: number,
    height: number,
    direction: BABYLON.Vector3,
    color: BABYLON.Color3
  ): void {
    const baseIndex = builder.positions.length / 3;

    // Simplified box vertices (8 vertices)
    const halfL = length / 2;
    const halfW = width / 2;
    const halfH = height / 2;

    // Local space vertices
    const localVerts = [
      [-halfL, -halfW, -halfH],
      [halfL, -halfW, -halfH],
      [halfL, halfW, -halfH],
      [-halfL, halfW, -halfH],
      [-halfL, -halfW, halfH],
      [halfL, -halfW, halfH],
      [halfL, halfW, halfH],
      [-halfL, halfW, halfH],
    ];

    // Calculate rotation to align with direction
    const forward = direction.normalize();
    const right = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), forward);
    const up = BABYLON.Vector3.Cross(forward, right);

    // Transform and add vertices
    localVerts.forEach(([x, y, z]) => {
      const local = forward
        .scale(x)
        .add(right.scale(y))
        .add(up.scale(z));
      const world = center.add(local);

      builder.positions.push(world.x, world.y, world.z);
      builder.colors.push(color.r, color.g, color.b, 1);
    });

    // Box indices (12 triangles)
    const boxIndices = [
      0, 1, 2, 0, 2, 3, // Front
      1, 5, 6, 1, 6, 2, // Right
      5, 4, 7, 5, 7, 6, // Back
      4, 0, 3, 4, 3, 7, // Left
      3, 2, 6, 3, 6, 7, // Top
      4, 5, 1, 4, 1, 0, // Bottom
    ];

    boxIndices.forEach((index) => {
      builder.indices.push(baseIndex + index);
    });
  }

  private createMeshFromBuilder(
    name: string,
    builder: MeshBuilder,
    layerName: string,
    options: DXFToBabylonOptions
  ): BABYLON.Mesh {
    const mesh = new BABYLON.Mesh(name, this.scene);

    const vertexData = new BABYLON.VertexData();
    vertexData.positions = builder.positions;
    vertexData.indices = builder.indices;
    vertexData.colors = builder.colors;

    vertexData.applyToMesh(mesh);

    // Apply material
    const material = this.getOrCreateMaterial(layerName, options);
    mesh.material = material;

    // Set parent if specified
    if (options.parent) {
      mesh.parent = options.parent;
    }

    mesh.metadata = { layer: layerName, type: 'dxf_import' };

    return mesh;
  }

  private createEntityMesh(
    entity: DXFGeometryEntity,
    document: DXFDocument,
    options: DXFToBabylonOptions
  ): BABYLON.Mesh | null {
    const builder: MeshBuilder = { positions: [], indices: [], colors: [] };
    const layer = document.layers.get(entity.layer);
    const color = this.dxfColorToRGB(layer?.color || 7);

    this.addEntityToBuilder(builder, entity, color, options);

    if (builder.positions.length === 0) return null;

    return this.createMeshFromBuilder(
      `${entity.type}_${entity.handle}`,
      builder,
      entity.layer,
      options
    );
  }

  private getOrCreateMaterial(
    layerName: string,
    options: DXFToBabylonOptions
  ): BABYLON.Material {
    if (options.materials?.has(layerName)) {
      return options.materials.get(layerName)!;
    }

    if (this.materialCache.has(layerName)) {
      return this.materialCache.get(layerName)!;
    }

    const material = new BABYLON.StandardMaterial(`mat_${layerName}`, this.scene);
    material.diffuseColor = BABYLON.Color3.White();
    material.emissiveColor = BABYLON.Color3.White().scale(0.2);
    material.backFaceCulling = false;

    this.materialCache.set(layerName, material);
    return material;
  }

  private applyLOD(meshes: BABYLON.Mesh[], distances: [number, number, number]): void {
    meshes.forEach((mesh) => {
      // Create simplified versions
      const lod1 = mesh.clone(`${mesh.name}_lod1`);
      const lod2 = mesh.clone(`${mesh.name}_lod2`);

      // Simplify geometry (basic decimation)
      this.simplifyMesh(lod1, 0.5);
      this.simplifyMesh(lod2, 0.25);

      mesh.addLODLevel(distances[0], lod1);
      mesh.addLODLevel(distances[1], lod2);
      mesh.addLODLevel(distances[2], null); // Don't render at far distance
    });
  }

  private simplifyMesh(mesh: BABYLON.Mesh, factor: number): void {
    // Basic vertex decimation - remove every nth vertex
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = mesh.getIndices();

    if (!positions || !indices) return;

    const step = Math.max(1, Math.floor(1 / factor));
    const newIndices = indices.filter((_, i) => i % step === 0);

    mesh.setIndices(newIndices);
  }

  private calculateBounds(meshes: BABYLON.Mesh[]): BABYLON.BoundingBox {
    let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

    meshes.forEach((mesh) => {
      mesh.computeWorldMatrix(true);
      const boundingInfo = mesh.getBoundingInfo();

      min = BABYLON.Vector3.Minimize(min, boundingInfo.boundingBox.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, boundingInfo.boundingBox.maximumWorld);
    });

    return new BABYLON.BoundingBox(min, max);
  }

  private calculateStats(
    meshes: BABYLON.Mesh[],
    renderTime: number
  ): DXFConversionResult['stats'] {
    let totalVertices = 0;
    let totalIndices = 0;

    meshes.forEach((mesh) => {
      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const indices = mesh.getIndices();

      totalVertices += positions ? positions.length / 3 : 0;
      totalIndices += indices ? indices.length : 0;
    });

    return {
      totalVertices,
      totalIndices,
      meshCount: meshes.length,
      renderTime,
    };
  }

  private dxfColorToRGB(colorIndex: number): BABYLON.Color3 {
    // AutoCAD color palette (simplified)
    const palette: { [key: number]: [number, number, number] } = {
      1: [1, 0, 0],     // Red
      2: [1, 1, 0],     // Yellow
      3: [0, 1, 0],     // Green
      4: [0, 1, 1],     // Cyan
      5: [0, 0, 1],     // Blue
      6: [1, 0, 1],     // Magenta
      7: [1, 1, 1],     // White/Black
      8: [0.5, 0.5, 0.5], // Gray
    };

    const rgb = palette[colorIndex] || [1, 1, 1];
    return new BABYLON.Color3(rgb[0], rgb[1], rgb[2]);
  }

  /**
   * Dispose all cached materials
   */
  dispose(): void {
    this.materialCache.forEach((material) => material.dispose());
    this.materialCache.clear();
  }
}
