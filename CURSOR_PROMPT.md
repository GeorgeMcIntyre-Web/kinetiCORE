# CURSOR/CODEX: Complete Frontend Layout - Smart Routing Feature

**Branch:** `feature/smart-routing-system`
**Time:** 2-3 hours | **Priority:** HIGH
**Status:** ✅ All backend code complete, TypeScript/ESLint passing

---

## 🎯 Your Mission

Complete 5 frontend layout polish tasks. All backend routing logic works. Focus on visual refinement and UX consistency.

**Design Token:** Use `#00D9FF` (cyan) as accent color throughout

---

## Task 1: ExpertModeLayout Quad Viewports (45 min) ⭐ START HERE

**File:** `src/ui/layouts/ExpertModeLayout.tsx` (lines 293-317)

### What to Do:
Replace placeholder divs with CAD-style viewports with grid overlays and axis indicators.

### Code Changes:

**1. Add viewport refs and state at top of component:**
```tsx
const topViewportRef = useRef<HTMLDivElement>(null);
const frontViewportRef = useRef<HTMLDivElement>(null);
const rightViewportRef = useRef<HTMLDivElement>(null);
const perspViewportRef = useRef<HTMLDivElement>(null);
const [activeViewport, setActiveViewport] = useState<'top' | 'front' | 'right' | 'perspective'>('perspective');
```

**2. Replace each viewport-quad div (lines 293-317):**
```tsx
{/* Top View */}
<div
  className={`viewport-quad ${activeViewport === 'top' ? 'active' : ''}`}
  onClick={() => setActiveViewport('top')}
>
  <div className="viewport-label">Top View (Z)</div>
  <div className="viewport-content" ref={topViewportRef}>
    <div className="grid-overlay"></div>
    <div className="axis-indicator">
      <span className="axis-x">X</span>
      <span className="axis-y">Y</span>
    </div>
  </div>
</div>

{/* Front View */}
<div
  className={`viewport-quad ${activeViewport === 'front' ? 'active' : ''}`}
  onClick={() => setActiveViewport('front')}
>
  <div className="viewport-label">Front View (X)</div>
  <div className="viewport-content" ref={frontViewportRef}>
    <div className="grid-overlay"></div>
    <div className="axis-indicator">
      <span className="axis-y">Y</span>
      <span className="axis-z">Z</span>
    </div>
  </div>
</div>

{/* Right View */}
<div
  className={`viewport-quad ${activeViewport === 'right' ? 'active' : ''}`}
  onClick={() => setActiveViewport('right')}
>
  <div className="viewport-label">Right View (Y)</div>
  <div className="viewport-content" ref={rightViewportRef}>
    <div className="grid-overlay"></div>
    <div className="axis-indicator">
      <span className="axis-x">X</span>
      <span className="axis-z">Z</span>
    </div>
  </div>
</div>

{/* Perspective View */}
<div
  className={`viewport-quad ${activeViewport === 'perspective' ? 'active' : ''}`}
  onClick={() => setActiveViewport('perspective')}
>
  <div className="viewport-label">Perspective</div>
  <div className="viewport-content" ref={perspViewportRef}>
    <div className="grid-overlay"></div>
    <div className="axis-indicator">
      <span className="axis-x">X</span>
      <span className="axis-y">Y</span>
      <span className="axis-z">Z</span>
    </div>
  </div>
</div>
```

**3. Add CSS to `src/ui/layouts/ExpertModeLayout.css`:**
```css
.viewport-quad {
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
}

.viewport-quad.active .viewport-content {
  border-color: #00D9FF;
  box-shadow: 0 0 8px rgba(0, 217, 255, 0.3);
}

.viewport-content {
  position: relative;
  background: #1a1a1a;
  border: 2px solid #333;
  border-radius: 4px;
  overflow: hidden;
  height: 100%;
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
  pointer-events: none;
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
  pointer-events: none;
}

.axis-indicator .axis-x { color: #ff4444; }
.axis-indicator .axis-y { color: #44ff44; }
.axis-indicator .axis-z { color: #4444ff; }
```

✅ **Test:** Click each viewport - should highlight with cyan border

---

## Task 2: Professional Ribbon Toolbar (30 min)

**File:** `src/ui/layouts/ProfessionalModeLayout.tsx` (lines 210-423)

### What to Do:
Standardize all ribbon button styling for consistency.

### Code Changes:

**1. Find ALL `<button className="ribbon-btn"` and ensure this structure:**
```tsx
<button
  className={`ribbon-btn ${activeTool === 'tool-name' ? 'active' : ''}`}
  onClick={() => handleToolClick('tool-name')}
  title="Tool Name (Shortcut)"
>
  <IconName size={20} />
  <span className="ribbon-btn-label">Label</span>
</button>
```

**2. Add/update CSS in `src/ui/layouts/ProfessionalModeLayout.css`:**
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
  border-color: #00D9FF;
  color: #00D9FF;
}

.ribbon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ribbon-btn:disabled:hover {
  background: transparent;
  border-color: transparent;
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

✅ **Test:** Hover buttons - should show cyan background, active tool has cyan border

---

## Task 3: MeasurementTools Glow Effects (45 min) ⭐ IMPORTANT

**File:** `src/ui/components/MeasurementTools.tsx`

### What to Do:
Add glowing 3D markers and better floating panel design.

### Code Changes:

**1. Distance markers (around line 102-110):**
```typescript
// Find the distance measurement sphere creation
const sphere = BABYLON.MeshBuilder.CreateSphere(`distance-marker-${i}`, {
  diameter: 0.04,
}, scene!);
sphere.position = p;

// Create emissive cyan material
const mat = new BABYLON.StandardMaterial(`marker-mat-${i}`, scene!);
mat.emissiveColor = BABYLON.Color3.FromHexString('#00D9FF');
mat.diffuseColor = BABYLON.Color3.FromHexString('#00D9FF');
mat.alpha = 0.9;
sphere.material = mat;

// Add glow layer
if (!scene!.getGlowLayerByName('measurement-glow')) {
  const gl = new BABYLON.GlowLayer('measurement-glow', scene!);
  gl.intensity = 0.8;
}
const glowLayer = scene!.getGlowLayerByName('measurement-glow') as BABYLON.GlowLayer;
glowLayer.addIncludedOnlyMesh(sphere);

newHelperMeshes.push(sphere);
```

**2. Angle markers (around line 133-142) - same pattern:**
```typescript
const sphere = BABYLON.MeshBuilder.CreateSphere(`angle-marker-${i}`, {
  diameter: 0.04,
}, scene!);
sphere.position = p;

const mat = new BABYLON.StandardMaterial(`angle-marker-mat-${i}`, scene!);
mat.emissiveColor = BABYLON.Color3.FromHexString('#00D9FF');
mat.diffuseColor = BABYLON.Color3.FromHexString('#00D9FF');
mat.alpha = 0.9;
sphere.material = mat;

const glowLayer = scene!.getGlowLayerByName('measurement-glow') as BABYLON.GlowLayer;
if (glowLayer) glowLayer.addIncludedOnlyMesh(sphere);

newHelperMeshes.push(sphere);
```

**3. Create `src/ui/components/MeasurementTools.css`:**
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
  color: #00D9FF;
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

**4. Import CSS in MeasurementTools.tsx:**
```tsx
import './MeasurementTools.css';
```

✅ **Test:** Measurement markers should glow cyan, panel has blur effect

---

## Task 4: ExportDialog Card UI (30 min)

**File:** `src/ui/components/ExportDialog.tsx`

### What to Do:
Replace radio buttons with visual card-based selection.

### Code Changes:

**1. Import icons at top:**
```tsx
import { FileJson, Database, Package } from 'lucide-react';
```

**2. Update ExportOption interface (around line 20):**
```tsx
interface ExportOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  fileExtension: string;
  estimatedSize: string;
  badge?: string;
}
```

**3. Update exportOptions array (around line 26):**
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
```

**4. Replace radio list (around lines 78-95):**
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

**5. Create `src/ui/components/ExportDialog.css`:**
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
  border-color: #00D9FF;
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
  color: #00D9FF;
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
  color: #00D9FF;
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

**6. Import CSS:**
```tsx
import './ExportDialog.css';
```

✅ **Test:** Export formats show as cards with icons, selected has cyan border

---

## Task 5: Mode Switch Transitions (15 min)

**Files:** Main app layout switcher + `src/ui/components/Header.tsx`

### What to Do:
Add smooth fade animation and keyboard hints.

### Code Changes:

**1. In Header.tsx dropdown (around line 150), add keyboard hints:**
```tsx
<button
  className="mode-option"
  onClick={() => handleModeSwitch('essential')}
>
  <span>Essential</span>
  <kbd className="keyboard-hint">Ctrl+1</kbd>
</button>
<button
  className="mode-option"
  onClick={() => handleModeSwitch('professional')}
>
  <span>Professional</span>
  <kbd className="keyboard-hint">Ctrl+2</kbd>
</button>
<button
  className="mode-option"
  onClick={() => handleModeSwitch('expert')}
>
  <span>Expert</span>
  <kbd className="keyboard-hint">Ctrl+3</kbd>
</button>
```

**2. Add CSS for keyboard hints (Header.css or global):**
```css
.keyboard-hint {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  margin-left: auto;
  font-family: monospace;
  color: #999;
}

.mode-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
}
```

**3. Add layout transition (in main app file that switches layouts):**
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
```

✅ **Test:** Mode switching should fade smoothly, shortcuts visible in dropdown

---

## ✅ Final Checklist

After completing all 5 tasks:

- [ ] Run: `npm run type-check` (must pass)
- [ ] Run: `npm run lint` (must pass)
- [ ] Test: Click quad viewports - cyan border on active
- [ ] Test: Hover ribbon buttons - cyan background appears
- [ ] Test: Measurement tool - markers glow cyan
- [ ] Test: Export dialog - cards show icons and badges
- [ ] Test: Mode switch - smooth fade animation
- [ ] Check: Browser console has no errors

---

## 🚀 Commit When Done

```bash
git add .
git commit -m "feat(ui): polish layouts and components for smart routing

- Enhanced ExpertModeLayout quad viewports with grid and axis indicators
- Standardized ProfessionalModeLayout ribbon button styling
- Added glowing cyan markers to MeasurementTools
- Redesigned ExportDialog with card-based UI
- Added smooth transitions to mode switching"
```

---

**Estimated time: 2-3 hours total. You got this! 🚀**
