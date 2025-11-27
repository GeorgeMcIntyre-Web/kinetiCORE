/**
 * Extract Joint Transform Matrices
 *
 * Gets the full 3D transform data for each detected joint:
 * - Position (world space)
 * - Rotation (quaternion and euler)
 * - 4x4 transformation matrix
 * - Parent transform
 */

// DEPRECATED: This file is no longer used. HierarchicalToolAnalyzer has been replaced
// by the Statistical Pairing Engine in src/kinematics/statisticalPairing/
//
// import * as BABYLON from '@babylonjs/core';
// import '@babylonjs/loaders/glTF';
// import { HierarchicalToolAnalyzer } from '../babylon/sceneAnalysis/HierarchicalToolAnalyzer';
// import { analyzeJoint } from './ICPJointAnalyzer';

export {}; // Make this a module

export interface JointTransform {
  jointName: string;
  nodeId: string;
  side: 'RH' | 'LH' | 'UNKNOWN';

  // Joint type from ICP analysis
  type: 'revolute' | 'prismatic';

  // ToVector - MOVING node position (end of rotation axis)
  toVector: {
    x: number;
    y: number;
    z: number;
  };

  // FromVector - FIXED node position (start of rotation axis)
  fromVector?: {
    x: number;
    y: number;
    z: number;
  };

  // Joint axis (normalized direction vector from ICP)
  axis?: {
    x: number;
    y: number;
    z: number;
  };

  // Joint limits from ICP analysis
  minValue: number; // degrees for revolute, meters for prismatic
  maxValue: number; // degrees for revolute, meters for prismatic

  // ICP error metrics
  rmsError: number;
  maxError: number;

  // Point cloud counts
  pointCountFixed: number;
  pointCountMoving: number;

  // Rotation (Quaternion) - from transform matrix
  rotation: {
    x: number;
    y: number;
    z: number;
    w: number;
  };

  // Rotation (Euler angles in degrees) - from transform matrix
  eulerAngles: {
    x: number;
    y: number;
    z: number;
  };

  // 4x4 Transformation Matrix (column-major)
  transformMatrix: number[][]; // 4x4 array
}

export interface JointTransformData {
  unitName: string;
  joints: JointTransform[];
}

/**
 * Convert BABYLON.Matrix to 4x4 array
 */
function matrixToArray(matrix: BABYLON.Matrix): number[][] {
  const m = matrix.m;
  return [
    [m[0], m[1], m[2], m[3]],
    [m[4], m[5], m[6], m[7]],
    [m[8], m[9], m[10], m[11]],
    [m[12], m[13], m[14], m[15]]
  ];
}

/**
 * Format matrix for display (like reference JSON)
 */
function formatMatrixForDisplay(matrix: number[][]): string[] {
  return matrix.map(row =>
    row.map(val => val.toFixed(4).padStart(8)).join('  ')
  );
}

/**
 * Extract transform data for a single joint using ICP analysis
 */
function extractJointTransform(
  jointDef: any,
  movingNode: BABYLON.TransformNode
): JointTransform {
  console.log(`\n[EXTRACT] Analyzing joint: ${jointDef.name}`);

  // Force compute world matrix for the entire hierarchy
  movingNode.computeWorldMatrix(true);

  // Get full transformation matrix
  const worldMatrix = movingNode.getWorldMatrix();

  // Extract position from transformation matrix (last column)
  const m = worldMatrix.m;
  const worldPos = new BABYLON.Vector3(m[12], m[13], m[14]);

  // Get world rotation (quaternion)
  const worldRotQuat = movingNode.absoluteRotationQuaternion || BABYLON.Quaternion.Identity();

  // Convert to Euler angles (in degrees)
  const euler = worldRotQuat.toEulerAngles();

  // DEFAULT VALUES (if ICP analysis fails)
  let type: 'revolute' | 'prismatic' = 'revolute';
  let fromVector: JointTransform['fromVector'] = undefined;
  let toVector = { x: worldPos.x, y: worldPos.y, z: worldPos.z };
  let axis: JointTransform['axis'] = undefined;
  let minValue = 0;
  let maxValue = 90; // Default assumption for revolute
  let rmsError = 0;
  let maxError = 0;
  let pointCountFixed = 0;
  let pointCountMoving = 0;

  // RUN ICP ANALYSIS (if FIXED node exists)
  if (jointDef.fixedNode) {
    try {
      console.log(`[EXTRACT] Running ICP analysis...`);
      const icpResult = analyzeJoint(jointDef.fixedNode, movingNode);

      // Use ICP results
      type = icpResult.type;
      axis = {
        x: icpResult.axis.x,
        y: icpResult.axis.y,
        z: icpResult.axis.z
      };
      fromVector = {
        x: icpResult.fromVector.x,
        y: icpResult.fromVector.y,
        z: icpResult.fromVector.z
      };
      toVector = {
        x: icpResult.toVector.x,
        y: icpResult.toVector.y,
        z: icpResult.toVector.z
      };
      minValue = icpResult.minValue;
      maxValue = icpResult.maxValue;
      rmsError = icpResult.rmsError;
      maxError = icpResult.maxError;
      pointCountFixed = icpResult.pointCountFixed;
      pointCountMoving = icpResult.pointCountMoving;

      console.log(`[EXTRACT] ✓ ICP Analysis complete`);
      console.log(`[EXTRACT]   Type: ${type}`);
      console.log(`[EXTRACT]   Axis: (${axis.x.toFixed(4)}, ${axis.y.toFixed(4)}, ${axis.z.toFixed(4)})`);
      console.log(`[EXTRACT]   Range: ${minValue.toFixed(2)} to ${maxValue.toFixed(2)} ${type === 'revolute' ? '°' : 'm'}`);
      console.log(`[EXTRACT]   Point counts: FIXED=${pointCountFixed}, MOVING=${pointCountMoving}`);

    } catch (error) {
      console.warn(`[EXTRACT] ICP analysis failed: ${error}`);
      console.warn(`[EXTRACT] Using fallback values`);

      // Fallback: use matrix positions
      jointDef.fixedNode.computeWorldMatrix(true);
      const fixedMatrix = jointDef.fixedNode.getWorldMatrix();
      const fixedM = fixedMatrix.m;
      const fixedPos = new BABYLON.Vector3(fixedM[12], fixedM[13], fixedM[14]);

      fromVector = {
        x: fixedPos.x,
        y: fixedPos.y,
        z: fixedPos.z
      };
    }
  }

  return {
    jointName: jointDef.name,
    nodeId: jointDef.nodeId,
    side: jointDef.side,
    type,
    toVector,
    fromVector,
    axis,
    minValue,
    maxValue,
    rmsError,
    maxError,
    pointCountFixed,
    pointCountMoving,
    rotation: {
      x: worldRotQuat.x,
      y: worldRotQuat.y,
      z: worldRotQuat.z,
      w: worldRotQuat.w
    },
    eulerAngles: {
      x: euler.x * (180 / Math.PI), // Convert to degrees
      y: euler.y * (180 / Math.PI),
      z: euler.z * (180 / Math.PI)
    },
    transformMatrix: matrixToArray(worldMatrix)
  };
}

/**
 * Extract transforms for all joints in a GLB file
 */
export async function extractJointTransforms(
  glbFilename: string = '9X_110_GEO_UNIT_112.glb'
): Promise<{
  units: JointTransformData[];
  totalJoints: number;
  report: string;
}> {
  console.log('================================================================================');
  console.log('JOINT TRANSFORM EXTRACTION');
  console.log('================================================================================');
  console.log(`File: ${glbFilename}`);
  console.log('Start Time:', new Date().toISOString());
  console.log('================================================================================\n');

  // Create test scene
  console.log('[SETUP] Creating scene...');
  const engine = new BABYLON.NullEngine();
  const scene = new BABYLON.Scene(engine);
  console.log('[SETUP] ✓ Scene created\n');

  // Load GLB
  console.log(`[LOAD] Loading ${glbFilename}...`);
  const result = await BABYLON.SceneLoader.ImportMeshAsync(
    '',
    '/',
    glbFilename,
    scene
  );

  console.log(`[LOAD] ✓ Loaded`);
  console.log(`[LOAD]   - Transform nodes: ${result.transformNodes.length}\n`);

  // Find root node
  let rootNode: BABYLON.TransformNode | null = null;
  for (const node of result.transformNodes) {
    if (node.name.includes('9X_110_GEO') || node.name.includes('UNIT_112') || !node.parent) {
      rootNode = node;
      console.log(`[LOAD] ✓ Root node: ${node.name}\n`);
      break;
    }
  }

  if (!rootNode) {
    throw new Error('Root node not found');
  }

  // Run hierarchical analyzer
  console.log('[ANALYZE] Running hierarchical analyzer...');
  const analyzer = new HierarchicalToolAnalyzer();
  const graph = analyzer.analyze(scene, rootNode);
  console.log('[ANALYZE] ✓ Analysis complete\n');

  // Extract transforms for each unit
  console.log('[EXTRACT] Extracting joint transforms...\n');
  const units: JointTransformData[] = [];

  for (const unit of graph.units) {
    const jointTransforms: JointTransform[] = [];

    for (const joint of unit.joints) {
      const transform = extractJointTransform(joint, joint.movingNode);
      jointTransforms.push(transform);

      console.log(`[${unit.unitName}] Joint ${joint.name}:`);
      console.log(`  NodeId: ${joint.nodeId}`);
      console.log(`  Side: ${joint.side}`);
      console.log(`  Type: ${transform.type.toUpperCase()}`);
      console.log(`  ToVector (MOVING): (${transform.toVector.x.toFixed(4)}, ${transform.toVector.y.toFixed(4)}, ${transform.toVector.z.toFixed(4)})`);

      if (transform.fromVector) {
        console.log(`  FromVector (FIXED): (${transform.fromVector.x.toFixed(4)}, ${transform.fromVector.y.toFixed(4)}, ${transform.fromVector.z.toFixed(4)})`);
      }

      if (transform.axis) {
        console.log(`  Joint Axis: (${transform.axis.x.toFixed(4)}, ${transform.axis.y.toFixed(4)}, ${transform.axis.z.toFixed(4)})`);
      }

      console.log(`  Range: ${transform.minValue.toFixed(2)} to ${transform.maxValue.toFixed(2)} ${transform.type === 'revolute' ? '°' : 'm'}`);
      console.log(`  RMS Error: ${transform.rmsError.toExponential(4)}`);
      console.log(`  Max Error: ${transform.maxError.toExponential(4)}`);
      console.log(`  Point Counts: FIXED=${transform.pointCountFixed}, MOVING=${transform.pointCountMoving}`)

      console.log(`  Transform Matrix:`);
      const matrixDisplay = formatMatrixForDisplay(transform.transformMatrix);
      matrixDisplay.forEach(row => console.log(`    ${row}`));
      console.log('');
    }

    units.push({
      unitName: unit.unitName,
      joints: jointTransforms
    });
  }

  const totalJoints = units.reduce((sum, u) => sum + u.joints.length, 0);

  console.log('================================================================================');
  console.log('SUMMARY');
  console.log('================================================================================');
  console.log(`Units: ${units.length}`);
  console.log(`Total joints: ${totalJoints}`);
  console.log('================================================================================\n');

  // Generate report
  const report = [
    'JOINT TRANSFORM EXTRACTION REPORT',
    '='.repeat(80),
    `File: ${glbFilename}`,
    `Timestamp: ${new Date().toISOString()}`,
    '',
    `Units: ${units.length}`,
    `Total joints: ${totalJoints}`,
    '',
    'JOINT TRANSFORMS:',
    ...units.flatMap(unit => [
      `  ${unit.unitName}:`,
      ...unit.joints.map(j =>
        `    ${j.jointName} (${j.side}): ToVector=(${j.toVector.x.toFixed(2)}, ${j.toVector.y.toFixed(2)}, ${j.toVector.z.toFixed(2)})` +
        (j.fromVector ? ` FromVector=(${j.fromVector.x.toFixed(2)}, ${j.fromVector.y.toFixed(2)}, ${j.fromVector.z.toFixed(2)})` : '')
      )
    ]),
    '',
    '='.repeat(80)
  ].join('\n');

  // Cleanup
  scene.dispose();
  engine.dispose();

  return {
    units,
    totalJoints,
    report
  };
}

/**
 * Export to window for browser console
 */
if (typeof window !== 'undefined') {
  (window as any).extractJointTransforms = extractJointTransforms;
}
