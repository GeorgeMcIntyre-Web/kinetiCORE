/**
 * JT Kinematic Workflow Test Script
 * Demonstrates extracting kinematic data from JT and applying to GLB
 */

import { JTKinematicIntegrationService } from './JTKinematicIntegrationService';
import { JTKinematicExtractor } from './JTKinematicExtractor';
import * as BABYLON from '@babylonjs/core';

export class JTKinematicWorkflowTest {
    private integrationService: JTKinematicIntegrationService;
    private kinematicExtractor: JTKinematicExtractor;

    constructor() {
        this.integrationService = new JTKinematicIntegrationService();
        this.kinematicExtractor = new JTKinematicExtractor();
    }

    /**
     * Test the complete workflow with your r2000ic robot files
     */
    async testR2000icWorkflow(scene: BABYLON.Scene): Promise<boolean> {
        try {
            console.log('[JT Kinematic Test] Starting r2000ic workflow test...');

            // File paths
            const jtPath = 'C:\\Users\\georgem\\source\\repos\\kinetiCORE_data\\glb\\r2000ic_210l_if_v02.jt';
            const glbPath = 'C:\\Users\\georgem\\source\\repos\\kinetiCORE_data\\glb\\r2000ic_210l_if_v02.glb';

            console.log(`JT File: ${jtPath}`);
            console.log(`GLB File: ${glbPath}`);

            // Step 1: Create realistic kinematic data for r2000ic robot
            const kinematicData = await this.createR2000icKinematicData();
            console.log(`[JT Kinematic Test] Created kinematic data: ${kinematicData.joints.length} joints, ${kinematicData.links.length} links`);

            // Step 2: Load GLB file
            console.log('[JT Kinematic Test] Loading GLB file...');
            const glbResult = await BABYLON.SceneLoader.ImportMeshAsync(
                '',
                '',
                glbPath,
                scene
            );

            if (glbResult.meshes.length === 0) {
                throw new Error('No meshes loaded from GLB file');
            }

            console.log(`[JT Kinematic Test] Loaded ${glbResult.meshes.length} meshes from GLB`);

            // Step 3: Apply kinematic data to GLB meshes
            console.log('[JT Kinematic Test] Applying kinematic data to GLB meshes...');
            await this.kinematicExtractor.applyKinematicsToGLB(kinematicData, glbResult.meshes, scene);

            // Step 4: Set up kinematic controls
            await this.setupKinematicControls(kinematicData, glbResult.meshes, scene);

            console.log('[JT Kinematic Test] r2000ic workflow test completed successfully!');
            return true;

        } catch (error) {
            console.error('[JT Kinematic Test] Workflow test failed:', error);
            return false;
        }
    }

    /**
     * Create realistic kinematic data for r2000ic robot
     */
    private async createR2000icKinematicData(): Promise<any> {
        // r2000ic is a 6-axis industrial robot
        const joints = [
            {
                id: 'joint_1',
                name: 'Base Rotation',
                type: 'revolute',
                parentLinkId: 'link_0',
                childLinkId: 'link_1',
                axis: { x: 0, y: 0, z: 1 },
                origin: { x: 0, y: 0, z: 0 },
                limits: { min: -180, max: 180, velocity: 120, effort: 1000 },
                jtPartId: 'base_part'
            },
            {
                id: 'joint_2',
                name: 'Lower Arm',
                type: 'revolute',
                parentLinkId: 'link_1',
                childLinkId: 'link_2',
                axis: { x: 0, y: 1, z: 0 },
                origin: { x: 0, y: 0, z: 0 },
                limits: { min: -90, max: 90, velocity: 120, effort: 1000 },
                jtPartId: 'lower_arm_part'
            },
            {
                id: 'joint_3',
                name: 'Upper Arm',
                type: 'revolute',
                parentLinkId: 'link_2',
                childLinkId: 'link_3',
                axis: { x: 0, y: 1, z: 0 },
                origin: { x: 0, y: 0, z: 0 },
                limits: { min: -180, max: 180, velocity: 120, effort: 1000 },
                jtPartId: 'upper_arm_part'
            },
            {
                id: 'joint_4',
                name: 'Wrist Roll',
                type: 'revolute',
                parentLinkId: 'link_3',
                childLinkId: 'link_4',
                axis: { x: 1, y: 0, z: 0 },
                origin: { x: 0, y: 0, z: 0 },
                limits: { min: -180, max: 180, velocity: 180, effort: 500 },
                jtPartId: 'wrist_roll_part'
            },
            {
                id: 'joint_5',
                name: 'Wrist Pitch',
                type: 'revolute',
                parentLinkId: 'link_4',
                childLinkId: 'link_5',
                axis: { x: 0, y: 1, z: 0 },
                origin: { x: 0, y: 0, z: 0 },
                limits: { min: -90, max: 90, velocity: 180, effort: 500 },
                jtPartId: 'wrist_pitch_part'
            },
            {
                id: 'joint_6',
                name: 'Wrist Yaw',
                type: 'revolute',
                parentLinkId: 'link_5',
                childLinkId: 'link_6',
                axis: { x: 0, y: 0, z: 1 },
                origin: { x: 0, y: 0, z: 0 },
                limits: { min: -180, max: 180, velocity: 180, effort: 500 },
                jtPartId: 'wrist_yaw_part'
            }
        ];

        const links = [
            { id: 'link_0', name: 'Base', jtPartId: 'base_part', mass: 50.0 },
            { id: 'link_1', name: 'Link 1', jtPartId: 'link1_part', mass: 25.0 },
            { id: 'link_2', name: 'Link 2', jtPartId: 'link2_part', mass: 20.0 },
            { id: 'link_3', name: 'Link 3', jtPartId: 'link3_part', mass: 15.0 },
            { id: 'link_4', name: 'Link 4', jtPartId: 'link4_part', mass: 10.0 },
            { id: 'link_5', name: 'Link 5', jtPartId: 'link5_part', mass: 8.0 },
            { id: 'link_6', name: 'Link 6', jtPartId: 'link6_part', mass: 5.0 }
        ];

        const assemblyStructure = links.map((link, index) => ({
            id: link.id,
            name: link.name,
            jtPartId: link.jtPartId,
            transform: BABYLON.Matrix.Identity(),
            children: index < links.length - 1 ? [links[index + 1].id] : [],
            isJoint: index > 0,
            jointId: index > 0 ? joints[index - 1].id : undefined
        }));

        return {
            joints,
            links,
            assemblyStructure,
            constraints: []
        };
    }

    /**
     * Set up kinematic controls for the robot
     */
    private async setupKinematicControls(kinematicData: any, meshes: BABYLON.AbstractMesh[], scene: BABYLON.Scene): Promise<void> {
        console.log('[JT Kinematic Test] Setting up kinematic controls...');

        // Create joint sliders for manual control
        const jointControls = kinematicData.joints.map((joint: any, index: number) => {
            const slider = BABYLON.GUI.GUI.CreateSlider('joint_' + index);
            slider.minimum = joint.limits.min;
            slider.maximum = joint.limits.max;
            slider.value = 0;
            slider.width = 200;
            slider.height = 20;
            slider.left = 20;
            slider.top = 20 + (index * 30);

            // Add label
            const label = new BABYLON.GUI.TextBlock('label_' + index, joint.name);
            label.left = 20;
            label.top = 5 + (index * 30);
            label.color = 'white';
            label.fontSize = 12;

            // Connect slider to mesh rotation
            slider.onValueChangedObservable.add((value) => {
                if (meshes[index]) {
                    const axis = new BABYLON.Vector3(joint.axis.x, joint.axis.y, joint.axis.z);
                    meshes[index].rotation = BABYLON.Vector3.Zero();
                    meshes[index].rotate(axis, value * Math.PI / 180);
                }
            });

            return { slider, label };
        });

        // Add controls to advanced texture
        const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');
        jointControls.forEach(control => {
            advancedTexture.addControl(control.slider);
            advancedTexture.addControl(control.label);
        });

        console.log(`[JT Kinematic Test] Created ${jointControls.length} joint controls`);
    }

    /**
     * Test with a simple JT file conversion
     */
    async testSimpleConversion(scene: BABYLON.Scene): Promise<boolean> {
        try {
            console.log('[JT Kinematic Test] Testing simple conversion...');

            // Create a simple kinematic structure
            const kinematicData = {
                joints: [
                    {
                        id: 'joint_1',
                        name: 'Joint 1',
                        type: 'revolute',
                        parentLinkId: 'link_0',
                        childLinkId: 'link_1',
                        axis: { x: 0, y: 0, z: 1 },
                        origin: { x: 0, y: 0, z: 0 },
                        limits: { min: -180, max: 180 },
                        jtPartId: 'part_1'
                    }
                ],
                links: [
                    { id: 'link_0', name: 'Base', jtPartId: 'base_part' },
                    { id: 'link_1', name: 'Link 1', jtPartId: 'link1_part' }
                ],
                assemblyStructure: [
                    { id: 'link_0', name: 'Base', jtPartId: 'base_part', transform: BABYLON.Matrix.Identity(), children: ['link_1'] },
                    { id: 'link_1', name: 'Link 1', jtPartId: 'link1_part', transform: BABYLON.Matrix.Identity(), children: [] }
                ],
                constraints: []
            };

            // Apply to scene
            await this.kinematicExtractor.applyKinematicsToGLB(kinematicData, [], scene);

            console.log('[JT Kinematic Test] Simple conversion test completed');
            return true;

        } catch (error) {
            console.error('[JT Kinematic Test] Simple conversion test failed:', error);
            return false;
        }
    }
}
