// Deterministic snap anchor scoring and selection
// Owner: George

import type { SnapAnchor, SnapAnchorType } from './types';

/**
 * Type-based priority weights (higher = higher priority)
 * These weights ensure consistent ordering when distances are similar
 */
const TYPE_WEIGHTS: Record<SnapAnchorType, number> = {
  vertex: 4,      // Most precise - actual mesh vertices
  edgeMid: 3,     // Precise point on edge
  faceCenter: 2,  // Circle centers or face centers
  bbox: 1,        // Bounding box features
  object: 0,      // Lowest priority - object center
};

/**
 * Distance penalty factor (meters)
 * Higher = distance matters more relative to type priority
 * Current: 100 means 10mm difference = 1 point (balances type vs distance)
 * This ensures very close lower-priority beats distant higher-priority
 */
const DISTANCE_PENALTY_FACTOR = 100;

/**
 * Calculate deterministic score for a snap anchor
 * Higher score = higher priority
 *
 * Scoring formula:
 *   score = typeWeight - (distance * penaltyFactor)
 *
 * This ensures:
 * - Type priority is respected (vertex > edge > face > bbox > object)
 * - Among same type, closer is better
 * - Deterministic ordering for stable selection
 *
 * @param anchor - The snap anchor to score
 * @returns Numeric score (higher is better)
 */
export function score(anchor: SnapAnchor): number {
  const typeWeight = TYPE_WEIGHTS[anchor.type];
  const distPenalty = anchor.distance * DISTANCE_PENALTY_FACTOR;
  return typeWeight - distPenalty;
}

/**
 * Generate unique key for deduplication
 * Format: meshId:localIndex:type
 *
 * @param anchor - The snap anchor
 * @returns Unique key string
 */
export function uniqueKey(anchor: SnapAnchor): string {
  return `${anchor.meshId}:${anchor.localIndex}:${anchor.type}`;
}

/**
 * Select the best anchor from a list of candidates
 * Handles deduplication and deterministic ordering
 *
 * Algorithm:
 * 1. Deduplicate by uniqueKey (keep highest score for duplicates)
 * 2. Sort by score descending
 * 3. On tie, sort by uniqueKey for determinism
 * 4. Return highest scoring anchor
 *
 * @param anchors - List of candidate anchors
 * @returns Best anchor, or null if list is empty
 */
export function pickBest(anchors: SnapAnchor[]): SnapAnchor | null {
  if (anchors.length === 0) return null;

  // Step 1: Deduplicate - keep highest score for each unique key
  const deduped = new Map<string, SnapAnchor>();

  for (const anchor of anchors) {
    const key = uniqueKey(anchor);
    const existing = deduped.get(key);

    if (!existing || score(anchor) > score(existing)) {
      deduped.set(key, anchor);
    }
  }

  // Step 2: Sort by score (descending), then by uniqueKey for determinism
  const sorted = Array.from(deduped.values()).sort((a, b) => {
    const scoreDiff = score(b) - score(a);

    // If scores are very close (within 0.0001), use uniqueKey for stable ordering
    if (Math.abs(scoreDiff) < 0.0001) {
      return uniqueKey(a).localeCompare(uniqueKey(b));
    }

    return scoreDiff;
  });

  // Step 3: Return best
  return sorted[0];
}

/**
 * Filter anchors within a distance threshold and return top N
 * Useful for visualizing multiple snap candidates
 *
 * @param anchors - List of candidate anchors
 * @param maxDistance - Maximum distance to include (meters)
 * @param topN - Maximum number of results to return
 * @returns Sorted list of best anchors within distance
 */
export function pickTopN(
  anchors: SnapAnchor[],
  maxDistance: number,
  topN: number = 5
): SnapAnchor[] {
  // Deduplicate first
  const deduped = new Map<string, SnapAnchor>();

  for (const anchor of anchors) {
    if (anchor.distance > maxDistance) continue;

    const key = uniqueKey(anchor);
    const existing = deduped.get(key);

    if (!existing || score(anchor) > score(existing)) {
      deduped.set(key, anchor);
    }
  }

  // Sort and take top N
  return Array.from(deduped.values())
    .sort((a, b) => {
      const scoreDiff = score(b) - score(a);
      if (Math.abs(scoreDiff) < 0.0001) {
        return uniqueKey(a).localeCompare(uniqueKey(b));
      }
      return scoreDiff;
    })
    .slice(0, topN);
}
