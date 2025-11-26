/**
 * Tooling Test Helper - DEV/TEST ONLY
 *
 * Provides programmatic access to app internals for E2E testing with Playwright.
 * This module should NEVER be included in production builds.
 *
 * Usage in Playwright tests:
 * ```ts
 * const helper = await page.evaluate(() => {
 *   const win = window as any;
 *   if (!win.__ToolingTestHelper__) throw new Error('Test helper not available');
 *   return win.__ToolingTestHelper__;
 * });
 * ```
 */

import type { Scene } from '@babylonjs/core';
import type { KinematicsManager } from '../kinematics/KinematicsManager';
import { ForwardKinematicsSolver } from '../kinematics/ForwardKinematicsSolver';

export interface ToolingTestHelper {
  /**
   * U112-specific test helpers for the GOLD fixture (single-hinge)
   */
  u112: {
    /**
     * Move U112 clamp (UNIT_112) to extended pose (~90° rotation)
     */
    setExtendedPose(): Promise<void>;

    /**
     * Load U112 fixture with auto-fitted joints (shortcut for testing Motion Panel)
     */
    loadAutoFittedState(): Promise<void>;

    /**
     * Get current transform of U112 clamp for assertions
     */
    getClampTransform(): Promise<{ position: number[]; rotation: number[] }>;
  };

  /**
   * 016ZF multi-hinge test helpers (4 clamps, 4 hinges)
   */
  multiHinge: {
    /**
     * Get count of detected moving units
     */
    getMovingUnitCount(): number;

    /**
     * Get count of registered hinge joints
     */
    getHingeJointCount(): number;

    /**
     * Set all clamps to extended pose (for state capture)
     */
    setAllClampsExtended(): Promise<void>;

    /**
     * Set all clamps to retracted pose (home position)
     */
    setAllClampsRetracted(): Promise<void>;

    /**
     * Set a specific clamp to a normalized position (0 = retracted, 1 = extended)
     * @param unitIndex Zero-based index of the clamp (0-3)
     * @param normalized Normalized position (0.0 to 1.0)
     */
    setClampPosition(unitIndex: number, normalized: number): Promise<void>;

    /**
     * Get transforms for all clamps for assertions
     */
    getAllClampTransforms(): Promise<Array<{
      unitId: string;
      position: number[];
      rotation: number[];
    }>>;

    /**
     * Get all fitted joint info for assertions
     */
    getJointInfo(): Array<{
      id: string;
      name: string;
      type: string;
      angleDeg: number;
      angleRad: number;
    }>;
  };

  /**
   * Generic fixture helpers (scaffold for future use)
   */
  fixtures: {
    /**
     * List all currently loaded fixture root names
     */
    listLoadedFixtures(): string[];

    /**
     * Get info about a specific fixture
     */
    getFixtureInfo(rootName: string): unknown;
  };
}

interface AttachParams {
  scene: Scene;
  kinematicsManager: KinematicsManager;
}

/**
 * Attach the test helper to window (dev/test only)
 */
export function attachToolingTestHelper(params: AttachParams): void {
  // Guard: Only run in browser environment
  if (typeof window === 'undefined') {
    return;
  }

  const anyWindow = window as unknown as {
    __ToolingTestHelper__?: ToolingTestHelper;
  };

  // Guard: Don't attach twice
  if (anyWindow.__ToolingTestHelper__) {
    return;
  }

  const { scene, kinematicsManager } = params;

  const helper: ToolingTestHelper = {
    u112: {
      async setExtendedPose() {
        // Guard: Check if U112 fixture is loaded
        const u112Clamp = scene.getTransformNodeByName('UNIT_112');
        if (!u112Clamp) {
          console.warn('[TestHelper] U112 clamp (UNIT_112) not found in scene');
          return;
        }

        // Try to use fitted joint if available
        const toolingChains = kinematicsManager.getToolingChains();
        const u112Chain = toolingChains.find(chain =>
          chain.joints.some(j => j.name === 'UNIT_112' || j.childNodeId === 'UNIT_112')
        );

        if (u112Chain) {
          // Joint-based motion (if already fitted)
          const hingeJoint = u112Chain.joints.find(j =>
            j.type === 'revolute' && (j.name === 'UNIT_112' || j.childNodeId === 'UNIT_112')
          );

          if (hingeJoint) {
            // Set to max angle (extended pose) using FK solver
            const maxAngle = hingeJoint.limits.upper; // Already in radians
            const fkSolver = ForwardKinematicsSolver.getInstance();
            fkSolver.updateJointPosition(hingeJoint.id, maxAngle);
            console.log('[TestHelper] Set U112 joint to extended pose:', maxAngle, 'rad');
            return;
          }
        }

        // Fallback: Direct transform manipulation (for pipeline test before fit)
        // U112 hinge is typically around Y axis, rotate ~90° = π/2
        const currentRotation = u112Clamp.rotation.clone();
        u112Clamp.rotation.y = currentRotation.y + Math.PI / 2;

        console.log('[TestHelper] Set U112 transform to extended pose (direct rotation)');
      },

      async loadAutoFittedState() {
        console.warn('[TestHelper] loadAutoFittedState() not fully implemented');
        console.warn('[TestHelper] Use full UI workflow (Analyze → Capture → Fit) instead');

        // For now, this is a placeholder
        // A full implementation would need to:
        // 1. Load U112 fixture if not loaded
        // 2. Run auto-fit pipeline programmatically
        // 3. Register results with KinematicsManager

        // Guard: Check if already loaded
        const u112Root = scene.getTransformNodeByName('UNIT_101') || scene.getTransformNodeByName('UNIT_112');
        if (!u112Root) {
          throw new Error('U112 fixture not loaded. Load it first via UI or test setup.');
        }

        // Guard: Check if already fitted
        const toolingChains = kinematicsManager.getToolingChains();
        if (toolingChains.length > 0) {
          console.log('[TestHelper] Tooling chains already registered, assuming fitted state');
          return;
        }

        throw new Error('loadAutoFittedState() requires manual UI workflow for now');
      },

      async getClampTransform() {
        // Guard: Check if U112 clamp exists
        const u112Clamp = scene.getTransformNodeByName('UNIT_112');
        if (!u112Clamp) {
          console.warn('[TestHelper] U112 clamp (UNIT_112) not found');
          return { position: [], rotation: [] };
        }

        const pos = u112Clamp.getAbsolutePosition();

        // Get rotation as Euler angles (in radians)
        const rotation = u112Clamp.rotationQuaternion
          ? u112Clamp.rotationQuaternion.toEulerAngles()
          : u112Clamp.rotation;

        return {
          position: [pos.x, pos.y, pos.z],
          rotation: [rotation.x, rotation.y, rotation.z],
        };
      },
    },

    multiHinge: {
      getMovingUnitCount() {
        // Count nodes matching UNIT_1XX pattern (excluding UNIT_101 which is typically fixed)
        const unitNodes = scene.transformNodes.filter(node => {
          const name = node.name;
          if (!name.startsWith('UNIT_')) return false;
          // Skip UNIT_101 (fixed base)
          if (name === 'UNIT_101') return false;
          return true;
        });
        return unitNodes.length;
      },

      getHingeJointCount() {
        const toolingChains = kinematicsManager.getToolingChains();
        let count = 0;
        for (const chain of toolingChains) {
          count += chain.joints.filter(j => j.type === 'revolute').length;
        }
        return count;
      },

      async setAllClampsExtended() {
        const fkSolver = ForwardKinematicsSolver.getInstance();
        const toolingChains = kinematicsManager.getToolingChains();

        for (const chain of toolingChains) {
          for (const joint of chain.joints) {
            if (joint.type !== 'revolute') continue;
            // Set to upper limit (extended)
            fkSolver.updateJointPosition(joint.id, joint.limits.upper);
          }
        }

        console.log('[TestHelper] Set all clamps to extended pose');
      },

      async setAllClampsRetracted() {
        const fkSolver = ForwardKinematicsSolver.getInstance();
        const toolingChains = kinematicsManager.getToolingChains();

        for (const chain of toolingChains) {
          for (const joint of chain.joints) {
            if (joint.type !== 'revolute') continue;
            // Set to lower limit (retracted)
            fkSolver.updateJointPosition(joint.id, joint.limits.lower);
          }
        }

        console.log('[TestHelper] Set all clamps to retracted pose');
      },

      async setClampPosition(unitIndex: number, normalized: number) {
        const toolingChains = kinematicsManager.getToolingChains();
        const fkSolver = ForwardKinematicsSolver.getInstance();

        // Guard: clamp normalized to 0-1 range
        const clamped = Math.max(0, Math.min(1, normalized));

        // Collect all revolute joints
        const allHinges: typeof toolingChains[0]['joints'] = [];
        for (const chain of toolingChains) {
          for (const joint of chain.joints) {
            if (joint.type === 'revolute') {
              allHinges.push(joint);
            }
          }
        }

        // Guard: Index out of range
        if (unitIndex < 0 || unitIndex >= allHinges.length) {
          console.warn('[TestHelper] setClampPosition: unitIndex out of range', {
            unitIndex,
            maxIndex: allHinges.length - 1,
          });
          return;
        }

        const joint = allHinges[unitIndex];
        const range = joint.limits.upper - joint.limits.lower;
        const targetValue = joint.limits.lower + clamped * range;
        fkSolver.updateJointPosition(joint.id, targetValue);

        console.log('[TestHelper] Set clamp', unitIndex, 'to', (clamped * 100).toFixed(0) + '%');
      },

      async getAllClampTransforms() {
        const results: Array<{
          unitId: string;
          position: number[];
          rotation: number[];
        }> = [];

        // Find all UNIT_* nodes (excluding UNIT_101)
        const unitNodes = scene.transformNodes.filter(node => {
          const name = node.name;
          if (!name.startsWith('UNIT_')) return false;
          if (name === 'UNIT_101') return false;
          return true;
        });

        for (const node of unitNodes) {
          const pos = node.getAbsolutePosition();
          const rotation = node.rotationQuaternion
            ? node.rotationQuaternion.toEulerAngles()
            : node.rotation;

          results.push({
            unitId: node.name,
            position: [pos.x, pos.y, pos.z],
            rotation: [rotation.x, rotation.y, rotation.z],
          });
        }

        return results;
      },

      getJointInfo() {
        const toolingChains = kinematicsManager.getToolingChains();
        const results: Array<{
          id: string;
          name: string;
          type: string;
          angleDeg: number;
          angleRad: number;
        }> = [];

        for (const chain of toolingChains) {
          for (const joint of chain.joints) {
            if (joint.type !== 'revolute' && joint.type !== 'prismatic') continue;
            results.push({
              id: joint.id,
              name: joint.name,
              type: joint.type,
              angleDeg: joint.type === 'revolute' ? (joint.position * 180) / Math.PI : 0,
              angleRad: joint.position,
            });
          }
        }

        return results;
      },
    },

    fixtures: {
      listLoadedFixtures() {
        // Get all root transform nodes (nodes without parents)
        const rootNodes = scene.transformNodes.filter(node => !node.parent);

        // Filter to probable fixtures (not camera, ground, etc.)
        const fixtureNodes = rootNodes.filter(node => {
          const name = node.name.toLowerCase();
          // Skip common non-fixture nodes
          if (name.includes('camera')) return false;
          if (name.includes('light')) return false;
          if (name.includes('ground')) return false;
          if (name.includes('__root__')) return false;
          return true;
        });

        return fixtureNodes.map(node => node.name);
      },

      getFixtureInfo(rootName: string) {
        const rootNode = scene.getTransformNodeByName(rootName);
        if (!rootNode) {
          return null;
        }

        // Basic fixture info
        const info = {
          name: rootNode.name,
          id: rootNode.id,
          childCount: rootNode.getChildren().length,
          position: rootNode.position.asArray(),
          rotation: rootNode.rotation.asArray(),
        };

        return info;
      },
    },
  };

  // Attach to window
  anyWindow.__ToolingTestHelper__ = helper;
  console.log('[TestHelper] ✅ __ToolingTestHelper__ attached to window (dev/test mode)');
}
