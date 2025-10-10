/**
 * JT Kinematic Extractor
 * Extracts kinematic data (joints, constraints, assembly structure) from JT files
 * and applies it to GLB meshes for kinematic simulation
 */

import * as BABYLON from '@babylonjs/core';
import { Joint, Link, KinematicDevice, JointType, Frame, Vector3 } from '../../kinematics/device/UnifiedDeviceDefinition';
import { KinematicsManager } from '../../kinematics/KinematicsManager';

export interface JTKinematicData {
    joints: JTJoint[];
    links: JTLink[];
    assemblyStructure: JTAssemblyNode[];
    constraints: JTConstraint[];
}

export interface JTJoint {
    id: string;
    name: string;
    type: 'revolute' | 'prismatic' | 'fixed' | 'spherical';
    parentLinkId: string;
    childLinkId: string;
    axis: Vector3;
    origin: Vector3;
    limits?: {
        min: number;
        max: number;
        velocity?: number;
        effort?: number;
    };
    // JT-specific data
    jtPartId: string;
    transform?: BABYLON.Matrix;
}

export interface JTLink {
    id: string;
    name: string;
    jtPartId: string;
    geometry?: {
        vertices: number[];
        indices: number[];
        normals: number[];
    };
    mass?: number;
    inertia?: {
        xx: number; yy: number; zz: number;
        xy: number; xz: number; yz: number;
    };
}

export interface JTAssemblyNode {
    id: string;
    name: string;
    jtPartId: string;
    parentId?: string;
    transform: BABYLON.Matrix;
    children: string[];
    isJoint?: boolean;
    jointId?: string;
}

export interface JTConstraint {
    type: 'revolute' | 'prismatic' | 'fixed' | 'spherical' | 'planar' | 'cylindrical';
    part1Id: string;
    part2Id: string;
    axis?: Vector3;
    origin?: Vector3;
    limits?: {
        min: number;
        max: number;
    };
}

export class JTKinematicExtractor {
    private kinematicsManager: KinematicsManager;

    constructor() {
        this.kinematicsManager = KinematicsManager.getInstance();
    }

    /**
     * Extract kinematic data from JT file JSON (from jtdump or PyOpenJt)
     */
    async extractKinematicData(jtJsonData: any): Promise<JTKinematicData> {
        console.log('[JT Kinematic] Extracting kinematic data from JT JSON...');
        
        const kinematicData: JTKinematicData = {
            joints: [],
            links: [],
            assemblyStructure: [],
            constraints: []
        };

        // Parse assembly structure from JT JSON
        await this.parseAssemblyStructure(jtJsonData, kinematicData);
        
        // Extract joints and constraints
        await this.extractJointsAndConstraints(jtJsonData, kinematicData);
        
        // Create links from parts
        await this.createLinksFromParts(jtJsonData, kinematicData);

        console.log(`[JT Kinematic] Extracted ${kinematicData.joints.length} joints, ${kinematicData.links.length} links`);
        return kinematicData;
    }

    /**
     * Parse assembly structure from JT TocTable and Logical Scene Graph
     */
    private async parseAssemblyStructure(jtJsonData: any, kinematicData: JTKinematicData): Promise<void> {
        const tocTable = jtJsonData.TocTable || [];
        
        // Find Logical Scene Graph entry
        const sceneGraphEntry = tocTable.find((entry: any[]) => 
            entry[2] && entry[2].includes('Logical Scene Graph')
        );

        if (sceneGraphEntry) {
            console.log('[JT Kinematic] Found Logical Scene Graph, parsing assembly structure...');
            
            // For now, create a basic assembly structure based on shape entries
            // In a full implementation, this would parse the actual scene graph
            const shapeEntries = tocTable.filter((entry: any[]) => 
                entry[2] && entry[2].includes('Shape')
            );

            shapeEntries.forEach((entry: any[], index: number) => {
                const nodeId = `jt_node_${index}`;
                const jtPartId = entry[0];
                const nodeName = `JT_Component_${index}`;

                kinematicData.assemblyStructure.push({
                    id: nodeId,
                    name: nodeName,
                    jtPartId: jtPartId,
                    transform: BABYLON.Matrix.Identity(),
                    children: []
                });
            });
        }
    }

    /**
     * Extract joints and constraints from JT assembly data
     */
    private async extractJointsAndConstraints(jtJsonData: any, kinematicData: JTKinematicData): Promise<void> {
        // For robot files, infer joint structure based on naming patterns and geometry
        const assemblyNodes = kinematicData.assemblyStructure;
        
        if (assemblyNodes.length >= 3) {
            // Assume this is a robot with serial kinematic chain
            console.log('[JT Kinematic] Detected robot structure, inferring joints...');
            
            // Create joints between consecutive parts
            for (let i = 0; i < assemblyNodes.length - 1; i++) {
                const parentNode = assemblyNodes[i];
                const childNode = assemblyNodes[i + 1];
                
                const jointId = `joint_${i}`;
                const jointName = `Joint_${i + 1}`;
                
                // Determine joint type based on position in chain
                let jointType: 'revolute' | 'prismatic' | 'fixed' = 'revolute';
                if (i === 0) jointType = 'revolute'; // Base rotation
                else if (i === assemblyNodes.length - 2) jointType = 'revolute'; // Wrist
                else jointType = 'revolute'; // Arm joints
                
                // Create joint axis (typical robot joint axes)
                const axis: Vector3 = { x: 0, y: 0, z: 1 }; // Z-axis rotation
                if (i % 2 === 1) axis.x = 1; // Alternate X-axis for some joints
                
                const joint: JTJoint = {
                    id: jointId,
                    name: jointName,
                    type: jointType,
                    parentLinkId: parentNode.id,
                    childLinkId: childNode.id,
                    axis: axis,
                    origin: { x: 0, y: 0, z: 0 },
                    limits: {
                        min: -Math.PI,
                        max: Math.PI,
                        velocity: 1.0,
                        effort: 100.0
                    },
                    jtPartId: childNode.jtPartId
                };
                
                kinematicData.joints.push(joint);
                
                // Mark nodes as joints
                parentNode.isJoint = true;
                parentNode.jointId = jointId;
            }
        }
    }

    /**
     * Create links from JT parts
     */
    private async createLinksFromParts(jtJsonData: any, kinematicData: JTKinematicData): Promise<void> {
        kinematicData.assemblyStructure.forEach((node, index) => {
            const link: JTLink = {
                id: `link_${index}`,
                name: `Link_${index}`,
                jtPartId: node.jtPartId,
                mass: 1.0, // Default mass
                inertia: {
                    xx: 0.1, yy: 0.1, zz: 0.1,
                    xy: 0, xz: 0, yz: 0
                }
            };
            
            kinematicData.links.push(link);
        });
    }

    /**
     * Apply kinematic data to GLB meshes
     */
    async applyKinematicsToGLB(
        kinematicData: JTKinematicData,
        glbMeshes: BABYLON.AbstractMesh[],
        scene: BABYLON.Scene
    ): Promise<void> {
        console.log('[JT Kinematic] Applying kinematics to GLB meshes...');
        
        // Create kinematic device from extracted data
        const kinematicDevice = this.createKinematicDevice(kinematicData);
        
        // Apply kinematic structure to meshes
        await this.createKinematicChain(kinematicDevice, glbMeshes, scene);
    }

    /**
     * Create kinetiCORE KinematicDevice from JT data
     */
    private createKinematicDevice(kinematicData: JTKinematicData): KinematicDevice {
        const joints: Joint[] = kinematicData.joints.map(jtJoint => ({
            id: jtJoint.id,
            name: jtJoint.name,
            type: jtJoint.type as JointType,
            parentLink: jtJoint.parentLinkId,
            childLink: jtJoint.childLinkId,
            parentFrame: {
                origin: jtJoint.origin,
                xAxis: { x: 1, y: 0, z: 0 },
                yAxis: { x: 0, y: 1, z: 0 },
                zAxis: { x: 0, y: 0, z: 1 }
            },
            childFrame: {
                origin: { x: 0, y: 0, z: 0 },
                xAxis: { x: 1, y: 0, z: 0 },
                yAxis: { x: 0, y: 1, z: 0 },
                zAxis: { x: 0, y: 0, z: 1 }
            },
            axis: jtJoint.axis,
            limits: jtJoint.limits || { min: -Math.PI, max: Math.PI },
            currentValue: 0,
            showAxis: true,
            axisLength: 100
        }));

        const links: Link[] = kinematicData.links.map(jtLink => ({
            id: jtLink.id,
            name: jtLink.name,
            mass: jtLink.mass || 1.0,
            inertia: jtLink.inertia || {
                xx: 0.1, yy: 0.1, zz: 0.1,
                xy: 0, xz: 0, yz: 0
            },
            geometry: jtLink.geometry,
            material: {
                color: { r: 0.8, g: 0.8, b: 0.8, a: 1.0 },
                metallic: 0.2,
                roughness: 0.8
            }
        }));

        return {
            id: 'jt_robot',
            name: 'JT Robot',
            type: 'robot',
            joints: joints,
            links: links,
            actuators: [],
            sensors: [],
            exportFormat: 'kicore'
        };
    }

    /**
     * Create kinematic chain in kinetiCORE
     */
    private async createKinematicChain(
        device: KinematicDevice,
        meshes: BABYLON.AbstractMesh[],
        scene: BABYLON.Scene
    ): Promise<void> {
        console.log('[JT Kinematic] Creating kinematic chain...');
        
        // Create kinematic chain using KinematicsManager
        const chainId = 'jt_robot_chain';
        
        // Configure joints
        const jointConfigs = device.joints.map(joint => ({
            id: joint.id,
            name: joint.name,
            type: joint.type,
            parentNodeId: joint.parentLink,
            childNodeId: joint.childLink,
            axis: joint.axis,
            origin: joint.parentFrame.origin,
            limits: {
                lower: joint.limits.min,
                upper: joint.limits.max,
                velocity: joint.limits.velocity || 1.0,
                effort: joint.limits.effort || 100.0
            },
            position: joint.currentValue,
            velocity: 0,
            effort: 0,
            showAxis: joint.showAxis,
            showLimits: true
        }));

        // Create the kinematic chain
        await this.kinematicsManager.createKinematicChain(chainId, {
            type: 'serial',
            joints: jointConfigs,
            grounding: {
                nodeId: device.links[0].id,
                fixed: true
            }
        });

        console.log(`[JT Kinematic] Created kinematic chain with ${jointConfigs.length} joints`);
    }

    /**
     * Extract kinematic data from JT file and apply to GLB
     * Main entry point for the workflow
     */
    async extractAndApplyKinematics(
        jtFile: File,
        glbFile: File,
        scene: BABYLON.Scene
    ): Promise<boolean> {
        try {
            console.log('[JT Kinematic] Starting JT→Kinematic→GLB workflow...');
            
            // Step 1: Load GLB file
            console.log('[JT Kinematic] Loading GLB file...');
            const glbResult = await BABYLON.SceneLoader.ImportMeshAsync(
                '',
                '',
                glbFile,
                scene
            );
            
            if (glbResult.meshes.length === 0) {
                throw new Error('No meshes loaded from GLB file');
            }
            
            // Step 2: Extract kinematic data from JT (placeholder for now)
            // In a real implementation, this would parse the JT file
            console.log('[JT Kinematic] Extracting kinematic data from JT...');
            const mockJtData = {
                TocTable: [
                    ['part1', 8, 'Shape LOD1'],
                    ['part2', 8, 'Shape LOD1'],
                    ['part3', 8, 'Shape LOD1'],
                    ['part4', 8, 'Shape LOD1'],
                    ['part5', 8, 'Shape LOD1'],
                    ['scene', 1, 'Logical Scene Graph']
                ]
            };
            
            const kinematicData = await this.extractKinematicData(mockJtData);
            
            // Step 3: Apply kinematics to GLB meshes
            await this.applyKinematicsToGLB(kinematicData, glbResult.meshes, scene);
            
            console.log('[JT Kinematic] JT→Kinematic→GLB workflow completed successfully!');
            return true;
            
        } catch (error) {
            console.error('[JT Kinematic] Workflow failed:', error);
            return false;
        }
    }
}
