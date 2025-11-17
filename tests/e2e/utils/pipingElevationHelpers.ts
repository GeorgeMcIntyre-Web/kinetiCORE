/**
 * E2E Test Helpers for Factory Piping Elevation Feature
 *
 * Owner: Agent 8 (E2E Test Specialist)
 * Date: 2025-11-15
 *
 * These helpers provide reusable utilities for testing elevation-aware
 * node placement workflows in Playwright E2E tests.
 */

import { Page, Locator, expect } from '@playwright/test';
import { PipingPlacementMode } from '../../../src/domain/factoryServices/piping/pipingTypes';

/**
 * Small pause to let animations and state updates settle
 */
export const pause = (ms = 300): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Open the Piping panel via the toolbar button
 * Assumes the app is in Professional or Expert mode where the toolbar is visible
 *
 * IMPORTANT: The Piping button lives in the 'Routing' workspace, so we must
 * switch to that workspace first before looking for the button.
 */
export async function openPipingPanel(page: Page): Promise<void> {
  // First switch to Routing workspace where the Piping button lives
  const routingTab = page.getByRole('button', { name: /routing/i });
  await expect(routingTab).toBeVisible({ timeout: 5000 });

  // Check if Routing tab is not already active
  const hasActiveClass = await routingTab.evaluate((el) =>
    el.classList.contains('active')
  );

  if (!hasActiveClass) {
    // Click to switch workspace
    await routingTab.click({ force: true, noWaitAfter: true });
  }

  // Wait for workspace to switch and buttons to render
  await pause(1000);

  // Use stable test-id selector for the Piping button in routing workspace
  const pipingButton = page.getByTestId('toolbar-piping-button');

  // Wait for button to appear in DOM and be visible
  await expect(pipingButton).toBeVisible({ timeout: 10000 });
  await expect(pipingButton).toBeEnabled();

  await pipingButton.click({ noWaitAfter: true });

  // Wait for panel to be visible and fully loaded
  const panel = page.locator('[data-testid="piping-panel"]');
  await expect(panel).toBeVisible({ timeout: 5000 });
}

/**
 * Close the Piping panel
 */
export async function closePipingPanel(page: Page): Promise<void> {
  const panel = page.locator('[data-testid="piping-panel"]');

  if ((await panel.count()) === 0) {
    return; // Already closed
  }

  // Click the X button in the panel header
  const closeButton = panel.locator('button[title="Close Piping Panel"]');
  await closeButton.click();

  // Wait for panel to be hidden
  await expect(panel).toBeHidden({ timeout: 3000 });
}

/**
 * Get the current placement mode from the UI dropdown
 */
export async function getPlacementMode(page: Page): Promise<PipingPlacementMode> {
  const select = page.locator('[data-testid="placement-mode-select"]');
  const value = await select.inputValue();
  return value as PipingPlacementMode;
}

/**
 * Set the placement mode via the UI dropdown
 */
export async function setPlacementMode(page: Page, mode: PipingPlacementMode): Promise<void> {
  const select = page.locator('[data-testid="placement-mode-select"]');
  await expect(select).toBeVisible();
  await select.selectOption(mode);

  // Verify mode was set correctly
  await expect(select).toHaveValue(mode);
}

/**
 * Get the default elevation value from the input field (in scene units - meters)
 */
export async function getDefaultElevation(page: Page): Promise<number> {
  const input = page.locator('[data-testid="placement-elevation-input"]');
  const value = await input.inputValue();
  return parseFloat(value);
}

/**
 * Set the default elevation via the input field (in scene units - meters)
 */
export async function setDefaultElevation(page: Page, value: number): Promise<void> {
  const input = page.locator('[data-testid="placement-elevation-input"]');
  await expect(input).toBeVisible();
  await input.fill(value.toString());

  // Verify value was set (allow small parsing differences)
  const actualValue = await input.inputValue();
  const parsedValue = parseFloat(actualValue);
  if (Math.abs(parsedValue - value) > 0.001) {
    throw new Error(`Failed to set elevation: expected ${value}, got ${actualValue}`);
  }
}

/**
 * Click on the viewport to place a piping node
 * @param relativeX - X position as fraction of canvas width (0.0 to 1.0)
 * @param relativeY - Y position as fraction of canvas height (0.0 to 1.0)
 */
export async function placeNodeAtViewport(
  page: Page,
  relativeX: number = 0.5,
  relativeY: number = 0.5
): Promise<void> {
  // Wait a moment for the scene to fully initialize after opening Piping panel
  await pause(1000);

  // Find the canvas (works in both Essential and Professional modes)
  // First wait for it to exist in DOM, then wait for it to be visible
  const canvas = page.locator('[data-testid="scene-canvas"]');
  await canvas.waitFor({ state: 'attached', timeout: 15000 });
  await canvas.waitFor({ state: 'visible', timeout: 10000 });

  const bounds = await canvas.boundingBox();
  if (!bounds) {
    throw new Error('Canvas not found or not visible');
  }

  const clickX = bounds.width * relativeX;
  const clickY = bounds.height * relativeY;

  // Click without force - let Playwright verify actionability
  await canvas.click({
    position: { x: clickX, y: clickY },
    timeout: 5000,
    noWaitAfter: true,
  });

  // Wait briefly for click to register
  await pause(300);
}

/**
 * Get the total number of piping nodes from the UI
 * Reads from the Nodes list in the Network tab
 */
export async function getNodeCount(page: Page): Promise<number> {
  // Switch to Network tab if not already there
  const networkButton = page.getByRole('button', { name: /^Network$/i });
  await expect(networkButton).toBeVisible();
  await networkButton.click();

  // Wait for tab to be active/visible
  await page.waitForTimeout(100);

  // Look for node list items
  // Assuming nodes are in a list with identifiable structure
  // This may need adjustment based on actual DOM structure
  const nodeListItems = page.locator('[data-testid="piping-panel"] >> text=/Node/');
  return await nodeListItems.count();
}

/**
 * Get a node's elevation (Y position) from the inspector
 * @param nodeIndex - Index of the node in the list (0-based)
 * @returns Y position in meters
 */
export async function getNodeElevation(page: Page, nodeIndex: number = 0): Promise<number> {
  // Switch to Network tab
  const networkButton = page.getByRole('button', { name: /^Network$/i });
  await expect(networkButton).toBeVisible();
  await networkButton.click({ noWaitAfter: true });

  // Wait for tab switch to complete
  await pause(500);

  // Wait for at least one node to appear in the list
  const nodeItems = page.locator('[data-testid="piping-node-item"]');
  await expect(nodeItems.first()).toBeVisible({ timeout: 5000 });

  const nodeCount = await nodeItems.count();
  if (nodeCount === 0) {
    throw new Error('No nodes found in the list');
  }

  if (nodeIndex >= nodeCount) {
    throw new Error(`Node index ${nodeIndex} out of range (found ${nodeCount} nodes)`);
  }

  // Click on the target node to select it
  const targetNode = nodeItems.nth(nodeIndex);
  await expect(targetNode).toBeVisible();
  await targetNode.click({ noWaitAfter: true });

  // Wait for selection to register
  await pause(500);

  // Switch to Properties tab
  const propertiesButton = page.getByRole('button', { name: /^Properties$/i });
  await expect(propertiesButton).toBeVisible();
  await propertiesButton.click({ noWaitAfter: true });

  // Wait for tab switch and inspector to render
  await pause(500);

  // Read the Y position (elevation) from the inspector
  // The input displays meters, we need to convert to millimeters
  const elevationInput = page.locator('[data-testid="node-elevation-display"]');
  await expect(elevationInput).toBeVisible({ timeout: 5000 });

  const valueStr = await elevationInput.inputValue();
  if (!valueStr) {
    throw new Error('Elevation input value is empty');
  }

  const meters = parseFloat(valueStr);
  if (!Number.isFinite(meters)) {
    throw new Error(`Invalid elevation value: ${valueStr}`);
  }

  // Return elevation in meters (as displayed in input)
  return meters;
}

/**
 * Wait for the piping panel to be ready (visible and interactive)
 */
export async function waitForPipingPanelReady(page: Page): Promise<void> {
  const panel = page.locator('[data-testid="piping-panel"]');
  await expect(panel).toBeVisible({ timeout: 5000 });

  // Ensure interactive elements are ready
  const modeSelect = page.locator('[data-testid="placement-mode-select"]');
  await expect(modeSelect).toBeVisible();
}

/**
 * Check if there are validation errors displayed in the UI
 * @returns Array of error messages
 */
export async function getValidationErrors(page: Page): Promise<string[]> {
  // Look for error messages or warning indicators
  // This is a placeholder - actual implementation depends on UI structure
  const errorElements = page.locator('[data-testid="piping-panel"] >> .error, .warning');
  const count = await errorElements.count();

  if (count === 0) {
    return [];
  }

  const errors: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await errorElements.nth(i).textContent();
    if (text) {
      errors.push(text.trim());
    }
  }
  return errors;
}

/**
 * Switch to Essential mode (if not already there)
 * Based on existing routing test patterns
 */
export async function ensureEssentialMode(page: Page): Promise<void> {
  const isEssential = (await page.locator('#viewport-essential').count()) > 0;

  if (isEssential) {
    return;
  }

  // Open mode switcher and select Essential
  const modeToggle = page.locator('div.hidden.md\\:block >> button[title*="interface"]');
  await expect(modeToggle.first()).toBeVisible({ timeout: 5000 });
  await modeToggle.first().click();

  await page.waitForSelector('.keyboard-hint');

  const essentialButton = page.getByRole('button', { name: /Essential/i }).first();
  await expect(essentialButton).toBeVisible();
  await essentialButton.click();

  // Wait for Essential viewport to appear
  const viewport = page.locator('#viewport-essential');
  await expect(viewport).toBeVisible({ timeout: 5000 });
}

/**
 * Switch to Professional mode
 * Based on existing routing test patterns
 *
 * NOTE: As of 2025-11-15, the app loads directly into Professional mode by default,
 * so this function currently does nothing. Keeping the function for backward compatibility
 * and in case the default mode changes in the future.
 */
export async function ensureProfessionalMode(page: Page): Promise<void> {
  // App loads in Professional mode by default as of 2025-11-15
  // Just wait a moment for the UI to be ready
  await page.waitForTimeout(500);
}

/**
 * Assert that a value is close to expected (for float comparison)
 * @param actual - Actual value
 * @param expected - Expected value
 * @param epsilon - Tolerance (default 0.01)
 */
export function assertCloseToExpected(actual: number, expected: number, epsilon = 0.01): void {
  const diff = Math.abs(actual - expected);

  if (diff > epsilon) {
    throw new Error(
      `Expected ${actual} to be close to ${expected} (within ${epsilon}), but diff was ${diff}`
    );
  }
}

/**
 * Wait for scene to be ready (SceneManager initialized)
 * Uses window.sceneManager as indicator
 */
export async function waitForSceneReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      return (window as any).sceneManager !== undefined;
    },
    { timeout: 10000 }
  );

  // Additional check: ensure scene is actually rendering
  await page.waitForFunction(
    () => {
      const manager = (window as any).sceneManager;
      return manager && manager.scene && manager.scene.isReady();
    },
    { timeout: 5000 }
  );
}
