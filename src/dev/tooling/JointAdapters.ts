/**
 * Joint adapter layer for OEM-agnostic joint loading.
 * 
 * Each OEM (Ford Fides, TMS/NX, JT) implements this interface to convert
 * their specific joint format into the canonical KinematicJoint[] format.
 * 
 * Adapters must NOT rely on name patterns for kinematic decisions.
 */

import type { MechanicalModel, KinematicJoint } from './MechanicalModel';
import type { ToolingStructureProfile } from './ToolingStructureAnalyzer';

/**
 * Metadata about a fixture for adapter detection and joint loading.
 */
export interface ToolingMetadata {
  fixtureId: string;
  glbPath: string;
  auxJsonPaths: string[]; // OEM-specific JSON files (e.g., Ford Fides joint JSON)
  structureProfile?: ToolingStructureProfile; // Optional structure analysis
}

/**
 * Contract for OEM joint adapters.
 * 
 * Each adapter must:
 * 1. Declare if it can handle a given fixture (via canHandle)
 * 2. Load joints from OEM format into canonical KinematicJoint[] format
 * 3. Never use name patterns for kinematic decisions
 */
export interface JointAdapter {
  /** Unique identifier for this adapter (e.g., 'ford_fides', 'tms_nx') */
  id: string;

  /**
   * Check if this adapter can handle the given fixture metadata.
   * Uses structure profile, file paths, or file contents - NOT name patterns.
   */
  canHandle(meta: ToolingMetadata): boolean;

  /**
   * Load joints from OEM format into canonical format.
   * Must be naming-free - uses only geometry and explicit joint metadata.
   */
  loadJoints(meta: ToolingMetadata, model: MechanicalModel): Promise<KinematicJoint[]>;
}

/**
 * Ford Fides joint adapter.
 * 
 * Reads Ford Fides GEO JSON files (e.g., 9X_110_GEO.json) and converts
 * them to canonical KinematicJoint[] format.
 * 
 * Uses NodeId paths only to locate GLB nodes/clusters, not for semantics.
 */
export class FordFidesJointAdapter implements JointAdapter {
  id = 'ford_fides';

  canHandle(meta: ToolingMetadata): boolean {
    // Check if we have a JSON file that looks like Ford Fides format
    // Look for JSON files with array of units containing Joints arrays
    const fs = require('node:fs');
    for (const jsonPath of meta.auxJsonPaths) {
      try {
        if (!fs.existsSync(jsonPath)) continue;
        
        const content = fs.readFileSync(jsonPath, 'utf8');
        const data = JSON.parse(content);
        
        // Ford Fides format: array of units, each with Joints array
        if (Array.isArray(data)) {
          const hasUnitsWithJoints = data.some((unit: any) => 
            unit.UnitName && Array.isArray(unit.Joints)
          );
          if (hasUnitsWithJoints) return true;
        }
      } catch {
        // Skip invalid JSON
        continue;
      }
    }
    return false;
  }

  async loadJoints(meta: ToolingMetadata, model: MechanicalModel): Promise<KinematicJoint[]> {
    const fs = await import('node:fs');
    
    // Find the Ford Fides JSON file
    let jointsJsonPath: string | null = null;
    for (const jsonPath of meta.auxJsonPaths) {
      if (fs.existsSync(jsonPath)) {
        try {
          const content = fs.readFileSync(jsonPath, 'utf8');
          const data = JSON.parse(content);
          if (Array.isArray(data) && data.some((u: any) => u.UnitName && Array.isArray(u.Joints))) {
            jointsJsonPath = jsonPath;
            break;
          }
        } catch {
          continue;
        }
      }
    }

    if (!jointsJsonPath) {
      console.warn(`[FordFidesAdapter] No valid Ford Fides JSON found in aux files`);
      return [];
    }

    const raw = JSON.parse(fs.readFileSync(jointsJsonPath, 'utf8')) as unknown;
    if (!Array.isArray(raw)) {
      console.warn('[FordFidesAdapter] Joint JSON is not an array of units');
      return [];
    }

    const rawUnits = raw as RawFidesUnit[];
    const joints: KinematicJoint[] = [];
    let jointIdCounter = 0;

    rawUnits.forEach(unit => {
      unit.Joints?.forEach(rawJoint => {
        const clusterId = this.findClusterForNodeId(rawJoint.NodeId, model);
        if (!clusterId) {
          console.warn(`[FordFidesAdapter] Could not find cluster for NodeId: ${rawJoint.NodeId}`);
          return;
        }

        // For now, assume parent is base (link_0) - this will be refined by unit builder
        // We need to find the actual parent cluster from the joint structure
        const parentClusterId = this.findParentCluster(clusterId, model);

        const from = rawJoint.FromVector;
        const to = rawJoint.ToVector;
        const axis: [number, number, number] = [
          to.X - from.X,
          to.Y - from.Y,
          to.Z - from.Z,
        ];
        const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
        if (len > 1e-8) {
          axis[0] /= len;
          axis[1] /= len;
          axis[2] /= len;
        }

        const type: KinematicJoint['type'] =
          rawJoint.Type === 0
            ? 'prismatic'
            : rawJoint.Type === 1
            ? 'revolute'
            : 'fixed';

        const joint: KinematicJoint = {
          id: `joint_${jointIdCounter++}`,
          type,
          parentClusterId,
          childClusterId: clusterId,
          axis,
          origin: [from.X, from.Y, from.Z],
          min: rawJoint.MinValue,
          max: rawJoint.MaxValue,
        };

        joints.push(joint);
      });
    });

    return joints;
  }

  private findClusterForNodeId(_nodeId: string, model: MechanicalModel): string | null {
    // Try to find a cluster that contains a node matching this path
    // This is a simplified lookup - in practice, we'd need to map node paths to clusters
    // For now, return the first cluster that might match
    // This will be refined when we have better node-to-cluster mapping
    if (model.clusters.length === 0) return null;
    
    // Placeholder: return first cluster
    // TODO: Implement proper node path to cluster mapping
    return model.clusters[0]?.id ?? null;
  }

  private findParentCluster(_childClusterId: string, model: MechanicalModel): string {
    // For now, assume base cluster is the one with type 'base' or the largest cluster
    // This will be refined by the unit builder
    const baseCluster = model.clusters.find(c => c.id === 'base_0') ?? model.clusters[0];
    return baseCluster?.id ?? 'base_0';
  }
}

/**
 * TMS/NX joint adapter (placeholder).
 * 
 * Returns empty list until we have a concrete NX export format.
 */
export class TmsNxJointAdapter implements JointAdapter {
  id = 'tms_nx';

  canHandle(_meta: ToolingMetadata): boolean {
    // TODO: Implement detection logic when we have TMS/NX format examples
    // Could check for specific file extensions, structure patterns, etc.
    return false;
  }

  async loadJoints(_meta: ToolingMetadata, _model: MechanicalModel): Promise<KinematicJoint[]> {
    console.warn('[TmsNxAdapter] Not yet implemented');
    return [];
  }
}

// Ford Fides JSON types (internal)
type RawFidesJoint = {
  Name: string;
  ElectricalName: string;
  NodeId: string;
  HideId: string;
  Type: number; // 0 = prismatic, 1 = revolute
  MaxValue: number;
  MinValue: number;
  ToVector: { X: number; Y: number; Z: number };
  FromVector: { X: number; Y: number; Z: number };
  TransformationMatrix: string[];
};

type RawFidesUnit = {
  UnitName: string;
  Joints: RawFidesJoint[];
};

