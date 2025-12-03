/**
 * Collision Detection Utilities
 * Provides helpers for Rapier-based collision checking
 */

import * as BABYLON from '@babylonjs/core';
import { PhysicsManager } from '../../physics/PhysicsManager';

// Hard caps to keep the UI responsive when meshes are dense or pair counts explode
const MAX_COLLIDER_VERTICES = 800;
const MAX_POTENTIAL_PAIRS = 1000;

/**
 * Extract vertices from a Babylon mesh in world space
 */
export function extractWorldVertices(mesh: BABYLON.Mesh, maxVertices = MAX_COLLIDER_VERTICES): Float32Array | null {
  const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);

  if (!positions) {
    console.warn(`[CollisionUtils] Mesh ${mesh.name} has no vertex data`);
    return null;
  }

  const vertexCount = positions.length / 3;
  const needsDownsample = vertexCount > maxVertices;
  const stride = needsDownsample ? Math.ceil(vertexCount / maxVertices) : 1;
  const finalCount = needsDownsample ? Math.min(maxVertices, Math.ceil(vertexCount / stride)) : vertexCount;

  // Ensure world matrix is up to date
  mesh.computeWorldMatrix(true);
  const worldMatrix = mesh.getWorldMatrix();

  // Transform vertices to world space
  const worldPositions = new Float32Array(finalCount * 3);

  let writeIndex = 0;
  for (let i = 0; i < vertexCount; i += stride) {
    const base = i * 3;
    const localVertex = new BABYLON.Vector3(
      positions[base],
      positions[base + 1],
      positions[base + 2]
    );

    const worldVertex = BABYLON.Vector3.TransformCoordinates(localVertex, worldMatrix);

    worldPositions[writeIndex] = worldVertex.x;
    worldPositions[writeIndex + 1] = worldVertex.y;
    worldPositions[writeIndex + 2] = worldVertex.z;
    writeIndex += 3;

    if (writeIndex >= worldPositions.length) break;
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
      console.log(`[CollisionUtils #${callId}] This may take a few seconds for WASM initialization...`);
      try {
        // switchEngine is a no-op when engineType already matches, so initialize explicitly
        const initStart = performance.now();
        await physicsManager.initialize({ type: 'rapier' });
        const initEnd = performance.now();
        console.log(`[CollisionUtils #${callId}] Rapier WASM initialized in ${(initEnd - initStart).toFixed(0)}ms`);

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

  // Helper function to yield to event loop periodically
  const yieldToEventLoop = () => new Promise(resolve => setTimeout(resolve, 0));

  // Step 1: Broad-phase - find potential collision pairs using AABB
  console.log(`[CollisionUtils #${callId}] Starting broad-phase AABB checks...`);
  const broadPhaseStart = performance.now();
  const potentialPairs: Array<[number, number]> = [];

  for (let i = 0; i < meshesA.length; i++) {
    // Yield every 5 meshes to keep UI responsive
    if (i % 5 === 0 && i > 0) {
      await yieldToEventLoop();
    }

    for (let j = 0; j < meshesB.length; j++) {
      // Ensure world matrices are computed
      meshesA[i].computeWorldMatrix(true);
      meshesB[j].computeWorldMatrix(true);

      if (meshesA[i].intersectsMesh(meshesB[j], false)) {
        potentialPairs.push([i, j]);

        // Only log first few overlaps to avoid console spam
        if (potentialPairs.length <= 10) {
          console.log(`[CollisionUtils #${callId}] AABB overlap: ${meshesA[i].name} <-> ${meshesB[j].name}`);
        }

        // Prevent pathological O(n^2) blowups from freezing the UI
        if (potentialPairs.length >= MAX_POTENTIAL_PAIRS) {
          console.warn(`[CollisionUtils #${callId}] Potential pairs capped at ${MAX_POTENTIAL_PAIRS}; skipping remaining pairs to stay responsive.`);
          break;
        }
      }
    }
    if (potentialPairs.length >= MAX_POTENTIAL_PAIRS) {
      break;
    }
  }

  const broadPhaseEnd = performance.now();
  console.log(`[CollisionUtils #${callId}] Broad-phase: ${potentialPairs.length}/${meshesA.length * meshesB.length} potential collisions (${(broadPhaseEnd - broadPhaseStart).toFixed(0)}ms)`);

  if (potentialPairs.length === 0) {
    console.log(`[CollisionUtils #${callId}] No potential collisions found, skipping narrow-phase`);
    return [];
  }

  // Step 2: Create colliders for unique meshes involved in potential collisions
  const colliderMapA = new Map<number, string>();
  const colliderMapB = new Map<number, string>();

  console.log(`[CollisionUtils #${callId}] Creating colliders for ${potentialPairs.length} potential pairs...`);
  const colliderCreationStart = performance.now();

  let pairIndex = 0;
  for (const [i, j] of potentialPairs) {
    // Yield BEFORE each collider creation to keep UI responsive
    // Collider creation is CPU-intensive and can block for 100-500ms per mesh
    await yieldToEventLoop();
    pairIndex++;

    if (!colliderMapA.has(i)) {
      try {
        console.log(`[CollisionUtils #${callId}] Creating collider ${colliderMapA.size + 1} for Group A: ${meshesA[i].name}`);
        const collider = createColliderFromMesh(meshesA[i]);
        if (collider) {
          colliderMapA.set(i, collider);
        } else {
          console.warn(`[CollisionUtils #${callId}] Failed to create collider for Group A mesh: ${meshesA[i].name}`);
        }
      } catch (error) {
        console.error(`[CollisionUtils #${callId}] Exception creating collider for Group A mesh ${meshesA[i].name}:`, error);
      }
    }

    if (!colliderMapB.has(j)) {
      try {
        console.log(`[CollisionUtils #${callId}] Creating collider ${colliderMapB.size + 1} for Group B: ${meshesB[j].name}`);
        const collider = createColliderFromMesh(meshesB[j]);
        if (collider) {
          colliderMapB.set(j, collider);
        } else {
          console.warn(`[CollisionUtils #${callId}] Failed to create collider for Group B mesh: ${meshesB[j].name}`);
        }
      } catch (error) {
        console.error(`[CollisionUtils #${callId}] Exception creating collider for Group B mesh ${meshesB[j].name}:`, error);
      }
    }
  }

  const colliderCreationEnd = performance.now();
  console.log(`[CollisionUtils #${callId}] Created ${colliderMapA.size} colliders for Group A, ${colliderMapB.size} colliders for Group B (${(colliderCreationEnd - colliderCreationStart).toFixed(0)}ms)`);

  // Step 3: Narrow-phase - test actual collisions
  console.log(`[CollisionUtils #${callId}] Testing ${potentialPairs.length} pairs with Rapier...`);
  const intersectionTestStart = performance.now();

  let testIndex = 0;
  for (const [i, j] of potentialPairs) {
    // Yield every 10 intersection tests to keep UI responsive
    if (testIndex % 10 === 0 && testIndex > 0) {
      await yieldToEventLoop();
    }
    testIndex++;

    const colliderA = colliderMapA.get(i);
    const colliderB = colliderMapB.get(j);

    if (colliderA && colliderB) {
      const intersects = physicsEngine.testColliderIntersection(colliderA, colliderB);

      if (intersects) {
        console.log(`[CollisionUtils #${callId}] COLLISION: ${meshesA[i].name} vs ${meshesB[j].name}`);
        collisions.push({
          indexA: i,
          indexB: j,
          meshA: meshesA[i],
          meshB: meshesB[j],
        });
      }
    } else {
      console.warn(`[CollisionUtils #${callId}] Missing colliders for pair [${i},${j}]: A=${!!colliderA}, B=${!!colliderB}`);
    }
  }

  const intersectionTestEnd = performance.now();

  // Step 4: Cleanup all colliders
  console.log(`[CollisionUtils #${callId}] Cleaning up ${colliderMapA.size + colliderMapB.size} temporary colliders...`);
  for (const collider of colliderMapA.values()) {
    physicsEngine.disposeCollider(collider);
  }
  for (const collider of colliderMapB.values()) {
    physicsEngine.disposeCollider(collider);
  }

  console.log(`[CollisionUtils #${callId}] Narrow-phase complete: ${collisions.length} confirmed collisions (${(intersectionTestEnd - intersectionTestStart).toFixed(0)}ms)`);
  console.log(`[CollisionUtils #${callId}] Total time: ${(intersectionTestEnd - broadPhaseStart).toFixed(0)}ms`);

  return collisions;
}
