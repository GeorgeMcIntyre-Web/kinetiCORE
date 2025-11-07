# Connector Specification UI Agent

**Agent Type**: Local (Cursor/Codex)
**Priority**: 🟡 Medium
**Estimated Time**: 2-3 hours
**Owner**: Edwin (UI) or any frontend developer

---

## 🎯 Objective

Create a user interface for configuring electrical cable connectors/plugs at each end of a route, with automatic pre-order length calculation including slack and connector dimensions.

---

## 📋 Background

User Requirements:
- "also plug type at each end for electric. to ensure connection and getting the pre order length correct before hand"

**What's Already Done** ✅:
- Backend specification system: `src/routing/specifications/RouteSpecifications.ts`
- Connector types defined (NEMA, IEC, BS, terminal blocks, etc.)
- Pre-order length calculation function
- Connector compatibility validation

**What Needs UI**:
- Connector selector dropdowns (End A and End B)
- Pre-order length display with breakdown
- Compatibility warnings display
- Integration into RouteInspector panel

---

## 🔧 Implementation Tasks

### Task 1: Create Connector Selector Component

**File**: `src/routing/ui/ConnectorSelector.tsx`

**Requirements**:
```typescript
interface ConnectorSelectorProps {
  label: string; // "End A" or "End B"
  value: ConnectorSpec;
  onChange: (connector: ConnectorSpec) => void;
  cableVoltage: number; // For filtering compatible connectors
  cableCurrent: number;
  coreCount: number;
}
```

**UI Elements**:
- Dropdown with all connector types from `CONNECTOR_DATABASE`
- Show connector details:
  - Type (NEMA-5-15, IEC-C13, etc.)
  - Voltage/Current rating
  - Pin count
  - Gender (Male/Female/Neutral)
- Filter out incompatible connectors (voltage/current too low)
- Warning icon if connector is under-rated

**Example**:
```tsx
<div className="connector-selector">
  <label>{label}</label>
  <select value={value.type} onChange={handleChange}>
    {Object.entries(CONNECTOR_DATABASE).map(([type, spec]) => (
      <option key={type} value={type} disabled={!isCompatible(spec)}>
        {type} - {spec.rating.voltage}V / {spec.rating.current}A
      </option>
    ))}
  </select>

  <div className="connector-details">
    <span>Gender: {value.gender}</span>
    <span>Pins: {value.pinCount}</span>
    <span>Length: {(value.length * 1000).toFixed(0)}mm</span>
  </div>
</div>
```

---

### Task 2: Create Pre-Order Length Display

**File**: `src/routing/ui/PreOrderLengthDisplay.tsx`

**Requirements**:
```typescript
interface PreOrderLengthDisplayProps {
  routeLength: number; // From route geometry
  connectorA: ConnectorSpec;
  connectorB: ConnectorSpec;
  slackPercentage: number;
  onSlackChange: (percentage: number) => void;
}
```

**UI Elements**:
- Display total pre-order length (bold, large)
- Breakdown table:
  - Route length: X.XX m
  - Connector A: XX mm
  - Connector B: XX mm
  - Slack (10%): X.XX m
  - **Total**: X.XX m
- Slider to adjust slack percentage (5% - 20%)
- Copy button to copy total length to clipboard
- Export button to generate BOM/order sheet

**Example**:
```tsx
<div className="pre-order-length-display">
  <h3>Pre-Order Cable Length</h3>

  <div className="total-length">
    <strong>{preOrderLength.totalLength.toFixed(2)} m</strong>
    <button onClick={copyToClipboard}>Copy</button>
  </div>

  <table className="length-breakdown">
    <tr>
      <td>Route Length:</td>
      <td>{preOrderLength.breakdown.route.toFixed(2)} m</td>
    </tr>
    <tr>
      <td>Connectors:</td>
      <td>{(preOrderLength.breakdown.connectors * 1000).toFixed(0)} mm</td>
    </tr>
    <tr>
      <td>Slack ({slackPercentage}%):</td>
      <td>{preOrderLength.breakdown.slack.toFixed(2)} m</td>
    </tr>
  </table>

  <div className="slack-adjuster">
    <label>Slack Percentage:</label>
    <input
      type="range"
      min={5}
      max={20}
      value={slackPercentage}
      onChange={(e) => onSlackChange(Number(e.target.value))}
    />
    <span>{slackPercentage}%</span>
  </div>
</div>
```

---

### Task 3: Integrate into RouteInspector

**File**: `src/routing/ui/RouteInspector.tsx`

**Add to Electrical Routes**:

When route type is `electrical`, show:

1. **Connector Configuration Section**:
   ```tsx
   <div className="connector-section">
     <h3>Connectors / Plugs</h3>

     <ConnectorSelector
       label="End A (Source)"
       value={electricalSpec.connectorA}
       onChange={(connector) => updateConnectorA(connector)}
       cableVoltage={electricalSpec.voltage}
       cableCurrent={electricalSpec.current}
       coreCount={electricalSpec.coreCount}
     />

     <ConnectorSelector
       label="End B (Destination)"
       value={electricalSpec.connectorB}
       onChange={(connector) => updateConnectorB(connector)}
       cableVoltage={electricalSpec.voltage}
       cableCurrent={electricalSpec.current}
       coreCount={electricalSpec.coreCount}
     />
   </div>
   ```

2. **Compatibility Warnings**:
   ```tsx
   {validationResult.warnings.length > 0 && (
     <div className="connector-warnings">
       {validationResult.warnings.map((warning, i) => (
         <div key={i} className="warning">
           ⚠️ {warning}
         </div>
       ))}
     </div>
   )}
   ```

3. **Pre-Order Length Display**:
   ```tsx
   <PreOrderLengthDisplay
     routeLength={route.getTotalLength()}
     connectorA={electricalSpec.connectorA}
     connectorB={electricalSpec.connectorB}
     slackPercentage={slackPercentage}
     onSlackChange={setSlackPercentage}
   />
   ```

---

### Task 4: Add Export to BOM

**Feature**: Generate Bill of Materials for ordering

**File**: `src/routing/ui/ExportBOM.tsx`

**Format** (CSV or JSON):
```
Item,Quantity,Part Number,Description,Specification
Cable,1,"[Cable Part #]","Multi-core 14 AWG Cable","3-core, 120V/15A, {totalLength}m"
Connector A,1,"{connectorA.partNumber}","{connectorA.type}","{voltage}V / {current}A"
Connector B,1,"{connectorB.partNumber}","{connectorB.type}","{voltage}V / {current}A"
```

**Button**:
```tsx
<button className="export-bom" onClick={exportBOM}>
  Export BOM (CSV)
</button>
```

---

## 🎨 Styling Requirements

### CSS File: `src/routing/ui/ConnectorUI.css`

**Key Styles**:
- Connector selectors: Dropdown with icon for gender (♂/♀/⚬)
- Compatibility warnings: Yellow/red background
- Pre-order length: Large, bold, green when valid
- BOM export button: Blue with download icon

**Example**:
```css
.connector-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.connector-selector select {
  padding: 8px;
  font-size: 14px;
}

.connector-selector select option:disabled {
  color: #999;
  background: #f0f0f0;
}

.connector-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
}

.connector-warnings {
  background: #fff3cd;
  border: 1px solid #ffc107;
  padding: 8px;
  border-radius: 4px;
  margin-top: 8px;
}

.connector-warnings .warning {
  padding: 4px 0;
}

.pre-order-length-display {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin-top: 16px;
}

.pre-order-length-display .total-length {
  font-size: 24px;
  color: #28a745;
  display: flex;
  align-items: center;
  gap: 12px;
}

.length-breakdown {
  width: 100%;
  margin-top: 12px;
  font-size: 14px;
}

.length-breakdown td {
  padding: 4px 0;
}

.length-breakdown td:last-child {
  text-align: right;
  font-weight: bold;
}

.slack-adjuster {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.slack-adjuster input[type="range"] {
  flex: 1;
}
```

---

## ✅ Testing Checklist

### Manual Tests

- [ ] **Connector Selection**:
  - Select NEMA-5-15 for End A
  - Select IEC-C13 for End B
  - Verify details display correctly

- [ ] **Compatibility Validation**:
  - Set cable to 240V/20A
  - Try to select 120V/15A connector
  - Should show warning or disable option

- [ ] **Pre-Order Length**:
  - Create 5m route
  - Default slack 10%
  - Total should be: 5.0 + 0.05 + 0.04 + 0.5 = 5.59m

- [ ] **Slack Adjustment**:
  - Move slider to 15%
  - Total should update to 5.84m

- [ ] **BOM Export**:
  - Click "Export BOM"
  - CSV should download with cable + 2 connectors

---

## 📚 References

### Import these from specifications:
```typescript
import {
  ConnectorSpec,
  ConnectorType,
  ElectricalSpec,
  CONNECTOR_DATABASE,
  calculatePreOrderLength,
  validateConnectorPair,
} from '../../specifications/RouteSpecifications';
```

### Example Usage:
```typescript
// Calculate pre-order length
const result = calculatePreOrderLength(
  5.0, // route length
  connectorA,
  connectorB,
  10 // slack %
);
console.log(result.totalLength); // 5.59

// Validate connectors
const validation = validateConnectorPair(
  connectorA,
  connectorB,
  electricalSpec
);
if (!validation.compatible) {
  alert(validation.warnings.join('\n'));
}
```

---

## 🚀 Success Criteria

- [ ] Connector dropdowns work with all 12 connector types
- [ ] Gender icons display correctly (♂/♀/⚬)
- [ ] Incompatible connectors are filtered or disabled
- [ ] Pre-order length calculation is accurate
- [ ] Slack percentage slider works (5%-20%)
- [ ] BOM export generates valid CSV
- [ ] Warnings display when connectors under-rated
- [ ] UI integrates seamlessly into RouteInspector
- [ ] All TypeScript types are correct (no `any`)

---

## 📸 Expected UI

**RouteInspector with Connectors**:
```
┌─ Route Inspector ─────────────────────────┐
│ Route: electrical_route_001               │
│ Type: Electrical                          │
│                                           │
│ ┌─ Connectors / Plugs ──────────────────┐ │
│ │ End A (Source)                        │ │
│ │ [NEMA-5-15 - 125V / 15A ▼]           │ │
│ │ Gender: ♂  Pins: 3  Length: 50mm     │ │
│ │                                       │ │
│ │ End B (Destination)                   │ │
│ │ [IEC-C13 - 250V / 10A ▼]            │ │
│ │ Gender: ♀  Pins: 3  Length: 40mm     │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ ┌─ Pre-Order Cable Length ──────────────┐ │
│ │ **5.59 m**                [Copy]      │ │
│ │                                       │ │
│ │ Route Length:     5.00 m             │ │
│ │ Connectors:       90 mm              │ │
│ │ Slack (10%):      0.50 m             │ │
│ │ ─────────────────────────            │ │
│ │ Total:            5.59 m             │ │
│ │                                       │ │
│ │ Slack: [====■====] 10%               │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ [Export BOM]  [Generate Geometry]        │
└───────────────────────────────────────────┘
```

---

## 💡 Implementation Tips

1. **Start Small**: Build `ConnectorSelector` first, test it standalone
2. **Use Existing Patterns**: Look at `RouteSpecificationPanel.tsx` for similar UI
3. **Validation First**: Always validate connectors before saving
4. **Format Numbers**: Use `.toFixed(2)` for meters, `.toFixed(0)` for mm
5. **Icon Library**: Use lucide-react for gender icons or unicode (♂/♀/⚬)
6. **State Management**: Store connector specs in routing store, not local state

---

## 🐛 Common Pitfalls

- ❌ Forgetting to add connector length to total
- ❌ Not validating voltage/current compatibility
- ❌ Hardcoding slack percentage (should be user-adjustable)
- ❌ Not handling "hardwired" type (no connector, length = 0)
- ❌ Using string concatenation instead of calculation for total length

---

## Handoff

When complete:
1. Test all connector types (especially hardwired and custom)
2. Verify BOM export CSV format
3. Screenshot the UI and add to `docs/images/routing-connector-ui.png`
4. Commit with message: `feat(routing): add connector specification and pre-order length UI`
5. Update `.agents/AGENT_INSTRUCTIONS.md` completion checklist

---

**Ready to build!** All backend logic is done, just needs UI integration. 🚀
