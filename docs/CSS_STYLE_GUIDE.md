# CSS Style Guide - kinetiCORE

## Critical Layout Rules

### ❌ NEVER DO THIS

**1. Percentage dimensions on flex children:**
```css
/* BAD - Will cause collapse on empty elements */
.flex-child {
  flex: 1;
  width: 100%;
  height: 100%;
}
```

**2. Missing min-dimensions on flex containers:**
```css
/* BAD - Can cause overflow issues */
.flex-child {
  flex: 1;
  /* Missing min-width: 0 */
}
```

### ✅ ALWAYS DO THIS

**1. Proper flex child sizing:**
```css
/* GOOD - Allows proper expansion/shrinking */
.flex-child {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
```

**2. Explicit dimensions for fixed-size elements:**
```css
/* GOOD - Fixed sidebar */
.sidebar {
  width: 320px;
  flex-shrink: 0;
}
```

**3. Container hierarchy:**
```css
/* Parent (full viewport) */
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* Header (fixed height) */
.header {
  height: 60px;
  flex-shrink: 0;
}

/* Main content (fills remaining) */
.content {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* Viewport area (fills content) */
.viewport {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
}
```

## Coordinate System Rules

### Z-up Standard
- kinetiCORE uses **Z-up** coordinate system (CAD/ROS standard)
- When adding loaders: Load geometry **as-is**, NO coordinate conversion
- **Unit conversion ONLY:** Use `CoordinateSystem.ts` for mm ↔ m conversion
- See `COORDINATE_SYSTEM.md` for full details

## Common Layout Patterns

### Full-Screen Canvas Overlay
```css
/* Positioning container (in flex layout) */
.viewport-container {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
}

/* Fixed overlay canvas (positioned by JS) */
.canvas-overlay {
  position: fixed;
  pointer-events: auto;
  /* Dimensions set via getBoundingClientRect() */
}
```

### Sidebar + Main Content
```css
.layout {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 320px;
  flex-shrink: 0;
  overflow-y: auto;
}

.main {
  flex: 1;
  min-width: 0;
  position: relative;
}
```

### Responsive Breakpoints
```css
/* Mobile first */
.sidebar {
  width: 100%;
}

/* Tablet and up */
@media (min-width: 768px) {
  .sidebar {
    width: 320px;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .sidebar {
    width: 360px;
  }
}
```

## Testing Requirements

### Before Committing Layout Changes

1. **Visual Testing:**
   - [ ] Hard refresh browser (`Ctrl+Shift+R`)
   - [ ] Test in Chrome, Firefox, Edge
   - [ ] Check responsive breakpoints (mobile, tablet, desktop)
   - [ ] Verify canvas/viewport fills intended area

2. **DevTools Inspection:**
   ```javascript
   // In browser console:
   const viewport = document.getElementById('viewport-essential');
   console.log(viewport.getBoundingClientRect());
   // width/height should be > 800x600 for main viewport
   ```

3. **Fresh Clone Test:**
   - [ ] Clone repo to new directory
   - [ ] Run `npm install && npm run dev`
   - [ ] Verify layout works on first load

4. **Build Verification:**
   ```bash
   npm run build
   npm run preview
   # Test production build
   ```

## Common Pitfalls

### Issue: Empty Flex Child Collapses
**Symptom:** Element appears tiny despite `flex: 1`

**Cause:** Using `width: 100%; height: 100%` on empty flex child

**Fix:**
```css
/* Change from: */
.viewport { flex: 1; width: 100%; height: 100%; }

/* To: */
.viewport { flex: 1; min-width: 0; min-height: 0; }
```

### Issue: Canvas Doesn't Fill Viewport
**Symptom:** 3D canvas is small box in corner

**Root Causes:**
1. Viewport container collapsed (see above)
2. SceneCanvas positioning logic broken
3. Browser cache showing old CSS

**Debug Steps:**
```javascript
// 1. Check viewport size
const viewport = document.getElementById('viewport-essential');
console.log('Viewport rect:', viewport.getBoundingClientRect());

// 2. Check canvas size
const canvas = document.querySelector('canvas');
console.log('Canvas rect:', canvas.getBoundingClientRect());

// 3. Should match (or be close)
```

### Issue: Flex Container Not Expanding
**Symptom:** Parent container doesn't fill screen

**Causes:**
- Missing `height: 100vh` on root
- Missing `flex: 1` on intermediate containers
- Parent has `overflow: auto` instead of `overflow: hidden`

**Fix:**
```css
.root { height: 100vh; display: flex; flex-direction: column; }
.content { flex: 1; overflow: hidden; }
.viewport { flex: 1; min-height: 0; }
```

## Performance Best Practices

1. **Avoid Layout Thrashing:**
   - Batch DOM reads/writes
   - Use `requestAnimationFrame` for position updates
   - Cache `getBoundingClientRect()` results

2. **Use CSS Containment:**
   ```css
   .sidebar {
     contain: layout style;
   }
   ```

3. **Optimize Repaints:**
   ```css
   .canvas-overlay {
     will-change: transform;
     transform: translateZ(0); /* Force GPU layer */
   }
   ```

## Accessibility

1. **Semantic HTML:**
   ```tsx
   <main id="viewport-essential" className="viewport" />
   <aside className="sidebar" />
   ```

2. **Skip Links:**
   ```tsx
   <a href="#main-content" className="skip-link">Skip to content</a>
   ```

3. **Keyboard Navigation:**
   - Ensure all interactive elements are keyboard accessible
   - Test tab order flows logically

## Resources

- **Project Docs:**
  - `COORDINATE_SYSTEM.md` - Z-up coordinate standard
  - `CLAUDE.md` - AI tool context
  - `README.md` - Project overview

- **External:**
  - [CSS Flexbox Guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
  - [MDN: Using CSS Flexible Boxes](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Flexible_Box_Layout)
  - [Understanding min-width/min-height in Flexbox](https://www.w3.org/TR/css-flexbox-1/#min-size-auto)

---

**Last Updated:** October 2025
**Maintainer:** George (Architecture Lead)
