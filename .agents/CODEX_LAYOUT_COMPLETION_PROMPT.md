# Codex Task: Complete Frontend Layout for Smart Routing Feature

**Branch:** `feature/smart-routing-system`
**Estimated Time:** 2-3 hours
**Priority:** HIGH
**Status:** TypeScript/ESLint errors fixed ✅ - Ready for UI polish

---

## 🎯 Objective

Polish and complete the frontend layouts for the smart routing feature. All backend routing logic is functional. Focus on visual refinement, UX consistency, and design token integration.

---

## 📋 Task List (5 Tasks)

### Task 1: ExpertModeLayout Quad Viewport Polish ⭐ HIGH PRIORITY

**File to Edit:** `src/ui/layouts/ExpertModeLayout.tsx` (lines 293-317)
**CSS File:** `src/ui/layouts/ExpertModeLayout.css`

**Current Issue:**
The quad viewport shows placeholder divs instead of proper CAD-style viewport borders and controls.

**Required Changes:**

1. **Replace placeholder viewports with proper CAD styling:**
```tsx
// Current (lines 293-317):
<div className="viewport-placeholder">Top</div>

// Change to:
<div className="viewport-content" ref={topViewportRef}>
  <div className="viewport-axis-helper">
    {/* Add grid overlay */}
    <div className="grid-overlay"></div>
    {/* Add axis indicator (X/Y for Top, etc.) */}
    <div className="axis-indicator">
      <span className="axis-x">X</span>
      <span className="axis-y">Y</span>
    </div>
  </div>
</div>
```

2. **Update CSS (`ExpertModeLayout.css`):**
```css
.viewport-content {
  position: relative;
  background: #1a1a1a;
  border: 2px solid #333;
  border-radius: 4px;
  overflow: hidden;
}

.viewport-content.active {
  border-color: var(--kc-accent, #00D9FF);
  box-shadow: 0 0 8px rgba(0, 217, 255, 0.3);
}

.viewport-label {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
  z-index: 10;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(0deg, rgba(255,255,255,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
}

.axis-indicator {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  gap: 12px;
  font-size: 14px;
  font-weight: 700;
}

.axis-indicator .axis-x { color: #ff4444; }
.axis-indicator .axis-y { color: #44ff44; }
.axis-indicator .axis-z { color: #4444ff; }
```

3. **Add active viewport state tracking:**
```tsx
const [activeViewport, setActiveViewport] = useState<'top' | 'front' | 'right' | 'perspective'>('perspective');

// Add onClick to each viewport:
<div
  className={`viewport-quad ${activeViewport === 'top' ? 'active' : ''}`}
  onClick={() => setActiveViewport('top')}
>
```

---

### Task 2: Professional Mode Ribbon Toolbar Refinement ⭐ MEDIUM PRIORITY

**File to Edit:** `src/ui/layouts/ProfessionalModeLayout.tsx` (lines 210-423)
**CSS File:** `src/ui/layouts/ProfessionalModeLayout.css`

**Current Issue:**
Ribbon toolbar has inconsistent button sizes and spacing. Hover states need improvement.

**Required Changes:**

1. **Standardize all ribbon button styling:**

Find all instances of `<button className="ribbon-btn"` and ensure consistent structure:
```tsx
<button
  className={`ribbon-btn ${activeTool === 'measurement-distance' ? 'active' : ''}`}
  onClick={() => handleToolClick('measurement-distance')}
  title="Distance Measurement (Ctrl+M)"
>
  <Ruler size={20} />
  <span className="ribbon-btn-label">Distance</span>
</button>
```

2. **Update CSS for consistency:**
```css
.ribbon-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #e0e0e0;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 60px;
}

.ribbon-btn:hover {
  background: rgba(0, 217, 255, 0.1);
  border-color: rgba(0, 217, 255, 0.3);
}

.ribbon-btn.active {
  background: rgba(0, 217, 255, 0.2);
  border-color: var(--kc-accent, #00D9FF);
  color: var(--kc-accent, #00D9FF);
}

.ribbon-btn-label {
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.ribbon-btn svg {
  flex-shrink: 0;
}
```

3. **Add visual feedback for disabled state:**
```css
.ribbon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ribbon-btn:disabled:hover {
  background: transparent;
  border-color: transparent;
}
```

---

### Task 3: MeasurementTools Panel Enhancement ⭐ HIGH PRIORITY

**File to Edit:** `src/ui/components/MeasurementTools.tsx`
**CSS File:** `src/ui/components/MeasurementTools.css`

**Current Issue:**
Floating panel has basic styling. 3D markers need better visibility with glow effects.

**Required Changes:**

1. **Enhance 3D marker visibility (lines 102-110 and 133-142):**

Find the sphere creation code and replace with:
```typescript
// Distance measurement markers (line ~102)
const sphere = BABYLON.MeshBuilder.CreateSphere(`distance-marker-${i}`, {
  diameter: 0.04, // Slightly larger
}, scene!);
sphere.position = p;

// Create emissive material with accent color
const mat = new BABYLON.StandardMaterial(`marker-mat-${i}`, scene!);
mat.emissiveColor = BABYLON.Color3.FromHexString('#00D9FF'); // --kc-accent
mat.diffuseColor = BABYLON.Color3.FromHexString('#00D9FF');
mat.alpha = 0.9;
sphere.material = mat;

// Add glow effect
const gl = scene!.enableGlow || new BABYLON.GlowLayer("measurement-glow", scene!);
gl.addIncludedOnlyMesh(sphere);
gl.intensity = 0.8;

newHelperMeshes.push(sphere);
```

2. **Improve measurement line visibility (line ~115-125):**
```typescript
const line = BABYLON.MeshBuilder.CreateLines('distance-line', {
  points: [state.points[0], state.points[1]],
}, scene!);
line.color = BABYLON.Color3.FromHexString('#00D9FF'); // --kc-accent
line.alpha = 0.8;

// Make line thicker
const lineSystem = BABYLON.MeshBuilder.CreateTube('distance-line-tube', {
  path: [state.points[0], state.points[1]],
  radius: 0.01,
  updatable: false
}, scene!);
const lineMat = new BABYLON.StandardMaterial('line-mat', scene!);
lineMat.emissiveColor = BABYLON.Color3.FromHexString('#00D9FF');
lineMat.alpha = 0.7;
lineSystem.material = lineMat;

newHelperMeshes.push(lineSystem);
```

3. **Update CSS for better floating panel design:**

Create/update `src/ui/components/MeasurementTools.css`:
```css
.measurement-tools-panel {
  position: fixed;
  top: 50%;
  right: 24px;
  transform: translateY(-50%);
  background: rgba(26, 26, 26, 0.95);
  border: 1px solid rgba(0, 217, 255, 0.3);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5),
              0 0 32px rgba(0, 217, 255, 0.15);
  padding: 16px;
  min-width: 240px;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.measurement-result {
  margin-top: 16px;
  padding: 12px;
  background: rgba(0, 217, 255, 0.1);
  border: 1px solid rgba(0, 217, 255, 0.3);
  border-radius: 4px;
  animation: resultAppear 0.3s ease-out;
}

@keyframes resultAppear {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.measurement-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--kc-accent, #00D9FF);
  margin: 0;
}

.measurement-unit {
  font-size: 14px;
  color: #999;
  margin-left: 4px;
}

.measurement-instruction {
  font-size: 13px;
  color: #aaa;
  margin-top: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}
```

---

### Task 4: ExportDialog Visual Enhancement ⭐ MEDIUM PRIORITY

**File to Edit:** `src/ui/components/ExportDialog.tsx`
**CSS File:** `src/ui/components/ExportDialog.css`

**Current Issue:**
Basic modal with radio buttons. Needs format icons and file size estimates.

**Required Changes:**

1. **Add icons and metadata to export options (lines 26-48):**

Import icons:
```tsx
import { FileJson, Database, Package } from 'lucide-react';
```

Update `exportOptions` array:
```tsx
const exportOptions: ExportOption[] = [
  {
    format: 'basic',
    label: 'Basic World (JSON)',
    description: 'Scene tree and metadata only.',
    icon: <FileJson size={32} />,
    fileExtension: '.json',
    estimatedSize: '~500 KB',
    badge: 'Fastest'
  },
  {
    format: 'babylon',
    label: 'Babylon Scene',
    description: 'Full Babylon.js scene data.',
    icon: <Database size={32} />,
    fileExtension: '.babylon',
    estimatedSize: '~2 MB',
    badge: 'Recommended'
  },
  {
    format: 'comprehensive',
    label: 'Comprehensive',
    description: 'Everything including physics and kinematics.',
    icon: <Package size={32} />,
    fileExtension: '.kineticore',
    estimatedSize: '~5 MB',
    badge: 'Complete'
  },
];

// Update interface:
interface ExportOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode; // Add this
  fileExtension: string; // Add this
  estimatedSize: string; // Add this
  badge?: string; // Add this
}
```

2. **Update the radio button rendering to show icons:**

Replace the radio list section (~lines 78-95):
```tsx
<div className="export-format-grid">
  {exportOptions.map((option) => (
    <label
      key={option.format}
      className={`export-format-card ${selectedFormat === option.format ? 'selected' : ''}`}
    >
      <input
        type="radio"
        name="exportFormat"
        value={option.format}
        checked={selectedFormat === option.format}
        onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
      />
      <div className="format-icon">{option.icon}</div>
      <div className="format-content">
        <div className="format-header">
          <h4>{option.label}</h4>
          {option.badge && <span className="format-badge">{option.badge}</span>}
        </div>
        <p className="format-description">{option.description}</p>
        <div className="format-meta">
          <span className="format-size">{option.estimatedSize}</span>
          <span className="format-ext">{option.fileExtension}</span>
        </div>
      </div>
    </label>
  ))}
</div>
```

3. **Create enhanced CSS (`ExportDialog.css`):**
```css
.export-format-grid {
  display: grid;
  gap: 12px;
  margin: 20px 0;
}

.export-format-card {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.export-format-card:hover {
  background: rgba(0, 217, 255, 0.05);
  border-color: rgba(0, 217, 255, 0.3);
}

.export-format-card.selected {
  background: rgba(0, 217, 255, 0.1);
  border-color: var(--kc-accent, #00D9FF);
  box-shadow: 0 0 12px rgba(0, 217, 255, 0.2);
}

.export-format-card input[type="radio"] {
  position: absolute;
  opacity: 0;
}

.format-icon {
  flex-shrink: 0;
  color: #999;
  transition: color 0.2s ease;
}

.export-format-card.selected .format-icon {
  color: var(--kc-accent, #00D9FF);
}

.format-content {
  flex: 1;
}

.format-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.format-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.format-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(0, 217, 255, 0.2);
  color: var(--kc-accent, #00D9FF);
  border-radius: 12px;
  font-weight: 600;
}

.format-description {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #999;
}

.format-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
}

.format-size::before {
  content: '📦 ';
}

.format-ext {
  color: #888;
  font-family: 'Courier New', monospace;
}
```

---

### Task 5: Mode Switcher Smooth Transitions ⭐ LOW PRIORITY

**File to Edit:** `src/ui/components/Header.tsx` (lines 123-193)
**CSS Enhancement:** Add to global styles or `Header.css`

**Current Issue:**
Mode switching is instant with no transition effect.

**Required Changes:**

1. **Add transition wrapper to layout switching:**

In the parent component that switches between layouts (`src/App.tsx` or equivalent), wrap the layout component:

```tsx
// In App.tsx or main layout switcher
<div className={`layout-container mode-transition ${uiMode}`}>
  {uiMode === 'essential' && <EssentialModeLayout />}
  {uiMode === 'professional' && <ProfessionalModeLayout />}
  {uiMode === 'expert' && <ExpertModeLayout />}
</div>
```

2. **Add CSS for smooth transitions:**
```css
.layout-container {
  width: 100%;
  height: 100%;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mode-transition {
  transition: opacity 0.3s ease-in-out;
}
```

3. **Add keyboard shortcuts hint to dropdown (Header.tsx):**
```tsx
<button
  className="mode-option"
  onClick={() => handleModeSwitch('essential')}
>
  <span>Essential</span>
  <kbd className="keyboard-hint">Ctrl+1</kbd>
</button>

// Repeat for Professional (Ctrl+2) and Expert (Ctrl+3)
```

**CSS for keyboard hint:**
```css
.keyboard-hint {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  margin-left: auto;
  font-family: monospace;
}
```

---

## ✅ Testing Checklist

After completing all tasks, verify:

- [ ] **ExpertModeLayout**: Quad viewports have grid overlays and axis indicators
- [ ] **ExpertModeLayout**: Clicking a viewport highlights it with accent border
- [ ] **ProfessionalModeLayout**: All ribbon buttons have consistent size and hover states
- [ ] **ProfessionalModeLayout**: Active tool has clear visual feedback
- [ ] **MeasurementTools**: Distance markers glow with cyan color
- [ ] **MeasurementTools**: Measurement line is visible and colored
- [ ] **MeasurementTools**: Result appears with smooth animation
- [ ] **ExportDialog**: Format cards show icons and metadata
- [ ] **ExportDialog**: Selected format has accent border and glow
- [ ] **Mode Switcher**: Smooth fade animation when switching modes
- [ ] **Mode Switcher**: Keyboard shortcuts visible in dropdown
- [ ] **No TypeScript errors**: Run `npm run type-check`
- [ ] **No ESLint warnings**: Run `npm run lint`
- [ ] **No console errors**: Check browser DevTools console

---

## 🎨 Design Token Reference

**File:** `src/ui/styles/design-tokens.ts`

Use these values consistently:
- **Primary Accent:** `#00D9FF` (cyan) - Use as `var(--kc-accent, #00D9FF)`
- **Background Dark:** `#1a1a1a`
- **Border Color:** `rgba(255, 255, 255, 0.1)`
- **Hover Background:** `rgba(0, 217, 255, 0.1)`
- **Active Border:** `var(--kc-accent, #00D9FF)`

---

## 🚀 Success Criteria

When all tasks are complete:

✅ All layouts visually match professional CAD software polish
✅ Hover/active states work consistently across all components
✅ Animations are smooth (no janky transitions)
✅ 3D markers in measurement tools are clearly visible
✅ Export dialog has professional card-based UI
✅ Mode switching has smooth fade effect
✅ Design tokens used throughout (no hardcoded colors)
✅ TypeScript and ESLint checks pass
✅ No console errors or warnings

---

## 📸 Before/After Screenshots (Optional)

If possible, take screenshots:
1. Before: ExpertModeLayout quad viewports
2. After: ExpertModeLayout quad viewports with grid and axis
3. Before: MeasurementTools markers
4. After: MeasurementTools glowing markers
5. Before: ExportDialog radio list
6. After: ExportDialog card grid

Save to `docs/images/ui-polish-before-after/`

---

## 🔗 Related Files

**Layouts:**
- `src/ui/layouts/ExpertModeLayout.tsx`
- `src/ui/layouts/ExpertModeLayout.css`
- `src/ui/layouts/ProfessionalModeLayout.tsx`
- `src/ui/layouts/ProfessionalModeLayout.css`

**Components:**
- `src/ui/components/MeasurementTools.tsx`
- `src/ui/components/MeasurementTools.css`
- `src/ui/components/ExportDialog.tsx`
- `src/ui/components/ExportDialog.css`
- `src/ui/components/Header.tsx`

**Design System:**
- `src/ui/styles/design-tokens.ts`

---

## 📝 Commit Instructions

When complete, commit with:
```bash
git add .
git commit -m "feat(ui): polish layouts and components for smart routing

- Enhanced ExpertModeLayout quad viewports with grid and axis indicators
- Standardized ProfessionalModeLayout ribbon button styling
- Added glowing 3D markers to MeasurementTools
- Redesigned ExportDialog with card-based UI and metadata
- Added smooth transitions to mode switching
- Applied design tokens consistently across all components"
```

---

## 🆘 Help

If you encounter issues:
1. Check that all referenced files exist
2. Verify design tokens are imported correctly
3. Test in Chrome DevTools with responsive mode
4. Check browser console for any errors
5. Run `npm run type-check` and `npm run lint` frequently

---

**Good luck! 🚀 You got this!**
