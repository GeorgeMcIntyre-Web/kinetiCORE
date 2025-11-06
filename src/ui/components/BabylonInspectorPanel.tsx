import React from 'react';
import type { IDockviewPanelProps } from 'dockview-react';

export default function BabylonInspectorPanel(_props: IDockviewPanelProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const mountedRef = React.useRef(false);

  React.useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    let disposed = false;
    let retryCount = 0;
    const maxRetries = 50; // ~5 seconds at 100ms intervals

    const tryMount = async () => {
      if (disposed) return;

      const el = hostRef.current;
      if (!el) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(tryMount, 100);
        } else {
          console.warn('[BabylonInspectorPanel] Host element not found after retries');
        }
        return;
      }

      const scene = (window as any).sceneManager?.getScene?.() || (window as any).scene;
      if (!scene) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(tryMount, 100);
        } else {
          console.warn('[BabylonInspectorPanel] Scene not available after retries');
        }
        return;
      }

      try {
        console.log('[BabylonInspectorPanel] Mounting Inspector...');
        const { showEmbeddedInspector } = await import('@/services/inspector/InspectorService');
        await showEmbeddedInspector({ scene, host: el });
        console.log('[BabylonInspectorPanel] Inspector mounted successfully');
      } catch (err) {
        console.error('[BabylonInspectorPanel] Failed to mount Inspector:', err);
      }
    };

    // Start trying to mount
    tryMount();

    return () => {
      disposed = true;
      mountedRef.current = false;
    };
  }, []);

  return (
    <div className="inspector-pane">
      <div ref={hostRef} className="babylon-inspector-host" />
    </div>
  );
}
