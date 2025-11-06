// Babylon Inspector Panel - Mirrors working Inspector tab lifecycle
// Owner: George

import React, { useEffect, useRef } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import * as BABYLON from '@babylonjs/core';
import { SceneManager } from '../../scene/SceneManager';

// Side-effect imports (must be static)
import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';

const hasSize = (el: HTMLElement) => Boolean(el && el.offsetWidth > 0 && el.offsetHeight > 0);
const raf = () => new Promise(r => requestAnimationFrame(() => r(null)));

// Check if Inspector is actually embedded
const findInspectorInHost = (host: HTMLElement): HTMLElement | null => {
  return host.querySelector('#sceneExplorer, .babylonjsInspector') as HTMLElement | null;
};

export const BabylonInspectorPanel: React.FC<IDockviewPanelProps> = (props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const mountingRef = useRef(false);

  const mount = async () => {
    const host = hostRef.current;
    if (!host) {
      console.log('[BabylonInspectorPanel] mount: No host element');
      mountingRef.current = false;
      return;
    }
    
    if (mountingRef.current) {
      console.log('[BabylonInspectorPanel] mount: Mount already in progress');
      return;
    }
    
    if (mountedRef.current) {
      console.log('[BabylonInspectorPanel] mount: Already mounted');
      return;
    }
    
    mountingRef.current = true;

    // Wait for scene to be ready
    let scene: BABYLON.Scene | null = null;
    let sceneTries = 0;
    while (!scene && sceneTries < 20) {
      scene = SceneManager.getInstance()?.getScene?.() as BABYLON.Scene | null;
      if (!scene) {
        await raf();
        sceneTries += 1;
      }
    }
    
    if (!scene) {
      console.log('[BabylonInspectorPanel] mount: No scene available after waiting');
      mountingRef.current = false;
      return;
    }
    
    console.log('[BabylonInspectorPanel] mount: Starting mount process', {
      hostSize: { width: host.offsetWidth, height: host.offsetHeight },
      sceneId: (scene as any).uniqueId,
      debugLayerExists: !!scene.debugLayer,
      debugLayerVisible: scene.debugLayer?.isVisible?.() || false,
    });

    // wait for layout - but don't fail if no size, Inspector might still work
    let tries = 0;
    while (!hasSize(host) && tries < 8) {
      await raf();
      tries += 1;
    }
    if (!hasSize(host)) {
      console.log('[BabylonInspectorPanel] mount: Host has no size after waiting, continuing anyway');
      // Don't return - try anyway, Inspector might work with zero size initially
    }

    // host styling
    const st = host.style;
    if (!st.position) st.position = 'relative';
    if (!st.width) st.width = '100%';
    if (!st.height) st.height = '100%';
    
    // Only clear Babylon Inspector children, not all host children
    const old = host.querySelector('.babylonjsInspector, #sceneExplorer');
    if (old) old.remove();

    // clear any previous overlay instance
    try {
      scene.debugLayer.hide();
      await raf();
    } catch {}

    // Verify Inspector bundle is loaded
    const inspectorAvailable = typeof scene.debugLayer?.show === 'function';
    if (!inspectorAvailable) {
      console.warn('[BabylonInspectorPanel] mount: debugLayer.show not available');
      mountingRef.current = false;
      return;
    }

    try {
      const showResult = scene.debugLayer.show({
        embedMode: true,
        overlay: false,
        enablePopup: false,
        parentElement: host,
        rootElement: host,
        globalRoot: host,
      } as any);
      
      if (showResult && typeof showResult.then === 'function') {
        await showResult;
      }
      
      // Wait for DOM to attach
      for (let i = 0; i < 10; i++) {
        await raf();
        const inspectorEl = findInspectorInHost(host);
        if (inspectorEl) {
          console.log('[BabylonInspectorPanel] mount: Inspector DOM found after', i + 1, 'frames');
          break;
        }
      }
    } catch (err) {
      console.error('[BabylonInspectorPanel] Failed to show debug layer:', err);
      mountingRef.current = false;
      return;
    }

    // verify DOM attached
    const ok = findInspectorInHost(host);
    
    if (!ok) {
      console.warn('[BabylonInspectorPanel] mount: Inspector DOM not found in host');
      try {
        scene.debugLayer.hide();
      } catch {}
      mountingRef.current = false;
      return;
    }

    console.log('[BabylonInspectorPanel] mount: Successfully mounted', {
      inspectorElement: ok,
      inspectorClasses: ok.className,
      inspectorId: ok.id,
      isVisible: scene.debugLayer?.isVisible?.() || false,
    });
    
    mountedRef.current = true;
    mountingRef.current = false;

    // clean up if the scene is disposed
    scene.onDisposeObservable.addOnce(() => {
      mountedRef.current = false;
    });
  };

  const unmount = async () => {
    if (!mountedRef.current) return;
    mountedRef.current = false;

    const scene = SceneManager.getInstance()?.getScene?.() as BABYLON.Scene | null;
    if (!scene) return;
    try {
      scene.debugLayer.hide();
    } catch {}
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const ro = new ResizeObserver(() => { 
      if (hasSize(host)) {
        if (!mountingRef.current && !mountedRef.current) {
          mountingRef.current = false;
          void mount();
        }
      } else {
        unmount();
      }
    });
    ro.observe(host);

    const api: any = (props as any)?.api;
    const vis = typeof api?.onDidVisibilityChange === 'function'
      ? api.onDidVisibilityChange((v: any) => { 
          if (v.isVisible) {
            setTimeout(() => {
              if (!mountingRef.current && !mountedRef.current) {
                void mount();
              }
            }, 150);
          }
          if (!v.isVisible) unmount(); 
        })
      : null;

    // first attempt - delay to ensure scene is ready
    setTimeout(() => {
      if (!mountingRef.current && !mountedRef.current) {
        void mount();
      }
    }, 200);

    return () => {
      ro.disconnect();
      vis?.dispose?.();
      unmount();
      mountingRef.current = false;
    };
  }, []);

  return <div ref={hostRef} className="babylon-inspector-host" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }} />;
};
