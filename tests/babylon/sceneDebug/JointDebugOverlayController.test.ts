import { describe, it, expect, vi } from 'vitest';
import { JointDebugOverlayController } from '../../../src/babylon/sceneDebug/JointDebugOverlayController';
import type { DetectedToolJoint } from '../../../src/babylon/sceneAnalysis/ToolingTypes';
import * as BABYLON from '@babylonjs/core';

/**
 * JointDebugOverlayController Tests
 * 
 * Tests UI integration layer for joint visualization overlay.
 * NO "car line" concepts - tooling/model origin only.
 */
describe('JointDebugOverlayController', () => {
    let engine: BABYLON.NullEngine;
    let scene: BABYLON.Scene;
    let controller: JointDebugOverlayController;

    beforeEach(() => {
        engine = new BABYLON.NullEngine();
        scene = new BABYLON.Scene(engine);
        controller = new JointDebugOverlayController(scene);
    });

    afterEach(() => {
        controller.dispose();
        scene.dispose();
        engine.dispose();
    });

    describe('Lifecycle Management', () => {
        it('should initialize with scene', () => {
            const newController = new JointDebugOverlayController(scene);
            expect(newController).toBeDefined();
            newController.dispose();
        });

        it('should initialize without scene and accept later', () => {
            const newController = new JointDebugOverlayController();
            newController.initialize(scene);
            expect(newController.getEnabled()).toBe(false);
            newController.dispose();
        });

        it('should dispose cleanly', () => {
            controller.dispose();
            // Should not throw
            controller.dispose(); // Double dispose guard
        });
    });

    describe('Joint Updates', () => {
        const createMockJoint = (id: string, isPrismatic: boolean): DetectedToolJoint => ({
            unitId: 'unit_001',
            familyId: 'family_001',
            jointId: id,
            strokeCategory: 'normal',
            translationRatio: 0,
            axisWorld: new BABYLON.Vector3(0, 0, 1),
            travelWorld: 0.5,
            originWorld: new BABYLON.Vector3(0, 0, 0),
            isPrismatic,
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
            deltaType: isPrismatic ? 'prismatic' : 'revolute',
        });

        it('should cache joints when updateFromJoints is called', () => {
            const joints = [createMockJoint('j1', false), createMockJoint('j2', true)];

            controller.updateFromJoints(joints);

            expect(controller.getCachedJointsCount()).toBe(2);
        });

        it('should not show glyphs when disabled', () => {
            const joints = [createMockJoint('j1', false)];

            controller.setEnabled(false);
            controller.updateFromJoints(joints);

            // Joints cached but not shown
            expect(controller.getCachedJointsCount()).toBe(1);
            const meshes = scene.meshes.filter(m => m.name.includes('joint_'));
            expect(meshes.length).toBe(0);
        });

        it('should show glyphs when enabled', () => {
            const joints = [createMockJoint('j1', false)];

            controller.setEnabled(true);
            controller.updateFromJoints(joints);

            expect(controller.getCachedJointsCount()).toBe(1);
            const meshes = scene.meshes.filter(m => m.name.includes('joint_'));
            expect(meshes.length).toBeGreaterThan(0);
        });

        it('should clear glyphs when empty array provided', () => {
            const joints = [createMockJoint('j1', false)];

            controller.setEnabled(true);
            controller.updateFromJoints(joints);

            const meshesAfterAdd = scene.meshes.filter(m => m.name.includes('joint_'));
            expect(meshesAfterAdd.length).toBeGreaterThan(0);

            controller.updateFromJoints([]);

            const meshesAfterClear = scene.meshes.filter(m => m.name.includes('joint_'));
            expect(meshesAfterClear.length).toBe(0);
            expect(controller.getCachedJointsCount()).toBe(0);
        });
    });

    describe('Toggle Behavior', () => {
        const createMockJoint = (id: string): DetectedToolJoint => ({
            unitId: 'unit_001',
            familyId: 'family_001',
            jointId: id,
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
        });

        it('should show cached joints when enabled', () => {
            const joints = [createMockJoint('j1')];

            // Cache joints while disabled
            controller.setEnabled(false);
            controller.updateFromJoints(joints);

            expect(scene.meshes.filter(m => m.name.includes('joint_')).length).toBe(0);

            // Enable should show cached joints
            controller.setEnabled(true);

            const meshes = scene.meshes.filter(m => m.name.includes('joint_'));
            expect(meshes.length).toBeGreaterThan(0);
        });

        it('should clear glyphs when disabled', () => {
            const joints = [createMockJoint('j1')];

            controller.setEnabled(true);
            controller.updateFromJoints(joints);

            expect(scene.meshes.filter(m => m.name.includes('joint_')).length).toBeGreaterThan(0);

            controller.setEnabled(false);

            const meshes = scene.meshes.filter(m => m.name.includes('joint_'));
            expect(meshes.length).toBe(0);
        });

        it('should track enabled state', () => {
            expect(controller.getEnabled()).toBe(false);

            controller.setEnabled(true);
            expect(controller.getEnabled()).toBe(true);

            controller.setEnabled(false);
            expect(controller.getEnabled()).toBe(false);
        });
    });

    describe('Clear Functionality', () => {
        const createMockJoint = (id: string): DetectedToolJoint => ({
            unitId: 'unit_001',
            familyId: 'family_001',
            jointId: id,
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
        });

        it('should clear both glyphs and cache', () => {
            const joints = [createMockJoint('j1')];

            controller.setEnabled(true);
            controller.updateFromJoints(joints);

            expect(controller.getCachedJointsCount()).toBe(1);
            expect(scene.meshes.filter(m => m.name.includes('joint_')).length).toBeGreaterThan(0);

            controller.clear();

            expect(controller.getCachedJointsCount()).toBe(0);
            expect(scene.meshes.filter(m => m.name.includes('joint_')).length).toBe(0);
        });
    });
});
