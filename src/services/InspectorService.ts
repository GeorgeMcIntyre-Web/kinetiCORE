// Inspector Service - Coordinates Babylon.js Inspector lifecycle
// Owner: George

import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';

type SceneGetter = () => import('@babylonjs/core').Scene | null;

class InspectorService {
  private getScene: SceneGetter | null = null;
  private mounted = false;

  setSceneGetter(fn: SceneGetter) { this.getScene = fn; }

  isMounted() { return this.mounted; }

  async showInto(host: HTMLElement) {
    const scene = this.getScene ? this.getScene() : null;
    if (!scene) return;
    if (!host) return;
    if (this.mounted) return;

    const s = host.style;
    if (s.position.length === 0) s.position = 'relative';
    if (s.width.length === 0) s.width = '100%';
    if (s.height.length === 0) s.height = '100%';

    try { await scene.debugLayer.hide(); } catch {}

    Array.from(document.querySelectorAll('.babylonjsInspector, #sceneExplorer'))
      .filter(el => !host.contains(el))
      .forEach(el => el.remove());

    await scene.debugLayer.show({
      embedMode: true,
      overlay: false,
      enablePopup: false,
      rootElement: host,
      parentElement: host,
      globalRoot: host,
    } as any);

    // 2 RAFs, then adopt if mounted elsewhere
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const root = document.querySelector('.babylonjsInspector, #sceneExplorer') as HTMLElement | null;
    if (root && !host.contains(root)) host.appendChild(root);
    if (root?.style) Object.assign(root.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });

    this.mounted = !!root;
    if (root) {
      scene.onDisposeObservable.addOnce(() => { this.mounted = false; });
    }
  }

  async hide() {
    const scene = this.getScene ? this.getScene() : null;
    if (!scene) return;
    if (!this.mounted) return;
    this.mounted = false;
    try { await scene.debugLayer.hide(); } catch {}
  }
}

export const inspectorService = new InspectorService();

