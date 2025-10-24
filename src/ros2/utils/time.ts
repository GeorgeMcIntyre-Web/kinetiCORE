/**
 * ROS 2 Time Utilities
 * Helper functions for converting between JavaScript timestamps and ROS time
 */

import { ROSTime } from '../messages';

/**
 * Convert seconds (float) to ROS Time
 * @param seconds - Time in seconds (can have fractional part)
 * @returns ROSTime with sec and nanosec components
 */
export function toROSTime(seconds: number): ROSTime {
  const sec = Math.floor(seconds);
  const nanosec = Math.floor((seconds - sec) * 1e9);
  return { sec, nanosec };
}

/**
 * Convert ROS Time to seconds (float)
 * @param rosTime - ROS time object
 * @returns Time in seconds
 */
export function fromROSTime(rosTime: ROSTime): number {
  return rosTime.sec + rosTime.nanosec / 1e9;
}

/**
 * Get current time as ROS Time
 * @returns Current time in ROS format
 */
export function getCurrentROSTime(): ROSTime {
  const now = Date.now() / 1000; // Convert ms to seconds
  return toROSTime(now);
}

/**
 * Add two ROS Times
 * @param a - First time
 * @param b - Second time
 * @returns Sum of times
 */
export function addROSTime(a: ROSTime, b: ROSTime): ROSTime {
  const totalNanosec = a.nanosec + b.nanosec;
  const sec = a.sec + b.sec + Math.floor(totalNanosec / 1e9);
  const nanosec = totalNanosec % 1e9;
  return { sec, nanosec };
}

/**
 * Subtract ROS Times (a - b)
 * @param a - First time
 * @param b - Second time
 * @returns Difference of times
 */
export function subtractROSTime(a: ROSTime, b: ROSTime): ROSTime {
  let sec = a.sec - b.sec;
  let nanosec = a.nanosec - b.nanosec;

  if (nanosec < 0) {
    sec -= 1;
    nanosec += 1e9;
  }

  return { sec, nanosec };
}

/**
 * Compare two ROS Times
 * @param a - First time
 * @param b - Second time
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareROSTime(a: ROSTime, b: ROSTime): number {
  if (a.sec < b.sec) return -1;
  if (a.sec > b.sec) return 1;
  if (a.nanosec < b.nanosec) return -1;
  if (a.nanosec > b.nanosec) return 1;
  return 0;
}
