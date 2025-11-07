/**
 * GLB Export Service
 * Helper utilities to export the current scene or a selection to a GLB file.
 */

import * as BABYLON from '@babylonjs/core';

// Helper: clone material (including MultiMaterial) onto destination mesh without
// mutating the source mesh's material reference. If clone fails, keep original.
function cloneMaterialOnto(dst: BABYLON.Mesh, src: BABYLON.Mesh) {
  try {
    const currentMaterial = src.material as BABYLON.Material | null;
    const meshWithOriginal = src as BABYLON.Mesh & { __kcOriginalMaterial?: BABYLON.Material | null };
    const hasStoredOriginal = Object.prototype.hasOwnProperty.call(meshWithOriginal, '__kcOriginalMaterial');
    const baseMaterial = hasStoredOriginal ? meshWithOriginal.__kcOriginalMaterial ?? null : currentMaterial;
    if (!baseMaterial) {
      dst.material = null;
      return;
    }

    // MultiMaterial handling
    if ((BABYLON as any).MultiMaterial && baseMaterial instanceof (BABYLON as any).MultiMaterial) {
      const multi = baseMaterial.clone(`${baseMaterial.name || 'multi'}__exp`) as any;
      if (multi) {
        // Ensure subMaterials are cloned to decouple from originals
        if (Array.isArray(multi.subMaterials)) {
          multi.subMaterials = multi.subMaterials.map((sm: BABYLON.Material | null, i: number) => {
            try { return sm ? sm.clone(`${sm.name || 'mat'}__exp_${i}`) : sm; } catch { return sm; }
          });
        }
        dst.material = multi as BABYLON.Material;
        return;
      }
    }

    const cloned = baseMaterial.clone(`${baseMaterial.name || 'mat'}__exp`);
    if (cloned) dst.material = cloned;
  } catch {
    // No-op: on any failure keep the inherited material reference
  }
}

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
          // Decouple material references so export cleanup never affects originals
          cloneMaterialOnto(clone, mesh);
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
      } catch {
        // Ignore: Clone operation is optional, skip if not supported
      }
    };

    for (const r of roots) {
      if (r instanceof BABYLON.Mesh) {
        addMeshClone(r);
      } else if (r instanceof BABYLON.TransformNode) {
        const childMeshes = r.getChildMeshes(false);
        childMeshes.forEach(addMeshClone);
      } else if ((r as any).getChildMeshes) {
        try { (r as any).getChildMeshes(false).forEach(addMeshClone); } catch {
          // Ignore: getChildMeshes may not be available on all node types
        }
      }
    }

    const { GLTF2Export } = await import('@babylonjs/serializers/glTF/2.0/glTFSerializer');
    const glb = await GLTF2Export.GLBAsync(scene, 'selection', {
      shouldExportNode: (node: BABYLON.Node) => node === exportContainer || node.isDescendantOf(exportContainer),
    });
    const blob = glb.glTFFiles['selection.glb'] as Blob;
    
    // Cleanup clones
    // IMPORTANT: Do not dispose materials/textures here – clones share material
    // instances with originals by default. Disposing them would clear materials
    // on the originals and turn meshes white. Keep materials alive.
    try { exportContainer.dispose(false, false); } catch {
      // Ignore: Cleanup is best-effort
    }

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
      // Decouple material from original
      cloneMaterialOnto(base, mesh);
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
        } catch {
          // Ignore: Thin instance cloning is best-effort
        }
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
      try { const c = (m as any).clone?.(`${m.name}__exp`, exportContainer); if (c) { setWorld(m, c); c.isVisible = true; c.setEnabled?.(true); } } catch {
        // Ignore: Clone operation may fail on some mesh types
      }
    };

    for (const r of roots) {
      if ((r as any).getChildMeshes) { try { (r as any).getChildMeshes(false).forEach(add); } catch {
        // Ignore: getChildMeshes may not be available
      } }
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
      } catch {
        // Ignore: Fallback mesh collection is best-effort
      }
    }

    const { GLTF2Export } = await import('@babylonjs/serializers/glTF/2.0/glTFSerializer');
    const glb = await GLTF2Export.GLBAsync(scene, 'selection', {
      shouldExportNode: (n: BABYLON.Node) => n === exportContainer || n.isDescendantOf(exportContainer),
    });
    const blob = glb.glTFFiles['selection.glb'] as Blob;
    // Do not dispose shared materials/textures – see note above.
    try { exportContainer.dispose(false, false); } catch {
      // Ignore: Cleanup is best-effort
    }
    GLBExportService.downloadBlob(blob, fileName);
  }


  // Preserve original hierarchy: clones TransformNodes/Meshes into a named container
  static async exportSelectionWithHierarchy(
    scene: BABYLON.Scene,
    roots: (BABYLON.Node)[],
    fileName = 'selection.glb',
    allowedUniqueIds?: Set<number> | number[]
  ): Promise<void> {
    if (!roots.length) { await GLBExportService.exportScene(scene, fileName); return; }
    const rootName = (fileName||'selection.glb').replace(/\.[^.]+$/i, '');
    const container = new BABYLON.TransformNode(rootName, scene);
    const seen = new Set<number>();
    const allowSet: Set<number> | null = allowedUniqueIds
      ? (allowedUniqueIds instanceof Set ? allowedUniqueIds : new Set<number>(allowedUniqueIds))
      : null;
    const setLocal = (s: BABYLON.TransformNode, d: BABYLON.TransformNode) => { d.position.copyFrom(s.position); if ((s as any).rotationQuaternion){(d as any).rotationQuaternion=(s as any).rotationQuaternion.clone(); } else if ((s as any).rotation && (d as any).rotation){(d as any).rotation.copyFrom((s as any).rotation);} d.scaling.copyFrom(s.scaling); };
    const cloneRec = (src: BABYLON.Node, parent: BABYLON.TransformNode): BABYLON.Node | null => {
      try{
        if ((src as any).uniqueId && seen.has((src as any).uniqueId)) return null;
        const safe = src.name?.trim?.() ? src.name : `${src.getClassName?.()||'Node'}_${(src as any).uniqueId??''}`;
        if (src instanceof BABYLON.InstancedMesh){
          if (allowSet && !(allowSet.has((src as any).uniqueId) || allowSet.has(src.sourceMesh.uniqueId))) { return null; }
          const inst=(src.sourceMesh as BABYLON.Mesh).createInstance(`${safe}__inst`); inst.parent=parent; const S=new BABYLON.Vector3(),R=new BABYLON.Quaternion(),P=new BABYLON.Vector3(); src.getWorldMatrix().decompose(S,R,P); inst.position.copyFrom(P); (inst as any).rotationQuaternion=R; inst.scaling.copyFrom(S); inst.isVisible=true; inst.setEnabled(true); seen.add((src as any).uniqueId); return inst; }
        if (src instanceof BABYLON.Mesh){
          if (allowSet && !allowSet.has((src as any).uniqueId)) { return null; }
          const m=(src as BABYLON.Mesh).clone(`${safe}__mesh`, parent) as BABYLON.Mesh; m.isVisible=true; m.setEnabled(true); setLocal(src,m);
          // Decouple material from original
          cloneMaterialOnto(m, src as BABYLON.Mesh);
          const c=(src as any).thinInstanceCount as number|undefined; if (c&&c>0){ try{ const mats=(src as any).thinInstanceGetWorldMatrices?.() as Float32Array|undefined; if(mats){ for(let i=0;i<c;i++){ const M=BABYLON.Matrix.FromArray(Array.from(mats.slice(i*16,i*16+16))); const S=new BABYLON.Vector3(),R=new BABYLON.Quaternion(),P=new BABYLON.Vector3(); M.decompose(S,R,P); const inst=m.createInstance(`${safe}__thin_${i}`); inst.parent=m.parent as BABYLON.TransformNode; inst.position.copyFrom(P); (inst as any).rotationQuaternion=R; inst.scaling.copyFrom(S); inst.isVisible=true; inst.setEnabled(true); } } }catch{
            // Ignore: Thin instance processing is best-effort
          } }
          (src.getChildren().filter(c=>c instanceof BABYLON.TransformNode) as BABYLON.TransformNode[]).forEach(ch=>cloneRec(ch,m)); seen.add((src as any).uniqueId); return m; }
        if (src instanceof BABYLON.TransformNode) {
          const shouldClone = !(allowSet && !allowSet.has((src as any).uniqueId));
          const nextParent = shouldClone
            ? (() => { const t = new BABYLON.TransformNode(`${safe}`, scene); t.parent = parent; setLocal(src, t); (t as any).setEnabled?.(true); seen.add((src as any).uniqueId); return t; })()
            : parent;
          src.getChildren().forEach(ch => cloneRec(ch as BABYLON.Node, nextParent));
          return shouldClone ? nextParent : null;
        }
        const anySrc=src as any; if (typeof anySrc.clone==='function'){ const c=anySrc.clone(`${safe}__exp`, parent); if(c){ try{ setLocal(src as any,c);}catch{
          // Ignore: setLocal may fail on some node types
        }; c.isVisible=true; c.setEnabled?.(true);} seen.add((src as any).uniqueId); return c; }
      }catch{
        // Ignore: Node cloning is best-effort
      }
      return null;
    };
    roots.forEach(r=>cloneRec(r,container));
    if (container.getChildren().length===0){ try{ scene.rootNodes.forEach(n=>cloneRec(n,container)); }catch{
      // Ignore: Fallback root node cloning is best-effort
    } }
    const { GLTF2Export } = await import('@babylonjs/serializers/glTF/2.0/glTFSerializer');
    const glb = await GLTF2Export.GLBAsync(scene,'selection',{ shouldExportNode:(n: BABYLON.Node)=> n===container || n.isDescendantOf(container) });
    const blob = glb.glTFFiles['selection.glb'] as Blob; try{ container.dispose(false,false);}catch{
      // Ignore: Cleanup is best-effort
    }; GLBExportService.downloadBlob(blob,fileName);
  }  private static downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}











