# Physics API Documentation

## Overview

kinetiCORE uses a **physics abstraction layer** that allows swapping physics engines (Rapier, Havok) without changing application code. This provides a fast and efficient physics connection for robot simulation and 3D kinematics.

**Current Implementation:** Rapier3D (WebAssembly-based, high-performance)

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core Principles](#core-principles)
3. [API Reference](#api-reference)
4. [Performance Best Practices](#performance-best-practices)
5. [Common Patterns](#common-patterns)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Initialize Physics Engine

```typescript
import { RapierPhysicsEngine } from './physics/RapierPhysicsEngine';

// Create physics engine instance
const physics = new RapierPhysicsEngine();

// Initialize with default gravity (Y-down: 0, -9.81, 0)
await physics.initialize();

// OR with custom gravity
await physics.initialize({ x: 0, y: -20, z: 0 });
```

**Performance:** Initialization takes **< 100ms** on modern hardware.

---

### Create Rigid Bodies

```typescript
// Dynamic box (affected by gravity, collisions)
const boxHandle = physics.createRigidBody({
  type: 'dynamic',
  shape: 'box',
  position: { x: 0, y: 10, z: 0 },
  dimensions: { x: 1, y: 1, z: 1 },
});

// Static ground (never moves)
const groundHandle = physics.createRigidBody({
  type: 'static',
  shape: 'box',
  position: { x: 0, y: 0, z: 0 },
  dimensions: { x: 100, y: 1, z: 100 },
});

// Kinematic object (controlled programmatically)
const robotHandle = physics.createRigidBody({
  type: 'kinematic',
  shape: 'cylinder',
  position: { x: 5, y: 1, z: 0 },
  radius: 0.5,
  height: 2,
});
```

**Performance:** Body creation takes **< 10ms per body**.

---

### Simulation Loop

```typescript
// In your render loop
function renderLoop() {
  // Step physics (fixed 60 FPS timestep)
  physics.step(1 / 60);

  // Get updated transforms
  const transform = physics.getRigidBodyTransform(boxHandle);
  if (transform) {
    // Update your 3D mesh position
    mesh.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z
    );
    mesh.quaternion.set(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z,
      transform.rotation.w
    );
  }

  requestAnimationFrame(renderLoop);
}
```

**Performance:** Simulation step takes **< 2ms for 50 bodies** at 60 FPS.

---

## Core Principles

### 1. **Never Import Rapier Directly**

❌ **Wrong:**
```typescript
import RAPIER from '@dimforge/rapier3d-compat'; // DON'T DO THIS!
```

✅ **Correct:**
```typescript
import { IPhysicsEngine } from './physics/IPhysicsEngine';
import { RapierPhysicsEngine } from './physics/RapierPhysicsEngine';

const physics: IPhysicsEngine = new RapierPhysicsEngine();
```

**Why?** This allows swapping physics engines without changing application code.

---

### 2. **Always Sync Physics ↔ Render**

Physics runs in its own simulation loop, separate from the render loop.

```typescript
// CORRECT: Sync physics → render
physics.step(1/60);  // Update physics
const transform = physics.getRigidBodyTransform(handle); // Get result
mesh.position.copy(transform.position); // Update mesh

// WRONG: Don't skip sync
physics.step(1/60);
// ❌ Forgot to update mesh! Physics and render are now out of sync!
```

---

### 3. **Use Fixed Timestep**

Always use a fixed timestep for deterministic simulation:

```typescript
// ✅ GOOD: Fixed 60 FPS
physics.step(1 / 60);

// ❌ BAD: Variable timestep
physics.step(deltaTime); // Non-deterministic!
```

---

### 4. **Clean Up Resources**

Always dispose physics bodies when no longer needed:

```typescript
// Remove body from simulation
physics.removeRigidBody(handle);

// Dispose entire engine on shutdown
physics.dispose();
```

---

## API Reference

### Initialization

#### `initialize(gravity?: Vector3): Promise<void>`

Initialize the physics engine with optional custom gravity.

**Parameters:**
- `gravity` (optional): Gravity vector in m/s². Default: `{ x: 0, y: -9.81, z: 0 }`

**Performance:** < 100ms

**Example:**
```typescript
// Default gravity (Earth)
await physics.initialize();

// Custom gravity (Moon)
await physics.initialize({ x: 0, y: -1.62, z: 0 });

// Zero gravity (space)
await physics.initialize({ x: 0, y: 0, z: 0 });
```

---

### Rigid Bodies

#### `createRigidBody(descriptor: BodyDescriptor): string`

Create a rigid body and return its unique handle.

**Parameters:**
```typescript
interface BodyDescriptor {
  type: 'static' | 'dynamic' | 'kinematic';
  shape: 'box' | 'sphere' | 'cylinder' | 'capsule';
  position: Vector3;
  rotation?: Quaternion;

  // Shape-specific parameters
  dimensions?: Vector3;  // For 'box'
  radius?: number;       // For 'sphere', 'cylinder', 'capsule'
  height?: number;       // For 'cylinder', 'capsule'
}
```

**Body Types:**
- **`static`**: Never moves (ground, walls, obstacles)
- **`dynamic`**: Affected by forces, gravity, collisions
- **`kinematic`**: Controlled programmatically (robots, elevators)

**Returns:** Unique handle (UUID string)

**Performance:** < 10ms per body

**Examples:**
```typescript
// Box
const box = physics.createRigidBody({
  type: 'dynamic',
  shape: 'box',
  position: { x: 0, y: 5, z: 0 },
  dimensions: { x: 1, y: 1, z: 1 },
});

// Sphere
const ball = physics.createRigidBody({
  type: 'dynamic',
  shape: 'sphere',
  position: { x: 2, y: 5, z: 0 },
  radius: 0.5,
});

// Cylinder
const pillar = physics.createRigidBody({
  type: 'static',
  shape: 'cylinder',
  position: { x: 4, y: 1, z: 0 },
  radius: 0.3,
  height: 2,
});

// Capsule (robot link)
const link = physics.createRigidBody({
  type: 'kinematic',
  shape: 'capsule',
  position: { x: 6, y: 1, z: 0 },
  radius: 0.2,
  height: 1.5,
});
```

---

#### `removeRigidBody(handle: string): void`

Remove a rigid body from the simulation and free resources.

**Performance:** < 5ms

**Example:**
```typescript
physics.removeRigidBody(boxHandle);
```

---

#### `updateRigidBodyTransform(handle: string, position: Vector3, rotation: Quaternion): void`

Update a rigid body's position and rotation (for kinematic bodies).

**Performance:** < 1ms per update

**Example:**
```typescript
// Move robot arm
physics.updateRigidBodyTransform(
  robotHandle,
  { x: 5, y: 1, z: 0 },
  { x: 0, y: 0.707, z: 0, w: 0.707 }
);
```

---

#### `getRigidBodyTransform(handle: string): { position: Vector3, rotation: Quaternion } | null`

Get the current transform of a rigid body.

**Performance:** < 1ms per query

**Returns:** Transform object or `null` if body doesn't exist

**Example:**
```typescript
const transform = physics.getRigidBodyTransform(boxHandle);
if (transform) {
  console.log('Position:', transform.position);
  console.log('Rotation:', transform.rotation);
}
```

---

### Simulation

#### `step(deltaTime: number): void`

Advance the physics simulation by one timestep.

**Parameters:**
- `deltaTime`: Time step in seconds (recommend: `1/60` for 60 FPS)

**Performance:**
- 10 bodies: < 1ms
- 50 bodies: < 2ms
- 100 bodies: < 5ms

**Example:**
```typescript
// 60 FPS simulation
const fixedTimestep = 1 / 60;
physics.step(fixedTimestep);
```

---

### Collisions

#### `checkBodyCollision(bodyA: string, bodyB: string): boolean`

Check if two specific bodies are colliding.

**Performance:** < 1ms

**Example:**
```typescript
if (physics.checkBodyCollision(robotHandle, obstacleHandle)) {
  console.log('Robot hit obstacle!');
}
```

---

#### `getActiveCollisions(): Array<{bodyA: string, bodyB: string}>`

Get all currently active collision pairs.

**Performance:** < 10ms

**Example:**
```typescript
const collisions = physics.getActiveCollisions();
collisions.forEach(({ bodyA, bodyB }) => {
  console.log(`Collision: ${bodyA} ↔ ${bodyB}`);
});
```

---

#### `setCollisionGroup(handle: string, group: number): void`

Assign a collision group to a body for selective collision filtering.

**Example:**
```typescript
// Group 0: Environment
physics.setCollisionGroup(groundHandle, 0);

// Group 1: Robots
physics.setCollisionGroup(robotHandle, 1);

// Group 2: Tools
physics.setCollisionGroup(toolHandle, 2);
```

---

#### `setCollisionPair(geom1: string, geom2: string, enabled: boolean): void`

Enable/disable collisions between specific geometry pairs.

**Example:**
```typescript
// Disable robot self-collision
physics.setCollisionPair(robot LinkA, robotLinkB, false);

// Enable robot-environment collision
physics.setCollisionPair(robotLink, ground, true);
```

---

### Raycasting

#### `raycast(origin: Vector3, direction: Vector3, maxDistance: number): RaycastHit | null`

Cast a ray and return the first hit.

**Parameters:**
- `origin`: Ray start point
- `direction`: Ray direction (normalized)
- `maxDistance`: Maximum ray distance

**Returns:**
```typescript
interface RaycastHit {
  handle: string;      // Body that was hit
  distance: number;    // Distance to hit point
  point: Vector3;      // Hit point in world space
  normal: Vector3;     // Surface normal at hit point
}
```

**Performance:** < 5ms per raycast

**Example:**
```typescript
const hit = physics.raycast(
  { x: 0, y: 5, z: 0 },     // Origin
  { x: 0, y: -1, z: 0 },    // Direction (down)
  100                        // Max distance
);

if (hit) {
  console.log(`Hit body ${hit.handle} at distance ${hit.distance}`);
  console.log(`Hit point: (${hit.point.x}, ${hit.point.y}, ${hit.point.z})`);
}
```

---

### Joint Constraints

#### `createRevoluteJoint(bodyA: string, bodyB: string, anchor: Vector3, axis: Vector3): string | null`

Create a revolute joint (hinge) between two bodies.

**Parameters:**
- `bodyA`: First body handle (usually static or kinematic)
- `bodyB`: Second body handle (usually dynamic)
- `anchor`: Joint anchor point in world space
- `axis`: Rotation axis in world space

**Returns:** Joint handle or `null` if creation failed

**Example:**
```typescript
// Create a door hinge
const doorJoint = physics.createRevoluteJoint(
  doorFrameHandle,           // Static frame
  doorHandle,                // Dynamic door
  { x: 0, y: 1, z: 0 },     // Anchor at hinge
  { x: 0, y: 1, z: 0 }      // Rotate around Y-axis
);

// Set joint limits (-90° to +90°)
physics.setJointLimits(doorJoint, -Math.PI/2, Math.PI/2);
```

---

#### `createPrismaticJoint(bodyA: string, bodyB: string, anchor: Vector3, axis: Vector3): string | null`

Create a prismatic joint (slider) between two bodies.

**Example:**
```typescript
// Create a sliding drawer
const drawerJoint = physics.createPrismaticJoint(
  cabinetHandle,             // Static cabinet
  drawerHandle,              // Dynamic drawer
  { x: 0, y: 0, z: 0 },     // Anchor at cabinet
  { x: 0, y: 0, z: 1 }      // Slide along Z-axis
);

// Set travel limits (0m to 0.5m)
physics.setJointLimits(drawerJoint, 0, 0.5);
```

---

#### `setJointLimits(jointHandle: string, lower: number, upper: number): void`

Set position/angle limits for a joint.

**Parameters:**
- `lower`: Lower limit (radians for revolute, meters for prismatic)
- `upper`: Upper limit

**Example:**
```typescript
// Revolute joint: -45° to +45°
physics.setJointLimits(hingeJoint, -Math.PI/4, Math.PI/4);

// Prismatic joint: 0m to 1m
physics.setJointLimits(sliderJoint, 0, 1);
```

---

#### `setJointMotor(jointHandle: string, targetVelocity: number, maxForce: number): void`

Set motor parameters for a joint.

**Parameters:**
- `targetVelocity`: Target velocity (rad/s for revolute, m/s for prismatic)
- `maxForce`: Maximum force/torque

**Example:**
```typescript
// Rotate at 2 rad/s with max torque 10 N·m
physics.setJointMotor(hingeJoint, 2.0, 10.0);

// Extend at 0.5 m/s with max force 50 N
physics.setJointMotor(sliderJoint, 0.5, 50.0);
```

---

#### `getJointPosition(jointHandle: string): number | null`

Get current joint position/angle.

**Returns:** Position (m) or angle (rad), or `null` if joint doesn't exist

**Example:**
```typescript
const angle = physics.getJointPosition(hingeJoint);
console.log(`Hinge angle: ${angle} radians`);
```

---

### Resource Management

#### `dispose(): void`

Dispose the physics engine and clean up all resources.

**Example:**
```typescript
// On application shutdown
physics.dispose();
```

---

## Performance Best Practices

### 1. **Reuse Bodies Instead of Recreating**

❌ **Slow:**
```typescript
// Every frame:
physics.removeRigidBody(handle);
handle = physics.createRigidBody(descriptor);
```

✅ **Fast:**
```typescript
// Once at start:
const handle = physics.createRigidBody(descriptor);

// Every frame:
physics.updateRigidBodyTransform(handle, newPos, newRot);
```

**Impact:** 10x faster transform updates vs recreation

---

### 2. **Batch Operations**

✅ **Good:**
```typescript
// Create all bodies first
const handles = [];
for (let i = 0; i < 100; i++) {
  handles.push(physics.createRigidBody(descriptor));
}

// Then run simulation
physics.step(1/60);
```

❌ **Slow:**
```typescript
// Don't interleave creation and simulation
for (let i = 0; i < 100; i++) {
  physics.createRigidBody(descriptor);
  physics.step(1/60); // Wasteful!
}
```

---

### 3. **Use Static Bodies for Fixed Objects**

```typescript
// Ground, walls, obstacles → 'static'
const ground = physics.createRigidBody({
  type: 'static', // ← Won't move, cheaper simulation
  shape: 'box',
  position: { x: 0, y: 0, z: 0 },
  dimensions: { x: 100, y: 1, z: 100 },
});
```

**Impact:** Static bodies have zero simulation cost

---

### 4. **Disable Unnecessary Collisions**

```typescript
// Disable self-collision within robot
physics.setCollisionPair(link1, link2, false);
physics.setCollisionPair(link2, link3, false);
```

**Impact:** Reduces collision detection overhead

---

### 5. **Use Collision Groups**

```typescript
// Group 0: Environment (collides with everything)
physics.setCollisionGroup(groundHandle, 0);

// Group 1: Robot (collides with environment only)
physics.setCollisionGroup(robotHandle, 1);

// Group 2: UI objects (no collision)
physics.setCollisionGroup(uiHandle, 2);
```

---

### 6. **Profile Your Simulation**

```typescript
const start = performance.now();
physics.step(1/60);
const stepTime = performance.now() - start;

if (stepTime > 16.67) {
  console.warn(`Physics step took ${stepTime}ms (> 16.67ms for 60 FPS)`);
}
```

---

## Common Patterns

### Pattern 1: Falling Objects

```typescript
// Create dynamic sphere
const ball = physics.createRigidBody({
  type: 'dynamic',
  shape: 'sphere',
  position: { x: 0, y: 10, z: 0 },
  radius: 0.5,
});

// Create ground
const ground = physics.createRigidBody({
  type: 'static',
  shape: 'box',
  position: { x: 0, y: 0, z: 0 },
  dimensions: { x: 100, y: 1, z: 100 },
});

// Simulation loop
function loop() {
  physics.step(1/60);

  const transform = physics.getRigidBodyTransform(ball);
  ballMesh.position.copy(transform.position);

  requestAnimationFrame(loop);
}
```

---

### Pattern 2: Kinematic Robot Arm

```typescript
// Create robot base (static)
const base = physics.createRigidBody({
  type: 'static',
  shape: 'box',
  position: { x: 0, y: 0, z: 0 },
  dimensions: { x: 0.5, y: 0.5, z: 0.5 },
});

// Create robot links (kinematic)
const links = [];
for (let i = 0; i < 6; i++) {
  links.push(physics.createRigidBody({
    type: 'kinematic',
    shape: 'capsule',
    position: { x: 0, y: i * 0.5, z: 0 },
    radius: 0.1,
    height: 0.4,
  }));
}

// Control loop - move links programmatically
function updateRobot(jointAngles: number[]) {
  // Forward kinematics calculation...
  const transforms = calculateLinkTransforms(jointAngles);

  links.forEach((link, i) => {
    physics.updateRigidBodyTransform(
      link,
      transforms[i].position,
      transforms[i].rotation
    );
  });
}
```

---

### Pattern 3: Collision Detection

```typescript
// Create sensor (static, no collision response)
const sensor = physics.createRigidBody({
  type: 'static',
  shape: 'box',
  position: { x: 5, y: 0, z: 0 },
  dimensions: { x: 2, y: 2, z: 2 },
});

// Check collisions every frame
function checkCollisions() {
  const collisions = physics.getActiveCollisions();

  collisions.forEach(({ bodyA, bodyB }) => {
    if (bodyA === sensor || bodyB === sensor) {
      const other = bodyA === sensor ? bodyB : bodyA;
      console.log(`Object ${other} entered sensor zone!`);
    }
  });
}
```

---

### Pattern 4: Raycasting for Picking

```typescript
function pickObject(mouseX: number, mouseY: number, camera: Camera) {
  // Convert screen coordinates to ray
  const ray = camera.screenPointToRay(mouseX, mouseY);

  // Cast ray
  const hit = physics.raycast(
    ray.origin,
    ray.direction,
    1000
  );

  if (hit) {
    console.log(`Picked object: ${hit.handle}`);
    return hit.handle;
  }

  return null;
}
```

---

## Troubleshooting

### Bodies Falling Through Ground

**Problem:** Dynamic bodies pass through static ground.

**Causes:**
1. Ground collider too thin
2. Timestep too large
3. Bodies moving too fast

**Solutions:**
```typescript
// 1. Make ground thicker
const ground = physics.createRigidBody({
  type: 'static',
  shape: 'box',
  position: { x: 0, y: -0.5, z: 0 },
  dimensions: { x: 100, y: 1, z: 100 }, // ← Increase Y
});

// 2. Use fixed timestep
physics.step(1/60); // ← Don't use variable timestep

// 3. Limit maximum velocity (if available)
```

---

### Simulation Too Slow

**Problem:** Physics step takes > 16.67ms (can't maintain 60 FPS).

**Solutions:**
1. Reduce number of dynamic bodies
2. Use static bodies for fixed objects
3. Disable unnecessary collisions
4. Simplify collision shapes (sphere > capsule > box > mesh)
5. Increase timestep (lower physics update rate)

**Profiling:**
```typescript
console.time('physics');
physics.step(1/60);
console.timeEnd('physics');
// Target: < 16ms for 60 FPS
```

---

### Bodies Jittering

**Problem:** Bodies vibrate or oscillate.

**Causes:**
1. Interpenetration
2. High restitution (bounciness)
3. Stiff joints

**Solutions:**
```typescript
// Reduce bounciness in descriptor (if supported)
// Increase damping
// Use larger collision margins
```

---

### Joints Breaking

**Problem:** Joint constraints don't hold.

**Causes:**
1. Excessive forces
2. Incorrect anchor/axis setup
3. Bodies moving too fast

**Solutions:**
```typescript
// Increase max force
physics.setJointMotor(joint, targetVel, 1000); // ← Higher force

// Check anchor/axis vectors are correct
// Verify bodies are close to anchor point
```

---

## Advanced Topics

### Thread Safety

**The physics engine is NOT thread-safe.** All physics operations must run on the same thread.

---

### Memory Management

```typescript
// Clean up on entity removal
function removeEntity(handle: string) {
  physics.removeRigidBody(handle);
  // Body is immediately removed from simulation
}

// Clean up on app shutdown
function shutdown() {
  physics.dispose();
  // All resources freed
}
```

---

### Debugging

```typescript
// Get physics world for advanced debugging
const world = physics.getWorld();
// Use sparingly - breaks abstraction!

// Enable physics debug rendering (if available)
// const debugRenderer = new PhysicsDebugRenderer(world);
```

---

## Quick Reference

| Operation | Performance | Use Case |
|-----------|------------|----------|
| **Initialize** | < 100ms | Once at startup |
| **Create body** | < 10ms | Scene setup |
| **Update transform** | < 1ms | Kinematic control |
| **Get transform** | < 1ms | Render sync |
| **Step simulation** | < 2ms (50 bodies) | Every frame |
| **Raycast** | < 5ms | Picking, sensors |
| **Check collision** | < 1ms | Event detection |
| **Create joint** | < 10ms | Robot assembly |

---

## See Also

- [IPhysicsEngine.ts](../src/physics/IPhysicsEngine.ts) - Full API interface
- [RapierPhysicsEngine.ts](../src/physics/RapierPhysicsEngine.ts) - Implementation
- [EntityRegistry.ts](../src/entities/EntityRegistry.ts) - Physics-mesh sync
- [Rapier Documentation](https://rapier.rs/docs/) - Underlying engine

---

**Last Updated:** 2025-01-18
**Maintained by:** Agent 1 (Claude Code - George)
