/**
 * ROS 2 JointTrajectory Message Types
 * Based on trajectory_msgs/msg/JointTrajectory
 * http://docs.ros.org/en/humble/p/trajectory_msgs/interfaces/msg/JointTrajectory.html
 */

/**
 * ROS 2 Time stamp
 */
export interface ROSTime {
  sec: number;
  nanosec: number;
}

/**
 * ROS 2 Header
 */
export interface ROSHeader {
  stamp: ROSTime;
  frame_id: string;
}

/**
 * Single waypoint in a joint-space trajectory
 */
export interface JointTrajectoryPoint {
  /** Desired joint positions [rad or m] */
  positions: number[];

  /** Desired joint velocities [rad/s or m/s] (optional) */
  velocities?: number[];

  /** Desired joint accelerations [rad/s² or m/s²] (optional) */
  accelerations?: number[];

  /** Desired joint efforts/torques [N or N⋅m] (optional) */
  effort?: number[];

  /** Time from trajectory start to reach this waypoint */
  time_from_start: ROSTime;
}

/**
 * ROS 2 JointTrajectory message
 * Describes a joint-space trajectory for a robot
 */
export interface JointTrajectory {
  /** Standard ROS header with timestamp and coordinate frame */
  header: ROSHeader;

  /** Names of joints for which trajectory is specified */
  joint_names: string[];

  /** Array of trajectory waypoints */
  points: JointTrajectoryPoint[];
}

/**
 * JointTrajectory action goal (for FollowJointTrajectory)
 */
export interface FollowJointTrajectoryGoal {
  trajectory: JointTrajectory;

  /** Tolerances for goal achievement (optional) */
  path_tolerance?: JointTolerance[];
  goal_tolerance?: JointTolerance[];

  /** Time tolerance for goal achievement */
  goal_time_tolerance?: ROSTime;
}

/**
 * Joint tolerance specification
 */
export interface JointTolerance {
  name: string;
  position?: number;
  velocity?: number;
  acceleration?: number;
}
