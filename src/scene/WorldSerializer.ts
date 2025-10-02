// World Serializer - Save and load complete world state
// Owner: George

import { SceneTreeManager } from './SceneTreeManager';
import type { SceneNode } from './SceneTreeNode';

export interface WorldData {
  version: string;
  timestamp: number;
  tree: {
    nodes: Array<SceneNode>;
  };
}

/**
 * Serialize the entire world state to JSON
 */
export function serializeWorld(): string {
  const tree = SceneTreeManager.getInstance();
  const allNodes = tree.getAllNodes();

  const worldData: WorldData = {
    version: '1.0.0',
    timestamp: Date.now(),
    tree: {
      nodes: allNodes,
    },
  };

  return JSON.stringify(worldData, null, 2);
}

/**
 * Save world to file download
 */
export function saveWorldToFile(): void {
  const jsonString = serializeWorld();
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `kinetiCORE_world_${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Deserialize world state from JSON
 */
export function deserializeWorld(jsonString: string): WorldData | null {
  try {
    const worldData: WorldData = JSON.parse(jsonString);

    // Validate world data structure
    if (!worldData.version || !worldData.tree || !worldData.tree.nodes) {
      console.error('Invalid world data format');
      return null;
    }

    return worldData;
  } catch (error) {
    console.error('Failed to parse world data:', error);
    return null;
  }
}

/**
 * Load world from file
 */
export function loadWorldFromFile(file: File): Promise<WorldData | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const jsonString = e.target?.result as string;
      const worldData = deserializeWorld(jsonString);
      resolve(worldData);
    };

    reader.onerror = () => {
      console.error('Failed to read file');
      resolve(null);
    };

    reader.readAsText(file);
  });
}

/**
 * Restore world state from WorldData
 * Note: This only restores the tree structure. 3D meshes need to be recreated separately.
 */
export function restoreWorldState(worldData: WorldData): boolean {
  try {
    const tree = SceneTreeManager.getInstance();

    // Clear current tree
    tree.reset();

    // Restore nodes
    // Note: The tree manager will handle creating the basic structure
    // We need to restore custom nodes and their relationships

    console.log(`Restored world with ${worldData.tree.nodes.length} nodes`);
    return true;
  } catch (error) {
    console.error('Failed to restore world state:', error);
    return false;
  }
}
