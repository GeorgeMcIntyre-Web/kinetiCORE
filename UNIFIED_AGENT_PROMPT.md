# Unified Multi-Agent Prompt - Smart Routing System

**ALL 5 CURSOR AGENTS:** Execute tasks in parallel with coordination

---

## 🎯 Mission

Complete 5 advanced routing features in parallel while avoiding conflicts. Each agent works on a separate branch, then we merge in order.

---

## 🏗️ Agent Assignments

### **AGENT 1: Fix Playwright Tests** ⭐⭐⭐⭐⭐
**Branch:** `feature/fix-playwright-geometry-tests`
**Files:** `tests/visual/routing-screenshots.spec.ts`

**IMPORTANT:** The test file has already been updated with UI interactions! Your job is to verify it works and fix any remaining issues.

**Task:**
1. **Check current implementation** (lines 49-124) - already uses UI clicks
2. **Run tests:** `npx playwright test tests/visual/routing-screenshots.spec.ts --project=chromium --grep "Geometry"`
3. **If tests fail:**
   - Add missing `data-testid` attributes to UI components
   - Adjust click coordinates if canvas positions are off
   - Increase timeouts if needed
   - Verify route mesh appears in scene
4. **If tests pass:** Just verify all 5 screenshots are generated correctly

**Success:** All 10 tests passing (5 UI + 5 geometry), 10 screenshots captured

---

### **AGENT 2: Route Editing UI** ⭐⭐⭐⭐
**Branch:** `feature/route-editing-ui`
**Location:** Right side panel in Professional mode

**Create These Files:**
```
src/routing/ui/RouteEditPanel.tsx
src/routing/ui/RouteEditPanel.css
src/routing/selection/RouteSelectionManager.ts
```

**Modify:**
- `src/ui/layouts/ProfessionalModeLayout.tsx` - Add RouteEditPanel to right side
- `src/ui/store/routingStore.ts` - Add `selectedRouteId: string | null` state

**Features:**
1. **Click route mesh → select it**
   - Add cyan glow to selected route
   - Open RouteEditPanel with route properties
2. **Edit Panel Contents:**
   - Route type dropdown (change between Electrical/Pipe/CableTray/Conduit)
   - Specifications editor (voltage, diameter, fluid type, etc.)
   - Connection points editor (adjust positions)
   - "Update Route" button → uses `EditRouteCommand`
   - "Delete Route" button
3. **Visual Feedback:**
   - Selected route has cyan glow layer
   - Panel slides in from right (300px width)
   - Glass morphism styling (match existing panels)

**Code Structure:**
```typescript
// RouteEditPanel.tsx
interface RouteEditPanelProps {
  routeId: string | null;
  onClose: () => void;
}

export const RouteEditPanel: React.FC<RouteEditPanelProps> = ({ routeId, onClose }) => {
  const route = useRoutingStore(state =>
    state.activeRoutes.find(r => r.getId() === routeId)
  );

  if (!route) return null;

  return (
    <div className="route-edit-panel">
      <div className="panel-header">
        <h3>Edit Route</h3>
        <button onClick={onClose}>✕</button>
      </div>

      <div className="panel-content">
        <label>Route Type</label>
        <select value={route.type} onChange={handleTypeChange}>
          <option value="electrical">Electrical</option>
          <option value="pipe">Pipe</option>
          <option value="cable_tray">Cable Tray</option>
          <option value="conduit">Conduit</option>
        </select>

        {/* Specifications editor based on type */}
        {route.type === 'electrical' && (
          <ElectricalSpecEditor specs={route.specifications} />
        )}

        <button onClick={handleUpdate}>Update Route</button>
        <button onClick={handleDelete} className="danger">Delete</button>
      </div>
    </div>
  );
};
```

**Styling:** Cyan accents (#00D9FF), glass morphism, slide-in animation

---

### **AGENT 3: Validation & Warnings** ⭐⭐⭐
**Branch:** `feature/route-validation`
**Location:** Top notification bar + label colors

**I see you already started `src/routing/validation/`!** ✅ Continue that work.

**Create These Files:**
```
src/routing/validation/RouteValidator.ts
src/routing/validation/ValidationRules.ts
src/routing/ui/RouteWarningsPanel.tsx
```

**Modify:**
- `src/routing/ui/RouteDebugLabels.ts` - Add validation status to labels
- `src/routing/commands/GenerateRouteGeometryCommand.ts` - Validate before generation
- `src/ui/layouts/ProfessionalModeLayout.tsx` - Add warnings notification bar

**Validation Rules:**
```typescript
// RouteValidator.ts
export interface ValidationResult {
  isValid: boolean;
  level: 'error' | 'warning' | 'info';
  messages: string[];
}

export class RouteValidator {
  validate(route: Route): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Length checks
    if (route.getTotalLength() < 0.1) {
      errors.push('Route too short (min 0.1m)');
    }
    if (route.getTotalLength() > 100) {
      warnings.push('Route very long (>100m)');
    }

    // Bend radius checks (type-specific)
    const minBendRadius = this.getMinBendRadius(route.type);
    if (route.hasSharpBends(minBendRadius)) {
      warnings.push(`Bend radius too tight (min ${minBendRadius}m)`);
    }

    // Collision checks
    const collisions = this.checkCollisions(route);
    if (collisions.length > 0) {
      warnings.push(`${collisions.length} potential collisions detected`);
    }

    return {
      isValid: errors.length === 0,
      level: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info',
      messages: [...errors, ...warnings]
    };
  }
}
```

**Visual Updates:**
1. **Debug Labels:** Change border color based on validation
   - Green (#4CAF50): Valid ✓
   - Yellow (#FFC107): Warnings ⚠
   - Red (#F44336): Errors ✗
2. **Route Mesh:** Highlight invalid segments in red
3. **Warnings Panel:** Top notification bar showing all validation issues

**Integration:** Validate in `GenerateRouteGeometryCommand.execute()` before creating mesh

---

### **AGENT 4: Templates Library** ⭐⭐⭐
**Branch:** `feature/route-templates`
**Location:** Left side panel in Professional mode

**Create These Files:**
```
src/routing/templates/RouteTemplates.ts
src/routing/templates/TemplateDefinitions.ts
src/routing/ui/RouteTemplatesPanel.tsx
src/routing/ui/RouteTemplatesPanel.css
src/routing/commands/CreateRouteFromTemplateCommand.ts
```

**Modify:**
- `src/ui/layouts/ProfessionalModeLayout.tsx` - Add "Templates" button + panel (left side)

**Built-in Templates:**
```typescript
// TemplateDefinitions.ts
export const ROUTE_TEMPLATES: RouteTemplate[] = [
  {
    id: 'straight-run',
    name: 'Straight Run',
    description: 'Simple point-to-point route',
    icon: '→',
    createRoute: (startPos, endPos, type) => {
      return {
        type,
        segments: [
          { start: startPos, end: endPos, type: 'straight' }
        ]
      };
    }
  },
  {
    id: '90-elbow',
    name: '90° Elbow',
    description: 'Right-angle bend',
    icon: '⌐',
    createRoute: (startPos, endPos, type) => {
      const midpoint = {
        x: endPos.x,
        y: startPos.y,
        z: startPos.z
      };
      return {
        type,
        segments: [
          { start: startPos, end: midpoint, type: 'straight' },
          { start: midpoint, end: endPos, type: 'straight' }
        ]
      };
    }
  },
  {
    id: 't-junction',
    name: 'T-Junction',
    description: '3-way split',
    icon: '⊤',
    connectionPoints: 3
  },
  {
    id: 'vertical-riser',
    name: 'Vertical Riser',
    description: 'Floor-to-ceiling route',
    icon: '↑'
  },
  {
    id: 'parallel-bundle',
    name: 'Parallel Bundle',
    description: '3 parallel routes',
    icon: '≡',
    count: 3
  }
];
```

**UI Features:**
1. **Templates Panel:**
   - Card-based grid layout (like ExportDialog)
   - Template preview thumbnails (SVG icons)
   - Drag-and-drop into viewport
   - Click to select, then click canvas to place
2. **Custom Templates:**
   - "Save as Template" button on selected routes
   - Export/import templates (JSON files)
   - User template library section
3. **Parametric:**
   - After placement, user can adjust length/bend radius
   - Templates update in real-time

**Panel Position:** Left side, 300px width, slide-in animation

---

### **AGENT 5: Statistics Dashboard** ⭐⭐
**Branch:** `feature/route-stats-dashboard`
**Location:** Bottom right panel in Professional mode

**Create These Files:**
```
src/routing/ui/RouteStatsPanel.tsx
src/routing/ui/RouteStatsPanel.css
src/routing/utils/RouteStatistics.ts
src/routing/utils/CostEstimator.ts
```

**Modify:**
- `src/ui/layouts/ProfessionalModeLayout.tsx` - Add stats panel (bottom right)
- `src/ui/store/routingStore.ts` - Add statistics selectors

**Statistics to Display:**
```typescript
// RouteStatistics.ts
export interface RouteStats {
  totalRoutes: number;
  byType: {
    electrical: { count: number; length: number };
    pipe: { count: number; length: number };
    cable_tray: { count: number; length: number };
    conduit: { count: number; length: number };
  };
  totalLength: number;
  totalCost: number;
  connectionPoints: number;
  validationSummary: {
    valid: number;
    warnings: number;
    errors: number;
  };
}
```

**Dashboard Layout:**
```typescript
// RouteStatsPanel.tsx
<div className="route-stats-panel">
  <h3>Project Statistics</h3>

  {/* Summary Cards */}
  <div className="stats-grid">
    <StatCard icon="⚡" label="Electrical" value={stats.byType.electrical.count} />
    <StatCard icon="🔵" label="Pipe" value={stats.byType.pipe.count} />
    <StatCard icon="🟠" label="Cable Tray" value={stats.byType.cable_tray.count} />
    <StatCard icon="🟢" label="Conduit" value={stats.byType.conduit.count} />
  </div>

  {/* Length Bar Chart */}
  <div className="length-chart">
    <h4>Total Length by Type</h4>
    <BarChart data={lengthByType} />
  </div>

  {/* Cost Summary */}
  <div className="cost-summary">
    <span>Estimated Cost:</span>
    <span className="cost-value">${stats.totalCost.toFixed(2)}</span>
  </div>

  {/* Validation Summary */}
  <div className="validation-summary">
    <span className="valid">✓ {stats.validationSummary.valid}</span>
    <span className="warnings">⚠ {stats.validationSummary.warnings}</span>
    <span className="errors">✗ {stats.validationSummary.errors}</span>
  </div>

  {/* Export Buttons */}
  <div className="export-actions">
    <button onClick={exportCSV}>Export CSV</button>
    <button onClick={exportPDF}>Export PDF</button>
  </div>
</div>
```

**Charts:** Simple CSS bar charts (no external library) or use Chart.js if needed

**Panel Position:** Bottom right corner, 350px width, collapsible

---

## 🔄 Coordination Rules

### Panel Positioning (CRITICAL - Avoid Conflicts!)

**ProfessionalModeLayout.tsx** - Each agent adds to different position:

```typescript
// Agent 2: Right side panel
<RouteEditPanel
  routeId={selectedRouteId}
  style={{ position: 'fixed', right: 0, top: 64, width: 300 }}
/>

// Agent 3: Top notification bar
<RouteWarningsPanel
  warnings={validationWarnings}
  style={{ position: 'fixed', top: 64, left: 0, right: 0, height: 40 }}
/>

// Agent 4: Left side panel
<RouteTemplatesPanel
  style={{ position: 'fixed', left: 0, top: 104, width: 300 }}
/>

// Agent 5: Bottom right panel
<RouteStatsPanel
  style={{ position: 'fixed', bottom: 0, right: 0, width: 350 }}
/>
```

### State Management (routingStore.ts)

Each agent adds non-overlapping state:

```typescript
// Agent 2
selectedRouteId: string | null;
setSelectedRoute: (id: string | null) => void;

// Agent 3
validationResults: Map<string, ValidationResult>;
setValidationResult: (routeId: string, result: ValidationResult) => void;

// Agent 4
templates: RouteTemplate[];
addTemplate: (template: RouteTemplate) => void;

// Agent 5
// Uses derived selectors only, no new state
```

### File Modifications

**ONLY modify files in your designated area!**

| File | Agent 2 | Agent 3 | Agent 4 | Agent 5 |
|------|---------|---------|---------|---------|
| `ProfessionalModeLayout.tsx` | ✅ Right | ✅ Top | ✅ Left | ✅ Bottom-Right |
| `routingStore.ts` | ✅ Selection | ✅ Validation | ✅ Templates | ✅ Selectors |
| `RouteDebugLabels.ts` | ❌ | ✅ Colors | ❌ | ❌ |
| `GenerateRouteGeometryCommand.ts` | ❌ | ✅ Validate | ❌ | ❌ |

---

## ✅ Testing Protocol

**Each Agent:**
1. Create branch from `feature/smart-routing-system`
2. Implement your feature
3. Test locally: `npm run dev`
4. Run checks: `npm run type-check && npm run lint`
5. Take 2-3 screenshots of your feature
6. Create PR to `feature/smart-routing-system`
7. Mark any conflicts in PR description

---

## 📝 Commit Messages

Use this format:

```bash
# Agent 1
git commit -m "fix(tests): rewrite geometry tests with UI interactions

All 5 geometry tests now passing with UI click workflow.
Total test suite: 10/10 passing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>"

# Agent 2
git commit -m "feat(routing): add route editing UI panel

Right-side panel for editing selected routes:
- Change route type dropdown
- Edit specifications
- Update/delete routes
- Cyan selection glow

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>"

# Agent 3
git commit -m "feat(routing): add validation system with warnings

Route validation with visual feedback:
- Length/bend radius/collision checks
- Color-coded debug labels (green/yellow/red)
- Top notification bar for warnings
- Validate before geometry generation

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>"

# Agent 4
git commit -m "feat(routing): add route templates library

Left-side panel with 6 built-in templates:
- Straight run, 90° elbow, T-junction, etc.
- Drag-and-drop or click to place
- Save custom templates
- Export/import templates

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com)"

# Agent 5
git commit -m "feat(routing): add statistics dashboard

Bottom-right panel showing project stats:
- Route counts and lengths by type
- Cost estimates
- Validation summary
- CSV/PDF export

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com)"
```

---

## 🎯 Success Criteria

**ALL AGENTS:**
- ✅ Feature complete and working
- ✅ No TypeScript errors
- ✅ ESLint acceptable (<20 warnings)
- ✅ Styled consistently (cyan accents, glass morphism)
- ✅ 2-3 screenshots captured
- ✅ PR created with clear description

**TEAM:**
- ✅ All 5 PRs created within 3 hours
- ✅ Merge order: 1 → 5 → 2 → 3 → 4
- ✅ Integration testing complete
- ✅ Final PR to main with all features

---

## 🚀 Timeline

- **Development:** 2-3 hours (parallel)
- **PRs & Merging:** 1 hour (sequential)
- **Integration Test:** 30 minutes
- **Final PR:** 15 minutes

**Total:** ~4 hours to ship 5 major features

---

## 💪 LET'S GO!

**Agent 1:** Start immediately - tests unblock everything
**Agents 2-5:** Start in parallel - you have clear separation
**Claude Code:** Standing by for conflict resolution & integration

**Deploy fast, deploy together! 🚀**
