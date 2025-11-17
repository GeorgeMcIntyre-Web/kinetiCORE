# Factory Piping – Elevation-Aware Placement

Factory utilities rarely live on a perfectly flat plane. Machines sit on skids, mezzanines introduce level changes, and service drops must hit precise heights. Elevation-aware placement keeps every piping node’s **Y** coordinate intentional (kinetiCORE is Z-up, so the vertical axis is `y`), ensuring the store, Babylon scene, and serialization all agree.

---

## Placement Modes

### On Floor
- Uses the Babylon pick hit directly; the node inherits the exact `y` value of the surface that was clicked.
- Ideal for drains, stands, or any run that should remain anchored to concrete or the top of a slab.
- If the ray misses geometry there is no node creation—the workflow waits for a valid hit.

### At Elevation (Fixed Height)
- Takes the clicked `x/z`, samples the hit floor height, and adds the default elevation offset from the store.
- The default is **1.0 m** and is clamped to ≥0 via `pipingStore.setDefaultElevation`.
- Best suited for utility racks or overhead air lines when viewed from plan/axonometric perspectives.

### Snap to Existing (planned)
- Not yet exposed in the Phase 0 build. Once implemented it will reuse the pick metadata to inherit the exact position of an existing piping mesh or snap target. Until then, nodes can still be snapped manually by editing their `y` value in the inspector.

---

## Default Elevation & Persistence

- `pipingStore` owns the placement settings globally (mode + `defaultElevation`).
- Settings survive panel open/close cycles and serialize with the network save data.
- The **Node Placement** card in `PipingPanel` lets you:
  - Toggle the radio buttons for **On floor** vs **Fixed height above floor**.
  - Enter a numeric elevation in meters (step 0.1, clamped to ≥0).
  - Pick from quick presets (0.5 m, 1.0 m, 2.0 m) via accessible buttons with aria labels.
- The inspector highlights `X / Y / Z` values so you can confirm the stored elevation after placement.

---

## Viewport Workflow

1. Enable **Factory Piping** mode (toolbar button).
2. Open the Piping Panel → **Network** tab → adjust placement mode/elevation.
3. Click in the viewport:
   - The workflow fetches `pipingStore.getPlacementSettings()` and runs `computeNodePositionFromHit`.
   - Nodes are created in the currently active network (auto-created if empty).
4. Hold **Shift + click** on an existing node to start a segment, then click the destination node.
5. Press **Esc** to cancel pending segment creation.

Mesh sync happens automatically through `PipingSceneService`, so the 3D spheres/cylinders reflect the final elevations without needing manual refreshes.

---

## Edge Cases & Slopes

- **No floor hit**: If the Babylon pick ray doesn’t intersect geometry the handler simply ignores the click—no ghost nodes are added. Use ground grids or proxy meshes when working above empty space.
- **Steep surfaces**: On-floor mode records the exact `y` of the sloped surface. Fixed-height mode still measures the underlying hit point but then adds the offset so overhead runs stay level.
- **Manual overrides**: You can always edit the `y` position numerically inside the inspector for precise adjustments (e.g., tying into equipment ports).

---

## Shortcuts & Accessibility

- **Shift + Click**: Start a segment from the clicked node.
- **Esc**: Cancel pending segment placement.
- **Tab order / aria labels**: All placement controls are native form elements with labels, so screen readers announce “Placement mode – On floor / Fixed height” and the preset buttons expose their height via `aria-label`.
- **Mouse-only HUD**: No HUD overlay is drawn in Phase 0; use the inspector or the placement card to verify current settings.

---

## Tips

- Leave the panel open while laying out runs—the placement controls update instantly with store changes.
- Use the presets when switching between standard rack heights (0.5 m tables, 1 m manifolds, 2 m headroom).
- When placing on mezzanines, start with On Floor to capture the deck height, then switch to Fixed Height to continue overhead routing without re-entering values each time.
