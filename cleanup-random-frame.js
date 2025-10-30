// Cleanup Random Frame / Gizmo Artifacts
// Run in browser console:
//   const result = (await import('/cleanup-random-frame.js')).default
// The module executes immediately and returns a small summary object as the default export.

export default await (async () => {
  const summary = {
    coordinateFrameWidgetHidden: false,
    jointAxesOverlayDisabled: false,
    tfRootDisposed: false,
    ikTargetsCleared: false,
    transformDebugCleared: false,
    gizmoMeshesDisposed: 0,
    axisLikeMeshesDisposed: 0,
  };

  try {
    const scene = window.sceneManager?.getScene?.();
    if (!scene) {
      console.warn('[cleanup] No scene found via window.sceneManager.getScene()');
    }

    // 1) Hide the custom coordinate frame widget and disable overlays in the store
    try {
      if (window.useEditorStore) {
        const store = window.useEditorStore.getState();
        if (store.coordinateFrameWidget?.hide) {
          store.coordinateFrameWidget.hide();
          summary.coordinateFrameWidgetHidden = true;
        }
        // Turn off overlays that can create extra frames
        window.useEditorStore.setState({
          showCoordinateOverlay: false,
          showJointAxesOverlay: false,
        });
        summary.jointAxesOverlayDisabled = true;
      }
    } catch (e) {
      console.warn('[cleanup] Failed to hide coordinate frame widget / overlays', e);
    }

    // 2) Clear Unified/IK gizmos (TCP/IK targets)
    try {
      const { UnifiedGizmoManager } = await import('./src/kinematics/UnifiedGizmoManager.ts');
      const unified = UnifiedGizmoManager.getInstance();
      unified.clearAll();
      summary.ikTargetsCleared = true;
    } catch (e) {
      // Optional; OK if not present
    }

    // 3) Clear TransformDebugVisualizer frames (FK/Mesh/Base/TCP debug axes)
    try {
      const { TransformDebugVisualizer } = await import('./src/kinematics/TransformDebugVisualizer.ts');
      const dbg = TransformDebugVisualizer.getInstance();
      // Disable and clear
      dbg.setEnabled(false);
      summary.transformDebugCleared = true;
    } catch (e) {
      // Optional; OK if not present
    }

    // 4) Dispose ROS TF visualizer root if present (removes all TF axes/labels/lines)
    try {
      if (scene) {
        const tfRoot = scene.getTransformNodeByName?.('tf_root');
        if (tfRoot) {
          tfRoot.dispose();
          summary.tfRootDisposed = true;
        }
      }
    } catch (e) {
      // Optional
    }

    // 5) Sweep leftover gizmo/axis meshes directly in the scene as a last resort
    try {
      if (scene) {
        const isAxisLike = (name) => {
          if (!name) return false;
          const n = name.toLowerCase();
          return (
            n.includes('axis') ||
            n.endsWith('_x') || n.endsWith('_y') || n.endsWith('_z') ||
            n.includes('arrowhead') ||
            n.includes('gizmo') ||
            n.startsWith('iktarget_') ||
            n.startsWith('customframework') || n.includes('customframewidget')
          );
        };

        // Dispose Babylon gizmo meshes and utility layers if they leaked
        const gizmoLike = scene.meshes.filter(m => (m.name || '').toLowerCase().includes('gizmo'));
        gizmoLike.forEach(m => {
          try { m.dispose(false, true); summary.gizmoMeshesDisposed++; } catch {}
        });

        // Dispose axis-like line meshes that are not attached to visible devices
        const axisLike = scene.meshes.filter(m => isAxisLike(m.name));
        axisLike.forEach(m => {
          try { m.dispose(false, true); summary.axisLikeMeshesDisposed++; } catch {}
        });

        // Aggressively remove legacy debug transform nodes (safe: transform nodes only)
        const isLegacyDebugNode = (name) => {
          if (!name) return false;
          const n = name.toLowerCase();
          return (
            n.startsWith('transformdebug') ||
            n.startsWith('debug_') ||
            n.includes('debugframe') ||
            n.includes('fk_frame') ||
            n.includes('mesh_frame') ||
            n.includes('tcp_frame') ||
            n.includes('frame_axes') ||
            n.includes('tf_frame')
          );
        };

        const tn = scene.transformNodes?.slice?.() || [];
        tn.forEach(node => {
          try {
            if (isLegacyDebugNode(node.name) && node.name !== 'tf_root') {
              node.dispose();
            }
          } catch {}
        });
      }
    } catch (e) {
      console.warn('[cleanup] Sweep failed', e);
    }

    console.log('[cleanup] Finished. Summary:', summary);
    return summary;
  } catch (err) {
    console.error('[cleanup] Unexpected error', err);
    return summary;
  }
})();


