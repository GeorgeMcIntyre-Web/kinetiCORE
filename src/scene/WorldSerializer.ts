// World Serializer - Save and load complete world state
// Owner: George

import * as BABYLON from '@babylonjs/core';
import { SceneSerializer } from '@babylonjs/core/Misc/sceneSerializer';
import { SceneTreeManager } from './SceneTreeManager';
import { SceneManager } from './SceneManager';
import { EntityRegistry } from '../entities/EntityRegistry';
import { userToBabylon } from '../core/CoordinateSystem';
import { AssetReference, Vector3 } from '../core/types';
import { toast } from '../ui/components/ToastNotifications';
import type { SceneNode } from './SceneTreeNode';
import { ConnectionManager } from '../routing/core/ConnectionManager';
import { useRoutingStore } from '../ui/store/routingStore';
import { Route } from '../routing/core/Route';
import type {
  ConnectionSpecifications,
  Route as RouteModel,
  RouteConstraints,
  RouteSegment,
  SupportPoint,
} from '../routing/core/types';

export interface WorldData {
  version: string;
  timestamp: number;
  tree: {
    nodes: Array<SceneNode>;
  };
  routing?: SerializedRoutingState;
}

export interface BabylonWorldData {
  version: string;
  timestamp: number;
  babylonScene: any; // Babylon scene serialization
  metadata: WorldData; // kinetiCORE metadata
}

export type SerializedVector3 = [number, number, number];

export interface SerializedConnector {
  id: string;
  type: RouteModel['type'];
  position: SerializedVector3;
  direction: SerializedVector3;
  specifications: ConnectionSpecifications;
  parentObject?: string;
}

export interface SerializedSegment {
  id: string;
  startPoint: SerializedVector3;
  endPoint: SerializedVector3;
  segmentType: RouteSegment['segmentType'];
  bendRadius?: number;
  length: number;
}

export interface SerializedSupport {
  id: string;
  position: SerializedVector3;
  type: SupportPoint['type'];
  specification: string;
}

export interface SerializedRoute {
  id: string;
  type: RouteModel['type'];
  sourceId: string;
  destinationId: string;
  segments: SerializedSegment[];
  supports: SerializedSupport[];
  material: RouteModel['material'];
  constraints: RouteConstraints;
  generated: boolean;
}

export interface SerializedRoutingState {
  version: string;
  connectors: SerializedConnector[];
  routes: SerializedRoute[];
}

const ROUTING_SERIALIZATION_VERSION = '1.0.0';

function vector3ToSerialized(vector: Vector3): SerializedVector3 {
  return [vector.x, vector.y, vector.z];
}

function serializedToVector3(tuple: SerializedVector3): Vector3 {
  const [x, y, z] = tuple;
  return { x, y, z };
}

export interface JointData {
  id: string;
  name: string;
  type: 'revolute' | 'prismatic' | 'continuous' | 'fixed' | 'planar' | 'floating';
  parent: string;
  child: string;
  origin: { x: number; y: number; z: number; rx: number; ry: number; rz: number };
  axis?: { x: number; y: number; z: number };
  limits?: { lower: number; upper: number; effort: number; velocity: number };
}

export interface LinkData {
  id: string;
  name: string;
  visual?: { geometry: string; material?: string };
  collision?: { geometry: string };
  inertial?: { mass: number; origin: { x: number; y: number; z: number; rx: number; ry: number; rz: number } };
}

export interface KinematicChainData {
  id: string;
  name: string;
  links: LinkData[];
  joints: JointData[];
  rootLink?: string;
}

export interface ComprehensiveWorldData {
  version: string;
  timestamp: number;
  format: 'comprehensive';

  // Scene structure
  tree: {
    nodes: Array<SceneNode>;
  };

  // Routing system state
  routing?: SerializedRoutingState;

  // Babylon.js scene data
  babylonScene: any;
  
  // External assets (mesh files, textures, etc.)
  assets: {
    meshes: AssetReference[];
    textures: AssetReference[];
    materials: MaterialData[];
  };
  
  // Physics state
  physics: {
    enabled: boolean;
    gravity: { x: number; y: number; z: number };
    entities: PhysicsEntityData[];
  };
  
  // Kinematics data
  kinematics: {
    devices: KinematicDeviceData[];
    joints: JointData[];
    chains: KinematicChainData[];
  };
  
  // Custom metadata
  metadata: {
    sceneName: string;
    description?: string;
    tags: string[];
    customProperties: Record<string, unknown>;
  };
}

/**
 * Validate comprehensive world data before saving
 */
export function validateWorldData(worldData: ComprehensiveWorldData): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!worldData.version) {
    errors.push('Missing version field');
  }
  if (!worldData.timestamp) {
    errors.push('Missing timestamp field');
  }
  if (!worldData.format || worldData.format !== 'comprehensive') {
    errors.push('Invalid format field');
  }

  // Validate tree structure
  if (!worldData.tree || !worldData.tree.nodes) {
    errors.push('Missing tree structure');
  } else {
    const nodeIds = new Set<string>();
    const parentIds = new Set<string>();
    
    for (const node of worldData.tree.nodes) {
      if (!node.id) {
        errors.push('Node missing ID');
        continue;
      }
      
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);
      
      if (node.parentId && node.parentId !== 'world') {
        parentIds.add(node.parentId);
      }
    }
    
    // Check for orphaned nodes
    for (const parentId of parentIds) {
      if (!nodeIds.has(parentId)) {
        errors.push(`Node references non-existent parent: ${parentId}`);
      }
    }
  }

  // Validate assets
  if (worldData.assets) {
    if (worldData.assets.meshes) {
      for (const mesh of worldData.assets.meshes) {
        if (!mesh.id || !mesh.name || !mesh.type) {
          errors.push('Invalid mesh asset data');
        }
      }
    }

    if (worldData.assets.materials) {
      for (const material of worldData.assets.materials) {
        if (!material.id || !material.name || !material.type) {
          errors.push('Invalid material data');
        }
      }
    }
  }

  if (worldData.routing) {
    const connectorIds = new Set<string>();
    for (const connector of worldData.routing.connectors) {
      if (!connector.id) {
        errors.push('Routing connector missing ID');
        continue;
      }
      if (connectorIds.has(connector.id)) {
        errors.push(`Duplicate routing connector ID: ${connector.id}`);
      }
      connectorIds.add(connector.id);
    }

    for (const route of worldData.routing.routes) {
      if (!route.id) {
        errors.push('Routing route missing ID');
      }
      if (route.sourceId && !connectorIds.has(route.sourceId)) {
        errors.push(`Route ${route.id} references unknown source connector ${route.sourceId}`);
      }
      if (route.destinationId && !connectorIds.has(route.destinationId)) {
        errors.push(`Route ${route.id} references unknown destination connector ${route.destinationId}`);
      }
    }
  }

  // Validate kinematics
  if (worldData.kinematics) {
    if (worldData.kinematics.joints) {
      for (const joint of worldData.kinematics.joints) {
        if (!joint.id || !joint.name || !joint.type) {
          errors.push('Invalid joint data');
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate world data after loading
 */
export function validateLoadedWorld(scene: BABYLON.Scene, tree: any): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check for missing meshes
  const treeNodes = tree.getAllNodes();
  for (const node of treeNodes) {
    if (node.type === 'mesh' && node.babylonMeshId) {
      const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
      if (!mesh) {
        warnings.push(`Missing mesh for node: ${node.name} (ID: ${node.babylonMeshId})`);
      }
    }
  }

  // Check for orphaned meshes
  const sceneMeshes = scene.meshes.filter(m => 
    m.name !== 'ground' && 
    m.name !== '__root__' && 
    !m.name.startsWith('grid')
  );
  
  for (const mesh of sceneMeshes) {
    const hasTreeNode = treeNodes.some((node: any) => 
      node.babylonMeshId === mesh.uniqueId.toString()
    );
    if (!hasTreeNode) {
      warnings.push(`Orphaned mesh in scene: ${mesh.name}`);
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings
  };
}

export interface MaterialData {
  id: string;
  name: string;
  type: 'standard' | 'pbr' | 'custom';
  properties: {
    diffuseColor?: { r: number; g: number; b: number };
    emissiveColor?: { r: number; g: number; b: number };
    specularColor?: { r: number; g: number; b: number };
    alpha?: number;
    metallic?: number;
    roughness?: number;
    textureMaps?: Record<string, string>; // Map type to asset ID
  };
}

export interface PhysicsEntityData {
  entityId: string;
  enabled: boolean;
  type: 'static' | 'dynamic' | 'kinematic';
  mass: number;
  shape: 'box' | 'sphere' | 'cylinder' | 'mesh';
  dimensions?: { x: number; y: number; z: number };
  radius?: number;
  height?: number;
  meshAssetId?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

export interface KinematicDeviceData {
  id: string;
  name: string;
  type: 'robot' | 'gripper' | 'actuator';
  rootNodeId: string;
  links: LinkData[];
  joints: JointData[];
  urdfPath?: string;
  meshFiles: string[];
}

export interface KinematicChainData {
  id: string;
  name: string;
  type: 'serial' | 'parallel' | 'tree';
  rootNodeId: string;
  jointIds: string[];
}

/**
 * Serialize routing system state (connection points and routes)
 */
export function serializeRoutingState(): SerializedRoutingState | undefined {
  const connectionManager = ConnectionManager.getInstance();
  const connectors = connectionManager.getAllConnectionPoints();
  const routes = useRoutingStore.getState().activeRoutes;

  if (connectors.length === 0 && routes.length === 0) {
    return undefined;
  }

  const serializedConnectors: SerializedConnector[] = connectors.map((connector) => ({
    id: connector.getId(),
    type: connector.getType(),
    position: vector3ToSerialized(connector.getPosition()),
    direction: vector3ToSerialized(connector.getDirection()),
    specifications: { ...connector.specifications },
    parentObject: connector.parentObject,
  }));

  const serializedRoutes: SerializedRoute[] = routes.map((route) => ({
    id: route.getId(),
    type: route.type,
    sourceId: route.source.getId(),
    destinationId: route.destination.getId(),
    segments: route.segments.map((segment) => ({
      id: segment.id,
      startPoint: vector3ToSerialized(segment.startPoint),
      endPoint: vector3ToSerialized(segment.endPoint),
      segmentType: segment.segmentType,
      bendRadius: segment.bendRadius,
      length: segment.length,
    })),
    supports: route.supports.map((support) => ({
      id: support.id,
      position: vector3ToSerialized(support.position),
      type: support.type,
      specification: support.specification,
    })),
    material: {
      ...route.material,
      properties: route.material.properties ? { ...route.material.properties } : undefined,
    },
    constraints: JSON.parse(JSON.stringify(route.constraints)) as RouteConstraints,
    generated: route.generated,
  }));

  return {
    version: ROUTING_SERIALIZATION_VERSION,
    connectors: serializedConnectors,
    routes: serializedRoutes,
  };
}

/**
 * Restore routing state from serialized data
 */
export function restoreRoutingState(routing?: SerializedRoutingState | null): void {
  const connectionManager = ConnectionManager.getInstance();
  const routingStore = useRoutingStore.getState();
  const registry = EntityRegistry.getInstance();

  // Clear existing routing data
  connectionManager.clear();
  routingStore.clearConnectionPoints();
  routingStore.clearRoutes();
  routingStore.clearValidationResults();
  routingStore.clearSelection();
  routingStore.selectRoute(null);
  routingStore.setPreviewRoute(null);
  routingStore.setRoutingMode('off');

  if (!routing || routing.connectors.length === 0) {
    return;
  }

  const connectorMap = new Map<string, ReturnType<typeof connectionManager.addConnectionPoint>>();

  for (const connector of routing.connectors) {
    const config = {
      type: connector.type,
      position: serializedToVector3(connector.position),
      direction: serializedToVector3(connector.direction),
      specifications: { ...connector.specifications } as ConnectionSpecifications,
      parentObject: connector.parentObject,
    };

    const point = connectionManager.addConnectionPoint(config);
    connectorMap.set(connector.id, point);

    if (connector.parentObject) {
      const entity = registry.get(connector.parentObject);
      entity?.addConnectionPointId(point.getId());
    }

    routingStore.addConnectionPoint(point);
  }

  for (const serializedRoute of routing.routes) {
    const source = connectorMap.get(serializedRoute.sourceId);
    const destination = connectorMap.get(serializedRoute.destinationId);

    if (!source || !destination) {
      console.warn(`Skipping route ${serializedRoute.id} - missing connectors`);
      continue;
    }

    const segments: RouteSegment[] = serializedRoute.segments.map((segment) => ({
      id: segment.id,
      startPoint: serializedToVector3(segment.startPoint),
      endPoint: serializedToVector3(segment.endPoint),
      segmentType: segment.segmentType,
      bendRadius: segment.bendRadius,
      length: segment.length,
    }));

    const supports: SupportPoint[] = serializedRoute.supports.map((support) => ({
      id: support.id,
      position: serializedToVector3(support.position),
      type: support.type,
      specification: support.specification,
    }));

    const material = {
      ...serializedRoute.material,
      properties: serializedRoute.material?.properties
        ? { ...serializedRoute.material.properties }
        : undefined,
    } as RouteModel['material'];

    const constraints = JSON.parse(JSON.stringify(serializedRoute.constraints)) as RouteConstraints;

    const route = Route.createWithType(
      serializedRoute.id,
      source,
      destination,
      serializedRoute.type,
      segments,
      supports,
      material,
      constraints
    );
    route.generated = serializedRoute.generated;

    routingStore.addRoute(route);
    connectionManager.createConnection(source.getId(), destination.getId(), route.getId());
  }
}

/**
 * Serialize the entire world state to JSON (legacy - metadata only)
 */
export function serializeWorld(): string {
  const tree = SceneTreeManager.getInstance();
  const allNodes = tree.getAllNodes();

  const routing = serializeRoutingState();

  const worldData: WorldData = {
    version: '1.0.0',
    timestamp: Date.now(),
    tree: {
      nodes: allNodes,
    },
    routing,
  };

  return JSON.stringify(worldData, null, 2);
}

/**
 * Serialize comprehensive world state including all assets and data
 */
export async function serializeComprehensiveWorld(): Promise<string> {
  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();
  const tree = SceneTreeManager.getInstance();
  const registry = EntityRegistry.getInstance();

  if (!scene) {
    throw new Error('No scene available for serialization');
  }

  console.log('🔄 Starting comprehensive world serialization...');

  // Get all scene tree nodes
  const allNodes = tree.getAllNodes();

  // Serialize Babylon.js scene
  const babylonScene = SceneSerializer.Serialize(scene);

  // Collect all assets (meshes, textures, materials)
  const assets = await collectSceneAssets(scene);

  // Collect physics data
  const physics = collectPhysicsData(scene, registry);

  // Collect kinematics data
  const kinematics = await collectKinematicsData(scene, tree);
  const routing = serializeRoutingState();

  // Create comprehensive world data
  const worldData: ComprehensiveWorldData = {
    version: '2.0.0',
    timestamp: Date.now(),
    format: 'comprehensive',
    tree: {
      nodes: allNodes,
    },
    routing,
    babylonScene,
    assets,
    physics,
    kinematics,
    metadata: {
      sceneName: 'kinetiCORE Scene',
      description: 'Comprehensive scene with all assets and data',
      tags: ['kineticore', 'comprehensive'],
      customProperties: {},
    },
  };

  // Validate before serializing
  const validation = validateWorldData(worldData);
  if (!validation.isValid) {
    console.error('World data validation failed:', validation.errors);
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  console.log(`✅ Comprehensive serialization complete: ${assets.meshes.length} meshes, ${assets.materials.length} materials, ${physics.entities.length} physics entities`);
  
  return JSON.stringify(worldData, null, 2);
}

/**
 * Collect all scene assets (meshes, textures, materials)
 */
async function collectSceneAssets(scene: BABYLON.Scene): Promise<ComprehensiveWorldData['assets']> {
  const meshes: AssetReference[] = [];
  const textures: AssetReference[] = [];
  const materials: MaterialData[] = [];

  // Collect mesh assets
  for (const mesh of scene.meshes) {
    if (mesh.name === 'ground' || mesh.name === '__root__' || mesh.name.startsWith('grid')) {
      continue; // Skip system meshes
    }

    // Check if this mesh has external file data
    const meshMetadata = mesh.metadata;
    if (meshMetadata?.urdfMeshPath || meshMetadata?.originalFilePath) {
      const path = meshMetadata.urdfMeshPath || meshMetadata.originalFilePath;
      const assetId = `mesh_${mesh.uniqueId}`;
      
      meshes.push({
        id: assetId,
        name: mesh.name,
        type: 'mesh',
        path: path,
        size: 0, // Will be calculated if we can access the file
        checksum: '', // Will be calculated if we can access the file
      });
    }
  }

  // Collect material data
  const materialMap = new Map<string, BABYLON.Material>();
  for (const mesh of scene.meshes) {
    if (mesh.material && !materialMap.has(mesh.material.uniqueId.toString())) {
      materialMap.set(mesh.material.uniqueId.toString(), mesh.material);
    }
  }

  for (const [materialId, material] of materialMap.entries()) {
    if (material instanceof BABYLON.StandardMaterial) {
      materials.push({
        id: materialId,
        name: material.name,
        type: 'standard',
        properties: {
          diffuseColor: material.diffuseColor ? {
            r: material.diffuseColor.r,
            g: material.diffuseColor.g,
            b: material.diffuseColor.b,
          } : undefined,
          emissiveColor: material.emissiveColor ? {
            r: material.emissiveColor.r,
            g: material.emissiveColor.g,
            b: material.emissiveColor.b,
          } : undefined,
          specularColor: material.specularColor ? {
            r: material.specularColor.r,
            g: material.specularColor.g,
            b: material.specularColor.b,
          } : undefined,
          alpha: material.alpha,
        },
      });
    }
  }

  return {
    meshes,
    textures,
    materials,
  };
}

/**
 * Collect physics data from scene
 */
function collectPhysicsData(scene: BABYLON.Scene, registry: EntityRegistry): ComprehensiveWorldData['physics'] {
  const entities: PhysicsEntityData[] = [];

  // Get physics engine
  const physicsEngine = scene.getPhysicsEngine();
  const gravity = physicsEngine ? physicsEngine.gravity : { x: 0, y: -9.81, z: 0 };

  // Collect physics data from entities
  const allEntities = registry.getAll();
  for (const entity of allEntities) {
    if (entity.getMesh()) {
      const mesh = entity.getMesh();
      const physicsEnabled = entity.isPhysicsEnabled();
      
      entities.push({
        entityId: entity.getId(),
        enabled: physicsEnabled,
        type: physicsEnabled ? 'dynamic' : 'static',
        mass: 1.0, // Default mass
        shape: 'box', // Default shape
        position: {
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z,
        },
        rotation: {
          x: mesh.rotation.x,
          y: mesh.rotation.y,
          z: mesh.rotation.z,
        },
      });
    }
  }

  return {
    enabled: !!physicsEngine,
    gravity,
    entities,
  };
}

/**
 * Collect kinematics data from scene
 */
async function collectKinematicsData(_scene: BABYLON.Scene, _tree: SceneTreeManager): Promise<ComprehensiveWorldData['kinematics']> {
  const devices: KinematicDeviceData[] = [];
  const joints: JointData[] = [];
  const chains: KinematicChainData[] = [];

  // This would integrate with the KinematicsManager to collect joint and chain data
  // For now, return empty data - this would be implemented based on your kinematics system
  
  return {
    devices,
    joints,
    chains,
  };
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
 * Save comprehensive world to file download
 */
export async function saveComprehensiveWorldToFile(): Promise<void> {
  try {
    const jsonString = await serializeComprehensiveWorld();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `kinetiCORE_comprehensive_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    
    toast.success('Comprehensive world saved successfully!');
  } catch (error) {
    console.error('Failed to save comprehensive world:', error);
    toast.error('Failed to save comprehensive world. Check console for details.');
    throw error;
  }
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
 * Load comprehensive world from file
 */
export async function loadComprehensiveWorldFromFile(file: File): Promise<ComprehensiveWorldData | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const jsonString = e.target?.result as string;
        const worldData: ComprehensiveWorldData = JSON.parse(jsonString);

        // Validate comprehensive world data structure
        if (!worldData.version || !worldData.format || worldData.format !== 'comprehensive') {
          console.error('Invalid comprehensive world data format');
          resolve(null);
          return;
        }

        resolve(worldData);
      } catch (error) {
        console.error('Failed to parse comprehensive world data:', error);
        resolve(null);
      }
    };

    reader.onerror = () => {
      console.error('Failed to read comprehensive world file');
      resolve(null);
    };

    reader.readAsText(file);
  });
}

/**
 * Restore comprehensive world state
 */
export async function restoreComprehensiveWorld(worldData: ComprehensiveWorldData): Promise<boolean> {
  try {
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    const tree = SceneTreeManager.getInstance();
    const registry = EntityRegistry.getInstance();

    if (!scene) {
      console.error('No scene available for comprehensive restoration');
      return false;
    }

    console.log('🔄 Starting comprehensive world restoration...');

    // Clear current scene
    await clearScene(scene, tree, registry);

    // Restore Babylon.js scene
    if (worldData.babylonScene) {
      await restoreBabylonScene(scene, worldData.babylonScene);
    }

    // Restore scene tree
    if (worldData.tree) {
      restoreWorldState(worldData as WorldData, true);
    }

    // Restore materials
    if (worldData.assets?.materials) {
      await restoreMaterials(scene, worldData.assets.materials);
    }

    // Restore physics
    if (worldData.physics) {
      await restorePhysics(scene, registry, worldData.physics);
    }

    // Restore kinematics
    if (worldData.kinematics) {
      await restoreKinematics(worldData.kinematics);
    }

    console.log('✅ Comprehensive world restoration complete');
    toast.success('Comprehensive world loaded successfully!');
    
    // Validate loaded world
    const validation = validateLoadedWorld(scene, tree);
    if (!validation.isValid) {
      console.warn('Loaded world validation warnings:', validation.warnings);
      validation.warnings.forEach(warning => {
        console.warn(`⚠️ ${warning}`);
      });
    }
    
    // Ensure UI is updated after all restoration is complete
    setTimeout(() => {
      window.dispatchEvent(new Event('scenetree-update'));
      console.log('🔄 Final scenetree-update event dispatched after comprehensive restoration');
    }, 200);
    
    return true;
  } catch (error) {
    console.error('Failed to restore comprehensive world:', error);
    toast.error('Failed to restore comprehensive world. Check console for details.');
    return false;
  }
}

/**
 * Clear scene for restoration
 */
async function clearScene(scene: BABYLON.Scene, tree: SceneTreeManager, registry: EntityRegistry): Promise<void> {
  // Clear scene tree
  tree.reset();
  
  // Clear entity registry
  registry.clear();
  
  // Clear meshes (except system meshes)
  scene.meshes.forEach((mesh) => {
    if (mesh.name !== 'ground' && mesh.name !== '__root__' && !mesh.name.startsWith('grid')) {
      mesh.dispose();
    }
  });

  // Clear transform nodes (except system nodes)
  scene.transformNodes.forEach((node) => {
    if (node.name !== '__root__' && !node.name.startsWith('__root')) {
      node.dispose();
    }
  });

  // Clear materials (except system materials)
  scene.materials.forEach((material) => {
    if (!material.name.startsWith('__') && material.name !== 'ground') {
      material.dispose();
    }
  });
}

/**
 * Restore Babylon.js scene
 */
async function restoreBabylonScene(scene: BABYLON.Scene, babylonSceneData: any): Promise<void> {
  try {
    console.log('🔄 Restoring Babylon.js scene...');
    
    if (!babylonSceneData) {
      console.log('⚠️ No Babylon scene data to restore');
      return;
    }

    // Clear existing meshes and materials (except system ones)
    scene.meshes.forEach((mesh) => {
      if (mesh.name !== 'ground' && mesh.name !== '__root__' && !mesh.name.startsWith('grid')) {
        mesh.dispose();
      }
    });

    scene.materials.forEach((material) => {
      if (material.name !== 'ground') {
        material.dispose();
      }
    });

    // Create a temporary scene to load the serialized data
    const tempScene = new BABYLON.Scene(scene.getEngine());
    
    try {
      // Load the serialized scene data into temporary scene
      const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
        '',
        'data:' + JSON.stringify(babylonSceneData),
        tempScene
      );

      // Transfer meshes and materials to main scene
      for (const mesh of container.meshes) {
        if (mesh.name !== '__root__' && mesh.name !== 'ground') {
          // Create new mesh in main scene
          const newMesh = mesh.clone(mesh.name, null);
          if (newMesh) {
            newMesh.setEnabled(true);
            // Preserve metadata if it exists
            if (mesh.metadata) {
              newMesh.metadata = { ...mesh.metadata };
            }
          }
        }
      }

      // Transfer materials
      for (const material of container.materials) {
        if (material.name !== 'ground') {
          const newMaterial = material.clone(material.name);
          if (newMaterial) {
            // Apply to meshes that were using this material
            container.meshes.forEach(mesh => {
              if (mesh.material === material) {
                const correspondingMesh = scene.getMeshByName(mesh.name);
                if (correspondingMesh) {
                  correspondingMesh.material = newMaterial;
                }
              }
            });
          }
        }
      }

      // Transfer lights (preserve existing camera)
      for (const light of container.lights) {
        if (light.name !== 'defaultLight') {
          const newLight = light.clone(light.name);
          if (newLight) {
            newLight.setEnabled(true);
          }
        }
      }

      console.log(`✅ Restored ${container.meshes.length} meshes, ${container.materials.length} materials, ${container.lights.length} lights`);
      
    } finally {
      // Clean up temporary scene
      tempScene.dispose();
    }
    
  } catch (error) {
    console.error('Failed to restore Babylon scene:', error);
    console.log('⚠️ Falling back to mesh recreation method');
    // Don't throw - let the fallback method handle it
  }
}

/**
 * Restore materials
 */
async function restoreMaterials(scene: BABYLON.Scene, materials: MaterialData[]): Promise<void> {
  for (const materialData of materials) {
    try {
      if (materialData.type === 'standard') {
        const material = new BABYLON.StandardMaterial(materialData.name, scene);
        
        if (materialData.properties.diffuseColor) {
          material.diffuseColor = new BABYLON.Color3(
            materialData.properties.diffuseColor.r,
            materialData.properties.diffuseColor.g,
            materialData.properties.diffuseColor.b
          );
        }
        
        if (materialData.properties.emissiveColor) {
          material.emissiveColor = new BABYLON.Color3(
            materialData.properties.emissiveColor.r,
            materialData.properties.emissiveColor.g,
            materialData.properties.emissiveColor.b
          );
        }
        
        if (materialData.properties.alpha !== undefined) {
          material.alpha = materialData.properties.alpha;
        }
      }
    } catch (error) {
      console.error(`Failed to restore material ${materialData.name}:`, error);
    }
  }
}

/**
 * Restore physics
 */
async function restorePhysics(scene: BABYLON.Scene, registry: EntityRegistry, physicsData: ComprehensiveWorldData['physics']): Promise<void> {
  // Set physics engine gravity
  const physicsEngine = scene.getPhysicsEngine();
  if (physicsEngine && physicsData.gravity) {
    physicsEngine.gravity = new BABYLON.Vector3(
      physicsData.gravity.x,
      physicsData.gravity.y,
      physicsData.gravity.z
    );
  }

  // Restore physics for entities
  for (const entityData of physicsData.entities) {
    try {
      const entity = registry.get(entityData.entityId);
      if (entity && entityData.enabled) {
        // Enable physics for the entity
        // This would need to be implemented based on your physics system
        console.log(`Restoring physics for entity ${entityData.entityId}`);
      }
    } catch (error) {
      console.error(`Failed to restore physics for entity ${entityData.entityId}:`, error);
    }
  }
}

/**
 * Restore kinematics
 */
async function restoreKinematics(kinematicsData: ComprehensiveWorldData['kinematics']): Promise<void> {
  // This would integrate with the KinematicsManager to restore joint and chain data
  console.log(`Restoring ${kinematicsData.devices.length} devices, ${kinematicsData.joints.length} joints, ${kinematicsData.chains.length} chains`);
}

/**
 * Restore world state from WorldData
 * This restores both the tree structure and recreates the 3D meshes
 */
export function restoreWorldState(worldData: WorldData, isComprehensive: boolean = false): boolean {
  try {
    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    const registry = EntityRegistry.getInstance();

    if (!scene) {
      console.error('No scene available for restoration');
      return false;
    }

    // Clear current tree and scene
    tree.reset();

    // Clear existing meshes (except ground and system meshes)
    scene.meshes.forEach((mesh) => {
      if (mesh.name !== 'ground' && mesh.name !== '__root__' && !mesh.name.startsWith('grid')) {
        mesh.dispose();
      }
    });

    // Clear existing transform nodes (except system nodes)
    scene.transformNodes.forEach((node) => {
      if (node.name !== '__root__' && !node.name.startsWith('__root')) {
        node.dispose();
      }
    });

    // Clear entity registry
    registry.clear();

    // Restore nodes and recreate meshes
    const nodesToRestore = worldData.tree.nodes.filter(node => 
      node.type !== 'world' && node.type !== 'scene' && node.type !== 'system'
    );

    console.log(`Restoring ${nodesToRestore.length} nodes...`);

    // First pass: Create all nodes in the tree structure (without parent relationships)
    const nodeMap = new Map<string, SceneNode>();
    
    for (const nodeData of nodesToRestore) {
      // Create node without parent first to avoid broken parent relationships
      const restoredNode = tree.createNode(
        nodeData.type,
        nodeData.name,
        null, // No parent initially
        nodeData.position
      );
      
      // Copy all properties except parentId (we'll fix relationships later)
      Object.assign(restoredNode, nodeData);
      nodeMap.set(nodeData.id, restoredNode);
      
      console.log(`🌳 Created tree node: ${restoredNode.name} (${restoredNode.type})`);
    }
    
    // Second pass: Fix parent-child relationships
    for (const nodeData of nodesToRestore) {
      const restoredNode = nodeMap.get(nodeData.id);
      if (!restoredNode || !nodeData.parentId) continue;
      
      const parentNode = nodeMap.get(nodeData.parentId);
      if (parentNode) {
        // Add to parent's children
        parentNode.childIds.push(restoredNode.id);
        restoredNode.parentId = parentNode.id;
        console.log(`🌳 Linked ${restoredNode.name} to parent ${parentNode.name}`);
      } else {
        // If parent doesn't exist, add to Assets collection
        const assetsNode = tree.getAllNodes().find(node => node.name === 'Assets');
        if (assetsNode) {
          assetsNode.childIds.push(restoredNode.id);
          restoredNode.parentId = assetsNode.id;
          console.log(`🌳 Linked ${restoredNode.name} to Assets collection (parent not found)`);
        }
      }
    }
    
    console.log(`🌳 Tree now has ${tree.getAllNodes().length} nodes`);
    console.log('🌳 Final tree state after restoration:', tree.getAllNodes());
    
    // Debug: Check if root node exists and has children
    const rootNode = tree.getRootNode();
    console.log('🌳 Root node:', rootNode);
    if (rootNode) {
      const rootChildren = tree.getChildren(rootNode.id);
      console.log('🌳 Root children:', rootChildren);
    }

    // Third pass: Recreate meshes and entities
    for (const nodeData of nodesToRestore) {
      const restoredNode = nodeMap.get(nodeData.id);
      if (!restoredNode) continue;

      // Recreate mesh for mesh nodes
      if (restoredNode.type === 'mesh' && restoredNode.babylonMeshId) {
        try {
          // Check if this is a URDF mesh (from imported robot)
          const isURDFMesh = restoredNode.name.includes('_visual') || 
                            restoredNode.name.includes('_placeholder') ||
                            restoredNode.name.includes('.stl') ||
                            restoredNode.name.includes('.dae');
          
          if (isURDFMesh && !isComprehensive) {
            // Create a placeholder for URDF meshes since we can't recreate the original geometry
            // Skip this for comprehensive files - we should try to restore the actual mesh
            const placeholder = BABYLON.MeshBuilder.CreateBox(
              `${restoredNode.name}_placeholder`,
              { size: 0.1 }, // Small placeholder
              scene
            );
            
            // Apply saved transform
            const babylonPos = userToBabylon(restoredNode.position);
            placeholder.position.copyFrom(babylonPos);
            
            const radiansX = (restoredNode.rotation.x * Math.PI) / 180;
            const radiansY = (restoredNode.rotation.y * Math.PI) / 180;
            const radiansZ = (restoredNode.rotation.z * Math.PI) / 180;
            placeholder.rotation.set(radiansX, radiansY, radiansZ);
            
            placeholder.scaling.set(restoredNode.scale.x, restoredNode.scale.y, restoredNode.scale.z);

            // Create distinctive material for URDF placeholders
            const material = new BABYLON.StandardMaterial(`mat_${placeholder.name}`, scene);
            material.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2); // Red-ish color
            material.alpha = 0.7; // Semi-transparent
            material.wireframe = true; // Wireframe to indicate it's a placeholder
            placeholder.material = material;

            // Mark as URDF placeholder
            placeholder.metadata = {
              isURDFPlaceholder: true,
              needsOriginalMesh: true
            };

            // Create entity
            const entity = registry.create({
              mesh: placeholder,
              physics: {
                enabled: false,
                type: 'dynamic',
                mass: 1.0,
                shape: 'box',
                dimensions: { x: 0.1, y: 0.1, z: 0.1 }
              },
              metadata: {
                name: placeholder.name,
                type: 'urdf-placeholder'
              },
            });

            // Update node references
            restoredNode.babylonMeshId = placeholder.uniqueId.toString();
            restoredNode.entityId = entity.getId();
            
            console.warn(`Created URDF placeholder for ${restoredNode.name} - original mesh files needed for full restoration`);
          } else if (isURDFMesh && isComprehensive) {
            // For comprehensive files, try to restore URDF meshes as boxes with proper transforms
            console.log(`🔄 Restoring URDF mesh: ${restoredNode.name}`);
            
            // Create a box mesh for URDF components
            const mesh = BABYLON.MeshBuilder.CreateBox(
              restoredNode.name,
              { 
                width: restoredNode.scale.x || 0.1,
                height: restoredNode.scale.y || 0.1, 
                depth: restoredNode.scale.z || 0.1
              },
              scene
            );
            
            if (mesh) {
              // Apply saved transform
              const babylonPos = userToBabylon(restoredNode.position);
              mesh.position.copyFrom(babylonPos);
              
              const radiansX = (restoredNode.rotation.x * Math.PI) / 180;
              const radiansY = (restoredNode.rotation.y * Math.PI) / 180;
              const radiansZ = (restoredNode.rotation.z * Math.PI) / 180;
              mesh.rotation.set(radiansX, radiansY, radiansZ);
              
              mesh.scaling.set(restoredNode.scale.x, restoredNode.scale.y, restoredNode.scale.z);
              
              console.log(`🎯 URDF mesh ${mesh.name} positioned at:`, {
                position: babylonPos,
                rotation: { x: radiansX, y: radiansY, z: radiansZ },
                scale: { x: restoredNode.scale.x, y: restoredNode.scale.y, z: restoredNode.scale.z },
                originalPosition: restoredNode.position,
                originalRotation: restoredNode.rotation,
                originalScale: restoredNode.scale
              });
              
              // Debug: Log the coordinate conversion details
              console.log(`🔄 Coordinate conversion for ${mesh.name}:`, {
                originalPos: restoredNode.position,
                originalPosValues: { x: restoredNode.position.x, y: restoredNode.position.y, z: restoredNode.position.z },
                convertedPos: babylonPos,
                convertedPosValues: { x: babylonPos.x, y: babylonPos.y, z: babylonPos.z },
                userToBabylonResult: userToBabylon(restoredNode.position)
              });
              
              // Debug: Log the actual values directly
              console.log(`🔍 ${mesh.name} - Original position values:`, restoredNode.position.x, restoredNode.position.y, restoredNode.position.z);
              console.log(`🔍 ${mesh.name} - Converted position values:`, babylonPos.x, babylonPos.y, babylonPos.z);
              
              // Debug: Log the actual saved position data from the file
              console.log(`📄 ${mesh.name} - Saved position data:`, {
                x: restoredNode.position.x,
                y: restoredNode.position.y, 
                z: restoredNode.position.z,
                rawPosition: restoredNode.position
              });
              
              // Debug: Log actual position values
              console.log(`📍 ${mesh.name} actual position:`, {
                x: mesh.position.x,
                y: mesh.position.y, 
                z: mesh.position.z
              });

              // Create distinctive material for URDF meshes
              const material = new BABYLON.StandardMaterial(`mat_${mesh.name}`, scene);
              material.diffuseColor = new BABYLON.Color3(0.8, 0.2, 0.2); // Red color
              material.wireframe = true; // Wireframe to distinguish from regular meshes
              mesh.material = material;

              // Create entity
              const entity = registry.create({
                mesh: mesh,
                metadata: {
                  name: restoredNode.name,
                  type: 'urdf-mesh'
                },
              });

              // Update node references
              restoredNode.babylonMeshId = mesh.uniqueId.toString();
              restoredNode.entityId = entity.getId();
              
              console.log(`✅ Restored URDF mesh: ${restoredNode.name}`);
            }
          } else {
            // Handle regular primitive meshes
            const meshType = getMeshTypeFromNode(restoredNode);
            
            if (meshType) {
              // Create the mesh
              const mesh = createMeshByType(meshType, restoredNode.name, scene);
              
              if (mesh) {
                // Apply saved transform
                const babylonPos = userToBabylon(restoredNode.position);
                mesh.position.copyFrom(babylonPos);
                
                const radiansX = (restoredNode.rotation.x * Math.PI) / 180;
                const radiansY = (restoredNode.rotation.y * Math.PI) / 180;
                const radiansZ = (restoredNode.rotation.z * Math.PI) / 180;
                mesh.rotation.set(radiansX, radiansY, radiansZ);
                
                mesh.scaling.set(restoredNode.scale.x, restoredNode.scale.y, restoredNode.scale.z);

                // Create material
                const material = new BABYLON.StandardMaterial(`mat_${mesh.name}`, scene);
                material.diffuseColor = new BABYLON.Color3(
                  Math.random(),
                  Math.random(),
                  Math.random()
                );
                mesh.material = material;

                // Create entity
                const entity = registry.create({
                  mesh,
                  physics: {
                    enabled: false,
                    type: 'dynamic',
                    mass: 1.0,
                    shape: getPhysicsShape(meshType),
                    ...getPhysicsParams(meshType)
                  },
                  metadata: {
                    name: mesh.name,
                    type: meshType,
                  },
                });

                // Update node references
                restoredNode.babylonMeshId = mesh.uniqueId.toString();
                restoredNode.entityId = entity.getId();
              }
            }
          }
        } catch (error) {
          console.error(`Failed to recreate mesh for node ${restoredNode.name}:`, error);
        }
      }
      
      // Recreate transform nodes for collections
      else if (restoredNode.type === 'collection') {
        try {
          const transformNode = new BABYLON.TransformNode(restoredNode.name, scene);
          
          // Apply saved transform
          const babylonPos = userToBabylon(restoredNode.position);
          transformNode.position.copyFrom(babylonPos);
          
          const radiansX = (restoredNode.rotation.x * Math.PI) / 180;
          const radiansY = (restoredNode.rotation.y * Math.PI) / 180;
          const radiansZ = (restoredNode.rotation.z * Math.PI) / 180;
          transformNode.rotation.set(radiansX, radiansY, radiansZ);
          
          transformNode.scaling.set(restoredNode.scale.x, restoredNode.scale.y, restoredNode.scale.z);

          // Update node reference
          restoredNode.babylonTransformNodeId = transformNode.uniqueId.toString();
        } catch (error) {
          console.error(`Failed to recreate transform node for ${restoredNode.name}:`, error);
        }
      }
    }

    // Count URDF placeholders created (only for non-comprehensive files)
    if (!isComprehensive) {
      const urdfPlaceholders = scene.meshes.filter(mesh => 
        mesh.metadata?.isURDFPlaceholder === true
      ).length;
      
      if (urdfPlaceholders > 0) {
        console.warn(`⚠️ Created ${urdfPlaceholders} URDF placeholders - original mesh files needed for full robot restoration`);
        console.warn(`To restore the full robot, re-import the URDF file with its mesh files`);
        toast.warning(`Robot loaded with ${urdfPlaceholders} placeholder(s). Re-import URDF with mesh files for full restoration.`);
      }
    } else {
      // For comprehensive files, count restored URDF meshes
      const urdfMeshes = scene.meshes.filter(mesh => 
        mesh.metadata?.type === 'urdf-mesh'
      ).length;
      
      if (urdfMeshes > 0) {
        console.log(`✅ Restored ${urdfMeshes} URDF meshes from comprehensive save`);
        toast.success(`Robot restored with ${urdfMeshes} component(s) from comprehensive save!`);
      }
    }

    console.log(`Restored world with ${worldData.tree.nodes.length} nodes`);

    // Restore routing state if available
    if (worldData.routing) {
      restoreRoutingState(worldData.routing);
    } else {
      // Ensure routing state is cleared if not provided
      restoreRoutingState(undefined);
    }

    // Notify UI components that the tree has been updated
    // Use setTimeout to ensure the event is dispatched after React has processed the tree changes
    console.log('🔄 Dispatching scenetree-update event to refresh UI...');
    setTimeout(() => {
      window.dispatchEvent(new Event('scenetree-update'));
      console.log('✅ scenetree-update event dispatched');
    }, 100);
    
    return true;
  } catch (error) {
    console.error('Failed to restore world state:', error);
    return false;
  }
}

// Helper functions for mesh recreation
function getMeshTypeFromNode(node: SceneNode): string | null {
  // Try to determine mesh type from node type or name
  const nodeType = node.type;
  const nodeName = node.name.toLowerCase();
  
  // Check if node type is a valid mesh type
  const validMeshTypes = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'plane', 'ground', 'capsule', 'disc', 'torusknot', 'polyhedron'];
  if (validMeshTypes.includes(nodeType)) {
    return nodeType;
  }
  
  // Try to infer from name
  if (nodeName.includes('box')) return 'box';
  if (nodeName.includes('sphere')) return 'sphere';
  if (nodeName.includes('cylinder')) return 'cylinder';
  if (nodeName.includes('cone')) return 'cone';
  if (nodeName.includes('torus')) return 'torus';
  if (nodeName.includes('plane')) return 'plane';
  if (nodeName.includes('ground')) return 'ground';
  if (nodeName.includes('capsule')) return 'capsule';
  if (nodeName.includes('disc')) return 'disc';
  if (nodeName.includes('polyhedron')) return 'polyhedron';
  
  // Default to box if we can't determine
  return 'box';
}

function createMeshByType(type: string, name: string, scene: BABYLON.Scene): BABYLON.Mesh | null {
  try {
    switch (type) {
      case 'box':
        return BABYLON.MeshBuilder.CreateBox(name, { size: 2 }, scene);
      case 'sphere':
        return BABYLON.MeshBuilder.CreateSphere(name, { diameter: 2 }, scene);
      case 'cylinder':
        return BABYLON.MeshBuilder.CreateCylinder(name, { height: 2, diameter: 1 }, scene);
      case 'cone':
        return BABYLON.MeshBuilder.CreateCylinder(name, { height: 2, diameterTop: 0, diameterBottom: 1 }, scene);
      case 'torus':
        return BABYLON.MeshBuilder.CreateTorus(name, { diameter: 2, thickness: 0.5, tessellation: 32 }, scene);
      case 'plane':
        return BABYLON.MeshBuilder.CreatePlane(name, { size: 2 }, scene);
      case 'ground':
        return BABYLON.MeshBuilder.CreateGround(name, { width: 5, height: 5 }, scene);
      case 'capsule':
        return BABYLON.MeshBuilder.CreateCapsule(name, { height: 2, radius: 0.5 }, scene);
      case 'disc':
        return BABYLON.MeshBuilder.CreateDisc(name, { radius: 1, tessellation: 32 }, scene);
      case 'torusknot':
        return BABYLON.MeshBuilder.CreateTorusKnot(name, { radius: 1, tube: 0.3, radialSegments: 64, tubularSegments: 16 }, scene);
      case 'polyhedron':
        return BABYLON.MeshBuilder.CreatePolyhedron(name, { type: 0, size: 1 }, scene);
      default:
        return BABYLON.MeshBuilder.CreateBox(name, { size: 2 }, scene);
    }
  } catch (error) {
    console.error(`Failed to create mesh of type ${type}:`, error);
    return null;
  }
}

function getPhysicsShape(visualType: string): 'box' | 'sphere' | 'cylinder' {
  switch (visualType) {
    case 'box':
      return 'box';
    case 'sphere':
    case 'torus':
    case 'torusknot':
    case 'polyhedron':
      return 'sphere';
    case 'cylinder':
    case 'cone':
    case 'capsule':
    case 'disc':
      return 'cylinder';
    case 'plane':
    case 'ground':
      return 'box';
    default:
      return 'box';
  }
}

function getPhysicsParams(visualType: string): any {
  const physicsShape = getPhysicsShape(visualType);

  switch (visualType) {
    case 'box':
      return { shape: physicsShape, dimensions: { x: 2, y: 2, z: 2 } };
    case 'sphere':
      return { shape: physicsShape, radius: 1 };
    case 'cylinder':
      return { shape: physicsShape, radius: 0.5, height: 2 };
    case 'cone':
      return { shape: physicsShape, radius: 0.5, height: 2 };
    case 'torus':
      return { shape: physicsShape, radius: 1.25 };
    case 'plane':
      return { shape: physicsShape, dimensions: { x: 2, y: 2, z: 0.01 } };
    case 'ground':
      return { shape: physicsShape, dimensions: { x: 5, y: 5, z: 0.01 } };
    case 'capsule':
      return { shape: physicsShape, radius: 0.5, height: 2 };
    case 'disc':
      return { shape: physicsShape, radius: 1, height: 0.01 };
    case 'torusknot':
      return { shape: physicsShape, radius: 1.3 };
    case 'polyhedron':
      return { shape: physicsShape, radius: 1 };
    default:
      return { shape: 'box' as const, dimensions: { x: 1, y: 1, z: 1 } };
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
  const routing = serializeRoutingState();

  return {
    version: '1.0.0',
    timestamp: Date.now(),
    tree: {
      nodes: allNodes,
    },
    routing,
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
