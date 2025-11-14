/**
 * V2 Unit Builder - Experimental improved segmentation.
 * 
 * Pure functions, no naming, using joint graph + geometry.
 * Currently enabled only for 9X_110_GEO via --mode=v2 flag.
 * 
 * Key improvements over v1:
 * - Better joint-to-cluster mapping using node paths
 * - More accurate link graph construction
 * - Improved unit segmentation from joint connectivity
 */

import type {
  MechanicalModel,
  RigidCluster,
  KinematicJoint,
  Link,
  KinematicUnit,
} from './MechanicalModel';

/**
 * Build link graph from joints (v2 - improved connectivity analysis).
 */
export function buildLinkGraphV2(
  model: MechanicalModel,
): Link[] {
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

/**
 * Find base link(s) using geometry heuristics.
 */
function findBaseLinks(
  links: Link[],
  model: MechanicalModel,
): Link[] {
  // Find clusters that are likely base (low Y, large XY extent)
  const baseClusterIds = new Set<string>();
  let minY = Number.POSITIVE_INFINITY;
  
  model.clusters.forEach(c => {
    if (c.bboxMin[1] < minY) {
      minY = c.bboxMin[1];
    }
  });

  const floorThreshold = minY + 0.1; // 10cm above minimum
  
  model.clusters.forEach(c => {
    const height = c.bboxMax[1] - c.bboxMin[1];
    const extentX = c.bboxMax[0] - c.bboxMin[0];
    const extentZ = c.bboxMax[2] - c.bboxMin[2];
    const maxXY = Math.max(extentX, extentZ);
    
    // Base heuristics: near floor, relatively flat
    const isNearFloor = c.bboxMin[1] < floorThreshold;
    const isFlat = height < maxXY * 0.5; // Height less than 50% of max XY
    
    if (isNearFloor && isFlat && maxXY > 0.1) {
      baseClusterIds.add(c.id);
    }
  });

  // Find links containing base clusters
  const baseLinks = links.filter(link =>
    link.clusterIds.some(id => baseClusterIds.has(id))
  );

  if (baseLinks.length === 0 && links.length > 0) {
    // Fallback: use link with lowest Y clusters
    let lowestLink = links[0];
    let lowestY = Number.POSITIVE_INFINITY;
    
    links.forEach(link => {
      link.clusterIds.forEach(clusterId => {
        const cluster = model.clusters.find(c => c.id === clusterId);
        if (cluster && cluster.bboxMin[1] < lowestY) {
          lowestY = cluster.bboxMin[1];
          lowestLink = link;
        }
      });
    });
    
    return [lowestLink];
  }

  return baseLinks;
}

/**
 * Build kinematic units from link graph (v2 - improved segmentation).
 */
export function buildKinematicUnitsV2(
  model: MechanicalModel,
  links: Link[],
): KinematicUnit[] {
  if (links.length === 0) {
    return [];
  }

  const baseLinks = findBaseLinks(links, model);
  if (baseLinks.length === 0) {
    return [];
  }

  // Use first base link as primary base
  const baseLink = baseLinks[0];
  const baseLinkClusterIds = new Set(baseLink.clusterIds);

  // Build map: cluster ID -> link
  const clusterToLink = new Map<string, Link>();
  links.forEach(link => {
    link.clusterIds.forEach(clusterId => {
      clusterToLink.set(clusterId, link);
    });
  });

  // Find joints that connect base to non-base links
  const jointsFromBase = model.joints.filter(j => {
    const parentInBase = baseLinkClusterIds.has(j.parentClusterId);
    const childInBase = baseLinkClusterIds.has(j.childClusterId);
    return parentInBase && !childInBase;
  });

  if (jointsFromBase.length === 0) {
    return [];
  }

  // Group joints by their child links
  const jointsByChildLink = new Map<Link, KinematicJoint[]>();
  
  jointsFromBase.forEach(joint => {
    const childLink = clusterToLink.get(joint.childClusterId);
    if (!childLink) return;
    if (baseLinkClusterIds.has(joint.childClusterId)) return; // Skip if child is in base

    const existing = jointsByChildLink.get(childLink) ?? [];
    existing.push(joint);
    jointsByChildLink.set(childLink, existing);
  });

  // Build units: each child link (or chain) becomes a unit
  const units: KinematicUnit[] = [];
  let unitIdCounter = 0;

  jointsByChildLink.forEach((joints, childLink) => {
    // Collect all clusters in this unit's link chain
    const unitClusterIds = new Set<string>(childLink.clusterIds);
    const unitJointIds = new Set<string>(joints.map(j => j.id));
    
    // Follow the chain downstream from this link
    const visitedLinks = new Set<string>([childLink.id]);
    const stack: Link[] = [childLink];

    while (stack.length > 0) {
      const currentLink = stack.pop();
      if (!currentLink) continue;

      // Find joints that connect from this link to other links
      const currentClusterIds = new Set(currentLink.clusterIds);
      const downstreamJoints = model.joints.filter(j => {
        const parentInCurrent = currentClusterIds.has(j.parentClusterId);
        const childInCurrent = currentClusterIds.has(j.childClusterId);
        return parentInCurrent && !childInCurrent && !baseLinkClusterIds.has(j.childClusterId);
      });

      downstreamJoints.forEach(joint => {
        const nextLink = clusterToLink.get(joint.childClusterId);
        if (!nextLink) return;
        if (visitedLinks.has(nextLink.id)) return;
        if (baseLinkClusterIds.has(joint.childClusterId)) return; // Don't go back to base

        visitedLinks.add(nextLink.id);
        stack.push(nextLink);
        nextLink.clusterIds.forEach(id => unitClusterIds.add(id));
        unitJointIds.add(joint.id);
      });
    }

    // Only create unit if it has clusters and joints
    if (unitClusterIds.size > 0 && unitJointIds.size > 0) {
      const unit: KinematicUnit = {
        id: `unit_${unitIdCounter++}`,
        primaryLinkId: childLink.id,
        baseLinkId: baseLink.id,
        jointIds: Array.from(unitJointIds),
        clusterIds: Array.from(unitClusterIds),
      };

      units.push(unit);
    }
  });

  return units;
}

