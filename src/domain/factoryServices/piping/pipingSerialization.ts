// Factory Piping System - JSON Serialization
// Owner: Agent 1 (George) - Architecture Lead
// Pure JSON input/output with robust validation

import { PipingNetwork, PipingNode, PipingSegment } from './pipingTypes';

/**
 * Serialized format version for compatibility tracking
 */
const SERIALIZATION_VERSION = 1;

/**
 * Type guard for Position3D
 */
function isValidPosition(value: unknown): value is { x: number; y: number; z: number } {
  if (typeof value !== 'object') {
    return false;
  }
  if (value === null) {
    return false;
  }

  const pos = value as Record<string, unknown>;
  return (
    typeof pos.x === 'number' &&
    typeof pos.y === 'number' &&
    typeof pos.z === 'number'
  );
}

/**
 * Type guard for PipingNode
 */
function isValidNode(value: unknown): value is PipingNode {
  if (typeof value !== 'object') {
    return false;
  }
  if (value === null) {
    return false;
  }

  const node = value as Record<string, unknown>;

  if (typeof node.id !== 'string') {
    return false;
  }
  if (node.name !== undefined && typeof node.name !== 'string') {
    return false;
  }
  if (isValidPosition(node.position) === false) {
    return false;
  }
  if (typeof node.kind !== 'string') {
    return false;
  }
  if (typeof node.serviceType !== 'string') {
    return false;
  }

  return true;
}

/**
 * Type guard for PipingSegment
 */
function isValidSegment(value: unknown): value is PipingSegment {
  if (typeof value !== 'object') {
    return false;
  }
  if (value === null) {
    return false;
  }

  const seg = value as Record<string, unknown>;

  if (typeof seg.id !== 'string') {
    return false;
  }
  if (typeof seg.fromNodeId !== 'string') {
    return false;
  }
  if (typeof seg.toNodeId !== 'string') {
    return false;
  }
  if (typeof seg.nominalDiameterMm !== 'number') {
    return false;
  }
  if (typeof seg.hasInsulation !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * Serialize a piping network to JSON
 * Output is guaranteed to be JSON-safe (no functions, no circular refs)
 *
 * @param network - The network to serialize
 * @returns JSON-serializable object
 */
export function serializePipingNetwork(network: PipingNetwork): unknown {
  return {
    version: SERIALIZATION_VERSION,
    network: {
      id: network.id,
      name: network.name,
      serviceType: network.serviceType,
      nodes: network.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        position: { ...node.position },
        kind: node.kind,
        serviceType: node.serviceType,
        meta: node.meta ? { ...node.meta } : undefined,
      })),
      segments: network.segments.map((seg) => ({
        id: seg.id,
        fromNodeId: seg.fromNodeId,
        toNodeId: seg.toNodeId,
        nominalDiameterMm: seg.nominalDiameterMm,
        schedule: seg.schedule,
        hasInsulation: seg.hasInsulation,
        slopePerMille: seg.slopePerMille,
        fittingHints: seg.fittingHints ? [...seg.fittingHints] : undefined,
      })),
      meta: network.meta ? { ...network.meta } : undefined,
    },
  };
}

/**
 * Deserialize a piping network from JSON
 * Includes robust validation with guard clauses
 *
 * @param json - JSON data (typically from JSON.parse)
 * @returns Deserialized network
 * @throws Error if JSON is invalid
 */
export function deserializePipingNetwork(json: unknown): PipingNetwork {
  // Guard: JSON must be an object
  if (typeof json !== 'object') {
    throw new Error('Invalid JSON: expected object');
  }
  if (json === null) {
    throw new Error('Invalid JSON: unexpected null');
  }

  const data = json as Record<string, unknown>;

  // Guard: version must exist
  if (typeof data.version !== 'number') {
    throw new Error('Invalid JSON: missing or invalid version');
  }

  // Guard: version must be supported
  if (data.version > SERIALIZATION_VERSION) {
    throw new Error(
      `Unsupported version: ${data.version} (current: ${SERIALIZATION_VERSION})`
    );
  }

  // Guard: network must exist and be an object
  if (typeof data.network !== 'object') {
    throw new Error('Invalid JSON: missing or invalid network object');
  }
  if (data.network === null) {
    throw new Error('Invalid JSON: network is null');
  }

  const networkData = data.network as Record<string, unknown>;

  // Guard: required network fields
  if (typeof networkData.id !== 'string') {
    throw new Error('Invalid JSON: network.id must be a string');
  }
  if (typeof networkData.name !== 'string') {
    throw new Error('Invalid JSON: network.name must be a string');
  }
  if (typeof networkData.serviceType !== 'string') {
    throw new Error('Invalid JSON: network.serviceType must be a string');
  }

  // Guard: nodes must be an array
  if (Array.isArray(networkData.nodes) === false) {
    throw new Error('Invalid JSON: network.nodes must be an array');
  }

  // Guard: segments must be an array
  if (Array.isArray(networkData.segments) === false) {
    throw new Error('Invalid JSON: network.segments must be an array');
  }

  // Validate and deserialize nodes
  const nodes: PipingNode[] = [];
  for (let i = 0; i < networkData.nodes.length; i++) {
    const nodeData = networkData.nodes[i];
    if (isValidNode(nodeData) === false) {
      throw new Error(`Invalid JSON: network.nodes[${i}] is invalid`);
    }
    nodes.push(nodeData);
  }

  // Validate and deserialize segments
  const segments: PipingSegment[] = [];
  for (let i = 0; i < networkData.segments.length; i++) {
    const segData = networkData.segments[i];
    if (isValidSegment(segData) === false) {
      throw new Error(`Invalid JSON: network.segments[${i}] is invalid`);
    }
    segments.push(segData);
  }

  // Construct the network
  const network: PipingNetwork = {
    id: networkData.id,
    name: networkData.name,
    serviceType: networkData.serviceType as any,
    nodes,
    segments,
    meta:
      typeof networkData.meta === 'object' && networkData.meta !== null
        ? (networkData.meta as Record<string, string>)
        : undefined,
  };

  return network;
}

/**
 * Serialize multiple networks to JSON
 */
export function serializeMultipleNetworks(networks: PipingNetwork[]): unknown {
  return {
    version: SERIALIZATION_VERSION,
    networks: networks.map((net) => serializePipingNetwork(net)),
  };
}

/**
 * Deserialize multiple networks from JSON
 */
export function deserializeMultipleNetworks(json: unknown): PipingNetwork[] {
  if (typeof json !== 'object') {
    throw new Error('Invalid JSON: expected object');
  }
  if (json === null) {
    throw new Error('Invalid JSON: unexpected null');
  }

  const data = json as Record<string, unknown>;

  if (typeof data.version !== 'number') {
    throw new Error('Invalid JSON: missing or invalid version');
  }

  if (Array.isArray(data.networks) === false) {
    throw new Error('Invalid JSON: networks must be an array');
  }

  const networks: PipingNetwork[] = [];
  for (let i = 0; i < data.networks.length; i++) {
    const networkJson = data.networks[i];
    try {
      const network = deserializePipingNetwork(networkJson);
      networks.push(network);
    } catch (error) {
      throw new Error(`Failed to deserialize network ${i}: ${error}`);
    }
  }

  return networks;
}
