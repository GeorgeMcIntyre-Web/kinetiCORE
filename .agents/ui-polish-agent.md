# UI Polish Agent - Smart Routing Feature Branch

**Agent Type**: Local
**Priority**: High
**Estimated Time**: 2-3 hours
**Owner**: Edwin (UI/UX Specialist)

## Context
The smart-routing-system feature branch has functional layouts but needs visual polish and UX refinement. All TypeScript and ESLint checks pass ✅. Backend routing logic is complete.

## Tasks

### 1. ExpertModeLayout Quad Viewport Polish
**File**: [src/ui/layouts/ExpertModeLayout.tsx:293-317](../src/ui/layouts/ExpertModeLayout.tsx#L293-L317)

**Current State**:
```tsx
<div className="quad-viewport">
  <div className="viewport-quad">
    <div className="viewport-label">Top View</div>
    <div className="viewport-content disabled">
      <div className="viewport-placeholder">Top</div>
    </div>
  </div>
  // ... 3 more viewports
</div>
```

**Required Changes**:
- [ ] Replace placeholder divs with proper CAD-style viewport borders
- [ ] Add view control overlays (grid toggle, axis toggle)
- [ ] Style viewport labels with better typography
- [ ] Add subtle shadow/depth to active viewport
- [ ] Match color scheme: `--kc-accent` from design tokens

**CSS File**: [src/ui/layouts/ExpertModeLayout.css](../src/ui/layouts/ExpertModeLayout.css)

---

### 2. Professional Mode Ribbon Toolbar Refinement
**File**: [src/ui/layouts/ProfessionalModeLayout.tsx:210-423](../src/ui/layouts/ProfessionalModeLayout.tsx#L210-L423)

**Current State**: Functional but spacing inconsistent

**Required Changes**:
- [ ] Standardize button sizes across all tool groups
- [ ] Improve group separator visual design
- [ ] Add hover states with color from design tokens
- [ ] Ensure active tool has clear visual feedback
- [ ] Add tooltips that match design system

**CSS File**: [src/ui/layouts/ProfessionalModeLayout.css](../src/ui/layouts/ProfessionalModeLayout.css)

---

### 3. MeasurementTools Panel Enhancement
**File**: [src/ui/components/MeasurementTools.tsx](../src/ui/components/MeasurementTools.tsx)

**Current State**: Functional floating panel, basic styling

**Required Changes**:
- [ ] Improve floating panel design (add shadow, border-radius)
- [ ] Format result display with units in accent color
- [ ] Add animation when measurement completes
- [ ] Style 3D markers (spheres at lines 102-110, 133-142)
  - Use emissive materials with `--kc-accent` color
  - Add glow effect for better visibility
- [ ] Add progress indicator while measuring

**CSS File**: [src/ui/components/MeasurementTools.css](../src/ui/components/MeasurementTools.css)

**Example 3D Marker Improvement** (lines 102-110):
```typescript
const sphere = BABYLON.MeshBuilder.CreateSphere(`marker-${i}`, {
  diameter: 0.04, // Slightly larger
}, scene!);
sphere.position = p;
const mat = new BABYLON.StandardMaterial('marker-mat', scene!);
mat.emissiveColor = BABYLON.Color3.FromHexString('#00D9FF'); // --kc-accent
mat.alpha = 0.8; // Slight transparency
sphere.material = mat;
// Add glow layer effect
const gl = new BABYLON.GlowLayer("glow", scene!);
gl.addIncludedOnlyMesh(sphere);
newHelperMeshes.push(sphere);
```

---

### 4. ExportDialog Visual Enhancement
**File**: [src/ui/components/ExportDialog.tsx](../src/ui/components/ExportDialog.tsx)

**Current State**: Basic modal with radio buttons

**Required Changes**:
- [ ] Add icons/preview images for each export format
- [ ] Better visual hierarchy for format descriptions
- [ ] Add loading state animation during export (already has loading.start)
- [ ] Improve button styling (primary button for Export)
- [ ] Add format file size estimates

**CSS File**: [src/ui/components/ExportDialog.css](../src/ui/components/ExportDialog.css)

**Enhancement Example** (lines 26-48):
```tsx
const exportOptions: ExportOption[] = [
  {
    format: 'basic',
    label: 'Basic World (JSON)',
    description: 'Scene tree and metadata only.',
    icon: <FileJson size={32} className="export-format-icon" />,
    fileExtension: '.json',
    estimatedSize: '~500 KB', // Add this
    badge: 'Fastest' // Add this
  },
  // ... other options
];
```

---

### 5. Mode Switcher UX Improvements
**File**: [src/ui/components/Header.tsx:123-193](../src/ui/components/Header.tsx#L123-L193)

**Current State**: Dropdown works, but no transitions

**Required Changes**:
- [ ] Add smooth fade transition when switching modes (0.3s)
- [ ] Show "What's new in this mode" tooltip on hover
- [ ] Add keyboard shortcut hints (Ctrl+1/2/3)
- [ ] Add mode badge animation when switching

**CSS Enhancement**:
```css
.mode-transition {
  transition: opacity 0.3s ease-in-out;
}

.mode-badge {
  animation: pulse 0.5s ease-out;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
```

---

## Testing Checklist

After completing tasks, verify:

- [ ] Mode switching: Essential ↔ Professional ↔ Expert
- [ ] Export Dialog: All 3 formats download correctly
- [ ] Measurement Tools: Distance (2 clicks), Angle (3 clicks), Volume (selection-based)
- [ ] Routing: Add connector → Route between → See preview
- [ ] Responsive: Test on 1920x1080, 1366x768, mobile simulation
- [ ] Dark theme compatibility (current: cyan theme)

---

## Design Tokens Reference
**File**: [src/ui/styles/design-tokens.ts](../src/ui/styles/design-tokens.ts)

Use these variables:
- `colors.primary[500]` - Main accent (#00D9FF)
- `colors.success[500]` - Success states
- `colors.warning[500]` - Warning states
- `zIndex.modal` - Modal/dialog z-index

---

## Success Criteria

✅ All layouts visually match professional CAD software polish
✅ Animations smooth, no janky transitions
✅ Design tokens used consistently
✅ All interactive elements have hover/active states
✅ No console errors or warnings

---

## Handoff

When complete:
1. Run `npm run lint && npm run type-check`
2. Take screenshots of before/after
3. Create GIF recordings of interactions
4. Update this file with ✅ checkboxes
5. Commit with message: `feat(ui): polish layouts and components for smart routing`

