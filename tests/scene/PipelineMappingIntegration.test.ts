import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KinematicExtractionPipeline } from '../../src/babylon/pipeline/KinematicExtractionPipeline';
import { SceneTreeManager } from '../../src/scene/SceneTreeManager';
import { ToolUnit } from '../../src/babylon/sceneAnalysis/ToolGraphAnalyzer';
import * as BABYLON from '@babylonjs/core';

// Mock dependencies
vi.mock('../../src/scene/SceneTreeManager');
vi.mock('../../src/babylon/sceneAnalysis/StructureBasedToolAnalyzer');
vi.mock('../../src/babylon/sceneAnalysis/GeometricToolAnalyzer');
vi.mock('../../src/babylon/sceneAnalysis/NameBasedToolAnalyzer');
vi.mock('../../src/babylon/pipeline/StateCaptureService');

describe('Pipeline Mapping Integration', () => {
    let pipeline: KinematicExtractionPipeline;
    let mockScene: BABYLON.Scene;
    let mockTree: any;
    let consoleSpy: any;

    beforeEach(() => {
        // Setup mocks
        mockScene = {} as unknown as BABYLON.Scene;

        // Mock SceneTreeManager instance
        mockTree = {
            getNodeByBabylonTransformNodeId: vi.fn(),
            getNodeByBabylonMeshId: vi.fn(),
            getNode: vi.fn(),
            getAllNodes: vi.fn(),
        };
        (SceneTreeManager.getInstance as any).mockReturnValue(mockTree);

        // Spy on console to verify logging
        consoleSpy = vi.spyOn(console, 'log');

        pipeline = new KinematicExtractionPipeline(mockScene);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should correctly map and log a unit using the robust helper', async () => {
        // Setup a mock ToolGraph
        const mockUnit: ToolUnit = {
            id: 'unit-1',
            name: 'Test Unit',
            root: 'root-1',
            babylonUniqueId: 12345,
            type: 'fixture',
            isFixed: false,
            nodes: [],
        };

        // Mock the analyzer to return this graph
        const mockAnalyze = vi.fn().mockReturnValue({
            units: [mockUnit],
            anchors: {},
        });

        // Inject mock analyzer behavior
        (pipeline as any).geometricAnalyzer = { analyze: mockAnalyze };

        // Setup SceneTree to find the node
        const mockSceneNode = {
            id: 'scene-node-1',
            name: 'Scene Node 1',
            babylonTransformNodeId: '12345',
            childIds: [],
        };
        mockTree.getNodeByBabylonTransformNodeId.mockReturnValue(mockSceneNode);

        // Run analysis
        await pipeline.analyzeScene({
            geometric: {
                minVolume: 0.0001,
            }
        });

        // Verify mapping logic was executed
        expect(mockTree.getNodeByBabylonTransformNodeId).toHaveBeenCalledWith('12345');

        // Verify logging
        // Look for the specific success log format
        const successLog = consoleSpy.mock.calls.find((args: any[]) =>
            typeof args[0] === 'string' && args[0].includes('SceneTreeMap: ✅')
        );

        expect(successLog).toBeDefined();
        expect(successLog![0]).toContain('strategy=transform-uid');
        expect(successLog![0]).toContain('sceneNodeId=scene-node-1');
    });

    it('should log a warning when mapping fails', async () => {
        const mockUnit: ToolUnit = {
            id: 'unit-2',
            name: 'Missing Unit',
            root: 'root-2',
            babylonUniqueId: 99999,
            type: 'fixture',
            isFixed: false,
            nodes: [],
        };

        const mockAnalyze = vi.fn().mockReturnValue({
            units: [mockUnit],
            anchors: {},
        });
        (pipeline as any).geometricAnalyzer = { analyze: mockAnalyze };

        // Ensure no node is found
        mockTree.getNodeByBabylonTransformNodeId.mockReturnValue(null);
        mockTree.getNodeByBabylonMeshId.mockReturnValue(null);
        mockTree.getNode.mockReturnValue(null);
        mockTree.getAllNodes.mockReturnValue([]);

        const consoleErrorSpy = vi.spyOn(console, 'error');

        await pipeline.analyzeScene({
            geometric: {} as any
        });

        // Verify failure log
        const failLog = consoleErrorSpy.mock.calls.find((args: any[]) =>
            typeof args[0] === 'string' && args[0].includes('SceneTreeMap: ❌')
        );

        expect(failLog).toBeDefined();
        expect(failLog![0]).toContain('strategy=not-found');
    });
});
