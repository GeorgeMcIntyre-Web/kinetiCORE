/**
 * GLB Export Service
 * Helper utilities to export the current scene or a selection to a GLB file.
 */

import * as BABYLON from '@babylonjs/core';

export class GLBExportService {
  static async exportScene(scene: BABYLON.Scene, fileName = 'scene.glb'): Promise<void> {
    const { GLTF2Export } = await import('@babylonjs/serializers/glTF/2.0/glTFSerializer');
    const glb = await GLTF2Export.GLBAsync(scene, 'scene');
    const blob = glb.glTFFiles['scene.glb'] as Blob;
    GLBExportService.downloadBlob(blob, fileName);
  }

  static async exportSelection(
    scene: BABYLON.Scene,
    roots: (BABYLON.Node)[],
    fileName = 'selection.glb'
  ): Promise<void> {
    if (!roots.length) {
      await GLBExportService.exportScene(scene, fileName);
      return;
    }

    const { GLTF2Export } = await import('@babylonjs/serializers/glTF/2.0/glTFSerializer');
    const rootSet = new Set(roots);

    // Important: allow traversal through ancestors of the selected roots.
    // Some exporters prune recursion when a parent is filtered out. By
    // returning true for ancestors (r.isDescendantOf(node)), we ensure the
    // walk reaches the selected subtrees, and we include all descendants.
    const glb = await GLTF2Export.GLBAsync(scene, 'selection', {
      shouldExportNode: (node: BABYLON.Node) => {
        if (rootSet.size === 0) return true;
        for (const r of rootSet) {
          if (node === r || node.isDescendantOf(r) || r.isDescendantOf(node)) return true;
        }
        return false;
      },
    });
    const blob = glb.glTFFiles['selection.glb'] as Blob;
    GLBExportService.downloadBlob(blob, fileName);
  }

  private static downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
