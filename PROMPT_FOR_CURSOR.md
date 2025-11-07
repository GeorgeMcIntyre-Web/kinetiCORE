# CURSOR: Integrate Debug Labels into Routing Engine

**Branch:** `feature/smart-routing-system`
**Time:** 30-45 minutes
**Status:** All code ready, needs integration

---

## 🎯 Your Task

Add a toggle button to the Professional mode toolbar that enables/disables the 3D debug labels for routes.

**What's Already Done:**
- ✅ `RouteDebugLabels.ts` - Complete and working
- ✅ All UI polish complete (5 tasks done)
- ✅ All geometry generators ready

**What You Need to Do:**
Add debug label toggle to routing toolbar + keyboard shortcut

---

## Step 1: Add State Management (5 min)

**File:** `src/ui/layouts/ProfessionalModeLayout.tsx`

**1. Import RouteDebugLabels:**
```tsx
import { RouteDebugLabels } from '../../routing/ui/RouteDebugLabels';
```

**2. Import Eye icons:**
```tsx
import { Eye, EyeOff } from 'lucide-react';
```

**3. Add state and ref at top of component:**
```tsx
const [showDebugLabels, setShowDebugLabels] = useState(false);
const debugLabelsRef = useRef<RouteDebugLabels | null>(null);
```

**4. Initialize debug labels in useEffect:**
```tsx
useEffect(() => {
  if (scene) {
    debugLabelsRef.current = new RouteDebugLabels(scene);
  }
  return () => {
    debugLabelsRef.current?.clearAll();
  };
}, [scene]);
```

---

## Step 2: Add Toggle Button to Toolbar (10 min)

**File:** `src/ui/layouts/ProfessionalModeLayout.tsx`

**Find the Routing category in ribbon** (around line 320-350)

**Add button after existing routing buttons:**
```tsx
{/* Debug Labels Toggle */}
<button
  className={`tool-btn ${showDebugLabels ? 'active' : ''}`}
  onClick={() => {
    const newState = !showDebugLabels;
    setShowDebugLabels(newState);
    debugLabelsRef.current?.setVisible(newState);
  }}
  title="Toggle Route Debug Labels (D)"
>
  {showDebugLabels ? <Eye size={20} /> : <EyeOff size={20} />}
  <span className="tool-btn-label">Labels</span>
</button>
```

---

## Step 3: Hook into Route Creation (10 min)

**File:** Find where routes are created (likely in routing store or routing engine)

**When route geometry is generated, create label:**
```tsx
// After generating route geometry
const mesh = generator.generate(route);

// Create debug label if enabled
if (debugLabelsRef.current && showDebugLabels) {
  // Get specifications from route
  const specifications = getRouteSpecifications(route); // Your API here

  debugLabelsRef.current.createRouteLabel(route, mesh, specifications);
}
```

**When route is updated:**
```tsx
// After route update
if (debugLabelsRef.current && showDebugLabels) {
  debugLabelsRef.current.updateLabel(route);
}
```

**When route is deleted:**
```tsx
// Before deleting route
if (debugLabelsRef.current) {
  debugLabelsRef.current.removeLabel(route.getId());
}
```

---

## Step 4: Add Keyboard Shortcut (5 min)

**File:** `src/ui/layouts/ProfessionalModeLayout.tsx`

**Add keyboard handler in useEffect:**
```tsx
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'd' || e.key === 'D') {
      const newState = !showDebugLabels;
      setShowDebugLabels(newState);
      debugLabelsRef.current?.setVisible(newState);
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [showDebugLabels]);
```

---

## Step 5: Test (10 min)

**Manual Test:**
1. Start dev server: `npm run dev`
2. Switch to Professional mode
3. Create a route and generate geometry
4. Click "Labels" button → label appears above route
5. Click "Labels" again → label disappears
6. Press 'D' key → label toggles

**Expected Result:**
- Button shows Eye icon when active (cyan border)
- Button shows EyeOff icon when inactive
- Labels float above route meshes
- Labels show route type, specs, length, status
- Keyboard shortcut works

---

## Step 6: Styling (Optional - 5 min)

**If button needs better styling, update CSS:**

**File:** `src/ui/layouts/ProfessionalModeLayout.css`

```css
.tool-btn.active svg {
  color: var(--kc-accent, #00D9FF);
}

.tool-btn-label {
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  margin-top: 4px;
}
```

---

## ✅ Success Criteria

- [ ] "Labels" button appears in Routing category
- [ ] Button toggles on/off (active state with cyan)
- [ ] Labels appear/disappear when toggled
- [ ] Keyboard shortcut 'D' works
- [ ] Labels show correct information for each route type
- [ ] No TypeScript errors
- [ ] No console errors

---

## 🔧 Troubleshooting

**Issue: Labels not appearing**
```tsx
// Check in browser console:
debugLabelsRef.current?.getStatistics()
// Should show: { totalLabels: N, visibleLabels: N }
```

**Issue: TypeScript error on RouteDebugLabels**
```tsx
// Make sure import path is correct:
import { RouteDebugLabels } from '../../routing/ui/RouteDebugLabels';
```

**Issue: Button not showing active state**
```tsx
// Verify state is updating:
console.log('Debug labels enabled:', showDebugLabels);
```

---

## 📝 Commit When Done

```bash
git add src/ui/layouts/ProfessionalModeLayout.tsx
git commit -m "feat(routing): add debug labels toggle to Professional mode toolbar

- Added Eye/EyeOff icon button to routing category
- Toggle visibility with button click or 'D' keyboard shortcut
- Labels show route specs, length, segments, and validation status
- Integrated with RouteDebugLabels system"
```

---

**Estimated Time:** 30-45 minutes
**Priority:** HIGH - Last step before testing
**Ready to start!** 🚀
