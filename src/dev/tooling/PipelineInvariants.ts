/**
 * Runtime invariant checks for the tooling pipeline.
 * 
 * These checks validate that the pipeline produces valid outputs
 * at each step, catching errors early.
 */

import type { MechanicalModel, Link, KinematicJoint, KinematicUnit } from './MechanicalModel';

export interface InvariantViolation {
  step: string;
  message: string;
}

/**
 * Check invariants after rigid clustering step.
 */
export function checkRigidClustersInvariants(
  clusters: Array<{ id: number; type: 'base' | 'unit' | 'loose'; bbox: { min: [number, number, number]; max: [number, number, number] } }>
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  if (clusters.length === 0) {
    violations.push({
      step: 'rigid-clusters',
      message: 'No clusters found',
    });
    return violations;
  }

  // Check that base clusters exist when expected
  const baseClusters = clusters.filter(c => c.type === 'base');
  if (baseClusters.length === 0) {
    violations.push({
      step: 'rigid-clusters',
      message: 'No base clusters found - expected at least one base',
    });
  }

  // Check that bboxes are valid
  clusters.forEach(cluster => {
    const { min, max } = cluster.bbox;
    if (min[0] > max[0] || min[1] > max[1] || min[2] > max[2]) {
      violations.push({
        step: 'rigid-clusters',
        message: `Invalid bbox for cluster ${cluster.id}: min > max`,
      });
    }
  });

  return violations;
}

/**
 * Check invariants after joint segmentation step.
 */
export function checkJointSegmentationInvariants(
  joints: KinematicJoint[],
  model: MechanicalModel
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  // Check that all joints reference existing clusters
  const clusterIds = new Set(model.clusters.map(c => c.id));
  
  joints.forEach(joint => {
    if (!clusterIds.has(joint.parentClusterId)) {
      violations.push({
        step: 'joint-segmentation',
        message: `Joint ${joint.id} references non-existent parent cluster: ${joint.parentClusterId}`,
      });
    }
    
    if (!clusterIds.has(joint.childClusterId)) {
      violations.push({
        step: 'joint-segmentation',
        message: `Joint ${joint.id} references non-existent child cluster: ${joint.childClusterId}`,
      });
    }
  });

  return violations;
}

/**
 * Check invariants after unit builder step.
 */
export function checkUnitBuilderInvariants(
  model: MechanicalModel,
  links: Link[],
  units: KinematicUnit[]
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  // Check that base link exists (simplified check - at least one link should exist)
  // In practice, we'd check if any link contains base clusters, but that requires
  // access to the original cluster JSON which isn't available here.
  // For now, we just check that links exist when we have clusters.
  if (model.clusters.length > 0 && links.length === 0) {
    violations.push({
      step: 'unit-builder',
      message: 'No links found but clusters exist - expected at least one link',
    });
  }

  // Check that all units are non-empty
  units.forEach(unit => {
    if (unit.clusterIds.length === 0) {
      violations.push({
        step: 'unit-builder',
        message: `Unit ${unit.id} has no clusters`,
      });
    }

    if (unit.jointIds.length === 0 && unit.clusterIds.length > 0) {
      // This is a warning, not an error - units can exist without joints
      // But we'll log it for now
    }

    // Check that unit references existing links
    const linkIds = new Set(links.map(l => l.id));
    if (!linkIds.has(unit.baseLinkId)) {
      violations.push({
        step: 'unit-builder',
        message: `Unit ${unit.id} references non-existent base link: ${unit.baseLinkId}`,
      });
    }

    if (!linkIds.has(unit.primaryLinkId)) {
      violations.push({
        step: 'unit-builder',
        message: `Unit ${unit.id} references non-existent primary link: ${unit.primaryLinkId}`,
      });
    }
  });

  // Check that all joints map to existing links
  const linkClusterIds = new Map<string, Set<string>>();
  links.forEach(link => {
    linkClusterIds.set(link.id, new Set(link.clusterIds));
  });

  model.joints.forEach(joint => {
    const parentLink = links.find(l => linkClusterIds.get(l.id)?.has(joint.parentClusterId));
    const childLink = links.find(l => linkClusterIds.get(l.id)?.has(joint.childClusterId));

    if (!parentLink) {
      violations.push({
        step: 'unit-builder',
        message: `Joint ${joint.id} parent cluster ${joint.parentClusterId} not found in any link`,
      });
    }

    if (!childLink) {
      violations.push({
        step: 'unit-builder',
        message: `Joint ${joint.id} child cluster ${joint.childClusterId} not found in any link`,
      });
    }
  });

  return violations;
}

/**
 * Run all invariant checks and throw if any violations found.
 */
export function assertInvariants(
  violations: InvariantViolation[]
): void {
  if (violations.length === 0) return;

  const messages = violations.map(v => `[${v.step}] ${v.message}`).join('\n');
  throw new Error(`Invariant violations:\n${messages}`);
}

