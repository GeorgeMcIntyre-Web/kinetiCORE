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
 * - Uses floorY from rigid clusters for base detection
 */

import type {
  MechanicalModel,
  Link,
  KinematicUnit,
} from './MechanicalModel';

export interface V2Diagnostics {
  jointCount: number;
  revoluteCount: number;
  prismaticCount: number;
  linkCount: number;
  baseLinkCount: number;
  unitCandidateLinkCount: number;
  joints: Array<{
    jointId: string;
    type: string;
    parentClusterId: string;
    childClusterId: string;
    parentLinkId: string | null;
    childLinkId: string | null;
  }>;
  baseLinks: string[];
  floorY: number | null;
}

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
 * Find base link(s) using geometry heuristics and floorY detection.
 */
function findBaseLinksV2(
  links: Link[],
  model: MechanicalModel,
  floorY: number | null,
): Link[] {
  if (links.length === 0) {
    return [];
  }

  // Use detected floorY if available, otherwise compute from clusters
  let effectiveFloorY: number;
  if (floorY !== null) {
    effectiveFloorY = floorY;
  } else {
    let minY = Number.POSITIVE_INFINITY;
    model.clusters.forEach(c => {
      if (c.bboxMin[1] < minY) {
        minY = c.bboxMin[1];
      }
    });
    effectiveFloorY = minY;
  }

  const floorBand = 0.1; // 10cm above floor
  
  // Score each link for "baseness"
  const linkScores = links.map(link => {
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let totalAreaXY = 0;
    let clusterCount = 0;
    
    link.clusterIds.forEach(clusterId => {
      const cluster = model.clusters.find(c => c.id === clusterId);
      if (!cluster) return;
      
      clusterCount++;
      if (cluster.bboxMin[1] < minY) minY = cluster.bboxMin[1];
      if (cluster.bboxMax[1] > maxY) maxY = cluster.bboxMax[1];
      
      const extentX = cluster.bboxMax[0] - cluster.bboxMin[0];
      const extentZ = cluster.bboxMax[2] - cluster.bboxMin[2];
      totalAreaXY += extentX * extentZ;
    });
    
    const height = maxY - minY;
    const avgAreaXY = totalAreaXY / Math.max(clusterCount, 1);
    const isNearFloor = minY <= effectiveFloorY + floorBand;
    const isFlat = height < Math.sqrt(avgAreaXY) * 0.5; // Height less than 50% of typical XY dimension
    
    const score = isNearFloor && isFlat && avgAreaXY > 0.1 ? avgAreaXY : 0;
    
    return { link, score, minY, avgAreaXY };
  });

  // Find links with highest scores (most likely to be base)
  linkScores.sort((a, b) => b.score - a.score);
  
  const baseLinks: Link[] = [];
  const minBaseScore = 0.1; // Minimum area to be considered base
  
  for (const { link, score } of linkScores) {
    if (score >= minBaseScore) {
      baseLinks.push(link);
    } else {
      break; // Scores are sorted, so we can stop
    }
  }

  // If no links meet criteria, use link with lowest Y
  if (baseLinks.length === 0) {
    linkScores.sort((a, b) => a.minY - b.minY);
    if (linkScores.length > 0) {
      baseLinks.push(linkScores[0].link);
    }
  }

  return baseLinks;
}

/**
 * Build kinematic units from link graph (v2 - improved segmentation using joint graph connectivity).
 */
export function buildKinematicUnitsV2(
  model: MechanicalModel,
  links: Link[],
  floorY: number | null = null,
): KinematicUnit[] {
  if (links.length === 0) {
    return [];
  }

  const baseLinks = findBaseLinksV2(links, model, floorY);
  if (baseLinks.length === 0) {
    return [];
  }

  // Use first base link as primary base
  const baseLink = baseLinks[0];
  const baseLinkIds = new Set(baseLinks.map(l => l.id));

  // Build map: cluster ID -> link
  const clusterToLink = new Map<string, Link>();
  links.forEach(link => {
    link.clusterIds.forEach(clusterId => {
      clusterToLink.set(clusterId, link);
    });
  });

  // Build map: link ID -> link
  const linkById = new Map<string, Link>();
  links.forEach(link => {
    linkById.set(link.id, link);
  });

  // Build joint graph: link -> links (via joints)
  const linkToLinks = new Map<string, Set<string>>();
  links.forEach(link => {
    linkToLinks.set(link.id, new Set());
  });

  model.joints.forEach(joint => {
    const parentLink = clusterToLink.get(joint.parentClusterId);
    const childLink = clusterToLink.get(joint.childClusterId);
    
    if (parentLink && childLink && parentLink.id !== childLink.id) {
      const parentSet = linkToLinks.get(parentLink.id);
      const childSet = linkToLinks.get(childLink.id);
      if (parentSet) parentSet.add(childLink.id);
      if (childSet) childSet.add(parentLink.id);
    }
  });

  // Find connected components in joint graph that include non-base links
  const visited = new Set<string>();
  const units: KinematicUnit[] = [];
  let unitIdCounter = 0;

  links.forEach(link => {
    // Skip base links
    if (baseLinkIds.has(link.id)) return;
    if (visited.has(link.id)) return;

    // Find connected component starting from this link
    const component = new Set<string>();
    const componentJoints = new Set<string>();
    const stack = [link.id];

    while (stack.length > 0) {
      const currentLinkId = stack.pop();
      if (!currentLinkId) continue;
      if (visited.has(currentLinkId)) continue;
      if (baseLinkIds.has(currentLinkId)) continue; // Don't include base links in unit

      visited.add(currentLinkId);
      component.add(currentLinkId);

      const currentLink = linkById.get(currentLinkId);
      if (!currentLink) continue;

      // Find all joints connecting this link to other links
      const neighbors = linkToLinks.get(currentLinkId);
      if (neighbors) {
        neighbors.forEach(neighborLinkId => {
          if (baseLinkIds.has(neighborLinkId)) return; // Don't traverse into base
          if (visited.has(neighborLinkId)) return;

          // Find joint(s) connecting these links
          const neighborLink = linkById.get(neighborLinkId);
          if (!neighborLink) return;

          const currentClusterIds = new Set(currentLink.clusterIds);
          const neighborClusterIds = new Set(neighborLink.clusterIds);

          model.joints.forEach(joint => {
            const parentInCurrent = currentClusterIds.has(joint.parentClusterId);
            const childInNeighbor = neighborClusterIds.has(joint.childClusterId);
            const parentInNeighbor = neighborClusterIds.has(joint.parentClusterId);
            const childInCurrent = currentClusterIds.has(joint.childClusterId);

            if ((parentInCurrent && childInNeighbor) || (parentInNeighbor && childInCurrent)) {
              componentJoints.add(joint.id);
            }
          });

          stack.push(neighborLinkId);
        });
      }
    }

    // Only create unit if component has non-base links and joints
    if (component.size > 0 && componentJoints.size > 0) {
      // Collect all clusters in this unit
      const unitClusterIds = new Set<string>();
      let topmostLinkId: string | null = null;
      let topmostY = Number.NEGATIVE_INFINITY;

      component.forEach(linkId => {
        const unitLink = linkById.get(linkId);
        if (!unitLink) return;

        unitLink.clusterIds.forEach(clusterId => {
          unitClusterIds.add(clusterId);
        });

        // Find topmost link (highest center Y)
        unitLink.clusterIds.forEach(clusterId => {
          const cluster = model.clusters.find(c => c.id === clusterId);
          if (cluster) {
            const centerY = (cluster.bboxMin[1] + cluster.bboxMax[1]) / 2;
            if (centerY > topmostY) {
              topmostY = centerY;
              topmostLinkId = unitLink.id;
            }
          }
        });
      });

      const primaryLinkId = topmostLinkId ?? Array.from(component)[0];

      const unit: KinematicUnit = {
        id: `unit_${unitIdCounter++}`,
        primaryLinkId,
        baseLinkId: baseLink.id,
        jointIds: Array.from(componentJoints),
        clusterIds: Array.from(unitClusterIds),
      };

      units.push(unit);
    }
  });

  return units;
}

/**
 * Generate diagnostics for v2 unit builder.
 */
export function logV2Diagnostics(
  model: MechanicalModel,
  links: Link[],
  floorY: number | null,
): V2Diagnostics {
  const revoluteCount = model.joints.filter(j => j.type === 'revolute').length;
  const prismaticCount = model.joints.filter(j => j.type === 'prismatic').length;

  // Build cluster -> link map
  const clusterToLink = new Map<string, Link>();
  links.forEach(link => {
    link.clusterIds.forEach(clusterId => {
      clusterToLink.set(clusterId, link);
    });
  });

  const baseLinks = findBaseLinksV2(links, model, floorY);
  const baseLinkIds = new Set(baseLinks.map(l => l.id));

  const jointDetails = model.joints.map(joint => ({
    jointId: joint.id,
    type: joint.type,
    parentClusterId: joint.parentClusterId,
    childClusterId: joint.childClusterId,
    parentLinkId: clusterToLink.get(joint.parentClusterId)?.id ?? null,
    childLinkId: clusterToLink.get(joint.childClusterId)?.id ?? null,
  }));

  const unitCandidateLinks = links.filter(link => !baseLinkIds.has(link.id));

  return {
    jointCount: model.joints.length,
    revoluteCount,
    prismaticCount,
    linkCount: links.length,
    baseLinkCount: baseLinks.length,
    unitCandidateLinkCount: unitCandidateLinks.length,
    joints: jointDetails,
    baseLinks: baseLinks.map(l => l.id),
    floorY,
  };
}

