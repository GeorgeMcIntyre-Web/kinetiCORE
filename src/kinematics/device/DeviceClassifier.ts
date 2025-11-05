/**
 * Device Type Classifier
 * Owner: George
 * 
 * Automatically detects device types (robot, gripper, fixture, EOT) based on
 * kinematic analysis and geometric properties
 */

import { KinematicsManager } from '../KinematicsManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import type { SceneNode } from '../../scene/SceneTreeNode';

/**
 * Device types that can be automatically detected
 */
export type DeviceType = 
  | 'robot'        // 6+ DOF articulated arm
  | 'gripper'      // 1-3 DOF gripping mechanism
  | 'fixture'      // 0 DOF mounting/clamping device
  | 'eot'          // End-of-arm tooling (specialized grippers)
  | 'conveyor'     // Linear motion system
  | 'valve'        // Flow control device (manual/actuated)
  | 'actuator'     // Linear/rotary motion device (servo, pneumatic, hydraulic)
  | 'sensor'       // Measurement/feedback device
  | 'tool'         // Specialized tooling (welder, cutter, drill)
  | 'clamp'        // Holding/securing mechanism
  | 'pump'         // Fluid transfer device
  | 'motor'        // Rotary drive (servo, stepper, DC)
  | 'gear'         // Power transmission device
  | 'bearing'      // Support/rotation mechanism
  | 'unknown';     // Cannot be classified

/**
 * Device classification result
 */
export interface DeviceClassification {
  type: DeviceType;
  confidence: number;           // 0-1 confidence score
  dof: number;                 // Degrees of freedom
  reach?: number;              // Maximum reach in mm
  payload?: number;            // Maximum payload in kg
  features: string[];          // Detected features
  reasoning: string[];         // Classification reasoning
}

/**
 * Gripper-specific properties
 */
export interface GripperProperties {
  jawWidth: number;            // Maximum jaw opening in mm
  grippingForce: number;       // Gripping force in N
  jawCount: number;            // Number of jaws/fingers
  isParallel: boolean;         // Parallel vs angular jaw motion
  hasForceControl: boolean;    // Force feedback capability
}

/**
 * Robot-specific properties
 */
export interface RobotProperties {
  workspace: 'spherical' | 'cylindrical' | 'rectangular';
  repeatability: number;       // Repeatability in mm
  maxSpeed: number;           // Maximum joint speed in rad/s
  payload: number;            // Maximum payload in kg
  reach: number;              // Maximum reach in mm
}

/**
 * Device classifier for automatic type detection
 */
export class DeviceClassifier {
  private static instance: DeviceClassifier | null = null;

  private constructor() {}

  public static getInstance(): DeviceClassifier {
    if (!DeviceClassifier.instance) {
      DeviceClassifier.instance = new DeviceClassifier();
    }
    return DeviceClassifier.instance;
  }

  /**
   * Classify a device based on its kinematic properties
   */
  public classifyDevice(rootNodeId: string): DeviceClassification {
    const kinematicsManager = KinematicsManager.getInstance();
    const sceneTreeManager = SceneTreeManager.getInstance();
    
    const rootNode = sceneTreeManager.getNode(rootNodeId);
    if (!rootNode) {
      return {
        type: 'unknown',
        confidence: 0,
        dof: 0,
        features: [],
        reasoning: ['Root node not found']
      };
    }

    // Get all joints for this device
    const allJoints = kinematicsManager.getAllJoints();
    const deviceJoints = allJoints.filter(joint => 
      joint.id.startsWith(rootNodeId) || 
      joint.parentNodeId === rootNodeId ||
      joint.childNodeId === rootNodeId
    );

    // Calculate degrees of freedom
    const dof = this.calculateDOF(deviceJoints);
    
    // Analyze geometric properties
    const geometricAnalysis = this.analyzeGeometry(rootNode);
    
    // Analyze kinematic structure
    const kinematicAnalysis = this.analyzeKinematics(deviceJoints, rootNode);
    
    // Combine analyses for classification
    const classification = this.combineAnalyses(
      dof,
      geometricAnalysis,
      kinematicAnalysis,
      rootNode.name.toLowerCase()
    );

    return classification;
  }

  /**
   * Calculate degrees of freedom from joints
   */
  private calculateDOF(joints: any[]): number {
    let dof = 0;
    
    for (const joint of joints) {
      switch (joint.type) {
        case 'revolute':
        case 'prismatic':
          dof += 1;
          break;
        case 'spherical':
          dof += 3;
          break;
        case 'planar':
          dof += 2;
          break;
        case 'fixed':
          dof += 0;
          break;
      }
    }
    
    return dof;
  }

  /**
   * Analyze geometric properties of the device
   */
  private analyzeGeometry(_rootNode: SceneNode): {
    boundingBox: { width: number; height: number; depth: number };
    aspectRatio: number;
    isCompact: boolean;
    hasLinearStructure: boolean;
  } {
    // TODO: Calculate actual bounding box from meshes
    // For now, use placeholder values
    const boundingBox = { width: 100, height: 100, depth: 100 };
    const aspectRatio = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) / 
                       Math.min(boundingBox.width, boundingBox.height, boundingBox.depth);
    
    return {
      boundingBox,
      aspectRatio,
      isCompact: aspectRatio < 3,
      hasLinearStructure: aspectRatio > 5
    };
  }

  /**
   * Analyze kinematic structure
   */
  private analyzeKinematics(joints: any[], rootNode: SceneNode): {
    isSerial: boolean;
    isParallel: boolean;
    hasClosedLoop: boolean;
    jointTypes: string[];
    maxReach: number;
  } {
    const jointTypes = joints.map(j => j.type);
    // const _revoluteCount = jointTypes.filter(t => t === 'revolute').length;
    // const _prismaticCount = jointTypes.filter(t => t === 'prismatic').length;
    
    // Simple heuristics for kinematic structure
    const isSerial = joints.length > 0 && joints.length <= 7; // Typical serial chain
    const isParallel = joints.length > 6; // Complex parallel mechanisms
    const hasClosedLoop = false; // TODO: Detect closed loops
    
    // Estimate reach based on joint count and type
    const maxReach = this.estimateReach(joints, rootNode);
    
    return {
      isSerial,
      isParallel,
      hasClosedLoop,
      jointTypes,
      maxReach
    };
  }

  /**
   * Estimate device reach based on kinematic analysis
   */
  private estimateReach(joints: any[], rootNode: SceneNode): number {
    // Simple heuristic: assume 100mm per revolute joint
    const revoluteJoints = joints.filter(j => j.type === 'revolute');
    const baseReach = revoluteJoints.length * 100;
    
    // Add some variation based on device name
    const nameMultiplier = this.getNameMultiplier(rootNode.name);
    
    return baseReach * nameMultiplier;
  }

  /**
   * Get multiplier based on device name patterns
   */
  private getNameMultiplier(name: string): number {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('micro') || lowerName.includes('small')) {
      return 0.5;
    }
    if (lowerName.includes('large') || lowerName.includes('heavy')) {
      return 2.0;
    }
    if (lowerName.includes('gripper') || lowerName.includes('hand')) {
      return 0.3;
    }
    if (lowerName.includes('robot') || lowerName.includes('arm')) {
      return 1.5;
    }
    
    return 1.0;
  }

  /**
   * Combine all analyses to determine device type
   */
  private combineAnalyses(
    dof: number,
    geometry: any,
    kinematics: any,
    deviceName: string
  ): DeviceClassification {
    const features: string[] = [];
    const reasoning: string[] = [];
    let type: DeviceType = 'unknown';
    let confidence = 0;

    // First, check for specific device patterns by name
    const specificType = this.detectSpecificDeviceType(deviceName);
    if (specificType !== 'unknown') {
      type = specificType;
      confidence = 0.9;
      features.push('name-based-detection');
      reasoning.push(`Detected ${type} from device name`);
    } else {
      // Fall back to DOF-based classification
      if (dof === 0) {
        // Could be fixture, valve, clamp, or bearing
        if (this.isValvePattern(deviceName)) {
          type = 'valve';
          confidence = 0.8;
          features.push('flow-control', 'manual');
          reasoning.push('0 DOF valve detected');
        } else if (this.isClampPattern(deviceName)) {
          type = 'clamp';
          confidence = 0.8;
          features.push('holding', 'securing');
          reasoning.push('0 DOF clamp detected');
        } else {
          type = 'fixture';
          confidence = 0.7;
          features.push('fixed', 'mounting');
          reasoning.push('0 DOF mounting device');
        }
      } else if (dof === 1) {
        // Could be actuator, motor, valve, or simple gripper
        if (this.isActuatorPattern(deviceName)) {
          type = 'actuator';
          confidence = 0.8;
          features.push('linear-motion', 'actuated');
          reasoning.push('1 DOF actuator detected');
        } else if (this.isMotorPattern(deviceName)) {
          type = 'motor';
          confidence = 0.8;
          features.push('rotary-motion', 'drive');
          reasoning.push('1 DOF motor detected');
        } else if (this.isValvePattern(deviceName)) {
          type = 'valve';
          confidence = 0.8;
          features.push('flow-control', 'actuated');
          reasoning.push('1 DOF actuated valve detected');
        } else if (this.isGripperPattern(deviceName, kinematics)) {
          type = 'gripper';
          confidence = 0.7;
          features.push('gripping', 'end-effector');
          reasoning.push('1 DOF gripper detected');
        } else {
          type = 'actuator';
          confidence = 0.6;
          features.push('single-dof', 'motion');
          reasoning.push('1 DOF motion device');
        }
      } else if (dof >= 2 && dof <= 3) {
        // Could be gripper, tool, or multi-axis actuator
        if (this.isGripperPattern(deviceName, kinematics)) {
          type = 'gripper';
          confidence = 0.8;
          features.push('gripping', 'multi-finger');
          reasoning.push(`${dof} DOF gripper detected`);
        } else if (this.isToolPattern(deviceName)) {
          type = 'tool';
          confidence = 0.8;
          features.push('specialized', 'tooling');
          reasoning.push(`${dof} DOF tool detected`);
        } else {
          type = 'actuator';
          confidence = 0.7;
          features.push('multi-axis', 'actuated');
          reasoning.push(`${dof} DOF actuator detected`);
        }
      } else if (dof >= 4 && dof <= 8) {
        // Likely a robot arm
        type = 'robot';
        confidence = 0.85;
        features.push('articulated', 'manipulator');
        reasoning.push(`${dof} DOF articulated arm`);
      } else if (dof > 8) {
        // Complex mechanism
        type = 'robot';
        confidence = 0.7;
        features.push('complex', 'multi-dof');
        reasoning.push(`Complex ${dof} DOF mechanism`);
      }
    }

    // Adjust confidence based on name patterns
    const nameConfidence = this.getNameConfidence(deviceName, type);
    confidence = Math.min(confidence + nameConfidence, 1.0);

    // Add geometric features
    if (geometry.hasLinearStructure) {
      features.push('linear');
      if (type === 'unknown') {
        type = 'conveyor';
        confidence = 0.6;
        reasoning.push('Linear structure detected');
      }
    }

    return {
      type,
      confidence,
      dof,
      reach: kinematics.maxReach,
      features,
      reasoning
    };
  }

  /**
   * Check if device matches gripper patterns
   */
  private isGripperPattern(deviceName: string, kinematics: any): boolean {
    const lowerName = deviceName.toLowerCase();
    
    // Name-based detection
    const gripperKeywords = ['gripper', 'hand', 'jaw', 'clamp', 'finger', 'grasp'];
    const hasGripperName = gripperKeywords.some(keyword => lowerName.includes(keyword));
    
    // Kinematic-based detection
    const hasParallelJoints = kinematics.jointTypes.filter((t: string) => t === 'prismatic').length > 0;
    const isCompact = kinematics.maxReach < 200; // Grippers typically have short reach
    
    return hasGripperName || (hasParallelJoints && isCompact);
  }

  /**
   * Detect specific device type from name patterns
   */
  private detectSpecificDeviceType(deviceName: string): DeviceType {
    // const _lowerName = deviceName.toLowerCase();
    
    // Valve patterns
    if (this.isValvePattern(deviceName)) return 'valve';
    
    // Actuator patterns
    if (this.isActuatorPattern(deviceName)) return 'actuator';
    
    // Motor patterns
    if (this.isMotorPattern(deviceName)) return 'motor';
    
    // Sensor patterns
    if (this.isSensorPattern(deviceName)) return 'sensor';
    
    // Tool patterns
    if (this.isToolPattern(deviceName)) return 'tool';
    
    // Clamp patterns
    if (this.isClampPattern(deviceName)) return 'clamp';
    
    // Pump patterns
    if (this.isPumpPattern(deviceName)) return 'pump';
    
    // Gear patterns
    if (this.isGearPattern(deviceName)) return 'gear';
    
    // Bearing patterns
    if (this.isBearingPattern(deviceName)) return 'bearing';
    
    return 'unknown';
  }

  /**
   * Check if device matches valve patterns
   */
  private isValvePattern(deviceName: string): boolean {
    const lowerName = deviceName.toLowerCase();
    const valveKeywords = [
      'valve', 'gate', 'ball', 'butterfly', 'check', 'relief', 'safety',
      'control', 'regulating', 'shutoff', 'isolation', 'globe', 'needle',
      'diaphragm', 'pinch', 'plug', 'knife', 'angle', 'y-pattern'
    ];
    return valveKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Check if device matches actuator patterns
   */
  private isActuatorPattern(deviceName: string): boolean {
    const lowerName = deviceName.toLowerCase();
    const actuatorKeywords = [
      'actuator', 'cylinder', 'pneumatic', 'hydraulic', 'electric', 'linear',
      'rotary', 'rack', 'pinion', 'screw', 'ball', 'lead', 'jack', 'ram'
    ];
    return actuatorKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Check if device matches motor patterns
   */
  private isMotorPattern(deviceName: string): boolean {
    const lowerName = deviceName.toLowerCase();
    const motorKeywords = [
      'motor', 'servo', 'stepper', 'dc', 'ac', 'brushless', 'brushed',
      'induction', 'synchronous', 'asynchronous', 'gear', 'reducer',
      'drive', 'controller', 'encoder', 'resolver'
    ];
    return motorKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Check if device matches sensor patterns
   */
  private isSensorPattern(deviceName: string): boolean {
    const lowerName = deviceName.toLowerCase();
    const sensorKeywords = [
      'sensor', 'probe', 'transducer', 'encoder', 'resolver', 'potentiometer',
      'proximity', 'inductive', 'capacitive', 'photoelectric', 'ultrasonic',
      'laser', 'vision', 'camera', 'force', 'torque', 'pressure', 'flow',
      'temperature', 'position', 'velocity', 'acceleration'
    ];
    return sensorKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Check if device matches tool patterns
   */
  private isToolPattern(deviceName: string): boolean {
    const lowerName = deviceName.toLowerCase();
    const toolKeywords = [
      'tool', 'welder', 'welding', 'cutter', 'cutting', 'drill', 'drilling',
      'mill', 'milling', 'grinder', 'grinding', 'polisher', 'polishing',
      'spray', 'painter', 'painting', 'dispenser', 'dispensing', 'pick',
      'place', 'assembly', 'assembling', 'inspection', 'testing'
    ];
    return toolKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Check if device matches clamp patterns
   */
  private isClampPattern(deviceName: string): boolean {
    const lowerName = deviceName.toLowerCase();
    const clampKeywords = [
      'clamp', 'vise', 'vice', 'chuck', 'collet', 'holder', 'grip',
      'gripping', 'holding', 'securing', 'fastening', 'locking'
    ];
    return clampKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Check if device matches pump patterns
   */
  private isPumpPattern(deviceName: string): boolean {
    const lowerName = deviceName.toLowerCase();
    const pumpKeywords = [
      'pump', 'compressor', 'blower', 'fan', 'blower', 'vacuum', 'suction',
      'centrifugal', 'positive', 'displacement', 'gear', 'vane', 'piston',
      'diaphragm', 'peristaltic', 'lobe', 'screw', 'progressive', 'cavity'
    ];
    return pumpKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Check if device matches gear patterns
   */
  private isGearPattern(deviceName: string): boolean {
    const lowerName = deviceName.toLowerCase();
    const gearKeywords = [
      'gear', 'pinion', 'rack', 'worm', 'bevel', 'helical', 'spur',
      'planetary', 'reducer', 'speed', 'reducer', 'gearbox', 'transmission',
      'differential', 'coupling', 'clutch', 'brake'
    ];
    return gearKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Check if device matches bearing patterns
   */
  private isBearingPattern(deviceName: string): boolean {
    const lowerName = deviceName.toLowerCase();
    const bearingKeywords = [
      'bearing', 'bushing', 'bush', 'journal', 'thrust', 'radial',
      'ball', 'roller', 'needle', 'tapered', 'spherical', 'plain',
      'sleeve', 'sliding', 'linear', 'guide', 'rail'
    ];
    return bearingKeywords.some(keyword => lowerName.includes(keyword));
  }

  /**
   * Get confidence boost based on device name
   */
  private getNameConfidence(deviceName: string, detectedType: DeviceType): number {
    const lowerName = deviceName.toLowerCase();
    
    switch (detectedType) {
      case 'robot': {
        const robotKeywords = ['robot', 'arm', 'manipulator', 'ur', 'kuka', 'abb', 'fanuc'];
        return robotKeywords.some(keyword => lowerName.includes(keyword)) ? 0.1 : 0;
      }
        
      case 'gripper': {
        const gripperKeywords = ['gripper', 'hand', 'jaw', 'clamp', 'robotiq', 'schunk'];
        return gripperKeywords.some(keyword => lowerName.includes(keyword)) ? 0.1 : 0;
      }
        
      case 'fixture':
        const fixtureKeywords = ['fixture', 'mount', 'clamp', 'holder', 'base'];
        return fixtureKeywords.some(keyword => lowerName.includes(keyword)) ? 0.1 : 0;
        
      case 'eot':
        const eotKeywords = ['tool', 'end', 'effector', 'welder', 'cutter'];
        return eotKeywords.some(keyword => lowerName.includes(keyword)) ? 0.1 : 0;
        
      case 'valve':
        return this.isValvePattern(deviceName) ? 0.1 : 0;
        
      case 'actuator':
        return this.isActuatorPattern(deviceName) ? 0.1 : 0;
        
      case 'motor':
        return this.isMotorPattern(deviceName) ? 0.1 : 0;
        
      case 'sensor':
        return this.isSensorPattern(deviceName) ? 0.1 : 0;
        
      case 'tool':
        return this.isToolPattern(deviceName) ? 0.1 : 0;
        
      case 'clamp':
        return this.isClampPattern(deviceName) ? 0.1 : 0;
        
      case 'pump':
        return this.isPumpPattern(deviceName) ? 0.1 : 0;
        
      case 'gear':
        return this.isGearPattern(deviceName) ? 0.1 : 0;
        
      case 'bearing':
        return this.isBearingPattern(deviceName) ? 0.1 : 0;
        
      default:
        return 0;
    }
  }

  /**
   * Extract gripper-specific properties
   */
  public extractGripperProperties(rootNodeId: string): GripperProperties | null {
    const classification = this.classifyDevice(rootNodeId);
    
    if (classification.type !== 'gripper' && classification.type !== 'eot') {
      return null;
    }

    // TODO: Analyze actual geometry to determine jaw properties
    // For now, use heuristics based on DOF and reach
    const jawWidth = Math.min(classification.reach || 50, 200); // Max 200mm
    const grippingForce = classification.dof * 50; // 50N per DOF
    const jawCount = classification.dof === 1 ? 2 : classification.dof; // Parallel vs multi-finger
    
    return {
      jawWidth,
      grippingForce,
      jawCount,
      isParallel: classification.dof === 1,
      hasForceControl: classification.dof >= 2
    };
  }

  /**
   * Extract robot-specific properties
   */
  public extractRobotProperties(rootNodeId: string): RobotProperties | null {
    const classification = this.classifyDevice(rootNodeId);
    
    if (classification.type !== 'robot') {
      return null;
    }

    // TODO: Analyze actual kinematic chain to determine workspace
    const workspace: 'spherical' | 'cylindrical' | 'rectangular' = 'spherical';
    const repeatability = 0.1; // 0.1mm typical
    const maxSpeed = 1.0; // 1 rad/s typical
    const payload = Math.min((classification.reach || 500) / 100, 50); // Rough estimate
    const reach = classification.reach || 500;

    return {
      workspace,
      repeatability,
      maxSpeed,
      payload,
      reach
    };
  }

  /**
   * Get specialized UI configuration for device type
   */
  public getDeviceUIConfig(deviceType: DeviceType): {
    showJogging: boolean;
    showForceControl: boolean;
    showWorkspace: boolean;
    customControls: string[];
  } {
    switch (deviceType) {
      case 'robot':
        return {
          showJogging: true,
          showForceControl: false,
          showWorkspace: true,
          customControls: ['joint-jog', 'tcp-jog', 'workspace-visualization']
        };
        
      case 'gripper':
        return {
          showJogging: true,
          showForceControl: true,
          showWorkspace: false,
          customControls: ['jaw-control', 'force-control', 'grip-force']
        };
        
      case 'eot':
        return {
          showJogging: true,
          showForceControl: false,
          showWorkspace: false,
          customControls: ['tool-control', 'activation']
        };
        
      case 'fixture':
        return {
          showJogging: false,
          showForceControl: false,
          showWorkspace: false,
          customControls: ['mounting-points']
        };
        
      case 'conveyor':
        return {
          showJogging: true,
          showForceControl: false,
          showWorkspace: false,
          customControls: ['speed-control', 'direction']
        };
        
      case 'valve':
        return {
          showJogging: true,
          showForceControl: false,
          showWorkspace: false,
          customControls: ['position-control', 'flow-rate', 'actuation-type']
        };
        
      case 'actuator':
        return {
          showJogging: true,
          showForceControl: true,
          showWorkspace: false,
          customControls: ['stroke-control', 'force-limit', 'speed-control']
        };
        
      case 'motor':
        return {
          showJogging: true,
          showForceControl: false,
          showWorkspace: false,
          customControls: ['speed-control', 'torque-limit', 'encoder-feedback']
        };
        
      case 'sensor':
        return {
          showJogging: false,
          showForceControl: false,
          showWorkspace: false,
          customControls: ['calibration', 'threshold-setting', 'data-logging']
        };
        
      case 'tool':
        return {
          showJogging: true,
          showForceControl: false,
          showWorkspace: false,
          customControls: ['tool-activation', 'parameter-setting', 'status-monitoring']
        };
        
      case 'clamp':
        return {
          showJogging: true,
          showForceControl: true,
          showWorkspace: false,
          customControls: ['clamping-force', 'position-control', 'release-control']
        };
        
      case 'pump':
        return {
          showJogging: true,
          showForceControl: false,
          showWorkspace: false,
          customControls: ['flow-rate', 'pressure-control', 'priming']
        };
        
      case 'gear':
        return {
          showJogging: false,
          showForceControl: false,
          showWorkspace: false,
          customControls: ['ratio-setting', 'backlash-compensation', 'lubrication']
        };
        
      case 'bearing':
        return {
          showJogging: false,
          showForceControl: false,
          showWorkspace: false,
          customControls: ['preload-setting', 'clearance-check', 'maintenance-schedule']
        };
        
      default:
        return {
          showJogging: false,
          showForceControl: false,
          showWorkspace: false,
          customControls: []
        };
    }
  }
}
