/**
 * GLB Structure Analyzer
 *
 * Comprehensive analysis tool to extract ALL information from a GLB file
 * for understanding structure and making auto-kinematics robust.
 *
 * Usage:
 * ```typescript
 * const analyzer = new GLBStructureAnalyzer(scene);
 * const report = await analyzer.analyzeGLB(rootNode);
 * console.log(JSON.stringify(report, null, 2));
 * // or
 * analyzer.exportToFile(report, 'glb_analysis.json');
 * ```
 *
 * Owner: George (Agent 1 - Claude Code)
 */

import * as BABYLON from '@babylonjs/core';

/**
 * Complete analysis report for a GLB file
 */
export interface GLBAnalysisReport {
  metadata: {
    fileName: string;
    analyzedAt: string;
    totalNodes: number;
    totalMeshes: number;
    totalTransformNodes: number;
    totalMaterials: number;
    boundingBox: BoundingBoxInfo;
  };

  hierarchy: NodeHierarchy;

  nodes: NodeAnalysis[];

  namingPatterns: NamingPatternAnalysis;

  geometricClusters: GeometricClusterAnalysis;

  potentialPairs: PotentialPairAnalysis[];

  statistics: StatisticsReport;

  recommendations: string[];
}

/**
 * Hierarchical tree structure of the scene
 */
export interface NodeHierarchy {
  name: string;
  type: 'TransformNode' | 'Mesh' | 'AbstractMesh';
  id: number; // uniqueId
  depth: number;
  children: NodeHierarchy[];
  metadata?: {
    hasMeshes: boolean;
    meshCount: number;
    position: [number, number, number];
    rotation: [number, number, number];
    scaling: [number, number, number];
  };
}

/**
 * Detailed analysis of a single node
 */
export interface NodeAnalysis {
  // Identity
  name: string;
  uniqueId: number;
  type: 'TransformNode' | 'Mesh' | 'AbstractMesh';
  depth: number; // Distance from root
  path: string; // Full path from root (e.g., "root/UNIT_118/FIXED")

  // Hierarchy
  parentId: number | null;
  parentName: string | null;
  childIds: number[];
  childNames: string[];
  siblingIds: number[];
  siblingNames: string[];

  // Transform (world space = carline coordinates)
  worldPosition: [number, number, number]; // meters
  worldRotation: [number, number, number]; // Euler angles, degrees
  worldScaling: [number, number, number];
  localPosition: [number, number, number];
  localRotation: [number, number, number];
  localScaling: [number, number, number];

  // Geometry (if has meshes)
  geometry: {
    hasMeshes: boolean;
    meshCount: number;
    totalVertices: number;
    totalTriangles: number;
    boundingBox: BoundingBoxInfo;
    volume: number; // cubic meters
    surfaceArea: number; // square meters (approximate)
  };

  // Material info
  materials: string[];

  // Naming analysis
  namingHints: {
    containsFixed: boolean;
    containsMoving: boolean;
    containsRetracted: boolean;
    containsExtended: boolean;
    containsOpen: boolean;
    containsClose: boolean;
    containsUnit: boolean;
    unitNumber: number | null; // e.g., 118 from "UNIT_118"
    baseName: string; // e.g., "UNIT_118" from "UNIT_118_FIXED"
  };

  // Geometric signature (for matching)
  geometricSignature: {
    dimensions: [number, number, number]; // sorted [small, medium, large]
    aspectRatios: [number, number]; // [medium/small, large/medium]
    volume: number;
    centroid: [number, number, number];
    principalAxes: [number, number, number][]; // 3 vectors
  };
}

/**
 * Bounding box information
 */
export interface BoundingBoxInfo {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  center: [number, number, number];
  diagonal: number;
}

/**
 * Naming pattern analysis
 */
export interface NamingPatternAnalysis {
  // Common prefixes/suffixes
  commonPrefixes: Array<{ prefix: string; count: number }>;
  commonSuffixes: Array<{ suffix: string; count: number }>;

  // Detected patterns
  patterns: Array<{
    pattern: string; // e.g., "UNIT_XXX_FIXED/MOVING"
    regex: string;
    matches: string[];
    confidence: number; // 0-1
  }>;

  // Naming conventions
  conventions: {
    usesUnderscores: boolean;
    usesCamelCase: boolean;
    usesNumbers: boolean;
    averageNameLength: number;
    longestName: string;
    shortestName: string;
  };

  // Pairing hints from names
  pairingHints: Array<{
    baseName: string;
    fixedNode: string | null;
    movingNode: string | null;
    confidence: number;
  }>;
}

/**
 * Geometric clustering analysis
 */
export interface GeometricClusterAnalysis {
  // Nodes grouped by proximity
  spatialClusters: Array<{
    centroid: [number, number, number];
    radius: number;
    nodeIds: number[];
    nodeNames: string[];
  }>;

  // Nodes grouped by similar dimensions
  dimensionClusters: Array<{
    avgDimensions: [number, number, number];
    nodeIds: number[];
    nodeNames: string[];
    similarity: number; // 0-1
  }>;
}

/**
 * Potential node pairs for ICP analysis
 */
export interface PotentialPairAnalysis {
  node1: {
    name: string;
    id: number;
    signature: string;
  };
  node2: {
    name: string;
    id: number;
    signature: string;
  };
  similarity: number; // 0-1
  matchType: 'name' | 'geometry' | 'both';
  confidence: number; // 0-1
  reasons: string[];
}

/**
 * Statistical analysis
 */
export interface StatisticsReport {
  // Node distribution
  nodesByType: Record<string, number>;
  nodesByDepth: Record<number, number>;

  // Geometry distribution
  vertexCountDistribution: {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
  };

  volumeDistribution: {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
  };

  // Spatial distribution
  spatialExtent: {
    xRange: [number, number];
    yRange: [number, number];
    zRange: [number, number];
    maxDistance: number;
  };

  // Naming statistics
  namingStats: {
    totalUniqueNames: number;
    avgNameLength: number;
    namingConventionConfidence: number; // 0-1
  };
}

/**
 * Main analyzer class
 */
export class GLBStructureAnalyzer {
  private scene: BABYLON.Scene;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Analyze a GLB file structure
   */
  async analyzeGLB(
    rootNode: BABYLON.TransformNode,
    fileName: string = 'unknown.glb'
  ): Promise<GLBAnalysisReport> {
    console.log('[GLBAnalyzer] Starting comprehensive analysis...');

    const startTime = performance.now();

    // Collect all nodes
    const allNodes = this.collectAllNodes(rootNode);
    console.log(`[GLBAnalyzer] Collected ${allNodes.length} nodes`);

    // Build hierarchy
    const hierarchy = this.buildHierarchy(rootNode, 0);
    console.log('[GLBAnalyzer] Built hierarchy tree');

    // Analyze each node
    const nodeAnalyses = allNodes.map(node => this.analyzeNode(node, allNodes));
    console.log('[GLBAnalyzer] Analyzed individual nodes');

    // Analyze naming patterns
    const namingPatterns = this.analyzeNamingPatterns(nodeAnalyses);
    console.log('[GLBAnalyzer] Analyzed naming patterns');

    // Geometric clustering
    const geometricClusters = this.analyzeGeometricClusters(nodeAnalyses);
    console.log('[GLBAnalyzer] Analyzed geometric clusters');

    // Find potential pairs
    const potentialPairs = this.findPotentialPairs(nodeAnalyses);
    console.log(`[GLBAnalyzer] Found ${potentialPairs.length} potential pairs`);

    // Compute statistics
    const statistics = this.computeStatistics(nodeAnalyses);
    console.log('[GLBAnalyzer] Computed statistics');

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      namingPatterns,
      geometricClusters,
      potentialPairs,
      statistics
    );
    console.log(`[GLBAnalyzer] Generated ${recommendations.length} recommendations`);

    // Compute overall bounding box
    const boundingBox = this.computeOverallBoundingBox(nodeAnalyses);

    const duration = performance.now() - startTime;
    console.log(`[GLBAnalyzer] Analysis complete in ${duration.toFixed(2)}ms`);

    return {
      metadata: {
        fileName,
        analyzedAt: new Date().toISOString(),
        totalNodes: allNodes.length,
        totalMeshes: this.scene.meshes.length,
        totalTransformNodes: this.scene.transformNodes.length,
        totalMaterials: this.scene.materials.length,
        boundingBox,
      },
      hierarchy,
      nodes: nodeAnalyses,
      namingPatterns,
      geometricClusters,
      potentialPairs,
      statistics,
      recommendations,
    };
  }

  /**
   * Collect all nodes in the scene
   */
  private collectAllNodes(rootNode: BABYLON.Node): BABYLON.Node[] {
    const nodes: BABYLON.Node[] = [];
    const stack: BABYLON.Node[] = [rootNode];

    while (stack.length > 0) {
      const current = stack.pop()!;
      nodes.push(current);

      const children = current.getChildren();
      stack.push(...children);
    }

    return nodes;
  }

  /**
   * Build hierarchical tree structure
   */
  private buildHierarchy(node: BABYLON.Node, depth: number): NodeHierarchy {
    const children = node.getChildren();
    const type = this.getNodeType(node);

    let metadata;
    if (node instanceof BABYLON.TransformNode) {
      node.computeWorldMatrix(true);
      const pos = node.getAbsolutePosition();
      const rot = node.rotation;
      const meshes = node.getChildMeshes(false);

      metadata = {
        hasMeshes: meshes.length > 0,
        meshCount: meshes.length,
        position: [pos.x, pos.y, pos.z] as [number, number, number],
        rotation: [rot.x, rot.y, rot.z] as [number, number, number],
        scaling: [node.scaling.x, node.scaling.y, node.scaling.z] as [number, number, number],
      };
    }

    return {
      name: node.name,
      type,
      id: node.uniqueId,
      depth,
      children: children.map(child => this.buildHierarchy(child, depth + 1)),
      metadata,
    };
  }

  /**
   * Analyze a single node in detail
   */
  private analyzeNode(node: BABYLON.Node, _allNodes: BABYLON.Node[]): NodeAnalysis {
    const type = this.getNodeType(node);
    const depth = this.computeDepth(node);
    const path = this.computePath(node);

    // Hierarchy info
    const parent = node.parent as BABYLON.Node | null;
    const children = node.getChildren();
    const siblings = parent ? parent.getChildren().filter(c => c.uniqueId !== node.uniqueId) : [];

    // Transform info
    let worldPos = BABYLON.Vector3.Zero();
    let worldRot = BABYLON.Vector3.Zero();
    let worldScale = BABYLON.Vector3.One();
    let localPos = BABYLON.Vector3.Zero();
    let localRot = BABYLON.Vector3.Zero();
    let localScale = BABYLON.Vector3.One();

    if (node instanceof BABYLON.TransformNode) {
      node.computeWorldMatrix(true);
      worldPos = node.getAbsolutePosition();
      worldRot = node.rotation.scale(180 / Math.PI); // Convert to degrees
      worldScale = node.scaling.clone();
      localPos = node.position.clone();
      localRot = node.rotation.scale(180 / Math.PI);
      localScale = node.scaling.clone();
    }

    // Geometry info
    const geometry = this.analyzeGeometry(node);

    // Material info
    const materials = this.extractMaterials(node);

    // Naming analysis
    const namingHints = this.analyzeNodeName(node.name);

    // Geometric signature
    const geometricSignature = this.computeGeometricSignature(node, geometry);

    return {
      name: node.name,
      uniqueId: node.uniqueId,
      type,
      depth,
      path,
      parentId: parent?.uniqueId ?? null,
      parentName: parent?.name ?? null,
      childIds: children.map(c => c.uniqueId),
      childNames: children.map(c => c.name),
      siblingIds: siblings.map(s => s.uniqueId),
      siblingNames: siblings.map(s => s.name),
      worldPosition: [worldPos.x, worldPos.y, worldPos.z],
      worldRotation: [worldRot.x, worldRot.y, worldRot.z],
      worldScaling: [worldScale.x, worldScale.y, worldScale.z],
      localPosition: [localPos.x, localPos.y, localPos.z],
      localRotation: [localRot.x, localRot.y, localRot.z],
      localScaling: [localScale.x, localScale.y, localScale.z],
      geometry,
      materials,
      namingHints,
      geometricSignature,
    };
  }

  /**
   * Analyze geometry of a node
   */
  private analyzeGeometry(node: BABYLON.Node): NodeAnalysis['geometry'] {
    const meshes =
      node instanceof BABYLON.TransformNode ? node.getChildMeshes(false) : [];

    if (meshes.length === 0) {
      return {
        hasMeshes: false,
        meshCount: 0,
        totalVertices: 0,
        totalTriangles: 0,
        boundingBox: {
          min: [0, 0, 0],
          max: [0, 0, 0],
          size: [0, 0, 0],
          center: [0, 0, 0],
          diagonal: 0,
        },
        volume: 0,
        surfaceArea: 0,
      };
    }

    let totalVertices = 0;
    let totalTriangles = 0;

    for (const mesh of meshes) {
      totalVertices += mesh.getTotalVertices();
      const indices = mesh.getTotalIndices();
      totalTriangles += indices / 3;
    }

    // Compute combined bounding box in world space
    let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

    for (const mesh of meshes) {
      const m = mesh as BABYLON.AbstractMesh;
      m.computeWorldMatrix(true);
      const bbox = m.getBoundingInfo().boundingBox;

      min = BABYLON.Vector3.Minimize(min, bbox.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, bbox.maximumWorld);
    }

    const size = max.subtract(min);
    const center = min.add(max).scale(0.5);
    const diagonal = BABYLON.Vector3.Distance(min, max);

    // Approximate volume (bounding box volume)
    const volume = Math.abs(size.x * size.y * size.z);

    // Approximate surface area (bounding box surface area)
    const surfaceArea =
      2 * (Math.abs(size.x * size.y) + Math.abs(size.y * size.z) + Math.abs(size.z * size.x));

    return {
      hasMeshes: true,
      meshCount: meshes.length,
      totalVertices,
      totalTriangles: Math.floor(totalTriangles),
      boundingBox: {
        min: [min.x, min.y, min.z],
        max: [max.x, max.y, max.z],
        size: [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)],
        center: [center.x, center.y, center.z],
        diagonal,
      },
      volume,
      surfaceArea,
    };
  }

  /**
   * Extract material names
   */
  private extractMaterials(node: BABYLON.Node): string[] {
    const materials: Set<string> = new Set();

    if (node instanceof BABYLON.TransformNode) {
      const meshes = node.getChildMeshes(false);
      for (const mesh of meshes) {
        if (mesh.material) {
          materials.add(mesh.material.name);
        }
      }
    }

    return Array.from(materials);
  }

  /**
   * Analyze node name for patterns
   */
  private analyzeNodeName(name: string): NodeAnalysis['namingHints'] {
    const upper = name.toUpperCase();

    // Extract unit number (e.g., 118 from "UNIT_118_FIXED")
    const unitMatch = name.match(/UNIT[_\s]*(\d+)/i);
    const unitNumber = unitMatch ? parseInt(unitMatch[1], 10) : null;

    // Extract base name (remove _FIXED, _MOVING, etc.)
    let baseName = name;
    const suffixes = ['_FIXED', '_MOVING', '_RETRACTED', '_EXTENDED', '_OPEN', '_CLOSE'];
    for (const suffix of suffixes) {
      if (upper.endsWith(suffix)) {
        baseName = name.slice(0, -suffix.length);
        break;
      }
    }

    return {
      containsFixed: upper.includes('FIXED') || upper.includes('FIX'),
      containsMoving: upper.includes('MOVING') || upper.includes('MOVE'),
      containsRetracted: upper.includes('RETRACTED') || upper.includes('RETRACT'),
      containsExtended: upper.includes('EXTENDED') || upper.includes('EXTEND'),
      containsOpen: upper.includes('OPEN'),
      containsClose: upper.includes('CLOSE') || upper.includes('CLOSED'),
      containsUnit: upper.includes('UNIT'),
      unitNumber,
      baseName,
    };
  }

  /**
   * Compute geometric signature for matching
   */
  private computeGeometricSignature(
    _node: BABYLON.Node,
    geometry: NodeAnalysis['geometry']
  ): NodeAnalysis['geometricSignature'] {
    const bbox = geometry.boundingBox;
    const size = bbox.size;

    // Sort dimensions (rotation-invariant)
    const dimensions = [...size].sort((a, b) => a - b) as [number, number, number];

    // Aspect ratios
    const aspectRatios: [number, number] = [
      dimensions[0] > 0 ? dimensions[1] / dimensions[0] : 0,
      dimensions[1] > 0 ? dimensions[2] / dimensions[1] : 0,
    ];

    // Centroid
    const centroid = bbox.center;

    // Principal axes (simplified - just aligned with world axes for now)
    const principalAxes: [number, number, number][] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];

    return {
      dimensions,
      aspectRatios,
      volume: geometry.volume,
      centroid: centroid as [number, number, number],
      principalAxes,
    };
  }

  /**
   * Analyze naming patterns across all nodes
   */
  private analyzeNamingPatterns(nodes: NodeAnalysis[]): NamingPatternAnalysis {
    // Extract all node names
    const names = nodes.map(n => n.name);

    // Find common prefixes
    const prefixes = new Map<string, number>();
    for (const name of names) {
      // Try prefixes of length 4-10
      for (let len = 4; len <= Math.min(10, name.length); len++) {
        const prefix = name.slice(0, len);
        prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1);
      }
    }

    const commonPrefixes = Array.from(prefixes.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([prefix, count]) => ({ prefix, count }));

    // Find common suffixes
    const suffixes = new Map<string, number>();
    for (const name of names) {
      for (let len = 4; len <= Math.min(10, name.length); len++) {
        const suffix = name.slice(-len);
        suffixes.set(suffix, (suffixes.get(suffix) ?? 0) + 1);
      }
    }

    const commonSuffixes = Array.from(suffixes.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([suffix, count]) => ({ suffix, count }));

    // Detect patterns
    const patterns = this.detectPatterns(nodes);

    // Analyze conventions
    const conventions = {
      usesUnderscores: names.some(n => n.includes('_')),
      usesCamelCase: names.some(n => /[a-z][A-Z]/.test(n)),
      usesNumbers: names.some(n => /\d/.test(n)),
      averageNameLength: names.reduce((sum, n) => sum + n.length, 0) / names.length,
      longestName: names.reduce((a, b) => (a.length > b.length ? a : b), ''),
      shortestName: names.reduce((a, b) => (a.length < b.length ? a : b), names[0] ?? ''),
    };

    // Find pairing hints from names
    const pairingHints = this.findPairingHintsFromNames(nodes);

    return {
      commonPrefixes,
      commonSuffixes,
      patterns,
      conventions,
      pairingHints,
    };
  }

  /**
   * Detect naming patterns
   */
  private detectPatterns(nodes: NodeAnalysis[]): NamingPatternAnalysis['patterns'] {
    const patterns: NamingPatternAnalysis['patterns'] = [];

    // Pattern 1: UNIT_XXX_FIXED / UNIT_XXX_MOVING
    const unitPattern = /^UNIT[_\s]*\d+[_\s]*(FIXED|MOVING)$/i;
    const unitMatches = nodes.filter(n => unitPattern.test(n.name)).map(n => n.name);
    if (unitMatches.length >= 2) {
      patterns.push({
        pattern: 'UNIT_XXX_FIXED/MOVING',
        regex: unitPattern.source,
        matches: unitMatches,
        confidence: unitMatches.length / nodes.length,
      });
    }

    // Pattern 2: XXX_RETRACTED / XXX_EXTENDED
    const retractPattern = /^(.+)[_\s]*(RETRACTED|EXTENDED)$/i;
    const retractMatches = nodes.filter(n => retractPattern.test(n.name)).map(n => n.name);
    if (retractMatches.length >= 2) {
      patterns.push({
        pattern: 'XXX_RETRACTED/EXTENDED',
        regex: retractPattern.source,
        matches: retractMatches,
        confidence: retractMatches.length / nodes.length,
      });
    }

    // Pattern 3: XXX_OPEN / XXX_CLOSE
    const openClosePattern = /^(.+)[_\s]*(OPEN|CLOSE|CLOSED)$/i;
    const openCloseMatches = nodes.filter(n => openClosePattern.test(n.name)).map(n => n.name);
    if (openCloseMatches.length >= 2) {
      patterns.push({
        pattern: 'XXX_OPEN/CLOSE',
        regex: openClosePattern.source,
        matches: openCloseMatches,
        confidence: openCloseMatches.length / nodes.length,
      });
    }

    return patterns;
  }

  /**
   * Find pairing hints from names
   */
  private findPairingHintsFromNames(
    nodes: NodeAnalysis[]
  ): NamingPatternAnalysis['pairingHints'] {
    const hints: NamingPatternAnalysis['pairingHints'] = [];

    // Group nodes by base name
    const grouped = new Map<string, NodeAnalysis[]>();
    for (const node of nodes) {
      const baseName = node.namingHints.baseName;
      if (!grouped.has(baseName)) {
        grouped.set(baseName, []);
      }
      grouped.get(baseName)!.push(node);
    }

    // Find pairs
    for (const [baseName, group] of grouped.entries()) {
      if (group.length < 2) continue;

      const fixedNode = group.find(n => n.namingHints.containsFixed);
      const movingNode = group.find(n => n.namingHints.containsMoving);

      if (fixedNode || movingNode) {
        hints.push({
          baseName,
          fixedNode: fixedNode?.name ?? null,
          movingNode: movingNode?.name ?? null,
          confidence: fixedNode && movingNode ? 1.0 : 0.5,
        });
      }
    }

    return hints;
  }

  /**
   * Analyze geometric clusters
   */
  private analyzeGeometricClusters(nodes: NodeAnalysis[]): GeometricClusterAnalysis {
    // Spatial clustering (nodes close together in space)
    const spatialClusters = this.clusterBySpatialProximity(nodes, 0.5); // 50cm threshold

    // Dimension clustering (nodes with similar dimensions)
    const dimensionClusters = this.clusterByDimensions(nodes, 0.90); // 90% similarity

    return {
      spatialClusters,
      dimensionClusters,
    };
  }

  /**
   * Cluster nodes by spatial proximity
   */
  private clusterBySpatialProximity(
    nodes: NodeAnalysis[],
    threshold: number
  ): GeometricClusterAnalysis['spatialClusters'] {
    // Simple greedy clustering
    const clusters: GeometricClusterAnalysis['spatialClusters'] = [];
    const assigned = new Set<number>();

    for (const seed of nodes) {
      if (assigned.has(seed.uniqueId)) continue;
      if (!seed.geometry.hasMeshes) continue;

      const cluster: number[] = [seed.uniqueId];
      assigned.add(seed.uniqueId);

      const seedPos = new BABYLON.Vector3(...seed.worldPosition);

      // Find nearby nodes
      for (const other of nodes) {
        if (assigned.has(other.uniqueId)) continue;
        if (!other.geometry.hasMeshes) continue;

        const otherPos = new BABYLON.Vector3(...other.worldPosition);
        const dist = BABYLON.Vector3.Distance(seedPos, otherPos);

        if (dist <= threshold) {
          cluster.push(other.uniqueId);
          assigned.add(other.uniqueId);
        }
      }

      if (cluster.length >= 2) {
        // Compute cluster centroid
        const positions = cluster.map(id => {
          const node = nodes.find(n => n.uniqueId === id)!;
          return new BABYLON.Vector3(...node.worldPosition);
        });

        const centroid = positions
          .reduce((sum, p) => sum.add(p), BABYLON.Vector3.Zero())
          .scale(1 / positions.length);

        const maxRadius = Math.max(...positions.map(p => BABYLON.Vector3.Distance(p, centroid)));

        clusters.push({
          centroid: [centroid.x, centroid.y, centroid.z],
          radius: maxRadius,
          nodeIds: cluster,
          nodeNames: cluster.map(id => nodes.find(n => n.uniqueId === id)!.name),
        });
      }
    }

    return clusters;
  }

  /**
   * Cluster nodes by similar dimensions
   */
  private clusterByDimensions(
    nodes: NodeAnalysis[],
    threshold: number
  ): GeometricClusterAnalysis['dimensionClusters'] {
    const clusters: GeometricClusterAnalysis['dimensionClusters'] = [];
    const assigned = new Set<number>();

    const nodesWithGeometry = nodes.filter(n => n.geometry.hasMeshes && n.geometry.volume > 1e-6);

    for (const seed of nodesWithGeometry) {
      if (assigned.has(seed.uniqueId)) continue;

      const cluster: number[] = [seed.uniqueId];
      assigned.add(seed.uniqueId);

      // Find similar nodes
      for (const other of nodesWithGeometry) {
        if (assigned.has(other.uniqueId)) continue;

        const similarity = this.compareDimensions(
          seed.geometricSignature,
          other.geometricSignature
        );

        if (similarity >= threshold) {
          cluster.push(other.uniqueId);
          assigned.add(other.uniqueId);
        }
      }

      if (cluster.length >= 2) {
        // Compute average dimensions
        const avgDims = cluster
          .map(id => {
            const node = nodes.find(n => n.uniqueId === id)!;
            return node.geometricSignature.dimensions;
          })
          .reduce(
            (sum, dims) => [sum[0] + dims[0], sum[1] + dims[1], sum[2] + dims[2]],
            [0, 0, 0]
          )
          .map(v => v / cluster.length) as [number, number, number];

        clusters.push({
          avgDimensions: avgDims,
          nodeIds: cluster,
          nodeNames: cluster.map(id => nodes.find(n => n.uniqueId === id)!.name),
          similarity: threshold,
        });
      }
    }

    return clusters;
  }

  /**
   * Compare two geometric signatures
   */
  private compareDimensions(
    a: NodeAnalysis['geometricSignature'],
    b: NodeAnalysis['geometricSignature']
  ): number {
    // Compare sorted dimensions (rotation-invariant)
    const dimSimilarity =
      (1.0 - Math.abs(a.dimensions[0] - b.dimensions[0]) / Math.max(a.dimensions[0], b.dimensions[0], 1e-6)) *
      (1.0 - Math.abs(a.dimensions[1] - b.dimensions[1]) / Math.max(a.dimensions[1], b.dimensions[1], 1e-6)) *
      (1.0 - Math.abs(a.dimensions[2] - b.dimensions[2]) / Math.max(a.dimensions[2], b.dimensions[2], 1e-6));

    // Compare volume
    const volSimilarity = 1.0 - Math.abs(a.volume - b.volume) / Math.max(a.volume, b.volume, 1e-6);

    // Weighted average
    return 0.8 * dimSimilarity + 0.2 * volSimilarity;
  }

  /**
   * Find potential node pairs for ICP
   */
  private findPotentialPairs(nodes: NodeAnalysis[]): PotentialPairAnalysis[] {
    const pairs: PotentialPairAnalysis[] = [];

    // Only consider nodes with meshes
    const nodesWithGeometry = nodes.filter(n => n.geometry.hasMeshes && n.geometry.volume > 1e-6);

    // Build parent-child relationship map for filtering
    const parentChildMap = new Map<number, Set<number>>();
    for (const node of nodes) {
      if (node.parentId !== null) {
        if (!parentChildMap.has(node.parentId)) {
          parentChildMap.set(node.parentId, new Set());
        }
        parentChildMap.get(node.parentId)!.add(node.uniqueId);
      }
    }

    // Helper: Check if node2 is descendant of node1
    const isDescendant = (ancestorId: number, descendantId: number): boolean => {
      const children = parentChildMap.get(ancestorId);
      if (!children) return false;
      if (children.has(descendantId)) return true;
      for (const childId of children) {
        if (isDescendant(childId, descendantId)) return true;
      }
      return false;
    };

    // Method 1: Name-based + geometry-based pairing
    for (let i = 0; i < nodesWithGeometry.length; i++) {
      for (let j = i + 1; j < nodesWithGeometry.length; j++) {
        const node1 = nodesWithGeometry[i];
        const node2 = nodesWithGeometry[j];

        // FILTER 1: Skip if same unique ID (shouldn't happen but be safe)
        if (node1.uniqueId === node2.uniqueId) continue;

        // FILTER 2: Skip if parent-child relationship
        if (
          node1.parentId === node2.uniqueId ||
          node2.parentId === node1.uniqueId ||
          isDescendant(node1.uniqueId, node2.uniqueId) ||
          isDescendant(node2.uniqueId, node1.uniqueId)
        ) {
          continue;
        }

        // FILTER 3: Skip if sibling nodes with identical geometry (likely duplicates)
        if (node1.parentId === node2.parentId && node1.parentId !== null) {
          const geometryMatch = this.checkGeometryMatch(node1, node2);
          if (geometryMatch.similarity > 0.999) {
            // 99.9% similarity + same parent = likely duplicate instances
            continue;
          }
        }

        const nameMatch = this.checkNameMatch(node1, node2);
        const geometryMatch = this.checkGeometryMatch(node1, node2);

        if (nameMatch.matches || geometryMatch.matches) {
          const reasons: string[] = [];
          let matchType: PotentialPairAnalysis['matchType'] = 'geometry';
          let confidence = 0;

          if (nameMatch.matches) {
            reasons.push(...nameMatch.reasons);
            matchType = geometryMatch.matches ? 'both' : 'name';
            confidence = nameMatch.confidence;
          }

          if (geometryMatch.matches) {
            reasons.push(...geometryMatch.reasons);
            if (matchType !== 'name') {
              matchType = 'geometry';
            }
            confidence = Math.max(confidence, geometryMatch.confidence);
          }

          if (nameMatch.matches && geometryMatch.matches) {
            confidence = (nameMatch.confidence + geometryMatch.confidence) / 2;
          }

          pairs.push({
            node1: {
              name: node1.name,
              id: node1.uniqueId,
              signature: this.formatSignature(node1.geometricSignature),
            },
            node2: {
              name: node2.name,
              id: node2.uniqueId,
              signature: this.formatSignature(node2.geometricSignature),
            },
            similarity: geometryMatch.similarity,
            matchType,
            confidence,
            reasons,
          });
        }
      }
    }

    // Sort by confidence
    pairs.sort((a, b) => b.confidence - a.confidence);

    return pairs;
  }

  /**
   * Check if two nodes match by name
   */
  private checkNameMatch(
    node1: NodeAnalysis,
    node2: NodeAnalysis
  ): { matches: boolean; confidence: number; reasons: string[] } {
    const reasons: string[] = [];
    let confidence = 0;

    // Same base name?
    if (node1.namingHints.baseName === node2.namingHints.baseName) {
      // One is FIXED, other is MOVING?
      if (
        (node1.namingHints.containsFixed && node2.namingHints.containsMoving) ||
        (node1.namingHints.containsMoving && node2.namingHints.containsFixed)
      ) {
        reasons.push('Same base name with FIXED/MOVING pair');
        confidence = 0.95;
      }

      // One is RETRACTED, other is EXTENDED?
      if (
        (node1.namingHints.containsRetracted && node2.namingHints.containsExtended) ||
        (node1.namingHints.containsExtended && node2.namingHints.containsRetracted)
      ) {
        reasons.push('Same base name with RETRACTED/EXTENDED pair');
        confidence = 0.90;
      }

      // One is OPEN, other is CLOSE?
      if (
        (node1.namingHints.containsOpen && node2.namingHints.containsClose) ||
        (node1.namingHints.containsClose && node2.namingHints.containsOpen)
      ) {
        reasons.push('Same base name with OPEN/CLOSE pair');
        confidence = 0.90;
      }
    }

    return {
      matches: reasons.length > 0,
      confidence,
      reasons,
    };
  }

  /**
   * Check if two nodes match by geometry
   */
  private checkGeometryMatch(
    node1: NodeAnalysis,
    node2: NodeAnalysis
  ): { matches: boolean; confidence: number; similarity: number; reasons: string[] } {
    const similarity = this.compareDimensions(
      node1.geometricSignature,
      node2.geometricSignature
    );

    const reasons: string[] = [];
    let confidence = 0;

    if (similarity >= 0.95) {
      reasons.push(`Very high geometric similarity: ${(similarity * 100).toFixed(1)}%`);
      confidence = 0.90;
    } else if (similarity >= 0.85) {
      reasons.push(`High geometric similarity: ${(similarity * 100).toFixed(1)}%`);
      confidence = 0.70;
    } else if (similarity >= 0.75) {
      reasons.push(`Moderate geometric similarity: ${(similarity * 100).toFixed(1)}%`);
      confidence = 0.50;
    }

    return {
      matches: similarity >= 0.75,
      confidence,
      similarity,
      reasons,
    };
  }

  /**
   * Format geometric signature as string
   */
  private formatSignature(sig: NodeAnalysis['geometricSignature']): string {
    const dims = sig.dimensions.map(d => (d * 1000).toFixed(0)).join('x'); // in mm
    const vol = (sig.volume * 1e9).toFixed(0); // in mm³
    return `${dims}mm, ${vol}mm³`;
  }

  /**
   * Compute statistics
   */
  private computeStatistics(nodes: NodeAnalysis[]): StatisticsReport {
    // Node distribution
    const nodesByType: Record<string, number> = {};
    const nodesByDepth: Record<number, number> = {};

    for (const node of nodes) {
      nodesByType[node.type] = (nodesByType[node.type] ?? 0) + 1;
      nodesByDepth[node.depth] = (nodesByDepth[node.depth] ?? 0) + 1;
    }

    // Vertex counts
    const vertexCounts = nodes
      .filter(n => n.geometry.hasMeshes)
      .map(n => n.geometry.totalVertices);

    // Volumes
    const volumes = nodes.filter(n => n.geometry.volume > 0).map(n => n.geometry.volume);

    // Spatial extent
    const positions = nodes
      .filter(n => n.geometry.hasMeshes)
      .map(n => new BABYLON.Vector3(...n.worldPosition));

    let xMin = Infinity,
      xMax = -Infinity;
    let yMin = Infinity,
      yMax = -Infinity;
    let zMin = Infinity,
      zMax = -Infinity;
    let maxDist = 0;

    for (const pos of positions) {
      xMin = Math.min(xMin, pos.x);
      xMax = Math.max(xMax, pos.x);
      yMin = Math.min(yMin, pos.y);
      yMax = Math.max(yMax, pos.y);
      zMin = Math.min(zMin, pos.z);
      zMax = Math.max(zMax, pos.z);
    }

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dist = BABYLON.Vector3.Distance(positions[i], positions[j]);
        maxDist = Math.max(maxDist, dist);
      }
    }

    // Naming stats
    const uniqueNames = new Set(nodes.map(n => n.name)).size;
    const avgNameLength = nodes.reduce((sum, n) => sum + n.name.length, 0) / nodes.length;

    // Naming convention confidence (do we have consistent patterns?)
    const fixedMovingCount = nodes.filter(
      n => n.namingHints.containsFixed || n.namingHints.containsMoving
    ).length;
    const namingConventionConfidence = fixedMovingCount / nodes.length;

    return {
      nodesByType,
      nodesByDepth,
      vertexCountDistribution: this.computeDistribution(vertexCounts),
      volumeDistribution: this.computeDistribution(volumes),
      spatialExtent: {
        xRange: [xMin, xMax],
        yRange: [yMin, yMax],
        zRange: [zMin, zMax],
        maxDistance: maxDist,
      },
      namingStats: {
        totalUniqueNames: uniqueNames,
        avgNameLength,
        namingConventionConfidence,
      },
    };
  }

  /**
   * Compute distribution statistics
   */
  private computeDistribution(values: number[]): {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
  } {
    if (values.length === 0) {
      return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { min, max, mean, median, stdDev };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    namingPatterns: NamingPatternAnalysis,
    geometricClusters: GeometricClusterAnalysis,
    potentialPairs: PotentialPairAnalysis[],
    statistics: StatisticsReport
  ): string[] {
    const recommendations: string[] = [];

    // Check naming convention
    if (statistics.namingStats.namingConventionConfidence > 0.5) {
      recommendations.push(
        `✅ Strong naming convention detected (${(statistics.namingStats.namingConventionConfidence * 100).toFixed(0)}% confidence). ` +
          `Recommend using NAME-BASED pairing as primary method.`
      );
    } else {
      recommendations.push(
        `⚠️ Weak naming convention (${(statistics.namingStats.namingConventionConfidence * 100).toFixed(0)}% confidence). ` +
          `Recommend using GEOMETRY-BASED pairing as primary method.`
      );
    }

    // Check if we found good pairs
    const highConfidencePairs = potentialPairs.filter(p => p.confidence >= 0.8).length;
    if (highConfidencePairs > 0) {
      recommendations.push(
        `✅ Found ${highConfidencePairs} high-confidence pairs (≥80%). These are excellent candidates for ICP analysis.`
      );
    } else {
      recommendations.push(
        `⚠️ No high-confidence pairs found. Consider manual inspection or adjusting similarity thresholds.`
      );
    }

    // Check spatial clustering
    if (geometricClusters.spatialClusters.length > 0) {
      recommendations.push(
        `📍 Found ${geometricClusters.spatialClusters.length} spatial clusters. ` +
          `This suggests units are grouped together, which is typical for fixtures.`
      );
    }

    // Check dimension clustering
    if (geometricClusters.dimensionClusters.length > 0) {
      recommendations.push(
        `📏 Found ${geometricClusters.dimensionClusters.length} dimension clusters. ` +
          `This suggests repeated components with similar geometry.`
      );
    }

    // Check patterns
    const strongPatterns = namingPatterns.patterns.filter(p => p.confidence > 0.3);
    if (strongPatterns.length > 0) {
      recommendations.push(
        `🔍 Detected ${strongPatterns.length} naming pattern(s): ${strongPatterns.map(p => p.pattern).join(', ')}`
      );
    }

    // Spatial extent check
    const extent = statistics.spatialExtent;
    const maxExtent = Math.max(
      extent.xRange[1] - extent.xRange[0],
      extent.yRange[1] - extent.yRange[0],
      extent.zRange[1] - extent.zRange[0]
    );

    if (maxExtent > 10) {
      // > 10m
      recommendations.push(
        `⚠️ Large spatial extent: ${(maxExtent * 1000).toFixed(0)}mm. ` +
          `Ensure point clouds are extracted in world coordinates, not local.`
      );
    }

    return recommendations;
  }

  /**
   * Compute overall bounding box
   */
  private computeOverallBoundingBox(nodes: NodeAnalysis[]): BoundingBoxInfo {
    let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

    for (const node of nodes) {
      if (!node.geometry.hasMeshes) continue;

      const bbox = node.geometry.boundingBox;
      min = BABYLON.Vector3.Minimize(
        min,
        new BABYLON.Vector3(bbox.min[0], bbox.min[1], bbox.min[2])
      );
      max = BABYLON.Vector3.Maximize(
        max,
        new BABYLON.Vector3(bbox.max[0], bbox.max[1], bbox.max[2])
      );
    }

    const size = max.subtract(min);
    const center = min.add(max).scale(0.5);
    const diagonal = BABYLON.Vector3.Distance(min, max);

    return {
      min: [min.x, min.y, min.z],
      max: [max.x, max.y, max.z],
      size: [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)],
      center: [center.x, center.y, center.z],
      diagonal,
    };
  }

  /**
   * Helper: Get node type
   */
  private getNodeType(node: BABYLON.Node): 'TransformNode' | 'Mesh' | 'AbstractMesh' {
    if (node instanceof BABYLON.Mesh) return 'Mesh';
    if (node instanceof BABYLON.AbstractMesh) return 'AbstractMesh';
    return 'TransformNode';
  }

  /**
   * Helper: Compute depth from root
   */
  private computeDepth(node: BABYLON.Node): number {
    let depth = 0;
    let current = node.parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * Helper: Compute path from root
   */
  private computePath(node: BABYLON.Node): string {
    const path: string[] = [node.name];
    let current = node.parent;
    while (current) {
      path.unshift(current.name);
      current = current.parent;
    }
    return path.join('/');
  }

  /**
   * Export report to JSON file
   */
  exportToFile(report: GLBAnalysisReport, fileName: string): void {
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export report to human-readable markdown
   */
  exportToMarkdown(report: GLBAnalysisReport): string {
    const md: string[] = [];

    md.push(`# GLB Structure Analysis: ${report.metadata.fileName}`);
    md.push(`\n**Analyzed:** ${report.metadata.analyzedAt}\n`);

    md.push(`## Overview\n`);
    md.push(`- **Total Nodes:** ${report.metadata.totalNodes}`);
    md.push(`- **Total Meshes:** ${report.metadata.totalMeshes}`);
    md.push(`- **Total Transform Nodes:** ${report.metadata.totalTransformNodes}`);
    md.push(`- **Total Materials:** ${report.metadata.totalMaterials}`);
    md.push(
      `- **Bounding Box:** [${report.metadata.boundingBox.size.map(v => (v * 1000).toFixed(0)).join(' x ')}] mm\n`
    );

    md.push(`## Recommendations\n`);
    for (const rec of report.recommendations) {
      md.push(`- ${rec}`);
    }
    md.push('');

    md.push(`## Potential Pairs (Top 10)\n`);
    for (const pair of report.potentialPairs.slice(0, 10)) {
      md.push(`### ${pair.node1.name} ↔ ${pair.node2.name}`);
      md.push(`- **Confidence:** ${(pair.confidence * 100).toFixed(0)}%`);
      md.push(`- **Match Type:** ${pair.matchType}`);
      md.push(`- **Similarity:** ${(pair.similarity * 100).toFixed(1)}%`);
      md.push(`- **Reasons:**`);
      for (const reason of pair.reasons) {
        md.push(`  - ${reason}`);
      }
      md.push('');
    }

    md.push(`## Naming Patterns\n`);
    for (const pattern of report.namingPatterns.patterns) {
      md.push(`### ${pattern.pattern}`);
      md.push(`- **Confidence:** ${(pattern.confidence * 100).toFixed(0)}%`);
      md.push(`- **Matches:** ${pattern.matches.length}`);
      md.push(`- **Examples:** ${pattern.matches.slice(0, 5).join(', ')}\n`);
    }

    md.push(`## Spatial Clusters\n`);
    for (let i = 0; i < report.geometricClusters.spatialClusters.length; i++) {
      const cluster = report.geometricClusters.spatialClusters[i];
      md.push(`### Cluster ${i + 1}`);
      md.push(
        `- **Centroid:** [${cluster.centroid.map(v => (v * 1000).toFixed(0)).join(', ')}] mm`
      );
      md.push(`- **Radius:** ${(cluster.radius * 1000).toFixed(0)} mm`);
      md.push(`- **Nodes:** ${cluster.nodeNames.join(', ')}\n`);
    }

    return md.join('\n');
  }
}
