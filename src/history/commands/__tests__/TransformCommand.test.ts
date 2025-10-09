// TransformCommand.test.ts - Tests for transform undo/redo
// Critical for ensuring transform operations can be properly undone

// Using vitest globals (globals: true in config)
import { TransformCommand } from '../TransformCommand';

interface TransformData {
  x: number;
  y: number;
  z: number;
}

describe('TransformCommand', () => {
  let mockUpdateFunction: ReturnType<typeof vi.fn>;
  let nodeId: string;
  let oldPosition: TransformData;
  let newPosition: TransformData;

  beforeEach(() => {
    mockUpdateFunction = vi.fn();
    nodeId = 'test-node-123';
    oldPosition = { x: 0, y: 0, z: 0 };
    newPosition = { x: 1, y: 2, z: 3 };
  });

  describe('Position Transform', () => {
    it('should execute position transform', () => {
      const command = new TransformCommand(
        nodeId,
        'position',
        oldPosition,
        newPosition,
        mockUpdateFunction
      );

      command.execute();

      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, newPosition);
      expect(mockUpdateFunction).toHaveBeenCalledTimes(1);
    });

    it('should undo position transform', () => {
      const command = new TransformCommand(
        nodeId,
        'position',
        oldPosition,
        newPosition,
        mockUpdateFunction
      );

      command.execute();
      mockUpdateFunction.mockClear();

      command.undo();

      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, oldPosition);
      expect(mockUpdateFunction).toHaveBeenCalledTimes(1);
    });

    it('should have correct description', () => {
      const command = new TransformCommand(
        nodeId,
        'position',
        oldPosition,
        newPosition,
        mockUpdateFunction
      );

      expect(command.description).toBe('Position change');
    });
  });

  describe('Rotation Transform', () => {
    it('should execute rotation transform', () => {
      const oldRotation: TransformData = { x: 0, y: 0, z: 0 };
      const newRotation: TransformData = { x: Math.PI / 4, y: Math.PI / 2, z: 0 };

      const command = new TransformCommand(
        nodeId,
        'rotation',
        oldRotation,
        newRotation,
        mockUpdateFunction
      );

      command.execute();

      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, newRotation);
    });

    it('should undo rotation transform', () => {
      const oldRotation: TransformData = { x: 0, y: 0, z: 0 };
      const newRotation: TransformData = { x: Math.PI / 4, y: 0, z: 0 };

      const command = new TransformCommand(
        nodeId,
        'rotation',
        oldRotation,
        newRotation,
        mockUpdateFunction
      );

      command.execute();
      mockUpdateFunction.mockClear();

      command.undo();

      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, oldRotation);
    });

    it('should have correct description', () => {
      const command = new TransformCommand(
        nodeId,
        'rotation',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
        mockUpdateFunction
      );

      expect(command.description).toBe('Rotation change');
    });
  });

  describe('Scale Transform', () => {
    it('should execute scale transform', () => {
      const oldScale: TransformData = { x: 1, y: 1, z: 1 };
      const newScale: TransformData = { x: 2, y: 3, z: 0.5 };

      const command = new TransformCommand(
        nodeId,
        'scale',
        oldScale,
        newScale,
        mockUpdateFunction
      );

      command.execute();

      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, newScale);
    });

    it('should undo scale transform', () => {
      const oldScale: TransformData = { x: 1, y: 1, z: 1 };
      const newScale: TransformData = { x: 2, y: 2, z: 2 };

      const command = new TransformCommand(
        nodeId,
        'scale',
        oldScale,
        newScale,
        mockUpdateFunction
      );

      command.execute();
      mockUpdateFunction.mockClear();

      command.undo();

      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, oldScale);
    });

    it('should have correct description', () => {
      const command = new TransformCommand(
        nodeId,
        'scale',
        { x: 1, y: 1, z: 1 },
        { x: 2, y: 2, z: 2 },
        mockUpdateFunction
      );

      expect(command.description).toBe('Scale change');
    });
  });

  describe('Multiple Execute/Undo Cycles', () => {
    it('should handle multiple execute/undo cycles', () => {
      const command = new TransformCommand(
        nodeId,
        'position',
        oldPosition,
        newPosition,
        mockUpdateFunction
      );

      // Execute
      command.execute();
      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, newPosition);

      // Undo
      mockUpdateFunction.mockClear();
      command.undo();
      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, oldPosition);

      // Execute again
      mockUpdateFunction.mockClear();
      command.execute();
      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, newPosition);

      // Undo again
      mockUpdateFunction.mockClear();
      command.undo();
      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, oldPosition);
    });

    it('should maintain transform integrity after multiple cycles', () => {
      const rotation: TransformData = { x: Math.PI, y: Math.PI / 2, z: Math.PI / 4 };

      const command = new TransformCommand(
        nodeId,
        'rotation',
        { x: 0, y: 0, z: 0 },
        rotation,
        mockUpdateFunction
      );

      // Execute and undo 10 times
      for (let i = 0; i < 10; i++) {
        command.execute();
        command.undo();
      }

      // Final execute - should still call with correct rotation
      mockUpdateFunction.mockClear();
      command.execute();
      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, rotation);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero transform (no change)', () => {
      const samePosition: TransformData = { x: 0, y: 0, z: 0 };

      const command = new TransformCommand(
        nodeId,
        'position',
        samePosition,
        samePosition,
        mockUpdateFunction
      );

      command.execute();

      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, samePosition);
    });

    it('should handle negative values', () => {
      const negativePosition: TransformData = { x: -5, y: -10, z: -15 };

      const command = new TransformCommand(
        nodeId,
        'position',
        oldPosition,
        negativePosition,
        mockUpdateFunction
      );

      command.execute();

      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, negativePosition);
    });

    it('should handle very large values', () => {
      const largePosition: TransformData = { x: 1000000, y: 2000000, z: 3000000 };

      const command = new TransformCommand(
        nodeId,
        'position',
        oldPosition,
        largePosition,
        mockUpdateFunction
      );

      command.execute();

      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, largePosition);
    });

    it('should handle very small values', () => {
      const smallPosition: TransformData = { x: 0.0001, y: 0.0002, z: 0.0003 };

      const command = new TransformCommand(
        nodeId,
        'position',
        oldPosition,
        smallPosition,
        mockUpdateFunction
      );

      command.execute();

      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, smallPosition);
    });
  });

  describe('Different Node IDs', () => {
    it('should handle different node IDs independently', () => {
      const node1 = 'node-1';
      const node2 = 'node-2';
      const mockUpdate1 = vi.fn();
      const mockUpdate2 = vi.fn();

      const cmd1 = new TransformCommand(
        node1,
        'position',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        mockUpdate1
      );

      const cmd2 = new TransformCommand(
        node2,
        'position',
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        mockUpdate2
      );

      cmd1.execute();
      cmd2.execute();

      expect(mockUpdate1).toHaveBeenCalledWith(node1, { x: 1, y: 0, z: 0 });
      expect(mockUpdate2).toHaveBeenCalledWith(node2, { x: 0, y: 1, z: 0 });
    });
  });

  describe('Command Merging', () => {
    it('should detect mergeable commands with same node and type', () => {
      const cmd1 = new TransformCommand(
        nodeId,
        'position',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        mockUpdateFunction
      );

      const cmd2 = new TransformCommand(
        nodeId,
        'position',
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
        mockUpdateFunction
      );

      expect(cmd1.canMergeWith(cmd2)).toBe(true);
    });

    it('should not merge commands with different node IDs', () => {
      const cmd1 = new TransformCommand(
        'node-1',
        'position',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        mockUpdateFunction
      );

      const cmd2 = new TransformCommand(
        'node-2',
        'position',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        mockUpdateFunction
      );

      expect(cmd1.canMergeWith(cmd2)).toBe(false);
    });

    it('should not merge commands with different transform types', () => {
      const cmd1 = new TransformCommand(
        nodeId,
        'position',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        mockUpdateFunction
      );

      const cmd2 = new TransformCommand(
        nodeId,
        'rotation',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        mockUpdateFunction
      );

      expect(cmd1.canMergeWith(cmd2)).toBe(false);
    });

    it('should merge commands correctly', () => {
      const cmd1 = new TransformCommand(
        nodeId,
        'position',
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        mockUpdateFunction
      );

      const cmd2 = new TransformCommand(
        nodeId,
        'position',
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 3, z: 4 },
        mockUpdateFunction
      );

      cmd1.mergeWith(cmd2);

      // After merge, cmd1 should have original old value but cmd2's new value
      cmd1.execute();
      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, { x: 2, y: 3, z: 4 });

      mockUpdateFunction.mockClear();
      cmd1.undo();
      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, { x: 0, y: 0, z: 0 });

      // Description should indicate merge
      expect(cmd1.description).toContain('merged');
    });
  });

  describe('Update Function Calls', () => {
    it('should call update function exactly once per execute', () => {
      const command = new TransformCommand(
        nodeId,
        'position',
        oldPosition,
        newPosition,
        mockUpdateFunction
      );

      command.execute();

      expect(mockUpdateFunction).toHaveBeenCalledTimes(1);
    });

    it('should call update function exactly once per undo', () => {
      const command = new TransformCommand(
        nodeId,
        'position',
        oldPosition,
        newPosition,
        mockUpdateFunction
      );

      command.execute();
      mockUpdateFunction.mockClear();

      command.undo();

      expect(mockUpdateFunction).toHaveBeenCalledTimes(1);
    });

    it('should pass correct parameters to update function', () => {
      const specificPosition: TransformData = { x: 1.23, y: 4.56, z: 7.89 };

      const command = new TransformCommand(
        nodeId,
        'position',
        oldPosition,
        specificPosition,
        mockUpdateFunction
      );

      command.execute();

      expect(mockUpdateFunction).toHaveBeenCalledWith(nodeId, specificPosition);
      expect(mockUpdateFunction.mock.calls[0][0]).toBe(nodeId);
      expect(mockUpdateFunction.mock.calls[0][1]).toEqual(specificPosition);
    });
  });

  describe('Precision', () => {
    it('should maintain floating point precision', () => {
      const precisePosition: TransformData = {
        x: 1.23456789,
        y: 2.34567891,
        z: 3.45678912
      };

      const command = new TransformCommand(
        nodeId,
        'position',
        oldPosition,
        precisePosition,
        mockUpdateFunction
      );

      command.execute();

      const calledWith = mockUpdateFunction.mock.calls[0][1];
      expect(calledWith.x).toBe(1.23456789);
      expect(calledWith.y).toBe(2.34567891);
      expect(calledWith.z).toBe(3.45678912);
    });

    it('should maintain precision through undo/redo', () => {
      const preciseRotation: TransformData = {
        x: Math.PI / 3,
        y: Math.PI / 5,
        z: Math.PI / 7
      };

      const command = new TransformCommand(
        nodeId,
        'rotation',
        { x: 0, y: 0, z: 0 },
        preciseRotation,
        mockUpdateFunction
      );

      command.execute();
      command.undo();
      mockUpdateFunction.mockClear();
      command.execute();

      const calledWith = mockUpdateFunction.mock.calls[0][1];
      expect(calledWith.x).toBe(Math.PI / 3);
      expect(calledWith.y).toBe(Math.PI / 5);
      expect(calledWith.z).toBe(Math.PI / 7);
    });
  });

  describe('canExecute', () => {
    it('should return true by default', () => {
      const command = new TransformCommand(
        nodeId,
        'position',
        oldPosition,
        newPosition,
        mockUpdateFunction
      );

      expect(command.canExecute()).toBe(true);
    });
  });
});
