/**
 * RRT Tree Data Structure
 * Efficient nearest-neighbor queries and path extraction
 */

import { JointAngles, RRTNode } from './types';
import { ConfigurationSampler } from './ConfigurationSampler';

export class RRTTree {
  private nodes: RRTNode[];
  private sampler: ConfigurationSampler;

  constructor(root: JointAngles, sampler: ConfigurationSampler) {
    this.nodes = [{
      config: root,
      parent: null,
      cost: 0
    }];
    this.sampler = sampler;
  }

  /**
   * Get root node
   */
  getRoot(): RRTNode {
    return this.nodes[0];
  }

  /**
   * Get all nodes
   */
  getNodes(): RRTNode[] {
    return this.nodes;
  }

  /**
   * Find nearest node to a given configuration
   */
  findNearest(config: JointAngles): RRTNode {
    let nearest = this.nodes[0];
    let minDist = this.sampler.distance(config, nearest.config);

    for (let i = 1; i < this.nodes.length; i++) {
      const dist = this.sampler.distance(config, this.nodes[i].config);
      if (dist < minDist) {
        minDist = dist;
        nearest = this.nodes[i];
      }
    }

    return nearest;
  }

  /**
   * Add a new node to the tree
   */
  addNode(config: JointAngles, parent: RRTNode): RRTNode {
    const cost = parent.cost + this.sampler.distance(parent.config, config);
    const node: RRTNode = {
      config,
      parent,
      cost
    };
    this.nodes.push(node);
    return node;
  }

  /**
   * Extract path from root to a given node
   */
  extractPath(node: RRTNode): JointAngles[] {
    const path: JointAngles[] = [];
    let current: RRTNode | null = node;

    while (current !== null) {
      path.unshift(current.config);
      current = current.parent;
    }

    return path;
  }

  /**
   * Get number of nodes in tree
   */
  size(): number {
    return this.nodes.length;
  }

  /**
   * Extend tree toward a configuration by step size
   * @returns New node if extension successful, null otherwise
   */
  extend(target: JointAngles, stepSize: number): RRTNode | null {
    const nearest = this.findNearest(target);
    const newConfig = this.sampler.extend(nearest.config, target, stepSize);

    // Check if we actually moved
    const dist = this.sampler.distance(nearest.config, newConfig);
    if (dist < 1e-6) {
      return null;
    }

    const newNode = this.addNode(newConfig, nearest);
    return newNode;
  }

  /**
   * Try to connect tree to a target configuration
   * Returns the closest node if connection fails
   */
  connect(target: JointAngles, stepSize: number): {
    node: RRTNode;
    reached: boolean;
  } {
    let current = this.findNearest(target);

    while (true) {
      const dist = this.sampler.distance(current.config, target);

      if (dist < stepSize) {
        // Reached target
        const finalNode = this.addNode(target, current);
        return { node: finalNode, reached: true };
      }

      const newConfig = this.sampler.extend(current.config, target, stepSize);
      const newNode = this.addNode(newConfig, current);
      current = newNode;

      // Check if we're stuck
      const newDist = this.sampler.distance(newNode.config, target);
      if (newDist >= dist - 1e-6) {
        // No progress made
        return { node: current, reached: false };
      }
    }
  }
}
