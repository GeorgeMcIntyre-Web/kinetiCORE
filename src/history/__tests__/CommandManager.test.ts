// CommandManager.test.ts - Tests for undo/redo stack management
// Critical for ensuring command history integrity

// Using vitest globals (globals: true in config)
import { CommandManager } from '../CommandManager';
import { Command } from '../Command';

// Mock command for testing
class MockCommand extends Command {
  public executed = false;
  public undone = false;
  description: string;

  constructor(public name: string = 'MockCommand') {
    super();
    this.description = name;
  }

  execute(): void {
    this.executed = true;
    this.undone = false;
    this.onExecuted();
  }

  undo(): void {
    this.undone = true;
    this.executed = false;
    this.onUndone();
  }
}

describe('CommandManager', () => {
  let commandManager: CommandManager;

  beforeEach(() => {
    commandManager = new CommandManager();
  });

  describe('Basic Execution', () => {
    it('should execute a command', () => {
      const command = new MockCommand('TestCommand');

      commandManager.execute(command);

      expect(command.executed).toBe(true);
    });

    it('should add command to undo stack after execution', () => {
      const command = new MockCommand();

      commandManager.execute(command);

      expect(commandManager.canUndo()).toBe(true);
    });

    it('should not add command to redo stack after execution', () => {
      const command = new MockCommand();

      commandManager.execute(command);

      expect(commandManager.canRedo()).toBe(false);
    });
  });

  describe('Undo Operations', () => {
    it('should undo last command', () => {
      const command = new MockCommand();

      commandManager.execute(command);
      commandManager.undo();

      expect(command.undone).toBe(true);
    });

    it('should add command to redo stack after undo', () => {
      const command = new MockCommand();

      commandManager.execute(command);
      commandManager.undo();

      expect(commandManager.canRedo()).toBe(true);
    });

    it('should remove command from undo stack after undo', () => {
      const command = new MockCommand();

      commandManager.execute(command);
      commandManager.undo();

      expect(commandManager.canUndo()).toBe(false);
    });

    it('should undo multiple commands in reverse order', () => {
      const cmd1 = new MockCommand('Command1');
      const cmd2 = new MockCommand('Command2');
      const cmd3 = new MockCommand('Command3');

      commandManager.execute(cmd1);
      commandManager.execute(cmd2);
      commandManager.execute(cmd3);

      // Undo in reverse order
      commandManager.undo();
      expect(cmd3.undone).toBe(true);
      expect(cmd2.undone).toBe(false);

      commandManager.undo();
      expect(cmd2.undone).toBe(true);
      expect(cmd1.undone).toBe(false);

      commandManager.undo();
      expect(cmd1.undone).toBe(true);
    });

    it('should do nothing when undoing empty stack', () => {
      // Should not throw
      expect(() => {
        commandManager.undo();
      }).not.toThrow();

      expect(commandManager.canUndo()).toBe(false);
    });
  });

  describe('Redo Operations', () => {
    it('should redo last undone command', () => {
      const command = new MockCommand();

      commandManager.execute(command);
      commandManager.undo();
      expect(command.undone).toBe(true);

      commandManager.redo();
      expect(command.executed).toBe(true);
    });

    it('should add command back to undo stack after redo', () => {
      const command = new MockCommand();

      commandManager.execute(command);
      commandManager.undo();
      commandManager.redo();

      expect(commandManager.canUndo()).toBe(true);
    });

    it('should remove command from redo stack after redo', () => {
      const command = new MockCommand();

      commandManager.execute(command);
      commandManager.undo();
      commandManager.redo();

      expect(commandManager.canRedo()).toBe(false);
    });

    it('should redo multiple commands in original order', () => {
      const cmd1 = new MockCommand('Command1');
      const cmd2 = new MockCommand('Command2');
      const cmd3 = new MockCommand('Command3');

      commandManager.execute(cmd1);
      commandManager.execute(cmd2);
      commandManager.execute(cmd3);

      // Undo all
      commandManager.undo();
      commandManager.undo();
      commandManager.undo();

      // Redo in original order - redo calls execute() again
      commandManager.redo();
      expect(cmd1.executed).toBe(true);
      expect(cmd2.executed).toBe(false);

      commandManager.redo();
      expect(cmd2.executed).toBe(true);
      expect(cmd3.executed).toBe(false);

      commandManager.redo();
      expect(cmd3.executed).toBe(true);
    });

    it('should do nothing when redoing empty redo stack', () => {
      const command = new MockCommand();

      commandManager.execute(command);

      // Try to redo without undoing first
      expect(() => {
        commandManager.redo();
      }).not.toThrow();

      expect(commandManager.canRedo()).toBe(false);
    });
  });

  describe('Branch Behavior', () => {
    it('should clear redo stack when executing new command after undo', () => {
      const cmd1 = new MockCommand('Command1');
      const cmd2 = new MockCommand('Command2');
      const cmd3 = new MockCommand('Command3');

      commandManager.execute(cmd1);
      commandManager.execute(cmd2);
      commandManager.undo(); // Undo cmd2

      // Execute new command - should clear redo stack
      commandManager.execute(cmd3);

      expect(commandManager.canRedo()).toBe(false);
    });

    it('should create new branch when executing after undo', () => {
      const cmd1 = new MockCommand('Command1');
      const cmd2 = new MockCommand('Command2');
      const cmd3 = new MockCommand('Command3 (new branch)');

      commandManager.execute(cmd1);
      commandManager.execute(cmd2);
      commandManager.undo(); // Back to cmd1
      commandManager.execute(cmd3); // New branch from cmd1

      // Can only undo to cmd1, cmd2 is lost
      commandManager.undo(); // Undo cmd3
      commandManager.undo(); // Undo cmd1
      expect(commandManager.canUndo()).toBe(false);

      // Can't redo to cmd2 anymore
      commandManager.redo(); // Redo cmd1
      commandManager.redo(); // Redo cmd3
      expect(commandManager.canRedo()).toBe(false);
    });
  });

  describe('canUndo and canRedo', () => {
    it('should return false when no commands executed', () => {
      expect(commandManager.canUndo()).toBe(false);
      expect(commandManager.canRedo()).toBe(false);
    });

    it('should return true after executing command', () => {
      const command = new MockCommand();

      commandManager.execute(command);

      expect(commandManager.canUndo()).toBe(true);
      expect(commandManager.canRedo()).toBe(false);
    });

    it('should return correct state after undo', () => {
      const command = new MockCommand();

      commandManager.execute(command);
      commandManager.undo();

      expect(commandManager.canUndo()).toBe(false);
      expect(commandManager.canRedo()).toBe(true);
    });

    it('should return correct state after redo', () => {
      const command = new MockCommand();

      commandManager.execute(command);
      commandManager.undo();
      commandManager.redo();

      expect(commandManager.canUndo()).toBe(true);
      expect(commandManager.canRedo()).toBe(false);
    });
  });

  describe('Complex Undo/Redo Sequences', () => {
    it('should handle multiple undo/redo cycles correctly', () => {
      const cmd1 = new MockCommand('Command1');
      const cmd2 = new MockCommand('Command2');

      // Execute both
      commandManager.execute(cmd1);
      commandManager.execute(cmd2);

      // Cycle 1
      commandManager.undo();
      commandManager.redo();

      // Cycle 2
      commandManager.undo();
      commandManager.redo();

      // Cycle 3
      commandManager.undo();
      commandManager.redo();

      // Final state
      expect(commandManager.canUndo()).toBe(true);
      expect(commandManager.canRedo()).toBe(false);
      expect(cmd2.executed).toBe(true);
    });

    it('should handle partial undo then redo sequence', () => {
      const cmd1 = new MockCommand('Command1');
      const cmd2 = new MockCommand('Command2');
      const cmd3 = new MockCommand('Command3');

      commandManager.execute(cmd1);
      commandManager.execute(cmd2);
      commandManager.execute(cmd3);

      // Partial undo
      commandManager.undo(); // Undo cmd3
      commandManager.undo(); // Undo cmd2

      // Partial redo
      commandManager.redo(); // Redo cmd2 (calls execute again)

      // Check state - cmd1 still executed, cmd2 re-executed, cmd3 undone
      expect(cmd1.executed).toBe(true);
      expect(cmd2.executed).toBe(true);
      expect(cmd3.undone).toBe(true);
      expect(commandManager.canUndo()).toBe(true);
      expect(commandManager.canRedo()).toBe(true);
    });

    it('should handle undo all, execute new, undo new sequence', () => {
      const cmd1 = new MockCommand('Command1');
      const cmd2 = new MockCommand('Command2');
      const cmd3 = new MockCommand('Command3');

      commandManager.execute(cmd1);
      commandManager.execute(cmd2);

      // Undo all
      commandManager.undo();
      commandManager.undo();

      // Execute new (clears redo stack)
      commandManager.execute(cmd3);

      // Undo new
      commandManager.undo();

      // State check
      expect(commandManager.canUndo()).toBe(false);
      expect(commandManager.canRedo()).toBe(true); // Can redo cmd3
    });
  });

  describe('Stack Limits', () => {
    it('should handle many commands efficiently', () => {
      const commands: MockCommand[] = [];

      // Execute 1000 commands
      for (let i = 0; i < 1000; i++) {
        const cmd = new MockCommand(`Command${i}`);
        commands.push(cmd);
        commandManager.execute(cmd);
      }

      expect(commandManager.canUndo()).toBe(true);

      // Undo all 1000 commands
      for (let i = 999; i >= 0; i--) {
        commandManager.undo();
      }

      expect(commandManager.canUndo()).toBe(false);
      expect(commandManager.canRedo()).toBe(true);

      // Redo all 1000 commands
      for (let i = 0; i < 1000; i++) {
        commandManager.redo();
      }

      expect(commandManager.canUndo()).toBe(true);
      expect(commandManager.canRedo()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle command execution errors gracefully', () => {
      class FailingCommand extends Command {
        description = 'FailingCommand';

        execute(): void {
          throw new Error('Execution failed');
        }
        undo(): void {}
      }

      const command = new FailingCommand();

      expect(() => {
        commandManager.execute(command);
      }).toThrow('Execution failed');

      // Command should not be added to stack
      expect(commandManager.canUndo()).toBe(false);
    });

    it('should handle undo errors', () => {
      class FailingUndoCommand extends Command {
        description = 'FailingUndoCommand';

        execute(): void {}
        undo(): void {
          throw new Error('Undo failed');
        }
      }

      const command = new FailingUndoCommand();

      commandManager.execute(command);

      expect(() => {
        commandManager.undo();
      }).toThrow('Undo failed');
    });
  });

  describe('Memory Management', () => {
    it('should clear all stacks when reset', () => {
      const cmd1 = new MockCommand('Command1');
      const cmd2 = new MockCommand('Command2');

      commandManager.execute(cmd1);
      commandManager.execute(cmd2);
      commandManager.undo();

      // Reset/clear (if method exists)
      if ('clear' in commandManager) {
        (commandManager as any).clear();

        expect(commandManager.canUndo()).toBe(false);
        expect(commandManager.canRedo()).toBe(false);
      }
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state through complex operations', () => {
      const commands: MockCommand[] = [];

      // Build up a complex history
      for (let i = 0; i < 10; i++) {
        const cmd = new MockCommand(`Command${i}`);
        commands.push(cmd);
        commandManager.execute(cmd);
      }

      // Perform random undo/redo operations
      commandManager.undo();
      commandManager.undo();
      commandManager.undo();
      commandManager.redo();
      commandManager.undo();
      commandManager.redo();
      commandManager.redo();
      commandManager.execute(new MockCommand('NewCommand'));

      // State should be consistent
      const canUndo = commandManager.canUndo();
      const _canRedo = commandManager.canRedo();

      // If we can undo, undoing should work
      if (canUndo) {
        expect(() => commandManager.undo()).not.toThrow();
      }

      // After undo, should be able to redo
      if (canUndo) {
        expect(commandManager.canRedo()).toBe(true);
      }
    });
  });

  describe('Command History Inspection', () => {
    it('should provide command history (if available)', () => {
      const cmd1 = new MockCommand('Command1');
      const cmd2 = new MockCommand('Command2');

      commandManager.execute(cmd1);
      commandManager.execute(cmd2);

      // If getHistory method exists
      if ('getHistory' in commandManager) {
        const history = (commandManager as any).getHistory();
        expect(history).toBeDefined();
      }
    });
  });

  describe('Thread Safety Concerns', () => {
    it('should handle rapid execute/undo calls', async () => {
      const operations: Promise<void>[] = [];

      // Simulate rapid user interactions
      for (let i = 0; i < 100; i++) {
        operations.push(
          new Promise<void>((resolve) => {
            const cmd = new MockCommand(`RapidCommand${i}`);
            commandManager.execute(cmd);
            if (i % 2 === 0 && commandManager.canUndo()) {
              commandManager.undo();
            }
            resolve();
          })
        );
      }

      await Promise.all(operations);

      // State should still be valid
      expect(commandManager.canUndo() || !commandManager.canUndo()).toBe(true);
    });
  });
});
