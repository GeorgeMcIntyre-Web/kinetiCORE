/**
 * ToolingSceneExplorer
 * 
 * Analyzes the scene structure of 9X_110_GEO fixture model:
 * - Collects mesh statistics
 * - Groups meshes into rigid clusters based on connectivity
 * - Identifies base clusters and unit candidates
 * 
 * Uses pure geometry and hierarchy - no name-based logic.
 */

import * as BABYLON from '@babylonjs/core';
import { ToolingConfig, DEFAULT_TOOLING_CONFIG } from './ToolingConfig';

export interface MeshStats {
  id: string;
  name: string;
  worldCenter: BABYLON.Vector3;
  volume: number;
}

export interface RigidCluster {
  id: string;
  meshIds: string[];
  bbox: BABYLON.BoundingBox;
  centroid: BABYLON.Vector3;
  volume: number;
}

export interface UnitCandidate {
  id: string;
  clusters: RigidCluster[];
  bbox: BABYLON.BoundingBox;
}

export class ToolingSceneExplorer {
  constructor(
    private scene: BABYLON.Scene,
    private config: ToolingConfig
  ) {}

  /**
   * Collect statistics for all meshes under the fixture root.
   */
  getMeshStats(): MeshStats[] {
    const rootNode = this.findFixtureRoot();
    if (!rootNode) {
      console.warn('[ToolingSceneExplorer] Fixture root not found:', this.config.fixtureRootName);
      return [];
    }

    const stats: MeshStats[] = [];
    this.traverseMeshes(rootNode, (mesh) => {
      mesh.computeWorldMatrix(true);
      const bbox = mesh.getBoundingInfo().boundingBox;
      
      const size = bbox.maximumWorld.subtract(bbox.minimumWorld);
      const volume = Math.abs(size.x * size.y * size.z);
      const worldCenter = bbox.centerWorld.clone();

      stats.push({
        id: mesh.uniqueId.toString(),
        name: mesh.name,
        worldCenter,
        volume,
      });
    });

    return stats;
  }

  /**
   * Group meshes into rigid clusters based on connectivity.
   * Two meshes are connected if they share a parent transform OR their bboxes are close.
   */
  getRigidClusters(): RigidCluster[] {
    const rootNode = this.findFixtureRoot();
    if (!rootNode) {
      console.warn('[ToolingSceneExplorer] Fixture root not found:', this.config.fixtureRootName);
      return [];
    }

    const meshes: BABYLON.AbstractMesh[] = [];
    this.traverseMeshes(rootNode, (mesh) => {
      meshes.push(mesh);
    });

    if (meshes.length === 0) {
      return [];
    }

    // Build connectivity graph
    const graph = this.buildConnectivityGraph(meshes, rootNode);
    
    // Find connected components
    const components = this.findConnectedComponents(meshes, graph);
    
    // Convert components to RigidCluster
    const clusters: RigidCluster[] = [];
    let clusterIndex = 1;

    for (const component of components) {
      if (component.length === 0) {
        continue;
      }

      const meshIds = component.map(m => m.uniqueId.toString());
      const bbox = this.mergeBoundingBoxes(component);
      const centroid = bbox.centerWorld.clone();
      const size = bbox.maximumWorld.subtract(bbox.minimumWorld);
      const volume = Math.abs(size.x * size.y * size.z);

      clusters.push({
        id: `cluster_${clusterIndex.toString().padStart(3, '0')}`,
        meshIds,
        bbox,
        centroid,
        volume,
      });

      clusterIndex++;
    }

    return clusters;
  }

  /**
   * Identify base clusters and group remaining clusters into unit candidates.
   */
  getUnitCandidates(): { units: UnitCandidate[]; baseClusters: RigidCluster[] } {
    const clusters = this.getRigidClusters();
    
    if (clusters.length === 0) {
      return { units: [], baseClusters: [] };
    }

    // Compute global min Z
    let globalMinZ = Infinity;
    for (const cluster of clusters) {
      const z = cluster.bbox.minimumWorld.z;
      if (z < globalMinZ) {
        globalMinZ = z;
      }
    }

    // Identify base clusters
    const baseClusters = this.identifyBaseClusters(clusters, globalMinZ);
    const baseClusterIds = new Set(baseClusters.map(c => c.id));
    const unitSideClusters = clusters.filter(c => !baseClusterIds.has(c.id));

    // Group unit-side clusters into units
    const units = this.groupIntoUnits(unitSideClusters, baseClusters);

    return { units, baseClusters };
  }

  /**
   * Find the fixture root node by name.
   */
  private findFixtureRoot(): BABYLON.TransformNode | null {
    for (const node of this.scene.transformNodes) {
      if (node.name === this.config.fixtureRootName) {
        return node;
      }
    }
    return null;
  }

  /**
   * Traverse all meshes under a root node.
   */
  private traverseMeshes(
    node: BABYLON.Node,
    callback: (mesh: BABYLON.AbstractMesh) => void
  ): void {
    if (node instanceof BABYLON.AbstractMesh) {
      callback(node);
    }

    for (const child of node.getChildren()) {
      this.traverseMeshes(child, callback);
    }
  }

  /**
   * Build connectivity graph: meshes are connected if they share a parent OR bboxes are close.
   */
  private buildConnectivityGraph(
    meshes: BABYLON.AbstractMesh[],
    fixtureRoot: BABYLON.TransformNode
  ): Map<number, Set<number>> {
    const graph = new Map<number, Set<number>>();
    const GAP_THRESHOLD = 0.001; // 1mm in meters

    // Initialize graph
    for (const mesh of meshes) {
      graph.set(mesh.uniqueId, new Set());
    }

    // Connect meshes that share a non-trivial parent transform
    const parentMap = new Map<number, BABYLON.TransformNode | null>();
    for (const mesh of meshes) {
      let parent = mesh.parent;
      while (parent && parent !== fixtureRoot) {
        if (parent instanceof BABYLON.TransformNode) {
          parentMap.set(mesh.uniqueId, parent);
          break;
        }
        parent = parent.parent;
      }
      if (!parentMap.has(mesh.uniqueId)) {
        parentMap.set(mesh.uniqueId, null);
      }
    }

    // Connect meshes with same parent
    for (let i = 0; i < meshes.length; i++) {
      const mesh1 = meshes[i];
      const parent1 = parentMap.get(mesh1.uniqueId);
      
      for (let j = i + 1; j < meshes.length; j++) {
        const mesh2 = meshes[j];
        const parent2 = parentMap.get(mesh2.uniqueId);

        // Same parent connection
        if (parent1 && parent2 && parent1 === parent2) {
          graph.get(mesh1.uniqueId)!.add(mesh2.uniqueId);
          graph.get(mesh2.uniqueId)!.add(mesh1.uniqueId);
          continue;
        }

        // Bounding box proximity connection
        mesh1.computeWorldMatrix(true);
        mesh2.computeWorldMatrix(true);
        const bbox1 = mesh1.getBoundingInfo().boundingBox;
        const bbox2 = mesh2.getBoundingInfo().boundingBox;

        const gap = this.computeBoundingBoxGap(bbox1, bbox2);
        if (gap < GAP_THRESHOLD) {
          graph.get(mesh1.uniqueId)!.add(mesh2.uniqueId);
          graph.get(mesh2.uniqueId)!.add(mesh1.uniqueId);
        }
      }
    }

    return graph;
  }

  /**
   * Compute minimum gap between two bounding boxes.
   */
  private computeBoundingBoxGap(
    bbox1: BABYLON.BoundingBox,
    bbox2: BABYLON.BoundingBox
  ): number {
    const min1 = bbox1.minimumWorld;
    const max1 = bbox1.maximumWorld;
    const min2 = bbox2.minimumWorld;
    const max2 = bbox2.maximumWorld;

    // Check if boxes overlap
    if (
      min1.x <= max2.x && max1.x >= min2.x &&
      min1.y <= max2.y && max1.y >= min2.y &&
      min1.z <= max2.z && max1.z >= min2.z
    ) {
      return 0; // Overlapping
    }

    // Compute minimum distance between boxes
    const dx = Math.max(0, Math.max(min1.x - max2.x, min2.x - max1.x));
    const dy = Math.max(0, Math.max(min1.y - max2.y, min2.y - max1.y));
    const dz = Math.max(0, Math.max(min1.z - max2.z, min2.z - max1.z));

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Find connected components in the graph using DFS.
   */
  private findConnectedComponents(
    meshes: BABYLON.AbstractMesh[],
    graph: Map<number, Set<number>>
  ): BABYLON.AbstractMesh[][] {
    const visited = new Set<number>();
    const components: BABYLON.AbstractMesh[][] = [];

    for (const mesh of meshes) {
      if (visited.has(mesh.uniqueId)) {
        continue;
      }

      const component: BABYLON.AbstractMesh[] = [];
      const stack = [mesh.uniqueId];
      visited.add(mesh.uniqueId);

      while (stack.length > 0) {
        const currentId = stack.pop()!;
        const currentMesh = meshes.find(m => m.uniqueId === currentId);
        if (!currentMesh) {
          continue;
        }

        component.push(currentMesh);

        const neighbors = graph.get(currentId);
        if (!neighbors) {
          continue;
        }

        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            stack.push(neighborId);
          }
        }
      }

      if (component.length > 0) {
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Merge bounding boxes of multiple meshes.
   */
  private mergeBoundingBoxes(meshes: BABYLON.AbstractMesh[]): BABYLON.BoundingBox {
    let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const bbox = mesh.getBoundingInfo().boundingBox;
      min = BABYLON.Vector3.Minimize(min, bbox.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, bbox.maximumWorld);
    }

    const center = min.add(max).scale(0.5);
    const extend = max.subtract(min).scale(0.5);

    return new BABYLON.BoundingBox(center, extend);
  }

  /**
   * Identify base clusters using heuristics:
   * - Large volume (top 20% by volume)
   * - Small height relative to XY extents
   * - Centroid Z close to global minimum
   */
  private identifyBaseClusters(
    clusters: RigidCluster[],
    globalMinZ: number
  ): RigidCluster[] {
    const Z_TOLERANCE = 0.05; // 5cm tolerance for base Z position
    const HEIGHT_RATIO_THRESHOLD = 0.3; // Height should be < 30% of largest XY extent
    const VOLUME_PERCENTILE = 0.8; // Top 20% by volume

    // Sort by volume
    const sorted = [...clusters].sort((a, b) => b.volume - a.volume);
    const volumeThreshold = sorted[Math.floor(sorted.length * (1 - VOLUME_PERCENTILE))]?.volume || 0;

    const baseClusters: RigidCluster[] = [];

    for (const cluster of clusters) {
      // Check volume
      if (cluster.volume < volumeThreshold) {
        continue;
      }

      // Check Z position
      const zDiff = Math.abs(cluster.centroid.z - globalMinZ);
      if (zDiff > Z_TOLERANCE) {
        continue;
      }

      // Check height ratio
      const size = cluster.bbox.maximumWorld.subtract(cluster.bbox.minimumWorld);
      const maxXY = Math.max(Math.abs(size.x), Math.abs(size.y));
      const height = Math.abs(size.z);
      
      if (maxXY < 1e-6) {
        continue; // Skip degenerate clusters
      }

      const heightRatio = height / maxXY;
      if (heightRatio > HEIGHT_RATIO_THRESHOLD) {
        continue;
      }

      baseClusters.push(cluster);
    }

    return baseClusters;
  }

  /**
   * Group unit-side clusters into units based on XY proximity and base contact.
   */
  private groupIntoUnits(
    unitSideClusters: RigidCluster[],
    baseClusters: RigidCluster[]
  ): UnitCandidate[] {
    const PROXIMITY_THRESHOLD = 0.5; // 50cm in XY plane
    const units: UnitCandidate[] = [];
    const assigned = new Set<string>();

    for (const cluster of unitSideClusters) {
      if (assigned.has(cluster.id)) {
        continue;
      }

      // Find nearby clusters
      const unitClusters: RigidCluster[] = [cluster];
      assigned.add(cluster.id);

      for (const other of unitSideClusters) {
        if (assigned.has(other.id)) {
          continue;
        }

        const xyDist = this.computeXYDistance(cluster.centroid, other.centroid);
        if (xyDist < PROXIMITY_THRESHOLD) {
          unitClusters.push(other);
          assigned.add(other.id);
        }
      }

      // Merge bbox for unit
      const bbox = this.mergeClusterBoundingBoxes(unitClusters);

      units.push({
        id: `UNIT_AUTO_${units.length + 1}`,
        clusters: unitClusters,
        bbox,
      });
    }

    return units;
  }

  /**
   * Compute XY-plane distance between two points.
   */
  private computeXYDistance(a: BABYLON.Vector3, b: BABYLON.Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Merge bounding boxes of multiple clusters.
   */
  private mergeClusterBoundingBoxes(clusters: RigidCluster[]): BABYLON.BoundingBox {
    let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

    for (const cluster of clusters) {
      min = BABYLON.Vector3.Minimize(min, cluster.bbox.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, cluster.bbox.maximumWorld);
    }

    const center = min.add(max).scale(0.5);
    const extend = max.subtract(min).scale(0.5);

    return new BABYLON.BoundingBox(center, extend);
  }
}

/**
 * Log overview of tooling scene structure.
 */
export function logToolingOverview(
  scene: BABYLON.Scene,
  config = DEFAULT_TOOLING_CONFIG
): void {
  const explorer = new ToolingSceneExplorer(scene, config);
  const stats = explorer.getMeshStats();
  const { units, baseClusters } = explorer.getUnitCandidates();

  console.group('[ToolingSceneExplorer] 9X_110_GEO overview');
  console.log('meshCount', stats.length);
  console.log('baseClusters', baseClusters);
  console.log('units', units.map(u => ({
    id: u.id,
    clusterCount: u.clusters.length,
    volume: u.clusters.reduce((sum, c) => sum + c.volume, 0),
  })));
  console.groupEnd();
}

