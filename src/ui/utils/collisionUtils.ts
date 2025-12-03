/**
 * Collision Detection Utilities
 * Provides helpers for Rapier-based collision checking
 */

import * as BABYLON from '@babylonjs/core';
import { PhysicsManager } from '../../physics/PhysicsManager';

/**
 * Extract vertices from a Babylon mesh in world space
 */
export function extractWorldVertices(mesh: BABYLON.Mesh): Float32Array | null {
  const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);

  if (!positions) {
    console.warn(`[CollisionUtils] Mesh ${mesh.name} has no vertex data`);
    return null;
  }

  // Ensure world matrix is up to date
  mesh.computeWorldMatrix(true);
  const worldMatrix = mesh.getWorldMatrix();

  // Transform vertices to world space
  const worldPositions = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    const localVertex = new BABYLON.Vector3(
      positions[i],
      positions[i + 1],
      positions[i + 2]
    );

    const worldVertex = BABYLON.Vector3.TransformCoordinates(localVertex, worldMatrix);

    worldPositions[i] = worldVertex.x;
    worldPositions[i + 1] = worldVertex.y;
    worldPositions[i + 2] = worldVertex.z;
  }

  return worldPositions;
}

/**
 * Create a Rapier convex collider from a Babylon mesh
 * @returns Collider handle or null if failed
 */
export function createColliderFromMesh(mesh: BABYLON.Mesh): string | null {
  const physicsEngine = PhysicsManager.getInstance().getCurrentEngine();

  if (!physicsEngine) {
    console.warn('[CollisionUtils] Physics engine not initialized');
    return null;
  }

  // Extract world-space vertices
  const vertices = extractWorldVertices(mesh);
  if (!vertices) return null;

  // Ensure world matrix is up to date
  mesh.computeWorldMatrix(true);

  try {
    // Create convex hull collider at origin (vertices are already in world space)
    const colliderHandle = physicsEngine.createConvexCollider(
      vertices,
      { x: 0, y: 0, z: 0 }, // Origin since vertices are in world space
      { x: 0, y: 0, z: 0, w: 1 } // Identity rotation
    );

    return colliderHandle;
  } catch (error) {
    console.error(`[CollisionUtils] Failed to create collider for mesh ${mesh.name}:`, error);
    return null;
  }
}

/**
 * Check collision between two meshes using Rapier
 * Uses hybrid approach: AABB broad-phase + Rapier narrow-phase
 *
 * @param meshA First mesh
 * @param meshB Second mesh
 * @param useBroadPhase If true, performs AABB check first (faster)
 * @returns True if meshes collide
 */
export function checkMeshCollision(
  meshA: BABYLON.Mesh,
  meshB: BABYLON.Mesh,
  useBroadPhase: boolean = true
): boolean {
  const physicsEngine = PhysicsManager.getInstance().getCurrentEngine();

  if (!physicsEngine) {
    console.warn('[CollisionUtils] Physics engine not initialized');
    return false;
  }

  // Broad-phase: Quick AABB check
  if (useBroadPhase) {
    if (!meshA.intersectsMesh(meshB, false)) {
      return false; // No AABB overlap, definitely no collision
    }
  }

  // Narrow-phase: Create temporary colliders and test
  const colliderA = createColliderFromMesh(meshA);
  const colliderB = createColliderFromMesh(meshB);

  if (!colliderA || !colliderB) {
    // Cleanup any created colliders
    if (colliderA) physicsEngine.disposeCollider(colliderA);
    if (colliderB) physicsEngine.disposeCollider(colliderB);
    return false;
  }

  // Test collision
  const collision = physicsEngine.testColliderIntersection(colliderA, colliderB);

  // Cleanup
  physicsEngine.disposeCollider(colliderA);
  physicsEngine.disposeCollider(colliderB);

  return collision;
}

/**
 * Batch collision check between two groups of meshes
 * Optimized with broad-phase filtering
 *
 * @param meshesA First group of meshes
 * @param meshesB Second group of meshes
 * @returns Array of collision pairs [indexA, indexB, meshA, meshB]
 */
export async function batchCollisionCheck(
  meshesA: BABYLON.Mesh[],
  meshesB: BABYLON.Mesh[]
): Promise<Array<{ indexA: number; indexB: number; meshA: BABYLON.Mesh; meshB: BABYLON.Mesh }>> {
  const callId = Math.random().toString(36).substring(7);
  console.log(`[CollisionUtils #${callId}] Starting batch check: Group A (${meshesA.length} meshes) vs Group B (${meshesB.length} meshes)`);

  let physicsEngine;
  let engineType;

  try {
    const physicsManager = PhysicsManager.getInstance();
    physicsEngine = physicsManager.getCurrentEngine();
    engineType = physicsManager.getCurrentEngineType();

    console.log(`[CollisionUtils #${callId}] Current engine type: ${engineType}, engine exists: ${!!physicsEngine}`);

    // If physics engine not initialized, initialize Rapier automatically
    if (!physicsEngine) {
      console.log(`[CollisionUtils #${callId}] Physics engine not initialized, initializing Rapier...`);
      try {
        await physicsManager.switchEngine('rapier');
        physicsEngine = physicsManager.getCurrentEngine();
        engineType = physicsManager.getCurrentEngineType();
        console.log(`[CollisionUtils #${callId}] Rapier physics engine initialized successfully`);
      } catch (initError) {
        console.error(`[CollisionUtils #${callId}] Failed to initialize Rapier physics engine:`, initError);
        return [];
      }
    }

    // Double-check engine is now available
    if (!physicsEngine) {
      console.error(`[CollisionUtils #${callId}] Physics engine still null after initialization attempt`);
      return [];
    }

    // Verify we're using Rapier
    if (engineType !== 'rapier') {
      console.error(`[CollisionUtils #${callId}] Wrong physics engine! Expected 'rapier', got '${engineType}'`);
      console.error(`[CollisionUtils #${callId}] Collision checking requires Rapier physics engine`);
      return [];
    }

    console.log(`[CollisionUtils #${callId}] Physics engine ready: ${engineType}`);
  } catch (error) {
    console.error(`[CollisionUtils #${callId}] Error initializing physics engine:`, error);
    return [];
  }

  const collisions: Array<{
    indexA: number;
    indexB: number;
    meshA: BABYLON.Mesh;
    meshB: BABYLON.Mesh;
  }> = [];

  // Step 1: Broad-phase - find potential collision pairs using AABB
  const potentialPairs: Array<[number, number]> = [];

  for (let i = 0; i < meshesA.length; i++) {
    for (let j = 0; j < meshesB.length; j++) {
      // Ensure world matrices are computed
      meshesA[i].computeWorldMatrix(true);
      meshesB[j].computeWorldMatrix(true);

      if (meshesA[i].intersectsMesh(meshesB[j], false)) {
        potentialPairs.push([i, j]);
        console.log(`[CollisionUtils] AABB overlap: ${meshesA[i].name} <-> ${meshesB[j].name}`);
      }
    }
  }

  console.log(`[CollisionUtils] Broad-phase: ${potentialPairs.length}/${meshesA.length * meshesB.length} potential collisions`);

  // Step 2: Create colliders for unique meshes involved in potential collisions
  const colliderMapA = new Map<number, string>();
  const colliderMapB = new Map<number, string>();

  console.log(`[CollisionUtils] Creating colliders for ${potentialPairs.length} potential pairs...`);

  for (const [i, j] of potentialPairs) {
    if (!colliderMapA.has(i)) {
      const collider = createColliderFromMesh(meshesA[i]);
      if (collider) {
        colliderMapA.set(i, collider);
        console.log(`[CollisionUtils] Created collider for Group A mesh: ${meshesA[i].name}`);
      } else {
        console.warn(`[CollisionUtils] Failed to create collider for Group A mesh: ${meshesA[i].name}`);
      }
    }

    if (!colliderMapB.has(j)) {
      const collider = createColliderFromMesh(meshesB[j]);
      if (collider) {
        colliderMapB.set(j, collider);
        console.log(`[CollisionUtils] Created collider for Group B mesh: ${meshesB[j].name}`);
      } else {
        console.warn(`[CollisionUtils] Failed to create collider for Group B mesh: ${meshesB[j].name}`);
      }
    }
  }

  console.log(`[CollisionUtils] Created ${colliderMapA.size} colliders for Group A, ${colliderMapB.size} colliders for Group B`);

  // Step 3: Narrow-phase - test actual collisions
  console.log(`[CollisionUtils] Testing ${potentialPairs.length} pairs with Rapier...`);

  for (const [i, j] of potentialPairs) {
    const colliderA = colliderMapA.get(i);
    const colliderB = colliderMapB.get(j);

    if (colliderA && colliderB) {
      const intersects = physicsEngine.testColliderIntersection(colliderA, colliderB);
      console.log(`[CollisionUtils] Testing ${meshesA[i].name} vs ${meshesB[j].name}: ${intersects ? 'COLLISION' : 'no collision'}`);

      if (intersects) {
        collisions.push({
          indexA: i,
          indexB: j,
          meshA: meshesA[i],
          meshB: meshesB[j],
        });
      }
    } else {
      console.warn(`[CollisionUtils] Missing colliders for pair [${i},${j}]: A=${!!colliderA}, B=${!!colliderB}`);
    }
  }

  // Step 4: Cleanup all colliders
  for (const collider of colliderMapA.values()) {
    physicsEngine.disposeCollider(collider);
  }
  for (const collider of colliderMapB.values()) {
    physicsEngine.disposeCollider(collider);
  }

  console.log(`[CollisionUtils] Narrow-phase: ${collisions.length} confirmed collisions`);

  return collisions;
}
