/**
 * ROS 2 TF2 Message Types
 * Based on geometry_msgs/msg/TransformStamped and tf2_msgs/msg/TFMessage
 * http://docs.ros.org/en/humble/p/geometry_msgs/interfaces/msg/TransformStamped.html
 */

import { ROSHeader } from './JointTrajectory';

/**
 * 3D vector (translation)
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Quaternion (rotation)
 */
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * 3D transform (position + rotation)
 */
export interface Transform {
  translation: Vector3;
  rotation: Quaternion;
}

/**
 * Timestamped transform between two coordinate frames
 */
export interface TransformStamped {
  /** Header with timestamp and parent frame */
  header: ROSHeader;

  /** Child coordinate frame ID */
  child_frame_id: string;

  /** Transform from parent frame to child frame */
  transform: Transform;
}

/**
 * ROS 2 TF message (array of transforms)
 */
export interface TFMessage {
  transforms: TransformStamped[];
}
