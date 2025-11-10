// Playwright performance tests for snap queries
// Owner: George
// Validates snap system meets performance budgets

import { test, expect } from '@playwright/test';

// Performance thresholds (milliseconds)
const THRESHOLDS = {
  primitiveAvg: 1.0,   // Simple box/sphere: <1ms average
  robotAvg: 4.0,       // Robot model: <4ms average
  maxLongTask: 16.0,   // No single query >16ms (1 frame @ 60fps)
  maxP99: 8.0,         // 99th percentile <8ms
};

test.describe('Snap Performance', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');

    // Wait for scene to load
    await page.waitForSelector('canvas', { timeout: 10000 });

    // Give Babylon.js time to initialize
    await page.waitForTimeout(2000);
  });

  test('primitive snap queries meet <1ms budget', async ({ page }) => {
    // Load simple primitives
    await page.evaluate(() => {
      const sceneManager = (window as any).sceneManager;
      const scene = sceneManager?.getScene();
      if (!scene) throw new Error('Scene not initialized');

      // Create test objects
      const BABYLON = (window as any).BABYLON;
      BABYLON.MeshBuilder.CreateBox('testBox1', { size: 1 }, scene);
      BABYLON.MeshBuilder.CreateSphere('testSphere1', { diameter: 1 }, scene);
      BABYLON.MeshBuilder.CreateCylinder('testCyl1', { height: 2, diameter: 0.5 }, scene);
    });

    // Wait for objects to be created
    await page.waitForTimeout(500);

    // Run snap queries and measure performance
    const results = await page.evaluate(async () => {
      const sceneManager = (window as any).sceneManager;
      const scene = sceneManager?.getScene();
      const SnapQueryEngine = (window as any).SnapQueryEngine; // Needs to be exposed

      if (!scene || !SnapQueryEngine) {
        throw new Error('Scene or SnapQueryEngine not available');
      }

      const engine = new SnapQueryEngine();
      const queryTimes: number[] = [];

      // Run 50 queries at different positions
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * 2 - 1;
        const y = Math.random() * 2 - 1;
        const z = Math.random() * 2 - 1;

        const result = await engine.query(scene, {
          position: { x, y, z },
          maxDistance: 0.1, // 100mm
          budgetPerMesh: 4, // 4ms per mesh
          excludeMeshIds: [],
        });

        queryTimes.push(result.queryTimeMs);
      }

      engine.dispose();

      const avg = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      const max = Math.max(...queryTimes);
      const sorted = [...queryTimes].sort((a, b) => a - b);
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      return { avg, max, p99, queryTimes };
    });

    console.log(`Primitive snap performance: avg=${results.avg.toFixed(3)}ms, max=${results.max.toFixed(3)}ms, p99=${results.p99.toFixed(3)}ms`);

    // Assertions
    expect(results.avg).toBeLessThan(THRESHOLDS.primitiveAvg);
    expect(results.max).toBeLessThan(THRESHOLDS.maxLongTask);
    expect(results.p99).toBeLessThan(THRESHOLDS.maxP99);
  });

  test('robot model snap queries meet <4ms budget', async ({ page }) => {
    // This test requires a test robot GLB in public/test-assets/
    const hasRobotModel = await page.evaluate(() => {
      return fetch('/test-assets/robot-arm.glb', { method: 'HEAD' })
        .then((res) => res.ok)
        .catch(() => false);
    });

    if (!hasRobotModel) {
      test.skip();
      return;
    }

    // Load robot model
    await page.evaluate(async () => {
      const sceneManager = (window as any).sceneManager;
      await sceneManager.loadGLB('/test-assets/robot-arm.glb');
    });

    // Wait for model to load
    await page.waitForTimeout(2000);

    // Run snap queries
    const results = await page.evaluate(async () => {
      const sceneManager = (window as any).sceneManager;
      const scene = sceneManager?.getScene();
      const SnapQueryEngine = (window as any).SnapQueryEngine;

      if (!scene || !SnapQueryEngine) {
        throw new Error('Scene or SnapQueryEngine not available');
      }

      const engine = new SnapQueryEngine();
      const queryTimes: number[] = [];
      const degradedCount = { value: 0 };

      // Run 30 queries around robot
      for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * Math.PI * 2;
        const radius = 0.5;
        const x = Math.cos(angle) * radius;
        const y = 0.5;
        const z = Math.sin(angle) * radius;

        const result = await engine.query(scene, {
          position: { x, y, z },
          maxDistance: 0.05, // 50mm
          budgetPerMesh: 4,
          excludeMeshIds: [],
        });

        queryTimes.push(result.queryTimeMs);
        if (result.degraded) degradedCount.value++;
      }

      engine.dispose();

      const avg = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      const max = Math.max(...queryTimes);
      const sorted = [...queryTimes].sort((a, b) => a - b);
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      return { avg, max, p99, degradedCount: degradedCount.value, queryTimes };
    });

    console.log(`Robot snap performance: avg=${results.avg.toFixed(3)}ms, max=${results.max.toFixed(3)}ms, p99=${results.p99.toFixed(3)}ms, degraded=${results.degradedCount}/30`);

    // Assertions
    expect(results.avg).toBeLessThan(THRESHOLDS.robotAvg);
    expect(results.max).toBeLessThan(THRESHOLDS.maxLongTask);
    expect(results.p99).toBeLessThan(THRESHOLDS.maxP99);

    // Allow some degraded queries for complex models, but not too many
    expect(results.degradedCount).toBeLessThan(10); // <33% degraded
  });

  test('snap queries do not cause main thread freeze', async ({ page }) => {
    // Monitor long tasks during snap queries
    await page.evaluate(() => {
      (window as any).longTasks = [];

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).longTasks.push(entry.duration);
        }
      });

      try {
        observer.observe({ entryTypes: ['longtask'] });
      } catch {
        console.warn('Long task API not available');
      }
    });

    // Create complex scene
    await page.evaluate(() => {
      const sceneManager = (window as any).sceneManager;
      const scene = sceneManager?.getScene();
      const BABYLON = (window as any).BABYLON;

      // Create 20 objects
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * 4 - 2;
        const y = Math.random() * 4 - 2;
        const z = Math.random() * 4 - 2;

        const mesh = BABYLON.MeshBuilder.CreateBox(`box${i}`, { size: 0.5 }, scene);
        mesh.position = new BABYLON.Vector3(x, y, z);
      }
    });

    await page.waitForTimeout(500);

    // Run many snap queries
    await page.evaluate(async () => {
      const sceneManager = (window as any).sceneManager;
      const scene = sceneManager?.getScene();
      const SnapQueryEngine = (window as any).SnapQueryEngine;

      if (!scene || !SnapQueryEngine) return;

      const engine = new SnapQueryEngine();

      for (let i = 0; i < 100; i++) {
        await engine.query(scene, {
          position: { x: 0, y: 0, z: 0 },
          maxDistance: 0.1,
          budgetPerMesh: 4,
          excludeMeshIds: [],
        });
      }

      engine.dispose();
    });

    // Check for long tasks
    const longTasks = await page.evaluate(() => (window as any).longTasks);

    console.log(`Long tasks detected: ${longTasks?.length || 0}`);

    // Should have no long tasks >50ms (these cause visible jank)
    const severeTasks = (longTasks || []).filter((duration: number) => duration > 50);
    expect(severeTasks.length).toBe(0);
  });

  test('telemetry tracking works correctly', async ({ page }) => {
    await page.evaluate(() => {
      const BABYLON = (window as any).BABYLON;
      const sceneManager = (window as any).sceneManager;
      const scene = sceneManager?.getScene();

      BABYLON.MeshBuilder.CreateBox('testBox', { size: 1 }, scene);
    });

    await page.waitForTimeout(500);

    const telemetry = await page.evaluate(async () => {
      const sceneManager = (window as any).sceneManager;
      const scene = sceneManager?.getScene();
      const SnapQueryEngine = (window as any).SnapQueryEngine;

      if (!scene || !SnapQueryEngine) {
        throw new Error('Not available');
      }

      const engine = new SnapQueryEngine();

      // Run 10 queries
      for (let i = 0; i < 10; i++) {
        await engine.query(scene, {
          position: { x: 0, y: 0, z: 0 },
          maxDistance: 0.1,
          budgetPerMesh: 4,
          excludeMeshIds: [],
        });
      }

      const telemetry = engine.getTelemetry();
      engine.dispose();

      return telemetry;
    });

    // Verify telemetry
    expect(telemetry.totalQueries).toBe(10);
    expect(telemetry.avgQueryTimeMs).toBeGreaterThan(0);
    expect(telemetry.p99QueryTimeMs).toBeGreaterThan(0);
    expect(telemetry.avgCandidateCount).toBeGreaterThanOrEqual(0);
  });
});
