/**
 * Configuration Space Sampler
 * Generates random robot configurations for path planning
 */

import { JointAngles } from './types';

export interface JointLimits {
  id: string;
  lower: number;  // Radians
  upper: number;  // Radians
}

export class ConfigurationSampler {
  private jointLimits: JointLimits[];

  constructor(jointLimits: JointLimits[]) {
    this.jointLimits = jointLimits;
  }

  /**
   * Sample a random configuration within joint limits
   */
  sampleRandom(): JointAngles {
    return this.jointLimits.map(joint => {
      const range = joint.upper - joint.lower;
      return joint.lower + Math.random() * range;
    });
  }

  /**
   * Sample with bias toward a goal configuration
   * @param goal - Goal configuration
   * @param biasProbability - Probability of returning goal (0-1)
   */
  sampleWithGoalBias(goal: JointAngles, biasProbability: number): JointAngles {
    if (Math.random() < biasProbability) {
      return [...goal];
    }
    return this.sampleRandom();
  }

  /**
   * Interpolate between two configurations
   * @param start - Start configuration
   * @param end - End configuration
   * @param t - Interpolation parameter (0-1)
   */
  interpolate(start: JointAngles, end: JointAngles, t: number): JointAngles {
    return start.map((angle, i) => {
      return angle + (end[i] - angle) * t;
    });
  }

  /**
   * Calculate distance between two configurations in joint space
   */
  distance(config1: JointAngles, config2: JointAngles): number {
    let sum = 0;
    for (let i = 0; i < config1.length; i++) {
      const diff = config2[i] - config1[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Extend from one configuration toward another by a fixed step size
   * @param from - Starting configuration
   * @param to - Target configuration
   * @param stepSize - Maximum step size in joint space
   * @returns New configuration extended toward target
   */
  extend(from: JointAngles, to: JointAngles, stepSize: number): JointAngles {
    const dist = this.distance(from, to);
    if (dist <= stepSize) {
      return [...to];
    }

    const t = stepSize / dist;
    return this.interpolate(from, to, t);
  }

  /**
   * Check if configuration is within joint limits
   */
  isValid(config: JointAngles): boolean {
    return config.every((angle, i) => {
      const limits = this.jointLimits[i];
      return angle >= limits.lower && angle <= limits.upper;
    });
  }

  /**
   * Clamp configuration to joint limits
   */
  clamp(config: JointAngles): JointAngles {
    return config.map((angle, i) => {
      const limits = this.jointLimits[i];
      return Math.max(limits.lower, Math.min(limits.upper, angle));
    });
  }
}
