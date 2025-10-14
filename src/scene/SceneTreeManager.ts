// Scene Tree Manager - Manages hierarchical scene organization
// Owner: Cole

import {
  SceneNode,
  NodeType,
  createSceneNode,
  isContainerType,
  Vec3,
  createVec3,
} from './SceneTreeNode';

/**
 * Scene Tree Manager - Singleton managing all scene nodes
 */
export class SceneTreeManager {
  private static instance: SceneTreeManager | null = null;
  private nodes = new Map<string, SceneNode>();
  private rootNodeId: string | null = null;

  private constructor() {
    this.initializeTree();
  }

  static getInstance(): SceneTreeManager {
    if (!SceneTreeManager.instance) {
      SceneTreeManager.instance = new SceneTreeManager();
    }
    return SceneTreeManager.instance;
  }

  /**
   * Initialize the default tree structure
   */
  private initializeTree(): void {
    // Create root World node
    const world = createSceneNode('world', 'World', null);
    this.rootNodeId = world.id;
    this.nodes.set(world.id, world);

    // Create Scene node (all 3D content)
    const scene = createSceneNode('scene', 'Scene', world.id);
    this.nodes.set(scene.id, scene);
    world.childIds.push(scene.id);

    // Create System node (cameras, lights)
    const system = createSceneNode('system', 'System', world.id);
    this.nodes.set(system.id, system);
    world.childIds.push(system.id);

    // Create default Assets collection under Scene
    const assets = createSceneNode('collection', 'Assets', scene.id);
    assets.locked = false; // User can delete/rename this collection
    this.nodes.set(assets.id, assets);
    scene.childIds.push(assets.id);
  }

  /**
   * Create a new node
   */
  createNode(
    type: NodeType,
    name: string,
    parentId: string | null = null,
    position?: Vec3
  ): SceneNode {
    const node = createSceneNode(type, name, parentId);

    if (position) {
      node.position = position;
    }

    // Add to nodes map
    this.nodes.set(node.id, node);

    // Add to parent's children
    if (parentId) {
      const parent = this.nodes.get(parentId);
      if (parent) {
        parent.childIds.push(node.id);
      }
    }

    return node;
  }

  /**
   * Get node by ID
   */
  getNode(id: string): SceneNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): SceneNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get root node (World)
   */
  getRootNode(): SceneNode | undefined {
    return this.rootNodeId ? this.nodes.get(this.rootNodeId) : undefined;
  }

  /**
   * Get Scene node
   */
  getSceneNode(): SceneNode | undefined {
    const root = this.getRootNode();
    if (root) {
      return this.nodes.get(root.childIds[0]); // Scene is first child of World
    }
    return undefined;
  }

  /**
   * Get System node
   */
  getSystemNode(): SceneNode | undefined {
    const root = this.getRootNode();
    if (root) {
      return this.nodes.get(root.childIds[1]); // System is second child of World
    }
    return undefined;
  }

  /**
   * Get Assets collection node
   */
  getAssetsNode(): SceneNode | undefined {
    const scene = this.getSceneNode();
    if (scene && scene.childIds.length > 0) {
      return this.nodes.get(scene.childIds[0]); // Assets is first child of Scene
    }
    return undefined;
  }

  /**
   * @deprecated Use getAssetsNode() instead
   */
  getDevicesNode(): SceneNode | undefined {
    return this.getAssetsNode();
  }

  /**
   * Get node by Babylon mesh ID
   */
  getNodeByBabylonMeshId(meshId: string): SceneNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.babylonMeshId === meshId) {
        return node;
      }
    }
    return undefined;
  }

  /**
   * Get node by entity ID
   */
  getNodeByEntityId(entityId: string): SceneNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.entityId === entityId) {
        return node;
      }
    }
    return undefined;
  }

  /**
   * Get children of a node
   */
  getChildren(nodeId: string): SceneNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    return node.childIds.map((id) => this.nodes.get(id)).filter((n): n is SceneNode => !!n);
  }

  /**
   * Get parent of a node
   */
  getParent(nodeId: string): SceneNode | undefined {
    const node = this.nodes.get(nodeId);
    if (!node || !node.parentId) return undefined;
    return this.nodes.get(node.parentId);
  }

  /**
   * Update node position (local space)
   */
  setLocalPosition(nodeId: string, position: Vec3): void {
    const node = this.nodes.get(nodeId);
    if (node && !node.locked) {
      node.position = position;
    }
  }

  /**
   * Update node rotation (local space)
   */
  setLocalRotation(nodeId: string, rotation: Vec3): void {
    const node = this.nodes.get(nodeId);
    if (node && !node.locked) {
      node.rotation = rotation;
    }
  }

  /**
   * Update node scale
   */
  setScale(nodeId: string, scale: Vec3): void {
    const node = this.nodes.get(nodeId);
    if (node && !node.locked) {
      node.scale = scale;
    }
  }

  /**
   * Get world position of a node (accumulates parent transforms)
   */
  getWorldPosition(nodeId: string): Vec3 {
    const node = this.nodes.get(nodeId);
    if (!node) return createVec3();

    // If no parent, local position IS world position
    if (!node.parentId) {
      return { ...node.position };
    }

    // Recursively get parent world position and add local position
    // Note: This is simplified - proper implementation would apply rotation/scale
    const parentWorld = this.getWorldPosition(node.parentId);
    return {
      x: parentWorld.x + node.position.x,
      y: parentWorld.y + node.position.y,
      z: parentWorld.z + node.position.z,
    };
  }

  /**
   * Get effective visibility of a node (considering parent visibility)
   */
  getEffectiveVisibility(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // If this node is explicitly hidden, it's hidden regardless of parents
    if (!node.visible) return false;

    // If no parent, use local visibility
    if (!node.parentId) return node.visible;

    // Check parent visibility recursively
    return this.getEffectiveVisibility(node.parentId);
  }

  /**
   * Toggle node visibility
   */
  toggleVisibility(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      const newVisibility = !node.visible;
      this.setVisibility(nodeId, newVisibility);
    }
  }

  /**
   * Set node visibility
   */
  setVisibility(nodeId: string, visible: boolean): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Update the tree node visibility
    node.visible = visible;

    // Apply visibility to Babylon.js mesh if it exists
    this.applyVisibilityToBabylonMesh(nodeId, visible);

    // Handle hierarchical visibility: if hiding a parent, hide all children
    // If showing a parent, show all children (unless they were explicitly hidden)
    this.updateChildrenVisibility(nodeId, visible);
  }

  /**
   * Toggle node locked state
   */
  toggleLocked(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    // Cannot unlock system nodes (world, scene, system)
    if (node && node.type !== 'world' && node.type !== 'scene' && node.type !== 'system') {
      node.locked = !node.locked;
    }
  }

  /**
   * Toggle node expanded state
   */
  toggleExpanded(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node && isContainerType(node.type)) {
      node.expanded = !node.expanded;
    }
  }

  /**
   * Expand all parent nodes to reveal a specific node
   * Useful for auto-expanding tree when selecting an object in the viewer
   */
  expandToNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Recursively expand all parents
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent && isContainerType(parent.type)) {
        parent.expanded = true;
        // Recursively expand grandparents
        this.expandToNode(node.parentId);
      }
    }
  }

  /**
   * Delete node and its children
   */
  deleteNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node || node.locked) return false;

    // Remove from parent's children
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent) {
        parent.childIds = parent.childIds.filter((id) => id !== nodeId);
      }
    }

    // Recursively delete children
    const childrenToDelete = [...node.childIds];
    for (const childId of childrenToDelete) {
      this.deleteNode(childId);
    }

    // Delete this node
    this.nodes.delete(nodeId);
    return true;
  }

  /**
   * Rename node
   */
  renameNode(nodeId: string, newName: string): void {
    const node = this.nodes.get(nodeId);
    if (node && !node.locked) {
      node.name = newName;
    }
  }

  /**
   * Move node to a new parent (for drag-and-drop)
   */
  moveNode(nodeId: string, newParentId: string | null): boolean {
    const node = this.nodes.get(nodeId);
    if (!node || node.locked) return false;

    // Don't allow moving system nodes
    if (node.type === 'world' || node.type === 'scene' || node.type === 'system') {
      return false;
    }

    // Don't allow moving to itself or its own descendants
    if (nodeId === newParentId || this.isDescendant(nodeId, newParentId)) {
      return false;
    }

    // Don't allow moving if new parent doesn't exist (unless null)
    if (newParentId && !this.nodes.get(newParentId)) {
      return false;
    }

    // Remove from old parent
    if (node.parentId) {
      const oldParent = this.nodes.get(node.parentId);
      if (oldParent) {
        oldParent.childIds = oldParent.childIds.filter((id) => id !== nodeId);
      }
    }

    // Add to new parent
    if (newParentId) {
      const newParent = this.nodes.get(newParentId);
      if (newParent) {
        newParent.childIds.push(nodeId);
        node.parentId = newParentId;
      }
    } else {
      node.parentId = null;
    }

    return true;
  }

  /**
   * Check if a node is a descendant of another
   */
  private isDescendant(ancestorId: string, nodeId: string | null): boolean {
    if (!nodeId) return false;
    if (ancestorId === nodeId) return true;

    const node = this.nodes.get(nodeId);
    if (!node || !node.parentId) return false;

    return this.isDescendant(ancestorId, node.parentId);
  }

  /**
   * Get descendant count (recursive)
   */
  getDescendantCount(nodeId: string): number {
    const node = this.nodes.get(nodeId);
    if (!node) return 0;

    let count = node.childIds.length;
    for (const childId of node.childIds) {
      count += this.getDescendantCount(childId);
    }
    return count;
  }

  /**
   * Apply visibility to Babylon.js mesh
   */
  private applyVisibilityToBabylonMesh(nodeId: string, visible: boolean): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Import SceneManager dynamically to avoid circular dependencies
    import('./SceneManager').then(({ SceneManager }) => {
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();
      if (!scene) return;

      // Handle mesh nodes
      if (node.babylonMeshId) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (mesh) {
          mesh.setEnabled(visible);
          console.log(`[SceneTree] Set mesh "${mesh.name}" visibility to ${visible}`);
        }
      }

      // Handle transform node collections
      if (node.babylonTransformNodeId) {
        const transformNode = scene.getTransformNodeByUniqueId(parseInt(node.babylonTransformNodeId));
        if (transformNode) {
          transformNode.setEnabled(visible);
          console.log(`[SceneTree] Set transform node "${transformNode.name}" visibility to ${visible}`);
        }
      }
    }).catch(error => {
      console.error('[SceneTree] Failed to import SceneManager:', error);
    });
  }

  /**
   * Update children visibility based on parent visibility
   */
  private updateChildrenVisibility(nodeId: string, parentVisible: boolean): void {
    const children = this.getChildren(nodeId);
    
    for (const child of children) {
      // If parent is being hidden, hide all children
      if (!parentVisible) {
        child.visible = false;
        this.applyVisibilityToBabylonMesh(child.id, false);
      } else {
        // If parent is being shown, show children (they inherit parent visibility)
        // Only apply to Babylon.js mesh, don't change the tree node visibility state
        // unless the child was explicitly hidden
        this.applyVisibilityToBabylonMesh(child.id, true);
      }
      
      // Recursively update grandchildren
      this.updateChildrenVisibility(child.id, parentVisible);
    }
  }

  /**
   * Clear all nodes and reinitialize
   */
  reset(): void {
    this.nodes.clear();
    this.rootNodeId = null;
    this.initializeTree();
  }
}
