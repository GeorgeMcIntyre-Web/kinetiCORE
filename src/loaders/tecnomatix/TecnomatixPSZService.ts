/**
 * Tecnomatix PSZ/JT Conversion Service
 * Uses LineSimulator DLLs to convert robot models to web formats
 *
 * PSZ files contain full kinematic definitions - this is the gold standard!
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export interface TecnomatixRobotData {
  manufacturer: 'KUKA' | 'FANUC' | 'Kawasaki' | 'ABB' | 'Universal Robots' | 'Other';
  model: string;
  yearRange: [number, number]; // e.g., [2004, 2024]
  kinematics: RobotKinematicData;
  geometry: {
    objPath?: string;
    glbPath?: string;
    jtPath?: string;
    pszPath?: string;
  };
}

export interface RobotKinematicData {
  type: '6-axis' | '7-axis' | '4-axis' | 'scara' | 'delta' | 'collaborative';
  dof: number; // Degrees of freedom
  joints: JointDefinition[];
  links: LinkDefinition[];
  toolMountPoint: TransformMatrix;
  baseMountPoint: TransformMatrix;
  workEnvelope: WorkspaceEnvelope;
}

export interface JointDefinition {
  name: string;
  index: number;
  type: 'revolute' | 'prismatic';
  axis: 'X' | 'Y' | 'Z';
  limits: {
    min: number; // degrees or mm
    max: number;
  };
  velocity: {
    max: number; // deg/s or mm/s
  };
  dhParameters?: { // Denavit-Hartenberg parameters
    a: number;
    alpha: number;
    d: number;
    theta: number;
  };
}

export interface LinkDefinition {
  name: string;
  index: number;
  meshName: string; // Reference to mesh in OBJ/GLB
  parent: number | null; // Parent link index
  joint: number; // Joint connecting to parent
  mass?: number; // kg
  inertia?: number[][]; // Inertia tensor
}

export interface TransformMatrix {
  position: [number, number, number];
  rotation: [number, number, number]; // Euler XYZ in degrees
  matrix?: number[]; // 4x4 homogeneous transform
}

export interface WorkspaceEnvelope {
  reachRadius: number; // mm
  heightRange: [number, number]; // mm
  payload: number; // kg
  repeatability: number; // mm
}

/**
 * Tecnomatix PSZ Conversion Service
 * Leverages LineSimulator DLLs for local conversion
 */
export class TecnomatixPSZService {
  private lineSimulatorPath: string;

  constructor(lineSimulatorPath: string = 'C:\\tmp\\LineSimulator') {
    this.lineSimulatorPath = lineSimulatorPath;
  }

  /**
   * Convert PSZ file to OBJ format
   * PSZ files contain full kinematic definitions from Tecnomatix
   */
  async convertPSZtoOBJ(
    pszFilePath: string,
    outputDir: string
  ): Promise<{ objPath: string; kinematics: RobotKinematicData }> {
    console.log(`[Tecnomatix] Converting PSZ: ${pszFilePath}`);

    // Use ModelViewer.exe to export PSZ → OBJ
    const modelViewerExe = path.join(this.lineSimulatorPath, 'ModelViewer.exe');

    const outputObjPath = path.join(
      outputDir,
      path.basename(pszFilePath, '.psz') + '.obj'
    );

    try {
      // Command line arguments for ModelViewer (may need adjustment)
      const cmd = `"${modelViewerExe}" -input "${pszFilePath}" -export obj -output "${outputObjPath}"`;

      console.log(`[Tecnomatix] Running: ${cmd}`);
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.lineSimulatorPath,
        timeout: 60000 // 60 second timeout
      });

      if (stderr) {
        console.warn(`[Tecnomatix] Warnings: ${stderr}`);
      }

      console.log(`[Tecnomatix] Conversion output: ${stdout}`);

      // Extract kinematics from PSZ using PszReader.dll
      const kinematics = await this.extractKinematicsFromPSZ(pszFilePath);

      return {
        objPath: outputObjPath,
        kinematics
      };

    } catch (error) {
      throw new Error(`PSZ conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract kinematic data from PSZ file
   * This is where the magic happens - PSZ files have REAL kinematic definitions!
   */
  private async extractKinematicsFromPSZ(pszFilePath: string): Promise<RobotKinematicData> {
    console.log(`[Tecnomatix] Extracting kinematics from: ${pszFilePath}`);

    // TODO: Use edge-js or node-ffi-napi to call PszReader.dll directly
    // For now, return estimated kinematics based on filename
    const filename = path.basename(pszFilePath, '.psz');

    return this.estimateKinematicsFromFilename(filename);
  }

  /**
   * Convert JT file to OBJ using JtReader.dll
   */
  async convertJTtoOBJ(
    jtFilePath: string,
    outputDir: string
  ): Promise<{ objPath: string; kinematics: RobotKinematicData }> {
    console.log(`[Tecnomatix] Converting JT: ${jtFilePath}`);

    const modelViewerExe = path.join(this.lineSimulatorPath, 'ModelViewer.exe');

    const outputObjPath = path.join(
      outputDir,
      path.basename(jtFilePath, '.jt') + '.obj'
    );

    try {
      const cmd = `"${modelViewerExe}" -input "${jtFilePath}" -export obj -output "${outputObjPath}"`;

      console.log(`[Tecnomatix] Running: ${cmd}`);
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.lineSimulatorPath,
        timeout: 60000
      });

      if (stderr) {
        console.warn(`[Tecnomatix] Warnings: ${stderr}`);
      }

      console.log(`[Tecnomatix] Conversion output: ${stdout}`);

      // Estimate kinematics from filename (JT doesn't contain full kinematics)
      const filename = path.basename(jtFilePath, '.jt');
      const kinematics = this.estimateKinematicsFromFilename(filename);

      return {
        objPath: outputObjPath,
        kinematics
      };

    } catch (error) {
      throw new Error(`JT conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Estimate robot kinematics from filename
   * Tecnomatix uses standard naming: manufacturer_model_variant
   * Example: "kr270r2700ultra" → KUKA KR270 R2700 Ultra
   */
  private estimateKinematicsFromFilename(filename: string): RobotKinematicData {
    const lower = filename.toLowerCase();

    // Detect manufacturer
    let manufacturer: TecnomatixRobotData['manufacturer'] = 'Other';
    if (lower.includes('kr') || lower.includes('kuka')) manufacturer = 'KUKA';
    else if (lower.includes('fanuc') || lower.match(/^[rm]\d{1,3}/)) manufacturer = 'FANUC';
    else if (lower.includes('abb') || lower.includes('irb')) manufacturer = 'ABB';
    else if (lower.includes('kawasaki') || lower.includes('rs')) manufacturer = 'Kawasaki';

    // Most industrial robots are 6-axis
    const dof = lower.includes('7axis') || lower.includes('_7') ? 7 : 6;

    // Create standard 6-axis joint configuration
    const joints: JointDefinition[] = this.createStandardJoints(dof, manufacturer);
    const links: LinkDefinition[] = this.createStandardLinks(dof);

    return {
      type: dof === 7 ? '7-axis' : '6-axis',
      dof,
      joints,
      links,
      toolMountPoint: {
        position: [0, 0, 0],
        rotation: [0, 0, 0]
      },
      baseMountPoint: {
        position: [0, 0, 0],
        rotation: [0, 0, 0]
      },
      workEnvelope: this.estimateWorkspace(manufacturer, filename)
    };
  }

  /**
   * Create standard joint definitions based on manufacturer
   */
  private createStandardJoints(dof: number, manufacturer: string): JointDefinition[] {
    const joints: JointDefinition[] = [];

    // Standard 6-axis industrial robot configuration
    const standardConfig = {
      'KUKA': {
        J1: { axis: 'Z' as const, limits: { min: -185, max: 185 }, velocity: { max: 156 } },
        J2: { axis: 'Y' as const, limits: { min: -155, max: 35 }, velocity: { max: 156 } },
        J3: { axis: 'Y' as const, limits: { min: -130, max: 154 }, velocity: { max: 156 } },
        J4: { axis: 'X' as const, limits: { min: -350, max: 350 }, velocity: { max: 330 } },
        J5: { axis: 'Y' as const, limits: { min: -130, max: 130 }, velocity: { max: 330 } },
        J6: { axis: 'Z' as const, limits: { min: -350, max: 350 }, velocity: { max: 615 } }
      },
      'FANUC': {
        J1: { axis: 'Z' as const, limits: { min: -180, max: 180 }, velocity: { max: 150 } },
        J2: { axis: 'Y' as const, limits: { min: -90, max: 90 }, velocity: { max: 150 } },
        J3: { axis: 'Y' as const, limits: { min: -170, max: 170 }, velocity: { max: 150 } },
        J4: { axis: 'X' as const, limits: { min: -190, max: 190 }, velocity: { max: 320 } },
        J5: { axis: 'Y' as const, limits: { min: -125, max: 125 }, velocity: { max: 320 } },
        J6: { axis: 'Z' as const, limits: { min: -360, max: 360 }, velocity: { max: 560 } }
      },
      'ABB': {
        J1: { axis: 'Z' as const, limits: { min: -180, max: 180 }, velocity: { max: 170 } },
        J2: { axis: 'Y' as const, limits: { min: -100, max: 115 }, velocity: { max: 170 } },
        J3: { axis: 'Y' as const, limits: { min: -245, max: 65 }, velocity: { max: 170 } },
        J4: { axis: 'X' as const, limits: { min: -200, max: 200 }, velocity: { max: 360 } },
        J5: { axis: 'Y' as const, limits: { min: -115, max: 115 }, velocity: { max: 360 } },
        J6: { axis: 'Z' as const, limits: { min: -400, max: 400 }, velocity: { max: 450 } }
      },
      'Kawasaki': {
        J1: { axis: 'Z' as const, limits: { min: -170, max: 170 }, velocity: { max: 145 } },
        J2: { axis: 'Y' as const, limits: { min: -120, max: 75 }, velocity: { max: 145 } },
        J3: { axis: 'Y' as const, limits: { min: -105, max: 165 }, velocity: { max: 145 } },
        J4: { axis: 'X' as const, limits: { min: -180, max: 180 }, velocity: { max: 295 } },
        J5: { axis: 'Y' as const, limits: { min: -120, max: 120 }, velocity: { max: 295 } },
        J6: { axis: 'Z' as const, limits: { min: -360, max: 360 }, velocity: { max: 460 } }
      }
    };

    const config = standardConfig[manufacturer as keyof typeof standardConfig] || standardConfig['KUKA'];

    for (let i = 1; i <= Math.min(dof, 6); i++) {
      const jointKey = `J${i}` as keyof typeof config;
      const jointConfig = config[jointKey];

      joints.push({
        name: `J${i}`,
        index: i - 1,
        type: 'revolute',
        axis: jointConfig.axis,
        limits: jointConfig.limits,
        velocity: jointConfig.velocity
      });
    }

    // Add 7th axis if needed (typically linear track)
    if (dof === 7) {
      joints.push({
        name: 'E1', // External axis
        index: 6,
        type: 'prismatic',
        axis: 'X',
        limits: { min: 0, max: 3000 }, // 3m track
        velocity: { max: 2000 } // 2 m/s
      });
    }

    return joints;
  }

  /**
   * Create standard link definitions
   */
  private createStandardLinks(dof: number): LinkDefinition[] {
    const links: LinkDefinition[] = [];

    const linkNames = ['base', 'link1', 'link2', 'link3', 'link4', 'link5', 'link6', 'link7'];

    for (let i = 0; i <= dof; i++) {
      links.push({
        name: linkNames[i],
        index: i,
        meshName: linkNames[i],
        parent: i === 0 ? null : i - 1,
        joint: i === 0 ? -1 : i - 1
      });
    }

    return links;
  }

  /**
   * Estimate workspace envelope from manufacturer and model
   */
  private estimateWorkspace(manufacturer: string, model: string): WorkspaceEnvelope {
    // Extract reach from model name (e.g., "kr270r2700" → 2700mm reach)
    const reachMatch = model.match(/r(\d{4})/);
    const reach = reachMatch ? parseInt(reachMatch[1]) : 2000;

    // Extract payload (e.g., "kr270" → 270kg)
    const payloadMatch = model.match(/(?:kr|m|irb)(\d{2,3})/);
    const payload = payloadMatch ? parseInt(payloadMatch[1]) : 100;

    return {
      reachRadius: reach,
      heightRange: [-500, reach],
      payload: payload,
      repeatability: manufacturer === 'KUKA' ? 0.06 : 0.1 // KUKA typically ±0.06mm
    };
  }

  /**
   * Batch convert entire robot library
   */
  async batchConvertLibrary(
    libraryPath: string,
    outputDir: string,
    onProgress?: (current: number, total: number, robotName: string) => void
  ): Promise<TecnomatixRobotData[]> {
    console.log(`[Tecnomatix] Batch converting library: ${libraryPath}`);

    // Find all PSZ and JT files
    const pszFiles = await findFiles(libraryPath, '.psz');
    const jtFiles = await findFiles(libraryPath, '.jt');

    const allFiles = [...pszFiles, ...jtFiles];
    const totalFiles = allFiles.length;

    console.log(`[Tecnomatix] Found ${totalFiles} robot files (${pszFiles.length} PSZ, ${jtFiles.length} JT)`);

    const results: TecnomatixRobotData[] = [];

    for (let i = 0; i < allFiles.length; i++) {
      const filePath = allFiles[i];
      const ext = path.extname(filePath).toLowerCase();
      const robotName = path.basename(filePath, ext);

      onProgress?.(i + 1, totalFiles, robotName);

      try {
        let result: { objPath: string; kinematics: RobotKinematicData };

        if (ext === '.psz') {
          result = await this.convertPSZtoOBJ(filePath, outputDir);
        } else {
          result = await this.convertJTtoOBJ(filePath, outputDir);
        }

        // Detect manufacturer and year range from path
        const manufacturer = this.detectManufacturer(filePath);
        const yearRange = this.detectYearRange(filePath);

        results.push({
          manufacturer,
          model: robotName,
          yearRange,
          kinematics: result.kinematics,
          geometry: {
            objPath: result.objPath,
            [ext === '.psz' ? 'pszPath' : 'jtPath']: filePath
          }
        });

        console.log(`[Tecnomatix] ✓ Converted ${robotName}`);

      } catch (error) {
        console.error(`[Tecnomatix] ✗ Failed to convert ${robotName}:`, error);
      }
    }

    return results;
  }

  /**
   * Detect manufacturer from file path
   */
  private detectManufacturer(filePath: string): TecnomatixRobotData['manufacturer'] {
    const lower = filePath.toLowerCase();

    if (lower.includes('kuka')) return 'KUKA';
    if (lower.includes('fanuc')) return 'FANUC';
    if (lower.includes('abb')) return 'ABB';
    if (lower.includes('kawasaki')) return 'Kawasaki';
    if (lower.includes('universal') || lower.includes('ur')) return 'Universal Robots';

    return 'Other';
  }

  /**
   * Detect year range from file path (e.g., "2010-2020" or "v2015")
   */
  private detectYearRange(filePath: string): [number, number] {
    const yearMatch = filePath.match(/(\d{4})/g);

    if (yearMatch && yearMatch.length >= 2) {
      const years = yearMatch.map(y => parseInt(y)).sort();
      return [years[0], years[years.length - 1]];
    }

    // Default to current year ± 10 years
    const currentYear = new Date().getFullYear();
    return [currentYear - 10, currentYear];
  }
}

/**
 * File utility functions
 */
async function findFiles(dir: string, extension: string): Promise<string[]> {
  const fs = await import('fs/promises');
  const files: string[] = [];

  async function scan(directory: string) {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`[Tecnomatix] Could not scan ${directory}:`, error);
    }
  }

  await scan(dir);
  return files;
}
