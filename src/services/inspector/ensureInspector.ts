export async function ensureInspector(): Promise<void> {
  const B = (globalThis as any).BABYLON || (typeof window !== 'undefined' ? (window as any).BABYLON : null);
  if (B?.Inspector) return;

  // Ensure BABYLON is available
  if (!B && typeof window !== 'undefined') {
    console.warn('[ensureInspector] BABYLON not found on window or globalThis');
    return;
  }

  try {
    // Import Inspector module
    const inspectorModule = await import('@babylonjs/inspector');
    
    // Check if it auto-registered
    const checkB = (globalThis as any).BABYLON || (typeof window !== 'undefined' ? (window as any).BABYLON : null);
    if (checkB?.Inspector) return;

    // Try to manually register from module exports (only if not already set)
    // Inspector might be exported in different ways depending on version
    if (!checkB.Inspector) {
      try {
        const InspectorClass = 
          (inspectorModule as any).Inspector ||
          (inspectorModule as any).default?.Inspector ||
          (inspectorModule as any).default;
        
        if (InspectorClass && checkB) {
          // Try to add Inspector property, but catch if object is not extensible
          try {
            checkB.Inspector = InspectorClass;
            return;
          } catch (err) {
            // Object is not extensible (frozen/sealed) - that's okay, Inspector works through DebugLayer
            console.log('[ensureInspector] Cannot add Inspector property (object not extensible) - Inspector works through DebugLayer');
          }
        }
      } catch (err) {
        // Ignore - Inspector works through DebugLayer without separate class
      }
    }

    // In Babylon.js 8.x, Inspector might not be a separate class
    // It's integrated into DebugLayer, so we just need the bundle loaded
    // The DebugLayer.show() method will use it automatically
    if (checkB?.DebugLayer) {
      // Inspector bundle is loaded, DebugLayer can use it
      return;
    }
  } catch (err) {
    console.warn('[ensureInspector] Failed to import @babylonjs/inspector:', err);
  }

  // Final fallback: set URL for DebugLayer to lazy-load
  const finalB = (globalThis as any).BABYLON || (typeof window !== 'undefined' ? (window as any).BABYLON : null);
  if (finalB?.DebugLayer && !finalB.DebugLayer._InspectorURL) {
    finalB.DebugLayer._InspectorURL = '/node_modules/@babylonjs/inspector/babylon.inspector.bundle.js';
  }
}

