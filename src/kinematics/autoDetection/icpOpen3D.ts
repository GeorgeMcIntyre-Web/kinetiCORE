/**
 * High-quality ICP using Open3D (Python bridge)
 *
 * Uses Open3D's photogrammetry-grade ICP algorithm for sub-millimeter precision.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import type { ICPConfig, ICPResult } from './types';
import type { Mat3, Mat4, Vec3 } from './mathUtils';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Open3DICPConfig extends Partial<ICPConfig> {
  rmse_threshold?: number;  // RMSE threshold for success (meters)
  initialTransform?: Mat4;  // Optional initial transform guess
}

/**
 * Run ICP using Open3D (Python).
 *
 * This provides much higher quality than the basic TypeScript implementation.
 */
export async function runICPWithOpen3D(
  sourcePoints: Float32Array,
  targetPoints: Float32Array,
  config: Open3DICPConfig = {}
): Promise<ICPResult> {
  // Convert Float32Array to 2D array for JSON
  const sourceArray: number[][] = [];
  for (let i = 0; i < sourcePoints.length; i += 3) {
    sourceArray.push([sourcePoints[i], sourcePoints[i + 1], sourcePoints[i + 2]]);
  }

  const targetArray: number[][] = [];
  for (let i = 0; i < targetPoints.length; i += 3) {
    targetArray.push([targetPoints[i], targetPoints[i + 1], targetPoints[i + 2]]);
  }

  const pythonConfig: any = {
    max_correspondence_distance: config.maxCorrespondenceDistance ?? 0.100,  // 100mm
    relative_fitness: 1e-7,
    relative_rmse: 1e-7,
    max_iteration: config.maxIterations ?? 200,
    rmse_threshold: config.rmse_threshold ?? 0.001,  // 1mm
  };

  if (config.initialTransform) {
    pythonConfig.initial_transform = config.initialTransform;
  }

  const input = {
    sourcePoints: sourceArray,
    targetPoints: targetArray,
    config: pythonConfig,
  };

  // Call Python script
  const scriptPath = path.join(__dirname, '../../../scripts/python/icp_bridge.py');
  const result = await callPythonICP(scriptPath, input);

  // Convert transformation matrix to rotation + translation
  // Open3D returns a 4x4 matrix in row-major format: transform[i][j] = row i, column j
  // The transformation is: target = T * source (where T is the 4x4 matrix)
  // For a rigid transformation: T = [R | t; 0 0 0 | 1]
  // where R is 3x3 rotation and t is 3x1 translation
  const transform = result.transformation;
  
  // Extract 3x3 rotation matrix (top-left block)
  // Open3D returns transformation matrix in row-major format
  // The matrix transforms: target = T * source (in homogeneous coordinates)
  // For rigid transformation: T = [R^T | t; 0 0 0 | 1] where R is the rotation
  // NOTE: Open3D may return R^T (transpose) instead of R, so we need to check
  const rotationRowMajor: Mat3 = [
    [transform[0][0], transform[0][1], transform[0][2]],
    [transform[1][0], transform[1][1], transform[1][2]],
    [transform[2][0], transform[2][1], transform[2][2]],
  ];
  
  // Also try transposed (in case Open3D returns R^T)
  const rotationColMajor: Mat3 = [
    [transform[0][0], transform[1][0], transform[2][0]],
    [transform[0][1], transform[1][1], transform[2][1]],
    [transform[0][2], transform[1][2], transform[2][2]],
  ];
  
  // Check determinants - a proper rotation matrix should have det = 1
  // Calculate determinant for both
  const detRow = rotationRowMajor[0][0] * (rotationRowMajor[1][1] * rotationRowMajor[2][2] - rotationRowMajor[1][2] * rotationRowMajor[2][1])
                - rotationRowMajor[0][1] * (rotationRowMajor[1][0] * rotationRowMajor[2][2] - rotationRowMajor[1][2] * rotationRowMajor[2][0])
                + rotationRowMajor[0][2] * (rotationRowMajor[1][0] * rotationRowMajor[2][1] - rotationRowMajor[1][1] * rotationRowMajor[2][0]);
  
  const detCol = rotationColMajor[0][0] * (rotationColMajor[1][1] * rotationColMajor[2][2] - rotationColMajor[1][2] * rotationColMajor[2][1])
                - rotationColMajor[0][1] * (rotationColMajor[1][0] * rotationColMajor[2][2] - rotationColMajor[1][2] * rotationColMajor[2][0])
                + rotationColMajor[0][2] * (rotationColMajor[1][0] * rotationColMajor[2][1] - rotationColMajor[1][1] * rotationColMajor[2][0]);
  
  // Choose matrix with determinant closest to +1 (proper rotation)
  let rotation: Mat3;
  let usingRowMajor = true;
  if (Math.abs(detRow - 1) <= Math.abs(detCol - 1)) {
    rotation = rotationRowMajor;
  } else {
    rotation = rotationColMajor;
    usingRowMajor = false;
  }
  
  // Extract translation vector (rightmost column, top 3 rows)
  const translation: Vec3 = [transform[0][3], transform[1][3], transform[2][3]];

  // Debug: Log the transformation matrix for verification
  const trace = rotation[0][0] + rotation[1][1] + rotation[2][2];
  const cosAngle = Math.max(-1, Math.min(1, (trace - 1) / 2));
  const angleRad = Math.acos(cosAngle);
  const angleDeg = (angleRad * 180 / Math.PI);
  
  console.log(`[Open3D ICP] RMS error: ${result.inlier_rmse.toFixed(8)}m, fitness: ${result.fitness.toFixed(4)}`);
  console.log(`[Open3D ICP] ${usingRowMajor ? 'Row' : 'Col'}-major rotation selected (det row=${detRow.toFixed(4)}, det col=${detCol.toFixed(4)})`);

  return {
    rotation,
    translation,
    rmsError: result.inlier_rmse,
    correspondences: result.correspondences || 0,
    converged: result.inlier_rmse < pythonConfig.rmse_threshold,
  };
}

/**
 * Call Python ICP script using child_process
 */
function callPythonICP(
  scriptPath: string,
  input: { sourcePoints: number[][]; targetPoints: number[][]; config: any }
): Promise<{ transformation: number[][]; inlier_rmse: number; fitness: number; correspondences: number }> {
  return new Promise((resolve, reject) => {
    // Try to find Python - check common locations
    let pythonPath = 'python3';
    if (process.platform === 'win32') {
      // Try explicit path first, then fallback to 'python'
      const explicitPath = 'C:\\Users\\georgem\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';
      if (existsSync(explicitPath)) {
        pythonPath = explicitPath;
      } else {
        pythonPath = 'python';
      }
    }
    const python = spawn(pythonPath, [scriptPath]);

    let stdout = '';
    let stderr = '';

    // Send input via stdin
    python.stdin.write(JSON.stringify(input));
    python.stdin.end();

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python ICP failed with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          reject(new Error(`Python ICP error: ${result.error}`));
          return;
        }
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse Python ICP output: ${stdout}`));
      }
    });

    python.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}
