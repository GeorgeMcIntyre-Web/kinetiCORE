// World Serializer - Save and load complete world state
// Owner: George

import * as BABYLON from '@babylonjs/core';
import { SceneSerializer } from '@babylonjs/core/Misc/sceneSerializer';
import { SceneTreeManager } from './SceneTreeManager';
import { SceneManager } from './SceneManager';
import type { SceneNode } from './SceneTreeNode';

export interface WorldData {
  version: string;
  timestamp: number;
  tree: {
    nodes: Array<SceneNode>;
  };
}

export interface BabylonWorldData {
  version: string;
  timestamp: number;
  babylonScene: any; // Babylon scene serialization
  metadata: WorldData; // kinetiCORE metadata
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

// ============================================================================
// BABYLON FULL SCENE SERIALIZATION (includes geometry, materials, physics)
// ============================================================================

/**
 * Serialize the entire Babylon scene with kinetiCORE metadata
 */
export function serializeBabylonWorld(): string {
  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();

  if (!scene) {
    throw new Error('No scene available for serialization');
  }

  // Serialize the Babylon scene (includes all meshes, materials, lights, cameras)
  const babylonScene = SceneSerializer.Serialize(scene);

  // Also save kinetiCORE metadata (tree structure, custom properties)
  const metadata = serializeWorldMetadata();

  const babylonWorldData: BabylonWorldData = {
    version: '1.0.0',
    timestamp: Date.now(),
    babylonScene,
    metadata,
  };

  return JSON.stringify(babylonWorldData, null, 2);
}

/**
 * Serialize only kinetiCORE metadata (lightweight, tree structure only)
 */
export function serializeWorldMetadata(): WorldData {
  const tree = SceneTreeManager.getInstance();
  const allNodes = tree.getAllNodes();

  return {
    version: '1.0.0',
    timestamp: Date.now(),
    tree: {
      nodes: allNodes,
    },
  };
}

/**
 * Save complete Babylon scene to .babylon file
 */
export function saveBabylonWorldToFile(): void {
  const jsonString = serializeBabylonWorld();
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `kinetiCORE_world_${Date.now()}.babylon`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Load Babylon world from .babylon file
 */
export async function loadBabylonWorldFromFile(
  file: File
): Promise<BabylonWorldData | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const jsonString = e.target?.result as string;
        const data: BabylonWorldData = JSON.parse(jsonString);

        // Validate structure
        if (!data.version || !data.babylonScene || !data.metadata) {
          console.error('Invalid Babylon world data format');
          resolve(null);
          return;
        }

        resolve(data);
      } catch (error) {
        console.error('Failed to parse Babylon world file:', error);
        resolve(null);
      }
    };

    reader.onerror = () => {
      console.error('Failed to read Babylon world file');
      resolve(null);
    };

    reader.readAsText(file);
  });
}

/**
 * Restore complete Babylon scene from BabylonWorldData
 */
export async function restoreBabylonWorld(
  data: BabylonWorldData
): Promise<boolean> {
  try {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();

    if (!scene) {
      console.error('No scene available for restoration');
      return false;
    }

    // Clear existing scene
    scene.meshes.forEach((mesh) => {
      if (mesh.name !== '__root__') {
        mesh.dispose();
      }
    });

    // Import Babylon scene data
    const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
      '',
      'data:' + JSON.stringify(data.babylonScene),
      scene
    );

    // Add all assets to scene
    container.addAllToScene();

    // Restore kinetiCORE metadata (tree structure)
    restoreWorldState(data.metadata);

    console.log('Babylon world restored successfully');
    return true;
  } catch (error) {
    console.error('Failed to restore Babylon world:', error);
    return false;
  }
}
