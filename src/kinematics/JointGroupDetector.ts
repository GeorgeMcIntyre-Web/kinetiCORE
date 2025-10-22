/**
 * Joint Group Detector
 * Owner: George
 *
 * Automatically detects logical groups of joints in complex robots
 * Uses naming conventions to group joints (e.g., left_arm, right_leg, etc.)
 */

import type { JointConfig } from './KinematicsManager';

export interface JointGroup {
  name: string;
  displayName: string;
  joints: JointConfig[];
  icon?: string; // Emoji or icon identifier
}

/**
 * Common joint group patterns
 */
const GROUP_PATTERNS = [
  // Arms
  { pattern: /left.*arm|arm.*left|l_arm/i, name: 'left_arm', displayName: 'Left Arm', icon: '🦾' },
  { pattern: /right.*arm|arm.*right|r_arm/i, name: 'right_arm', displayName: 'Right Arm', icon: '🦾' },

  // Legs
  { pattern: /left.*leg|leg.*left|l_leg/i, name: 'left_leg', displayName: 'Left Leg', icon: '🦵' },
  { pattern: /right.*leg|leg.*right|r_leg/i, name: 'right_leg', displayName: 'Right Leg', icon: '🦵' },

  // Hands/Grippers
  { pattern: /left.*hand|hand.*left|l_hand|left.*gripper/i, name: 'left_hand', displayName: 'Left Hand', icon: '✋' },
  { pattern: /right.*hand|hand.*right|r_hand|right.*gripper/i, name: 'right_hand', displayName: 'Right Hand', icon: '✋' },

  // Head/Neck
  { pattern: /head|neck/i, name: 'head', displayName: 'Head', icon: '👤' },

  // Torso/Spine
  { pattern: /torso|spine|waist|chest/i, name: 'torso', displayName: 'Torso', icon: '🫀' },

  // Fingers (individual)
  { pattern: /finger.*thumb|thumb/i, name: 'thumb', displayName: 'Thumb', icon: '👍' },
  { pattern: /finger.*index|index.*finger/i, name: 'index_finger', displayName: 'Index Finger', icon: '☝️' },
  { pattern: /finger.*middle|middle.*finger/i, name: 'middle_finger', displayName: 'Middle Finger', icon: '🖕' },
  { pattern: /finger.*ring|ring.*finger/i, name: 'ring_finger', displayName: 'Ring Finger', icon: '💍' },
  { pattern: /finger.*pinky|pinky|little.*finger/i, name: 'pinky', displayName: 'Pinky', icon: '🤙' },
];

/**
 * Detect joint groups from a list of joints
 */
export function detectJointGroups(joints: JointConfig[]): JointGroup[] {
  const groups: JointGroup[] = [];
  const assignedJoints = new Set<string>();

  // First pass: assign joints to known patterns
  for (const { pattern, name, displayName, icon } of GROUP_PATTERNS) {
    const groupJoints = joints.filter(joint => {
      if (assignedJoints.has(joint.id)) return false;
      return pattern.test(joint.name) || pattern.test(joint.id);
    });

    if (groupJoints.length > 0) {
      groups.push({
        name,
        displayName,
        joints: groupJoints,
        icon,
      });

      // Mark joints as assigned
      groupJoints.forEach(j => assignedJoints.add(j.id));
    }
  }

  // Second pass: group remaining joints by common prefix
  const unassignedJoints = joints.filter(j => !assignedJoints.has(j.id));

  if (unassignedJoints.length > 0) {
    const prefixGroups = groupByPrefix(unassignedJoints);

    for (const [prefix, prefixJoints] of Object.entries(prefixGroups)) {
      if (prefixJoints.length >= 2) { // Only create group if 2+ joints
        groups.push({
          name: prefix,
          displayName: formatGroupName(prefix),
          joints: prefixJoints,
          icon: '⚙️',
        });

        prefixJoints.forEach(j => assignedJoints.add(j.id));
      }
    }
  }

  // Third pass: put any remaining joints in "Other" group
  const stillUnassigned = joints.filter(j => !assignedJoints.has(j.id));

  if (stillUnassigned.length > 0) {
    groups.push({
      name: 'other',
      displayName: 'Other',
      joints: stillUnassigned,
      icon: '🔧',
    });
  }

  // Sort groups: arms, legs, hands, head, torso, fingers, other
  const orderMap: Record<string, number> = {
    left_arm: 1,
    right_arm: 2,
    left_leg: 3,
    right_leg: 4,
    left_hand: 5,
    right_hand: 6,
    head: 7,
    torso: 8,
    thumb: 9,
    index_finger: 10,
    middle_finger: 11,
    ring_finger: 12,
    pinky: 13,
    other: 999,
  };

  groups.sort((a, b) => {
    const orderA = orderMap[a.name] ?? 100;
    const orderB = orderMap[b.name] ?? 100;
    return orderA - orderB;
  });

  return groups;
}

/**
 * Group joints by common prefix (e.g., "shoulder_", "wrist_")
 */
function groupByPrefix(joints: JointConfig[]): Record<string, JointConfig[]> {
  const prefixMap: Record<string, JointConfig[]> = {};

  for (const joint of joints) {
    // Extract prefix (everything before first underscore or number)
    const match = joint.name.match(/^([a-zA-Z]+)(?:_|\d)/);
    const prefix = match ? match[1] : joint.name;

    if (!prefixMap[prefix]) {
      prefixMap[prefix] = [];
    }

    prefixMap[prefix].push(joint);
  }

  return prefixMap;
}

/**
 * Format group name for display (capitalize, replace underscores)
 */
function formatGroupName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Check if joints should be grouped (>10 joints suggests complex robot)
 */
export function shouldUseJointGroups(jointCount: number): boolean {
  return jointCount > 10;
}
