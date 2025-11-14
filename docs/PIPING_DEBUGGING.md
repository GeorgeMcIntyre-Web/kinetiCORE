# Piping Debugging

## Debugging elevation placement

- **Enable the flag:** Set `PIPING_DEBUG_ELEVATION` to `true` inside `src/services/piping/pipingDebug.ts`, then rebuild. The constant is easy to search/flip before shipping.
- **Visual overlays:** When enabled, `PipingSceneService` draws a green marker at the raw floor hit, an orange marker at the resolved node elevation, and a yellow line connecting them to highlight the applied offset. Click placements again to refresh the overlays.
- **Cleanup:** Overlays dispose automatically when you toggle the flag off, stop the scene service, or cancel placement flows.
- **Console logs:** All elevation-related steps emit `[PIPING] ...` messages via `logPipingDebug`. You can see pointer hits, placement mode decisions, fallback network creation, and any rejected edge cases (missing hits, forbidden segments, etc.).
- **Workflow tips:** Use the overlays to verify offsets in real time, then cross-check the console payloads (which include floor vs. node coordinates) to confirm default elevations and diagnose floor-detection issues.

