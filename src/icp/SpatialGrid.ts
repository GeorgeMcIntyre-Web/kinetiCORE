/**
 * Spatial grid for approximate nearest neighbor search on very large point clouds.
 * Used as fallback when KD-tree construction would cause stack overflow.
 */

import { Point3D, PointCloud } from './types';

export class SpatialGrid {
  private grid: Map<number, Uint32Array>; // Use integer keys and TypedArrays
  private gridTemp: Map<number, number[]>; // Temporary during construction
  private cellSize: number;
  private cloud: PointCloud; // Store reference to original cloud
  private gridDims: { offsetX: number; offsetY: number; offsetZ: number; scaleX: number; scaleY: number; scaleZ: number };

  constructor(cloud: PointCloud, cellSize?: number) {
    this.cloud = cloud;
    this.gridTemp = new Map();
    
    // Calculate bounds directly from Float32Array
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    const points = cloud.points;
    for (let i = 0; i < cloud.count; i++) {
      const x = points[i * 3];
      const y = points[i * 3 + 1];
      const z = points[i * 3 + 2];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }

    // Auto-calculate cell size if not provided
    // Optimize cell size for better locality - aim for ~50-100 points per cell on average
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const rangeZ = maxZ - minZ;
    const avgRange = (rangeX + rangeY + rangeZ) / 3;
    const targetPointsPerCell = 75; // Sweet spot for search performance
    const estimatedCells = Math.max(1, cloud.count / targetPointsPerCell);
    const cellsPerDim = Math.cbrt(estimatedCells);
    this.cellSize = cellSize || Math.max(avgRange / cellsPerDim, 0.01);

    // Pre-compute grid dimensions for fast integer key generation
    const invCellSize = 1.0 / this.cellSize;
    this.gridDims = {
      offsetX: minX,
      offsetY: minY,
      offsetZ: minZ,
      scaleX: invCellSize,
      scaleY: invCellSize,
      scaleZ: invCellSize
    };

    // Populate grid using indices (no Point3D object creation)
    // Build with regular arrays first, then convert to TypedArrays
    for (let i = 0; i < cloud.count; i++) {
      const x = points[i * 3];
      const y = points[i * 3 + 1];
      const z = points[i * 3 + 2];
      const key = this.getCellKey(x, y, z);
      if (!this.gridTemp.has(key)) {
        this.gridTemp.set(key, []);
      }
      this.gridTemp.get(key)!.push(i);
    }

    // Convert to TypedArrays for better performance
    this.grid = new Map();
    for (const [key, indices] of this.gridTemp.entries()) {
      this.grid.set(key, new Uint32Array(indices));
    }
    this.gridTemp.clear();
  }

  private getCellKey(x: number, y: number, z: number): number {
    // Use packed integer key for better performance than string keys
    const i = Math.floor((x - this.gridDims.offsetX) * this.gridDims.scaleX);
    const j = Math.floor((y - this.gridDims.offsetY) * this.gridDims.scaleY);
    const k = Math.floor((z - this.gridDims.offsetZ) * this.gridDims.scaleZ);
    // Pack into 32-bit integer: 10 bits each for i,j,k (supports -512 to 511 range)
    return ((i + 512) << 20) | ((j + 512) << 10) | (k + 512);
  }

  nearest(x: number, y: number, z: number): { point: Point3D; distance: number } {
    // Search in the cell and neighboring cells
    const centerKey = this.getCellKey(x, y, z);

    // Unpack center cell coordinates
    const ci = ((centerKey >> 20) & 0x3FF) - 512;
    const cj = ((centerKey >> 10) & 0x3FF) - 512;
    const ck = (centerKey & 0x3FF) - 512;

    let bestIdx: number | null = null;
    let bestDistSq = Infinity;
    const points = this.cloud.points;

    // Start with immediate neighbors (radius 1) - most queries succeed here
    let radius = 1;
    const maxRadius = 5; // Reduced from 10 - if not found in 5, do linear search

    while (radius <= maxRadius) {
      // Only search shell (not entire cube) to reduce redundant checks
      for (let di = -radius; di <= radius; di++) {
        for (let dj = -radius; dj <= radius; dj++) {
          for (let dk = -radius; dk <= radius; dk++) {
            // Skip inner cells (already searched in previous radius)
            if (radius > 1 && Math.abs(di) < radius && Math.abs(dj) < radius && Math.abs(dk) < radius) {
              continue;
            }

            // Pack neighbor key directly
            const ni = ci + di;
            const nj = cj + dj;
            const nk = ck + dk;
            const key = ((ni + 512) << 20) | ((nj + 512) << 10) | (nk + 512);

            const cellIndices = this.grid.get(key);
            if (cellIndices) {
              for (let i = 0; i < cellIndices.length; i++) {
                const idx = cellIndices[i];
                const px = points[idx * 3];
                const py = points[idx * 3 + 1];
                const pz = points[idx * 3 + 2];
                const dx = x - px;
                const dy = y - py;
                const dz = z - pz;
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq < bestDistSq) {
                  bestDistSq = distSq;
                  bestIdx = idx;
                }
              }
            }
          }
        }
      }

      // If we found points, we can potentially stop early
      if (bestIdx !== null) {
        // Check if expanding further could find a closer point
        const maxPossibleDistInNextShell = (radius + 1) * this.cellSize * Math.sqrt(3);
        if (bestDistSq < maxPossibleDistInNextShell * maxPossibleDistInNextShell) {
          break; // Current best is closer than any point in next shell
        }
      }

      radius++;
    }
    
    // Fallback: linear search if still no point found
    if (bestIdx === null) {
      for (let i = 0; i < this.cloud.count; i++) {
        const px = points[i * 3];
        const py = points[i * 3 + 1];
        const pz = points[i * 3 + 2];
        const dx = x - px;
        const dy = y - py;
        const dz = z - pz;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestIdx = i;
        }
      }
    }
    
    if (bestIdx === null) {
      throw new Error('No nearest neighbor found - grid is empty');
    }
    
    // Create Point3D only when returning (single object creation)
    const bestPoint: Point3D = {
      x: points[bestIdx * 3],
      y: points[bestIdx * 3 + 1],
      z: points[bestIdx * 3 + 2]
    };
    
    return { point: bestPoint, distance: Math.sqrt(bestDistSq) };
  }
}

