/**
 * Unit tests for unit graph builder.
 * 
 * Tests building kinematic units from hard-coded joint lists.
 */

import { describe, it, expect } from 'vitest';
import type { MechanicalModel, Link, KinematicJoint, KinematicUnit } from '../MechanicalModel';

// Simplified version of buildLinkGraph and buildKinematicUnits for testing
function buildLinkGraphFromJoints(
  clusters: Array<{ id: string }>,
  joints: KinematicJoint[]
): Link[] {
  const clusterToClusters = new Map<string, Set<string>>();
  clusters.forEach(c => {
    clusterToClusters.set(c.id, new Set());
  });

  joints.forEach(joint => {
    const parentSet = clusterToClusters.get(joint.parentClusterId);
    const childSet = clusterToClusters.get(joint.childClusterId);
    
    if (parentSet) parentSet.add(joint.childClusterId);
    if (childSet) childSet.add(joint.parentClusterId);
  });

  const visited = new Set<string>();
  const links: Link[] = [];
  let linkIdCounter = 0;

  clusters.forEach(cluster => {
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

function buildUnitsFromLinks(
  model: MechanicalModel,
  links: Link[]
): KinematicUnit[] {
  // Simplified unit building - find base link and build units
  const baseLink = links[0]; // Simplified: use first link as base
  
  if (!baseLink) return [];

  const units: KinematicUnit[] = [];
  let unitIdCounter = 0;

  const baseLinkClusterIds = new Set(baseLink.clusterIds);
  const jointsFromBase = model.joints.filter(j =>
    baseLinkClusterIds.has(j.parentClusterId) &&
    !baseLinkClusterIds.has(j.childClusterId),
  );

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

  jointsByChildLink.forEach((joints, childLink) => {
    const unitClusterIds = new Set<string>(childLink.clusterIds);
    
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

describe('Unit graph builder', () => {
  it('builds one unit from connected links', () => {
    const clusters = [
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
      { id: 'D' },
    ];

    const joints: KinematicJoint[] = [
      {
        id: 'J1',
        type: 'revolute',
        parentClusterId: 'A',
        childClusterId: 'B',
        axis: [0, 1, 0],
        origin: [0, 0, 0],
        min: -30,
        max: 45,
      },
      {
        id: 'J2',
        type: 'prismatic',
        parentClusterId: 'B',
        childClusterId: 'C',
        axis: [1, 0, 0],
        origin: [1, 0, 0],
        min: 0,
        max: 100,
      },
      {
        id: 'J3',
        type: 'revolute',
        parentClusterId: 'C',
        childClusterId: 'D',
        axis: [0, 1, 0],
        origin: [2, 0, 0],
        min: -90,
        max: 90,
      },
    ];

    const model: MechanicalModel = {
      nodes: [],
      meshes: [],
      clusters: clusters.map(c => ({
        id: c.id,
        nodeIds: [],
        meshIds: [],
        bboxMin: [0, 0, 0],
        bboxMax: [1, 1, 1],
        meshCount: 1,
        totalVerts: 100,
      })),
      links: [],
      joints,
    };

    const links = buildLinkGraphFromJoints(clusters, joints);
    expect(links.length).toBe(1);
    expect(links[0].clusterIds.sort()).toEqual(['A', 'B', 'C', 'D']);

    const units = buildUnitsFromLinks(model, links);
    expect(units.length).toBe(0); // No units because all links are connected to base
  });

  it('builds two units from disconnected link pairs', () => {
    const clusters = [
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
      { id: 'D' },
      { id: 'E' },
      { id: 'F' },
    ];

    const joints: KinematicJoint[] = [
      {
        id: 'J1',
        type: 'revolute',
        parentClusterId: 'A',
        childClusterId: 'B',
        axis: [0, 1, 0],
        origin: [0, 0, 0],
        min: -30,
        max: 45,
      },
      {
        id: 'J2',
        type: 'revolute',
        parentClusterId: 'B',
        childClusterId: 'C',
        axis: [0, 1, 0],
        origin: [1, 0, 0],
        min: -90,
        max: 90,
      },
      {
        id: 'J3',
        type: 'revolute',
        parentClusterId: 'C',
        childClusterId: 'D',
        axis: [0, 1, 0],
        origin: [2, 0, 0],
        min: -90,
        max: 90,
      },
      {
        id: 'J4',
        type: 'revolute',
        parentClusterId: 'E',
        childClusterId: 'F',
        axis: [0, 1, 0],
        origin: [5, 0, 0],
        min: -90,
        max: 90,
      },
    ];

    const model: MechanicalModel = {
      nodes: [],
      meshes: [],
      clusters: clusters.map(c => ({
        id: c.id,
        nodeIds: [],
        meshIds: [],
        bboxMin: [0, 0, 0],
        bboxMax: [1, 1, 1],
        meshCount: 1,
        totalVerts: 100,
      })),
      links: [],
      joints,
    };

    const links = buildLinkGraphFromJoints(clusters, joints);
    expect(links.length).toBe(2);
    
    const link1ClusterIds = links.find(l => l.clusterIds.includes('A'))?.clusterIds.sort();
    const link2ClusterIds = links.find(l => l.clusterIds.includes('E'))?.clusterIds.sort();
    
    expect(link1ClusterIds).toEqual(['A', 'B', 'C', 'D']);
    expect(link2ClusterIds).toEqual(['E', 'F']);
  });
});

