// Transform Command - Undo/Redo for object transformations
// Owner: George (Architecture)

import { Command } from '../Command';

type TransformType = 'position' | 'rotation' | 'scale';

interface TransformData {
  x: number;
  y: number;
  z: number;
}

export class TransformCommand extends Command {
  description: string;

  constructor(
    private readonly nodeId: string,
    private readonly transformType: TransformType,
    private readonly oldValue: TransformData,
    private readonly newValue: TransformData,
    private readonly updateFunction: (nodeId: string, value: TransformData) => void
  ) {
    super();
    this.description = `${transformType.charAt(0).toUpperCase() + transformType.slice(1)} change`;
  }

  execute(): void {
    this.updateFunction(this.nodeId, this.newValue);
    this.onExecuted();
  }

  undo(): void {
    this.updateFunction(this.nodeId, this.oldValue);
    this.onUndone();
  }

  // Optimize by merging consecutive transforms of the same type on the same object
  canMergeWith(other: Command): boolean {
    if (!(other instanceof TransformCommand)) return false;
    return (
      this.nodeId === other.nodeId &&
      this.transformType === other.transformType
    );
  }

  mergeWith(other: TransformCommand): void {
    // Keep the original old value, update to the new value
    this.newValue.x = other.newValue.x;
    this.newValue.y = other.newValue.y;
    this.newValue.z = other.newValue.z;
    this.description = `${this.transformType.charAt(0).toUpperCase() + this.transformType.slice(1)} change (merged)`;
  }
}
