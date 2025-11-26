/**
 * High-quality ICP using Open3D (Python bridge)
 *
 * Uses Open3D's photogrammetry-grade ICP algorithm for sub-millimeter precision.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { ICPConfig, ICPResult, Mat3, Vec3 } from './types';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Open3DICPConfig extends Partial<ICPConfig> {
  rmse_threshold?: number;  // RMSE threshold for success (meters)
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

  const pythonConfig = {
    max_correspondence_distance: config.maxCorrespondenceDistance ?? 0.100,  // 100mm
    relative_fitness: 1e-7,
    relative_rmse: 1e-7,
    max_iteration: config.maxIterations ?? 200,
    rmse_threshold: config.rmse_threshold ?? 0.001,  // 1mm
  };

  const input = {
    sourcePoints: sourceArray,
    targetPoints: targetArray,
    config: pythonConfig,
  };

  // Call Python script
  const scriptPath = path.join(__dirname, '../../../scripts/python/icp_bridge.py');
  const result = await callPythonICP(scriptPath, input);

  // Convert transformation matrix to rotation + translation
  const transform = result.transformation;
  const rotation: Mat3 = [
    [transform[0][0], transform[0][1], transform[0][2]],
    [transform[1][0], transform[1][1], transform[1][2]],
    [transform[2][0], transform[2][1], transform[2][2]],
  ];
  const translation: Vec3 = [transform[0][3], transform[1][3], transform[2][3]];

  console.log(`[Open3D ICP] RMS error: ${result.inlier_rmse.toFixed(8)}m, fitness: ${result.fitness.toFixed(4)}`);

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
    // Use Python 3.12 explicitly (has Open3D installed)
    const pythonPath = 'C:\\Users\\georgem\\AppData\\Local\\Programs\\Python\\Python312\\python.exe';
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
