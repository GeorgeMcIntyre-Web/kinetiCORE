import React from 'react';
import type { IDockviewPanelProps } from 'dockview-react';

export default function BabylonInspectorPanel(_props: IDockviewPanelProps) {
  const mountedRef = React.useRef(false);

  React.useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    let disposed = false;
    let retryCount = 0;
    const maxRetries = 50; // ~5 seconds at 100ms intervals

    const tryShowInspector = async () => {
      if (disposed) return;

      const scene = (window as any).sceneManager?.getScene?.() || (window as any).scene;
      if (!scene) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(tryShowInspector, 100);
        } else {
          console.warn('[BabylonInspectorPanel] Scene not available after retries');
        }
        return;
      }

      try {
        console.log('[BabylonInspectorPanel] Opening Inspector in overlay mode...');
        
        // Ensure Inspector bundle is loaded
        await import('@/services/inspector/ensureInspector').then(m => m.ensureInspector());
        
        // Show Inspector in overlay mode (default) - this works "by default" with auto-refresh
        if (!scene.debugLayer.isVisible()) {
          await scene.debugLayer.show({
            embedMode: false,
            overlay: true,
            handleResize: true,
          });
          console.log('[BabylonInspectorPanel] ✅ Inspector opened in overlay mode');
        } else {
          console.log('[BabylonInspectorPanel] Inspector already visible');
        }
      } catch (err) {
        console.error('[BabylonInspectorPanel] Failed to open Inspector:', err);
      }
    };

    // Start trying to show Inspector
    tryShowInspector();

    return () => {
      disposed = true;
      mountedRef.current = false;
    };
  }, []);

  return (
    <div className="inspector-pane" style={{ padding: '20px', textAlign: 'center' }}>
      <p style={{ color: '#ccc', marginTop: '40px' }}>
        Inspector opened in overlay mode (default location).
        <br />
        It should appear as a floating window and will auto-refresh when objects are added.
      </p>
      <p style={{ color: '#888', fontSize: '0.9em', marginTop: '20px' }}>
        If the Inspector window is not visible, check if it's behind other windows or use Alt+I to toggle it.
      </p>
    </div>
  );
}
