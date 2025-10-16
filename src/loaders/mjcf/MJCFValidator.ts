/**
 * MJCF Validator
 * Post-load validation to detect common issues and suggest fixes
 */

import { Vector3, Quaternion, TransformNode } from '@babylonjs/core';

export type IssueSeverity = 'error' | 'warning' | 'info';
export type IssueCategory = 'coordinate' | 'keyframe' | 'scale' | 'hierarchy' | 'orientation' | 'mesh';

export interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  message: string;
  details?: string;
  suggestedFix: string;
  autoFixAvailable: boolean;
  autoFixFunction?: () => void;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  summary: string;
}

export class MJCFValidator {
  private issues: ValidationIssue[] = [];
  private issueIdCounter = 0;

  /**
   * Validate a loaded MJCF model
   */
  validate(rootNode: TransformNode, metadata?: {
    modelType?: 'OBJ' | 'STL' | 'GLB' | 'MIXED';
    keyframesApplied?: boolean;
    jointCount?: number;
  }): ValidationResult {
    this.issues = [];

    // Run validation checks
    this.checkOrientation(rootNode);
    this.checkScale(rootNode);
    this.checkHierarchy(rootNode);
    this.checkKeyframeApplication(rootNode, metadata);
    this.checkCoordinateSystem(rootNode);
    this.checkMeshes(rootNode);

    // Categorize issues
    const errors = this.issues.filter(i => i.severity === 'error');
    const warnings = this.issues.filter(i => i.severity === 'warning');

    // Generate summary
    const summary = this.generateSummary();

    return {
      valid: errors.length === 0,
      issues: this.issues,
      warnings,
      errors,
      summary
    };
  }

  /**
   * Check if robot is oriented correctly
   */
  private checkOrientation(rootNode: TransformNode): void {
    const meshes = rootNode.getChildMeshes();
    if (meshes.length === 0) return;

    // Calculate overall bounding box
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const mesh of meshes) {
      const bounds = mesh.getBoundingInfo();
      const worldMin = bounds.boundingBox.minimumWorld;
      const worldMax = bounds.boundingBox.maximumWorld;

      minY = Math.min(minY, worldMin.y);
      maxY = Math.max(maxY, worldMax.y);
      minZ = Math.min(minZ, worldMin.z);
      maxZ = Math.max(maxZ, worldMax.z);
    }

    const height = maxY - minY;
    const depth = maxZ - minZ;

    // Check if robot appears sideways (depth > 2 * height)
    if (depth > 2 * height) {
      this.addIssue({
        severity: 'warning',
        category: 'orientation',
        message: 'Robot appears to be lying sideways',
        details: `Height: ${height.toFixed(3)}m, Depth: ${depth.toFixed(3)}m`,
        suggestedFix: 'Apply upright rotation (90° around X-axis)',
        autoFixAvailable: true,
        autoFixFunction: () => {
          const rotation = Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2);
          if (rootNode.rotationQuaternion) {
            rootNode.rotationQuaternion = rotation.multiply(rootNode.rotationQuaternion);
          } else {
            rootNode.rotationQuaternion = rotation;
          }
        }
      });
    }

    // Check if robot is below ground (minY < -0.1)
    if (minY < -0.1) {
      this.addIssue({
        severity: 'warning',
        category: 'coordinate',
        message: 'Robot appears below ground level',
        details: `Minimum Y position: ${minY.toFixed(3)}m`,
        suggestedFix: 'Adjust root position to place on ground',
        autoFixAvailable: true,
        autoFixFunction: () => {
          rootNode.position.y -= minY;
        }
      });
    }
  }

  /**
   * Check for scale issues
   */
  private checkScale(rootNode: TransformNode): void {
    const nodes = this.getAllNodes(rootNode);
    const scaledNodes: string[] = [];

    for (const node of nodes) {
      const s = node.scaling;
      if (Math.abs(s.x - 1) > 0.01 || Math.abs(s.y - 1) > 0.01 || Math.abs(s.z - 1) > 0.01) {
        scaledNodes.push(`${node.name} (${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)})`);
      }
    }

    if (scaledNodes.length > 0) {
      this.addIssue({
        severity: 'warning',
        category: 'scale',
        message: 'Scale accumulation detected in kinematic chain',
        details: `${scaledNodes.length} nodes have non-uniform scale:\n${scaledNodes.slice(0, 5).join('\n')}${scaledNodes.length > 5 ? '\n...' : ''}`,
        suggestedFix: 'Normalize all scales to (1, 1, 1)',
        autoFixAvailable: true,
        autoFixFunction: () => {
          for (const node of nodes) {
            node.scaling.set(1, 1, 1);
          }
        }
      });
    }
  }

  /**
   * Check hierarchy integrity
   */
  private checkHierarchy(rootNode: TransformNode): void {
    const nodes = this.getAllNodes(rootNode);
    const orphanedNodes: string[] = [];

    for (const node of nodes) {
      if (!node.parent && node !== rootNode) {
        orphanedNodes.push(node.name);
      }
    }

    if (orphanedNodes.length > 0) {
      this.addIssue({
        severity: 'error',
        category: 'hierarchy',
        message: 'Orphaned nodes detected (missing parent links)',
        details: `${orphanedNodes.length} nodes without parents: ${orphanedNodes.slice(0, 5).join(', ')}`,
        suggestedFix: 'Re-import model with proper hierarchy',
        autoFixAvailable: false
      });
    }

    // Check for circular references
    for (const node of nodes) {
      if (this.hasCircularReference(node)) {
        this.addIssue({
          severity: 'error',
          category: 'hierarchy',
          message: `Circular parent reference detected in node: ${node.name}`,
          suggestedFix: 'Fix parent-child relationships',
          autoFixAvailable: false
        });
      }
    }
  }

  /**
   * Check keyframe application
   */
  private checkKeyframeApplication(rootNode: TransformNode, metadata?: any): void {
    if (!metadata?.keyframesApplied) {
      this.addIssue({
        severity: 'info',
        category: 'keyframe',
        message: 'No keyframe has been applied',
        suggestedFix: 'Apply a keyframe to set initial pose',
        autoFixAvailable: false
      });
      return;
    }

    // Check if keyframes were applied multiple times (metadata flag)
    if (rootNode.metadata?.keyframeApplicationCount && rootNode.metadata.keyframeApplicationCount > 1) {
      this.addIssue({
        severity: 'error',
        category: 'keyframe',
        message: 'Keyframe applied multiple times',
        details: `Application count: ${rootNode.metadata.keyframeApplicationCount}`,
        suggestedFix: 'Reset model and apply keyframe once',
        autoFixAvailable: true,
        autoFixFunction: () => {
          // Reset keyframe application count
          if (rootNode.metadata) {
            rootNode.metadata.keyframeApplicationCount = 0;
            rootNode.metadata.keyframesApplied = false;
          }
        }
      });
    }
  }

  /**
   * Check coordinate system consistency
   */
  private checkCoordinateSystem(rootNode: TransformNode): void {
    const nodes = this.getAllNodes(rootNode);
    let suspiciousPositions = 0;

    for (const node of nodes) {
      const pos = node.position;

      // Check for suspiciously large coordinates (might indicate wrong units)
      if (Math.abs(pos.x) > 100 || Math.abs(pos.y) > 100 || Math.abs(pos.z) > 100) {
        suspiciousPositions++;
      }
    }

    if (suspiciousPositions > nodes.length * 0.3) {
      this.addIssue({
        severity: 'warning',
        category: 'coordinate',
        message: 'Coordinate values appear unusually large',
        details: `${suspiciousPositions}/${nodes.length} nodes have coordinates > 100`,
        suggestedFix: 'Check if units are correct (should be meters, not millimeters)',
        autoFixAvailable: false
      });
    }
  }

  /**
   * Check mesh validity
   */
  private checkMeshes(rootNode: TransformNode): void {
    const meshes = rootNode.getChildMeshes();
    const invalidMeshes: string[] = [];

    for (const mesh of meshes) {
      const vertexCount = mesh.getTotalVertices();
      const bounds = mesh.getBoundingInfo();

      if (vertexCount === 0) {
        invalidMeshes.push(`${mesh.name} (0 vertices)`);
      } else if (!bounds || !Number.isFinite(bounds.boundingBox.extendSize.length())) {
        invalidMeshes.push(`${mesh.name} (invalid bounds)`);
      }
    }

    if (invalidMeshes.length > 0) {
      this.addIssue({
        severity: 'error',
        category: 'mesh',
        message: 'Invalid meshes detected',
        details: `${invalidMeshes.length} problematic meshes:\n${invalidMeshes.slice(0, 5).join('\n')}`,
        suggestedFix: 'Re-export mesh files from original source',
        autoFixAvailable: false
      });
    }
  }

  /**
   * Add an issue to the list
   */
  private addIssue(issue: Omit<ValidationIssue, 'id'>): void {
    this.issues.push({
      id: `issue_${this.issueIdCounter++}`,
      ...issue
    });
  }

  /**
   * Get all nodes in hierarchy
   */
  private getAllNodes(rootNode: TransformNode): TransformNode[] {
    const nodes: TransformNode[] = [];

    const traverse = (node: TransformNode) => {
      nodes.push(node);
      for (const child of node.getChildren()) {
        if (child instanceof TransformNode) {
          traverse(child);
        }
      }
    };

    traverse(rootNode);
    return nodes;
  }

  /**
   * Check for circular parent references
   */
  private hasCircularReference(node: TransformNode): boolean {
    const visited = new Set<TransformNode>();
    let current: TransformNode | null = node;

    while (current) {
      if (visited.has(current)) {
        return true;
      }
      visited.add(current);
      current = current.parent as TransformNode | null;
    }

    return false;
  }

  /**
   * Generate summary text
   */
  private generateSummary(): string {
    const errors = this.issues.filter(i => i.severity === 'error').length;
    const warnings = this.issues.filter(i => i.severity === 'warning').length;
    const info = this.issues.filter(i => i.severity === 'info').length;

    if (errors === 0 && warnings === 0) {
      return '✅ Validation passed - no issues detected';
    }

    const parts: string[] = [];
    if (errors > 0) parts.push(`${errors} error${errors > 1 ? 's' : ''}`);
    if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? 's' : ''}`);
    if (info > 0) parts.push(`${info} info message${info > 1 ? 's' : ''}`);

    return `⚠️ Validation found ${parts.join(', ')}`;
  }

  /**
   * Apply all auto-fixes
   */
  applyAllAutoFixes(): number {
    let appliedCount = 0;

    for (const issue of this.issues) {
      if (issue.autoFixAvailable && issue.autoFixFunction) {
        try {
          issue.autoFixFunction();
          appliedCount++;
          console.log(`[Validator] Applied auto-fix for: ${issue.message}`);
        } catch (error) {
          console.error(`[Validator] Failed to apply auto-fix for ${issue.message}:`, error);
        }
      }
    }

    return appliedCount;
  }
}
