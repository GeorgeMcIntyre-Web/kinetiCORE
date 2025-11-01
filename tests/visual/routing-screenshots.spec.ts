/**
 * Routing System Screenshot Capture (Playwright)
 *
 * Captures 10 screenshots covering UI polish and geometry + labels.
 * - Uses UI interactions (clicks, keyboard) instead of programmatic commands
 * - Simple and reliable: click buttons, place points, generate routes
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

async function createRouteWithUIInteractions(page: Page, type: 'electrical' | 'pipe' | 'cable_tray' | 'conduit') {
  // 1. Ensure in Essential mode (canvas is mounted)
  await ensureCanvasInEssential(page);
  
  // 2. Navigate to Professional mode where routing toolbar is available
  await switchToExpert(page);
  await switchToProfessional(page);
  
  // 3. Wait for routing toolbar to be ready
  await page.waitForSelector('[data-testid="routing-toolbar"]', { timeout: 5000 });
  
  // 4. Select route type from dropdown
  await page.selectOption('[data-testid="route-type-select"]', type);
  await pause(200);
  
  // 5. Get canvas for clicking
  const canvas = page.locator('#viewport-essential >> canvas').first();
  await canvas.waitFor({ state: 'visible', timeout: 10000 });
  
  // Get canvas bounds for clicking
  const canvasBounds = await canvas.boundingBox();
  if (!canvasBounds) throw new Error('Canvas not found');
  
  // Click "Add Connection Point" button
  const addConnectorBtn = page.locator('[data-testid="add-connection-point-btn"]');
  await addConnectorBtn.click();
  await pause(200);
  
  // Click Point A (center-left of canvas)
  const point1X = canvasBounds.width * 0.3;
  const point1Y = canvasBounds.height * 0.4;
  await canvas.click({
    position: { x: point1X, y: point1Y },
    force: true
  });
  await pause(400);
  
  // Click "Add Connection Point" button again for second point
  await addConnectorBtn.click();
  await pause(200);
  
  // Click Point B (center-right of canvas)
  const point2X = canvasBounds.width * 0.7;
  const point2Y = canvasBounds.height * 0.6;
  await canvas.click({
    position: { x: point2X, y: point2Y },
    force: true
  });
  await pause(400);
  
  // 6. Click "Route Between Points" button
  const routeBtn = page.locator('[data-testid="route-between-points-btn"]');
  await routeBtn.click();
  await pause(300);
  
  // Click on first connection point (source)
  await canvas.click({
    position: { x: point1X, y: point1Y },
    force: true
  });
  await pause(400);
  
  // Click on second connection point (destination) - this creates the route
  await canvas.click({
    position: { x: point2X, y: point2Y },
    force: true
  });
  await pause(800); // Wait for route to be created
  
  // 7. Select the route to open Inspector (click near center of route)
  const centerX = (point1X + point2X) / 2;
  const centerY = (point1Y + point2Y) / 2;
  await canvas.click({
    position: { x: centerX, y: centerY },
    force: true
  });
  await pause(400);
  
  // 8. Wait for "Generate Geometry" button to appear and click it
  const generateBtn = page.locator('[data-testid="generate-geometry-btn"]');
  await generateBtn.waitFor({ state: 'visible', timeout: 5000 });
  await generateBtn.click();
  await pause(600); // Wait for geometry to be generated
  
  // 9. Wait for route mesh to appear in scene
  await page.waitForFunction((routeType) => {
    const sceneManager = (window as any).sceneManager;
    if (!sceneManager?.getScene) return false;
    
    const scene = sceneManager.getScene();
    if (!scene) return false;
    
    // Check for mesh with route type in name
    const meshes = scene.meshes || [];
    return meshes.some((m: any) => 
      m.name?.toLowerCase().includes(routeType.toLowerCase()) ||
      m.id?.toLowerCase().includes(routeType.toLowerCase())
    );
  }, type, { timeout: 10000 });
  
  // 10. Press 'D' key to toggle debug labels ON
  await page.keyboard.press('d');
  await pause(500); // Wait for label to render
  
  // Additional pause to ensure everything is rendered
  await pause(300);
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
    await createRouteWithUIInteractions(page, 'electrical');
    await page.screenshot({ path: 'docs/images/routing-electrical-with-label.png' });
  });

  test('Geometry: Pipe with label', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await createRouteWithUIInteractions(page, 'pipe');
    await page.screenshot({ path: 'docs/images/routing-pipe-with-label.png' });
  });

  test('Geometry: Cable tray with label', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await createRouteWithUIInteractions(page, 'cable_tray');
    await page.screenshot({ path: 'docs/images/routing-cable-tray-with-label.png' });
  });

  test('Geometry: Conduit with label', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await createRouteWithUIInteractions(page, 'conduit');
    await page.screenshot({ path: 'docs/images/routing-conduit-with-label.png' });
  });

  test('Geometry: Mixed types with labels', async ({ page }) => {
    await page.goto('http://localhost:5173');
    // Create all four
    await createRouteWithUIInteractions(page, 'electrical');
    await createRouteWithUIInteractions(page, 'pipe');
    await createRouteWithUIInteractions(page, 'cable_tray');
    await createRouteWithUIInteractions(page, 'conduit');
    await page.screenshot({ path: 'docs/images/routing-mixed-with-labels.png' });
  });
});

