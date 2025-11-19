// Route Templates - Predefined routing patterns for common scenarios
// Owner: Routing System Team

import { Vector3 } from '../../core/types';
import { RouteSegment, MaterialSpec, RouteConstraints, ConnectionSpecifications } from '../core/types';
import { generateId } from '../core/RoutingUtils';

/**
 * Template categories
 */
export type TemplateCategory = 'common' | 'industrial' | 'custom';

/**
 * Route template definition
 */
export interface RouteTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string; // Emoji or icon identifier
  // Template geometry - defines the pattern of segments
  segments: RouteSegment[];
  // Default specifications
  defaultSpecifications: ConnectionSpecifications;
  // Default material
  defaultMaterial: MaterialSpec;
  // Default constraints
  defaultConstraints: RouteConstraints;
  // Parametric adjustments (user can modify after placement)
  parameters?: {
    length?: number; // Default length for straight segments
    bendRadius?: number; // Default bend radius
    angle?: number; // For angled templates (defaults to 90° for elbows)
    height?: number; // For vertical risers
    count?: number; // For cable bundles
  };
}

/**
 * Built-in route templates
 */
export const BUILT_IN_TEMPLATES: RouteTemplate[] = [
  // Straight Run (A→B)
  {
    id: 'straight_run',
    name: 'Straight Run',
    description: 'Simple straight route between two points',
    category: 'common',
    icon: '➡️',
    segments: [
      {
        id: 'temp',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 1, y: 0, z: 0 },
        segmentType: 'straight',
        length: 1,
      },
    ],
    defaultSpecifications: {
      size: '3/4 inch',
      material: 'steel',
    },
    defaultMaterial: {
      name: 'Steel',
    },
    defaultConstraints: {
      minBendRadius: 0.1,
      supportSpacing: 2.0,
      clearance: {
        walls: 0.05,
        ceiling: 0.05,
        floor: 0.05,
        otherInfrastructure: 0.1,
      },
    },
    parameters: {
      length: 1.0,
    },
  },

  // 90° Elbow
  {
    id: 'elbow_90',
    name: '90° Elbow',
    description: 'Right-angle turn for routing around corners',
    category: 'common',
    icon: '🔽',
    segments: [
      {
        id: 'temp1',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 1, y: 0, z: 0 },
        segmentType: 'straight',
        length: 1,
      },
      {
        id: 'temp2',
        startPoint: { x: 1, y: 0, z: 0 },
        endPoint: { x: 1, y: 1, z: 0 },
        segmentType: 'bend',
        bendRadius: 0.15,
        length: 1,
      },
    ],
    defaultSpecifications: {
      size: '3/4 inch',
      material: 'steel',
    },
    defaultMaterial: {
      name: 'Steel',
    },
    defaultConstraints: {
      minBendRadius: 0.15,
      supportSpacing: 2.0,
      clearance: {
        walls: 0.05,
        ceiling: 0.05,
        floor: 0.05,
        otherInfrastructure: 0.1,
      },
    },
    parameters: {
      length: 1.0,
      bendRadius: 0.15,
    },
  },

  // T-Junction (3-way)
  {
    id: 't_junction',
    name: 'T-Junction',
    description: 'Three-way split for branching routes',
    category: 'industrial',
    icon: '🔀',
    segments: [
      {
        id: 'temp1',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 1, y: 0, z: 0 },
        segmentType: 'straight',
        length: 1,
      },
      {
        id: 'temp2',
        startPoint: { x: 1, y: 0, z: 0 },
        endPoint: { x: 1, y: 1, z: 0 },
        segmentType: 'fitting',
        length: 1,
      },
      {
        id: 'temp3',
        startPoint: { x: 1, y: 0, z: 0 },
        endPoint: { x: 1, y: -1, z: 0 },
        segmentType: 'fitting',
        length: 1,
      },
    ],
    defaultSpecifications: {
      size: '3/4 inch',
      material: 'steel',
    },
    defaultMaterial: {
      name: 'Steel',
    },
    defaultConstraints: {
      minBendRadius: 0.1,
      supportSpacing: 2.0,
      clearance: {
        walls: 0.05,
        ceiling: 0.05,
        floor: 0.05,
        otherInfrastructure: 0.1,
      },
    },
    parameters: {
      length: 1.0,
    },
  },

  // Cross (4-way)
  {
    id: 'cross',
    name: 'Cross Junction',
    description: 'Four-way intersection for complex routing',
    category: 'industrial',
    icon: '➕',
    segments: [
      {
        id: 'temp1',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 1, y: 0, z: 0 },
        segmentType: 'fitting',
        length: 1,
      },
      {
        id: 'temp2',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: -1, y: 0, z: 0 },
        segmentType: 'fitting',
        length: 1,
      },
      {
        id: 'temp3',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 0, y: 1, z: 0 },
        segmentType: 'fitting',
        length: 1,
      },
      {
        id: 'temp4',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 0, y: -1, z: 0 },
        segmentType: 'fitting',
        length: 1,
      },
    ],
    defaultSpecifications: {
      size: '3/4 inch',
      material: 'steel',
    },
    defaultMaterial: {
      name: 'Steel',
    },
    defaultConstraints: {
      minBendRadius: 0.1,
      supportSpacing: 2.0,
      clearance: {
        walls: 0.05,
        ceiling: 0.05,
        floor: 0.05,
        otherInfrastructure: 0.1,
      },
    },
    parameters: {
      length: 1.0,
    },
  },

  // Vertical Riser
  {
    id: 'vertical_riser',
    name: 'Vertical Riser',
    description: 'Vertical route segment for floor-to-floor routing',
    category: 'industrial',
    icon: '📈',
    segments: [
      {
        id: 'temp',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 0, y: 0, z: 2 },
        segmentType: 'straight',
        length: 2,
      },
    ],
    defaultSpecifications: {
      size: '3/4 inch',
      material: 'steel',
    },
    defaultMaterial: {
      name: 'Steel',
    },
    defaultConstraints: {
      minBendRadius: 0.1,
      supportSpacing: 1.5,
      clearance: {
        walls: 0.05,
        ceiling: 0.05,
        floor: 0.05,
        otherInfrastructure: 0.1,
      },
    },
    parameters: {
      height: 2.0,
    },
  },

  // Cable Bundle (multiple parallel)
  {
    id: 'cable_bundle',
    name: 'Cable Bundle',
    description: 'Multiple parallel routes for cable management',
    category: 'industrial',
    icon: '📦',
    segments: [
      {
        id: 'temp',
        startPoint: { x: 0, y: 0, z: 0 },
        endPoint: { x: 1, y: 0, z: 0 },
        segmentType: 'straight',
        length: 1,
      },
    ],
    defaultSpecifications: {
      size: '1/2 inch',
      material: 'PVC',
    },
    defaultMaterial: {
      name: 'PVC',
    },
    defaultConstraints: {
      minBendRadius: 0.15,
      supportSpacing: 1.5,
      clearance: {
        walls: 0.05,
        ceiling: 0.05,
        floor: 0.05,
        otherInfrastructure: 0.1,
      },
    },
    parameters: {
      length: 1.0,
      count: 3, // Number of parallel routes
    },
  },
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateCategory): RouteTemplate[] {
  return BUILT_IN_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): RouteTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}

/**
 * Create route segments from template at a specific location
 * Transforms template geometry to the target position
 */
export function createSegmentsFromTemplate(
  template: RouteTemplate,
  startPosition: Vector3,
  endPosition?: Vector3,
  parameters?: RouteTemplate['parameters']
): RouteSegment[] {
  const segments: RouteSegment[] = [];
  const templateSegments = template.segments;
  
  // If template has only one segment and we have an end position, create straight route
  if (templateSegments.length === 1 && endPosition) {
    const dx = endPosition.x - startPosition.x;
    const dy = endPosition.y - startPosition.y;
    const dz = endPosition.z - startPosition.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    segments.push({
      id: generateId(),
      startPoint: startPosition,
      endPoint: endPosition,
      segmentType: 'straight',
      length,
    });
    return segments;
  }

  // Otherwise, use template pattern and scale/transform it
  const templateStart = templateSegments[0]?.startPoint || { x: 0, y: 0, z: 0 };
  
  // Calculate transformation offset
  const offsetX = startPosition.x - templateStart.x;
  const offsetY = startPosition.y - templateStart.y;
  const offsetZ = startPosition.z - templateStart.z;

  // Apply length scaling if parameter provided
  const lengthScale = parameters?.length || 1.0;
  
  for (const templateSeg of templateSegments) {
    const transformedStart: Vector3 = {
      x: templateSeg.startPoint.x * lengthScale + offsetX,
      y: templateSeg.startPoint.y * lengthScale + offsetY,
      z: templateSeg.startPoint.z * lengthScale + offsetZ,
    };
    
    const transformedEnd: Vector3 = {
      x: templateSeg.endPoint.x * lengthScale + offsetX,
      y: templateSeg.endPoint.y * lengthScale + offsetY,
      z: templateSeg.endPoint.z * lengthScale + offsetZ,
    };

    // Calculate actual length
    const dx = transformedEnd.x - transformedStart.x;
    const dy = transformedEnd.y - transformedStart.y;
    const dz = transformedEnd.z - transformedStart.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    segments.push({
      id: generateId(),
      startPoint: transformedStart,
      endPoint: transformedEnd,
      segmentType: templateSeg.segmentType,
      bendRadius: parameters?.bendRadius || templateSeg.bendRadius,
      length,
    });
  }

  return segments;
}






