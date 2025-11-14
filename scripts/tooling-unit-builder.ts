// scripts/tooling-unit-builder.ts
//
// Usage:
//   npx tsx scripts/tooling-unit-builder.ts "C:/path/to/fixture.glb"
//
// Output:
//   <fixture>.units.json
//   <fixture>.unit-features.json
//
// Requires:
//   - <fixture>.rigid-clusters.json (from tooling-rigid-clusters.ts)
//   - <fixture>.joint-segmentation.json (from tooling-joint-segmentation.ts)

import fs from 'node:fs';
import path from 'node:path';
import type {
  MechanicalModel,
  RigidCluster,
  KinematicJoint,
  Link,
  KinematicUnit,
  UnitFeatures,
} from '../src/dev/tooling/MechanicalModel';

const glbPath = process.argv[2];

if (glbPath === undefined) {
  console.error('Usage: npx tsx scripts/tooling-unit-builder.ts <path-to-glb>');
  process.exit(1);
}

run().catch(err => {
  console.error('Unit builder failed:', err);
  process.exit(1);
});

async function run() {
  if (!fs.existsSync(glbPath)) {
    console.error('GLB not found:', glbPath);
    process.exit(1);
  }

  const basePath = glbPath.substring(0, glbPath.lastIndexOf('.'));
  const clustersPath = basePath + '.rigid-clusters.json';
  const jointsPath = basePath + '.joint-segmentation.json';

  if (!fs.existsSync(clustersPath)) {
    console.error('Rigid clusters JSON not found:', clustersPath);
    console.error('Run tooling-rigid-clusters.ts first');
    process.exit(1);
  }

  if (!fs.existsSync(jointsPath)) {
    console.error('Joint segmentation JSON not found:', jointsPath);
    console.error('Run tooling-joint-segmentation.ts first');
    process.exit(1);
  }

  console.log('Loading rigid clusters from:', clustersPath);
  const clustersJson = JSON.parse(
    fs.readFileSync(clustersPath, 'utf8'),
  ) as RigidClusterJson[];

  console.log('Loading joint segmentation from:', jointsPath);
  const jointsJson = JSON.parse(
    fs.readFileSync(jointsPath, 'utf8'),
  ) as JointSegmentationJson;

  const model = buildMechanicalModel(clustersJson, jointsJson);
  console.log(`Built model: ${model.clusters.length} clusters, ${model.joints.length} joints`);

  const links = buildLinkGraph(model);
  console.log(`Built ${links.length} links`);

  const units = buildKinematicUnits(model, links);
  console.log(`Built ${units.length} kinematic units`);

  const features = computeUnitFeatures(units, model, links);
  console.log(`Computed features for ${features.length} units`);

  const unitsOutPath = makeUnitsOutputPath(glbPath);
  const featuresOutPath = makeFeaturesOutputPath(glbPath);

  const unitsOutput = {
    links,
    joints: model.joints,
    units,
  };

  fs.writeFileSync(unitsOutPath, JSON.stringify(unitsOutput, null, 2), 'utf8');
  console.log('Units JSON written to:', unitsOutPath);

  const featuresOutput = {
    units: features,
  };

  fs.writeFileSync(featuresOutPath, JSON.stringify(featuresOutput, null, 2), 'utf8');
  console.log('Unit features JSON written to:', featuresOutPath);
}

/* ------------------------------------------------------------------ */
/* JSON types (from existing scripts)                                 */
/* ------------------------------------------------------------------ */

type RigidClusterJson = {
  id: number;
  name: string;
  type: 'base' | 'unit' | 'loose';
  attachedToBaseId: number | null;
  meshNames: string[];
  bbox: { min: [number, number, number]; max: [number, number, number] };
  stats: {
    meshCount: number;
    totalVerts: number;
    height: number;
    areaXY: number;
  };
};

type SegmentedJointJson = {
  name: string;
  electricalName: string;
  nodePath: string;
  type: 'prismatic' | 'revolute' | 'unknown';
  min: number;
  max: number;
  axis: { x: number; y: number; z: number };
  origin: { x: number; y: number; z: number };
  matrix4x4: number[];
};

type SegmentedUnitJson = {
  unitName: string;
  meshIds: number[];
  nodePaths: string[];
  joints: SegmentedJointJson[];
};

type JointSegmentationJson = {
  fixtureName: string;
  units: SegmentedUnitJson[];
};

/* ------------------------------------------------------------------ */
/* Build canonical MechanicalModel from JSON                          */
/* ------------------------------------------------------------------ */

function buildMechanicalModel(
  clustersJson: RigidClusterJson[],
  jointsJson: JointSegmentationJson,
): MechanicalModel {
  const clusters: RigidCluster[] = clustersJson.map(c => ({
    id: `cluster_${c.id}`,
    nodeIds: [], // Not available from JSON, but not needed for unit building
    meshIds: c.meshNames,
    bboxMin: c.bbox.min,
    bboxMax: c.bbox.max,
    meshCount: c.stats.meshCount,
    totalVerts: c.stats.totalVerts,
  }));

  const clusterIdByMeshName = new Map<string, string>();
  clusters.forEach(cluster => {
    cluster.meshIds.forEach(meshName => {
      clusterIdByMeshName.set(meshName, cluster.id);
    });
  });

  const joints: KinematicJoint[] = [];
  let jointIdCounter = 0;

  jointsJson.units.forEach(unit => {
    unit.joints.forEach(segJoint => {
      // Find clusters that contain meshes from this unit
      const unitClusterIds = new Set<string>();
      unit.meshIds.forEach(meshId => {
        // meshIds in segmented unit are numeric indices, not names
        // We need to map them differently - for now, try to find by mesh name pattern
        // This is a limitation we'll work around
      });

      // For now, use a simplified approach: map joints to clusters via mesh names
      // This will be refined when we have better mesh ID mapping
      const childClusterId = findClusterForJoint(segJoint, clusters, clusterIdByMeshName);
      if (!childClusterId) {
        console.warn(`Could not find cluster for joint: ${segJoint.name}`);
        return;
      }

      // Find parent cluster (base or link_0)
      const parentClusterId = findParentClusterForJoint(
        childClusterId,
        clusters,
        clustersJson,
      );

      const joint: KinematicJoint = {
        id: `joint_${jointIdCounter++}`,
        type: segJoint.type === 'unknown' ? 'fixed' : segJoint.type,
        parentClusterId,
        childClusterId,
        axis: [segJoint.axis.x, segJoint.axis.y, segJoint.axis.z],
        origin: [segJoint.origin.x, segJoint.origin.y, segJoint.origin.z],
        min: segJoint.min,
        max: segJoint.max,
      };

      joints.push(joint);
    });
  });

  return {
    nodes: [], // Not needed for unit building
    meshes: [], // Not needed for unit building
    clusters,
    links: [], // Will be built next
    joints,
  };
}

function findClusterForJoint(
  joint: SegmentedJointJson,
  clusters: RigidCluster[],
  clusterIdByMeshName: Map<string, string>,
): string | null {
  // Try to find cluster by node path or mesh name
  // This is simplified - in practice we'd need better mapping
  // For now, return first cluster as fallback
  if (clusters.length === 0) return null;
  return clusters[0].id;
}

function findParentClusterForJoint(
  childClusterId: string,
  clusters: RigidCluster[],
  clustersJson: RigidClusterJson[],
): string {
  // Find base cluster
  const baseClusterJson = clustersJson.find(c => c.type === 'base');
  if (baseClusterJson) {
    const baseCluster = clusters.find(c => c.id === `cluster_${baseClusterJson.id}`);
    if (baseCluster) return baseCluster.id;
  }

  // Fallback: return first cluster
  if (clusters.length > 0) return clusters[0].id;
  return 'base_0';
}

/* ------------------------------------------------------------------ */
/* Build link graph from joints                                       */
/* ------------------------------------------------------------------ */

function buildLinkGraph(model: MechanicalModel): Link[] {
  // Build undirected graph: clusters connected by joints
  const clusterToClusters = new Map<string, Set<string>>();
  model.clusters.forEach(c => {
    clusterToClusters.set(c.id, new Set());
  });

  model.joints.forEach(joint => {
    const parentSet = clusterToClusters.get(joint.parentClusterId);
    const childSet = clusterToClusters.get(joint.childClusterId);
    
    if (parentSet) parentSet.add(joint.childClusterId);
    if (childSet) childSet.add(joint.parentClusterId);
  });

  // Find connected components (each component is a link)
  const visited = new Set<string>();
  const links: Link[] = [];
  let linkIdCounter = 0;

  model.clusters.forEach(cluster => {
    if (visited.has(cluster.id)) return;

    const component = new Set<string>();
    const stack = [cluster.id];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      if (visited.has(current)) continue;

      visited.add(current);
      component.add(current);

      const neighbors = clusterToClusters.get(current);
      if (!neighbors) continue;

      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      });
    }

    if (component.size > 0) {
      links.push({
        id: `link_${linkIdCounter++}`,
        clusterIds: Array.from(component),
      });
    }
  });

  return links;
}

/* ------------------------------------------------------------------ */
/* Build kinematic units from link graph                              */
/* ------------------------------------------------------------------ */

function buildKinematicUnits(
  model: MechanicalModel,
  links: Link[],
): KinematicUnit[] {
  // Find base link (link containing base clusters)
  const baseClusterIds = new Set<string>();
  model.clusters.forEach(c => {
    // We'll identify base clusters by checking if they're large and low
    // This is a simplified heuristic
    const isBase = c.bboxMin[1] < 0.1; // Near floor
    if (isBase) baseClusterIds.add(c.id);
  });

  const baseLink = links.find(link =>
    link.clusterIds.some(id => baseClusterIds.has(id)),
  );

  if (!baseLink) {
    console.warn('No base link found, using first link as base');
    if (links.length === 0) return [];
    // Use first link as base
    const firstLink = links[0];
    return buildUnitsFromBaseLink(model, links, firstLink);
  }

  return buildUnitsFromBaseLink(model, links, baseLink);
}

function buildUnitsFromBaseLink(
  model: MechanicalModel,
  links: Link[],
  baseLink: Link,
): KinematicUnit[] {
  const units: KinematicUnit[] = [];
  let unitIdCounter = 0;

  // Find all joints that connect base link to other links
  const baseLinkClusterIds = new Set(baseLink.clusterIds);
  const jointsFromBase = model.joints.filter(j =>
    baseLinkClusterIds.has(j.parentClusterId) &&
    !baseLinkClusterIds.has(j.childClusterId),
  );

  // Group joints by their child links
  const childLinkByClusterId = new Map<string, Link>();
  links.forEach(link => {
    link.clusterIds.forEach(clusterId => {
      childLinkByClusterId.set(clusterId, link);
    });
  });

  const jointsByChildLink = new Map<Link, KinematicJoint[]>();
  jointsFromBase.forEach(joint => {
    const childLink = childLinkByClusterId.get(joint.childClusterId);
    if (!childLink) return;

    const existing = jointsByChildLink.get(childLink) ?? [];
    existing.push(joint);
    jointsByChildLink.set(childLink, existing);
  });

  // Build units: each child link (or chain) becomes a unit
  jointsByChildLink.forEach((joints, childLink) => {
    // Collect all clusters in this unit's link chain
    const unitClusterIds = new Set<string>(childLink.clusterIds);
    
    // Follow the chain downstream
    const visitedLinks = new Set<string>([childLink.id]);
    const stack: Link[] = [childLink];

    while (stack.length > 0) {
      const currentLink = stack.pop();
      if (!currentLink) continue;

      // Find joints that connect from this link to other links
      const currentClusterIds = new Set(currentLink.clusterIds);
      const downstreamJoints = model.joints.filter(j =>
        currentClusterIds.has(j.parentClusterId) &&
        !currentClusterIds.has(j.childClusterId),
      );

      downstreamJoints.forEach(joint => {
        const nextLink = childLinkByClusterId.get(joint.childClusterId);
        if (!nextLink) return;
        if (visitedLinks.has(nextLink.id)) return;

        visitedLinks.add(nextLink.id);
        stack.push(nextLink);
        nextLink.clusterIds.forEach(id => unitClusterIds.add(id));
        joints.push(joint);
      });
    }

    const unit: KinematicUnit = {
      id: `unit_${unitIdCounter++}`,
      primaryLinkId: childLink.id,
      baseLinkId: baseLink.id,
      jointIds: joints.map(j => j.id),
      clusterIds: Array.from(unitClusterIds),
    };

    units.push(unit);
  });

  return units;
}

/* ------------------------------------------------------------------ */
/* Compute unit features                                               */
/* ------------------------------------------------------------------ */

function computeUnitFeatures(
  units: KinematicUnit[],
  model: MechanicalModel,
  links: Link[],
): UnitFeatures[] {
  // Find base plane (lowest Y value among base clusters)
  let basePlaneY = Number.POSITIVE_INFINITY;
  model.clusters.forEach(c => {
    if (c.bboxMin[1] < basePlaneY) {
      basePlaneY = c.bboxMin[1];
    }
  });

  if (!Number.isFinite(basePlaneY)) {
    basePlaneY = 0;
  }

  return units.map(unit => {
    const unitClusters = model.clusters.filter(c =>
      unit.clusterIds.includes(c.id),
    );

    if (unitClusters.length === 0) {
      return createEmptyFeatures(unit.id);
    }

    // Compute merged bbox
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    unitClusters.forEach(c => {
      if (c.bboxMin[0] < minX) minX = c.bboxMin[0];
      if (c.bboxMin[1] < minY) minY = c.bboxMin[1];
      if (c.bboxMin[2] < minZ) minZ = c.bboxMin[2];
      if (c.bboxMax[0] > maxX) maxX = c.bboxMax[0];
      if (c.bboxMax[1] > maxY) maxY = c.bboxMax[1];
      if (c.bboxMax[2] > maxZ) maxZ = c.bboxMax[2];
    });

    const extentX = maxX - minX;
    const extentY = maxY - minY;
    const extentZ = maxZ - minZ;
    const height = extentY;
    const volumeApprox = extentX * extentY * extentZ;
    const slendernessY = extentY / Math.max(extentX, extentZ, 1e-6);

    const distanceFromBasePlane = minY - basePlaneY;

    // Compute contact area with base (simplified: XY overlap)
    const baseClusters = model.clusters.filter(c => c.bboxMin[1] < basePlaneY + 0.1);
    let contactAreaWithBase = 0;
    baseClusters.forEach(baseCluster => {
      const overlap = computeXYOverlap(
        [minX, minZ, maxX, maxZ],
        [baseCluster.bboxMin[0], baseCluster.bboxMin[2], baseCluster.bboxMax[0], baseCluster.bboxMax[2]],
      );
      contactAreaWithBase += overlap;
    });

    // Joint features
    const unitJoints = model.joints.filter(j => unit.jointIds.includes(j.id));
    const revoluteCount = unitJoints.filter(j => j.type === 'revolute').length;
    const prismaticCount = unitJoints.filter(j => j.type === 'prismatic').length;
    
    let maxStrokeOrAngle = 0;
    unitJoints.forEach(j => {
      const range = Math.abs(j.max - j.min);
      if (range > maxStrokeOrAngle) {
        maxStrokeOrAngle = range;
      }
    });

    return {
      unitId: unit.id,
      height,
      extentX,
      extentY,
      extentZ,
      volumeApprox,
      slendernessY,
      distanceFromBasePlane,
      contactAreaWithBase,
      jointCount: unitJoints.length,
      revoluteCount,
      prismaticCount,
      maxStrokeOrAngle,
    };
  });
}

function createEmptyFeatures(unitId: string): UnitFeatures {
  return {
    unitId,
    height: 0,
    extentX: 0,
    extentY: 0,
    extentZ: 0,
    volumeApprox: 0,
    slendernessY: 0,
    distanceFromBasePlane: 0,
    contactAreaWithBase: 0,
    jointCount: 0,
    revoluteCount: 0,
    prismaticCount: 0,
    maxStrokeOrAngle: 0,
  };
}

function computeXYOverlap(
  a: [number, number, number, number], // [minX, minZ, maxX, maxZ]
  b: [number, number, number, number],
): number {
  const xOverlap = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const zOverlap = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  return xOverlap * zOverlap;
}

/* ------------------------------------------------------------------ */
/* Output paths                                                        */
/* ------------------------------------------------------------------ */

function makeUnitsOutputPath(glbPathLocal: string): string {
  const dir = path.dirname(glbPathLocal);
  const base = path.basename(glbPathLocal, path.extname(glbPathLocal));
  return path.join(dir, `${base}.units.json`);
}

function makeFeaturesOutputPath(glbPathLocal: string): string {
  const dir = path.dirname(glbPathLocal);
  const base = path.basename(glbPathLocal, path.extname(glbPathLocal));
  return path.join(dir, `${base}.unit-features.json`);
}

