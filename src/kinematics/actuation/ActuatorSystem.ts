/**
 * Actuator System Implementation
 * Missing file - Core system for controlling device actuators
 * Manages real hardware actuators and their coordination
 */

import {
  HardwareActuator,
  ActuatorGroup,
  HardwareCommand,
  ActuatorType,
} from '../device/UnifiedDeviceDefinition';

export interface ActuatorStateUpdate {
  actuatorId: string;
  value?: number;
  velocity?: number;
  force?: number;
  temperature?: number;
  fault?: boolean;
  faultCode?: string;
}

export class ActuatorSystem {
  private actuators: Map<string, HardwareActuator> = new Map();
  private groups: Map<string, ActuatorGroup> = new Map();
  private updateCallbacks: Map<string, (state: ActuatorStateUpdate) => void> = new Map();

  /**
   * Register an actuator with the system
   */
  registerActuator(actuator: HardwareActuator): void {
    this.actuators.set(actuator.id, actuator);
    console.log(`[ActuatorSystem] Registered: ${actuator.name} (${actuator.type})`);
  }

  /**
   * Unregister an actuator
   */
  unregisterActuator(actuatorId: string): boolean {
    const removed = this.actuators.delete(actuatorId);
    if (removed) {
      console.log(`[ActuatorSystem] Unregistered actuator: ${actuatorId}`);
    }
    return removed;
  }

  /**
   * Get actuator by ID
   */
  getActuator(actuatorId: string): HardwareActuator | undefined {
    return this.actuators.get(actuatorId);
  }

  /**
   * Get all actuators
   */
  getAllActuators(): HardwareActuator[] {
    return Array.from(this.actuators.values());
  }

  /**
   * Get actuators by type
   */
  getActuatorsByType(type: ActuatorType): HardwareActuator[] {
    return Array.from(this.actuators.values()).filter(a => a.type === type);
  }

  /**
   * Send command to actuator
   */
  sendCommand(command: HardwareCommand): boolean {
    const actuator = this.actuators.get(command.actuatorId);
    if (!actuator) {
      console.error(`[ActuatorSystem] Actuator not found: ${command.actuatorId}`);
      return false;
    }

    console.log(`[ActuatorSystem] Command: ${command.command} → ${actuator.name}`);

    switch (command.command) {
      case 'enable':
        actuator.state.enabled = true;
        actuator.state.fault = false;
        break;

      case 'disable':
        actuator.state.enabled = false;
        break;

      case 'set_value':
        if (command.value === undefined) {
          console.error('[ActuatorSystem] set_value requires value parameter');
          return false;
        }
        if (!actuator.state.enabled) {
          console.warn(`[ActuatorSystem] Actuator ${actuator.name} is disabled`);
          return false;
        }
        // Clamp to control range
        const clamped = Math.max(
          actuator.specs.ctrlRange.min,
          Math.min(actuator.specs.ctrlRange.max, command.value)
        );
        actuator.state.value = clamped;
        
        // Apply to coordinated joints (would be handled by kinematics system)
        this.applyToJoints(actuator);
        break;

      case 'set_velocity':
        if (command.value === undefined) return false;
        actuator.state.velocity = command.value;
        break;

      case 'set_force':
        if (command.value === undefined) return false;
        actuator.state.force = command.value;
        break;

      case 'home':
        actuator.state.value = 0;
        this.applyToJoints(actuator);
        break;

      case 'reset_fault':
        actuator.state.fault = false;
        actuator.state.faultCode = undefined;
        break;

      default:
        console.error(`[ActuatorSystem] Unknown command: ${command.command}`);
        return false;
    }

    // Notify listeners
    this.notifyStateUpdate({
      actuatorId: actuator.id,
      value: actuator.state.value,
      velocity: actuator.state.velocity,
      force: actuator.state.force,
      fault: actuator.state.fault,
      faultCode: actuator.state.faultCode,
    });

    return true;
  }

  /**
   * Apply actuator value to coordinated joints
   * Integrates with KinematicsManager to move joints
   */
  private applyToJoints(actuator: HardwareActuator): void {
    // Import KinematicsManager dynamically to avoid circular dependencies
    import('../KinematicsManager').then(({ KinematicsManager }) => {
      const kinematicsManager = KinematicsManager.getInstance();
      
      for (const coord of actuator.coordination) {
        const jointValue = actuator.state.value * coord.ratio + coord.offset;
        
        console.log(`  → Joint ${coord.jointId}: ${jointValue.toFixed(4)} (ratio: ${coord.ratio})`);
        
        // Apply joint value through KinematicsManager
        const joint = kinematicsManager.getJoint(coord.jointId);
        if (joint) {
          // Update joint position
          joint.position = jointValue;
          
          // Apply transform to the child node
          const sceneTreeManager = (require('../../scene/SceneTreeManager') as any).SceneTreeManager.getInstance();
          const childNode = sceneTreeManager.getNode(joint.childNodeId);
          
          if (childNode) {
            // Apply joint transform based on joint type
            if (joint.type === 'revolute') {
              // Apply rotation around joint axis
              const axis = new (require('@babylonjs/core') as any).Vector3(
                joint.axis.x, joint.axis.y, joint.axis.z
              );
              const rotation = axis.scale(jointValue);
              childNode.rotation = {
                x: childNode.rotation.x + rotation.x,
                y: childNode.rotation.y + rotation.y,
                z: childNode.rotation.z + rotation.z
              };
            } else if (joint.type === 'prismatic') {
              // Apply translation along joint axis
              const axis = new (require('@babylonjs/core') as any).Vector3(
                joint.axis.x, joint.axis.y, joint.axis.z
              );
              const translation = axis.scale(jointValue);
              childNode.position = {
                x: childNode.position.x + translation.x,
                y: childNode.position.y + translation.y,
                z: childNode.position.z + translation.z
              };
            }
            
            // Update joint data in child node
            if (childNode.jointData) {
              childNode.jointData.currentValue = jointValue;
            }
          }
        }
      }
    }).catch(error => {
      console.error('[ActuatorSystem] Failed to apply to joints:', error);
    });
  }

  /**
   * Create actuator group
   */
  createActuatorGroup(
    name: string,
    actuatorIds: string[],
    synchronized: boolean = true,
    leaderId?: string
  ): ActuatorGroup {
    // Validate all actuators exist
    for (const id of actuatorIds) {
      if (!this.actuators.has(id)) {
        throw new Error(`Actuator not found: ${id}`);
      }
    }

    if (leaderId && !actuatorIds.includes(leaderId)) {
      throw new Error(`Leader ${leaderId} not in group`);
    }

    const group: ActuatorGroup = {
      id: this.generateGroupId(),
      name,
      actuatorIds,
      synchronized,
      leader: leaderId,
    };

    this.groups.set(group.id, group);
    console.log(`[ActuatorSystem] Created group: ${name} (${actuatorIds.length} actuators, sync: ${synchronized})`);

    return group;
  }

  /**
   * Get actuator group
   */
  getGroup(groupId: string): ActuatorGroup | undefined {
    return this.groups.get(groupId);
  }

  /**
   * Send command to entire group
   */
  sendGroupCommand(groupId: string, command: Omit<HardwareCommand, 'actuatorId'>): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      console.error(`[ActuatorSystem] Group not found: ${groupId}`);
      return false;
    }

    console.log(`[ActuatorSystem] Group command: ${command.command} → ${group.name}`);

    if (group.synchronized && group.leader) {
      // Synchronized: Apply to leader first, others follow
      const leaderCommand: HardwareCommand = {
        actuatorId: group.leader,
        ...command,
      };
      this.sendCommand(leaderCommand);

      // Others follow leader's value
      const leader = this.actuators.get(group.leader);
      if (leader) {
        for (const actuatorId of group.actuatorIds) {
          if (actuatorId !== group.leader) {
            this.sendCommand({
              actuatorId,
              command: 'set_value',
              value: leader.state.value,
            });
          }
        }
      }
    } else {
      // Independent: Apply to all
      let success = true;
      for (const actuatorId of group.actuatorIds) {
        const individualCommand: HardwareCommand = {
          actuatorId,
          ...command,
        };
        success = this.sendCommand(individualCommand) && success;
      }
      return success;
    }

    return true;
  }

  /**
   * Create pneumatic valve actuator
   */
  createPneumaticValve(
    name: string,
    controlledJoints: string[],
    specs?: {
      pressure?: number;
      bore?: number;
      stroke?: number;
      force?: number;
    }
  ): HardwareActuator {
    const actuator: HardwareActuator = {
      id: this.generateActuatorId(),
      name,
      type: 'pneumatic_cylinder',
      controlMode: 'position',
      
      controlledJoints,
      
      specs: {
        pressure: specs?.pressure ?? 6, // bar
        bore: specs?.bore ?? 32,       // mm
        stroke: specs?.stroke ?? 100,  // mm
        ratedForce: specs?.force ?? 482, // N at 6 bar
        forceRange: { min: 0, max: specs?.force ?? 482 },
        ctrlRange: { min: 0, max: (specs?.stroke ?? 100) * 0.001 }, // mm → m
      },
      
      coordination: controlledJoints.map(jointId => ({
        jointId,
        ratio: 1.0,
        offset: 0,
      })),
      
      state: {
        enabled: false,
        value: 0,
        fault: false,
      },
    };

    this.registerActuator(actuator);
    return actuator;
  }

  /**
   * Create servo motor actuator
   */
  createServoMotor(
    name: string,
    controlledJoints: string[],
    specs?: {
      torque?: number;
      gearRatio?: number;
      kp?: number;
    }
  ): HardwareActuator {
    const actuator: HardwareActuator = {
      id: this.generateActuatorId(),
      name,
      type: 'servo_motor',
      controlMode: 'position',
      
      controlledJoints,
      
      specs: {
        kp: specs?.kp ?? 150,
        ratedTorque: specs?.torque ?? 140, // N·m
        gearRatio: specs?.gearRatio ?? 50,
        forceRange: { min: -(specs?.torque ?? 140), max: specs?.torque ?? 140 },
        ctrlRange: { min: -Math.PI, max: Math.PI }, // ±180°
        hasEncoder: true,
        encoderResolution: 4096,
      },
      
      coordination: controlledJoints.map(jointId => ({
        jointId,
        ratio: 1.0,
        offset: 0,
      })),
      
      state: {
        enabled: false,
        value: 0,
        fault: false,
      },
    };

    this.registerActuator(actuator);
    return actuator;
  }

  /**
   * Create linear actuator (electric screw drive)
   */
  createLinearActuator(
    name: string,
    controlledJoints: string[],
    specs?: {
      stroke?: number;
      force?: number;
      speed?: number;
    }
  ): HardwareActuator {
    const actuator: HardwareActuator = {
      id: this.generateActuatorId(),
      name,
      type: 'linear_actuator',
      controlMode: 'position',
      
      controlledJoints,
      
      specs: {
        stroke: specs?.stroke ?? 200, // mm
        ratedForce: specs?.force ?? 5000, // N
        maxSpeed: specs?.speed ?? 0.1, // m/s
        forceRange: { min: 0, max: specs?.force ?? 5000 },
        ctrlRange: { min: 0, max: (specs?.stroke ?? 200) * 0.001 }, // mm → m
      },
      
      coordination: controlledJoints.map(jointId => ({
        jointId,
        ratio: 1.0,
        offset: 0,
      })),
      
      state: {
        enabled: false,
        value: 0,
        fault: false,
      },
    };

    this.registerActuator(actuator);
    return actuator;
  }

  /**
   * Register callback for actuator state updates
   */
  onStateUpdate(actuatorId: string, callback: (state: ActuatorStateUpdate) => void): void {
    this.updateCallbacks.set(actuatorId, callback);
  }

  /**
   * Notify listeners of state update
   */
  private notifyStateUpdate(update: ActuatorStateUpdate): void {
    const callback = this.updateCallbacks.get(update.actuatorId);
    if (callback) {
      callback(update);
    }
  }

  /**
   * Emergency stop all actuators
   */
  emergencyStop(): void {
    console.warn('[ActuatorSystem] EMERGENCY STOP');
    for (const actuator of this.actuators.values()) {
      actuator.state.enabled = false;
      actuator.state.value = 0;
      actuator.state.fault = true;
      actuator.state.faultCode = 'EMERGENCY_STOP';
    }
  }

  /**
   * Reset all actuators to home position
   */
  homeAll(): void {
    console.log('[ActuatorSystem] Homing all actuators');
    for (const actuator of this.actuators.values()) {
      this.sendCommand({
        actuatorId: actuator.id,
        command: 'home',
      });
    }
  }

  /**
   * Get system status
   */
  getSystemStatus(): {
    totalActuators: number;
    enabledActuators: number;
    faultedActuators: number;
    groups: number;
  } {
    const actuators = Array.from(this.actuators.values());
    return {
      totalActuators: actuators.length,
      enabledActuators: actuators.filter(a => a.state.enabled).length,
      faultedActuators: actuators.filter(a => a.state.fault).length,
      groups: this.groups.size,
    };
  }

  /**
   * Generate unique actuator ID
   */
  private generateActuatorId(): string {
    return `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique group ID
   */
  private generateGroupId(): string {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Dispose system
   */
  dispose(): void {
    this.emergencyStop();
    this.actuators.clear();
    this.groups.clear();
    this.updateCallbacks.clear();
    console.log('[ActuatorSystem] Disposed');
  }
}
