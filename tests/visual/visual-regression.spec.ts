/**
 * Visual Regression Tests using Playwright
 * 
 * These tests capture screenshots and compare them against baselines
 * to detect unintended visual changes.
 */

import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');
    
    // Wait for app to be ready
    await page.waitForSelector('[data-testid="scene-canvas"]', { timeout: 10000 });
  });

  test('homepage renders correctly', async ({ page }) => {
    // Wait for scene to load
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('3D scene renders correctly', async ({ page }) => {
    // Wait for 3D scene to initialize
    await page.waitForTimeout(3000);
    
    const canvas = page.locator('[data-testid="scene-canvas"]');
    await expect(canvas).toBeVisible();
    
    // Take screenshot of canvas
    await expect(canvas).toHaveScreenshot('scene-canvas.png', {
      animations: 'disabled',
    });
  });

  test('performance monitor displays correctly', async ({ page }) => {
    // Enable performance monitor with debug flag
    await page.goto('http://localhost:5173/?debug=true');
    
    // Wait for performance monitor to appear
    await page.waitForSelector('text=Performance', { timeout: 5000 });
    
    // Take screenshot
    await expect(page).toHaveScreenshot('performance-monitor.png', {
      animations: 'disabled',
    });
  });

  test('floating panels render correctly', async ({ page }) => {
    // Open a floating panel
    await page.click('[data-testid="open-kinematics-panel"]');
    
    // Wait for panel to appear
    await page.waitForSelector('[data-testid="kinematics-panel"]');
    
    // Take screenshot
    await expect(page).toHaveScreenshot('floating-panel.png', {
      animations: 'disabled',
    });
  });

  test('robot model renders correctly', async ({ page }) => {
    // Load a robot
    await page.click('[data-testid="load-robot-button"]');
    await page.selectOption('[data-testid="robot-select"]', 'kr270');
    await page.click('[data-testid="confirm-load"]');
    
    // Wait for robot to load
    await page.waitForTimeout(3000);
    
    // Take screenshot
    const canvas = page.locator('[data-testid="scene-canvas"]');
    await expect(canvas).toHaveScreenshot('robot-loaded.png', {
      animations: 'disabled',
    });
  });

  test('IK gizmo renders correctly', async ({ page }) => {
    // Assume robot is loaded
    await page.click('[data-testid="load-robot-button"]');
    await page.waitForTimeout(2000);
    
    // Enable IK mode
    await page.click('[data-testid="enable-ik-mode"]');
    
    // Wait for gizmo to appear
    await page.waitForTimeout(1000);
    
    // Take screenshot
    const canvas = page.locator('[data-testid="scene-canvas"]');
    await expect(canvas).toHaveScreenshot('ik-gizmo.png', {
      animations: 'disabled',
    });
  });

  test('transforms panel displays correctly', async ({ page }) => {
    // Select an object
    await page.click('[data-testid="scene-canvas"]', { position: { x: 400, y: 300 } });
    
    // Wait for transforms panel
    await page.waitForSelector('[data-testid="transform-panel"]');
    
    // Take screenshot
    await expect(page).toHaveScreenshot('transform-panel.png', {
      animations: 'disabled',
    });
  });

  test('dark mode renders correctly', async ({ page }) => {
    // Toggle dark mode
    await page.click('[data-testid="theme-toggle"]');
    
    // Wait for theme to apply
    await page.waitForTimeout(500);
    
    // Take screenshot
    await expect(page).toHaveScreenshot('dark-mode.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('responsive layout on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Wait for layout to adjust
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await expect(page).toHaveScreenshot('mobile-layout.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('responsive layout on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Wait for layout to adjust
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await expect(page).toHaveScreenshot('tablet-layout.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('UI Component Visual Tests', () => {
  test('all buttons render consistently', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Navigate to component showcase (if it exists)
    // or render a test page with all buttons
    
    await expect(page).toHaveScreenshot('all-buttons.png', {
      animations: 'disabled',
    });
  });

  test('all icons render consistently', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Test icon rendering
    await expect(page).toHaveScreenshot('all-icons.png', {
      animations: 'disabled',
    });
  });

  test('form inputs render consistently', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Open a form
    await page.click('[data-testid="settings-button"]');
    
    // Wait for form to appear
    await page.waitForSelector('[data-testid="settings-form"]');
    
    await expect(page).toHaveScreenshot('form-inputs.png', {
      animations: 'disabled',
    });
  });
});
