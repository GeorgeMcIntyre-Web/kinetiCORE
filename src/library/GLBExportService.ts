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
      if (mesh.name.includes('_dummy')) return;
      // Real mesh
      if (mesh instanceof BABYLON.Mesh) {
        const clone = mesh.clone(`${mesh.name}__exp`, exportContainer);
        if (clone) {
          clone.isVisible = true;
          clone.setEnabled(true);
        }
        return;
      }
      // Instanced mesh
      if (mesh instanceof BABYLON.InstancedMesh) {
        const src = mesh.sourceMesh;
        const inst = src.createInstance(`${mesh.name}__exp`);
        inst.parent = exportContainer;
        inst.position.copyFrom(mesh.position);
        inst.rotation.copyFrom(mesh.rotation);
        inst.scaling.copyFrom(mesh.scaling);
        inst.isVisible = true;
        inst.setEnabled(true);
        return;
      }
      // Fallback: try to cast as any Mesh and clone
      try {
        const anyMesh = mesh as any;
        if (typeof anyMesh.clone === 'function') {
          const c = anyMesh.clone(`${mesh.name}__exp`, exportContainer);
          if (c) { c.isVisible = true; c.setEnabled?.(true); }
        }
      } catch {}
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

  // Robust export: clones all meshes/instances from selection under a temp container
  static async exportSelectionRobust(
    scene: BABYLON.Scene,
    roots: (BABYLON.Node)[],
    fileName = 'selection.glb'
  ): Promise<void> {
    if (!roots.length) {
      await GLBExportService.exportScene(scene, fileName);
      return;
    }

    const exportContainer = new BABYLON.TransformNode('__export_container__', scene);
    const baseCloneMap = new Map<number, BABYLON.Mesh>();

    const setWorld = (src: BABYLON.TransformNode, dst: BABYLON.TransformNode) => {
      const s = new BABYLON.Vector3(); const r = new BABYLON.Quaternion(); const p = new BABYLON.Vector3();
      src.getWorldMatrix().decompose(s, r, p);
      dst.position.copyFrom(p); (dst as any).rotationQuaternion = r.clone(); dst.scaling.copyFrom(s);
    };

    const ensureBase = (mesh: BABYLON.Mesh): BABYLON.Mesh => {
      let base = baseCloneMap.get(mesh.uniqueId);
      if (base) return base;
      base = mesh.clone(`${mesh.name}__base`, exportContainer) as BABYLON.Mesh;
      base.isVisible = true; base.setEnabled(true); setWorld(mesh, base); baseCloneMap.set(mesh.uniqueId, base);
      const count = (mesh as any).thinInstanceCount as number | undefined;
      if (count && count > 0) {
        try {
          const matrices = (mesh as any).thinInstanceGetWorldMatrices?.() as Float32Array | undefined;
          if (matrices) {
            for (let i = 0; i < count; i++) {
              const m = BABYLON.Matrix.FromArray(Array.from(matrices.slice(i * 16, i * 16 + 16)));
              const s = new BABYLON.Vector3(); const r = new BABYLON.Quaternion(); const p = new BABYLON.Vector3();
              m.decompose(s, r, p);
              const inst = base.createInstance(`${mesh.name}__thin_${i}`);
              inst.parent = exportContainer; inst.isVisible = true; inst.setEnabled(true);
              inst.position.copyFrom(p); (inst as any).rotationQuaternion = r.clone(); inst.scaling.copyFrom(s);
            }
          }
        } catch {}
      }
      return base;
    };

    const add = (m: BABYLON.AbstractMesh) => {
      if (!m || m.name.includes('_dummy')) return;
      if (m instanceof BABYLON.InstancedMesh) {
        const base = ensureBase(m.sourceMesh as BABYLON.Mesh);
        const inst = base.createInstance(`${m.name}__inst`);
        inst.parent = exportContainer; inst.isVisible = true; inst.setEnabled(true); setWorld(m, inst); return;
      }
      if (m instanceof BABYLON.Mesh) { ensureBase(m); return; }
      try { const c = (m as any).clone?.(`${m.name}__exp`, exportContainer); if (c) { setWorld(m, c); c.isVisible = true; c.setEnabled?.(true); } } catch {}
    };

    for (const r of roots) {
      if ((r as any).getChildMeshes) { try { (r as any).getChildMeshes(false).forEach(add); } catch {} }
      else if (r instanceof BABYLON.Mesh) { add(r); }
    }

    // Fallback: if nothing was cloned (scene-tree mapping missing), clone all visible meshes
    if (exportContainer.getChildMeshes(false).length === 0) {
      try {
        scene.meshes.forEach((m) => {
          if (m && m.isEnabled() && m.isVisible) {
            add(m);
          }
        });
      } catch {}
    }

    const { GLTF2Export } = await import('@babylonjs/serializers/glTF/2.0/glTFSerializer');
    const glb = await GLTF2Export.GLBAsync(scene, 'selection', {
      shouldExportNode: (n: BABYLON.Node) => n === exportContainer || n.isDescendantOf(exportContainer),
    });
    const blob = glb.glTFFiles['selection.glb'] as Blob;
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

