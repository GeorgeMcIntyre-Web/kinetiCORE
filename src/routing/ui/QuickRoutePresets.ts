// QuickRoutePresets - Helpers to rapidly create demo routes for screenshots
// Owner: Routing System Team

import { useRoutingStore } from '../../ui/store/routingStore';
import { useEditorStore } from '../../ui/store/editorStore';
import { CreateConnectionPointCommand } from '../commands/CreateConnectionPointCommand';
import { ConnectionManager } from '../core/ConnectionManager';
import { RoutingWorkflowHandler } from './RoutingWorkflowHandler';
import { getGlobalDebugLabels } from './RouteDebugLabels';

/** Simple vector type (Z-up) */
type V3 = { x: number; y: number; z: number };

/**
 * Create a preset route between two points and generate geometry + labels
 */
export async function createPresetRoute(
  type: 'pipe' | 'electrical' | 'cable_tray' | 'conduit',
  start: V3,
  end: V3
) {
  try {
    console.log(`[QuickRoutePresets] 🎯 Creating ${type} route from`, start, 'to', end);
    console.log(`[QuickRoutePresets] Type parameter received:`, type);

    const setType = useRoutingStore.getState().setCurrentRouteType;
    if (!setType) {
      console.error('[QuickRoutePresets] setCurrentRouteType not found in routingStore');
      return;
    }
    setType(type);
    console.log(`[QuickRoutePresets] Current route type set to:`, useRoutingStore.getState().currentRouteType);

    const cmdManager = useEditorStore.getState().commandManager;
    if (!cmdManager) {
      console.error('[QuickRoutePresets] commandManager not found in editorStore');
      return;
    }

  // Minimal specs used for connection point compatibility
  const baseSpecs: any = (() => {
    switch (type) {
      case 'pipe':
        return { size: '40mm', material: 'steel' };
      case 'electrical':
        return { voltage: 120, current: 15 };
      case 'cable_tray':
        return { size: '400mm', trayType: 'ladder' };
      case 'conduit':
        return { nominalSize: '1/2"', conduitType: 'EMT' };
    }
  })();

  const direction = { x: 0, y: 0, z: 1 };

  const cmdA = new CreateConnectionPointCommand({
    type,
    position: start,
    direction,
    specifications: baseSpecs,
  });
  const cmdB = new CreateConnectionPointCommand({
    type,
    position: end,
    direction,
    specifications: baseSpecs,
  });

    console.log('[QuickRoutePresets] 📍 Creating connection points with type:', type);
    console.log('[QuickRoutePresets] Point A specs:', baseSpecs);
    console.log('[QuickRoutePresets] Point B specs:', baseSpecs);
    cmdManager.execute(cmdA);
    cmdManager.execute(cmdB);
    console.log('[QuickRoutePresets] ✅ Connection points created');

    // Find the newly created connection points by nearest positions
    const cm = ConnectionManager.getInstance();
    const src = cm.findNearbyConnections(start, 0.05)[0];
    const dst = cm.findNearbyConnections(end, 0.05)[0];

    if (!src || !dst) {
      console.error('[QuickRoutePresets] ❌ Failed to find connection points. src:', src, 'dst:', dst);
      return;
    }

    console.log('[QuickRoutePresets] ✅ Found connection points:');
    console.log('[QuickRoutePresets]   Source:', src.getId(), 'Type:', src.getType());
    console.log('[QuickRoutePresets]   Dest:', dst.getId(), 'Type:', dst.getType());
    console.log('[QuickRoutePresets] 🔗 Creating route between points...');
    // Create route between them and wait for completion
    const routeId = await RoutingWorkflowHandler.createRouteBetweenPoints(src.getId(), dst.getId());

    if (!routeId) {
      console.error('[QuickRoutePresets] Failed to create route');
      return;
    }

    console.log('[QuickRoutePresets] Generating geometry for route:', routeId);
    const { GenerateRouteGeometryCommand } = await import('../commands/GenerateRouteGeometryCommand');
    const genCmd = new GenerateRouteGeometryCommand(routeId);
    cmdManager.execute(genCmd);

    // Ensure labels are visible if available
    const labels = getGlobalDebugLabels();
    if (labels) {
      labels.setVisible(true);
      console.log('[QuickRoutePresets] Debug labels enabled');
    }

    console.log('[QuickRoutePresets] Route creation complete!');
  } catch (error) {
    console.error('[QuickRoutePresets] Error creating preset route:', error);
  }
}

/**
 * Create 4 preset routes arranged for a mixed overview screenshot
 */
export async function createMixedPreset() {
  // Arrange in parallel with slight offsets to avoid label overlap
  const base = { x: 0, y: 0, z: 0 };
  await createPresetRoute('electrical', base, { x: 2, y: 0.5, z: 0.5 });
  await createPresetRoute('pipe', { x: 0, y: 1, z: 0 }, { x: 2, y: 1.5, z: 0.5 });
  await createPresetRoute('cable_tray', { x: 0, y: 2, z: 0 }, { x: 2, y: 2.2, z: 0.5 });
  await createPresetRoute('conduit', { x: 0, y: 3, z: 0 }, { x: 2, y: 3.2, z: 0.5 });
}

