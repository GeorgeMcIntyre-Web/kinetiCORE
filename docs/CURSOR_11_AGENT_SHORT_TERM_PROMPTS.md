# 11-Agent Cursor Prompts - Short Term Features (0% → 100%)

**Goal:** Complete all 11 short-term feature groups from the roadmap
**Timeline:** 2-4 weeks of parallel development
**Current Progress:** 15% → Target: 100%
**Branch:** `feature/smart-routing-system`

---

## Setup Instructions

1. **Create 11 feature branches:**
   ```bash
   git checkout feature/smart-routing-system
   git pull origin feature/smart-routing-system

   # Agent 1
   git checkout -b feature/playwright-tests-update

   # Agent 2
   git checkout feature/smart-routing-system
   git checkout -b feature/panel-state-persistence

   # (Repeat for all 11 agents)
   ```

2. **Run dev server:**
   ```bash
   npm run dev
   ```

3. **Copy each prompt below into separate Cursor agents**

4. **Each agent works on their own branch**

5. **Merge to feature/smart-routing-system when complete**

---

## 🧪 AGENT 1: Playwright Test Updates (Priority: CRITICAL)

**Branch:** `feature/playwright-tests-update`
**Current Progress:** 0%
**Target:** 100%
**Files:** `tests/visual/routing-screenshots.spec.ts`

```
TASK: Rewrite Playwright tests from programmatic to UI-based approach

CONTEXT:
- Current tests use page.evaluate() with dynamic imports (timing out)
- Need to use actual UI interactions (button clicks, selectors)
- 5 geometry tests need complete rewrite
- Tests should use Quick Preset buttons in ribbon

REQUIREMENTS:

1. **Update Test Helper Functions**
   - Remove programmatic createRouteWithGeometryAndLabel()
   - Create new UI-based helpers:
     - clickPresetButton(page, type: 'electrical' | 'pipe' | 'cable_tray' | 'conduit')
     - waitForRouteGeometry(page)
     - waitForDebugLabel(page)
     - captureViewportScreenshot(page, filename)

2. **Rewrite Electrical Test**
   - Click "Electrical" button in ribbon
   - Wait for console log: "[QuickRoutePresets] Route creation complete!"
   - Wait for route geometry to appear in scene
   - Wait for debug label to appear
   - Take screenshot
   - Verify screenshot contains electrical conduit

3. **Rewrite Pipe Test**
   - Click "Pipe" button
   - Wait for route creation
   - Verify pipe geometry
   - Take screenshot

4. **Rewrite Cable Tray Test**
   - Click "Tray" button
   - Wait for route creation
   - Verify tray geometry
   - Take screenshot

5. **Rewrite Conduit Test**
   - Click "Conduit" button
   - Wait for route creation
   - Verify conduit geometry
   - Take screenshot

6. **Rewrite Mixed Test**
   - Click "Mixed" button
   - Wait for all 4 routes to appear
   - Verify all geometries
   - Take screenshot

7. **Add New Tests**
   - Test RouteEditPanel interactions
   - Test RouteTemplatesPanel
   - Test RouteStatsPanel updates
   - Test mode selector dropdown

8. **Fix Mode Selector Locator**
   - Update selector to: 'button[class*="mode-selector"]' or data attribute
   - Verify dropdown appears with right-0 positioning

IMPLEMENTATION:

```typescript
// New helper function
async function clickPresetButton(
  page: Page,
  type: 'electrical' | 'pipe' | 'cable_tray' | 'conduit' | 'mixed'
) {
  // Find button by text or data attribute
  const button = page.locator(`button:has-text("${type.charAt(0).toUpperCase() + type.slice(1)}")`);
  await button.click();

  // Wait for console log confirmation
  await page.waitForFunction(() => {
    return window.console.toString().includes('[QuickRoutePresets] Route creation complete!');
  }, { timeout: 10000 });

  // Wait for geometry to render (check for new meshes in scene)
  await page.waitForTimeout(1000); // Give time for mesh creation
}

// Rewritten test
test('Geometry: Electrical with label', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Ensure Professional mode
  await ensureProfessionalMode(page);

  // Click Electrical preset button
  await clickPresetButton(page, 'electrical');

  // Wait for route to appear
  await waitForRouteGeometry(page);

  // Take screenshot
  await page.screenshot({
    path: 'tests/screenshots/electrical-route.png',
    fullPage: true
  });
});
```

TESTING:
```bash
npm run test:e2e
# or
npx playwright test tests/visual/routing-screenshots.spec.ts
```

SUCCESS CRITERIA:
- ✅ All 5 geometry tests passing
- ✅ Tests complete in <30 seconds each
- ✅ Screenshots captured successfully
- ✅ No timeout errors
- ✅ 3+ new tests for panels added

DELIVERABLES:
- Updated routing-screenshots.spec.ts
- New helper functions
- 8+ passing tests
- Screenshots in tests/screenshots/
```

---

## 💾 AGENT 2: Panel State Persistence

**Branch:** `feature/panel-state-persistence`
**Current Progress:** 0%
**Target:** 100%
**Files:** `src/ui/layouts/DockableLayoutWrapper.tsx`, `src/ui/utils/PanelStateManager.ts` (new)

```
TASK: Implement panel state persistence across browser sessions

CONTEXT:
- Dockview panels should remember position, size, open/closed state
- Use localStorage for persistence
- Restore layout on app reload

REQUIREMENTS:

1. **Create PanelStateManager Utility**
   - File: src/ui/utils/PanelStateManager.ts
   - Save panel layout to localStorage
   - Load panel layout on startup
   - Handle errors gracefully (missing localStorage)

2. **Implement in DockableLayoutWrapper**
   - Hook into onLayoutChange event
   - Debounce saves (300ms delay to avoid excessive writes)
   - Save on panel open/close
   - Save on panel resize
   - Save on panel drag/drop

3. **Layout State Structure**
   ```typescript
   interface PanelState {
     id: string;
     position: 'left' | 'right' | 'top' | 'bottom' | 'center';
     width?: number;
     height?: number;
     isOpen: boolean;
     order: number;
   }

   interface LayoutState {
     panels: PanelState[];
     timestamp: number;
     version: string; // For migration if schema changes
   }
   ```

4. **Save Mechanism**
   - localStorage key: 'kineticore_professional_layout'
   - JSON.stringify the state
   - Catch and log errors
   - Max size check (prevent localStorage quota errors)

5. **Load Mechanism**
   - Read from localStorage on mount
   - Parse JSON safely (try-catch)
   - Validate schema (ensure all required fields)
   - Fallback to default layout if invalid

6. **Default Layouts**
   - Professional Mode default:
     - Edit panel: right, open
     - Statistics panel: bottom, open
     - Templates panel: left, closed
     - Warnings panel: top, closed

7. **Reset Functionality**
   - Add "Reset Layout" button to header (optional dropdown)
   - Clear localStorage
   - Reload default layout

IMPLEMENTATION:

```typescript
// src/ui/utils/PanelStateManager.ts
export class PanelStateManager {
  private static readonly STORAGE_KEY = 'kineticore_professional_layout';
  private static readonly VERSION = '1.0';

  static save(state: LayoutState): void {
    try {
      const stateWithVersion = {
        ...state,
        version: this.VERSION,
        timestamp: Date.now(),
      };
      const json = JSON.stringify(stateWithVersion);

      // Check size (5MB limit typical)
      if (json.length > 4 * 1024 * 1024) {
        console.warn('[PanelState] Layout state too large, not saving');
        return;
      }

      localStorage.setItem(this.STORAGE_KEY, json);
    } catch (error) {
      console.error('[PanelState] Failed to save layout:', error);
    }
  }

  static load(): LayoutState | null {
    try {
      const json = localStorage.getItem(this.STORAGE_KEY);
      if (!json) return null;

      const state = JSON.parse(json) as LayoutState;

      // Validate version
      if (state.version !== this.VERSION) {
        console.warn('[PanelState] Version mismatch, ignoring saved state');
        return null;
      }

      // Validate structure
      if (!state.panels || !Array.isArray(state.panels)) {
        console.warn('[PanelState] Invalid state structure');
        return null;
      }

      return state;
    } catch (error) {
      console.error('[PanelState] Failed to load layout:', error);
      return null;
    }
  }

  static reset(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('[PanelState] Failed to reset layout:', error);
    }
  }
}

// In DockableLayoutWrapper.tsx
const [layoutState, setLayoutState] = useState<LayoutState | null>(null);

useEffect(() => {
  // Load saved state on mount
  const saved = PanelStateManager.load();
  if (saved) {
    setLayoutState(saved);
    // Apply to dockview API
    applyLayoutState(dockviewApi, saved);
  }
}, []);

// Debounced save handler
const saveLayoutDebounced = useMemo(
  () => debounce((api: DockviewApi) => {
    const state = extractLayoutState(api);
    PanelStateManager.save(state);
  }, 300),
  []
);

useEffect(() => {
  if (!dockviewApi) return;

  const disposables = [
    dockviewApi.onDidLayoutChange(() => {
      saveLayoutDebounced(dockviewApi);
    }),
  ];

  return () => {
    disposables.forEach(d => d.dispose());
  };
}, [dockviewApi, saveLayoutDebounced]);
```

TESTING:
1. Open Professional Mode
2. Rearrange panels (drag Edit panel to left)
3. Resize Statistics panel
4. Close Templates panel
5. Refresh browser (F5)
6. Verify panels restored to saved state

SUCCESS CRITERIA:
- ✅ Panel positions persist across reloads
- ✅ Panel sizes persist
- ✅ Panel open/closed state persists
- ✅ Works in Claude artifacts (localStorage available)
- ✅ Graceful fallback if localStorage unavailable
- ✅ Reset layout button works

DELIVERABLES:
- src/ui/utils/PanelStateManager.ts
- Updated DockableLayoutWrapper.tsx
- Tests for save/load/reset
```

---

## 🔌 AGENT 3: Connector Compatibility System

**Branch:** `feature/connector-compatibility`
**Current Progress:** 25%
**Target:** 100%
**Files:** `src/routing/validation/ConnectorCompatibility.ts` (new), `src/routing/ui/RouteEditPanel.tsx`

```
TASK: Implement connector compatibility checking and warnings

CONTEXT:
- Connection points have specifications (plug type, thread type, etc.)
- Routes connect two points - they must be compatible
- Need visual indicators for incompatible connections

REQUIREMENTS:

1. **Create ConnectorCompatibility Utility**
   - File: src/routing/validation/ConnectorCompatibility.ts
   - Check electrical plug compatibility (male/female, voltage match)
   - Check pipe thread compatibility (NPT, BSP, etc.)
   - Check diameter/size compatibility
   - Check gender matching

2. **Electrical Compatibility Rules**
   ```typescript
   interface ElectricalSpecs {
     voltage: number;
     current: number;
     plugType: 'NEMA_5-15' | 'NEMA_5-20' | 'IEC_60320_C13' | 'custom';
     gender: 'male' | 'female' | 'neutral';
   }

   // Rules:
   - Voltage must match (±10% tolerance)
   - Current: connection point must support ≥ route current
   - Plug types must be compatible (matching standard)
   - Genders must match (male-female or neutral-any)
   ```

3. **Pipe Compatibility Rules**
   ```typescript
   interface PipeSpecs {
     diameter: number; // in mm
     threadType: 'NPT' | 'BSP' | 'metric' | 'none';
     material: 'steel' | 'pvc' | 'copper' | 'brass';
     pressure: number; // in bar
     gender: 'male' | 'female' | 'neutral';
   }

   // Rules:
   - Diameters must match (±2mm tolerance for adapters)
   - Thread types must match (or be compatible via adapter)
   - Materials should be compatible (no galvanic corrosion)
   - Pressure rating: connection must support ≥ route pressure
   - Genders must match
   ```

4. **Visual Indicators**
   - In RouteEditPanel: show compatibility status
   - Green checkmark: ✓ Compatible
   - Yellow warning: ⚠ Compatible with adapter
   - Red X: ✗ Incompatible
   - Tooltip with reason

5. **Compatibility Checking**
   ```typescript
   export interface CompatibilityResult {
     compatible: boolean;
     warnings: string[];
     errors: string[];
     requiresAdapter: boolean;
     suggestedAdapter?: string;
   }

   export class ConnectorCompatibility {
     static checkElectrical(
       source: ElectricalSpecs,
       destination: ElectricalSpecs
     ): CompatibilityResult {
       const result: CompatibilityResult = {
         compatible: true,
         warnings: [],
         errors: [],
         requiresAdapter: false,
       };

       // Voltage check
       const voltageDiff = Math.abs(source.voltage - destination.voltage);
       if (voltageDiff > source.voltage * 0.1) {
         result.compatible = false;
         result.errors.push(`Voltage mismatch: ${source.voltage}V vs ${destination.voltage}V`);
       }

       // Current check
       if (destination.current < source.current) {
         result.compatible = false;
         result.errors.push(`Current rating insufficient: ${destination.current}A < ${source.current}A`);
       }

       // Plug type check
       if (source.plugType !== destination.plugType) {
         result.requiresAdapter = true;
         result.warnings.push(`Different plug types: ${source.plugType} → ${destination.plugType}`);
         result.suggestedAdapter = `${source.plugType} to ${destination.plugType} adapter`;
       }

       // Gender check
       if (source.gender === 'male' && destination.gender === 'male') {
         result.compatible = false;
         result.errors.push('Gender mismatch: both connections are male');
       } else if (source.gender === 'female' && destination.gender === 'female') {
         result.compatible = false;
         result.errors.push('Gender mismatch: both connections are female');
       }

       return result;
     }

     static checkPipe(
       source: PipeSpecs,
       destination: PipeSpecs
     ): CompatibilityResult {
       // Similar logic for pipes
     }
   }
   ```

6. **Integration with RouteEditPanel**
   - Add compatibility indicator below connector specs
   - Show warnings/errors
   - Suggest adapters if applicable
   - Disable route creation if incompatible

7. **Validation Integration**
   - Add compatibility check to RouteValidator
   - Warning: "Incompatible connectors - requires adapter"
   - Error: "Incompatible connectors - cannot connect"

IMPLEMENTATION:

```typescript
// In RouteEditPanel.tsx
const [compatibilityResult, setCompatibilityResult] = useState<CompatibilityResult | null>(null);

useEffect(() => {
  if (!selectedRoute) return;

  const source = selectedRoute.source.specifications;
  const dest = selectedRoute.destination.specifications;

  let result: CompatibilityResult;
  if (selectedRoute.type === 'electrical') {
    result = ConnectorCompatibility.checkElectrical(source, dest);
  } else if (selectedRoute.type === 'pipe') {
    result = ConnectorCompatibility.checkPipe(source, dest);
  }

  setCompatibilityResult(result);
}, [selectedRoute]);

// JSX
{compatibilityResult && (
  <div className="compatibility-indicator">
    {compatibilityResult.compatible && !compatibilityResult.requiresAdapter && (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="w-4 h-4" />
        <span>Connectors compatible</span>
      </div>
    )}

    {compatibilityResult.requiresAdapter && (
      <div className="flex items-center gap-2 text-yellow-600">
        <AlertTriangle className="w-4 h-4" />
        <span>Adapter required: {compatibilityResult.suggestedAdapter}</span>
      </div>
    )}

    {!compatibilityResult.compatible && (
      <div className="flex items-center gap-2 text-red-600">
        <XCircle className="w-4 h-4" />
        <span>Incompatible connectors</span>
        <ul className="text-sm">
          {compatibilityResult.errors.map((err, i) => (
            <li key={i}>• {err}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
)}
```

TESTING:
1. Create electrical route with matching plugs → Green checkmark
2. Create electrical route with different plug types → Yellow warning + adapter suggestion
3. Create electrical route with voltage mismatch → Red X + error
4. Create pipe route with different thread types → Adapter suggestion
5. Create pipe route with male-male gender → Red X + error

SUCCESS CRITERIA:
- ✅ Electrical compatibility checking works
- ✅ Pipe compatibility checking works
- ✅ Visual indicators display correctly
- ✅ Adapter suggestions provided
- ✅ Integration with RouteValidator
- ✅ Tests for all compatibility rules

DELIVERABLES:
- src/routing/validation/ConnectorCompatibility.ts
- Updated RouteEditPanel.tsx
- Unit tests for compatibility logic
- Visual indicators in UI
```

---

## 📚 AGENT 4: Material Library Enhancement

**Branch:** `feature/material-library`
**Current Progress:** 40%
**Target:** 100%
**Files:** `src/routing/materials/MaterialLibrary.ts`, `src/routing/materials/materials.json` (new)

```
TASK: Expand material library with comprehensive properties and cost data

CONTEXT:
- Currently have basic materials (steel, PVC, copper)
- Need full material database with properties
- Add cost estimation
- Visual material previews

REQUIREMENTS:

1. **Create Material Database**
   - File: src/routing/materials/materials.json
   - 50+ materials across all route types
   - Properties for each material
   - Cost data
   - Compatibility matrix

2. **Material Properties Structure**
   ```json
   {
     "materials": {
       "electrical": [
         {
           "id": "copper_wire_awg_12",
           "name": "Copper Wire AWG 12",
           "category": "electrical",
           "subcategory": "wire",
           "properties": {
             "gauge": "12 AWG",
             "diameter": 2.053,
             "material": "copper",
             "insulation": "THHN",
             "maxVoltage": 600,
             "maxCurrent": 20,
             "resistance": 5.21,
             "temperatureRating": 90,
             "color": "#B87333"
           },
           "cost": {
             "unit": "meter",
             "price": 0.85,
             "currency": "USD"
           },
           "specifications": {
             "standard": "UL 83",
             "flameRating": "FT4",
             "bendRadius": 4.0
           },
           "compatibility": ["NEMA_5-15", "NEMA_5-20"],
           "manufacturer": "Southwire",
           "partNumber": "22959658"
         }
       ],
       "pipe": [
         {
           "id": "steel_pipe_sch40_dn50",
           "name": "Steel Pipe Schedule 40 DN50",
           "category": "pipe",
           "subcategory": "steel",
           "properties": {
             "nominalDiameter": 50,
             "outerDiameter": 60.3,
             "wallThickness": 3.91,
             "material": "carbon steel",
             "schedule": "40",
             "threadType": "NPT",
             "maxPressure": 150,
             "temperatureRange": [-29, 400],
             "color": "#808080"
           },
           "cost": {
             "unit": "meter",
             "price": 15.50,
             "currency": "USD"
           },
           "specifications": {
             "standard": "ASTM A53",
             "grade": "B",
             "coating": "black"
           },
           "compatibility": ["NPT", "flanged"],
           "manufacturer": "Generic",
           "partNumber": "SCH40-DN50"
         }
       ],
       "cable_tray": [
         {
           "id": "aluminum_tray_300mm",
           "name": "Aluminum Cable Tray 300mm",
           "category": "cable_tray",
           "subcategory": "aluminum",
           "properties": {
             "width": 300,
             "height": 50,
             "material": "aluminum",
             "finish": "powder coated",
             "loadRating": 50,
             "fillCapacity": 15000,
             "color": "#C0C0C0"
           },
           "cost": {
             "unit": "meter",
             "price": 45.00,
             "currency": "USD"
           },
           "specifications": {
             "standard": "IEC 61537",
             "rungs": "ventilated",
             "corrosionResistance": "C4"
           },
           "manufacturer": "Legrand",
           "partNumber": "CT-AL-300"
         }
       ],
       "conduit": [
         {
           "id": "pvc_conduit_25mm",
           "name": "PVC Conduit 25mm",
           "category": "conduit",
           "subcategory": "pvc",
           "properties": {
             "diameter": 25,
             "material": "PVC",
             "type": "rigid",
             "impactRating": "medium",
             "uvResistant": true,
             "temperatureRange": [-10, 60],
             "color": "#FFFFFF"
           },
           "cost": {
             "unit": "meter",
             "price": 3.20,
             "currency": "USD"
           },
           "specifications": {
             "standard": "IEC 61386",
             "flameRating": "self-extinguishing",
             "bendRadius": 100
           },
           "manufacturer": "Carlon",
           "partNumber": "PVC-25MM"
         }
       ]
     }
   }
   ```

3. **Material Library Class**
   ```typescript
   export interface Material {
     id: string;
     name: string;
     category: RouteType;
     subcategory: string;
     properties: Record<string, any>;
     cost: {
       unit: string;
       price: number;
       currency: string;
     };
     specifications: Record<string, any>;
     compatibility?: string[];
     manufacturer?: string;
     partNumber?: string;
   }

   export class MaterialLibrary {
     private static materials: Material[] = [];

     static async load(): Promise<void> {
       const response = await fetch('/materials.json');
       const data = await response.json();
       this.materials = data.materials;
     }

     static getMaterialsByCategory(category: RouteType): Material[] {
       return this.materials.filter(m => m.category === category);
     }

     static getMaterialById(id: string): Material | undefined {
       return this.materials.find(m => m.id === id);
     }

     static calculateCost(materialId: string, length: number): number {
       const material = this.getMaterialById(materialId);
       if (!material) return 0;
       return material.cost.price * length;
     }

     static searchMaterials(query: string): Material[] {
       const lower = query.toLowerCase();
       return this.materials.filter(m =>
         m.name.toLowerCase().includes(lower) ||
         m.subcategory.toLowerCase().includes(lower) ||
         m.manufacturer?.toLowerCase().includes(lower)
       );
     }
   }
   ```

4. **Material Selector Component**
   - Enhanced dropdown in RouteEditPanel
   - Search/filter materials
   - Show material properties on hover
   - Visual material preview (color swatch)
   - Cost estimate display

5. **Cost Estimation**
   - Calculate route cost based on material + length
   - Include fittings/connectors
   - Add labor cost multiplier
   - Display in RouteEditPanel
   - Aggregate cost in RouteStatsPanel

6. **Visual Material Preview**
   - Color swatch next to material name
   - Thumbnail image (optional, for common materials)
   - Properties tooltip on hover

7. **Material Compatibility**
   - Check material compatibility with connectors
   - Warn about galvanic corrosion (e.g., copper + aluminum)
   - Suggest compatible materials

IMPLEMENTATION:

```typescript
// In RouteEditPanel.tsx
const [materials, setMaterials] = useState<Material[]>([]);
const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

useEffect(() => {
  if (selectedRoute) {
    const mats = MaterialLibrary.getMaterialsByCategory(selectedRoute.type);
    setMaterials(mats);
  }
}, [selectedRoute]);

// Material selector JSX
<div className="material-selector">
  <label>Material</label>
  <select
    value={selectedMaterial?.id || ''}
    onChange={(e) => {
      const mat = MaterialLibrary.getMaterialById(e.target.value);
      setSelectedMaterial(mat);
      // Update route material
    }}
  >
    {materials.map(mat => (
      <option key={mat.id} value={mat.id}>
        {mat.name} - ${mat.cost.price}/{mat.cost.unit}
      </option>
    ))}
  </select>

  {selectedMaterial && (
    <div className="material-preview">
      <div
        className="color-swatch"
        style={{ backgroundColor: selectedMaterial.properties.color }}
      />
      <div className="material-details">
        <p><strong>Manufacturer:</strong> {selectedMaterial.manufacturer}</p>
        <p><strong>Part #:</strong> {selectedMaterial.partNumber}</p>
        <p><strong>Standard:</strong> {selectedMaterial.specifications.standard}</p>
      </div>
      <div className="cost-estimate">
        <p><strong>Estimated Cost:</strong> ${MaterialLibrary.calculateCost(selectedMaterial.id, selectedRoute.length).toFixed(2)}</p>
      </div>
    </div>
  )}
</div>
```

TESTING:
1. Load materials from JSON
2. Select electrical route → see electrical materials only
3. Select pipe route → see pipe materials only
4. Search for "copper" → see copper materials
5. Hover over material → see properties tooltip
6. Select material → see cost estimate update

SUCCESS CRITERIA:
- ✅ 50+ materials in database
- ✅ Material properties complete
- ✅ Cost estimation working
- ✅ Material selector enhanced
- ✅ Visual previews display
- ✅ Compatibility checking integrated

DELIVERABLES:
- src/routing/materials/materials.json (50+ materials)
- src/routing/materials/MaterialLibrary.ts
- Enhanced material selector in RouteEditPanel
- Cost estimation in RouteStatsPanel
- Tests for material loading and cost calculation
```

---

## 💥 AGENT 5: Collision Detection

**Branch:** `feature/collision-detection`
**Current Progress:** 0%
**Target:** 100%
**Files:** `src/routing/validation/CollisionDetector.ts` (new), `src/routing/validation/SpatialIndex.ts` (new)

```
TASK: Implement route-to-route and route-to-obstacle collision detection

CONTEXT:
- Routes are 3D meshes in the scene
- Need to detect when routes intersect each other
- Need to detect when routes intersect obstacles (walls, equipment)
- Show visual warnings for collisions

REQUIREMENTS:

1. **Create CollisionDetector Utility**
   - File: src/routing/validation/CollisionDetector.ts
   - Use Babylon.js bounding box intersection
   - Check route mesh vs route mesh
   - Check route mesh vs obstacle mesh
   - Return collision points and severity

2. **Spatial Indexing for Performance**
   - File: src/routing/validation/SpatialIndex.ts
   - Octree or grid-based spatial partitioning
   - Only check nearby routes for collisions
   - O(log n) lookup instead of O(n²)

3. **Collision Types**
   ```typescript
   enum CollisionType {
     RouteToRoute = 'route-to-route',
     RouteToObstacle = 'route-to-obstacle',
     ClearanceViolation = 'clearance-violation',
   }

   interface Collision {
     type: CollisionType;
     routeId: string;
     collidingWith: string; // route ID or obstacle ID
     position: Vector3;
     severity: 'minor' | 'major' | 'critical';
     clearanceRequired: number;
     actualClearance: number;
   }
   ```

4. **Clearance Rules**
   - Electrical: 100mm min clearance from pipes (arc flash)
   - Pipe: 50mm min clearance from other pipes
   - Cable tray: 150mm min clearance from ceiling
   - Conduit: 25mm min clearance from other conduits

5. **Collision Detection Algorithm**
   ```typescript
   export class CollisionDetector {
     private spatialIndex: SpatialIndex;

     constructor(scene: Scene) {
       this.spatialIndex = new SpatialIndex(scene.getBoundingInfo());
     }

     detectCollisions(route: Route): Collision[] {
       const collisions: Collision[] = [];
       const routeMesh = route.getMesh();
       if (!routeMesh) return collisions;

       // Get nearby routes from spatial index
       const nearbyRoutes = this.spatialIndex.getNearby(routeMesh.position, route.length);

       for (const otherRoute of nearbyRoutes) {
         if (otherRoute.getId() === route.getId()) continue;

         const otherMesh = otherRoute.getMesh();
         if (!otherMesh) continue;

         // Bounding box intersection test (fast)
         if (routeMesh.intersectsMesh(otherMesh, false)) {
           // Precise intersection test
           const intersectionPoints = this.getIntersectionPoints(routeMesh, otherMesh);

           if (intersectionPoints.length > 0) {
             // Calculate clearance
             const clearance = this.calculateClearance(routeMesh, otherMesh);
             const requiredClearance = this.getRequiredClearance(route.type, otherRoute.type);

             if (clearance < requiredClearance) {
               collisions.push({
                 type: CollisionType.RouteToRoute,
                 routeId: route.getId(),
                 collidingWith: otherRoute.getId(),
                 position: intersectionPoints[0],
                 severity: clearance < requiredClearance * 0.5 ? 'critical' : 'major',
                 clearanceRequired: requiredClearance,
                 actualClearance: clearance,
               });
             }
           }
         }
       }

       // Check obstacles
       const obstacles = this.spatialIndex.getObstacles(routeMesh.position, route.length);
       for (const obstacle of obstacles) {
         // Similar logic for obstacle collisions
       }

       return collisions;
     }

     private getRequiredClearance(type1: RouteType, type2: RouteType): number {
       if (type1 === 'electrical' || type2 === 'electrical') {
         return 100; // 100mm for electrical
       }
       if (type1 === 'pipe' || type2 === 'pipe') {
         return 50; // 50mm for pipes
       }
       return 25; // Default 25mm
     }

     private calculateClearance(mesh1: Mesh, mesh2: Mesh): number {
       // Calculate minimum distance between mesh surfaces
       // Use bounding spheres for approximation (fast)
       const center1 = mesh1.getBoundingInfo().boundingSphere.center;
       const center2 = mesh2.getBoundingInfo().boundingSphere.center;
       const radius1 = mesh1.getBoundingInfo().boundingSphere.radius;
       const radius2 = mesh2.getBoundingInfo().boundingSphere.radius;

       const distance = Vector3.Distance(center1, center2);
       return distance - radius1 - radius2;
     }
   }
   ```

6. **Visual Collision Indicators**
   - Red highlight on colliding route segments
   - Collision marker (red sphere) at intersection point
   - Distance label showing clearance violation

7. **Integration with RouteValidator**
   - Add collision check to validation
   - Warning: "Route has 2 collisions"
   - Click warning to highlight collisions

8. **Auto-Reroute Suggestion (Future)**
   - Suggest alternative path to avoid collision
   - Show preview of rerouted path
   - One-click apply

IMPLEMENTATION:

```typescript
// In RouteValidator.ts
import { CollisionDetector } from './CollisionDetector';

const collisionDetector = new CollisionDetector(scene);

export function validateRoute(route: Route): EnhancedValidationResult {
  const result: EnhancedValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
    suggestions: [],
  };

  // Existing validation...

  // Collision detection
  const collisions = collisionDetector.detectCollisions(route);

  if (collisions.length > 0) {
    result.isValid = false;

    for (const collision of collisions) {
      if (collision.severity === 'critical') {
        result.errors.push({
          code: 'COLLISION_CRITICAL',
          message: `Critical collision with ${collision.collidingWith}`,
          field: 'route',
          value: collision.position.toString(),
        });
      } else {
        result.warnings.push({
          code: 'COLLISION_WARNING',
          message: `Route too close to ${collision.collidingWith} (${collision.actualClearance.toFixed(0)}mm, required: ${collision.clearanceRequired}mm)`,
          field: 'route',
          value: collision.position.toString(),
        });
      }
    }

    // Auto-reroute suggestion
    result.suggestions.push({
      code: 'AUTO_REROUTE',
      message: 'Click to auto-reroute around collisions',
      action: () => {
        // Trigger auto-reroute algorithm
      },
    });
  }

  return result;
}

// Visual collision markers
function showCollisionMarkers(collisions: Collision[], scene: Scene) {
  for (const collision of collisions) {
    const marker = MeshBuilder.CreateSphere(
      `collision-marker-${collision.routeId}`,
      { diameter: 0.1 },
      scene
    );
    marker.position = collision.position;
    marker.material = new StandardMaterial('collision-mat', scene);
    (marker.material as StandardMaterial).diffuseColor = Color3.Red();
    (marker.material as StandardMaterial).alpha = 0.7;
  }
}
```

TESTING:
1. Create two routes that intersect → See collision warning
2. Move route to avoid intersection → Warning clears
3. Create route too close to another → Clearance violation warning
4. Create route intersecting wall → Obstacle collision warning
5. Performance test: 50 routes → collision check <100ms

SUCCESS CRITERIA:
- ✅ Route-to-route collision detection works
- ✅ Route-to-obstacle collision detection works
- ✅ Clearance violations detected
- ✅ Visual collision markers display
- ✅ Integration with RouteValidator
- ✅ Performance acceptable (>60 FPS with 50 routes)

DELIVERABLES:
- src/routing/validation/CollisionDetector.ts
- src/routing/validation/SpatialIndex.ts
- Visual collision markers
- Integration with RouteValidator
- Unit tests and performance benchmarks
```

---

## ⚠️ AGENT 6: Advanced Warnings

**Branch:** `feature/advanced-warnings`
**Current Progress:** 20%
**Target:** 100%
**Files:** `src/routing/validation/AdvancedValidation.ts` (new), Update `RouteValidator.ts`

```
TASK: Implement advanced validation rules beyond basic checks

CONTEXT:
- Basic validation exists (missing specs, invalid material)
- Need industry-specific validation rules
- Bend radius, pull points, support spacing, thermal derating

REQUIREMENTS:

1. **Bend Radius Validation**
   - Electrical: Min bend radius = 6× cable diameter
   - Pipe: Min bend radius = 3× pipe diameter
   - Cable tray: Min bend radius = 12× tray width
   - Conduit: Min bend radius = 6× conduit diameter

   ```typescript
   function validateBendRadius(route: Route): ValidationWarning[] {
     const warnings: ValidationWarning[] = [];
     const waypoints = route.getWaypoints();

     for (let i = 1; i < waypoints.length - 1; i++) {
       const p1 = waypoints[i - 1];
       const p2 = waypoints[i];
       const p3 = waypoints[i + 1];

       const radius = calculateBendRadius(p1, p2, p3);
       const minRadius = getMinBendRadius(route);

       if (radius < minRadius) {
         warnings.push({
           code: 'BEND_RADIUS_VIOLATION',
           message: `Bend radius ${radius.toFixed(0)}mm is less than minimum ${minRadius.toFixed(0)}mm at waypoint ${i}`,
           severity: 'error',
           position: p2,
         });
       }
     }

     return warnings;
   }
   ```

2. **Pull Point Spacing (Electrical)**
   - Max 30m between pull points
   - Max 3 bends between pull points
   - Max 270° total bend between pull points

   ```typescript
   function validatePullPoints(route: Route): ValidationWarning[] {
     if (route.type !== 'electrical') return [];

     const warnings: ValidationWarning[] = [];
     const segments = route.getSegments();

     let distanceSinceLastPull = 0;
     let bendsSinceLastPull = 0;
     let totalBendAngle = 0;

     for (const segment of segments) {
       distanceSinceLastPull += segment.length;

       if (segment.isBend) {
         bendsSinceLastPull++;
         totalBendAngle += segment.bendAngle;
       }

       // Check limits
       if (distanceSinceLastPull > 30) {
         warnings.push({
           code: 'PULL_POINT_SPACING',
           message: `Distance since last pull point exceeds 30m (${distanceSinceLastPull.toFixed(1)}m)`,
           severity: 'error',
         });
       }

       if (bendsSinceLastPull > 3) {
         warnings.push({
           code: 'EXCESSIVE_BENDS',
           message: `Too many bends between pull points (${bendsSinceLastPull})`,
           severity: 'error',
         });
       }

       if (totalBendAngle > 270) {
         warnings.push({
           code: 'TOTAL_BEND_ANGLE',
           message: `Total bend angle exceeds 270° (${totalBendAngle.toFixed(0)}°)`,
           severity: 'error',
         });
       }
     }

     return warnings;
   }
   ```

3. **Support Spacing**
   - Cable tray: Max 1.5m support spacing
   - Pipe (steel): Max 3m support spacing
   - Pipe (PVC): Max 1m support spacing
   - Conduit: Max 1.2m support spacing

   ```typescript
   function validateSupportSpacing(route: Route): ValidationWarning[] {
     const warnings: ValidationWarning[] = [];
     const maxSpacing = getMaxSupportSpacing(route);
     const suggestedSupports = Math.ceil(route.length / maxSpacing);

     // Check if route has support points defined
     const supports = route.getSupportPoints();

     if (supports.length < suggestedSupports) {
       warnings.push({
         code: 'INSUFFICIENT_SUPPORTS',
         message: `Route requires at least ${suggestedSupports} support points (currently ${supports.length})`,
         severity: 'warning',
         suggestion: `Add ${suggestedSupports - supports.length} more support points`,
       });
     }

     // Check spacing between supports
     for (let i = 1; i < supports.length; i++) {
       const spacing = Vector3.Distance(supports[i - 1], supports[i]);
       if (spacing > maxSpacing) {
         warnings.push({
           code: 'SUPPORT_SPACING_EXCESSIVE',
           message: `Support spacing ${spacing.toFixed(2)}m exceeds maximum ${maxSpacing}m`,
           severity: 'error',
           position: supports[i],
         });
       }
     }

     return warnings;
   }
   ```

4. **Thermal Derating (Electrical)**
   - Cable ampacity reduces when bundled with other cables
   - NEC derating factors
   - Temperature derating

   ```typescript
   function validateThermalDerating(route: Route): ValidationWarning[] {
     if (route.type !== 'electrical') return [];

     const warnings: ValidationWarning[] = [];
     const specs = route.getSpecifications();

     // Find other electrical routes nearby
     const nearbyRoutes = findNearbyElectricalRoutes(route, 0.3); // 300mm proximity

     if (nearbyRoutes.length > 0) {
       // Apply derating factor based on number of cables
       const deratingFactor = getDeratingFactor(nearbyRoutes.length + 1);
       const deratedCurrent = specs.current * deratingFactor;

       if (deratedCurrent < specs.ratedCurrent) {
         warnings.push({
           code: 'THERMAL_DERATING',
           message: `Cable ampacity derated to ${deratedCurrent.toFixed(1)}A due to ${nearbyRoutes.length} nearby cables (derating factor: ${deratingFactor})`,
           severity: 'warning',
           suggestion: 'Increase cable size or reduce bundling',
         });
       }
     }

     // Temperature derating
     const ambientTemp = route.getAmbientTemperature();
     if (ambientTemp > 30) {
       const tempDeratingFactor = getTemperatureDeratingFactor(ambientTemp);
       warnings.push({
         code: 'TEMPERATURE_DERATING',
         message: `High ambient temperature ${ambientTemp}°C requires derating factor ${tempDeratingFactor}`,
         severity: 'info',
       });
     }

     return warnings;
   }
   ```

5. **Code Compliance Checking**
   - NEC (National Electrical Code) rules
   - IPC (International Plumbing Code) rules
   - Configurable rule sets

   ```typescript
   interface ComplianceRule {
     code: string;
     name: string;
     category: RouteType;
     check: (route: Route) => ValidationWarning[];
   }

   const NEC_RULES: ComplianceRule[] = [
     {
       code: 'NEC-310.15',
       name: 'Ampacity Correction Factors',
       category: 'electrical',
       check: validateThermalDerating,
     },
     {
       code: 'NEC-358.28',
       name: 'EMT Bends',
       category: 'electrical',
       check: (route) => {
         // EMT specific rules
       },
     },
     // ... more rules
   ];
   ```

6. **Integration with RouteWarningsPanel**
   - Group warnings by severity
   - Group warnings by code section
   - Show rule reference (e.g., "NEC 310.15")
   - Link to code documentation

IMPLEMENTATION:

```typescript
// src/routing/validation/AdvancedValidation.ts
export class AdvancedValidation {
  static validateRoute(route: Route): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Run all validation checks
    warnings.push(...validateBendRadius(route));
    warnings.push(...validatePullPoints(route));
    warnings.push(...validateSupportSpacing(route));
    warnings.push(...validateThermalDerating(route));

    // Code compliance
    const rules = this.getApplicableRules(route);
    for (const rule of rules) {
      warnings.push(...rule.check(route));
    }

    return warnings;
  }

  private static getApplicableRules(route: Route): ComplianceRule[] {
    return NEC_RULES.filter(rule => rule.category === route.type);
  }
}

// Update RouteValidator.ts
import { AdvancedValidation } from './AdvancedValidation';

export function validateRoute(route: Route): EnhancedValidationResult {
  const result: EnhancedValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
    suggestions: [],
  };

  // Existing basic validation...

  // Advanced validation
  const advancedWarnings = AdvancedValidation.validateRoute(route);
  result.warnings.push(...advancedWarnings.filter(w => w.severity === 'warning'));
  result.errors.push(...advancedWarnings.filter(w => w.severity === 'error'));

  return result;
}
```

TESTING:
1. Create route with tight bend → Bend radius warning
2. Create long electrical route → Pull point spacing warning
3. Create cable tray without supports → Support spacing warning
4. Create bundled electrical routes → Thermal derating warning
5. Create route violating NEC rule → Code compliance warning

SUCCESS CRITERIA:
- ✅ Bend radius validation works
- ✅ Pull point spacing validated (electrical)
- ✅ Support spacing validated (all types)
- ✅ Thermal derating calculated
- ✅ Code compliance rules implemented
- ✅ Integration with RouteWarningsPanel

DELIVERABLES:
- src/routing/validation/AdvancedValidation.ts
- Updated RouteValidator.ts
- NEC/IPC rule sets (at least 10 rules)
- Enhanced RouteWarningsPanel with rule references
- Unit tests for all validation rules
```

---

## ✅ AGENT 7: Pre-Flight Validation

**Branch:** `feature/preflight-validation`
**Current Progress:** 0%
**Target:** 100%
**Files:** `src/routing/validation/PreFlightValidator.ts` (new), `src/routing/ui/PreFlightDialog.tsx` (new)

```
TASK: Create comprehensive pre-export validation checklist and auto-fix wizard

CONTEXT:
- Before exporting routes to CAD/BOM, validate everything
- Checklist of all validation rules
- Auto-fix wizard for common issues
- Validation report generation

REQUIREMENTS:

1. **Pre-Flight Validation Dialog**
   - Modal dialog before export
   - Checklist of all validation items
   - Green checkmark, yellow warning, red error icons
   - Auto-fix button for fixable issues
   - Skip/Proceed buttons

2. **Validation Checklist**
   ```typescript
   interface PreFlightCheck {
     id: string;
     name: string;
     category: 'critical' | 'important' | 'optional';
     check: (routes: Route[]) => PreFlightResult;
     autoFix?: (routes: Route[]) => void;
   }

   interface PreFlightResult {
     passed: boolean;
     issues: PreFlightIssue[];
   }

   interface PreFlightIssue {
     routeId: string;
     severity: 'error' | 'warning' | 'info';
     message: string;
     fixable: boolean;
   }
   ```

3. **Validation Checks**
   ```typescript
   const PRE_FLIGHT_CHECKS: PreFlightCheck[] = [
     // Critical
     {
       id: 'no-collisions',
       name: 'No route collisions',
       category: 'critical',
       check: (routes) => {
         const issues: PreFlightIssue[] = [];
         for (const route of routes) {
           const collisions = collisionDetector.detectCollisions(route);
           if (collisions.length > 0) {
             issues.push({
               routeId: route.getId(),
               severity: 'error',
               message: `${collisions.length} collision(s) detected`,
               fixable: true,
             });
           }
         }
         return { passed: issues.length === 0, issues };
       },
       autoFix: (routes) => {
         // Auto-reroute around collisions
       },
     },
     {
       id: 'all-specs-defined',
       name: 'All routes have specifications',
       category: 'critical',
       check: (routes) => {
         const issues: PreFlightIssue[] = [];
         for (const route of routes) {
           const specs = route.getSpecifications();
           if (!specs || Object.keys(specs).length === 0) {
             issues.push({
               routeId: route.getId(),
               severity: 'error',
               message: 'Missing specifications',
               fixable: false,
             });
           }
         }
         return { passed: issues.length === 0, issues };
       },
     },
     {
       id: 'materials-defined',
       name: 'All routes have materials',
       category: 'critical',
       check: (routes) => {
         const issues: PreFlightIssue[] = [];
         for (const route of routes) {
           if (!route.material) {
             issues.push({
               routeId: route.getId(),
               severity: 'error',
               message: 'No material assigned',
               fixable: true,
             });
           }
         }
         return { passed: issues.length === 0, issues };
       },
       autoFix: (routes) => {
         // Assign default materials
         for (const route of routes) {
           if (!route.material) {
             route.material = getDefaultMaterial(route.type);
           }
         }
       },
     },

     // Important
     {
       id: 'bend-radius-compliance',
       name: 'Bend radius compliance',
       category: 'important',
       check: (routes) => {
         const issues: PreFlightIssue[] = [];
         for (const route of routes) {
           const warnings = validateBendRadius(route);
           if (warnings.length > 0) {
             issues.push({
               routeId: route.getId(),
               severity: 'warning',
               message: `${warnings.length} bend radius violation(s)`,
               fixable: false,
             });
           }
         }
         return { passed: issues.length === 0, issues };
       },
     },
     {
       id: 'support-spacing',
       name: 'Support spacing adequate',
       category: 'important',
       check: (routes) => {
         const issues: PreFlightIssue[] = [];
         for (const route of routes) {
           const warnings = validateSupportSpacing(route);
           if (warnings.length > 0) {
             issues.push({
               routeId: route.getId(),
               severity: 'warning',
               message: 'Insufficient support points',
               fixable: true,
             });
           }
         }
         return { passed: issues.length === 0, issues };
       },
       autoFix: (routes) => {
         // Auto-add support points
         for (const route of routes) {
           addSupportPoints(route);
         }
       },
     },

     // Optional
     {
       id: 'cost-estimate',
       name: 'Cost estimate available',
       category: 'optional',
       check: (routes) => {
         const issues: PreFlightIssue[] = [];
         for (const route of routes) {
           const cost = route.getCostEstimate();
           if (!cost || cost === 0) {
             issues.push({
               routeId: route.getId(),
               severity: 'info',
               message: 'No cost estimate',
               fixable: true,
             });
           }
         }
         return { passed: true, issues }; // Always pass (optional)
       },
       autoFix: (routes) => {
         // Calculate costs
         for (const route of routes) {
           route.calculateCost();
         }
       },
     },
   ];
   ```

4. **Pre-Flight Dialog UI**
   ```tsx
   export const PreFlightDialog: React.FC<{
     routes: Route[];
     onProceed: () => void;
     onCancel: () => void;
   }> = ({ routes, onProceed, onCancel }) => {
     const [results, setResults] = useState<Map<string, PreFlightResult>>(new Map());
     const [running, setRunning] = useState(false);

     useEffect(() => {
       runPreFlightChecks();
     }, []);

     const runPreFlightChecks = async () => {
       setRunning(true);
       const newResults = new Map<string, PreFlightResult>();

       for (const check of PRE_FLIGHT_CHECKS) {
         const result = check.check(routes);
         newResults.set(check.id, result);
       }

       setResults(newResults);
       setRunning(false);
     };

     const handleAutoFix = (check: PreFlightCheck) => {
       if (check.autoFix) {
         check.autoFix(routes);
         runPreFlightChecks();
       }
     };

     const canProceed = () => {
       // All critical checks must pass
       for (const check of PRE_FLIGHT_CHECKS) {
         if (check.category === 'critical') {
           const result = results.get(check.id);
           if (result && !result.passed) return false;
         }
       }
       return true;
     };

     return (
       <div className="preflight-dialog">
         <h2>Pre-Flight Validation</h2>
         <p>Validating {routes.length} routes before export...</p>

         {running && <Spinner />}

         <div className="checks-list">
           {PRE_FLIGHT_CHECKS.map(check => {
             const result = results.get(check.id);
             const icon = result
               ? result.passed
                 ? <CheckCircle className="text-green-600" />
                 : result.issues.some(i => i.severity === 'error')
                   ? <XCircle className="text-red-600" />
                   : <AlertTriangle className="text-yellow-600" />
               : <Circle className="text-gray-400" />;

             return (
               <div key={check.id} className="check-item">
                 <div className="flex items-center gap-2">
                   {icon}
                   <span className={`font-medium ${check.category === 'critical' ? 'text-red-600' : ''}`}>
                     {check.name}
                   </span>
                   {check.category === 'critical' && <span className="badge">REQUIRED</span>}
                 </div>

                 {result && result.issues.length > 0 && (
                   <div className="issues-list">
                     {result.issues.map((issue, i) => (
                       <div key={i} className="issue-item">
                         <span>{issue.message}</span>
                         {issue.fixable && check.autoFix && (
                           <button
                             onClick={() => handleAutoFix(check)}
                             className="btn-autofix"
                           >
                             Auto-Fix
                           </button>
                         )}
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             );
           })}
         </div>

         <div className="dialog-actions">
           <button onClick={onCancel} className="btn-secondary">
             Cancel
           </button>
           <button
             onClick={onProceed}
             disabled={!canProceed()}
             className="btn-primary"
           >
             {canProceed() ? 'Proceed' : 'Fix Critical Issues First'}
           </button>
         </div>
       </div>
     );
   };
   ```

5. **Validation Report Generation**
   - PDF report of all validation results
   - Checklist with pass/fail status
   - Issue descriptions and locations
   - Screenshots of problem areas
   - Export report with routes

6. **Integration with Export Flow**
   - Show PreFlightDialog before export
   - Block export if critical checks fail
   - Allow export with warnings (user confirmation)
   - Include validation report in export package

IMPLEMENTATION:

```typescript
// In export flow (e.g., GLBExportService)
export async function exportRoutes(routes: Route[]) {
  // Show pre-flight dialog
  const proceed = await showPreFlightDialog(routes);

  if (!proceed) {
    console.log('Export cancelled by user');
    return;
  }

  // Generate validation report
  const report = generateValidationReport(routes);

  // Export routes
  const glbData = await exportRoutesToGLB(routes);

  // Package with report
  const exportPackage = {
    glb: glbData,
    validationReport: report,
    timestamp: new Date().toISOString(),
  };

  downloadExportPackage(exportPackage);
}
```

TESTING:
1. Export with all checks passing → Proceed enabled
2. Export with critical issue → Proceed disabled
3. Export with warning → Proceed enabled with confirmation
4. Click Auto-Fix → Issue resolves, check re-runs
5. Generate report → PDF downloaded

SUCCESS CRITERIA:
- ✅ Pre-flight dialog displays correctly
- ✅ All checks execute without errors
- ✅ Auto-fix works for fixable issues
- ✅ Critical checks block export
- ✅ Validation report generated
- ✅ Integration with export flow

DELIVERABLES:
- src/routing/validation/PreFlightValidator.ts
- src/routing/ui/PreFlightDialog.tsx
- Validation report generator
- Integration with GLBExportService
- Unit tests for all checks
```

---

## 📁 AGENT 8: Template System Expansion

**Branch:** `feature/template-expansion`
**Current Progress:** 30%
**Target:** 100%
**Files:** `src/routing/templates/`, `src/routing/ui/TemplateEditor.tsx` (new)

```
TASK: Expand template library and add user template creation

CONTEXT:
- Basic templates exist (3 categories)
- Need 20+ pre-built templates
- User-created templates
- Template import/export
- Template thumbnails

REQUIREMENTS:

1. **Create 20+ Pre-Built Templates**
   - 7 electrical templates
   - 7 piping templates
   - 6 structured cabling templates

   Template structure:
   ```json
   {
     "id": "template_electrical_office_120v",
     "name": "Office 120V Circuit",
     "category": "electrical",
     "subcategory": "power",
     "description": "Standard office 120V 15A circuit for receptacles",
     "thumbnail": "/templates/thumbnails/office-120v.png",
     "specifications": {
       "voltage": 120,
       "current": 15,
       "wireGauge": "14 AWG",
       "material": "copper_wire_awg_14",
       "plugType": "NEMA_5-15",
       "conduitSize": 20,
       "color": "#FF6B35"
     },
     "defaultLength": 15,
     "tags": ["office", "power", "120v", "receptacle"],
     "author": "kinetiCORE",
     "version": "1.0",
     "createdAt": "2025-01-01T00:00:00Z"
   }
   ```

2. **Electrical Templates (7)**
   - Office 120V 15A Circuit
   - Office 120V 20A Circuit
   - Industrial 240V 3-Phase Circuit
   - Data Center 208V Circuit
   - Emergency Lighting Circuit
   - HVAC Equipment Circuit
   - Industrial Control Circuit

3. **Piping Templates (7)**
   - Potable Water 50mm
   - Drainage 100mm
   - Compressed Air 40mm
   - Natural Gas 25mm
   - Chilled Water 80mm
   - Fire Sprinkler 65mm
   - Industrial Process Pipe

4. **Structured Cabling Templates (6)**
   - Cat6 Data Cable Tray
   - Fiber Optic Cable Tray
   - Coax Cable Tray
   - Mixed Media Cable Tray
   - Vertical Riser Tray
   - Horizontal Distribution Tray

5. **Template Editor Component**
   - Create new template from existing route
   - Edit template specifications
   - Generate thumbnail (auto-screenshot)
   - Save template to library
   - Delete custom templates

6. **User Template Creation**
   ```tsx
   export const TemplateEditor: React.FC<{
     route?: Route; // If editing existing route
     onSave: (template: Template) => void;
     onCancel: () => void;
   }> = ({ route, onSave, onCancel }) => {
     const [name, setName] = useState(route?.name || '');
     const [description, setDescription] = useState('');
     const [category, setCategory] = useState<RouteType>('electrical');
     const [specifications, setSpecifications] = useState(route?.getSpecifications() || {});
     const [tags, setTags] = useState<string[]>([]);
     const [thumbnail, setThumbnail] = useState<string | null>(null);

     const handleGenerateThumbnail = async () => {
       if (route) {
         const screenshot = await captureRouteScreenshot(route);
         setThumbnail(screenshot);
       }
     };

     const handleSave = () => {
       const template: Template = {
         id: `template_user_${Date.now()}`,
         name,
         category,
         subcategory: 'custom',
         description,
         thumbnail: thumbnail || '/templates/default-thumbnail.png',
         specifications,
         defaultLength: route?.length || 10,
         tags,
         author: 'user',
         version: '1.0',
         createdAt: new Date().toISOString(),
       };

       onSave(template);
     };

     return (
       <div className="template-editor">
         <h2>Create Template</h2>

         <div className="form-group">
           <label>Template Name</label>
           <input
             type="text"
             value={name}
             onChange={(e) => setName(e.target.value)}
             placeholder="e.g., My Custom Electrical Circuit"
           />
         </div>

         <div className="form-group">
           <label>Description</label>
           <textarea
             value={description}
             onChange={(e) => setDescription(e.target.value)}
             placeholder="Describe when to use this template..."
           />
         </div>

         <div className="form-group">
           <label>Category</label>
           <select value={category} onChange={(e) => setCategory(e.target.value as RouteType)}>
             <option value="electrical">Electrical</option>
             <option value="pipe">Pipe</option>
             <option value="cable_tray">Cable Tray</option>
             <option value="conduit">Conduit</option>
           </select>
         </div>

         <div className="form-group">
           <label>Specifications</label>
           <SpecificationEditor
             value={specifications}
             onChange={setSpecifications}
             routeType={category}
           />
         </div>

         <div className="form-group">
           <label>Tags (comma separated)</label>
           <input
             type="text"
             value={tags.join(', ')}
             onChange={(e) => setTags(e.target.value.split(',').map(t => t.trim()))}
             placeholder="e.g., office, power, 120v"
           />
         </div>

         <div className="form-group">
           <label>Thumbnail</label>
           {thumbnail ? (
             <img src={thumbnail} alt="Template thumbnail" className="thumbnail-preview" />
           ) : (
             <button onClick={handleGenerateThumbnail} className="btn-secondary">
               Generate Thumbnail
             </button>
           )}
         </div>

         <div className="dialog-actions">
           <button onClick={onCancel} className="btn-secondary">
             Cancel
           </button>
           <button onClick={handleSave} className="btn-primary">
             Save Template
           </button>
         </div>
       </div>
     );
   };
   ```

7. **Template Import/Export**
   - Export templates as JSON files
   - Import templates from JSON
   - Share templates with team
   - Template marketplace (future)

8. **Template Management**
   - Search templates by name/tags
   - Filter by category
   - Sort by usage/date/name
   - Delete custom templates
   - Favorite templates

9. **Integration with RouteTemplatesPanel**
   - Grid view with thumbnails
   - List view with details
   - Search bar
   - Category filter
   - "Create Template" button → opens TemplateEditor

IMPLEMENTATION:

```typescript
// src/routing/templates/TemplateManager.ts
export class TemplateManager {
  private static templates: Template[] = [];
  private static readonly STORAGE_KEY = 'kineticore_user_templates';

  static async loadTemplates(): Promise<void> {
    // Load built-in templates
    const builtIn = await fetch('/templates/built-in.json');
    const builtInTemplates = await builtIn.json();

    // Load user templates from localStorage
    const userTemplates = this.loadUserTemplates();

    this.templates = [...builtInTemplates, ...userTemplates];
  }

  static getTemplatesByCategory(category: RouteType): Template[] {
    return this.templates.filter(t => t.category === category);
  }

  static searchTemplates(query: string): Template[] {
    const lower = query.toLowerCase();
    return this.templates.filter(t =>
      t.name.toLowerCase().includes(lower) ||
      t.tags.some(tag => tag.toLowerCase().includes(lower))
    );
  }

  static saveUserTemplate(template: Template): void {
    this.templates.push(template);
    this.saveUserTemplates();
  }

  static deleteUserTemplate(id: string): void {
    this.templates = this.templates.filter(t => t.id !== id || t.author !== 'user');
    this.saveUserTemplates();
  }

  private static loadUserTemplates(): Template[] {
    try {
      const json = localStorage.getItem(this.STORAGE_KEY);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  private static saveUserTemplates(): void {
    const userTemplates = this.templates.filter(t => t.author === 'user');
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(userTemplates));
  }

  static exportTemplates(templateIds: string[]): string {
    const templatesTo export = this.templates.filter(t => templateIds.includes(t.id));
    return JSON.stringify(templatesToExport, null, 2);
  }

  static importTemplates(json: string): void {
    try {
      const imported = JSON.parse(json) as Template[];
      for (const template of imported) {
        template.id = `template_imported_${Date.now()}_${Math.random()}`;
        this.saveUserTemplate(template);
      }
    } catch (error) {
      console.error('[TemplateManager] Import failed:', error);
    }
  }
}
```

TESTING:
1. Load templates panel → See 20+ templates
2. Search for "office" → See office templates
3. Filter by "electrical" → See electrical templates only
4. Create route, click "Save as Template" → Template editor opens
5. Save template → Appears in templates list
6. Export template → JSON file downloaded
7. Import template → Template added to library

SUCCESS CRITERIA:
- ✅ 20+ pre-built templates created
- ✅ Template editor functional
- ✅ User can create custom templates
- ✅ Template import/export works
- ✅ Template search/filter works
- ✅ Thumbnails display correctly

DELIVERABLES:
- src/routing/templates/built-in.json (20+ templates)
- src/routing/templates/TemplateManager.ts
- src/routing/ui/TemplateEditor.tsx
- Template thumbnails (20+ images)
- Enhanced RouteTemplatesPanel
- Unit tests
```

---

## ✏️ AGENT 9: Route Editing Enhancements

**Branch:** `feature/route-editing-enhancements`
**Current Progress:** 0%
**Target:** 100%
**Files:** `src/routing/commands/`, `src/routing/ui/RouteEditPanel.tsx`

```
TASK: Add multi-route selection, bulk edit, copy/paste, mirror, array operations

CONTEXT:
- Currently can only select one route at a time
- Need multi-select for bulk operations
- Copy/paste for duplicating routes
- Mirror for symmetrical layouts
- Array for repeating routes

REQUIREMENTS:

1. **Multi-Route Selection**
   - Shift+Click to select multiple routes
   - Ctrl+Click to add/remove from selection
   - Click-drag box selection (lasso)
   - Select All (Ctrl+A)
   - Deselect All (Esc)

   ```typescript
   // In selection manager
   export class RouteSelectionManager {
     private selectedRoutes: Set<string> = new Set();

     selectRoute(routeId: string, addToSelection = false): void {
       if (!addToSelection) {
         this.selectedRoutes.clear();
       }
       this.selectedRoutes.add(routeId);
       this.notifySelectionChanged();
     }

     deselectRoute(routeId: string): void {
       this.selectedRoutes.delete(routeId);
       this.notifySelectionChanged();
     }

     selectMultiple(routeIds: string[]): void {
       routeIds.forEach(id => this.selectedRoutes.add(id));
       this.notifySelectionChanged();
     }

     selectAll(): void {
       const allRoutes = useRoutingStore.getState().activeRoutes;
       allRoutes.forEach(r => this.selectedRoutes.add(r.getId()));
       this.notifySelectionChanged();
     }

     deselectAll(): void {
       this.selectedRoutes.clear();
       this.notifySelectionChanged();
     }

     getSelection(): string[] {
       return Array.from(this.selectedRoutes);
     }
   }
   ```

2. **Bulk Edit Operations**
   - Change route type for all selected
   - Change material for all selected
   - Change specifications for all selected
   - Delete all selected

   ```tsx
   // In RouteEditPanel
   {selectedRoutes.length > 1 && (
     <div className="bulk-edit-panel">
       <h3>Bulk Edit ({selectedRoutes.length} routes selected)</h3>

       <div className="form-group">
         <label>Change Route Type</label>
         <select onChange={handleBulkTypeChange}>
           <option value="">-- Select Type --</option>
           <option value="electrical">Electrical</option>
           <option value="pipe">Pipe</option>
           <option value="cable_tray">Cable Tray</option>
           <option value="conduit">Conduit</option>
         </select>
       </div>

       <div className="form-group">
         <label>Change Material</label>
         <select onChange={handleBulkMaterialChange}>
           <option value="">-- Select Material --</option>
           {materials.map(m => (
             <option key={m.id} value={m.id}>{m.name}</option>
           ))}
         </select>
       </div>

       <button onClick={handleBulkDelete} className="btn-danger">
         Delete All Selected
       </button>
     </div>
   )}
   ```

3. **Copy/Paste Routes**
   - Ctrl+C to copy selected routes
   - Ctrl+V to paste with offset
   - Clipboard stores route data
   - Paste creates new routes with new IDs

   ```typescript
   export class RouteClipboard {
     private static clipboard: Route[] = [];

     static copy(routes: Route[]): void {
       this.clipboard = routes.map(r => r.clone());
       console.log(`[Clipboard] Copied ${routes.length} routes`);
     }

     static paste(offset: Vector3 = new Vector3(1, 0, 0)): Route[] {
       const pastedRoutes: Route[] = [];

       for (const route of this.clipboard) {
         const newRoute = route.clone();
         newRoute.id = `route_${Date.now()}_${Math.random()}`;

         // Offset position
         newRoute.source.position = newRoute.source.position.add(offset);
         newRoute.destination.position = newRoute.destination.position.add(offset);

         pastedRoutes.push(newRoute);
       }

       console.log(`[Clipboard] Pasted ${pastedRoutes.length} routes`);
       return pastedRoutes;
     }

     static isEmpty(): boolean {
       return this.clipboard.length === 0;
     }
   }

   // Keyboard shortcuts
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if (e.ctrlKey && e.key === 'c') {
         const selected = selectionManager.getSelection();
         if (selected.length > 0) {
           RouteClipboard.copy(selected.map(id => getRoute(id)));
         }
       }

       if (e.ctrlKey && e.key === 'v') {
         if (!RouteClipboard.isEmpty()) {
           const pasted = RouteClipboard.paste();
           // Add to scene
           pasted.forEach(r => useRoutingStore.getState().addRoute(r));
         }
       }
     };

     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, []);
   ```

4. **Mirror Routes**
   - Mirror along X, Y, or Z axis
   - Mirror about a plane
   - Mirror selected routes

   ```typescript
   export class RouteMirror {
     static mirrorAlongAxis(
       routes: Route[],
       axis: 'x' | 'y' | 'z',
       mirrorPlane: number = 0
     ): Route[] {
       return routes.map(route => {
         const mirrored = route.clone();
         mirrored.id = `route_mirror_${Date.now()}_${Math.random()}`;

         // Mirror source position
         const srcPos = mirrored.source.position;
         if (axis === 'x') {
           mirrored.source.position = new Vector3(
             2 * mirrorPlane - srcPos.x,
             srcPos.y,
             srcPos.z
           );
         } else if (axis === 'y') {
           mirrored.source.position = new Vector3(
             srcPos.x,
             2 * mirrorPlane - srcPos.y,
             srcPos.z
           );
         } else {
           mirrored.source.position = new Vector3(
             srcPos.x,
             srcPos.y,
             2 * mirrorPlane - srcPos.z
           );
         }

         // Mirror destination position
         const dstPos = mirrored.destination.position;
         if (axis === 'x') {
           mirrored.destination.position = new Vector3(
             2 * mirrorPlane - dstPos.x,
             dstPos.y,
             dstPos.z
           );
         } else if (axis === 'y') {
           mirrored.destination.position = new Vector3(
             dstPos.x,
             2 * mirrorPlane - dstPos.y,
             dstPos.z
           );
         } else {
           mirrored.destination.position = new Vector3(
             dstPos.x,
             dstPos.y,
             2 * mirrorPlane - dstPos.z
           );
         }

         return mirrored;
       });
     }
   }

   // UI
   <button onClick={() => {
     const selected = selectionManager.getSelection().map(id => getRoute(id));
     const mirrored = RouteMirror.mirrorAlongAxis(selected, 'x');
     mirrored.forEach(r => useRoutingStore.getState().addRoute(r));
   }}>
     Mirror Along X
   </button>
   ```

5. **Array (Duplicate with Offset)**
   - Linear array (repeat along a line)
   - Rectangular array (grid pattern)
   - Circular array (around a point)

   ```typescript
   export class RouteArray {
     static linearArray(
       routes: Route[],
       count: number,
       offset: Vector3
     ): Route[] {
       const arrayed: Route[] = [];

       for (let i = 1; i <= count; i++) {
         for (const route of routes) {
           const copy = route.clone();
           copy.id = `route_array_${i}_${Date.now()}_${Math.random()}`;

           // Apply offset
           const totalOffset = offset.scale(i);
           copy.source.position = copy.source.position.add(totalOffset);
           copy.destination.position = copy.destination.position.add(totalOffset);

           arrayed.push(copy);
         }
       }

       return arrayed;
     }

     static rectangularArray(
       routes: Route[],
       rows: number,
       columns: number,
       rowSpacing: number,
       columnSpacing: number
     ): Route[] {
       const arrayed: Route[] = [];

       for (let row = 0; row < rows; row++) {
         for (let col = 0; col < columns; col++) {
           if (row === 0 && col === 0) continue; // Skip original

           for (const route of routes) {
             const copy = route.clone();
             copy.id = `route_array_${row}_${col}_${Date.now()}`;

             const offset = new Vector3(
               col * columnSpacing,
               row * rowSpacing,
               0
             );

             copy.source.position = copy.source.position.add(offset);
             copy.destination.position = copy.destination.position.add(offset);

             arrayed.push(copy);
           }
         }
       }

       return arrayed;
     }
   }

   // UI
   <div className="array-dialog">
     <h3>Array Routes</h3>

     <div className="form-group">
       <label>Array Type</label>
       <select value={arrayType} onChange={(e) => setArrayType(e.target.value)}>
         <option value="linear">Linear</option>
         <option value="rectangular">Rectangular</option>
         <option value="circular">Circular</option>
       </select>
     </div>

     {arrayType === 'linear' && (
       <>
         <div className="form-group">
           <label>Count</label>
           <input type="number" value={arrayCount} onChange={e => setArrayCount(+e.target.value)} />
         </div>
         <div className="form-group">
           <label>Offset X (m)</label>
           <input type="number" value={offsetX} onChange={e => setOffsetX(+e.target.value)} />
         </div>
         <div className="form-group">
           <label>Offset Y (m)</label>
           <input type="number" value={offsetY} onChange={e => setOffsetY(+e.target.value)} />
         </div>
       </>
     )}

     {arrayType === 'rectangular' && (
       <>
         <div className="form-group">
           <label>Rows</label>
           <input type="number" value={rows} onChange={e => setRows(+e.target.value)} />
         </div>
         <div className="form-group">
           <label>Columns</label>
           <input type="number" value={columns} onChange={e => setColumns(+e.target.value)} />
         </div>
         <div className="form-group">
           <label>Row Spacing (m)</label>
           <input type="number" value={rowSpacing} onChange={e => setRowSpacing(+e.target.value)} />
         </div>
         <div className="form-group">
           <label>Column Spacing (m)</label>
           <input type="number" value={colSpacing} onChange={e => setColSpacing(+e.target.value)} />
         </div>
       </>
     )}

     <button onClick={handleCreateArray} className="btn-primary">
       Create Array
     </button>
   </div>
   ```

6. **Command Pattern Integration**
   - BulkEditCommand (undo/redo bulk edits)
   - CopyPasteCommand
   - MirrorCommand
   - ArrayCommand

IMPLEMENTATION:

```typescript
// src/routing/commands/BulkEditCommand.ts
export class BulkEditCommand implements Command {
  constructor(
    private routeIds: string[],
    private property: string,
    private oldValues: Map<string, any>,
    private newValue: any
  ) {}

  execute(): void {
    for (const id of this.routeIds) {
      const route = getRoute(id);
      if (route) {
        (route as any)[this.property] = this.newValue;
      }
    }
  }

  undo(): void {
    for (const id of this.routeIds) {
      const route = getRoute(id);
      if (route) {
        (route as any)[this.property] = this.oldValues.get(id);
      }
    }
  }
}
```

TESTING:
1. Select 3 routes → See bulk edit panel
2. Change type to "pipe" → All 3 routes become pipes
3. Copy 2 routes (Ctrl+C), paste (Ctrl+V) → 2 new routes appear
4. Select 1 route, mirror along X → Mirrored route appears
5. Select 1 route, linear array (5 copies, 2m offset) → 5 copies appear in line
6. Select 2 routes, rectangular array (3×3) → 18 copies appear in grid

SUCCESS CRITERIA:
- ✅ Multi-route selection works (Shift, Ctrl, box selection)
- ✅ Bulk edit works for type, material, specs
- ✅ Copy/paste works with keyboard shortcuts
- ✅ Mirror along X/Y/Z works
- ✅ Linear array works
- ✅ Rectangular array works
- ✅ All operations support undo/redo

DELIVERABLES:
- src/routing/selection/RouteSelectionManager.ts
- src/routing/clipboard/RouteClipboard.ts
- src/routing/transforms/RouteMirror.ts
- src/routing/transforms/RouteArray.ts
- src/routing/commands/BulkEditCommand.ts, CopyPasteCommand.ts, MirrorCommand.ts, ArrayCommand.ts
- Enhanced RouteEditPanel with bulk edit
- UI components for array dialogs
- Unit tests
```

---

## 📍 AGENT 10: Waypoint System

**Branch:** `feature/waypoint-system`
**Current Progress:** 0%
**Target:** 100%
**Files:** `src/routing/waypoints/`, `src/routing/ui/WaypointEditor.tsx` (new)

```
TASK: Implement intermediate waypoints for route path control

CONTEXT:
- Routes currently go straight from source to destination
- Need intermediate waypoints to control path
- Drag waypoints to adjust route
- Auto-waypoints for obstacle avoidance

REQUIREMENTS:

1. **Waypoint Data Structure**
   ```typescript
   interface Waypoint {
     id: string;
     position: Vector3;
     type: 'manual' | 'auto' | 'support';
     constraints?: WaypointConstraint[];
   }

   enum WaypointConstraint {
     OnGrid = 'on-grid',
     OnSurface = 'on-surface',
     Vertical = 'vertical',
     Horizontal = 'horizontal',
   }

   // Add to Route class
   class Route {
     // ...existing fields
     waypoints: Waypoint[] = [];

     getWaypoints(): Waypoint[] {
       // Return full path: [source, ...waypoints, destination]
       return [
         { id: 'src', position: this.source.position, type: 'manual' },
         ...this.waypoints,
         { id: 'dst', position: this.destination.position, type: 'manual' },
       ];
     }

     addWaypoint(position: Vector3, type: WaypointType = 'manual'): Waypoint {
       const waypoint: Waypoint = {
         id: `waypoint_${Date.now()}_${Math.random()}`,
         position,
         type,
       };
       this.waypoints.push(waypoint);
       return waypoint;
     }

     removeWaypoint(id: string): void {
       this.waypoints = this.waypoints.filter(w => w.id !== id);
     }

     moveWaypoint(id: string, newPosition: Vector3): void {
       const waypoint = this.waypoints.find(w => w.id === id);
       if (waypoint) {
         waypoint.position = newPosition;
       }
     }
   }
   ```

2. **Visual Waypoint Markers**
   - 3D sphere at waypoint position
   - Color-coded by type (manual: blue, auto: green, support: yellow)
   - Click to select waypoint
   - Drag to move waypoint
   - Right-click to delete waypoint

   ```typescript
   export class WaypointRenderer {
     private waypoint Meshes: Map<string, Mesh> = new Map();

     renderWaypoints(route: Route, scene: Scene): void {
       // Clear existing
       this.clearWaypoints();

       // Render new waypoints
       for (const waypoint of route.waypoints) {
         const mesh = MeshBuilder.CreateSphere(
           `waypoint-${waypoint.id}`,
           { diameter: 0.15 },
           scene
         );
         mesh.position = waypoint.position;

         const material = new StandardMaterial(`waypoint-mat-${waypoint.id}`, scene);
         material.diffuseColor = this.getWaypointColor(waypoint.type);
         material.emissiveColor = material.diffuseColor.scale(0.3);
         mesh.material = material;

         // Make draggable
         this.makeDraggable(mesh, waypoint, route);

         this.waypointMeshes.set(waypoint.id, mesh);
       }
     }

     private getWaypointColor(type: WaypointType): Color3 {
       switch (type) {
         case 'manual': return Color3.Blue();
         case 'auto': return Color3.Green();
         case 'support': return Color3.Yellow();
       }
     }

     private makeDraggable(mesh: Mesh, waypoint: Waypoint, route: Route): void {
       const pointerDragBehavior = new PointerDragBehavior({ dragPlaneNormal: new Vector3(0, 1, 0) });

       pointerDragBehavior.onDragObservable.add((event) => {
         route.moveWaypoint(waypoint.id, mesh.position);
         // Update route geometry
         route.regenerateGeometry();
       });

       mesh.addBehavior(pointerDragBehavior);
     }

     clearWaypoints(): void {
       this.waypointMeshes.forEach(mesh => mesh.dispose());
       this.waypointMeshes.clear();
     }
   }
   ```

3. **Add Waypoint Interaction**
   - Click on route path to add waypoint
   - Waypoint inserted at clicked position
   - Route splits into segments

   ```typescript
   // In route interaction handler
   const handleRouteClick = (pickInfo: PickingInfo) => {
     if (!pickInfo.hit || !pickInfo.pickedMesh) return;

     const routeId = pickInfo.pickedMesh.metadata?.routeId;
     if (!routeId) return;

     const route = getRoute(routeId);
     if (!route) return;

     // Add waypoint at click position
     const waypoint = route.addWaypoint(pickInfo.pickedPoint);

     // Regenerate route geometry with waypoint
     route.regenerateGeometry();

     // Render waypoint marker
     waypointRenderer.renderWaypoints(route, scene);
   };
   ```

4. **Waypoint Constraints**
   - On-Grid: Snap waypoint to grid points
   - On-Surface: Constrain waypoint to a surface (wall, ceiling, floor)
   - Vertical: Only allow vertical movement
   - Horizontal: Only allow horizontal movement

   ```typescript
   export class WaypointConstraints {
     static applyOnGridConstraint(position: Vector3, gridSize: number): Vector3 {
       return new Vector3(
         Math.round(position.x / gridSize) * gridSize,
         Math.round(position.y / gridSize) * gridSize,
         Math.round(position.z / gridSize) * gridSize
       );
     }

     static applyOnSurfaceConstraint(
       position: Vector3,
       surfaceMesh: Mesh,
       scene: Scene
     ): Vector3 {
       // Raycast from position to find closest point on surface
       const ray = new Ray(position, new Vector3(0, -1, 0), 100);
       const hit = scene.pickWithRay(ray, (mesh) => mesh === surfaceMesh);

       if (hit?.hit && hit.pickedPoint) {
         return hit.pickedPoint;
       }

       return position;
     }

     static applyVerticalConstraint(
       position: Vector3,
       originalPosition: Vector3
     ): Vector3 {
       return new Vector3(
         originalPosition.x,
         position.y,
         originalPosition.z
       );
     }

     static applyHorizontalConstraint(
       position: Vector3,
       originalPosition: Vector3
     ): Vector3 {
       return new Vector3(
         position.x,
         originalPosition.y,
         position.z
       );
     }
   }
   ```

5. **Auto-Waypoints for Obstacle Avoidance**
   - Detect obstacles in route path
   - Auto-insert waypoints to go around
   - Use A* pathfinding algorithm

   ```typescript
   export class AutoWaypointGenerator {
     static generateForObstacleAvoidance(
       route: Route,
       obstacles: Mesh[],
       scene: Scene
     ): Waypoint[] {
       const start = route.source.position;
       const end = route.destination.position;

       // Check if straight path is clear
       if (this.isPathClear(start, end, obstacles, scene)) {
         return []; // No waypoints needed
       }

       // Use A* to find path around obstacles
       const path = this.findPath(start, end, obstacles, scene);

       // Convert path points to waypoints
       return path.slice(1, -1).map((point, i) => ({
         id: `auto_waypoint_${i}`,
         position: point,
         type: 'auto',
       }));
     }

     private static isPathClear(
       start: Vector3,
       end: Vector3,
       obstacles: Mesh[],
       scene: Scene
     ): boolean {
       const direction = end.subtract(start).normalize();
       const distance = Vector3.Distance(start, end);
       const ray = new Ray(start, direction, distance);

       const hit = scene.pickWithRay(ray, (mesh) => obstacles.includes(mesh));

       return !hit?.hit;
     }

     private static findPath(
       start: Vector3,
       end: Vector3,
       obstacles: Mesh[],
       scene: Scene
     ): Vector3[] {
       // A* pathfinding implementation
       // (Simplified - full implementation would use octree grid)

       const grid = this.createNavigationGrid(scene.getBoundingInfo(), 0.5);
       const startNode = grid.getClosestNode(start);
       const endNode = grid.getClosestNode(end);

       const path = AStar.findPath(startNode, endNode, (node) => {
         // Check if node position intersects obstacles
         return !this.intersectsObstacles(node.position, obstacles, scene);
       });

       return path.map(node => node.position);
     }
   }
   ```

6. **Waypoint Editor UI**
   - List of waypoints for selected route
   - Add/remove waypoints
   - Set waypoint constraints
   - Auto-generate waypoints button

   ```tsx
   export const WaypointEditor: React.FC<{
     route: Route;
   }> = ({ route }) => {
     const [waypoints, setWaypoints] = useState(route.waypoints);

     const handleAddWaypoint = () => {
       // Add waypoint at midpoint of last segment
       const lastWaypoint = waypoints[waypoints.length - 1] || route.source;
       const dest = route.destination;
       const midpoint = Vector3.Lerp(lastWaypoint.position, dest.position, 0.5);

       const newWaypoint = route.addWaypoint(midpoint);
       setWaypoints([...waypoints, newWaypoint]);
       route.regenerateGeometry();
     };

     const handleRemoveWaypoint = (id: string) => {
       route.removeWaypoint(id);
       setWaypoints(waypoints.filter(w => w.id !== id));
       route.regenerateGeometry();
     };

     const handleAutoGenerate = () => {
       const obstacles = scene.meshes.filter(m => m.metadata?.isObstacle);
       const autoWaypoints = AutoWaypointGenerator.generateForObstacleAvoidance(
         route,
         obstacles,
         scene
       );

       route.waypoints = autoWaypoints;
       setWaypoints(autoWaypoints);
       route.regenerateGeometry();
     };

     return (
       <div className="waypoint-editor">
         <h3>Waypoints</h3>

         <div className="waypoints-list">
           {waypoints.map((waypoint, i) => (
             <div key={waypoint.id} className="waypoint-item">
               <span>Waypoint {i + 1}</span>
               <span className="waypoint-type">{waypoint.type}</span>
               <button onClick={() => handleRemoveWaypoint(waypoint.id)} className="btn-icon">
                 <Trash2 className="w-4 h-4" />
               </button>
             </div>
           ))}
         </div>

         <div className="waypoint-actions">
           <button onClick={handleAddWaypoint} className="btn-secondary">
             <Plus className="w-4 h-4" /> Add Waypoint
           </button>
           <button onClick={handleAutoGenerate} className="btn-secondary">
             <Zap className="w-4 h-4" /> Auto-Generate
           </button>
         </div>
       </div>
     );
   };
   ```

7. **Path Smoothing**
   - Smooth waypoint path with curves
   - Catmull-Rom splines
   - Respect bend radius constraints

IMPLEMENTATION:

```typescript
// In Route class
regenerateGeometry(): void {
  if (!this.mesh) return;

  // Get full path including waypoints
  const pathPoints = this.getWaypoints().map(w => w.position);

  // Create path mesh
  const path = Path3D(pathPoints);

  // Generate route geometry along path
  if (this.type === 'pipe') {
    this.mesh = MeshBuilder.CreateTube(
      `route-${this.id}`,
      {
        path: pathPoints,
        radius: this.getDiameter() / 2,
        tessellation: 16,
        cap: Mesh.CAP_ALL,
      },
      scene
    );
  }
  // ... other route types

  // Apply material
  this.mesh.material = this.getMaterial();
  this.mesh.metadata = { routeId: this.id };
}
```

TESTING:
1. Select route, click on path → Waypoint added
2. Drag waypoint → Route updates
3. Right-click waypoint → Waypoint removed
4. Add route that intersects wall → Click auto-generate → Waypoints added to avoid wall
5. Add waypoint with on-grid constraint → Waypoint snaps to grid

SUCCESS CRITERIA:
- ✅ Waypoints can be added to routes
- ✅ Waypoints can be dragged and moved
- ✅ Waypoints can be removed
- ✅ Route geometry updates with waypoints
- ✅ Auto-waypoint generation works
- ✅ Waypoint constraints work (on-grid, on-surface, etc.)
- ✅ Waypoint editor UI functional

DELIVERABLES:
- src/routing/waypoints/Waypoint.ts
- src/routing/waypoints/WaypointRenderer.ts
- src/routing/waypoints/WaypointConstraints.ts
- src/routing/waypoints/AutoWaypointGenerator.ts
- src/routing/ui/WaypointEditor.tsx
- Updated Route class with waypoint support
- Unit tests
```

---

## 🔄 AGENT 11: Integration & Testing Coordinator

**Branch:** `feature/integration-testing`
**Current Progress:** 0%
**Target:** 100%
**Files:** `tests/integration/`, CI/CD updates

```
TASK: Coordinate all 11 agents' work, integration testing, and final polish

CONTEXT:
- 10 agents working in parallel on different features
- Need to merge all branches together
- Integration testing to ensure everything works together
- Final polish and bug fixes

RESPONSIBILITIES:

1. **Branch Management**
   - Track all 10 feature branches
   - Coordinate merge order
   - Resolve merge conflicts
   - Create integration branch

2. **Integration Testing**
   - Test each feature individually
   - Test features together (integration tests)
   - Performance testing with all features enabled
   - Regression testing (ensure old features still work)

3. **Merge Order (Recommended)**
   ```bash
   # 1. Foundation features first
   git checkout feature/smart-routing-system
   git merge feature/panel-state-persistence
   git merge feature/material-library

   # 2. Validation features
   git merge feature/connector-compatibility
   git merge feature/collision-detection
   git merge feature/advanced-warnings
   git merge feature/preflight-validation

   # 3. Editing features
   git merge feature/route-editing-enhancements
   git merge feature/waypoint-system
   git merge feature/template-expansion

   # 4. Testing last
   git merge feature/playwright-tests-update
   ```

4. **Integration Tests**
   ```typescript
   // tests/integration/routing-workflow.spec.ts
   describe('Complete Routing Workflow', () => {
     test('Create route → Edit → Validate → Export', async () => {
       // 1. Create route using Quick Preset
       await page.click('button:has-text("Electrical")');
       await page.waitForSelector('.route-mesh');

       // 2. Edit route material
       await page.click('.route-edit-panel');
       await page.selectOption('select[name="material"]', 'copper_wire_awg_12');

       // 3. Add waypoint
       await page.click('.route-path', { position: { x: 100, y: 100 } });
       await page.waitForSelector('.waypoint-marker');

       // 4. Validate route
       const warnings = await page.locator('.route-warnings').count();
       expect(warnings).toBe(0);

       // 5. Check collision detection
       // Create overlapping route
       await page.click('button:has-text("Pipe")');
       const collisionWarning = await page.locator('text=/collision/i');
       expect(collisionWarning).toBeVisible();

       // 6. Pre-flight validation
       await page.click('button:has-text("Export")');
       await page.waitForSelector('.preflight-dialog');
       // Should have collision error
       const proceedBtn = page.locator('button:has-text("Proceed")');
       expect(await proceedBtn.isDisabled()).toBe(true);

       // 7. Fix collision
       await page.click('.auto-fix-button');
       await page.waitForTimeout(1000);
       // Now proceed should be enabled
       expect(await proceedBtn.isDisabled()).toBe(false);
     });

     test('Template → Multi-select → Bulk edit → Array', async () => {
       // Apply template
       await page.click('.templates-panel button:has-text("Office 120V")');
       await page.waitForSelector('.route-mesh');

       // Create 2 more routes
       await page.click('button:has-text("Electrical")');
       await page.click('button:has-text("Electrical")');

       // Multi-select (Shift+Click)
       await page.keyboard.down('Shift');
       await page.click('.route-mesh:nth-child(1)');
       await page.click('.route-mesh:nth-child(2)');
       await page.click('.route-mesh:nth-child(3)');
       await page.keyboard.up('Shift');

       // Bulk edit material
       await page.selectOption('.bulk-edit select[name="material"]', 'aluminum_wire');

       // Verify all routes have new material
       const routes = await page.locator('.route-mesh').all();
       for (const route of routes) {
         const material = await route.getAttribute('data-material');
         expect(material).toBe('aluminum_wire');
       }

       // Rectangular array
       await page.click('button:has-text("Array")');
       await page.selectOption('select[name="array-type"]', 'rectangular');
       await page.fill('input[name="rows"]', '3');
       await page.fill('input[name="columns"]', '3');
       await page.click('button:has-text("Create Array")');

       // Should have 3 original + 24 copies = 27 total (3×3 grid - 1 original)
       const totalRoutes = await page.locator('.route-mesh').count();
       expect(totalRoutes).toBe(27);
     });

     test('Panel state persistence', async () => {
       // Open Statistics panel
       await page.click('button:has-text("Statistics")');
       await page.waitForSelector('.route-stats-panel');

       // Resize panel
       const panel = page.locator('.route-stats-panel');
       const panelBox = await panel.boundingBox();
       await page.mouse.move(panelBox!.x + panelBox!.width, panelBox!.y + panelBox!.height / 2);
       await page.mouse.down();
       await page.mouse.move(panelBox!.x + panelBox!.width - 100, panelBox!.y + panelBox!.height / 2);
       await page.mouse.up();

       const newBox = await panel.boundingBox();
       expect(newBox!.width).toBeLessThan(panelBox!.width);

       // Refresh page
       await page.reload();

       // Panel should still be open and resized
       await page.waitForSelector('.route-stats-panel');
       const restoredBox = await panel.boundingBox();
       expect(restoredBox!.width).toBeCloseTo(newBox!.width, -1);
     });
   });
   ```

5. **Performance Testing**
   ```typescript
   describe('Performance Tests', () => {
     test('50 routes with collision detection <100ms', async () => {
       // Create 50 routes
       for (let i = 0; i < 50; i++) {
         await page.click('button:has-text("Electrical")');
       }

       // Measure collision detection time
       const start = Date.now();
       await page.click('button:has-text("Validate All")');
       await page.waitForSelector('.validation-complete');
       const elapsed = Date.now() - start;

       expect(elapsed).toBeLessThan(100);
     });

     test('Maintain 60 FPS with 100 routes', async () => {
       // Create 100 routes
       for (let i = 0; i < 100; i++) {
         await page.click('button:has-text("Pipe")');
       }

       // Measure FPS
       const fps = await page.evaluate(() => {
         return new Promise<number>((resolve) => {
           let frameCount = 0;
           const start = performance.now();

           function countFrames() {
             frameCount++;
             if (performance.now() - start < 1000) {
               requestAnimationFrame(countFrames);
             } else {
               resolve(frameCount);
             }
           }

           requestAnimationFrame(countFrames);
         });
       });

       expect(fps).toBeGreaterThan(60);
     });
   });
   ```

6. **Bug Tracking & Fixing**
   - Create GitHub issues for bugs found during integration
   - Assign to appropriate agent
   - Track resolution
   - Verify fixes

7. **Final Polish**
   - UI consistency check (colors, fonts, spacing)
   - Error message improvements
   - Loading states
   - Empty states
   - Tooltips and help text
   - Keyboard shortcuts documentation

8. **Documentation Updates**
   - Update PROFESSIONAL_MODE_FEATURES_ROADMAP.md
   - Update PROFESSIONAL_MODE_STATUS.md
   - Create user guide for new features
   - Update API documentation

9. **CI/CD Pipeline Updates**
   - Ensure all tests pass
   - Update GitHub Actions workflow
   - Add integration tests to CI
   - Performance benchmarking in CI

MERGE CHECKLIST:

For each feature branch:
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] No TypeScript errors
- [ ] No ESLint warnings (or documented exceptions)
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] Performance acceptable

FINAL DELIVERABLES:

- [ ] All 10 feature branches merged to feature/smart-routing-system
- [ ] All tests passing (unit + integration + E2E)
- [ ] Performance benchmarks met (60 FPS, <100ms collision detection)
- [ ] Documentation complete and up-to-date
- [ ] No critical bugs
- [ ] PR ready for merge to main

SUCCESS CRITERIA:
- ✅ All 10 features integrated successfully
- ✅ 0 merge conflicts (or all resolved)
- ✅ 100% test pass rate
- ✅ Performance targets met
- ✅ No regressions (old features still work)
- ✅ Documentation complete
```

---

## 📊 Progress Tracking

**Update this section daily:**

### Week 1 (Current)
- [ ] Agent 1: Playwright tests (0% → 100%)
- [ ] Agent 2: Panel state persistence (0% → 100%)
- [ ] Agent 3: Connector compatibility (25% → 100%)
- [ ] Agent 4: Material library (40% → 100%)
- [ ] Agent 5: Collision detection (0% → 100%)
- [ ] Agent 6: Advanced warnings (20% → 100%)
- [ ] Agent 7: Pre-flight validation (0% → 100%)
- [ ] Agent 8: Template expansion (30% → 100%)
- [ ] Agent 9: Route editing (0% → 100%)
- [ ] Agent 10: Waypoint system (0% → 100%)
- [ ] Agent 11: Integration (0% → 100%)

**Overall Progress:** 15% → 100%

---

## 🎯 Coordination

**Daily Standup Questions (for each agent):**
1. What did you complete yesterday?
2. What are you working on today?
3. Any blockers?
4. Ready to merge?

**Slack Channel:** #routing-system-sprint
**GitHub Project Board:** https://github.com/project/routing-sprint

---

**Good luck with the sprint! 🚀**
