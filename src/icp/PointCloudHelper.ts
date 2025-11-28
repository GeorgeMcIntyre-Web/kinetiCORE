/**
 * Point cloud utility functions.
 * 
 * Provides helper functions for working with point clouds:
 * - Creating point clouds from arrays
 * - Converting between formats
 * - Basic operations
 */

import { PointCloud, Point3D, Transform4x4 } from './types';

export class PointCloudHelper {
  /**
   * Create a point cloud from an array of 3D points.
   * 
   * @param points Array of 3D points
   * @returns PointCloud object
   */
  static fromPoints(points: Point3D[]): PointCloud {
    const flatArray = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      flatArray[i * 3] = points[i].x;
      flatArray[i * 3 + 1] = points[i].y;
      flatArray[i * 3 + 2] = points[i].z;
    }
    return {
      points: flatArray,
      count: points.length
    };
  }

  /**
   * Create a point cloud from a flat array.
   * 
   * @param flatArray Flat array: [x1,y1,z1, x2,y2,z2, ...]
   * @returns PointCloud object
   */
  static fromFlatArray(flatArray: Float32Array | number[]): PointCloud {
    const points = flatArray instanceof Float32Array 
      ? flatArray 
      : new Float32Array(flatArray);
    
    if (points.length % 3 !== 0) {
      throw new Error(`Invalid point cloud array length: ${points.length} (must be multiple of 3)`);
    }
    
    return {
      points,
      count: points.length / 3
    };
  }

  /**
   * Convert point cloud to array of Point3D objects.
   * 
   * @param cloud Point cloud
   * @returns Array of 3D points
   */
  static toPoints(cloud: PointCloud): Point3D[] {
    const points: Point3D[] = [];
    for (let i = 0; i < cloud.count; i++) {
      points.push({
        x: cloud.points[i * 3],
        y: cloud.points[i * 3 + 1],
        z: cloud.points[i * 3 + 2]
      });
    }
    return points;
  }

  /**
   * Get point at index.
   * 
   * @param cloud Point cloud
   * @param index Point index
   * @returns 3D point
   */
  static getPoint(cloud: PointCloud, index: number): Point3D {
    if (index < 0 || index >= cloud.count) {
      throw new Error(`Point index out of range: ${index} (count: ${cloud.count})`);
    }
    return {
      x: cloud.points[index * 3],
      y: cloud.points[index * 3 + 1],
      z: cloud.points[index * 3 + 2]
    };
  }

  /**
   * Align cloud sizes by truncating to minimum size.
   * 
   * @param source Source point cloud
   * @param target Target point cloud
   * @returns Tuple of [aligned_source, aligned_target]
   */
  static alignCloudSizes(
    source: PointCloud,
    target: PointCloud
  ): [PointCloud, PointCloud] {
    const minSize = Math.min(source.count, target.count);
    
    const alignedSource = {
      points: source.points.slice(0, minSize * 3),
      count: minSize
    };
    
    const alignedTarget = {
      points: target.points.slice(0, minSize * 3),
      count: minSize
    };
    
    return [alignedSource, alignedTarget];
  }

  /**
   * Apply a 4x4 transformation matrix to a point cloud.
   * 
   * @param cloud Point cloud to transform
   * @param transform 4x4 transformation matrix
   * @returns Transformed point cloud
   */
  static applyTransformation(cloud: PointCloud, transform: Transform4x4): PointCloud {
    const R = transform.matrix;
    const transformed = new Float32Array(cloud.count * 3);
    
    for (let i = 0; i < cloud.count; i++) {
      const x = cloud.points[i * 3];
      const y = cloud.points[i * 3 + 1];
      const z = cloud.points[i * 3 + 2];
      
      // Apply rotation and translation: R * [x,y,z]^T + t
      transformed[i * 3] = 
        R[0][0] * x + R[0][1] * y + R[0][2] * z + R[0][3];
      transformed[i * 3 + 1] = 
        R[1][0] * x + R[1][1] * y + R[1][2] * z + R[1][3];
      transformed[i * 3 + 2] = 
        R[2][0] * x + R[2][1] * y + R[2][2] * z + R[2][3];
    }
    
    return {
      points: transformed,
      count: cloud.count
    };
  }

  /**
   * Compute centroid of point cloud.
   * 
   * @param cloud Point cloud
   * @returns Centroid as Point3D
   */
  static computeCentroid(cloud: PointCloud): Point3D {
    let sumX = 0, sumY = 0, sumZ = 0;
    
    for (let i = 0; i < cloud.count; i++) {
      sumX += cloud.points[i * 3];
      sumY += cloud.points[i * 3 + 1];
      sumZ += cloud.points[i * 3 + 2];
    }
    
    const n = cloud.count;
    return {
      x: sumX / n,
      y: sumY / n,
      z: sumZ / n
    };
  }

  /**
   * Compute centroid from an array of Point3D objects.
   */
  static computeCentroidFromPoints(points: Point3D[]): Point3D {
    if (points.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;

    for (const point of points) {
      sumX += point.x;
      sumY += point.y;
      sumZ += point.z;
    }

    const inv = 1 / points.length;
    return {
      x: sumX * inv,
      y: sumY * inv,
      z: sumZ * inv,
    };
  }
}

