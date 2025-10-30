// Probe Random Frame / Find Its Creator
// Usage in browser console:
//   const report = (await import('/probe-random-frame.js')).default;
// The module executes and returns a detailed report object as the default export.

export default await (async () => {
  const scene = window.sceneManager?.getScene?.();
  if (!scene) {
    console.warn('[probe] No scene found via window.sceneManager.getScene()');
    return { error: 'no-scene' };
  }

  const report = {
    timestamp: new Date().toISOString(),
    cameraPosition: scene.activeCamera?.position?.clone?.() || null,
    suspects: [],
    systems: {
      coordinateFrameWidget: null,
      unifiedGizmo: null,
      tfVisualizer: null,
      transformDebug: null,
    },
  };

  const addSuspect = (kind, name, details = {}) => {
    report.suspects.push({ kind, name, ...details });
  };

  // 1) Check CoordinateFrameWidget visibility/state
  try {
    if (window.useEditorStore) {
      const store = window.useEditorStore.getState();
      const widget = store.coordinateFrameWidget;
      const node = scene.getTransformNodeByName?.('customFrameWidget') || null;
      report.systems.coordinateFrameWidget = {
        exists: !!widget,
        visible: !!node,
        overlayFlags: {
          showCoordinateOverlay: !!store.showCoordinateOverlay,
          showJointAxesOverlay: !!store.showJointAxesOverlay,
        },
      };
      if (node) {
        addSuspect('CoordinateFrameWidget', node.name, {
          worldPosition: node.getAbsolutePosition?.(),
        });
      }
    }
  } catch {}

  // 2) UnifiedGizmo / IK targets
  try {
    const { UnifiedGizmoManager } = await import('./src/kinematics/UnifiedGizmoManager.ts');
    const { IKTargetGizmoManager } = await import('./src/kinematics/IKTargetGizmoManager.ts');
    const unified = UnifiedGizmoManager.getInstance();
    const ikmgr = IKTargetGizmoManager.getInstance();
    const active = Array.from(unified.getActiveTargets?.().entries?.() || []);
    report.systems.unifiedGizmo = {
      activePanel: unified.getActivePanel?.(),
      targetCount: active.length,
      targets: active.map(([id, cfg]) => ({ id, type: cfg.targetType, chain: cfg.chainName, pos: cfg.position }))
    };
    // Heuristic: search for gizmo/IK transform nodes
    const ikNodes = scene.transformNodes?.filter?.(n => (n.name || '').toLowerCase().startsWith('iktarget_')) || [];
    ikNodes.forEach(n => addSuspect('IKTarget', n.name, { worldPosition: n.getAbsolutePosition?.() }));

    // Add rotation gizmo presence per IK target (internal map)
    try {
      const targetsField = ikmgr?.targets; // private at TS level, still accessible at runtime
      if (targetsField && typeof targetsField.forEach === 'function') {
        const rotationInfo = [];
        targetsField.forEach((t, key) => {
          rotationInfo.push({ id: key, hasRotationGizmo: !!t.rotationGizmo });
          if (t.rotationGizmo) {
            addSuspect('IKTargetRotationGizmo', `rotation_of_${key}`, {});
          }
        });
        report.systems.unifiedGizmo.rotationGizmos = rotationInfo;
      }
    } catch {}
  } catch {}

  // 3) TF Visualizer (ROS frames)
  try {
    const tfRoot = scene.getTransformNodeByName?.('tf_root');
    if (tfRoot) {
      const tfChildren = (tfRoot.getChildren?.() || []).map(n => n.name);
      report.systems.tfVisualizer = { present: true, childCount: tfChildren.length, sample: tfChildren.slice(0, 8) };
      addSuspect('TFVisualizer', 'tf_root', { children: tfChildren.slice(0, 8) });
    } else {
      report.systems.tfVisualizer = { present: false };
    }
  } catch {}

  // 4) TransformDebugVisualizer heuristics
  try {
    const debugNodes = (scene.transformNodes || []).filter(n => {
      const nm = (n.name || '').toLowerCase();
      return nm.startsWith('transformdebug') || nm.includes('debugframe') || nm.includes('fk_frame') || nm.includes('tcp_frame');
    });
    if (debugNodes.length > 0) {
      report.systems.transformDebug = { suspectedNodes: debugNodes.map(n => n.name) };
      debugNodes.forEach(n => addSuspect('TransformDebug', n.name, { worldPosition: n.getAbsolutePosition?.() }));
    } else {
      report.systems.transformDebug = { suspectedNodes: [] };
    }
  } catch {}

  // 5) Generic axis/gizmo mesh sweep with proximity to camera center pick
  const isAxisLike = (name) => {
    if (!name) return false;
    const n = name.toLowerCase();
    return (
      n.includes('axis') || n.endsWith('_x') || n.endsWith('_y') || n.endsWith('_z') ||
      n.includes('arrowhead') || n.includes('gizmo') || n.includes('frame')
    );
  };

  try {
    const axisMeshes = scene.meshes.filter(m => isAxisLike(m.name));
    axisMeshes.forEach(m => addSuspect('AxisMesh', m.name, {
      type: m.getClassName?.(),
      isLines: m.getClassName?.() === 'LinesMesh',
      isVisible: m.isVisible,
      parent: m.parent?.name || null,
      utilityLayer: m._scene !== scene ? true : false,
    }));
  } catch {}

  // 6) Perform a pick test at screen center and capture nearby axis-like items
  try {
    const w = scene.getEngine().getRenderWidth();
    const h = scene.getEngine().getRenderHeight();
    const pick = scene.pick(w / 2, h / 2, m => true);
    report.centerPick = {
      hit: !!pick?.hit,
      mesh: pick?.pickedMesh?.name || null,
      parent: pick?.pickedMesh?.parent?.name || null,
      distance: pick?.distance || null,
    };
  } catch {}

  console.groupCollapsed('[probe] Random frame origin report');
  console.table(report.suspects.map(s => ({ kind: s.kind, name: s.name })));
  console.log('systems', report.systems);
  console.log('centerPick', report.centerPick);
  console.groupEnd();

  return report;
})();


