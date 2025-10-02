// Command pattern base class for undo/redo
// Owner: Edwin

import { ICommand } from '../core/types';

/**
 * Abstract base class for all commands
 * Implement execute() and undo() in derived classes
 */
export abstract class Command implements ICommand {
  abstract execute(): void;
  abstract undo(): void;
  abstract description: string;

  canExecute(): boolean {
    return true;
  }

  protected onExecuted(): void {
    // Override in derived classes if needed
  }

  protected onUndone(): void {
    // Override in derived classes if needed
  }
}
