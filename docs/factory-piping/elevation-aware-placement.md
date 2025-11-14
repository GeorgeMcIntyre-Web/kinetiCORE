# Factory Piping – Elevation-Aware Placement

## Why Elevation Awareness Matters

Factory utilities rarely live on a perfectly flat floor. Machines sit on risers, conveyors enter at head height, and utility racks share real estate over workcells. Elevation-aware placement ensures every piping node records an explicit Y (height) coordinate, so downstream services (scene meshes, bills of material, clash detection, serialization) see the same geometry the operator intended. The workflow keeps the viewport interaction fast while respecting real-world constraints.

## Placement Modes

- **On Floor**  
  - Projects clicks to the currently detected floor mesh or ground grid.  
  - KinetiCORE is Z-up, so the stored elevation is the **Y** component of the hit point.  
  - Use this mode for drop legs, drains, and any piping that should sit directly on concrete. Elevation snaps to the floor height beneath the cursor even if the 3D selection happens above it.
- **At Elevation**  
  - Applies a fixed offset (Default Elevation) above the detected floor plane.  
  - Ideal for running services on an overhead rack or keeping compressed air at 3 m while you place endpoints from a top view.  
  - The offset is stored per network (`pipingStore.meta.defaultElevation`) and re-applied whenever the project loads.
- **Snap to Existing**  
  - When the cursor hovers a valid piping mesh, structural beam, or tagged assembly, the node inherits that surface’s elevation while keeping the XY from the pick hit.  
  - Use this mode to align to machine ports or previously modeled pipe.  
  - Snaps respect the Z-up axis; when the picked surface is angled, the final `position.y` equals the point where the ray intersects the mesh.

> Tip: Modes are mutually exclusive. Switching modes immediately updates the placement preview gizmo so you always know where the next node will land.

## Getting Started

1. **Activate Factory Piping**  
   - Click the water-droplet *Piping* button in the Utilities ribbon or press `Ctrl+Shift+P`.  
   - The `PipingPanel` docks on the right and the viewport switches to piping selection filters.

2. **Open the Placement Drawer**  
   - In `PipingPanel`, choose the **Placement** tab (next to Nodes / Segments / Properties).  
   - The drawer shows the current mode, default elevation, snap tolerances, and keyboard hints.

3. **Change Placement Mode**  
   - Use the radio-group or shortcuts: `F` (On Floor), `E` (At Elevation), `S` (Snap to Existing).  
   - A HUD badge shows the current mode + elevation in meters (Y-axis) next to the cursor for quick verification.

4. **Set Default Elevation**  
   - When *At Elevation* is active, type a value (meters) or use the ± buttons next to **Default Elevation**.  
   - Values persist per network via `pipingStore.meta.defaultElevation`, so reopening a project keeps the same rack height.

5. **Place Nodes**  
   - Left-click in the viewport. The workflow handler routes the click through the active placement strategy before calling `pipingStore.createNode`.  
   - Shift+click still selects the source node for segments; the destination uses the placement mode only if you exit segment mode.  
   - Inspector cards display `X / Y / Z` with Y highlighted so you can double-check the final elevation.

## Edge Cases & Safeguards

- **No Floor Detected**  
  - When the downward ray misses geometry in *On Floor* mode, the handler reuses the most recent default elevation and raises an “Estimated height” banner in the panel.  
  - You can still place the node; the warning remains until the node is snapped or edited with an explicit Y value.
- **Sloped Surfaces**  
  - *On Floor* samples the floor under the cursor; if the slope exceeds 8°, the HUD shows a “Steep floor” hint and the panel suggests switching to *Snap to Existing*.  
  - *At Elevation* ignores the slope entirely and keeps the constant offset—ideal for catwalk pipes above ramps.  
  - *Snap to Existing* follows the mesh normal and stores the exact intersection point, so elevated tie-ins stay flush even on sloped equipment.
- **Snap Conflicts**  
  - If multiple eligible targets overlap, the closest piping node wins, followed by meshes tagged `snap:factory_service`.  
  - Press `Tab` to cycle through candidates before clicking; screen readers announce “Snap target 1 of N” via the placement tab’s aria-live region.

## Keyboard & Accessibility

- `Ctrl+Shift+P` – Toggle Factory Piping mode.
- `F` / `E` / `S` – Switch placement mode without leaving the viewport.
- `Alt+Scroll` – Adjust default elevation in 100 mm increments while staying in *At Elevation*.
- `Shift+Click` – Start a segment from the clicked node; `Esc` cancels pending segments or snaps.
- `Tab` – Cycle through overlapping snap targets before confirming placement.
- The placement panel exposes full keyboard navigation, and screen readers announce the active mode, elevation, and warning banners through an aria-live region.

## Summary Workflow

1. Enable Piping mode.  
2. Pick the placement mode suited to the current run.  
3. (Optional) Set / tweak the default elevation.  
4. Click to place nodes, Shift+click to connect them with segments.  
5. Use Snap mode for machine tie-ins, and review warnings in the panel if height assumptions were made.

Consistent elevation data means piping descriptions, serialization exports, and Babylon meshes all agree—reducing surprises when the layout hits the shop floor.
