import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findSceneTreeNodeForToolUnit, SceneTreeMappingResult } from '../../src/scene/SceneTreeMapping';
import { SceneTreeManager } from '../../src/scene/SceneTreeManager';
import { SceneNode } from '../../src/scene/SceneTreeNode';
import { ToolUnit } from '../../src/babylon/sceneAnalysis/ToolGraphAnalyzer';

// Mock SceneTreeManager
vi.mock('../../src/scene/SceneTreeManager', () => {
    const mockGetNodeByBabylonTransformNodeId = vi.fn();
    const mockGetNodeByBabylonMeshId = vi.fn();
    const mockGetNode = vi.fn();
    const mockGetAllNodes = vi.fn();

    const mockInstance = {
        getNodeByBabylonTransformNodeId: mockGetNodeByBabylonTransformNodeId,
        getNodeByBabylonMeshId: mockGetNodeByBabylonMeshId,
        getNode: mockGetNode,
        getAllNodes: mockGetAllNodes,
    };

    return {
        SceneTreeManager: {
            getInstance: () => mockInstance,
        },
    };
});

describe('SceneTreeMapping', () => {
    let tree: any;

    const createMockUnit = (overrides: Partial<ToolUnit> = {}): ToolUnit => ({
        id: 'unit-1',
        name: 'Unit 1',
        root: 'root-node-id',
        babylonUniqueId: 123,
        type: 'unknown',
        isFixed: false,
        nodes: [],
        ...overrides,
    });

    const createMockNode = (overrides: Partial<SceneNode> = {}): SceneNode => ({
        id: 'scene-node-1',
        name: 'Scene Node 1',
        type: 'collection',
        parentId: null,
        childIds: [],
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        expanded: true,
        visible: true,
        locked: false,
        ...overrides,
    });

    beforeEach(() => {
        tree = SceneTreeManager.getInstance();
        vi.clearAllMocks();
    });

    it('should map by Transform Node UID (Strategy 1)', () => {
        const unit = createMockUnit({ babylonUniqueId: 100 });
        const node = createMockNode({ id: 'node-100' });

        tree.getNodeByBabylonTransformNodeId.mockReturnValue(node);

        const result = findSceneTreeNodeForToolUnit(tree, unit);

        expect(tree.getNodeByBabylonTransformNodeId).toHaveBeenCalledWith('100');
        expect(result.node).toBe(node);
        expect(result.strategy).toBe('transform-uid');
    });

    it('should map by Mesh UID (Strategy 2)', () => {
        const unit = createMockUnit({ babylonUniqueId: 200 });
        const node = createMockNode({ id: 'node-200' });

        tree.getNodeByBabylonTransformNodeId.mockReturnValue(null);
        tree.getNodeByBabylonMeshId.mockReturnValue(node);

        const result = findSceneTreeNodeForToolUnit(tree, unit);

        expect(tree.getNodeByBabylonTransformNodeId).toHaveBeenCalledWith('200');
        expect(tree.getNodeByBabylonMeshId).toHaveBeenCalledWith('200');
        expect(result.node).toBe(node);
        expect(result.strategy).toBe('mesh-uid');
    });

    it('should map by Root Node ID (Strategy 3)', () => {
        const unit = createMockUnit({ babylonUniqueId: 300, root: 'root-300' });
        const node = createMockNode({ id: 'node-300' });

        tree.getNodeByBabylonTransformNodeId.mockReturnValue(null);
        tree.getNodeByBabylonMeshId.mockReturnValue(null);
        tree.getNode.mockReturnValue(node);

        const result = findSceneTreeNodeForToolUnit(tree, unit);

        expect(tree.getNode).toHaveBeenCalledWith('root-300');
        expect(result.node).toBe(node);
        expect(result.strategy).toBe('root-node');
    });

    it('should map by Name Match (Strategy 4)', () => {
        const unit = createMockUnit({ babylonUniqueId: 400, name: 'TargetUnit' });
        const node = createMockNode({ id: 'node-400', name: 'TargetUnit' });

        tree.getNodeByBabylonTransformNodeId.mockReturnValue(null);
        tree.getNodeByBabylonMeshId.mockReturnValue(null);
        tree.getNode.mockReturnValue(null);
        tree.getAllNodes.mockReturnValue([createMockNode({ name: 'Other' }), node]);

        const result = findSceneTreeNodeForToolUnit(tree, unit);

        expect(result.node).toBe(node);
        expect(result.strategy).toBe('name-match');
    });

    it('should return not-found if all strategies fail', () => {
        const unit = createMockUnit({ babylonUniqueId: 500, name: 'MissingUnit' });

        tree.getNodeByBabylonTransformNodeId.mockReturnValue(null);
        tree.getNodeByBabylonMeshId.mockReturnValue(null);
        tree.getNode.mockReturnValue(null);
        tree.getAllNodes.mockReturnValue([createMockNode({ name: 'Other' })]);

        const result = findSceneTreeNodeForToolUnit(tree, unit);

        expect(result.node).toBeNull();
        expect(result.strategy).toBe('not-found');
    });

    it('should handle missing babylonUniqueId gracefully', () => {
        const unit = createMockUnit({ babylonUniqueId: undefined, root: 'root-missing' });
        const node = createMockNode({ id: 'node-missing' });

        tree.getNode.mockReturnValue(node);

        const result = findSceneTreeNodeForToolUnit(tree, unit);

        expect(tree.getNodeByBabylonTransformNodeId).not.toHaveBeenCalled();
        expect(tree.getNodeByBabylonMeshId).not.toHaveBeenCalled();
        expect(tree.getNode).toHaveBeenCalledWith('root-missing');
        expect(result.node).toBe(node);
        expect(result.strategy).toBe('root-node');
    });
});
