/**
 * Routing System Screenshot Capture (Playwright)
 *
 * Captures 10 screenshots covering UI polish and geometry + labels.
 * - Uses existing UI where feasible (mode switcher, ribbons, dialogs)
 * - Programmatically creates routes and generates geometry via dynamic imports
 * - Creates debug labels with full specifications for crisp visuals
 *
 * Output files are saved into docs/images/ with the exact names requested.
 */

import { test, expect, Page } from '@playwright/test';

// Convenience: small pause to let animations settle
const pause = (ms = 300) => new Promise(r => setTimeout(r, ms));

async function switchToExpert(page: Page) {
  // Open mode dropdown in Essential header and select Expert
  // Button has a dynamic title; target via class context and open menu
  const modeToggle = page.locator('div.hidden.md\\:block >> button[title*="interface"]');
  await modeToggle.first().click();
  await page.waitForSelector('.keyboard-hint');
  await page.getByRole('button', { name: /Expert/ }).click();
  await page.waitForSelector('.expert-layout');
}

async function switchToProfessional(page: Page) {
  // In Expert layout, there is a user-level select in the header
  await page.selectOption('select.user-level-select', 'professional');
  await page.waitForSelector('.ribbon-toolbar');
}

async function ensureCanvasInEssential(page: Page) {
  // If we are not in Essential, switch via header dropdown
  const isEssential = await page.locator('#viewport-essential').count();
  if (!isEssential) {
    // Open the mode switcher and choose Essential
    const modeToggle = page.locator('div.hidden.md\\:block >> button[title*="interface"]');
    await modeToggle.first().click();
    await page.waitForSelector('.keyboard-hint');
    // Use .first() to avoid strict mode violation (2 Essential buttons in dropdown)
    // Use force to bypass modal backdrop overlay
    await page.getByRole('button', { name: /Essential/ }).first().click({ force: true });
  }
  await page.waitForSelector('#viewport-essential');
  await page.waitForSelector('#viewport-essential >> canvas');
}

async function createRouteWithGeometryAndLabel(page: Page, type: 'electrical' | 'pipe' | 'cable_tray' | 'conduit') {
  // Always operate from Essential layout where the SceneCanvas is mounted
  await ensureCanvasInEssential(page);

  // Programmatic setup inside the app using dynamic imports (Vite dev)
  const routeId = await page.evaluate(async (routeType) => {
    // Dynamic imports of app modules
    const { useRoutingStore } = await import('/src/ui/store/routingStore.ts');
    const { SceneManager } = await import('/src/scene/SceneManager.ts');
    const { CreateConnectionPointCommand } = await import('/src/routing/commands/CreateConnectionPointCommand.ts');
    const { CreateRouteCommand } = await import('/src/routing/commands/CreateRouteCommand.ts');
    const { GenerateRouteGeometryCommand } = await import('/src/routing/commands/GenerateRouteGeometryCommand.ts');
    const { RouteOptimizer } = await import('/src/routing/pathfinding/RouteOptimizer.ts');
    const { getDefaultConstraints, getObstacles } = await import('/src/routing/core/RoutingUtils.ts');
    const { setGlobalDebugLabels, RouteDebugLabels, getGlobalDebugLabels } = await import('/src/routing/ui/RouteDebugLabels.ts');

    // Exposed editor store for command manager
    const editorStore = (window as any).useEditorStore;
    if (!editorStore) throw new Error('useEditorStore not exposed on window');
    const commandManager = editorStore.getState().commandManager;

    // Ensure scene exists
    const scene = SceneManager.getInstance().getScene();
    if (!scene) throw new Error('Scene not initialized');

    // Set current route type
    useRoutingStore.getState().setCurrentRouteType(routeType);

    // Create 2 connection points via command (positions are arbitrary but visible)
    const cfgA = { type: routeType, position: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } } as const;
    const cfgB = { type: routeType, position: { x: 1.2, y: 0.2, z: 0.4 }, direction: { x: 0, y: 0, z: 1 } } as const;
    commandManager.execute(new CreateConnectionPointCommand(cfgA));
    commandManager.execute(new CreateConnectionPointCommand(cfgB));

    // Pick last two connection points from store
    const cps = useRoutingStore.getState().connectionPoints;
    if (cps.length < 2) throw new Error('Connection points not created');
    const source = cps[cps.length - 2];
    const dest = cps[cps.length - 1];

    // Find optimal path
    const optimizer = new RouteOptimizer();
    const constraints = getDefaultConstraints(routeType);
    const obstacles = getObstacles(scene);
    const optimizationMode = useRoutingStore.getState().optimizationMode;
    const route = optimizer.findOptimalPath(source, dest, constraints, obstacles, optimizationMode);
    if (!route) throw new Error('Route not found');

    // Create route via command (adds to store)
    commandManager.execute(new CreateRouteCommand(route));

    // Ensure debug labels system exists and visible (we’re in Essential)
    let dl = getGlobalDebugLabels();
    if (!dl) {
      dl = new RouteDebugLabels(scene);
      setGlobalDebugLabels(dl);
    }
    dl.setVisible(true);

    // Generate geometry (also attaches a basic debug label)
    const genCmd = new GenerateRouteGeometryCommand(route.getId());
    commandManager.execute(genCmd);

    // Enrich label with specifications for crisp UI per type
    const mesh = scene.getMeshByName(`${route.type}_${route.getId()}`) as any;
    if (mesh && dl) {
      // Remove the basic label and add a detailed one
      dl.removeLabel(route.getId());
      switch (routeType) {
        case 'electrical':
          dl.createRouteLabel(route as any, mesh, {
            voltage: 120,
            current: 15,
            coreCount: 3,
            wireGauge: '14 AWG',
            outerDiameter: 0.008,
            connectorA: { type: 'NEMA-5-15', voltage: 125, current: 15 },
            connectorB: { type: 'IEC-C13', voltage: 250, current: 10 }
          });
          break;
        case 'pipe':
          dl.createRouteLabel(route as any, mesh, {
            nominalSize: '1/2"',
            outerDiameter: 0.04,
            innerDiameter: 0.016,
            material: 'steel',
            fluidType: 'water',
            flowRate: 10,
            pressureRating: 150,
          });
          break;
        case 'cable_tray':
          dl.createRouteLabel(route as any, mesh, {
            width: 0.4,
            height: 0.075,
            trayType: 'ladder',
            material: 'galvanized-steel',
            loadRating: 50,
            maxCables: 20,
          });
          break;
        case 'conduit':
          dl.createRouteLabel(route as any, mesh, {
            nominalSize: '1/2"',
            outerDiameter: 0.025,
            conduitType: 'EMT',
            maxWires: 6,
            fillPercentage: 40,
          });
          break;
      }
    }

    return route.getId();
  }, type);

  // Small delay to allow render loop to position label properly
  await pause(300);
  return routeId;
}

test.describe('Routing Screenshot Suite', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('http://localhost:5173');
    // Wait for initial canvas in Essential
    await page.waitForSelector('#viewport-essential >> canvas', { timeout: 20000 });
    await page.close();
  });

  test('UI Polish: Expert quad viewports', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await switchToExpert(page);

    // Click Top viewport to activate (cyan border) - use force to bypass SelectionIndicator overlay
    await page.getByText('Top View').click({ force: true });
    await pause(200);

    // Assertions (non-fatal) for confidence
    await expect(page.locator('.grid-overlay')).toHaveCount(4);
    await expect(page.locator('.axis-indicator')).toHaveCount(4);
    await expect(page.locator('.viewport-quad.active')).toHaveCount(1);

    await page.screenshot({ path: 'docs/images/expert-mode-quad-viewports.png', fullPage: true });
  });

  test('UI Polish: Professional ribbon hover', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await switchToExpert(page); // go expert first (header select exists)
    await switchToProfessional(page);

    const firstTool = page.locator('.tool-btn').first();
    await firstTool.hover({ force: true });
    await pause(150);
    await page.screenshot({ path: 'docs/images/professional-ribbon-hover.png', fullPage: true });
  });

  test('UI Polish: Measurement tools with glow (distance)', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await switchToExpert(page);
    await switchToProfessional(page);

    // Open Distance tool
    await page.getByRole('button', { name: 'Distance' }).click();

    // Click two points on the canvas (attach via SceneCanvas in Essential, but here UI-only screenshot is okay)
    // If canvas is not present in Professional, this captures the UI panel state promptly.
    await pause(300);
    await page.screenshot({ path: 'docs/images/measurement-tools-glow.png', fullPage: true });
  });

  test('UI Polish: Export dialog cards', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await switchToExpert(page);
    // Open export via header action button (Export icon)
    await page.getByRole('button', { name: 'Export' }).click();
    await page.waitForSelector('.export-format-card');

    // Select Babylon Scene card
    await page.getByText('Babylon Scene', { exact: false }).click();
    await pause(150);
    await page.screenshot({ path: 'docs/images/export-dialog-cards.png', fullPage: true });
  });

  test('UI Polish: Mode switcher dropdown (keyboard hints)', async ({ page }) => {
    await page.goto('http://localhost:5173');
    // Open mode dropdown in Essential header
    const modeToggle = page.locator('div.hidden.md\\:block >> button[title*="interface"]');
    await modeToggle.first().click();
    await page.waitForSelector('.keyboard-hint');
    await page.screenshot({ path: 'docs/images/mode-switcher-dropdown.png', fullPage: true });
  });

  test('Geometry: Electrical with label', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await createRouteWithGeometryAndLabel(page, 'electrical');
    await page.screenshot({ path: 'docs/images/routing-electrical-with-label.png' });
  });

  test('Geometry: Pipe with label', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await createRouteWithGeometryAndLabel(page, 'pipe');
    await page.screenshot({ path: 'docs/images/routing-pipe-with-label.png' });
  });

  test('Geometry: Cable tray with label', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await createRouteWithGeometryAndLabel(page, 'cable_tray');
    await page.screenshot({ path: 'docs/images/routing-cable-tray-with-label.png' });
  });

  test('Geometry: Conduit with label', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await createRouteWithGeometryAndLabel(page, 'conduit');
    await page.screenshot({ path: 'docs/images/routing-conduit-with-label.png' });
  });

  test('Geometry: Mixed types with labels', async ({ page }) => {
    await page.goto('http://localhost:5173');
    // Create all four
    await createRouteWithGeometryAndLabel(page, 'electrical');
    await createRouteWithGeometryAndLabel(page, 'pipe');
    await createRouteWithGeometryAndLabel(page, 'cable_tray');
    await createRouteWithGeometryAndLabel(page, 'conduit');
    await page.screenshot({ path: 'docs/images/routing-mixed-with-labels.png' });
  });
});

