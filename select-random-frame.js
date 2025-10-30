// Select Random Frame/Gizmo Under Cursor (for identification)
// Usage in console:
//   const sel = (await import('/select-random-frame.js')).default
// It will pick likely frame/gizmo at screen center, highlight it, and
// return an info object. Also exposes window.randomFrame = selected mesh/node.

export default await (async () => {
  const scene = window.sceneManager?.getScene?.();
  if (!scene) {
    console.warn('[select] No scene found');
    return { error: 'no-scene' };
  }

  const engine = scene.getEngine();
  const cx = engine.getRenderWidth() / 2;
  const cy = engine.getRenderHeight() / 2;

  // Ensure a highlight layer exists
  let hl = scene.getHighlightLayerByName?.('select-debug');
  if (!hl && window.BABYLON) {
    hl = new window.BABYLON.HighlightLayer('select-debug', scene);
    hl.innerGlow = false;
  }

  // Helper classifiers
  const isAxisLike = (m) => {
    const n = (m?.name || '').toLowerCase();
    return (
      m?.getClassName?.() === 'LinesMesh' ||
      n.includes('frame') ||
      n.includes('axis') ||
      n.endsWith('_x') || n.endsWith('_y') || n.endsWith('_z') ||
      n.includes('gizmo') ||
      n.includes('arrowhead')
    );
  };

  // Pick center and gather nearby candidates
  const pick = scene.pick(cx, cy, m => true);
  const hitPoint = pick?.pickedPoint;

  const candidates = scene.meshes
    .filter(m => isAxisLike(m))
    .map(m => ({
      mesh: m,
      dist: hitPoint ? m.getAbsolutePosition?.().subtract(hitPoint).length() : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.dist - b.dist);

  const selected = candidates[0]?.mesh || pick?.pickedMesh || null;

  // Clear previous highlight
  try { hl?.removeAllMeshes?.(); } catch {}

  const info = {
    pickedMesh: pick?.pickedMesh?.name || null,
    selectedName: selected?.name || null,
    className: selected?.getClassName?.() || null,
    parentChain: [],
    sourceGuess: 'unknown',
    utilityLayer: selected?._scene !== scene,
    distanceFromPick: candidates[0]?.dist ?? null,
  };

  // Build parent chain and guess origin
  let p = selected;
  while (p) {
    info.parentChain.push(p.name || p.id || 'unknown');
    p = p.parent;
  }

  const chainText = info.parentChain.join(' > ').toLowerCase();
  if (chainText.includes('iktarget_') || chainText.includes('tcp_')) {
    info.sourceGuess = 'UnifiedGizmo/IKTarget (TCP)';
  } else if (chainText.includes('tf_root')) {
    info.sourceGuess = 'ROS TF Visualizer';
  } else if (chainText.includes('customframewidget')) {
    info.sourceGuess = 'CoordinateFrameWidget';
  } else if (chainText.includes('transformdebug') || chainText.includes('debugframe')) {
    info.sourceGuess = 'TransformDebugVisualizer';
  }

  // Highlight selection
  if (selected && hl) {
    try { hl.addMesh(selected, { r: 1, g: 1, b: 0 }); } catch {}
  }

  // Expose for manual inspection
  window.randomFrame = selected;
  console.groupCollapsed('[select] Random frame selection');
  console.log('selected:', selected);
  console.log('info:', info);
  console.groupEnd();

  return info;
})();


