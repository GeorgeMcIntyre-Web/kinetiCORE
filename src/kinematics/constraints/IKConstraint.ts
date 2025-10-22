/**
 * IK Constraint System
 * Owner: George
 * Base classes for inverse kinematics constraints
 */

import * as BABYLON from '@babylonjs/core';

/**
 * Base interface for all IK constraints
 */
export interface IKConstraint {
  type: ConstraintType;
  weight: number; // 0-1, how strongly to enforce this constraint
  enabled: boolean;

  /**
   * Evaluate constraint violation
   * Returns 0 if satisfied, positive value indicating violation magnitude
   */
  evaluate(jointAngles: Map<string, number[]>): number;

  /**
   * Compute gradient for constraint satisfaction
   * Returns joint angle adjustments to reduce constraint violation
   */
  computeGradient(jointAngles: Map<string, number[]>): Map<string, number[]>;
}

export type ConstraintType =
  | 'joint_limit'
  | 'balance'
  | 'collision_avoidance'
  | 'self_collision'
  | 'target_pose'
  | 'orientation'
  | 'look_at';

/**
 * Joint limit constraint
 * Ensures all joints stay within their min/max limits
 */
export class JointLimitConstraint implements IKConstraint {
  type: ConstraintType = 'joint_limit';
  weight = 1.0; // High priority
  enabled = true;

  constructor(
    private jointLimits: Map<string, { lower: number; upper: number }>
  ) {}

  evaluate(jointAngles: Map<string, number[]>): number {
    let violation = 0;

    jointAngles.forEach((angles, jointId) => {
      const limits = this.jointLimits.get(jointId);
      if (!limits) return;

      angles.forEach((angle) => {
        if (angle < limits.lower) {
          violation += (limits.lower - angle) ** 2;
        } else if (angle > limits.upper) {
          violation += (angle - limits.upper) ** 2;
        }
      });
    });

    return Math.sqrt(violation);
  }

  computeGradient(jointAngles: Map<string, number[]>): Map<string, number[]> {
    const gradient = new Map<string, number[]>();

    jointAngles.forEach((angles, jointId) => {
      const limits = this.jointLimits.get(jointId);
      if (!limits) return;

      const adjustments = angles.map((angle) => {
        if (angle < limits.lower) {
          return (limits.lower - angle) * 0.5; // Push toward lower limit
        } else if (angle > limits.upper) {
          return (angle - limits.upper) * -0.5; // Push toward upper limit
        }
        return 0;
      });

      gradient.set(jointId, adjustments);
    });

    return gradient;
  }
}

/**
 * Balance constraint for humanoid/quadruped robots
 * Ensures Center of Mass (CoM) stays within support polygon
 */
export class BalanceConstraint implements IKConstraint {
  type: ConstraintType = 'balance';
  weight = 0.8; // High priority but below joint limits
  enabled = true;

  private massComputer: any = null; // Will be lazily loaded to avoid circular deps

  constructor(
    private _targetCoM: BABYLON.Vector3,
    private _supportPolygon: BABYLON.Vector3[], // Foot contact points
    private _zmpTolerance: number = 0.05 // 5cm tolerance
  ) {}

  // Getters for private fields
  get targetCoM(): BABYLON.Vector3 { return this._targetCoM; }
  get supportPolygon(): BABYLON.Vector3[] { return this._supportPolygon; }
  get zmpTolerance(): number { return this._zmpTolerance; }

  /**
   * Set mass properties computer (for CoM calculation)
   */
  setMassComputer(massComputer: any): void {
    this.massComputer = massComputer;
  }

  /**
   * Update support polygon (e.g., when feet move)
   */
  updateSupportPolygon(footPositions: BABYLON.Vector3[]): void {
    this._supportPolygon = footPositions;
  }

  /**
   * Update target CoM position
   */
  updateTargetCoM(com: BABYLON.Vector3): void {
    this._targetCoM = com;
  }

  evaluate(_jointAngles: Map<string, number[]>): number {
    if (!this.massComputer) {
      return 0; // No mass data available
    }

    // Compute actual CoM position
    const actualCoM = this.massComputer.computeRobotCoM();

    // Check if CoM is within support polygon
    const inside = this.isInsideSupportPolygon(actualCoM);

    if (inside) {
      // If inside, violation is distance from target CoM
      return actualCoM.subtract(this._targetCoM).length();
    } else {
      // If outside, large violation (unstable!)
      const distance = this.distanceToSupportPolygon(actualCoM);
      return distance + 1.0; // Heavy penalty for being outside
    }
  }

  computeGradient(_jointAngles: Map<string, number[]>): Map<string, number[]> {
    // TODO: Implement CoM Jacobian-based gradient
    // Would use massComputer.computeCoMJacobian()
    return new Map();
  }

  /**
   * Check if a point is inside the support polygon
   */
  private isInsideSupportPolygon(point: BABYLON.Vector3): boolean {
    if (this._supportPolygon.length < 3) return false;

    // Ray casting algorithm for point-in-polygon test (2D on ground plane)
    let inside = false;
    for (let i = 0, j = this._supportPolygon.length - 1; i < this._supportPolygon.length; j = i++) {
      const xi = this._supportPolygon[i].x;
      const zi = this._supportPolygon[i].z;
      const xj = this._supportPolygon[j].x;
      const zj = this._supportPolygon[j].z;

      const intersect =
        zi > point.z !== zj > point.z &&
        point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Compute distance from point to support polygon edge
   */
  private distanceToSupportPolygon(point: BABYLON.Vector3): number {
    if (this._supportPolygon.length < 2) return Infinity;

    let minDistance = Infinity;

    // Find closest edge
    for (let i = 0; i < this._supportPolygon.length; i++) {
      const j = (i + 1) % this._supportPolygon.length;
      const p1 = this._supportPolygon[i];
      const p2 = this._supportPolygon[j];

      // Distance to line segment in 2D (XZ plane)
      const dist = this.pointToSegmentDistance(
        new BABYLON.Vector2(point.x, point.z),
        new BABYLON.Vector2(p1.x, p1.z),
        new BABYLON.Vector2(p2.x, p2.z)
      );

      minDistance = Math.min(minDistance, dist);
    }

    return minDistance;
  }

  /**
   * Distance from point to line segment in 2D
   */
  private pointToSegmentDistance(
    point: BABYLON.Vector2,
    segStart: BABYLON.Vector2,
    segEnd: BABYLON.Vector2
  ): number {
    const v = segEnd.subtract(segStart);
    const w = point.subtract(segStart);

    const c1 = BABYLON.Vector2.Dot(w, v);
    if (c1 <= 0) {
      return BABYLON.Vector2.Distance(point, segStart);
    }

    const c2 = BABYLON.Vector2.Dot(v, v);
    if (c1 >= c2) {
      return BABYLON.Vector2.Distance(point, segEnd);
    }

    const b = c1 / c2;
    const pb = segStart.add(v.scale(b));
    return BABYLON.Vector2.Distance(point, pb);
  }

  /**
   * Compute Zero Moment Point (ZMP) for stability analysis
   */
  computeZMP(
    com: BABYLON.Vector3,
    _comVelocity: BABYLON.Vector3,
    comAcceleration: BABYLON.Vector3,
    gravity: BABYLON.Vector3 = new BABYLON.Vector3(0, -9.81, 0)
  ): BABYLON.Vector3 {
    // Simplified ZMP calculation
    // ZMP_x = CoM_x - (CoM_z * CoM_acc_x) / (CoM_acc_z + g)
    const totalAccZ = comAcceleration.y + gravity.y;

    if (Math.abs(totalAccZ) < 0.001) {
      // Static case
      return new BABYLON.Vector3(com.x, 0, com.z);
    }

    const zmpX = com.x - (com.y * comAcceleration.x) / totalAccZ;
    const zmpZ = com.z - (com.y * comAcceleration.z) / totalAccZ;

    return new BABYLON.Vector3(zmpX, 0, zmpZ);
  }
}

/**
 * Collision avoidance constraint
 * Prevents robot parts from colliding with environment or self
 */
export class CollisionAvoidanceConstraint implements IKConstraint {
  type: ConstraintType = 'collision_avoidance';
  weight = 0.7;
  enabled = true;

  private physicsManager: any = null; // PhysicsManager
  private sceneTreeManager: any = null; // SceneTreeManager
  private entityRegistry: any = null; // EntityRegistry
  private kinematicsManager: any = null; // KinematicsManager

  // Cache of physics handles for robot nodes
  private robotPhysicsHandles: Set<string> = new Set();

  constructor(
    private _minClearance: number = 0.01, // 1cm minimum clearance
    private _checkSelfCollision: boolean = true,
    private _checkEnvironmentCollision: boolean = true
  ) {}

  // Getters for private fields
  get minClearance(): number { return this._minClearance; }
  get checkSelfCollision(): boolean { return this._checkSelfCollision; }
  get checkEnvironmentCollision(): boolean { return this._checkEnvironmentCollision; }

  /**
   * Connect required managers for collision checking
   */
  setManagers(
    physicsManager: any,
    sceneTreeManager: any,
    entityRegistry: any,
    kinematicsManager: any
  ): void {
    this.physicsManager = physicsManager;
    this.sceneTreeManager = sceneTreeManager;
    this.entityRegistry = entityRegistry;
    this.kinematicsManager = kinematicsManager;

    // Build cache of robot physics handles
    this.buildRobotPhysicsHandlesCache();
  }

  /**
   * Build cache of physics handles for all robot nodes
   */
  private buildRobotPhysicsHandlesCache(): void {
    if (!this.kinematicsManager || !this.sceneTreeManager || !this.entityRegistry) {
      return;
    }

    this.robotPhysicsHandles.clear();

    // Get all kinematic chains
    const chains = this.kinematicsManager.getAllChains();

    chains.forEach((chain: any) => {
      const joints = this.kinematicsManager.getChainJoints(chain.id);

      joints.forEach((joint: any) => {
        // Get nodes for parent and child
        const parentNode = this.sceneTreeManager.getNode(joint.parentNodeId);
        const childNode = this.sceneTreeManager.getNode(joint.childNodeId);

        [parentNode, childNode].forEach((node: any) => {
          if (node?.entityId) {
            const entity = this.entityRegistry.get(node.entityId);
            if (entity) {
              const handle = this.getPhysicsHandle(entity);
              if (handle) {
                this.robotPhysicsHandles.add(handle);
              }
            }
          }
        });
      });
    });

    console.log(`[Collision Constraint] Cached ${this.robotPhysicsHandles.size} robot physics handles`);
  }

  /**
   * Get physics handle from SceneEntity (uses reflection to avoid circular dependency)
   */
  private getPhysicsHandle(entity: any): string | null {
    // Access private physicsHandle field via reflection
    return entity['physicsHandle'] ?? null;
  }

  evaluate(_jointAngles: Map<string, number[]>): number {
    if (!this.physicsManager || !this.enabled) {
      return 0;
    }

    const physicsEngine = this.physicsManager.getCurrentEngine();
    if (!physicsEngine) {
      return 0;
    }

    let totalViolation = 0;
    let collisionCount = 0;

    // Check each robot body for collisions
    this.robotPhysicsHandles.forEach((handle) => {
      const intersecting = physicsEngine.getIntersectingBodies(handle);

      intersecting.forEach((otherHandle: string) => {
        // Self-collision check
        if (this._checkSelfCollision && this.robotPhysicsHandles.has(otherHandle)) {
          // Collision between two robot parts
          totalViolation += this._minClearance;
          collisionCount++;
        }

        // Environment collision check
        if (this._checkEnvironmentCollision && !this.robotPhysicsHandles.has(otherHandle)) {
          // Collision with environment
          totalViolation += this._minClearance * 2; // Higher penalty for environment collisions
          collisionCount++;
        }
      });
    });

    if (collisionCount > 0) {
      console.warn(`[Collision Constraint] Detected ${collisionCount} collisions, violation: ${totalViolation.toFixed(4)}m`);
    }

    return totalViolation;
  }

  computeGradient(_jointAngles: Map<string, number[]>): Map<string, number[]> {
    // Numerical gradient computation using finite differences
    if (!this.physicsManager || !this.enabled) {
      return new Map();
    }

    const gradient = new Map<string, number[]>();
    const epsilon = 0.001; // Small angle change (radians)

    // For each chain and joint, perturb and measure collision change
    _jointAngles.forEach((angles, chainName) => {
      const chainGradient: number[] = [];

      angles.forEach((_angle, jointIndex) => {
        // Compute violation at current config
        const violation0 = this.evaluate(_jointAngles);

        // Perturb joint slightly
        const perturbedAngles = new Map(_jointAngles);
        const perturbedChainAngles = [...angles];
        perturbedChainAngles[jointIndex] += epsilon;
        perturbedAngles.set(chainName, perturbedChainAngles);

        // Compute violation at perturbed config
        const violation1 = this.evaluate(perturbedAngles);

        // Numerical derivative
        const dViolation = (violation1 - violation0) / epsilon;
        chainGradient.push(dViolation);
      });

      gradient.set(chainName, chainGradient);
    });

    return gradient;
  }

  /**
   * Enable/disable self-collision checking
   */
  setSelfCollisionCheck(enabled: boolean): void {
    this._checkSelfCollision = enabled;
  }

  /**
   * Enable/disable environment collision checking
   */
  setEnvironmentCollisionCheck(enabled: boolean): void {
    this._checkEnvironmentCollision = enabled;
  }

  /**
   * Set minimum clearance distance
   */
  setMinClearance(clearance: number): void {
    this._minClearance = clearance;
  }

  /**
   * Refresh robot physics handles cache
   * Call this after robot structure changes
   */
  refreshCache(): void {
    this.buildRobotPhysicsHandlesCache();
  }
}

/**
 * Target pose constraint
 * Drives end-effector toward target position/orientation
 */
export class TargetPoseConstraint implements IKConstraint {
  type: ConstraintType = 'target_pose';
  weight = 1.0;
  enabled = true;

  constructor(
    private chainName: string,
    private targetPosition: BABYLON.Vector3,
    private targetOrientation?: BABYLON.Quaternion,
    private positionWeight: number = 1.0,
    private orientationWeight: number = 0.5
  ) {}

  /**
   * Update target position
   */
  updateTarget(
    position: BABYLON.Vector3,
    orientation?: BABYLON.Quaternion
  ): void {
    this.targetPosition = position;
    this.targetOrientation = orientation;
  }

  getChainName(): string {
    return this.chainName;
  }

  getTargetPosition(): BABYLON.Vector3 {
    return this.targetPosition;
  }

  getTargetOrientation(): BABYLON.Quaternion | undefined {
    return this.targetOrientation;
  }

  getPositionWeight(): number {
    return this.positionWeight;
  }

  getOrientationWeight(): number {
    return this.orientationWeight;
  }

  evaluate(_jointAngles: Map<string, number[]>): number {
    // Requires FK integration to compute current end-effector pose
    // Then compute distance to target
    return 0;
  }

  computeGradient(_jointAngles: Map<string, number[]>): Map<string, number[]> {
    // Requires Jacobian computation
    return new Map();
  }
}

/**
 * Look-at constraint
 * Makes a body part (e.g., head) look at a target point
 */
export class LookAtConstraint implements IKConstraint {
  type: ConstraintType = 'look_at';
  weight = 0.5;
  enabled = true;

  constructor(
    private chainName: string,
    private lookTarget: BABYLON.Vector3
  ) {}

  /**
   * Update look-at target
   */
  updateTarget(target: BABYLON.Vector3): void {
    this.lookTarget = target;
  }

  getChainName(): string {
    return this.chainName;
  }

  getLookTarget(): BABYLON.Vector3 {
    return this.lookTarget;
  }

  evaluate(_jointAngles: Map<string, number[]>): number {
    return 0;
  }

  computeGradient(_jointAngles: Map<string, number[]>): Map<string, number[]> {
    return new Map();
  }
}
