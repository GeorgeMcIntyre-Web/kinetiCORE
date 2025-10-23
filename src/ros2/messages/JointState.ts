/**
 * ROS 2 JointState Message Types
 * Based on sensor_msgs/msg/JointState
 * http://docs.ros.org/en/humble/p/sensor_msgs/interfaces/msg/JointState.html
 */

import { ROSHeader } from './JointTrajectory';

/**
 * ROS 2 JointState message
 * Reports the current state of all robot joints
 */
export interface JointState {
  /** Standard ROS header with timestamp */
  header: ROSHeader;

  /** Names of joints being reported */
  name: string[];

  /** Current joint positions [rad or m] */
  position: number[];

  /** Current joint velocities [rad/s or m/s] */
  velocity: number[];

  /** Current joint efforts/torques [N or N⋅m] */
  effort: number[];
}
