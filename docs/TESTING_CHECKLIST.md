# Testing Checklist - kinetiCORE

## Pre-Commit Checklist

### Code Quality
- [ ] **TypeScript:** `npm run type-check` passes
- [ ] **Linting:** `npm run lint` has no errors
- [ ] **Build:** `npm run build` succeeds
- [ ] **Tests:** `npm run test` passes (when available)

### Layout & UI Changes
- [ ] **Hard refresh:** Test with `Ctrl+Shift+R` / `Cmd+Shift+R`
- [ ] **Fresh clone:** Clone to new directory and verify
- [ ] **Viewport validation:**
  ```javascript
  // Run in browser console:
  const vp = document.getElementById('viewport-essential');
  const rect = vp?.getBoundingClientRect();
  console.log('Viewport size:', rect?.width, 'x', rect?.height);
  // Should be > 800x600 for main viewport
  ```
- [ ] **Responsive:** Test at 1920px, 1280px, 768px widths
- [ ] **Multi-browser:** Chrome, Firefox, Edge

### Coordinate System (Loaders/Kinematics)
- [ ] **Z-up compliance:** Geometry loads in Z-up (CAD/ROS standard)
- [ ] **NO coordinate conversion:** Load geometry as-is
- [ ] **Unit conversion ONLY:** Use `CoordinateSystem.ts` for mm ↔ m
- [ ] **Validation:** Place test object, verify Z points up

### Physics Integration
- [ ] **No direct Rapier imports:** Use `IPhysicsEngine` interface only
- [ ] **Disposal order:** Physics bodies disposed BEFORE meshes
- [ ] **Sync validation:** Test entity position sync (mesh ↔ physics)

### Performance
- [ ] **FPS check:** 60 FPS with 50 objects in scene
- [ ] **Memory:** No leaks after create/delete cycles
- [ ] **Build size:** Check bundle analyzer for regressions
  ```bash
  npm run build
  # Check dist/assets/ sizes
  ```

---

## Browser Testing Matrix

| Feature | Chrome | Firefox | Edge | Safari |
|---------|--------|---------|------|--------|
| Essential Layout | ✓ | ✓ | ✓ | - |
| Professional Layout | ✓ | ✓ | ✓ | - |
| Expert Layout | ✓ | ✓ | ✓ | - |
| DWG Import | ✓ | ✓ | ✓ | - |
| URDF Kinematics | ✓ | ✓ | ✓ | - |
| WebGPU Rendering | ✓ | - | ✓ | - |
| WebGL2 Fallback | ✓ | ✓ | ✓ | ✓ |

---

## Issue Investigation Protocol

### Layout Issues (Viewport Size)

**Symptoms:**
- Viewport appears as small box
- Canvas doesn't fill screen
- Elements collapsed/invisible

**Debug Steps:**
1. **Check element size:**
   ```javascript
   const el = document.getElementById('viewport-essential');
   console.log('Element:', el?.getBoundingClientRect());
   ```

2. **Inspect CSS:**
   - Open DevTools → Elements → Computed tab
   - Check `flex`, `width`, `height`, `min-width`, `min-height`
   - Look for `width: 100%; height: 100%` on flex children (BAD!)

3. **Verify flex hierarchy:**
   ```javascript
   // Check parent chain
   let current = el;
   while (current) {
     console.log(current.className, {
       display: getComputedStyle(current).display,
       flex: getComputedStyle(current).flex,
       width: current.getBoundingClientRect().width,
       height: current.getBoundingClientRect().height
     });
     current = current.parentElement;
   }
   ```

4. **Clear cache:**
   - Hard refresh (`Ctrl+Shift+R`)
   - Clear browser cache
   - Restart dev server

**Common Fixes:**
```css
/* Change from: */
.viewport { flex: 1; width: 100%; height: 100%; }

/* To: */
.viewport { flex: 1; min-width: 0; min-height: 0; }
```

### Import Issues (DWG/URDF/etc)

**Symptoms:**
- File doesn't load
- Geometry appears incorrect
- Console errors

**Debug Steps:**
1. **Check file format:**
   ```javascript
   console.log('File type:', file.name.split('.').pop());
   ```

2. **Verify loader:**
   - DWG: Check WASM files in `public/wasm/`
   - URDF: Check mesh files exist in same directory
   - Check browser console for detailed errors

3. **Coordinate validation:**
   ```javascript
   // After import, check bounding box
   const bbox = mesh.getBoundingInfo().boundingBox;
   console.log('Min:', bbox.minimumWorld);
   console.log('Max:', bbox.maximumWorld);
   // Z should be vertical axis
   ```

4. **Unit scale check:**
   ```javascript
   console.log('Scale:', mesh.scaling);
   // Should be reasonable (not 0.001 or 1000)
   ```

### Physics Issues

**Symptoms:**
- Objects fall through floor
- Collision detection fails
- Performance drops

**Debug Steps:**
1. **Check physics initialized:**
   ```javascript
   const sceneManager = SceneManager.getInstance();
   const engine = sceneManager.getPhysicsEngine();
   console.log('Physics engine:', engine);
   ```

2. **Verify entity registration:**
   ```javascript
   const registry = EntityRegistry.getInstance();
   console.log('Entity count:', registry.getAllEntities().length);
   ```

3. **Inspect physics body:**
   ```javascript
   const entity = registry.getByMesh(mesh);
   console.log('Has physics:', entity?.hasPhysics());
   ```

4. **Check disposal order:**
   - Physics bodies must be disposed BEFORE meshes
   - Check for errors in console during disposal

---

## Automated Testing (Future)

### Visual Regression Tests
```typescript
describe('Layout Tests', () => {
  it('viewport should fill main content area', () => {
    const viewport = screen.getByTestId('viewport-essential');
    const rect = viewport.getBoundingClientRect();
    expect(rect.width).toBeGreaterThan(800);
    expect(rect.height).toBeGreaterThan(600);
  });
});
```

### E2E Tests (Playwright)
```typescript
test('Essential layout renders correctly', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Check viewport size
  const viewport = page.locator('#viewport-essential');
  const box = await viewport.boundingBox();
  expect(box?.width).toBeGreaterThan(800);
  expect(box?.height).toBeGreaterThan(600);

  // Check canvas exists
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
});
```

---

## Performance Benchmarks

### Target Metrics
- **Load Time:** < 3s initial load
- **FPS:** 60 FPS with 50 objects
- **Bundle Size:** < 10MB total
- **Memory:** < 500MB with typical scene

### Measurement
```javascript
// FPS counter
let frameCount = 0;
let lastTime = performance.now();

scene.onBeforeRenderObservable.add(() => {
  frameCount++;
  const now = performance.now();
  if (now - lastTime > 1000) {
    console.log('FPS:', frameCount);
    frameCount = 0;
    lastTime = now;
  }
});

// Memory usage
console.log('Memory:', performance.memory);
```

---

**Last Updated:** October 2025
**Maintainer:** George (Architecture Lead)
