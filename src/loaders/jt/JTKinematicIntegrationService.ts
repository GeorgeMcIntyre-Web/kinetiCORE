/**
 * JT Kinematic Integration Service
 * Integrates JT kinematic extraction with existing JT loading pipeline
 */

import { JTKinematicExtractor, JTKinematicData } from './JTKinematicExtractor';
import { JTLoader } from './JTLoader';
import { JTConversionService } from './JTConversionService';
import * as BABYLON from '@babylonjs/core';

export interface JTKinematicImportOptions {
    extractKinematics: boolean;
    createPhysicsJoints: boolean;
    applyToGLB: boolean;
    glbFilePath?: string;
}

export class JTKinematicIntegrationService {
    private kinematicExtractor: JTKinematicExtractor;
    private jtLoader: JTLoader;
    private conversionService: JTConversionService;

    constructor() {
        this.kinematicExtractor = new JTKinematicExtractor();
        this.jtLoader = new JTLoader();
        this.conversionService = new JTConversionService();
    }

    /**
     * Load JT file with kinematic data extraction and GLB integration
     */
    async loadJTWithKinematics(
        jtFile: File,
        scene: BABYLON.Scene,
        options: JTKinematicImportOptions = { extractKinematics: true, createPhysicsJoints: false, applyToGLB: false }
    ): Promise<{
        meshes: BABYLON.AbstractMesh[];
        kinematicData?: JTKinematicData;
        success: boolean;
        error?: string;
    }> {
        try {
            console.log('[JT Kinematic Integration] Starting JT load with kinematics...');

            // Step 1: Load JT file using existing loader
            const meshes = await this.jtLoader.load(jtFile, (progress) => {
                console.log(`[JT Loader] ${progress.stage}: ${progress.percentComplete}%`);
            });

            if (meshes.length === 0) {
                throw new Error('No meshes loaded from JT file');
            }

            let kinematicData: JTKinematicData | undefined;

            // Step 2: Extract kinematic data if requested
            if (options.extractKinematics) {
                console.log('[JT Kinematic Integration] Extracting kinematic data...');
                
                // For now, create mock JT JSON data
                // In a real implementation, this would come from jtdump or PyOpenJt
                const mockJtData = this.createMockJTData(meshes.length);
                kinematicData = await this.kinematicExtractor.extractKinematicData(mockJtData);
                
                console.log(`[JT Kinematic Integration] Extracted ${kinematicData.joints.length} joints`);
            }

            // Step 3: Apply kinematics to meshes if requested
            if (options.extractKinematics && kinematicData) {
                await this.kinematicExtractor.applyKinematicsToGLB(kinematicData, meshes, scene);
            }

            // Step 4: Apply to external GLB file if specified
            if (options.applyToGLB && options.glbFilePath && kinematicData) {
                await this.applyKinematicsToExternalGLB(options.glbFilePath, kinematicData, scene);
            }

            return {
                meshes,
                kinematicData,
                success: true
            };

        } catch (error) {
            console.error('[JT Kinematic Integration] Failed:', error);
            return {
                meshes: [],
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Apply extracted kinematic data to an external GLB file
     */
    private async applyKinematicsToExternalGLB(
        glbFilePath: string,
        kinematicData: JTKinematicData,
        scene: BABYLON.Scene
    ): Promise<void> {
        try {
            console.log(`[JT Kinematic Integration] Applying kinematics to GLB: ${glbFilePath}`);
            
            // Load the GLB file
            const glbResult = await BABYLON.SceneLoader.ImportMeshAsync(
                '',
                '',
                glbFilePath,
                scene
            );

            if (glbResult.meshes.length === 0) {
                throw new Error('No meshes loaded from GLB file');
            }

            // Apply kinematic data to GLB meshes
            await this.kinematicExtractor.applyKinematicsToGLB(kinematicData, glbResult.meshes, scene);
            
            console.log('[JT Kinematic Integration] Successfully applied kinematics to GLB');

        } catch (error) {
            console.error('[JT Kinematic Integration] Failed to apply kinematics to GLB:', error);
            throw error;
        }
    }

    /**
     * Create mock JT data for testing (replace with real JT parsing)
     */
    private createMockJTData(meshCount: number): any {
        const tocTable = [];
        
        // Create mock parts
        for (let i = 0; i < meshCount; i++) {
            tocTable.push([`part_${i}`, 8, 'Shape LOD1']);
        }
        
        // Add scene graph entry
        tocTable.push(['scene_graph', 1, 'Logical Scene Graph']);
        
        return {
            FileName: 'mock_robot.jt',
            MajorVersion: '9',
            MinorVersion: '1',
            TocTable: tocTable
        };
    }

    /**
     * Complete workflow: JT → Kinematic Data → GLB Application
     */
    async completeWorkflow(
        jtFilePath: string,
        glbFilePath: string,
        scene: BABYLON.Scene
    ): Promise<boolean> {
        try {
            console.log('[JT Kinematic Integration] Starting complete workflow...');
            console.log(`JT: ${jtFilePath}`);
            console.log(`GLB: ${glbFilePath}`);

            // Load JT file
            const jtFile = new File([], 'robot.jt');
            // Note: In a real implementation, you'd load the actual file
            
            // Extract kinematic data
            const mockJtData = this.createMockJTData(5); // Assume 5-part robot
            const kinematicData = await this.kinematicExtractor.extractKinematicData(mockJtData);
            
            // Apply to GLB
            await this.applyKinematicsToExternalGLB(glbFilePath, kinematicData, scene);
            
            console.log('[JT Kinematic Integration] Complete workflow finished successfully!');
            return true;

        } catch (error) {
            console.error('[JT Kinematic Integration] Complete workflow failed:', error);
            return false;
        }
    }
}
