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
 * Debug summary for link graph analysis.
 */
export interface DebugSummary {
  links: Array<{
    linkId: string;
    clusterIds: string[];
    isBase: boolean;
  }>;
  joints: Array<{
    jointId: string;
    parentLinkId: string | null;
    childLinkId: string | null;
    parentClusterId: string;
    childClusterId: string;
  }>;
}

/**
 * Debug flag - set to true to enable detailed logging.
 */
let DEBUG_V2 = false;

/**
 * Enable or disable debug logging for v2 unit builder.
 */
export function setDebugV2(enabled: boolean): void {
  DEBUG_V2 = enabled;
}

/**
 * Build link graph from joints (v2 - improved connectivity analysis).
 * 
 * Key principle: Joints connect DIFFERENT links, not create them.
 * - Start with one cluster = one link (each cluster is a rigid body)
 * - Base clusters (floor/pedestals/plate) will be merged into a single base link later
 * - Clusters that are children in joints must be in non-base links
 */
export function buildLinkGraphV2(
  model: MechanicalModel,
  floorY: number | null = null,
): Link[] {
  // Start with one link per cluster (each cluster is a rigid body)
  const links: Link[] = [];
  let linkIdCounter = 0;

  model.clusters.forEach(cluster => {
    links.push({
      id: `link_${linkIdCounter++}`,
      clusterIds: [cluster.id],
    });
  });

  if (DEBUG_V2) {
    console.log(`[UnitBuilderV2] Initial links: ${links.length} (one per cluster)`);
    model.joints.forEach(joint => {
      const parentCluster = model.clusters.find(c => c.id === joint.parentClusterId);
      const childCluster = model.clusters.find(c => c.id === joint.childClusterId);
      if (parentCluster && childCluster) {
        const parentMinY = parentCluster.bboxMin[1];
        const parentMaxY = parentCluster.bboxMax[1];
        const parentAreaXY = (parentCluster.bboxMax[0] - parentCluster.bboxMin[0]) * 
                            (parentCluster.bboxMax[2] - parentCluster.bboxMin[2]);
        const childMinY = childCluster.bboxMin[1];
        const childMaxY = childCluster.bboxMax[1];
        const childAreaXY = (childCluster.bboxMax[0] - childCluster.bboxMin[0]) * 
                           (childCluster.bboxMax[2] - childCluster.bboxMin[2]);
        
        console.log(`[UnitBuilderV2] Joint ${joint.id} (${joint.type}):`);
        console.log(`  parent: ${joint.parentClusterId} (minY=${parentMinY.toFixed(4)}, maxY=${parentMaxY.toFixed(4)}, areaXY=${parentAreaXY.toFixed(4)})`);
        console.log(`  child:  ${joint.childClusterId} (minY=${childMinY.toFixed(4)}, maxY=${childMaxY.toFixed(4)}, areaXY=${childAreaXY.toFixed(4)})`);
      }
    });
  }

  // Identify base clusters (floor/pedestals/plate) using geometry heuristics
  const effectiveFloorY = floorY !== null ? floorY : 
    (model.clusters.length > 0 ? Math.min(...model.clusters.map(c => c.bboxMin[1])) : 0);
  
  const floorBand = 0.1; // 10cm above floor
  const baseClusterIds = new Set<string>();
  
  model.clusters.forEach(cluster => {
    const minY = cluster.bboxMin[1];
    const maxY = cluster.bboxMax[1];
    const extentX = cluster.bboxMax[0] - cluster.bboxMin[0];
    const extentZ = cluster.bboxMax[2] - cluster.bboxMin[2];
    const areaXY = extentX * extentZ;
    const height = maxY - minY;
    
    const isNearFloor = minY <= effectiveFloorY + floorBand;
    const isFlat = height < Math.sqrt(areaXY) * 0.5; // Height less than 50% of typical XY dimension
    const isLarge = areaXY > 0.1; // At least 0.1 m²
    
    if (isNearFloor && isFlat && isLarge) {
      baseClusterIds.add(cluster.id);
    }
  });

  if (DEBUG_V2) {
    console.log(`[UnitBuilderV2] Identified ${baseClusterIds.size} base clusters`);
    baseClusterIds.forEach(clusterId => {
      const cluster = model.clusters.find(c => c.id === clusterId);
      if (cluster) {
        const areaXY = (cluster.bboxMax[0] - cluster.bboxMin[0]) * 
                      (cluster.bboxMax[2] - cluster.bboxMin[2]);
        console.log(`  Base cluster: ${clusterId} (minY=${cluster.bboxMin[1].toFixed(4)}, areaXY=${areaXY.toFixed(4)})`);
      }
    });
  }

  // Merge base clusters into a single base link
  if (baseClusterIds.size > 0) {
    const baseLinkId = `link_base`;
    const baseClusterIdsArray = Array.from(baseClusterIds);
    
    // Remove individual base cluster links
    const nonBaseLinks = links.filter(link => {
      return !baseClusterIds.has(link.clusterIds[0]);
    });
    
    // Add merged base link
    nonBaseLinks.unshift({
      id: baseLinkId,
      clusterIds: baseClusterIdsArray,
    });
    
    if (DEBUG_V2) {
      console.log(`[UnitBuilderV2] Merged ${baseClusterIds.size} base clusters into base link: ${baseLinkId}`);
      console.log(`[UnitBuilderV2] Final links: ${nonBaseLinks.length} (1 base + ${nonBaseLinks.length - 1} non-base)`);
    }
    
    return nonBaseLinks;
  }

  return links;
}

/**
 * Find base link(s) using geometry heuristics and floorY detection.
 * 
 * The base link should be the one containing base clusters (floor/pedestals/plate).
 * Since buildLinkGraphV2 already merges base clusters into link_base, we just need to find it.
 */
function findBaseLinksV2(
  links: Link[],
  model: MechanicalModel,
  floorY: number | null,
): Link[] {
  if (links.length === 0) {
    return [];
  }

  // Look for link_base (created by buildLinkGraphV2)
  const baseLink = links.find(link => link.id === 'link_base');
  if (baseLink) {
    if (DEBUG_V2) {
      console.log(`[UnitBuilderV2] Found base link: ${baseLink.id} with ${baseLink.clusterIds.length} clusters`);
    }
    return [baseLink];
  }

  // Fallback: find link with lowest Y and largest area
  const effectiveFloorY = floorY !== null ? floorY : 
    (model.clusters.length > 0 ? Math.min(...model.clusters.map(c => c.bboxMin[1])) : 0);
  
  const floorBand = 0.1; // 10cm above floor
  
  const linkScores = links.map(link => {
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let totalAreaXY = 0;
    
    link.clusterIds.forEach(clusterId => {
      const cluster = model.clusters.find(c => c.id === clusterId);
      if (!cluster) return;
      
      if (cluster.bboxMin[1] < minY) minY = cluster.bboxMin[1];
      if (cluster.bboxMax[1] > maxY) maxY = cluster.bboxMax[1];
      
      const extentX = cluster.bboxMax[0] - cluster.bboxMin[0];
      const extentZ = cluster.bboxMax[2] - cluster.bboxMin[2];
      totalAreaXY += extentX * extentZ;
    });
    
    const height = maxY - minY;
    const avgAreaXY = totalAreaXY / Math.max(link.clusterIds.length, 1);
    const isNearFloor = minY <= effectiveFloorY + floorBand;
    const isFlat = height < Math.sqrt(avgAreaXY) * 0.5;
    
    const score = isNearFloor && isFlat && avgAreaXY > 0.1 ? avgAreaXY : 0;
    
    return { link, score, minY };
  });

  linkScores.sort((a, b) => b.score - a.score);
  
  const baseLinks: Link[] = [];
  const minBaseScore = 0.1;
  
  for (const { link, score } of linkScores) {
    if (score >= minBaseScore) {
      baseLinks.push(link);
    } else {
      break;
    }
  }

  // If no links meet criteria, use link with lowest Y
  if (baseLinks.length === 0) {
    linkScores.sort((a, b) => a.minY - b.minY);
    if (linkScores.length > 0) {
      baseLinks.push(linkScores[0].link);
    }
  }

  if (DEBUG_V2) {
    console.log(`[UnitBuilderV2] Found ${baseLinks.length} base link(s) via fallback`);
  }

  return baseLinks;
}

/**
 * Build kinematic units from link graph (v2 - improved segmentation using joint graph connectivity).
 * 
 * Strategy:
 * - Start from base link
 * - For each joint branch (base → joint → link → joint → link...), create one unit
 * - One link per joint branch starting from the base
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
    if (DEBUG_V2) {
      console.log(`[UnitBuilderV2] No base links found, cannot build units`);
    }
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
  // Also track which joints connect which links
  const linkToLinks = new Map<string, Set<string>>();
  const linkToJoints = new Map<string, Map<string, string>>(); // linkId -> (neighborLinkId -> jointId)
  links.forEach(link => {
    linkToLinks.set(link.id, new Set());
    linkToJoints.set(link.id, new Map());
  });

  model.joints.forEach(joint => {
    const parentLink = clusterToLink.get(joint.parentClusterId);
    const childLink = clusterToLink.get(joint.childClusterId);
    
    if (parentLink && childLink && parentLink.id !== childLink.id) {
      const parentSet = linkToLinks.get(parentLink.id);
      const childSet = linkToLinks.get(childLink.id);
      const parentJoints = linkToJoints.get(parentLink.id);
      const childJoints = linkToJoints.get(childLink.id);
      
      if (parentSet) parentSet.add(childLink.id);
      if (childSet) childSet.add(parentLink.id);
      if (parentJoints) parentJoints.set(childLink.id, joint.id);
      if (childJoints) childJoints.set(parentLink.id, joint.id);
    }
  });

  if (DEBUG_V2) {
    console.log(`[UnitBuilderV2] Building units from base link: ${baseLink.id}`);
    links.forEach(link => {
      const isBase = baseLinkIds.has(link.id);
      console.log(`[UnitBuilderV2] Link ${link.id}: ${link.clusterIds.length} clusters, isBase=${isBase}`);
    });
  }

  // Build units by traversing joint branches from base
  const visited = new Set<string>();
  const units: KinematicUnit[] = [];
  let unitIdCounter = 0;

  // Find all links that are children of joints from the base
  const linksFromBase = new Set<string>();
  baseLinkIds.forEach(baseLinkId => {
    const neighbors = linkToLinks.get(baseLinkId);
    if (neighbors) {
      neighbors.forEach(neighborLinkId => {
        if (!baseLinkIds.has(neighborLinkId)) {
          linksFromBase.add(neighborLinkId);
        }
      });
    }
  });

  if (DEBUG_V2) {
    console.log(`[UnitBuilderV2] Found ${linksFromBase.size} links directly connected to base via joints`);
  }

  // For each link directly connected to base, start a new unit branch
  linksFromBase.forEach(startLinkId => {
    if (visited.has(startLinkId)) return;
    if (baseLinkIds.has(startLinkId)) return;

    // Traverse this joint branch from base
    const branchLinks = new Set<string>();
    const branchJoints = new Set<string>();
    const stack: Array<{ linkId: string; fromBase: boolean }> = [{ linkId: startLinkId, fromBase: true }];

    while (stack.length > 0) {
      const { linkId, fromBase } = stack.pop()!;
      if (visited.has(linkId)) continue;
      if (baseLinkIds.has(linkId)) continue;

      visited.add(linkId);
      branchLinks.add(linkId);

      // Find joint connecting to base or previous link
      if (fromBase) {
        // Find joint from base to this link
        baseLinkIds.forEach(baseLinkId => {
          const jointId = linkToJoints.get(baseLinkId)?.get(linkId);
          if (jointId) {
            branchJoints.add(jointId);
            if (DEBUG_V2) {
              console.log(`[UnitBuilderV2] Branch: base -> ${jointId} -> ${linkId}`);
            }
          }
        });
      }

      // Continue traversing this branch
      const neighbors = linkToLinks.get(linkId);
      if (neighbors) {
        neighbors.forEach(neighborLinkId => {
          if (!baseLinkIds.has(neighborLinkId) && !visited.has(neighborLinkId)) {
            const jointId = linkToJoints.get(linkId)?.get(neighborLinkId);
            if (jointId) {
              branchJoints.add(jointId);
              if (DEBUG_V2) {
                console.log(`[UnitBuilderV2] Branch: ${linkId} -> ${jointId} -> ${neighborLinkId}`);
              }
            }
            stack.push({ linkId: neighborLinkId, fromBase: false });
          }
        });
      }
    }

    // Create unit from this branch
    if (branchLinks.size > 0 && branchJoints.size > 0) {
      // Collect all clusters in this unit
      const unitClusterIds = new Set<string>();
      let primaryLinkId: string | null = null;
      let topmostY = Number.NEGATIVE_INFINITY;

      branchLinks.forEach(linkId => {
        const unitLink = linkById.get(linkId);
        if (!unitLink) return;

        unitLink.clusterIds.forEach(clusterId => {
          unitClusterIds.add(clusterId);
        });

        // Find topmost link (highest center Y) as primary
        unitLink.clusterIds.forEach(clusterId => {
          const cluster = model.clusters.find(c => c.id === clusterId);
          if (cluster) {
            const centerY = (cluster.bboxMin[1] + cluster.bboxMax[1]) / 2;
            if (centerY > topmostY) {
              topmostY = centerY;
              primaryLinkId = unitLink.id;
            }
          }
        });
      });

      // Use first link in branch if no primary found
      if (!primaryLinkId) {
        primaryLinkId = Array.from(branchLinks)[0];
      }

      const unit: KinematicUnit = {
        id: `unit_${unitIdCounter++}`,
        primaryLinkId,
        baseLinkId: baseLink.id,
        jointIds: Array.from(branchJoints),
        clusterIds: Array.from(unitClusterIds),
      };

      units.push(unit);

      if (DEBUG_V2) {
        console.log(`[UnitBuilderV2] Created unit ${unit.id}: ${branchLinks.size} links, ${branchJoints.size} joints, primary=${primaryLinkId}`);
      }
    }
  });

  if (DEBUG_V2) {
    console.log(`[UnitBuilderV2] Built ${units.length} units total`);
  }

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

/**
 * Debug helper to describe link graph structure.
 * 
 * This function provides a structured summary of the link graph for diagnostics.
 * It does not affect core logic, only for debugging and tests.
 */
export function debugDescribeLinkGraph(
  model: MechanicalModel,
  links: Link[],
  floorY: number | null,
): DebugSummary {
  const baseLinks = findBaseLinksV2(links, model, floorY);
  const baseLinkIds = new Set(baseLinks.map(l => l.id));

  // Build cluster -> link map
  const clusterToLink = new Map<string, Link>();
  links.forEach(link => {
    link.clusterIds.forEach(clusterId => {
      clusterToLink.set(clusterId, link);
    });
  });

  const linkSummary = links.map(link => ({
    linkId: link.id,
    clusterIds: link.clusterIds,
    isBase: baseLinkIds.has(link.id),
  }));

  const jointSummary = model.joints.map(joint => ({
    jointId: joint.id,
    parentLinkId: clusterToLink.get(joint.parentClusterId)?.id ?? null,
    childLinkId: clusterToLink.get(joint.childClusterId)?.id ?? null,
    parentClusterId: joint.parentClusterId,
    childClusterId: joint.childClusterId,
  }));

  return {
    links: linkSummary,
    joints: jointSummary,
  };
}

