import { describe, it, expect, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { JointDebugOverlay } from '../../../src/babylon/sceneDebug/JointDebugOverlay';
import type { DetectedToolJoint } from '../../../src/babylon/sceneAnalysis/ToolingTypes';

/**
 * JointDebugOverlay Tests
 * 
 * Validates joint glyph rendering in 3D viewport.
 * NO "car line" concepts - tooling/model origin only.
 */
describe('JointDebugOverlay', () => {
    let engine: BABYLON.NullEngine;
    let scene: BABYLON.Scene;
    let overlay: JointDebugOverlay;

    beforeEach(() => {
        engine = new BABYLON.NullEngine();
        scene = new BABYLON.Scene(engine);
        overlay = new JointDebugOverlay(scene);
    });

    describe('Basic Functionality', () => {
        it('should create correct number of meshes for revolute joint', () => {
            const joint: DetectedToolJoint = {
                unitId: 'unit_001',
                familyId: 'family_001',
                jointId: 'joint_001',
                strokeCategory: 'normal',
                translationRatio: 0,
                axisWorld: new BABYLON.Vector3(0, 0, 1),
                travelWorld: 0.5,
                originWorld: new BABYLON.Vector3(0, 0, 0),
                isPrismatic: false,
                icpError: 0.001,
                bodySize: 0.1,
                vertexCountA: 100,
                vertexCountB: 100,
                vertexSimilarity: 1,
                isTwoStateFamily: true,
                nodeAId: 'node_a',
                nodeBId: 'node_b',
                transformA: BABYLON.Matrix.Identity(),
                transformB: BABYLON.Matrix.Identity(),
                deltaType: 'revolute',
            };

            overlay.showJoints([joint]);

            // Should create 2 meshes: axis cylinder + marker sphere
            const jointMeshes = scene.meshes.filter(m =>
                m.name.includes('joint_unit_001_joint_001')
            );

            expect(jointMeshes.length).toBe(2);
        });

        it('should create correct number of meshes for prismatic joint', () => {
            const joint: DetectedToolJoint = {
                unitId: 'unit_002',
                familyId: 'family_002',
                jointId: 'joint_002',
                strokeCategory: 'normal',
                translationRatio: 0.1,
                axisWorld: new BABYLON.Vector3(1, 0, 0),
                travelWorld: 0.1,
                originWorld: new BABYLON.Vector3(0, 0, 0),
                isPrismatic: true,
                icpError: 0.002,
                bodySize: 0.1,
                vertexCountA: 100,
                vertexCountB: 100,
                vertexSimilarity: 1,
                isTwoStateFamily: true,
                nodeAId: 'node_a',
                nodeBId: 'node_b',
                transformA: BABYLON.Matrix.Identity(),
                transformB: BABYLON.Matrix.Identity(),
                deltaType: 'prismatic',
            };

            overlay.showJoints([joint]);

            // Should create 3 meshes: shaft + cone + marker
            const jointMeshes = scene.meshes.filter(m =>
                m.name.includes('joint_unit_002_joint_002')
            );

            expect(jointMeshes.length).toBe(3);
        });

        it('should clear all meshes', () => {
            const joints: DetectedToolJoint[] = [
                {
                    unitId: 'unit_003',
                    familyId: 'family_003',
                    jointId: 'joint_003',
                    strokeCategory: 'normal',
                    translationRatio: 0,
                    axisWorld: new BABYLON.Vector3(0, 0, 1),
                    travelWorld: 0.5,
                    originWorld: new BABYLON.Vector3(0, 0, 0),
                    isPrismatic: false,
                    icpError: 0.001,
                    bodySize: 0.1,
                    vertexCountA: 100,
                    vertexCountB: 100,
                    vertexSimilarity: 1,
                    isTwoStateFamily: true,
                    nodeAId: 'node_a',
                    nodeBId: 'node_b',
                    transformA: BABYLON.Matrix.Identity(),
                    transformB: BABYLON.Matrix.Identity(),
                    deltaType: 'revolute',
                },
            ];

            overlay.showJoints(joints);

            const meshCountBefore = scene.meshes.length;
            expect(meshCountBefore).toBeGreaterThan(0);

            overlay.clear();

            const meshCountAfter = scene.meshes.length;
            expect(meshCountAfter).toBe(0);
        });

        it('should toggle visibility', () => {
            const joint: DetectedToolJoint = {
                unitId: 'unit_004',
                familyId: 'family_004',
                jointId: 'joint_004',
                strokeCategory: 'normal',
                translationRatio: 0,
                axisWorld: new BABYLON.Vector3(0, 1, 0),
                travelWorld: 0.3,
                originWorld: new BABYLON.Vector3(0, 0, 0),
                isPrismatic: false,
                icpError: 0.001,
                bodySize: 0.1,
                vertexCountA: 100,
                vertexCountB: 100,
                vertexSimilarity: 1,
                isTwoStateFamily: true,
                nodeAId: 'node_a',
                nodeBId: 'node_b',
                transformA: BABYLON.Matrix.Identity(),
                transformB: BABYLON.Matrix.Identity(),
                deltaType: 'revolute',
            };

            overlay.showJoints([joint]);

            // All meshes should be visible initially
            const jointMeshes = scene.meshes.filter(m =>
                m.name.includes('joint_unit_004_joint_004')
            );
            expect(jointMeshes.every(m => m.isVisible)).toBe(true);

            // Hide
            overlay.setVisible(false);
            expect(jointMeshes.every(m => !m.isVisible)).toBe(true);

            // Show again
            overlay.setVisible(true);
            expect(jointMeshes.every(m => m.isVisible)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty joint array gracefully', () => {
            overlay.showJoints([]);

            expect(scene.meshes.length).toBe(0);
        });

        it('should skip joints with missing axis', () => {
            const joint: DetectedToolJoint = {
                unitId: 'unit_005',
                familyId: 'family_005',
                jointId: 'joint_005',
                strokeCategory: 'normal',
                translationRatio: 0,
                axisWorld: null as any, // Missing axis
                travelWorld: 0.5,
                originWorld: new BABYLON.Vector3(0, 0, 0),
                isPrismatic: false,
                icpError: 0.001,
                bodySize: 0.1,
                vertexCountA: 100,
                vertexCountB: 100,
                vertexSimilarity: 1,
                isTwoStateFamily: true,
                nodeAId: 'node_a',
                nodeBId: 'node_b',
                transformA: BABYLON.Matrix.Identity(),
                transformB: BABYLON.Matrix.Identity(),
                deltaType: 'revolute',
            };

            overlay.showJoints([joint]);

            // Should skip this joint, no meshes created
            expect(scene.meshes.length).toBe(0);
        });

        it('should skip joints with missing origin', () => {
            const joint: DetectedToolJoint = {
                unitId: 'unit_006',
                familyId: 'family_006',
                jointId: 'joint_006',
                strokeCategory: 'normal',
                translationRatio: 0,
                axisWorld: new BABYLON.Vector3(0, 0, 1),
                travelWorld: 0.5,
                originWorld: null as any, // Missing origin
                isPrismatic: false,
                icpError: 0.001,
                bodySize: 0.1,
                vertexCountA: 100,
                vertexCountB: 100,
                vertexSimilarity: 1,
                isTwoStateFamily: true,
                nodeAId: 'node_a',
                nodeBId: 'node_b',
                transformA: BABYLON.Matrix.Identity(),
                transformB: BABYLON.Matrix.Identity(),
                deltaType: 'revolute',
            };

            overlay.showJoints([joint]);

            // Should skip this joint, no meshes created
            expect(scene.meshes.length).toBe(0);
        });
    });
});
