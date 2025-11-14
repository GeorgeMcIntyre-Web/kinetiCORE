/**
 * Tooling Structure Analyzer
 * 
 * Computes OEM-agnostic structure fingerprints for fixtures.
 * All analysis is naming-free - uses only geometry and topology.
 * 
 * Optional name analytics are kept in a separate layer for UX/classification only.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface TreeStats {
  minDepth: number;
  maxDepth: number;
  avgDepth: number;
  nodeCount: number;
  meshCount: number;
  branchingFactors: number[]; // per level
}

export interface ClusterStats {
  totalClusters: number;
  baseClusters: number;
  unitClusters: number;
  looseClusters: number;
  flatPlatesNearFloor: number;
  tallSlenderClusters: number;
  weldedBaseMass: number; // approximate volume
  movingMass: number; // approximate volume
  typicalUnitFootprints: Array<{ area: number; aspectRatio: number }>;
}

export interface JointStats {
  totalJoints: number;
  revoluteCount: number;
  prismaticCount: number;
  fixedCount: number;
  avgStrokeOrAngle: number;
  maxStrokeOrAngle: number;
}

export interface ToolingStructureProfile {
  fixtureId: string;
  treeStats: TreeStats;
  clusterStats: ClusterStats;
  jointStats?: JointStats;
  suspectedFixtureType: 'geo_fixture' | 'gripper' | 'transfer' | 'dashboard' | 'unknown';
}

export class ToolingStructureAnalyzer {
  /**
   * Analyze structure from existing pipeline outputs.
   */
  static async analyzeFromPipeline(
    fixtureId: string,
    baseDir: string,
  ): Promise<ToolingStructureProfile> {
    const clustersPath = path.join(baseDir, `${fixtureId}.rigid-clusters.json`);
    const jointsPath = path.join(baseDir, `${fixtureId}.joint-segmentation.json`);
    const unitsPath = path.join(baseDir, `${fixtureId}.units.json`);

    // Load clusters
    let clusterStats: ClusterStats;
    if (fs.existsSync(clustersPath)) {
      const clustersJson = JSON.parse(fs.readFileSync(clustersPath, 'utf8'));
      clusterStats = this.analyzeClusters(clustersJson);
    } else {
      clusterStats = this.createEmptyClusterStats();
    }

    // Load joints (try units.json first, then joint-segmentation.json)
    let jointStats: JointStats | undefined;
    if (fs.existsSync(unitsPath)) {
      const unitsJson = JSON.parse(fs.readFileSync(unitsPath, 'utf8'));
      jointStats = this.analyzeJointsFromUnits(unitsJson);
    } else if (fs.existsSync(jointsPath)) {
      const jointsJson = JSON.parse(fs.readFileSync(jointsPath, 'utf8'));
      jointStats = this.analyzeJointsFromSegmentation(jointsJson);
    }

    // Analyze tree structure (from tree output if available)
    const treeOutputPath = path.join(baseDir, `${fixtureId}_tree_output.txt`);
    const treeStats = this.analyzeTreeFromOutput(treeOutputPath);

    // Classify fixture type (geometry-based, no naming)
    const suspectedFixtureType = this.classifyFixtureType(clusterStats, jointStats, treeStats);

    return {
      fixtureId,
      treeStats,
      clusterStats,
      jointStats,
      suspectedFixtureType,
    };
  }

  private static analyzeClusters(clustersJson: any[]): ClusterStats {
    const totalClusters = clustersJson.length;
    let baseClusters = 0;
    let unitClusters = 0;
    let looseClusters = 0;
    let flatPlatesNearFloor = 0;
    let tallSlenderClusters = 0;
    let weldedBaseMass = 0;
    let movingMass = 0;
    const unitFootprints: Array<{ area: number; aspectRatio: number }> = [];

    // Find floor Y (lowest minY)
    let floorY = Number.POSITIVE_INFINITY;
    clustersJson.forEach(c => {
      if (c.bbox?.min?.[1] !== undefined) {
        if (c.bbox.min[1] < floorY) {
          floorY = c.bbox.min[1];
        }
      }
    });

    if (!Number.isFinite(floorY)) {
      floorY = 0;
    }

    clustersJson.forEach(cluster => {
      const type = cluster.type || 'loose';
      if (type === 'base') baseClusters += 1;
      if (type === 'unit') unitClusters += 1;
      if (type === 'loose') looseClusters += 1;

      const bbox = cluster.bbox;
      if (!bbox) return;

      const min = bbox.min || [0, 0, 0];
      const max = bbox.max || [0, 0, 0];
      const dx = max[0] - min[0];
      const dy = max[1] - min[1];
      const dz = max[2] - min[2];
      const volume = dx * dy * dz;
      const areaXY = dx * dz;
      const height = dy;

      // Flat plates near floor
      const nearFloor = Math.abs(min[1] - floorY) < 0.1; // within 10cm
      const isFlat = height < 0.2 && areaXY > 0.01; // <20cm tall, >100cm²
      if (nearFloor && isFlat) {
        flatPlatesNearFloor += 1;
      }

      // Tall slender clusters (pins/supports)
      const slenderness = height / Math.max(dx, dz, 0.01);
      if (slenderness > 3 && height > 0.1) {
        tallSlenderClusters += 1;
      }

      // Mass accumulation
      if (type === 'base') {
        weldedBaseMass += volume;
      }
      if (type === 'unit') {
        movingMass += volume;
        unitFootprints.push({
          area: areaXY,
          aspectRatio: Math.max(dx, dz) / Math.max(Math.min(dx, dz), 0.01),
        });
      }
    });

    return {
      totalClusters,
      baseClusters,
      unitClusters,
      looseClusters,
      flatPlatesNearFloor,
      tallSlenderClusters,
      weldedBaseMass,
      movingMass,
      typicalUnitFootprints: unitFootprints.slice(0, 10), // Top 10
    };
  }

  private static analyzeJointsFromUnits(unitsJson: any): JointStats {
    const joints = unitsJson.joints || [];
    let revoluteCount = 0;
    let prismaticCount = 0;
    let fixedCount = 0;
    let totalStrokeOrAngle = 0;
    let maxStrokeOrAngle = 0;

    joints.forEach((joint: any) => {
      const type = joint.type || 'fixed';
      if (type === 'revolute') revoluteCount += 1;
      if (type === 'prismatic') prismaticCount += 1;
      if (type === 'fixed') fixedCount += 1;

      const range = Math.abs((joint.max || 0) - (joint.min || 0));
      totalStrokeOrAngle += range;
      if (range > maxStrokeOrAngle) {
        maxStrokeOrAngle = range;
      }
    });

    return {
      totalJoints: joints.length,
      revoluteCount,
      prismaticCount,
      fixedCount,
      avgStrokeOrAngle: joints.length > 0 ? totalStrokeOrAngle / joints.length : 0,
      maxStrokeOrAngle,
    };
  }

  private static analyzeJointsFromSegmentation(jointsJson: any): JointStats {
    const units = jointsJson.units || [];
    let totalJoints = 0;
    let revoluteCount = 0;
    let prismaticCount = 0;
    let fixedCount = 0;
    let totalStrokeOrAngle = 0;
    let maxStrokeOrAngle = 0;

    units.forEach((unit: any) => {
      const joints = unit.joints || [];
      totalJoints += joints.length;

      joints.forEach((joint: any) => {
        const type = joint.type || 'unknown';
        if (type === 'revolute') revoluteCount += 1;
        if (type === 'prismatic') prismaticCount += 1;
        if (type === 'unknown') fixedCount += 1;

        const range = Math.abs((joint.max || 0) - (joint.min || 0));
        totalStrokeOrAngle += range;
        if (range > maxStrokeOrAngle) {
          maxStrokeOrAngle = range;
        }
      });
    });

    return {
      totalJoints,
      revoluteCount,
      prismaticCount,
      fixedCount,
      avgStrokeOrAngle: totalJoints > 0 ? totalStrokeOrAngle / totalJoints : 0,
      maxStrokeOrAngle,
    };
  }

  private static analyzeTreeFromOutput(treeOutputPath: string): TreeStats {
    if (!fs.existsSync(treeOutputPath)) {
      return this.createEmptyTreeStats();
    }

    const content = fs.readFileSync(treeOutputPath, 'utf8');
    const lines = content.split('\n');

    // Simple heuristic: count indentation levels
    const depths: number[] = [];
    let nodeCount = 0;
    let meshCount = 0;
    const branchingFactors: number[] = [];
    const childrenPerLevel = new Map<number, number[]>();

    lines.forEach(line => {
      // Count nodes (lines with dashes)
      if (line.includes('-')) {
        nodeCount += 1;
        const depth = (line.match(/^(\s*)/)?.[1]?.length || 0) / 2; // Assuming 2-space indent
        depths.push(depth);

        // Track branching (simplified: count siblings at same depth)
        const siblings = childrenPerLevel.get(depth) || [];
        siblings.push(1);
        childrenPerLevel.set(depth, siblings);
      }

      // Count meshes (lines with "mesh:")
      if (line.includes('mesh:')) {
        meshCount += 1;
      }
    });

    // Compute branching factors per level
    childrenPerLevel.forEach((siblings, level) => {
      if (siblings.length > 0) {
        branchingFactors[level] = siblings.length;
      }
    });

    const minDepth = depths.length > 0 ? Math.min(...depths) : 0;
    const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
    const avgDepth = depths.length > 0 ? depths.reduce((a, b) => a + b, 0) / depths.length : 0;

    return {
      minDepth,
      maxDepth,
      avgDepth,
      nodeCount,
      meshCount,
      branchingFactors,
    };
  }

  private static classifyFixtureType(
    clusterStats: ClusterStats,
    jointStats: JointStats | undefined,
    _treeStats: TreeStats,
  ): 'geo_fixture' | 'gripper' | 'transfer' | 'dashboard' | 'unknown' {
    // Geometry-based classification (no naming)
    
    // GEO fixtures: large base, multiple units, moderate joints
    const isGeoFixture =
      clusterStats.baseClusters > 0 &&
      clusterStats.unitClusters >= 3 &&
      clusterStats.weldedBaseMass > 0.1 &&
      (!jointStats || (jointStats.totalJoints >= 2 && jointStats.totalJoints < 20));

    // Grippers: small base, few units, many joints (fingers)
    const isGripper =
      clusterStats.baseClusters > 0 &&
      clusterStats.unitClusters <= 5 &&
      clusterStats.weldedBaseMass < 0.05 &&
      jointStats &&
      jointStats.totalJoints >= 3 &&
      jointStats.revoluteCount > jointStats.prismaticCount;

    // Dashboards: many flat plates, few moving parts
    const isDashboard =
      clusterStats.flatPlatesNearFloor >= 3 &&
      clusterStats.unitClusters <= 2 &&
      (!jointStats || jointStats.totalJoints <= 2);

    // Transfer: large moving mass, many prismatic joints
    const isTransfer =
      clusterStats.movingMass > clusterStats.weldedBaseMass &&
      jointStats &&
      jointStats.prismaticCount >= 2;

    if (isGripper) return 'gripper';
    if (isDashboard) return 'dashboard';
    if (isTransfer) return 'transfer';
    if (isGeoFixture) return 'geo_fixture';
    return 'unknown';
  }

  private static createEmptyClusterStats(): ClusterStats {
    return {
      totalClusters: 0,
      baseClusters: 0,
      unitClusters: 0,
      looseClusters: 0,
      flatPlatesNearFloor: 0,
      tallSlenderClusters: 0,
      weldedBaseMass: 0,
      movingMass: 0,
      typicalUnitFootprints: [],
    };
  }

  private static createEmptyTreeStats(): TreeStats {
    return {
      minDepth: 0,
      maxDepth: 0,
      avgDepth: 0,
      nodeCount: 0,
      meshCount: 0,
      branchingFactors: [],
    };
  }
}

