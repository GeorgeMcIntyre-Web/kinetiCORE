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

    // Robust path: clone selected meshes under a temporary container and export that subtree
    const exportContainer = new BABYLON.TransformNode('__export_container__', scene);

    const addMeshClone = (mesh: BABYLON.AbstractMesh) => {
      if (!(mesh instanceof BABYLON.Mesh)) return;
      // Skip invisible or helper meshes if any
      if (!mesh.isEnabled() || mesh.name.includes('_dummy')) return;
      mesh.clone(`${mesh.name}__exp`, exportContainer);
    };

    for (const r of roots) {
      if (r instanceof BABYLON.Mesh) {
        addMeshClone(r);
      } else if (r instanceof BABYLON.TransformNode) {
        const childMeshes = r.getChildMeshes(false);
        childMeshes.forEach(addMeshClone);
      } else if ((r as any).getChildMeshes) {
        try { (r as any).getChildMeshes(false).forEach(addMeshClone); } catch {}
      }
    }

    const { GLTF2Export } = await import('@babylonjs/serializers/glTF/2.0/glTFSerializer');
    const glb = await GLTF2Export.GLBAsync(scene, 'selection', {
      shouldExportNode: (node: BABYLON.Node) => node === exportContainer || node.isDescendantOf(exportContainer),
    });
    const blob = glb.glTFFiles['selection.glb'] as Blob;
    
    // Cleanup clones
    try { exportContainer.dispose(false, true); } catch {}

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
