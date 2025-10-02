// Command Manager - Undo/Redo stack management
// Owner: Edwin

import { Command } from './Command';
import { MAX_UNDO_STACK_SIZE } from '../core/constants';

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly maxStackSize = MAX_UNDO_STACK_SIZE;

  /**
   * Execute a command and add it to undo stack
   */
  execute(command: Command): boolean {
    if (!command.canExecute()) {
      console.warn('Command cannot execute:', command.description);
      return false;
    }

    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack

    // Enforce max stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }

    return true;
  }

  /**
   * Undo the last command
   */
  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    command.undo();
    this.redoStack.push(command);
    return true;
  }

  /**
   * Redo the last undone command
   */
  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    command.execute();
    this.undoStack.push(command);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoStack(): Command[] {
    return [...this.undoStack];
  }

  getRedoStack(): Command[] {
    return [...this.redoStack];
  }
}
